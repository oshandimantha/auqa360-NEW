"""
AquaSense360 — ML Service Entry Point
Runs water quality prediction and fish disease detection in parallel,
publishing results via MQTT to the Node.js backend.
Includes a simple command interface for camera switching.
"""
import json
import time
import threading
import sys
import signal
import paho.mqtt.client as mqtt

import config
from water_quality import WaterQualityPredictor
from fish_disease import FishDiseaseDetector
from fish_feeding import FishFeedingPredictor
from fish_gas import FishGasDetector
from stream_server import start_stream_server

# Fix Windows console encoding for emoji/unicode characters
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')


# ─── Globals ───
mqtt_client = None
wq_predictor = WaterQualityPredictor()
fd_detector = FishDiseaseDetector()
ff_predictor = FishFeedingPredictor()
gas_detector = FishGasDetector()
running = True
fish_disease_enabled = True
feeder_ai_mode = False  # When True, ML model controls feeding

# Latest sensor data from MQTT (updated when ESP32 publishes)
latest_sensor_data = {
    "temperature": None,
    "ph": None,
    "turbidity": None,
    "tds": None,
    "co2": None,
}
sensor_data_lock = threading.Lock()


def on_mqtt_connect(client, userdata, flags, rc):
    """Called when connected to MQTT broker."""
    if rc == 0:
        print(f"✅ Connected to MQTT broker: {config.MQTT_BROKER}:{config.MQTT_PORT}")
        # Publish online status
        client.publish(config.TOPIC_ML_STATUS, json.dumps({
            "status": "online",
            "models": {
                "waterQuality": wq_predictor.loaded,
                "fishDisease": fd_detector.loaded,
                "fishFeeding": ff_predictor.loaded,
                "fishGas": gas_detector.loaded
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }))

        # Subscribe to ESP32 sensor data directly
        client.subscribe("aquasense/esp32/sensors")
        print("   📥 Subscribed to: aquasense/esp32/sensors (for water quality)")

        # Subscribe to camera switch commands from backend
        client.subscribe("aquasense/ml/cmd/camera")
        client.subscribe("aquasense/ml/cmd/fish-disease")

        # Subscribe to feeder commands and actuator status for AI mode tracking
        client.subscribe("aquasense/esp32/cmd/feeder")
        client.subscribe("aquasense/esp32/actuators/status")
        print("   📥 Subscribed to: feeder commands + actuator status (for AI mode)")
    else:
        print(f"❌ MQTT connection failed with code: {rc}")


def on_mqtt_message(client, userdata, msg):
    """Handle incoming MQTT messages (commands from backend + sensor data)."""
    global fish_disease_enabled, latest_sensor_data, feeder_ai_mode
    try:
        data = json.loads(msg.payload.decode())
        topic = msg.topic

        if topic == "aquasense/esp32/sensors":
            # Update latest sensor data for water quality predictions
            with sensor_data_lock:
                latest_sensor_data = {
                    "temperature": data.get("temperature"),
                    "ph": data.get("ph"),
                    "turbidity": data.get("turbidity"),
                    "tds": data.get("tds"),
                    "co2": data.get("co2"),
                }
            print(f"📊 Sensor data received — Temp: {data.get('temperature')}, pH: {data.get('ph')}, CO2: {data.get('co2')}, Turb: {data.get('turbidity')}, TDS: {data.get('tds')}")

        elif topic == "aquasense/ml/cmd/camera":
            # Switch camera command
            source = data.get("source", 0)
            print(f"\n📷 Camera switch command received: {source}")
            if isinstance(source, str) and source.startswith("http"):
                fd_detector.switch_camera(source)
            else:
                fd_detector.switch_camera(int(source))

        elif topic == "aquasense/ml/cmd/fish-disease":
            # Enable/disable fish disease detection
            action = data.get("action", "toggle")
            if action == "start":
                fish_disease_enabled = True
                print("\n🐟 Fish disease detection ENABLED")
            elif action == "stop":
                fish_disease_enabled = False
                print("\n🐟 Fish disease detection DISABLED")

        elif topic == "aquasense/esp32/cmd/feeder":
            # Track feeder mode changes
            action = data.get("action")
            if action == "setMode":
                mode = data.get("mode")
                if mode == "ai":
                    feeder_ai_mode = True
                    print("\n🧠 Feeder AI mode ENABLED — ML controls feeding")
                else:
                    feeder_ai_mode = False
                    print(f"\n🍽️ Feeder AI mode DISABLED")

        elif topic == "aquasense/esp32/actuators/status":
            # Sync AI mode state from ESP32 actuator status
            if data.get("feederAiMode") is not None:
                feeder_ai_mode = data.get("feederAiMode", False)

    except Exception as e:
        print(f"⚠️ Error handling MQTT message: {e}")


def water_quality_loop():
    """
    Periodically predict water quality using latest MQTT sensor data.
    Falls back to API if no MQTT data available.
    """
    global running
    print(f"💧 Water quality loop started (every {config.WQ_PREDICTION_INTERVAL}s)")

    while running:
        try:
            # Get sensor data from MQTT (primary) or API (fallback)
            sensor_data = None
            with sensor_data_lock:
                if latest_sensor_data["temperature"] is not None:
                    sensor_data = latest_sensor_data.copy()

            if sensor_data:
                print(f"💧 Using MQTT sensor data for prediction...")
            else:
                print(f"💧 No MQTT sensor data, trying API fallback...")
                sensor_data = wq_predictor.fetch_sensor_data()

            if sensor_data:
                result = wq_predictor.predict(sensor_data)
                if result and mqtt_client:
                    mqtt_client.publish(
                        config.TOPIC_WATER_QUALITY,
                        json.dumps(result)
                    )
                    print(f"💧 Published water quality prediction: {result['prediction']} ({result['confidence']}%)")
            else:
                print("💧 No sensor data available — skipping prediction")

        except Exception as e:
            print(f"⚠️ Water quality loop error: {e}")
            import traceback
            traceback.print_exc()

        # Wait for the next prediction interval
        for _ in range(config.WQ_PREDICTION_INTERVAL):
            if not running:
                break
            time.sleep(1)

    print("💧 Water quality loop stopped")


def fish_disease_loop():
    """
    YOLO inference thread — runs detection on latest camera frame as fast as
    possible, stores overlay for the compositor, and publishes metadata via MQTT.
    MQTT publishing is throttled to ~3/sec to avoid flooding the backend.
    The stream compositor (inside fd_detector) handles smooth video independently.
    """
    global running, fish_disease_enabled
    print("🐟 Fish disease detection loop started (decoupled pipeline)")

    # Open threaded camera + start stream compositor
    if not fd_detector.open_camera():
        print("❌ Cannot open camera — fish disease detection disabled")
        print("   Try switching camera with command: camera <index or URL>")
        return

    # Small warm-up to let camera stabilize
    time.sleep(1)

    inference_count = 0
    inference_start = time.time()
    last_mqtt_publish = 0
    MQTT_MIN_INTERVAL = 0.33  # Max ~3 MQTT messages/sec (detection overlay still runs at full speed)

    while running:
        if not fish_disease_enabled:
            time.sleep(1)
            continue

        try:
            t0 = time.time()

            # detect() grabs latest frame, runs YOLO, stores overlay for smooth video,
            # and returns metadata-only JSON
            result = fd_detector.detect()

            # Throttle MQTT publishing to avoid flooding the backend event loop
            # (the detection overlay for video stream still updates at full YOLO speed)
            now = time.time()
            if result and mqtt_client and (now - last_mqtt_publish) >= MQTT_MIN_INTERVAL:
                last_mqtt_publish = now
                mqtt_client.publish(
                    config.TOPIC_FISH_DISEASE,
                    json.dumps(result)
                )

            inference_time = time.time() - t0

            # Track inference FPS
            inference_count += 1
            elapsed = time.time() - inference_start
            if elapsed >= 10.0:
                yolo_fps = inference_count / elapsed
                print(f"🐟 YOLO inference: {yolo_fps:.1f} FPS | Stream: {fd_detector.compositor.actual_fps:.1f} FPS" if fd_detector.compositor else f"🐟 YOLO: {yolo_fps:.1f} FPS")
                inference_count = 0
                inference_start = time.time()

            # Minimum 50ms between inferences to avoid CPU saturation
            remaining = 0.05 - inference_time
            if remaining > 0:
                time.sleep(remaining)

        except Exception as e:
            print(f"⚠️ Fish disease loop error: {e}")
            time.sleep(2)

    fd_detector.release_camera()
    print("🐟 Fish disease detection loop stopped")


def fish_feeding_loop():
    """
    Periodically predict feeding level from CO2 sensor data.
    When AI mode is active and FULL/REDUCED feeding is predicted,
    triggers the feeder servo via MQTT.
    """
    global running, feeder_ai_mode
    print(f"🍽️ Fish feeding prediction loop started (every {config.FF_PREDICTION_INTERVAL}s)")

    while running:
        try:
            # Get all sensor data for feeding prediction
            sensor_snapshot = None
            with sensor_data_lock:
                sensor_snapshot = dict(latest_sensor_data)

            # Check that we have at least some sensor data
            has_data = sensor_snapshot and any(v is not None for v in sensor_snapshot.values())

            if has_data:
                result = ff_predictor.predict(sensor_snapshot)
                if result and mqtt_client:
                    # Add AI mode status to the result
                    result["aiModeActive"] = feeder_ai_mode

                    # Publish prediction to backend
                    mqtt_client.publish(
                        config.TOPIC_FISH_FEEDING,
                        json.dumps(result)
                    )

                    # If AI mode is active, trigger feeder based on prediction
                    if feeder_ai_mode and result["feedingLevel"] >= 1:
                        print(f"🤖 AI Feeding: Triggering servo ({result['feedingLabel']})")
                        mqtt_client.publish(
                            "aquasense/esp32/cmd/feeder",
                            json.dumps({
                                "action": "trigger",
                                "source": "ai",
                                "feedingLevel": result["feedingLevel"],
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
                            })
                        )
            else:
                print("🍽️ No sensor data yet — skipping feeding prediction")

        except Exception as e:
            print(f"⚠️ Fish feeding loop error: {e}")
            import traceback
            traceback.print_exc()

        # Wait for the next prediction interval
        for _ in range(config.FF_PREDICTION_INTERVAL):
            if not running:
                break
            time.sleep(1)


def fish_gas_loop():
    """
    Periodically predict gas safety from sensor data.
    Uses pH, temperature, CO2 from ESP32 + constant defaults for
    alkalinity, oxygen_level, methane_level (no sensors).
    """
    global running
    print(f"💨 Fish gas detection loop started (every {config.GAS_PREDICTION_INTERVAL}s)")

    while running:
        try:
            sensor_snapshot = None
            with sensor_data_lock:
                sensor_snapshot = dict(latest_sensor_data)

            has_data = sensor_snapshot and any(v is not None for v in sensor_snapshot.values())

            if has_data:
                result = gas_detector.predict(sensor_snapshot)
                if result and mqtt_client:
                    mqtt_client.publish(
                        config.TOPIC_FISH_GAS,
                        json.dumps(result)
                    )
            else:
                print("💨 No sensor data yet — skipping gas detection")

        except Exception as e:
            print(f"⚠️ Fish gas loop error: {e}")

        # Wait for the next prediction interval
        for _ in range(config.GAS_PREDICTION_INTERVAL):
            if not running:
                break
            time.sleep(1)

def command_interface():
    """
    Simple command interface for controlling the ML service.
    Runs in a separate thread reading stdin.
    """
    global running, fish_disease_enabled

    print("\n" + "=" * 60)
    print("  AquaSense360 ML Service — Command Interface")
    print("=" * 60)
    print("  Commands:")
    print("    cameras          — Scan and list available cameras")
    print("    camera <index>   — Switch to camera by index (0, 1, 2...)")
    print("    camera <url>     — Switch to IP/phone camera URL")
    print("    fish start/stop  — Enable/disable fish disease detection")
    print("    predict          — Force a water quality prediction now")
    print("    status           — Show current status")
    print("    quit             — Stop the service")
    print("=" * 60 + "\n")

    while running:
        try:
            cmd = input("ml-service> ").strip().lower()

            if not cmd:
                continue

            if cmd == "cameras":
                cameras = fd_detector.scan_cameras()
                if cameras:
                    print("\n  Available cameras:")
                    for cam in cameras:
                        marker = " ◀ active" if str(cam["index"]) == str(fd_detector.camera_index) else ""
                        print(f"    [{cam['index']}] {cam['name']} — {cam['resolution']} ({cam['type']}){marker}")
                else:
                    print("  No cameras found")
                print()

            elif cmd.startswith("camera "):
                source = cmd.split(" ", 1)[1].strip()
                if source.startswith("http"):
                    fd_detector.switch_camera(source)
                else:
                    try:
                        fd_detector.switch_camera(int(source))
                    except ValueError:
                        print("  ❌ Invalid camera index. Use a number or URL.")

            elif cmd == "fish start":
                fish_disease_enabled = True
                print("  🐟 Fish disease detection ENABLED")

            elif cmd == "fish stop":
                fish_disease_enabled = False
                print("  🐟 Fish disease detection DISABLED")

            elif cmd == "predict":
                print("  🔬 Forcing water quality prediction...")
                sensor_data = None
                with sensor_data_lock:
                    if latest_sensor_data["temperature"] is not None:
                        sensor_data = latest_sensor_data.copy()
                if not sensor_data:
                    sensor_data = wq_predictor.fetch_sensor_data()
                if sensor_data:
                    result = wq_predictor.predict(sensor_data)
                    if result:
                        print(f"  Result: {result['prediction']} ({result['confidence']}%)")
                        if mqtt_client:
                            mqtt_client.publish(config.TOPIC_WATER_QUALITY, json.dumps(result))
                            print("  Published to MQTT ✅")
                    else:
                        print("  ❌ Prediction failed")
                else:
                    print("  ❌ No sensor data available")

            elif cmd == "status":
                print(f"\n  Water Quality Model: {'✅ Loaded' if wq_predictor.loaded else '❌ Not loaded'}")
                print(f"  Fish Disease Model:  {'✅ Loaded' if fd_detector.loaded else '❌ Not loaded'}")
                print(f"  Fish Detection:      {'🟢 Running' if fish_disease_enabled else '🔴 Stopped'}")
                with sensor_data_lock:
                    has_data = latest_sensor_data["temperature"] is not None
                print(f"  Sensor Data (MQTT):  {'✅ Receiving' if has_data else '⏳ Waiting...'}")
                cam_info = fd_detector.get_camera_info()
                print(f"  Camera:              {cam_info['currentCamera']} ({'Open' if cam_info['isOpen'] else 'Closed'})")
                print(f"  MJPEG Stream:        http://localhost:8765/video_feed")
                print(f"  MQTT Connected:      {'✅' if mqtt_client and mqtt_client.is_connected() else '❌'}")
                print()

            elif cmd in ("quit", "exit", "q"):
                print("  🛑 Shutting down...")
                running = False
                break

            else:
                print(f"  Unknown command: {cmd}")
                print("  Type 'status' for info or 'quit' to exit")

        except EOFError:
            break
        except KeyboardInterrupt:
            running = False
            break


def shutdown(signum=None, frame=None):
    """Graceful shutdown."""
    global running
    running = False
    print("\n🛑 Shutting down ML service...")


def main():
    global mqtt_client, running

    print("=" * 60)
    print("  🧠 AquaSense360 ML Service")
    print("=" * 60)

    # ─── Register signal handlers ───
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # ─── Load models ───
    print("\n📦 Loading models...")
    wq_predictor.load()
    fd_detector.load()
    ff_predictor.load()
    gas_detector.load()

    if not wq_predictor.loaded and not fd_detector.loaded and not ff_predictor.loaded and not gas_detector.loaded:
        print("\n❌ No models loaded! Please place model files in ml-service/models/")
        print("   Required: water_quality_model.pkl, scaler.pkl, best.pt, fish_feeding_model.pkl, feeding_scaler.pkl")
        sys.exit(1)

    # ─── Scan cameras ───
    fd_detector.scan_cameras()

    # ─── Setup MQTT ───
    print(f"\n🔌 Connecting to MQTT broker: {config.MQTT_BROKER}:{config.MQTT_PORT}")
    mqtt_client = mqtt.Client(client_id=config.MQTT_CLIENT_ID)
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_message = on_mqtt_message

    try:
        mqtt_client.connect(config.MQTT_BROKER, config.MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"❌ MQTT connection failed: {e}")
        print("   ML service will run without MQTT publishing")

    # ─── Start MJPEG stream server ───
    if fd_detector.loaded:
        start_stream_server(port=8765)

    # ─── Start threads ───
    threads = []

    if wq_predictor.loaded:
        wq_thread = threading.Thread(target=water_quality_loop, daemon=True, name="WaterQuality")
        wq_thread.start()
        threads.append(wq_thread)

    if fd_detector.loaded:
        fd_thread = threading.Thread(target=fish_disease_loop, daemon=True, name="FishDisease")
        fd_thread.start()
        threads.append(fd_thread)

    if ff_predictor.loaded:
        ff_thread = threading.Thread(target=fish_feeding_loop, daemon=True, name="FishFeeding")
        ff_thread.start()
        threads.append(ff_thread)

    if gas_detector.loaded:
        gas_thread = threading.Thread(target=fish_gas_loop, daemon=True, name="FishGas")
        gas_thread.start()
        threads.append(gas_thread)

    # ─── Command interface (main thread) ───
    try:
        command_interface()
    except Exception:
        pass

    # ─── Cleanup ───
    running = False

    # Publish offline status
    if mqtt_client:
        try:
            mqtt_client.publish(config.TOPIC_ML_STATUS, json.dumps({
                "status": "offline",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
            }))
        except Exception:
            pass
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

    fd_detector.release_camera()

    # Wait for threads to finish
    for t in threads:
        t.join(timeout=3)

    print("✅ ML service stopped")


if __name__ == "__main__":
    main()
