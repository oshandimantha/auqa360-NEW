import time
import numpy as np
from collections import deque

class CentroidTracker:
    def __init__(self, max_disappeared=15, max_distance=150):
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
            label = "ABNORMAL"
        elif erratic_score > 60:
            label = "ABNORMAL"
        else:
            label = "NORMAL"

        return speed, erratic_score, label
