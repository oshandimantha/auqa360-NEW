import cv2
import time
import threading
import config

SECURITY_CLASSES = {
    'person', 'cat', 'dog', 'bird', 'horse', 'cow',
    'sheep', 'bear', 'elephant', 'zebra', 'giraffe'
}

class ThreadedCamera:
    def __init__(self, source=0):
        self.source = source
        self.cap = None
        self.frame = None
        self.ret = False
        self.lock = threading.Lock()
        self.running = False
        self._thread = None

    def start(self):
        if isinstance(self.source, str):
            self.cap = cv2.VideoCapture(self.source)
        else:
            self.cap = cv2.VideoCapture(int(self.source), cv2.CAP_DSHOW)

        if not self.cap.isOpened():
            print(f"❌ Security camera cannot open: {self.source}")
            return False

        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"✅ Security camera opened — {w}x{h} (source: {self.source})")

        self.running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True, name="SecurityCameraCapture")
        self._thread.start()
        return True

    def _capture_loop(self):
        while self.running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                with self.lock:
                    self.ret = ret
                    self.frame = frame
            else:
                time.sleep(0.1)
            time.sleep(0.003)

    def read(self):
        with self.lock:
            if self.frame is not None:
                return self.ret, self.frame.copy()
            return False, None

    def is_opened(self):
        return self.cap is not None and self.cap.isOpened()

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2)
        if self.cap:
            self.cap.release()
            self.cap = None
        print("📷 Security camera released")


class DetectionOverlay:
    def __init__(self):
        self.lock = threading.Lock()
        self.boxes = []
        self.timestamp = 0
        self.frame_shape = None

    def update(self, boxes, frame_shape):
        with self.lock:
            self.boxes = boxes
            self.timestamp = time.time()
            self.frame_shape = frame_shape

    def get(self):
        with self.lock:
            return self.boxes.copy(), self.timestamp, self.frame_shape

    def draw_on_frame(self, frame):
        boxes, ts, det_shape = self.get()

        if not boxes or det_shape is None:
            return frame

        age = time.time() - ts
        persistence = getattr(config, 'OVERLAY_PERSISTENCE', 2.0)
        if age > persistence:
            return frame

        alpha = max(0.3, 1.0 - (age / persistence) * 0.7)

        h_frame, w_frame = frame.shape[:2]
        h_det, w_det = det_shape[:2]
        sx = w_frame / w_det
        sy = h_frame / h_det

        overlay = frame.copy()

        for (x1, y1, x2, y2, class_name, confidence) in boxes:
            x1_s = int(x1 * sx)
            y1_s = int(y1 * sy)
            x2_s = int(x2 * sx)
            y2_s = int(y2 * sy)

            if class_name == 'person':
                color = (0, 0, 230)
            else:
                color = (0, 165, 255)

            cv2.rectangle(overlay, (x1_s, y1_s), (x2_s, y2_s), color, 2)
            label = f"{class_name} {confidence:.0f}%"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.55
            (tw, th), _ = cv2.getTextSize(label, font, font_scale, 1)
            cv2.rectangle(overlay, (x1_s, y1_s - th - 8), (x1_s + tw + 6, y1_s), color, -1)
            cv2.putText(overlay, label, (x1_s + 3, y1_s - 4), font, font_scale, (255, 255, 255), 1, cv2.LINE_AA)

        if alpha < 1.0:
            cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        else:
            frame[:] = overlay

        return frame


class StreamCompositor:
    def __init__(self, camera, overlay, update_frame_fn, target_fps=None):
        self.camera = camera
        self.overlay = overlay
        self.update_frame_fn = update_frame_fn
        self.target_fps = target_fps or getattr(config, 'STREAM_FPS', 24)
        self.running = False
        self._thread = None
        self.actual_fps = 0
        self._frame_count = 0
        self._fps_start = time.time()

    def start(self):
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="SecurityStreamCompositor")
        self._thread.start()
        print(f"🎬 Security stream compositor started (target: {self.target_fps} FPS)")

    def _loop(self):
        frame_interval = 1.0 / self.target_fps
        while self.running:
            t_start = time.time()
            try:
                ret, frame = self.camera.read()
                if ret and frame is not None:
                    frame = self.overlay.draw_on_frame(frame)
                    try:
                        self.update_frame_fn(frame)
                    except Exception:
                        pass

                    self._frame_count += 1
                    elapsed = time.time() - self._fps_start
                    if elapsed >= 2.0:
                        self.actual_fps = self._frame_count / elapsed
                        self._frame_count = 0
                        self._fps_start = time.time()
            except Exception as e:
                print(f"⚠️ Security compositor error: {e}")

            elapsed = time.time() - t_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=2)


