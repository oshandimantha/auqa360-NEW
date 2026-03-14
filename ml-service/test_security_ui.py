"""
test_security_ui.py — Live visual test for security detector
Shows bounding boxes, labels, FPS, and detection stats in a real OpenCV window.

Run from ml-service/ directory:
    python test_security_ui.py

Controls:
    Q / ESC  — Quit
    C        — Change camera (cycle through 0-4)
    S        — Toggle detection on/off
"""

import sys
import os
import time
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import config

SECURITY_CLASSES = {
    'person', 'cat', 'dog', 'bird', 'horse', 'cow',
    'sheep', 'bear', 'elephant', 'zebra', 'giraffe'
}

COLORS = {
    'person': (60, 60, 230),      # Red
    'dog':    (30, 165, 255),     # Orange
    'cat':    (200, 100, 255),    # Purple
    'bird':   (0, 200, 200),      # Yellow
    'default':(60, 200, 60),      # Green
}

def draw_panel(frame, detections, fps, detection_active, cam_index):
    h, w = frame.shape[:2]
    panel_w = 260
    panel = np.zeros((h, panel_w, 3), dtype=np.uint8)
    panel[:] = (20, 20, 30)

    # Title
    cv2.putText(panel, "AI SECURITY", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
    cv2.putText(panel, "DETECTOR", (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 200, 255), 2)
    cv2.line(panel, (10, 65), (panel_w - 10, 65), (60, 60, 80), 1)

    # Status
    y = 90
    status_color = (60, 230, 60) if detection_active else (100, 100, 100)
    status_text = "ACTIVE" if detection_active else "PAUSED"
    cv2.circle(panel, (15, y-4), 6, status_color, -1)
    cv2.putText(panel, status_text, (30, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 1)

    # FPS
    y += 30
    fps_color = (60, 230, 60) if fps > 15 else (0, 165, 255) if fps > 5 else (60, 60, 230)
    cv2.putText(panel, f"FPS: {fps:.1f}", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.55, fps_color, 1)

    # Camera
    y += 25
    cv2.putText(panel, f"Camera: {cam_index}", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180,180,180), 1)

    cv2.line(panel, (10, y+10), (panel_w-10, y+10), (60, 60, 80), 1)

    # Detections
    y += 35
    if not detections:
        cv2.putText(panel, "No detections", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100,100,100), 1)
    else:
        cv2.putText(panel, f"{len(detections)} detected:", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
        y += 5
        for det in detections[:8]:
            y += 24
            cls = det['class']
            conf = det['confidence']
            color = COLORS.get(cls, COLORS['default'])
            icon = "👤" if cls == 'person' else "🐾"
            cv2.rectangle(panel, (10, y-16), (panel_w-10, y+6), (30,30,45), -1)
            cv2.rectangle(panel, (10, y-16), (panel_w-10, y+6), color, 1)
            cv2.putText(panel, f"{cls}", (16, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            cv2.putText(panel, f"{conf:.0f}%", (panel_w-48, y), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255,220,100), 1)

    # Controls
    cv2.line(panel, (10, h-90), (panel_w-10, h-90), (60, 60, 80), 1)
    cv2.putText(panel, "Controls:", (10, h-70), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150,150,150), 1)
    cv2.putText(panel, "Q/ESC — Quit", (10, h-52), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (120,120,120), 1)
    cv2.putText(panel, "C     — Change camera", (10, h-36), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (120,120,120), 1)
    cv2.putText(panel, "S     — Toggle detect", (10, h-20), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (120,120,120), 1)

    return np.hstack([frame, panel])

def draw_detections_on_frame(frame, detections):
    for det in detections:
        cls = det['class']
        conf = det['confidence']
        bbox = det['bbox']
        x1 = bbox['x']
        y1 = bbox['y']
        x2 = x1 + bbox['width']
        y2 = y1 + bbox['height']

        color = COLORS.get(cls, COLORS['default'])

        # Box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Filled label background
        label = f"{cls}  {conf:.0f}%"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
        cv2.putText(frame, label, (x1 + 4, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)

        # Alert flash for person
        if cls == 'person':
            overlay = frame.copy()
            cv2.rectangle(overlay, (x1, y1), (x2, y2), (60, 60, 230), -1)
            cv2.addWeighted(overlay, 0.08, frame, 0.92, 0, frame)

    return frame

def scan_cameras():
    found = []
    print("📷 Scanning cameras (0-4)...")
    for i in range(5):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                found.append(i)
                print(f"   ✅ Camera {i} available")
            cap.release()
    return found

def main():
    print("=" * 50)
    print("  🛡️  Security Detector — Live UI Test")
    print("=" * 50)

    # Load model
    from ultralytics import YOLO
    model_path = config.SECURITY_MODEL_PATH
    conf_thresh = config.SECURITY_CONFIDENCE_THRESHOLD

    print(f"\n📦 Loading model: {os.path.basename(model_path)}")
    try:
        model = YOLO(model_path)
        print("  ✅ Model loaded")
    except Exception as e:
        print(f"  ❌ Model load failed: {e}")
        sys.exit(1)

    # Scan and pick camera
    available = scan_cameras()
    if not available:
        print("❌ No cameras found. Plug in a USB camera and retry.")
        sys.exit(1)

    cam_idx_pos = 0
    cam_index = available[cam_idx_pos]

    cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    print(f"\n📷 Using camera {cam_index}")
    print("🖥️  Opening window... (press Q to quit)\n")

    detection_active = True
    last_detections = []

    fps_count = 0
    fps_start = time.time()
    fps_display = 0.0
    yolo_size = getattr(config, 'YOLO_INPUT_SIZE', 416)

    cv2.namedWindow("Security Detector", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Security Detector", 1100, 500)

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            print("⚠️  Camera read failed, retrying...")
            time.sleep(0.1)
            continue

        if detection_active:
            try:
                results = model(frame, conf=conf_thresh, imgsz=yolo_size, verbose=False)
                detections = []
                for result in results:
                    if result.boxes is not None:
                        for box in result.boxes:
                            cls_name = result.names[int(box.cls[0])]
                            if cls_name not in SECURITY_CLASSES:
                                continue
                            conf = float(box.conf[0])
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            detections.append({
                                'class': cls_name,
                                'confidence': conf * 100,
                                'bbox': {'x': int(x1), 'y': int(y1),
                                         'width': int(x2-x1), 'height': int(y2-y1)}
                            })
                last_detections = detections
                frame = draw_detections_on_frame(frame, detections)
            except Exception as e:
                print(f"⚠️  Inference error: {e}")

        # FPS
        fps_count += 1
        elapsed = time.time() - fps_start
        if elapsed >= 1.0:
            fps_display = fps_count / elapsed
            fps_count = 0
            fps_start = time.time()

        # Compose final display
        display = draw_panel(frame, last_detections, fps_display, detection_active, cam_index)
        cv2.imshow("Security Detector", display)

        key = cv2.waitKey(1) & 0xFF

        if key in (ord('q'), 27):  # Q or ESC
            break
        elif key == ord('s'):
            detection_active = not detection_active
            print(f"  {'▶️  Detection ENABLED' if detection_active else '⏸️  Detection PAUSED'}")
        elif key == ord('c'):
            cap.release()
            cam_idx_pos = (cam_idx_pos + 1) % len(available)
            cam_index = available[cam_idx_pos]
            cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            last_detections = []
            print(f"  📷 Switched to camera {cam_index}")

    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ UI test closed.")

if __name__ == "__main__":
    main()
