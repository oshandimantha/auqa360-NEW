"""
AquaSense360 — YOLO Model Test Script
Opens your camera and runs the fish disease YOLO model in a live window.
Press 'Q' to quit, 'S' to save a screenshot, 'C' to cycle cameras (0-4).

Usage:
    python test_yolo.py              # Use default camera (0)
    python test_yolo.py 1            # Use camera index 1
    python test_yolo.py http://...   # Use IP camera URL
"""
import cv2
import sys
import time
import os

# ─── Configuration ───
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "best.pt")
CONFIDENCE = 0.5
WINDOW_NAME = "YOLO Fish Disease Detection Test"


def main():
    # ─── Load model ───
    print("=" * 60)
    print("  🧪 YOLO Fish Disease Detection — Test Script")
    print("=" * 60)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed. Run: pip install ultralytics")
        sys.exit(1)

    if not os.path.exists(MODEL_PATH):
        print(f"❌ Model not found: {MODEL_PATH}")
        print("   Place best.pt in ml-service/models/")
        sys.exit(1)

    print(f"📦 Loading model: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    print(f"✅ Model loaded — classes: {model.names}")
    print()

    # ─── Open camera ───
    source = 0
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        source = arg if arg.startswith("http") else int(arg)

    print(f"📷 Opening camera: {source}")
    if isinstance(source, int):
        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"❌ Cannot open camera: {source}")
        sys.exit(1)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"✅ Camera opened — {w}x{h}")
    print()
    print("─" * 60)
    print("  Controls:")
    print("    Q  — Quit")
    print("    S  — Save screenshot")
    print("    C  — Cycle to next camera (0→1→2→3→4→0)")
    print("─" * 60)
    print()

    current_cam = source if isinstance(source, int) else 0
    frame_count = 0
    fps = 0
    fps_start = time.time()
    screenshot_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️  Failed to read frame, retrying...")
            time.sleep(0.5)
            continue

        # ─── Run YOLO inference ───
        t0 = time.time()
        results = model(frame, conf=CONFIDENCE, verbose=False)
        inference_ms = (time.time() - t0) * 1000

        # ─── Parse detections ───
        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = result.names[cls_id]
                    detections.append({
                        "class": class_name,
                        "confidence": round(conf * 100, 1),
                        "cls_id": cls_id
                    })

        # ─── Draw annotated frame ───
        annotated = results[0].plot() if results else frame

        # ─── Calculate FPS ───
        frame_count += 1
        elapsed = time.time() - fps_start
        if elapsed >= 1.0:
            fps = frame_count / elapsed
            frame_count = 0
            fps_start = time.time()

        # ─── Draw info overlay ───
        info_lines = [
            f"FPS: {fps:.1f}  |  Inference: {inference_ms:.0f}ms",
            f"Detections: {len(detections)}",
            f"Camera: {current_cam if isinstance(source, int) else source}",
        ]
        for det in detections:
            info_lines.append(f"  -> {det['class']} ({det['confidence']}%)")

        y_offset = 30
        for line in info_lines:
            # Black background for readability
            (tw, th), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
            cv2.rectangle(annotated, (8, y_offset - th - 4), (16 + tw, y_offset + 4), (0, 0, 0), -1)
            cv2.putText(annotated, line, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 1)
            y_offset += 24

        # ─── Status bar at bottom ───
        h_frame, w_frame = annotated.shape[:2]
        status_color = (0, 0, 255) if detections else (0, 200, 0)
        status_text = "DISEASE DETECTED" if detections else "HEALTHY — No disease"
        cv2.rectangle(annotated, (0, h_frame - 35), (w_frame, h_frame), status_color, -1)
        cv2.putText(annotated, status_text, (10, h_frame - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # ─── Print to console on detections ───
        if detections:
            classes = ", ".join([f"{d['class']} ({d['confidence']}%)" for d in detections])
            print(f"🔴 DETECTED: {classes}  [{inference_ms:.0f}ms]")

        # ─── Show window ───
        cv2.imshow(WINDOW_NAME, annotated)

        # ─── Handle keypresses ───
        key = cv2.waitKey(1) & 0xFF

        if key == ord('q') or key == ord('Q'):
            print("\n👋 Quitting...")
            break

        elif key == ord('s') or key == ord('S'):
            screenshot_count += 1
            filename = f"yolo_test_{screenshot_count}.jpg"
            cv2.imwrite(filename, annotated)
            print(f"📸 Screenshot saved: {filename}")

        elif key == ord('c') or key == ord('C'):
            # Cycle cameras
            cap.release()
            current_cam = (current_cam + 1) % 5
            print(f"📷 Switching to camera {current_cam}...")
            cap = cv2.VideoCapture(current_cam, cv2.CAP_DSHOW)
            if not cap.isOpened():
                print(f"   ❌ Camera {current_cam} not available, trying next...")
                for i in range(5):
                    current_cam = (current_cam + 1) % 5
                    cap = cv2.VideoCapture(current_cam, cv2.CAP_DSHOW)
                    if cap.isOpened():
                        print(f"   ✅ Switched to camera {current_cam}")
                        break
                else:
                    print("   ❌ No cameras available!")
                    break

    # ─── Cleanup ───
    cap.release()
    cv2.destroyAllWindows()
    print("✅ Test complete")


if __name__ == "__main__":
    main()
