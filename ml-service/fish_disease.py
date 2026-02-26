"""
AquaSense360 — Fish Disease Detector (High-Performance Pipeline)
Decoupled architecture:
  - Camera thread: captures frames continuously (~30 FPS)
  - YOLO thread:   runs inference on latest frame (~3-5 FPS), stores overlay
  - Compositor:    draws latest overlay on raw frames, pushes to MJPEG at ~24 FPS

Result: smooth video stream with detection boxes, even between YOLO inferences.
"""
import cv2
import time
import threading
import numpy as np
import config


class ThreadedCamera:
    """
    Reads camera frames in a dedicated thread so YOLO never waits for camera I/O.
    Always has the latest frame available instantly.
    """

    def __init__(self, source=0):
        self.source = source
        self.cap = None
        self.frame = None
        self.ret = False
        self.lock = threading.Lock()
        self.running = False
        self._thread = None

    def start(self):
        """Open camera and start capture thread."""
        if isinstance(self.source, str):
            self.cap = cv2.VideoCapture(self.source)
        else:
            self.cap = cv2.VideoCapture(int(self.source), cv2.CAP_DSHOW)

        if not self.cap.isOpened():
            print(f"❌ Cannot open camera: {self.source}")
            return False

        # Optimize camera buffer — keep only latest frame
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"✅ Camera opened — {w}x{h} (source: {self.source})")

        self.running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True, name="CameraCapture")
        self._thread.start()
        return True

    def _capture_loop(self):
        """Continuously read frames in background."""
        while self.running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                with self.lock:
                    self.ret = ret
                    self.frame = frame
            else:
                time.sleep(0.1)
            # Minimal sleep — camera typically runs at 30 FPS
            time.sleep(0.003)

    def read(self):
        """Get the latest frame (non-blocking)."""
        with self.lock:
            if self.frame is not None:
                return self.ret, self.frame.copy()
            return False, None

    def is_opened(self):
        return self.cap is not None and self.cap.isOpened()

    def stop(self):
        """Stop capture thread and release camera."""
        self.running = False
        if self._thread:
            self._thread.join(timeout=2)
        if self.cap:
            self.cap.release()
            self.cap = None
        print("📷 Camera released")


