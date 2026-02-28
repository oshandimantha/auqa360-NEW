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
        """Bypass ML model loading and use rule-based deterministic logic instead."""
        print("✅ Water quality system using deterministic sensor rules (ML models bypassed)")
        self.loaded = True

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
        Run rule-based water quality prediction overriding the ML model.
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
        tds = sensor_data.get("tds", 0)

        # Check we have the required values
        if temp is None or ph is None or turbidity is None:
            print("⚠️ Missing sensor values (temp/ph/turbidity), skipping prediction")
            return None

        try:
            temp = float(temp)
            ph = float(ph)
            turbidity = float(turbidity)
            tds = float(tds)

            out_count = 0
            
            # Temperature: 24 - 30 °C
            if temp < 24.0 or temp > 30.0:
                out_count += 1
                
            # pH: 6.5 - 8.5
            if ph < 6.5 or ph > 8.5:
                out_count += 1
                
            # Turbidity: < 50 NTU
            if turbidity > 50.0:
                out_count += 1
                
            # TDS: 100 - 500 ppm
            if tds < 100.0 or tds > 500.0:
                out_count += 1

            # Define optimal ranges and maximum expected deviations
            bounds = {
                'temp': {'min': 24.0, 'max': 30.0, 'spread': 10.0},
                'ph': {'min': 6.5, 'max': 8.5, 'spread': 3.0},
                'turbidity': {'min': 0.0, 'max': 50.0, 'spread': 100.0},
                'tds': {'min': 100.0, 'max': 500.0, 'spread': 500.0}
            }

            def calc_health(val, b):
                # If within optimal range, health is 100%
                if b['min'] <= val <= b['max']:
                    return 100.0
                
                # Calculate how far out of bounds the value is
                deviation = 0.0
                if val < b['min']:
                    deviation = b['min'] - val
                elif val > b['max']:
                    deviation = val - b['max']
                
                # Health drops from 100% down to 0% as deviation reaches 'spread'
                penalty_ratio = min(deviation / b['spread'], 1.0)
                health = 100.0 * (1.0 - penalty_ratio)
                return max(health, 0.0)

            # Calculate individual health scores (0-100)
            h_temp = calc_health(temp, bounds['temp'])
            h_ph = calc_health(ph, bounds['ph'])
            h_turb = calc_health(turbidity, bounds['turbidity'])
            h_tds = calc_health(tds, bounds['tds'])

            # Final confidence is the mathematical average of all sensor health scores
            avg_health = (h_temp + h_ph + h_turb + h_tds) / 4.0
            confidence = round(avg_health, 2)

            # Classify label based purely on the aggregated health confidence score
            if confidence >= 80.0:
                label = "Good"
                class_id = 2
            elif confidence >= 50.0:
                label = "Moderate"
                class_id = 1
            else:
                label = "Poor"
                class_id = 0

            result = {
                "prediction": label,
                "classId": class_id,
                "confidence": confidence,
                "sensorValues": {
                    "temperature": temp,
                    "ph": ph,
                    "turbidity": turbidity,
                    "tds": tds,
                    "do": config.FIXED_DO,
                    "ammonia": config.FIXED_AMMONIA,
                },
            }

            print(f"🔬 Sensor-Based Water Quality: {label} ({confidence:.1f}% confidence)")
            return result

        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return None
