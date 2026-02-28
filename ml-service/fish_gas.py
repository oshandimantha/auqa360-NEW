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
        """Bypass ML model loading and use rule-based deterministic logic instead."""
        print("✅ Gas detection system using deterministic CO2 rules (ML models bypassed)")
        self.loaded = True

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
            co2 = float(co2)
            
            # Safe boundary is typically < 1000 ppm
            # High danger starts at > 2000 ppm
            SAFE_CO2_MAX = 1000.0
            MAX_SPREAD = 1000.0  # Reach 0% health at 2000 ppm
            
            # Calculate health (100% down to 0%)
            if co2 <= SAFE_CO2_MAX:
                confidence = 100.0
            else:
                deviation = co2 - SAFE_CO2_MAX
                penalty_ratio = min(deviation / MAX_SPREAD, 1.0)
                confidence = 100.0 * (1.0 - penalty_ratio)
            
            confidence = round(confidence, 2)

            # Assign labels conceptually based on the percentage
            if confidence >= 80.0:
                # 80-100% => Safe
                class_id = 0
                label = "SAFE"
            elif confidence >= 50.0:
                # 50-79% => Warning slightly high CO2, but class 1 in UI
                class_id = 1
                label = "DANGER"  # Using existing UI label map
            else:
                # 0-49% => Danger very high CO2
                class_id = 1
                label = "DANGER"

            result = {
                "gasLevel": class_id,
                "gasLabel": label,
                "confidence": confidence,
                "sensorValues": {
                    "ph": float(ph),
                    "temperature": float(temperature),
                    "co2": co2,
                    "alkalinity": DEFAULT_ALKALINITY,
                    "oxygenLevel": DEFAULT_OXYGEN_LEVEL,
                    "methaneLevel": DEFAULT_METHANE_LEVEL,
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }

            icon = "🟢" if class_id == 0 else "🔴"
            print(f"{icon} Sensor-Based Gas: {label} ({confidence:.1f}% safety) — CO2={co2}ppm")
            return result

        except Exception as e:
            print(f"❌ Gas prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None
