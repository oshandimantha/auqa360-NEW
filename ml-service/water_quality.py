"""
AquaSense360 — Water Quality Predictor
Loads the pickle model + scaler and predicts water quality from sensor readings.
"""
import pickle
import numpy as np
import requests
import config


class WaterQualityPredictor:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.loaded = False

    def load(self):
        """Load the pickle model and scaler."""
        try:
            self.model = self._load_model_file(config.WQ_MODEL_PATH)
            print(f"✅ Water quality model loaded from {config.WQ_MODEL_PATH}")

            self.scaler = self._load_model_file(config.WQ_SCALER_PATH)
            print(f"✅ Scaler loaded from {config.WQ_SCALER_PATH}")

            self.loaded = True
        except FileNotFoundError as e:
            print(f"❌ Model file not found: {e}")
            print("   Please place water_quality_model.pkl and scaler.pkl in ml-service/models/")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading water quality model: {e}")
            self.loaded = False

    def _load_model_file(self, path):
        """Try loading a model file with joblib first (most common for sklearn), then pickle."""
        import warnings
        warnings.filterwarnings("ignore")  # Suppress all warnings during loading

        # Try joblib first (most sklearn models are saved this way)
        try:
            import joblib
            model = joblib.load(path)
            print(f"   (loaded via joblib)")
            return model
        except Exception as e1:
            print(f"   joblib failed: {e1}")

        # Try pickle with highest protocol
        try:
            with open(path, "rb") as f:
                model = pickle.load(f)
            print(f"   (loaded via pickle)")
            return model
        except Exception as e2:
            print(f"   pickle failed: {e2}")

        # Try pickle with latin1 encoding (cross-platform compatibility)
        try:
            with open(path, "rb") as f:
                model = pickle.load(f, encoding='latin1')
            print(f"   (loaded via pickle latin1)")
            return model
        except Exception as e3:
            print(f"   pickle latin1 failed: {e3}")

        raise Exception(f"Could not load {path} with any method")

    def fetch_sensor_data(self):
        """Fetch latest sensor readings from the backend API."""
        try:
            response = requests.get(f"{config.API_BASE_URL}/sensors", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return {
                    "temperature": data.get("temperature"),
                    "ph": data.get("ph"),
                    "turbidity": data.get("turbidity"),
                    "tds": data.get("tds"),
                }
            else:
                print(f"⚠️ API returned status {response.status_code}")
                return None
        except requests.exceptions.ConnectionError:
            print("⚠️ Cannot connect to backend API — is it running?")
            return None
        except Exception as e:
            print(f"⚠️ Error fetching sensor data: {e}")
            return None

    def predict(self, sensor_data=None):
        """
        Run water quality prediction.
        If sensor_data is None, fetches from the backend API.

        Returns dict with prediction info or None on failure.
        """
        if not self.loaded:
            print("⚠️ Model not loaded, skipping prediction")
            return None

        # Fetch sensor data if not provided
        if sensor_data is None:
            sensor_data = self.fetch_sensor_data()

        if sensor_data is None:
            return None

        temp = sensor_data.get("temperature")
        ph = sensor_data.get("ph")
        turbidity = sensor_data.get("turbidity")

        # Check we have the required values
        if temp is None or ph is None or turbidity is None:
            print("⚠️ Missing sensor values (temp/ph/turbidity), skipping prediction")
            return None

        # Build feature array in the training order:
        # [Temp, pH, DOmg/L, Turbidity_cm, Ammonia_mg_L_1_]
        features = np.array([[
            float(temp),
            float(ph),
            config.FIXED_DO,
            float(turbidity),
            config.FIXED_AMMONIA
        ]])

        try:
            # Scale features
            features_scaled = self.scaler.transform(features)

            # Predict
            prediction = self.model.predict(features_scaled)[0]
            class_id = int(prediction)

            # Try to get prediction probabilities if the model supports it
            confidence = 0.0
            try:
                probabilities = self.model.predict_proba(features_scaled)[0]
                confidence = float(max(probabilities)) * 100
            except AttributeError:
                # Model doesn't support predict_proba
                confidence = 100.0

            label = config.WQ_LABELS.get(class_id, "Unknown")

            result = {
                "prediction": label,
                "classId": class_id,
                "confidence": round(confidence, 2),
                "sensorValues": {
                    "temperature": float(temp),
                    "ph": float(ph),
                    "turbidity": float(turbidity),
                    "tds": float(sensor_data.get("tds", 0) or 0),
                    "do": config.FIXED_DO,
                    "ammonia": config.FIXED_AMMONIA,
                },
            }

            print(f"🔬 Water Quality: {label} ({confidence:.1f}% confidence)")
            return result

        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return None
