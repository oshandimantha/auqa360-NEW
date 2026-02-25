"""
AquaSense360 — Fish Feeding Predictor
Loads the pickle model + scaler and predicts feeding level from CO2/methane readings.

Feeding Levels:
  0 = SKIP FEEDING    (high methane ~686 ppm → fish not hungry)
  1 = REDUCED FEEDING (medium methane ~581 ppm)
  2 = FULL FEEDING    (low methane ~404 ppm → fish hungry)
"""
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
        """Load the pickle model and scaler."""
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
        """Try loading a model file with joblib first, then pickle."""
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
        """
        Predict feeding level from sensor data.

        The model expects 5 features in order: [pH, TDS, Temperature, Turbidity, Methane]
        Methane is mapped from the CO2 sensor reading.

        Args:
            sensor_data: dict with keys: ph, tds, temperature, turbidity, co2

        Returns:
            dict with prediction info or None on failure.
        """
        if not self.loaded:
            return None

        if sensor_data is None:
            return None

        ph = sensor_data.get("ph")
        tds = sensor_data.get("tds")
        temperature = sensor_data.get("temperature")
        turbidity = sensor_data.get("turbidity")
        co2 = sensor_data.get("co2")  # Used as Methane proxy

        # All 5 features are required
        if any(v is None for v in [ph, tds, temperature, turbidity, co2]):
            missing = [k for k, v in {"ph": ph, "tds": tds, "temperature": temperature,
                                       "turbidity": turbidity, "co2": co2}.items() if v is None]
            print(f"⚠️ Missing sensor values for feeding prediction: {missing}")
            return None

        try:
            # Build feature array in training order: [pH, TDS, Temperature, Turbidity, Methane]
            features = np.array([[
                float(ph),
                float(tds),
                float(temperature),
                float(turbidity),
                float(co2)  # Methane proxy
            ]])

            # Scale features
            features_scaled = self.scaler.transform(features)

            # Predict
            prediction = self.model.predict(features_scaled)[0]
            class_id = int(prediction)

            # Try to get prediction probabilities
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