class SecurityDetector:
    def __init__(self):
        self.model = None
        self.loaded = False
        self.camera = None
        self.camera_index = -1
        self.overlay = DetectionOverlay()
        self.compositor = None
        self._update_frame_fn = None

    def set_stream_fn(self, fn):
        self._update_frame_fn = fn

    def load(self):
        try:
            from ultralytics import YOLO
            model_path = getattr(config, 'SECURITY_MODEL_PATH', None)
            if not model_path:
                import os
                model_path = os.path.join(os.path.dirname(__file__), 'models', 'yolov8n.pt')
            self.model = YOLO(model_path)
            print(f"✅ Security YOLO model loaded (YOLOv8n) from {model_path}")
            self.loaded = True
        except Exception as e:
            print(f"❌ Error loading security YOLO model: {e}")
            self.loaded = False

    def open_camera(self, index):
        self.camera_index = index
        self.camera = ThreadedCamera(index)
        if self.camera.start():
            self._start_compositor()
            return True
        else:
            self.camera = None
            return False

    def _start_compositor(self):
        if self.camera is not None and self._update_frame_fn is not None:
            self.compositor = StreamCompositor(self.camera, self.overlay, self._update_frame_fn)
            self.compositor.start()

    def switch_camera(self, source):
        if self.compositor:
            self.compositor.stop()
            self.compositor = None
        if self.camera:
            self.camera.stop()

        self.camera_index = source
        self.camera = ThreadedCamera(source)
        if self.camera.start():
            self._start_compositor()
            return True
        self.camera = None
        return False

    def detect(self):
        if not self.loaded:
            return None
        if self.camera is None or not self.camera.is_opened():
            return None

        ret, frame = self.camera.read()
        if not ret or frame is None:
            return None

        try:
            t0 = time.time()
            conf_thresh = getattr(config, 'SECURITY_CONFIDENCE_THRESHOLD', 0.45)
            yolo_size = getattr(config, 'YOLO_INPUT_SIZE', 416)

            results = self.model(frame, conf=conf_thresh, imgsz=yolo_size, verbose=False)

            inference_ms = (time.time() - t0) * 1000

            detections = []
            overlay_boxes = []
            person_detected = False
            animal_detected = False
            max_confidence = 0.0

            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        class_name = result.names[cls_id]

                        if class_name not in SECURITY_CLASSES:
                            continue

                        x1, y1, x2, y2 = box.xyxy[0].tolist()

                        detections.append({
                            "class": class_name,
                            "confidence": round(conf * 100, 2),
                            "bbox": {
                                "x": int(x1), "y": int(y1),
                                "width": int(x2 - x1), "height": int(y2 - y1)
                            }
                        })
                        overlay_boxes.append((x1, y1, x2, y2, class_name, conf * 100))

                        if class_name == 'person':
                            person_detected = True
                        else:
                            animal_detected = True

                        if conf > max_confidence:
                            max_confidence = conf

            self.overlay.update(overlay_boxes, frame.shape)

            detected_classes = list({d["class"] for d in detections})

            result_data = {
                "personDetected": person_detected,
                "animalDetected": animal_detected,
                "detections": detections,
                "detectedClasses": detected_classes,
                "detectionCount": len(detections),
                "maxConfidence": round(max_confidence * 100, 2),
                "cameraSource": str(self.camera_index),
                "inferenceMs": round(inference_ms, 1),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            if detections:
                names = ', '.join(detected_classes)
                print(f"🛡️ Security: {len(detections)} detection(s) — {names} [{inference_ms:.0f}ms]")

            return result_data

        except Exception as e:
            print(f"❌ Security YOLO inference error: {e}")
            return None

    def release_camera(self):
        if self.compositor:
            self.compositor.stop()
            self.compositor = None
        if self.camera:
            self.camera.stop()
            self.camera = None

    def get_camera_info(self):
        return {
            "currentCamera": str(self.camera_index),
            "isOpen": self.camera is not None and self.camera.is_opened(),
            "compositorFps": round(self.compositor.actual_fps, 1) if self.compositor else 0
        }
