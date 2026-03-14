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
from security_detector import SecurityDetector
from stream_server import start_stream_server
from security_stream_server import start_security_stream_server, update_security_frame

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

mqtt_client = None
wq_predictor = WaterQualityPredictor()
fd_detector = FishDiseaseDetector()
ff_predictor = FishFeedingPredictor()
gas_detector = FishGasDetector()
sec_detector = SecurityDetector()
running = True
fish_disease_enabled = True
security_enabled = True
feeder_ai_mode = False

latest_sensor_data = {
    "temperature": None,
    "ph": None,
    "turbidity": None,
    "tds": None,
    "co2": None,
}
sensor_data_time = None       # time.time() when last MQTT sensor message arrived
SENSOR_STALE_SECONDS = 120   # treat data as stale after 2 min (ESP32 offline)
TEMP_ERROR_VALUE    = -50.0  # DS18B20 returns -127 on CRC fail / disconnected
sensor_data_lock = threading.Lock()

def on_mqtt_connect(client, userdata, flags, rc):
    
    if rc == 0:
        print(f"✅ Connected to MQTT broker: {config.MQTT_BROKER}:{config.MQTT_PORT}")

        client.publish(config.TOPIC_ML_STATUS, json.dumps({
            "status": "online",
            "models": {
                "waterQuality": wq_predictor.loaded,
                "fishDisease": fd_detector.loaded,
                "fishFeeding": ff_predictor.loaded,
                "fishGas": gas_detector.loaded,
                "security": sec_detector.loaded
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
        }))

        client.subscribe("aquasense/esp32/sensors")
        print("   📥 Subscribed to: aquasense/esp32/sensors (for water quality)")

        client.subscribe("aquasense/ml/cmd/camera")
        client.subscribe("aquasense/ml/cmd/fish-disease")
        client.subscribe("aquasense/ml/cmd/behavior")
        client.subscribe("aquasense/ml/cmd/security")

        client.subscribe("aquasense/esp32/cmd/feeder")
        client.subscribe("aquasense/esp32/actuators/status")
        print("   📥 Subscribed to: feeder commands + actuator status (for AI mode)")
    else:
        print(f"❌ MQTT connection failed with code: {rc}")

def on_mqtt_message(client, userdata, msg):
    
    global fish_disease_enabled, security_enabled, latest_sensor_data, feeder_ai_mode
    try:
        data = json.loads(msg.payload.decode())
        topic = msg.topic

        if topic == "aquasense/esp32/sensors":

            temp = data.get("temperature")

            # DS18B20 returns -127 on CRC fail / sensor disconnected — skip storing this
            if temp is not None and float(temp) < TEMP_ERROR_VALUE:
                print(f"⚠️ Temperature sensor error ({temp}°C) — ignoring this reading (check DS18B20 wiring)")
            else:
                with sensor_data_lock:
                    latest_sensor_data = {
                        "temperature": temp,
                        "ph": data.get("ph"),
                        "turbidity": data.get("turbidity"),
                        "tds": data.get("tds"),
                        "co2": data.get("co2"),
                    }
                    sensor_data_time = time.time()   # record when we got fresh data

            print(f"📊 Sensor data received — Temp: {data.get('temperature')}, pH: {data.get('ph')}, CO2: {data.get('co2')}, Turb: {data.get('turbidity')}, TDS: {data.get('tds')}")

        elif topic == "aquasense/ml/cmd/camera":

            source = data.get("source", 0)
            print(f"\n📷 Camera switch command received: {source}")
            if isinstance(source, str) and source.startswith("http"):
                fd_detector.switch_camera(source)
            else:
                fd_detector.switch_camera(int(source))

        elif topic == "aquasense/ml/cmd/fish-disease":

            action = data.get("action", "toggle")
            if action == "start":
                fish_disease_enabled = True
                print("\n🐟 Fish disease detection ENABLED")
            elif action == "stop":
                fish_disease_enabled = False
                print("\n🐟 Fish disease detection DISABLED")

        elif topic == "aquasense/ml/cmd/behavior":

            action = data.get("action")
            if action == "start":
                fd_detector.behavior_tracking_enabled = True
                fd_detector.behavior_tracking_until = float('inf')
                print("\n📈 Behavior tracking ENABLED (toggle mode)")
            elif action == "stop":
                fd_detector.behavior_tracking_enabled = False
                print("\n📈 Behavior tracking DISABLED")

        elif topic == "aquasense/ml/cmd/security":

            action = data.get("action")
            if action == "start":
                security_enabled = True
                print("\n🛡️ Security detection ENABLED")
            elif action == "stop":
                security_enabled = False
                print("\n🛡️ Security detection DISABLED")
            elif action == "camera":
                source = data.get("source", 1)
                print(f"\n🛡️ Security camera switch: {source}")
                sec_detector.switch_camera(int(source))

        elif topic == "aquasense/esp32/cmd/feeder":

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

            if data.get("feederAiMode") is not None:
                feeder_ai_mode = data.get("feederAiMode", False)

    except Exception as e:
        print(f"⚠️ Error handling MQTT message: {e}")

def water_quality_loop():
    
    global running
    print(f"💧 Water quality loop started (every {config.WQ_PREDICTION_INTERVAL}s)")

    while running:
        try:

            sensor_data = None
            data_age = None
            with sensor_data_lock:
                if latest_sensor_data["temperature"] is not None:
                    sensor_data = latest_sensor_data.copy()
                if sensor_data_time is not None:
                    data_age = time.time() - sensor_data_time

            if sensor_data and data_age is not None:
                if data_age > SENSOR_STALE_SECONDS:
                    print(f"💧 Sensor data is {data_age:.0f}s old (> {SENSOR_STALE_SECONDS}s) — skipping prediction (ESP32 offline?)")
                else:
                    result = wq_predictor.predict(sensor_data)
                    if result and mqtt_client:
                        mqtt_client.publish(
                            config.TOPIC_WATER_QUALITY,
                            json.dumps(result)
                        )
                        print(f"💧 Published water quality prediction: {result['prediction']} ({result['confidence']}%)")
            else:
                print("💧 No sensor data yet — skipping water quality prediction")

        except Exception as e:
            print(f"⚠️ Water quality loop error: {e}")
            import traceback
            traceback.print_exc()

        for _ in range(config.WQ_PREDICTION_INTERVAL):
            if not running:
                break
            time.sleep(1)

    print("💧 Water quality loop stopped")

def fish_disease_loop():
    
    global running, fish_disease_enabled
    print("🐟 Fish disease detection loop started (decoupled pipeline)")

    if not fd_detector.open_camera():
        print("❌ Cannot open camera — fish disease detection disabled")
        print("   Try switching camera with command: camera <index or URL>")
        return

    time.sleep(1)

    inference_count = 0
    inference_start = time.time()
    last_mqtt_publish = 0
    MQTT_MIN_INTERVAL = 0.33

    while running:
        if not fish_disease_enabled:
            time.sleep(1)
            continue

        try:
            t0 = time.time()

            result = fd_detector.detect()

            now = time.time()
            if result and mqtt_client and (now - last_mqtt_publish) >= MQTT_MIN_INTERVAL:
                last_mqtt_publish = now
                mqtt_client.publish(
                    config.TOPIC_FISH_DISEASE,
                    json.dumps(result)
                )

            inference_time = time.time() - t0

            inference_count += 1
            elapsed = time.time() - inference_start
            if elapsed >= 10.0:
                yolo_fps = inference_count / elapsed
                print(f"🐟 YOLO inference: {yolo_fps:.1f} FPS | Stream: {fd_detector.compositor.actual_fps:.1f} FPS" if fd_detector.compositor else f"🐟 YOLO: {yolo_fps:.1f} FPS")
                inference_count = 0
                inference_start = time.time()

            remaining = 0.05 - inference_time
            if remaining > 0:
                time.sleep(remaining)

        except Exception as e:
            print(f"⚠️ Fish disease loop error: {e}")
            time.sleep(2)

    fd_detector.release_camera()
    print("🐟 Fish disease detection loop stopped")

def security_loop():
    
    global running, security_enabled
    print("🛡️ Security detection loop started (human/animal detection)")

    inference_count = 0
    inference_start = time.time()
    last_mqtt_publish = 0
    MQTT_MIN_INTERVAL = 0.33

    while running:
        if not security_enabled:
            time.sleep(1)
            continue

        try:
            t0 = time.time()

            result = sec_detector.detect()

            now = time.time()
            if result and mqtt_client and (now - last_mqtt_publish) >= MQTT_MIN_INTERVAL:
                last_mqtt_publish = now
                mqtt_client.publish(
                    config.TOPIC_SECURITY,
                    json.dumps(result)
                )

            inference_time = time.time() - t0

            inference_count += 1
            elapsed = time.time() - inference_start
            if elapsed >= 10.0:
                yolo_fps = inference_count / elapsed
                comp_fps = sec_detector.compositor.actual_fps if sec_detector.compositor else 0
                print(f"🛡️ Security YOLO: {yolo_fps:.1f} FPS | Stream: {comp_fps:.1f} FPS")
                inference_count = 0
                inference_start = time.time()

            remaining = 0.05 - inference_time
            if remaining > 0:
                time.sleep(remaining)

        except Exception as e:
            print(f"⚠️ Security loop error: {e}")
            time.sleep(2)

    sec_detector.release_camera()
    print("🛡️ Security detection loop stopped")

def fish_feeding_loop():
    
    global running, feeder_ai_mode
    print(f"🍽️ Fish feeding prediction loop started (every {config.FF_PREDICTION_INTERVAL}s)")

    while running:
        try:

            sensor_snapshot = None
            data_age = None
            with sensor_data_lock:
                sensor_snapshot = dict(latest_sensor_data)
                if sensor_data_time is not None:
                    data_age = time.time() - sensor_data_time

            has_data = sensor_snapshot and any(v is not None for v in sensor_snapshot.values())

            if has_data and data_age is not None:
                if data_age > SENSOR_STALE_SECONDS:
                    print(f"🍽️ Sensor data is {data_age:.0f}s old — skipping feeding prediction (ESP32 offline?)")
                else:
                    result = ff_predictor.predict(sensor_snapshot)
                    if result and mqtt_client:

                        result["aiModeActive"] = feeder_ai_mode

                        mqtt_client.publish(
                            config.TOPIC_FISH_FEEDING,
                            json.dumps(result)
                        )

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

        for _ in range(config.FF_PREDICTION_INTERVAL):
            if not running:
                break
            time.sleep(1)

def fish_gas_loop():
    
    global running
    print(f"💨 Fish gas detection loop started (every {config.GAS_PREDICTION_INTERVAL}s)")

    while running:
        try:
            sensor_snapshot = None
            data_age = None
            with sensor_data_lock:
                sensor_snapshot = dict(latest_sensor_data)
                if sensor_data_time is not None:
                    data_age = time.time() - sensor_data_time

            has_data = sensor_snapshot and any(v is not None for v in sensor_snapshot.values())

            if has_data and data_age is not None:
                if data_age > SENSOR_STALE_SECONDS:
                    print(f"💨 Sensor data is {data_age:.0f}s old — skipping gas detection (ESP32 offline?)")
                else:
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

        for _ in range(config.GAS_PREDICTION_INTERVAL):
            if not running:
                break
            time.sleep(1)

def command_interface():
    
    global running, fish_disease_enabled, security_enabled

    print("\n" + "=" * 60)
    print("  AquaSense360 ML Service — Command Interface")
    print("=" * 60)
    print("  Commands:")
    print("    cameras               — Scan and list available cameras")
    print("    camera <index>        — Switch fish disease camera")
    print("    camera <url>          — Switch to IP/phone camera URL")
    print("    fish start/stop       — Enable/disable fish disease detection")
    print("    behavior              — Start 30s behavior tracking on stream")
    print("    security start/stop   — Enable/disable security detection")
    print("    security camera <idx> — Switch security camera")
    print("    predict               — Force a water quality prediction now")
    print("    status                — Show current status")
    print("    quit                  — Stop the service")
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

            elif cmd == "behavior":
                fd_detector.behavior_tracking_enabled = True
                fd_detector.behavior_tracking_until = time.time() + 30
                print("  📈 Behavior tracking started for 30s (check stream)")

            elif cmd == "security start":
                security_enabled = True
                print("  🛡️ Security detection ENABLED")

            elif cmd == "security stop":
                security_enabled = False
                print("  🛡️ Security detection DISABLED")

            elif cmd.startswith("security camera "):
                idx_str = cmd.split(" ", 2)[2].strip()
                try:
                    sec_detector.switch_camera(int(idx_str))
                except ValueError:
                    print("  ❌ Invalid camera index")

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
                print(f"  Security Model:      {'✅ Loaded' if sec_detector.loaded else '❌ Not loaded'}")
                print(f"  Fish Detection:      {'🟢 Running' if fish_disease_enabled else '🔴 Stopped'}")
                print(f"  Security Detection:  {'🟢 Running' if security_enabled else '🔴 Stopped'}")
                with sensor_data_lock:
                    has_data = latest_sensor_data["temperature"] is not None
                print(f"  Sensor Data (MQTT):  {'✅ Receiving' if has_data else '⏳ Waiting...'}")
                cam_info = fd_detector.get_camera_info()
                sec_cam = sec_detector.get_camera_info()
                print(f"  Fish Camera:         {cam_info['currentCamera']} ({'Open' if cam_info['isOpen'] else 'Closed'})")
                print(f"  Security Camera:     {sec_cam['currentCamera']} ({'Open' if sec_cam['isOpen'] else 'Closed'})")
                print(f"  Fish MJPEG Stream:   http://localhost:8765/video_feed")
                print(f"  Security Stream:     http://localhost:8766/video_feed")
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
    
    global running
    running = False
    print("\n🛑 Shutting down ML service...")

def main():
    global mqtt_client, running

    print("=" * 60)
    print("  🧠 AquaSense360 ML Service")
    print("=" * 60)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print("\n📦 Loading models...")
    wq_predictor.load()
    fd_detector.load()
    ff_predictor.load()
    gas_detector.load()
    sec_detector.load()

    if not wq_predictor.loaded and not fd_detector.loaded and not ff_predictor.loaded and not gas_detector.loaded:
        print("\n❌ No models loaded! Please place model files in ml-service/models/")
        print("   Required: water_quality_model.pkl, scaler.pkl, best.pt, fish_feeding_model.pkl, feeding_scaler.pkl")
        sys.exit(1)

    # Auto camera assignment
    print("\n📷 Auto-assigning cameras...")
    all_cameras = fd_detector.scan_cameras()
    fish_cam_index = all_cameras[0]["index"] if len(all_cameras) >= 1 else None
    sec_cam_index = all_cameras[1]["index"] if len(all_cameras) >= 2 else None

    if fish_cam_index is not None:
        print(f"   🐟 Fish disease → Camera {fish_cam_index}")
    if sec_cam_index is not None:
        print(f"   🛡️ Security → Camera {sec_cam_index}")
    else:
        print("   ⚠️ Only 1 camera found — security detection disabled (needs a 2nd USB camera)")

    # Wire up security stream function
    sec_detector.set_stream_fn(update_security_frame)

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

    if fd_detector.loaded:
        start_stream_server(port=8765)

    if sec_detector.loaded and sec_cam_index is not None:
        start_security_stream_server(port=config.SECURITY_STREAM_PORT)

    threads = []

    if wq_predictor.loaded:
        wq_thread = threading.Thread(target=water_quality_loop, daemon=True, name="WaterQuality")
        wq_thread.start()
        threads.append(wq_thread)

    if fd_detector.loaded and fish_cam_index is not None:
        fd_detector.camera_index = fish_cam_index
        fd_thread = threading.Thread(target=fish_disease_loop, daemon=True, name="FishDisease")
        fd_thread.start()
        threads.append(fd_thread)

    if sec_detector.loaded and sec_cam_index is not None:
        sec_detector.open_camera(sec_cam_index)
        sec_thread = threading.Thread(target=security_loop, daemon=True, name="Security")
        sec_thread.start()
        threads.append(sec_thread)

    if ff_predictor.loaded:
        ff_thread = threading.Thread(target=fish_feeding_loop, daemon=True, name="FishFeeding")
        ff_thread.start()
        threads.append(ff_thread)

    if gas_detector.loaded:
        gas_thread = threading.Thread(target=fish_gas_loop, daemon=True, name="FishGas")
        gas_thread.start()
        threads.append(gas_thread)

    try:
        command_interface()
    except Exception:
        pass

    running = False

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
    sec_detector.release_camera()

    for t in threads:
        t.join(timeout=3)

    print("✅ ML service stopped")

if __name__ == "__main__":
    main()

