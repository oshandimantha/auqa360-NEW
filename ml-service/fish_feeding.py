import pickle
import numpy as np
import time
import config

class FishFeedingPredictor:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.loaded = False

    def load(self):
        
        try:
            self.model = self._load_model_file(config.FF_MODEL_PATH)
            print(f"✅ Fish feeding model loaded from {config.FF_MODEL_PATH}")

            self.scaler = self._load_model_file(config.FF_SCALER_PATH)
            print(f"✅ Feeding scaler loaded from {config.FF_SCALER_PATH}")

            self.loaded = True
        except FileNotFoundError as e:
            print(f"❌ Feeding model file not found: {e}")
            print("   Please place fish_feeding_model.pkl and feeding_scaler.pkl in ml-service/models/")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading feeding model: {e}")
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

    def predict(self, sensor_data):
        
        if not self.loaded:
            return None

        if sensor_data is None:
            return None

        ph = sensor_data.get("ph")
        tds = sensor_data.get("tds")
        temperature = sensor_data.get("temperature")
        turbidity = sensor_data.get("turbidity")
        co2 = sensor_data.get("co2")

        if any(v is None for v in [ph, tds, temperature, turbidity, co2]):
            missing = [k for k, v in {"ph": ph, "tds": tds, "temperature": temperature,
                                       "turbidity": turbidity, "co2": co2}.items() if v is None]
            print(f"⚠️ Missing sensor values for feeding prediction: {missing}")
            return None

        try:

            features = np.array([[
                float(ph),
                float(tds),
                float(temperature),
                float(turbidity),
                float(co2)
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

            label = config.FF_LABELS.get(class_id, "Unknown")

            result = {
                "feedingLevel": class_id,
                "feedingLabel": label,
                "confidence": round(confidence, 2),
                "sensorValues": {
                    "ph": float(ph),
                    "tds": float(tds),
                    "temperature": float(temperature),
                    "turbidity": float(turbidity),
                    "co2": float(co2)
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            print(f"🍽️ Feeding: {label} ({confidence:.1f}%) — pH={ph}, TDS={tds}, Temp={temperature}, Turb={turbidity}, CO2={co2}")
            return result

        except Exception as e:
            print(f"❌ Feeding prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None

