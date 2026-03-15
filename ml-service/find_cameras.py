import cv2
import sys

# Windows console UTF-8 fix
sys.stdout.reconfigure(encoding='utf-8')

print("Scanning cameras (indices 0-5)...\n")
found = []
for i in range(6):
    cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
    if cap.isOpened():
        ret, frame = cap.read()
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        status = "OK" if ret else "Open but no frame"
        print(f"  Camera {i}: {status} -- {w}x{h}")
        found.append(i)
        cap.release()
    else:
        print(f"  Camera {i}: Not found")

print(f"\nFound {len(found)} camera(s): indices {found}")
if len(found) >= 2:
    print(f"\nSuggested assignment:")
    print(f"  Fish Disease -> camera {found[0]}")
    print(f"  Security     -> camera {found[1]}")
    print(f"\nIn ML terminal type:")
    print(f"  camera {found[0]}")
    print(f"  security camera {found[1]}")
else:
    print("  Only 1 camera found. Plug in second USB camera first.")
