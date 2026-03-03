import cv2
import numpy as np
import time
from collections import deque

class CentroidTracker:
    def __init__(self, max_disappeared=10, max_distance=100):
        self.next_object_id = 0
        self.objects = {}
        self.disappeared = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        
        # Store historical data for behavior analysis
        # id -> deque of (timestamp, x, y)
        self.history = {}
        self.history_size = 30 # Store last 30 frames

    def register(self, centroid):
        self.objects[self.next_object_id] = centroid
        self.disappeared[self.next_object_id] = 0
        self.history[self.next_object_id] = deque(maxlen=self.history_size)
        self.history[self.next_object_id].append((time.time(), centroid[0], centroid[1]))
        self.next_object_id += 1

    def deregister(self, object_id):
        del self.objects[object_id]
        del self.disappeared[object_id]
        del self.history[object_id]

    def update(self, rects):
        if len(rects) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return self.objects

        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for (i, (startX, startY, endX, endY)) in enumerate(rects):
            cX = int((startX + endX) / 2.0)
            cY = int((startY + endY) / 2.0)
            input_centroids[i] = (cX, cY)

        if len(self.objects) == 0:
            for i in range(0, len(input_centroids)):
                self.register(input_centroids[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())

            D = np.linalg.norm(np.array(object_centroids)[:, np.newaxis] - input_centroids, axis=2)
            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for (row, col) in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue
                
                if D[row, col] > self.max_distance:
                    continue

                object_id = object_ids[row]
                self.objects[object_id] = input_centroids[col]
                self.disappeared[object_id] = 0
                self.history[object_id].append((time.time(), input_centroids[col][0], input_centroids[col][1]))
                
                used_rows.add(row)
                used_cols.add(col)

            unused_rows = set(range(0, D.shape[0])).difference(used_rows)
            unused_cols = set(range(0, D.shape[1])).difference(used_cols)

            if D.shape[0] >= D.shape[1]:
                for row in unused_rows:
                    object_id = object_ids[row]
                    self.disappeared[object_id] += 1
                    if self.disappeared[object_id] > self.max_disappeared:
                        self.deregister(object_id)
            else:
                for col in unused_cols:
                    self.register(input_centroids[col])

        return self.objects

    def analyze_behavior(self, object_id):
        """
        Calculates speed and direction change for a given object.
        Returns (speed, direction_change_score, behavior_label)
        """
        hist = self.history.get(object_id)
        if not hist or len(hist) < 3:
            return 0.0, 0.0, "INITIALIZING"

        # Calculate speed (pixels per second) based on last 2 points
        t2, x2, y2 = hist[-1]
        t1, x1, y1 = hist[-2]
        dist = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
        dt = t2 - t1
        speed = dist / dt if dt > 0 else 0

        # Calculate erraticness (direction changes)
        # We look at the angle change between vectors (v1: p[-3]->p[-2]) and (v2: p[-2]->p[-1])
        t3, x3, y3 = hist[-3]
        v1 = np.array([x1 - x3, y1 - y3])
        v2 = np.array([x2 - x1, y2 - y1])
        
        # Normalize vectors for angle calculation
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        erratic_score = 0.0
        if norm1 > 2 and norm2 > 2: # Min movement threshold to avoid noise
            cos_theta = np.dot(v1, v2) / (norm1 * norm2)
            cos_theta = np.clip(cos_theta, -1.0, 1.0)
            angle = np.arccos(cos_theta) # in radians
            erratic_score = np.degrees(angle)

        # Basic behavior labeling
        if speed < 10:
            label = "LETHARGIC"
        elif erratic_score > 60:
            label = "ERRATIC"
        else:
            label = "NORMAL"

        return speed, erratic_score, label

def main():
    print("--- AquaSense360 Fish Tracking Test ---")
    print("Loading YOLO model...")
    
    try:
        from ultralytics import YOLO
        import os
        model_path = os.path.join(os.path.dirname(__file__), "models", "best.pt")
        yolo_model = YOLO(model_path)
        yolo_loaded = True
        print(f"✅ YOLO model loaded from {model_path}")
    except Exception as e:
        print(f"❌ Could not load YOLO model: {e}")
        print("Falling back to basic motion detection.")
        yolo_loaded = False
    
    # Try to open camera
    cap = cv2.VideoCapture(0)
    
    tracker = CentroidTracker(max_disappeared=15, max_distance=150)
    
    # Fallback motion detector
    fgbg = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=50, detectShadows=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        rects = []
        
        if yolo_loaded:
            # 1. 'DETECTION' STEP (Using YOLO)
            # Resize slightly for faster testing if needed
            results = yolo_model(frame, conf=0.4, verbose=False)
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # You can filter by class name here if your model detects multiple things
                        cls_id = int(box.cls[0])
                        class_name = result.names[cls_id]
                        
                        # Assuming the YOLO model detects "Healthy Fish" or "Diseased Fish"
                        # We track any detection
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        rects.append((int(x1), int(y1), int(x2), int(y2)))
                        
                        # Draw YOLO box bounds faintly
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (200, 200, 200), 1)

        else:
            # 1. 'DETECTION' STEP (Simulated using contours if YOLO fails)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (21, 21), 0)
            fgmask = fgbg.apply(gray)
            
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_OPEN, kernel)
            
            close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
            fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_CLOSE, close_kernel)
            fgmask = cv2.dilate(fgmask, close_kernel, iterations=2)
            
            contours, _ = cv2.findContours(fgmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for c in contours:
                if cv2.contourArea(c) < 2500: 
                    continue
                (x, y, w, h) = cv2.boundingRect(c)
                cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 255, 255), 1)
                rects.append((x, y, x + w, y + h))

        # 2. 'TRACKING' STEP
        objects = tracker.update(rects)

        # 3. 'ANALYSIS' AND DRAWING
        for (object_id, centroid) in objects.items():
            speed, erratic, behavior = tracker.analyze_behavior(object_id)
            
            # Color based on behavior
            color = (0, 255, 0) # Green for Normal
            if behavior == "ERRATIC":
                color = (0, 0, 255) # Red
            elif behavior == "LETHARGIC":
                color = (255, 100, 0) # Blue-ish
            
            # Draw trail
            points = tracker.history[object_id]
            for i in range(1, len(points)):
                cv2.line(frame, (points[i-1][1], points[i-1][2]), (points[i][1], points[i][2]), color, 2)

            # Draw ID and behavior
            text = f"ID {object_id}: {behavior}"
            cv2.putText(frame, text, (centroid[0] - 10, centroid[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            cv2.circle(frame, (centroid[0], centroid[1]), 4, color, -1)
            
            # Show speed/erraticness in small text
            stats = f"Spd: {int(speed)}px/s | Err: {int(erratic)}deg"
            cv2.putText(frame, stats, (centroid[0] - 10, centroid[1] + 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

        cv2.imshow("AquaSense360 Fish Tracking Test", frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
