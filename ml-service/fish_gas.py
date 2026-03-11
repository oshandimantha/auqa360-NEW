import pickle
import numpy as np
import time
import config

DEFAULT_ALKALINITY = 99.5
DEFAULT_OXYGEN_LEVEL = 7.0
DEFAULT_METHANE_LEVEL = 2.5

class FishGasDetector:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.loaded = False

    def load(self):
        
        try:
            self.model = self._load_model_file(config.GAS_MODEL_PATH)
            print(f"✅ Gas detection model loaded from {config.GAS_MODEL_PATH}")

            self.scaler = self._load_model_file(config.GAS_SCALER_PATH)
            print(f"✅ Gas scaler loaded from {config.GAS_SCALER_PATH}")

            self.loaded = True
        except FileNotFoundError as e:
            print(f"❌ Gas model file not found: {e}")
            print("   Please place fish_gas_model.pkl and gas_scaler.pkl in ml-service/models/")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading gas model: {e}")
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
        
        if not self.loaded or sensor_data is None:
            return None

        ph = sensor_data.get("ph")
        temperature = sensor_data.get("temperature")
        co2 = sensor_data.get("co2")

        if any(v is None for v in [ph, temperature, co2]):
            missing = [k for k, v in {"ph": ph, "temperature": temperature, "co2": co2}.items() if v is None]
            print(f"⚠️ Missing sensor values for gas detection: {missing}")
            return None

        try:
            ph = float(ph)
            temperature = float(temperature)
            co2 = float(co2)

            features = np.array([[
                temperature,
                ph,
                DEFAULT_ALKALINITY,
                co2,
                DEFAULT_OXYGEN_LEVEL,
                DEFAULT_METHANE_LEVEL
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

            label = config.GAS_LABELS.get(class_id, "Unknown")

            result = {
                "gasLevel": class_id,
                "gasLabel": label,
                "confidence": round(confidence, 2),
                "sensorValues": {
                    "ph": ph,
                    "temperature": temperature,
                    "co2": co2,
                    "alkalinity": DEFAULT_ALKALINITY,
                    "oxygenLevel": DEFAULT_OXYGEN_LEVEL,
                    "methaneLevel": DEFAULT_METHANE_LEVEL,
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            icon = "🟢" if class_id == 0 else "🔴"
            print(f"{icon} ML Gas Detection: {label} ({confidence:.1f}% confidence) — CO2={co2}ppm")
            return result

        except Exception as e:
            print(f"❌ Gas prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None

