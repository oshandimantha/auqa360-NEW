import os

MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_CLIENT_ID = "aquasense-ml-service"

TOPIC_WATER_QUALITY = "aquasense/ml/water-quality"
TOPIC_FISH_DISEASE = "aquasense/ml/fish-disease"
TOPIC_ML_STATUS = "aquasense/ml/status"

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000/api")

WQ_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "water_quality_model.pkl")
WQ_SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "scaler.pkl")
WQ_PREDICTION_INTERVAL = int(os.getenv("WQ_INTERVAL", 10))

FIXED_DO = 5.300345628998738
FIXED_AMMONIA = 0.048269369900325446

WQ_LABELS = {0: "Poor", 1: "Moderate", 2: "Good"}

FD_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "best.pt")
FD_CONFIDENCE_THRESHOLD = float(os.getenv("FD_CONFIDENCE", 0.4))

FF_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "fish_feeding_model.pkl")
FF_SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "feeding_scaler.pkl")
FF_PREDICTION_INTERVAL = int(os.getenv("FF_INTERVAL", 10))
TOPIC_FISH_FEEDING = "aquasense/ml/fish-feeding"

FF_LABELS = {0: "SKIP FEEDING", 1: "REDUCED FEEDING", 2: "FULL FEEDING"}

GAS_MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "fish_gas_model.pkl")
GAS_SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "gas_scaler.pkl")
GAS_PREDICTION_INTERVAL = int(os.getenv("GAS_INTERVAL", 10))
TOPIC_FISH_GAS = "aquasense/ml/fish-gas"

GAS_LABELS = {0: "SAFE", 1: "DANGER"}

DEFAULT_CAMERA = int(os.getenv("CAMERA_INDEX", 0))

STREAM_FPS = int(os.getenv("STREAM_FPS", 24))
YOLO_INPUT_SIZE = int(os.getenv("YOLO_SIZE", 416))
OVERLAY_PERSISTENCE = float(os.getenv("OVERLAY_PERSIST", 2.0))