class DetectionOverlay:
    """
    Thread-safe container for the latest YOLO detection results.
    The stream compositor reads this to draw bounding boxes on raw frames
    without waiting for YOLO to finish the next inference.
    """

    def __init__(self):
        self.lock = threading.Lock()
        self.boxes = []          # list of (x1,y1,x2,y2, class_name, confidence)
        self.timestamp = 0       # when last detection ran
        self.frame_shape = None  # shape of frame that was analyzed

    def update(self, boxes, frame_shape):
        """Called by YOLO thread after each inference."""
        with self.lock:
            self.boxes = boxes
            self.timestamp = time.time()
            self.frame_shape = frame_shape

    def get(self):
        """Called by compositor to get latest overlay data."""
        with self.lock:
            return self.boxes.copy(), self.timestamp, self.frame_shape

    def draw_on_frame(self, frame):
        """
        Draw the latest detection boxes on a raw camera frame.
        Handles resolution differences between detection and display frames.
        Fades out old detections after OVERLAY_PERSISTENCE seconds.
        """
        boxes, ts, det_shape = self.get()

        if not boxes or det_shape is None:
            return frame

        age = time.time() - ts
        persistence = getattr(config, 'OVERLAY_PERSISTENCE', 2.0)

        if age > persistence:
            return frame  # Detections too old, don't draw

        # Calculate alpha for fade-out effect
        alpha = max(0.3, 1.0 - (age / persistence) * 0.7)

        # Scale factors if detection was done at different resolution
        h_frame, w_frame = frame.shape[:2]
        h_det, w_det = det_shape[:2]
        sx = w_frame / w_det
        sy = h_frame / h_det

        overlay = frame.copy()

        for (x1, y1, x2, y2, class_name, confidence) in boxes:
            # Scale coordinates to current frame size
            x1_s = int(x1 * sx)
            y1_s = int(y1 * sy)
            x2_s = int(x2 * sx)
            y2_s = int(y2 * sy)

            # Color based on class
            lower_name = class_name.lower()
            if "healthy" in lower_name:
                color = (0, 230, 0)     # Green for healthy
            else:
                color = (0, 80, 255)    # Red-orange for disease

            # Draw bounding box
            thickness = 2
            cv2.rectangle(overlay, (x1_s, y1_s), (x2_s, y2_s), color, thickness)

            # Label background
            label = f"{class_name} {confidence:.0f}%"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.55
            (tw, th), baseline = cv2.getTextSize(label, font, font_scale, 1)
            cv2.rectangle(overlay, (x1_s, y1_s - th - 8), (x1_s + tw + 6, y1_s), color, -1)
            cv2.putText(overlay, label, (x1_s + 3, y1_s - 4), font, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        # Blend overlay with alpha for fade effect
        if alpha < 1.0:
            cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        else:
            frame[:] = overlay

        return frame


class StreamCompositor:
    """
    Runs at ~24 FPS in its own thread.
    Grabs the latest raw camera frame, draws detection overlay, and
    pushes the composited frame to the MJPEG stream server.
    Completely independent from YOLO inference timing.
    """

    def __init__(self, camera, overlay, target_fps=None):
        self.camera = camera
        self.overlay = overlay
        self.target_fps = target_fps or getattr(config, 'STREAM_FPS', 24)
        self.running = False
        self._thread = None
        self.actual_fps = 0
        self._frame_count = 0
        self._fps_start = time.time()

    def start(self):
        """Start compositor thread."""
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="StreamCompositor")
        self._thread.start()
        print(f"🎬 Stream compositor started (target: {self.target_fps} FPS)")

    def _loop(self):
        frame_interval = 1.0 / self.target_fps

        while self.running:
            t_start = time.time()

            try:
                ret, frame = self.camera.read()
                if ret and frame is not None:
                    # Draw detection overlay on raw frame
                    frame = self.overlay.draw_on_frame(frame)

                    # Push to MJPEG stream server
                    try:
                        from stream_server import update_frame
                        update_frame(frame)
                    except Exception:
                        pass

                    # FPS calculation
                    self._frame_count += 1
                    elapsed = time.time() - self._fps_start
                    if elapsed >= 2.0:
                        self.actual_fps = self._frame_count / elapsed
                        self._frame_count = 0
                        self._fps_start = time.time()

            except Exception as e:
                print(f"⚠️ Compositor error: {e}")

            # Maintain target FPS
            elapsed = time.time() - t_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2)


