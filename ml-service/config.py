"""
AquaSense360 ML Service — Configuration
All settings for MQTT, API, camera, and model paths.
"""
import os

# ─── MQTT Broker (same as Node.js backend) ───
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_CLIENT_ID = "aquasense-ml-service"

# MQTT Topics  (publish predictions to these)
TOPIC_WATER_QUALITY = "aquasense/ml/water-quality"
TOPIC_FISH_DISEASE = "aquasense/ml/fish-disease"
TOPIC_ML_STATUS = "aquasense/ml/status"

# ─── Backend REST API ───
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000/api")

# ─── Water Quality Model ───
WQ_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "water_quality_model.pkl")
WQ_SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "scaler.pkl")
WQ_PREDICTION_INTERVAL = int(os.getenv("WQ_INTERVAL", 30))  # seconds

# Fixed constants for missing sensors
FIXED_DO = 5.300345628998738          # Dissolved Oxygen (mg/L)
FIXED_AMMONIA = 0.048269369900325446  # Ammonia (mg/L)

# Label mapping
WQ_LABELS = {0: "Poor", 1: "Moderate", 2: "Good"}

# ─── Fish Disease YOLO Model ───
FD_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "best.pt")
FD_CONFIDENCE_THRESHOLD = float(os.getenv("FD_CONFIDENCE", 0.5))

# ─── Fish Feeding Model ───
FF_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "fish_feeding_model.pkl")
FF_SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "feeding_scaler.pkl")
FF_PREDICTION_INTERVAL = int(os.getenv("FF_INTERVAL", 30))  # seconds
TOPIC_FISH_FEEDING = "aquasense/ml/fish-feeding"

# Feeding level labels
FF_LABELS = {0: "SKIP FEEDING", 1: "REDUCED FEEDING", 2: "FULL FEEDING"}

# ─── Fish Gas Detection Model ───
GAS_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "fish_gas_model.pkl")
GAS_SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "gas_scaler.pkl")
GAS_PREDICTION_INTERVAL = int(os.getenv("GAS_INTERVAL", 30))  # seconds
TOPIC_FISH_GAS = "aquasense/ml/fish-gas"

# Gas detection labels
GAS_LABELS = {0: "SAFE", 1: "DANGER"}

# ─── Camera Configuration ───
# Default camera index (0 = first camera, 1 = second, etc.)
# Can also be an IP camera URL like "http://192.168.1.100:8080/video"
# For DroidCam (phone): "http://<phone-ip>:4747/video"
DEFAULT_CAMERA = int(os.getenv("CAMERA_INDEX", 0))
