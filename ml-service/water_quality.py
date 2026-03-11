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
        
        try:
            self.model = self._load_model_file(config.WQ_MODEL_PATH)
            print(f"✅ Water quality model loaded from {config.WQ_MODEL_PATH}")

            self.scaler = self._load_model_file(config.WQ_SCALER_PATH)
            print(f"✅ Water quality scaler loaded from {config.WQ_SCALER_PATH}")

            self.loaded = True
        except FileNotFoundError as e:
            print(f"❌ Water quality model file not found: {e}")
            print("   Please place water_quality_model.pkl and scaler.pkl in ml-service/models/")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading water quality model: {e}")
            self.loaded = False

    def _load_model_file(self, path):
        
        import warnings
        warnings.filterwarnings("ignore")

        try:
            import joblib
            model = joblib.load(path)
            print(f"   (loaded via joblib)")
            return model
        except Exception:
            pass

        try:
            with open(path, "rb") as f:
                model = pickle.load(f)
            print(f"   (loaded via pickle)")
            return model
        except Exception:
            pass

        try:
            with open(path, "rb") as f:
                model = pickle.load(f, encoding='latin1')
            print(f"   (loaded via pickle latin1)")
            return model
        except Exception:
            pass

        raise Exception(f"Could not load {path} with any method")

    def fetch_sensor_data(self):
        
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
        
        if not self.loaded:
            print("⚠️ Model not loaded, skipping prediction")
            return None

        if sensor_data is None:
            sensor_data = self.fetch_sensor_data()

        if sensor_data is None:
            return None

        temp = sensor_data.get("temperature")
        ph = sensor_data.get("ph")
        turbidity = sensor_data.get("turbidity")
        tds = sensor_data.get("tds", 0)

        if temp is None or ph is None or turbidity is None:
            print("⚠️ Missing sensor values (temp/ph/turbidity), skipping prediction")
            return None

        try:
            temp = float(temp)
            ph = float(ph)
            turbidity = float(turbidity)
            tds = float(tds)

            features = np.array([[
                temp,
                ph,
                config.FIXED_DO,
                turbidity,
                config.FIXED_AMMONIA
            ]])

            features_scaled = self.scaler.transform(features)

            prediction = self.model.predict(features_scaled)[0]
            class_id = int(prediction)

            confidence = 0.0
            try:
                probabilities = self.model.predict_proba(features_scaled)[0]
                confidence = float(max(probabilities)) * 100
            except AttributeError:
                confidence = 100.0

            label = config.WQ_LABELS.get(class_id, "Unknown")

            result = {
                "prediction": label,
                "classId": class_id,
                "confidence": round(confidence, 2),
                "sensorValues": {
                    "temperature": temp,
                    "ph": ph,
                    "turbidity": turbidity,
                    "tds": tds,
                    "do": config.FIXED_DO,
                    "ammonia": config.FIXED_AMMONIA,
                },
            }

            print(f"🔬 ML Water Quality: {label} ({confidence:.1f}% confidence)")
            return result

        except Exception as e:
            print(f"❌ Prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None

