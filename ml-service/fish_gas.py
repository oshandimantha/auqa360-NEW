"""
AquaSense360 — Fish Gas Detection Predictor
Loads the gas detection model + scaler and predicts gas safety level.

Gas Classes:
  0 = SAFE     (normal gas levels)
  1 = DANGER   (elevated gas / low oxygen)

Features (6):
  - alkalinity     → constant (no sensor): 99.5
  - co2_level      → from ESP32 CO2 sensor
  - temperature    → from ESP32 DS18B20
  - ph             → from ESP32 pH sensor
  - oxygen_level   → constant (no sensor): 7.0
  - methane_level  → constant (no sensor): 2.5
"""
import pickle
import numpy as np
import time
import config


# Default constant values for sensors we don't have
# (Class 0 / safe averages from training data)
DEFAULT_ALKALINITY = 99.5
DEFAULT_OXYGEN_LEVEL = 7.0
DEFAULT_METHANE_LEVEL = 2.5


class FishGasDetector:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.loaded = False

    def load(self):
        """Load the gas detection model and scaler."""
        try:
            self.model = self._load_model_file(config.GAS_MODEL_PATH)
            print(f"✅ Gas detection model loaded from {config.GAS_MODEL_PATH}")

            self.scaler = self._load_model_file(config.GAS_SCALER_PATH)
            print(f"✅ Gas scaler loaded from {config.GAS_SCALER_PATH}")

            self.loaded = True
        except FileNotFoundError as e:
            print(f"❌ Gas model file not found: {e}")
            self.loaded = False
        except Exception as e:
            print(f"❌ Error loading gas model: {e}")
            self.loaded = False

    def _load_model_file(self, path):
        """Try loading a model file with joblib first, then pickle."""
        import warnings
        warnings.filterwarnings("ignore")

        try:
            import joblib
            return joblib.load(path)
        except Exception:
            pass

        try:
            with open(path, "rb") as f:
                return pickle.load(f)
        except Exception:
            pass

        try:
            with open(path, "rb") as f:
                return pickle.load(f, encoding='latin1')
        except Exception:
            pass

        raise Exception(f"Could not load {path}")

    def predict(self, sensor_data):
        """
        Predict gas safety from sensor data.

        Uses real sensor values for ph, temperature, co2 and
        constant defaults for alkalinity, oxygen_level, methane_level.

        Args:
            sensor_data: dict with keys: ph, temperature, co2

        Returns:
            dict with prediction or None on failure.
        """
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
            # Build feature array in training order:
            # [alkalinity, co2_level, temperature, ph, oxygen_level, methane_level]
            features = np.array([[
                DEFAULT_ALKALINITY,      # constant — no sensor
                float(co2),              # from ESP32
                float(temperature),      # from ESP32
                float(ph),               # from ESP32
                DEFAULT_OXYGEN_LEVEL,    # constant — no sensor
                DEFAULT_METHANE_LEVEL    # constant — no sensor
            ]])

            features_scaled = self.scaler.transform(features)
            prediction = self.model.predict(features_scaled)[0]
            class_id = int(prediction)

            # Probabilities
            confidence = 0.0
            try:
                probs = self.model.predict_proba(features_scaled)[0]
                confidence = float(max(probs)) * 100
            except AttributeError:
                confidence = 100.0

            label = config.GAS_LABELS.get(class_id, "Unknown")

            result = {
                "gasLevel": class_id,
                "gasLabel": label,
                "confidence": round(confidence, 2),
                "sensorValues": {
                    "ph": float(ph),
                    "temperature": float(temperature),
                    "co2": float(co2),
                    "alkalinity": DEFAULT_ALKALINITY,
                    "oxygenLevel": DEFAULT_OXYGEN_LEVEL,
                    "methaneLevel": DEFAULT_METHANE_LEVEL,
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            icon = "🟢" if class_id == 0 else "🔴"
            print(f"{icon} Gas: {label} ({confidence:.1f}%) — pH={ph}, Temp={temperature}, CO2={co2}")
            return result

        except Exception as e:
            print(f"❌ Gas prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None