class FishDiseaseDetector:
    def __init__(self):
        self.model = None
        self.loaded = False
        self.camera = None          # ThreadedCamera instance
        self.camera_index = config.DEFAULT_CAMERA
        self.available_cameras = []
        self.overlay = DetectionOverlay()
        self.compositor = None      # StreamCompositor instance
        self.inference_fps = 0      # Actual YOLO FPS

    def load(self):
        """Load the YOLO model."""
        try:
            from ultralytics import YOLO
            self.model = YOLO(config.FD_MODEL_PATH)
            print(f"✅ Fish disease YOLO model loaded from {config.FD_MODEL_PATH}")
            self.loaded = True
        except FileNotFoundError:
            print(f"❌ Model file not found: {config.FD_MODEL_PATH}")
            print("   Please place best.pt in ml-service/models/")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading YOLO model: {e}")
            self.loaded = False

    def scan_cameras(self):
        """Scan for available cameras and return a list of camera info."""
        self.available_cameras = []
        print("📷 Scanning for available cameras...")

        for i in range(5):
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if cap.isOpened():
                ret, frame = cap.read()
                if ret:
                    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    self.available_cameras.append({
                        "index": i,
                        "name": f"Camera {i}",
                        "resolution": f"{w}x{h}",
                        "type": "usb/builtin"
                    })
                    print(f"   ✅ Camera {i}: {w}x{h}")
                cap.release()

        if not self.available_cameras:
            print("   ⚠️ No cameras found")

        return self.available_cameras

    def switch_camera(self, source):
        """Switch to a different camera."""
        # Stop compositor first
        if self.compositor is not None:
            self.compositor.stop()
            self.compositor = None

        # Stop current camera thread
        if self.camera is not None:
            self.camera.stop()

        self.camera_index = source
        print(f"📷 Switching to camera: {source}")

        self.camera = ThreadedCamera(source)
        if self.camera.start():
            # Restart compositor with new camera
            self._start_compositor()
            return True
        else:
            self.camera = None
            return False

    def _start_compositor(self):
        """Start the stream compositor thread."""
        if self.camera is not None:
            self.compositor = StreamCompositor(self.camera, self.overlay)
            self.compositor.start()

    def open_camera(self):
        """Open the default camera with threaded capture + compositor."""
        return self.switch_camera(self.camera_index)

    def release_camera(self):
        """Release the camera and stop compositor."""
        if self.compositor is not None:
            self.compositor.stop()
            self.compositor = None
        if self.camera is not None:
            self.camera.stop()
            self.camera = None

    def detect(self):
        """
        Run YOLO inference on the latest camera frame.
        Returns detection metadata only (no frame/base64).
        Detection overlay is stored for the compositor to draw.
        """
        if not self.loaded:
            return None

        # Get latest frame from threaded camera (non-blocking)
        if self.camera is None or not self.camera.is_opened():
            return None

        ret, frame = self.camera.read()
        if not ret or frame is None:
            return None

        try:
            t0 = time.time()

            # Resize for faster inference (if configured)
            yolo_size = getattr(config, 'YOLO_INPUT_SIZE', 640)

            # Run YOLO inference
            results = self.model(frame, conf=config.FD_CONFIDENCE_THRESHOLD,
                                 imgsz=yolo_size, verbose=False)

            inference_ms = (time.time() - t0) * 1000

            detections = []
            overlay_boxes = []
            disease_detected = False
            max_confidence = 0.0

            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        class_name = result.names[cls_id]

                        detections.append({
                            "class": class_name,
                            "classId": cls_id,
                            "confidence": round(conf * 100, 2),
                            "bbox": {
                                "x": int(x1),
                                "y": int(y1),
                                "width": int(x2 - x1),
                                "height": int(y2 - y1)
                            }
                        })

                        # Store for overlay drawing
                        overlay_boxes.append((x1, y1, x2, y2, class_name, conf * 100))

                        lower_name = class_name.lower()
                        if "disease" in lower_name or "sick" in lower_name or lower_name != "healthy":
                            disease_detected = True

                        if conf > max_confidence:
                            max_confidence = conf

            # Update detection overlay (compositor will draw these on stream)
            self.overlay.update(overlay_boxes, frame.shape)

            # Return metadata only — no base64, no frame
            result_data = {
                "diseaseDetected": disease_detected,
                "detections": detections,
                "detectionCount": len(detections),
                "maxConfidence": round(max_confidence * 100, 2),
                "status": "disease" if disease_detected else "healthy",
                "cameraSource": str(self.camera_index),
                "inferenceMs": round(inference_ms, 1),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            if detections:
                classes = [d["class"] for d in detections]
                print(f"🐟 Fish Disease: {len(detections)} detection(s) — {', '.join(classes)} [{inference_ms:.0f}ms]")

            return result_data

        except Exception as e:
            print(f"❌ YOLO inference error: {e}")
            return None

    def get_camera_info(self):
        """Get current camera info."""
        return {
            "currentCamera": str(self.camera_index),
            "isOpen": self.camera is not None and self.camera.is_opened(),
            "availableCameras": self.available_cameras,
            "compositorFps": round(self.compositor.actual_fps, 1) if self.compositor else 0
        }
