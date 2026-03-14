"""
test_security.py — Quick test for the security detector (YOLO human/animal detection)
Run from ml-service/ directory:
    python test_security.py
"""

import sys
import os
import time
import cv2

sys.path.insert(0, os.path.dirname(__file__))

def test_model_load():
    print("=" * 55)
    print("  TEST 1: Model Loading")
    print("=" * 55)
    from security_detector import SecurityDetector
    det = SecurityDetector()
    det.load()
    if det.loaded:
        print("  ✅ PASS — yolov8n.pt loaded successfully")
    else:
        print("  ❌ FAIL — model failed to load")
    return det

def test_camera_scan():
    print("\n" + "=" * 55)
    print("  TEST 2: Camera Scan")
    print("=" * 55)
    found = []
    for i in range(6):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret:
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                found.append({"index": i, "resolution": f"{w}x{h}"})
                print(f"  ✅ Camera {i}: {w}x{h}")
            cap.release()

    if not found:
        print("  ⚠️  No cameras found — connect a USB camera")
    elif len(found) == 1:
        print(f"  ⚠️  Only 1 camera found (index {found[0]['index']})")
        print("      Fish disease will use it; security needs a 2nd USB camera")
    else:
        print(f"  ✅ {len(found)} cameras found")
        print(f"     Fish disease → Camera {found[0]['index']}")
        print(f"     Security     → Camera {found[1]['index']}")

    return found

def test_inference(det, cameras):
    print("\n" + "=" * 55)
    print("  TEST 3: YOLO Inference on Live Camera")
    print("=" * 55)

    if not det.loaded:
        print("  ⏭️  Skipped — model not loaded")
        return

    # Use camera 0 for test (whichever is available)
    cam_index = cameras[0]["index"] if cameras else 0

    if not det.open_camera(cam_index):
        print(f"  ❌ FAIL — could not open camera {cam_index}")
        return

    print(f"  📷 Using camera {cam_index} for inference test...")
    print("  🔍 Running 5 inference frames — walk in front of camera!")
    print()

    for i in range(5):
        t0 = time.time()
        result = det.detect()
        ms = (time.time() - t0) * 1000

        if result is None:
            print(f"  Frame {i+1}: ⚠️  No result (camera may need warmup)")
        elif result["detectionCount"] == 0:
            print(f"  Frame {i+1}: ✅ No person/animal detected [{ms:.0f}ms]")
        else:
            classes = ", ".join(result["detectedClasses"])
            print(f"  Frame {i+1}: 🛡️  DETECTED: {classes} "
                  f"({result['maxConfidence']:.1f}% conf) [{ms:.0f}ms]")

        time.sleep(0.2)

    det.release_camera()
    print("\n  ✅ Inference test complete")

def test_stream_server():
    print("\n" + "=" * 55)
    print("  TEST 4: Security Stream Server (port 8766)")
    print("=" * 55)
    try:
        from security_stream_server import start_security_stream_server
        start_security_stream_server(port=8766)
        time.sleep(1)

        import urllib.request
        try:
            res = urllib.request.urlopen("http://localhost:8766/health", timeout=3)
            data = res.read().decode()
            print(f"  ✅ Stream server running — /health: {data}")
        except Exception as e:
            print(f"  ⚠️  Stream server started but /health check failed: {e}")
            print("      This is OK if port 8766 is already in use")
    except Exception as e:
        print(f"  ❌ FAIL — {e}")

def main():
    print("\n" + "=" * 55)
    print("  🛡️  AquaSense360 — Security Detector Test")
    print("=" * 55 + "\n")

    det = test_model_load()
    cameras = test_camera_scan()
    test_inference(det, cameras)
    test_stream_server()

    print("\n" + "=" * 55)
    print("  Tests complete!")
    if det.loaded and cameras:
        print("  ✅ System ready — run python main.py to start")
    elif det.loaded and not cameras:
        print("  ⚠️  Model OK but no cameras found")
    else:
        print("  ❌ Fix model loading before running main.py")
    print("=" * 55 + "\n")

if __name__ == "__main__":
    main()
