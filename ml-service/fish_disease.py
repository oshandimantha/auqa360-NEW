"""
AquaSense360 — Fish Disease Detector (Multithreaded)
Dedicated camera thread + YOLO inference thread with shared frame buffers.
Annotated frames are served via MJPEG stream (stream_server.py), NOT base64/MQTT.
"""
import cv2
import time
import threading
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
            # Small sleep to prevent busy-waiting (camera typically runs at 30 FPS)
            time.sleep(0.005)

    def read(self):
        """Get the latest frame (non-blocking)."""
        with self.lock:
            return self.ret, self.frame.copy() if self.frame is not None else None

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


class FishDiseaseDetector:
    def __init__(self):
        self.model = None
        self.loaded = False
        self.camera = None  # ThreadedCamera instance
        self.camera_index = config.DEFAULT_CAMERA
        self.available_cameras = []

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
        # Stop current camera thread
        if self.camera is not None:
            self.camera.stop()

        self.camera_index = source
        print(f"📷 Switching to camera: {source}")

        self.camera = ThreadedCamera(source)
        if self.camera.start():
            return True
        else:
            self.camera = None
            return False

    def open_camera(self):
        """Open the default camera with threaded capture."""
        return self.switch_camera(self.camera_index)

    def release_camera(self):
        """Release the camera."""
        if self.camera is not None:
            self.camera.stop()
            self.camera = None

    def detect(self):
        """
        Run YOLO inference on the latest camera frame.
        Returns detection metadata only (no frame/base64).
        The annotated frame is pushed to stream_server for MJPEG.
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
            # Run YOLO inference
            results = self.model(frame, conf=config.FD_CONFIDENCE_THRESHOLD, verbose=False)

            detections = []
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

                        lower_name = class_name.lower()
                        if "disease" in lower_name or "sick" in lower_name or lower_name != "healthy":
                            disease_detected = True

                        if conf > max_confidence:
                            max_confidence = conf

            # Push annotated frame to MJPEG stream server
            try:
                from stream_server import update_frame
                annotated_frame = results[0].plot() if results else frame
                update_frame(annotated_frame)
            except Exception:
                pass  # Stream server may not be running in test mode

            # Return metadata only — no base64, no frame
            result_data = {
                "diseaseDetected": disease_detected,
                "detections": detections,
                "detectionCount": len(detections),
                "maxConfidence": round(max_confidence * 100, 2),
                "status": "disease" if disease_detected else "healthy",
                "cameraSource": str(self.camera_index),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            if detections:
                classes = [d["class"] for d in detections]
                print(f"🐟 Fish Disease: {len(detections)} detection(s) — {', '.join(classes)}")

            return result_data

        except Exception as e:
            print(f"❌ YOLO inference error: {e}")
            return None

    def get_camera_info(self):
        """Get current camera info."""
        return {
            "currentCamera": str(self.camera_index),
            "isOpen": self.camera is not None and self.camera.is_opened(),
            "availableCameras": self.available_cameras
        }
