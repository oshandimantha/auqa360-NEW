/****************************************************
  ESP32 Fish Tank System - With WiFi + MQTT Integration
  Author: AquaSense360 Team (based on Oshan's original)
  Board: ESP32 (Arduino IDE)

  NEW FEATURES:
   - WiFi connectivity
   - MQTT publishing to backend
   - MQTT subscribing for remote control
   - JSON formatted sensor data

  Sensors:
   - DS1302 RTC (Makuna library)
   - MH-Z19C CO2 (UART2)
   - pH (ADC)
   - TDS (ADC)
   - Turbidity (ADC) with "AIR ignore" logic
   - DS18B20 Temperature (1-Wire)
   - PIR Motion (digital)
   - Ultrasonic HC-SR04 (digital) -> Relay control
   - Servo Feeder (RTC schedule)

  REQUIRED LIBRARIES (Install via Arduino Library Manager):
   - WiFi (built-in)
   - PubSubClient by Nick O'Leary
   - ArduinoJson by Benoit Blanchon
   - MHZ19 by Jonathan Dempsey
   - Rtc by Makuna
   - DallasTemperature by Miles Burton
   - OneWire by Jim Studt
   - ESP32Servo by Kevin Harrington
****************************************************/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#include <HardwareSerial.h>
#include <MHZ19.h>

#include <ThreeWire.h>
#include <RtcDS1302.h>

#include <OneWire.h>
#include <DallasTemperature.h>

#include <ESP32Servo.h>

/* =========================
   1) WIFI & MQTT SETTINGS (EDIT HERE!)
   ========================= */

// WiFi credentials
const char* WIFI_SSID = "oshan";        // <<<< CHANGE THIS
const char* WIFI_PASS = "oshanuoj";    // <<<< CHANGE THIS

// MQTT Broker settings
// Option 1: Local Mosquitto
// const char* MQTT_SERVER = "192.168.1.100";  // Your PC's IP running backend
// const int   MQTT_PORT = 1883;

// Option 2: HiveMQ Cloud (recommended for testing)
const char* MQTT_SERVER = "broker.hivemq.com";   // Free public broker
const int   MQTT_PORT = 1883;
const char* MQTT_USER = "";                      // Leave empty for public broker
const char* MQTT_PASS = "";

// Device ID (unique per ESP32)
const char* DEVICE_ID = "esp32_fishtank_01";

// MQTT Topics - MUST MATCH BACKEND mqtt.topics.js
#define TOPIC_SENSORS         "aquasense/esp32/sensors"
#define TOPIC_STATUS          "aquasense/esp32/status"
#define TOPIC_ACTUATORS_STATE "aquasense/esp32/actuators/status"
#define TOPIC_PIR             "aquasense/esp32/pir"

// Command topics (subscribe to these)
#define TOPIC_CMD_OXYGEN      "aquasense/esp32/cmd/oxygenPump"
#define TOPIC_CMD_FILTER      "aquasense/esp32/cmd/filter"
#define TOPIC_CMD_FEEDER      "aquasense/esp32/cmd/feeder"
#define TOPIC_CMD_RTC         "aquasense/esp32/cmd/rtc"
#define TOPIC_CMD_ALL         "aquasense/esp32/cmd/all"

/* =========================
   2) HARDWARE PIN SETTINGS
   ========================= */

// ---------- RTC (DS1302) PINS ----------
#define RTC_CLK_PIN  5
#define RTC_DAT_PIN  4
#define RTC_RST_PIN  2

// ---------- CO2 (MH-Z19C) UART PINS ----------
#define CO2_RX_PIN 16
#define CO2_TX_PIN 17

// ---------- PIR PIN ----------
#define PIR_PIN 26

// ---------- ULTRASONIC PINS ----------
#define TRIG_PIN 12
#define ECHO_PIN 14

// ---------- RELAY PINS ----------
#define RELAY_OXYGEN_PIN 33   // Oxygen pump relay (ONLY relay used - feeder uses servo)

// ---------- SERVO FEEDER PIN ----------
#define SERVO_PIN 13

// ---------- ADC PINS ----------
#define PH_PIN        34
#define TDS_PIN       35
#define TURB_PIN      36   // Changed to GPIO36 (VP) to avoid conflict

// ---------- DS18B20 PIN ----------
#define ONE_WIRE_BUS  27

/* =========================
   3) TIMING SETTINGS
   ========================= */

const uint32_t MQTT_PUBLISH_INTERVAL = 5000;   // Send data every 5 seconds
const uint32_t WIFI_RECONNECT_INTERVAL = 10000;
const uint32_t MQTT_RECONNECT_INTERVAL = 5000;
const uint32_t ULTRA_INTERVAL_MS = 500;

/* =========================
   4) SENSOR THRESHOLDS (same as original)
   ========================= */

// Water level tank calibration (adjust based on your tank)
// These are the distance readings from the ultrasonic sensor
const float TANK_FULL_CM = 5.0;     // Distance when tank is 100% full (water close to sensor)
const float TANK_EMPTY_CM = 20.0;   // Distance when tank is 0% (water far from sensor)

// Oxygen pump threshold (single 30% threshold for both auto and manual modes)
const float PUMP_THRESHOLD_PERCENT = 30.0;  // Auto ON/OFF threshold AND manual ON block

const int CO2_LOW_MAX = 1000;
const int CO2_MOD_MAX = 2000;

const float PH_LOW_MIN = 6.5;
const float PH_HIGH_MAX = 8.5;

const float TEMP_LOW_MIN = 20.0;
const float TEMP_HIGH_MAX = 30.0;

const float TDS_LOW_MAX = 300;
const float TDS_MOD_MAX = 600;

const int TURB_CLEAR_MAX = 20;
const int TURB_MOD_MAX = 50;

/* =========================
   5) pH / TDS / TURBIDITY CALIBRATION (from your code)
   ========================= */

const int PH_SAMPLES = 10;
const float PH_SMOOTH_ALPHA = 0.30;
float PH_CALIBRATION_VALUE = 21.34 + 1.25;
float PH_SLOPE = -5.70;
float PH_OFFSET = -4.0;   // Offset to correct pH reading (adjust if pH still off)
                          // Fresh water should read ~7.0. If reading too HIGH, decrease this.
                          // If reading too LOW, increase this.

int TDS_RAW_CLEAN = 112;
int TDS_RAW_CAL = 2625;
float TDS_KNOWN_PPM = 920.0;
float TDS_ALPHA = 0.10;

const int TURB_AIR_MIN = 1820;
const int TURB_AIR_MAX = 2000;
const int TURB_CLEAR_ADC = 2001;
const int TURB_DIRTY_ADC = 0;

/* =========================
   6) FEEDER SCHEDULE
   ========================= */

const int FEED_TIMES_COUNT = 2;
const int feedHours[FEED_TIMES_COUNT] = {8, 18};
const int feedMinutes[FEED_TIMES_COUNT] = {0, 0};

const int SERVO_REST_ANGLE = 0;     // Rest position (easily change at top of code)
const int SERVO_FEED_ANGLE = 180;   // Full rotation for feeding (easily change at top of code)
const int SERVO_ROTATIONS = 1;      // Number of rotation cycles
const int SERVO_HOLD_MS = 500;      // How long to hold at feed angle
const int SERVO_PAUSE_MS = 400;     // Pause between rotations

/* =========================
   7) OBJECTS & GLOBALS
   ========================= */

// WiFi & MQTT
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// RTC
ThreeWire rtcWire(RTC_DAT_PIN, RTC_CLK_PIN, RTC_RST_PIN);
RtcDS1302<ThreeWire> Rtc(rtcWire);

// CO2
HardwareSerial mhzSerial(2);
MHZ19 mhz19;

// Temperature
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensors(&oneWire);

// Servo
Servo feederServo;

// Timers
uint32_t lastPublishMs = 0;
uint32_t lastUltraMs = 0;
uint32_t lastWifiCheck = 0;
uint32_t lastMqttCheck = 0;

// Actuator states
bool oxygenPumpOn = false;
bool pumpAutoMode = true;       // true = Auto (ON >=30%, OFF <30%), false = Manual
bool feederActive = false;      // True when servo is currently rotating
bool feederEnabled = true;      // Enable/disable feeder system (servo control)
bool feederAutoMode = true;     // true = Auto (scheduled), false = Manual
bool feederAiMode = false;      // true = AI model controls feeding
bool rtcSyncEnabled = true;

// Dynamic feeding schedules (synced from MongoDB via MQTT)
#define MAX_FEED_SCHEDULES 10
struct FeedSchedule {
  bool enabled;
  uint8_t days;     // Bitmask: bit0=Sun, bit1=Mon, ... bit6=Sat
  int hour;
  int minute;
};
FeedSchedule feedSchedules[MAX_FEED_SCHEDULES];
int feedScheduleCount = 0;

// Oxygen pump safety state
bool pumpBlockedByWaterLevel = false;  // True when water too low to allow pump ON
float lastWaterPercent = 100.0;        // Last known water level percentage

// Sensor smoothing
float phSmooth = 7.0;
float tdsSmoothRaw = -1;  // -1 = not initialized, will be set on first reading

// Feeder lock
int lastFeedDay = -1;
int lastFeedHour = -1;
int lastFeedMinute = -1;

// Last motion state (for change detection)
bool lastMotionState = false;

/* =========================
   WATER LEVEL PERCENTAGE CALCULATION
   ========================= */

// Convert distance (cm) to water level percentage
// Lower distance = fuller tank (water closer to sensor)
float getWaterLevelPercent(float distanceCm) {
  if (distanceCm <= TANK_FULL_CM) return 100.0;
  if (distanceCm >= TANK_EMPTY_CM) return 0.0;
  
  // Linear interpolation between full and empty
  float range = TANK_EMPTY_CM - TANK_FULL_CM;
  float fromFull = distanceCm - TANK_FULL_CM;
  float percent = 100.0 * (1.0 - (fromFull / range));
  
  return constrain(percent, 0.0, 100.0);
}

// Check if oxygen pump can be turned on based on water level (30% threshold)
bool canTurnOnPump(float waterPercent) {
  return waterPercent >= PUMP_THRESHOLD_PERCENT;
}

// Check if oxygen pump should be auto-turned off (below 30%)
bool shouldAutoOffPump(float waterPercent) {
  return waterPercent < PUMP_THRESHOLD_PERCENT;
}

/* =========================
   8) WIFI FUNCTIONS
   ========================= */

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.print("📶 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n❌ WiFi connection failed!");
  }
}

/* =========================
   9) MQTT FUNCTIONS
   ========================= */

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Parse incoming JSON command
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.print("❌ JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  String topicStr = String(topic);
  bool state = doc["state"] | false;
  
  Serial.print("📥 Command received: ");
  Serial.print(topicStr);
  Serial.print(" -> ");
  Serial.println(state ? "ON" : "OFF");
  
  // Handle commands
  if (topicStr == TOPIC_CMD_OXYGEN) {
    // OXYGEN PUMP CONTROL - supports mode switching and manual toggle
    const char* action = doc["action"];
    
    if (action != nullptr && strcmp(action, "setMode") == 0) {
      // Mode switch: Auto <-> Manual
      pumpAutoMode = state;  // true = auto, false = manual
      Serial.print("🫧 Pump mode: ");
      Serial.println(pumpAutoMode ? "AUTO (ON >=30%, OFF <30%)" : "MANUAL");
      
      if (pumpAutoMode) {
        // Switching to auto - immediately apply auto logic
        if (canTurnOnPump(lastWaterPercent)) {
          oxygenPumpOn = true;
          digitalWrite(RELAY_OXYGEN_PIN, HIGH);
          pumpBlockedByWaterLevel = false;
          Serial.println("🫧 Auto: Pump ON (water >= 30%)");
        } else {
          oxygenPumpOn = false;
          digitalWrite(RELAY_OXYGEN_PIN, LOW);
          pumpBlockedByWaterLevel = true;
          Serial.println("🫧 Auto: Pump OFF (water < 30%)");
        }
      }
    } else {
      // Manual toggle (only works in manual mode)
      if (!pumpAutoMode) {
        if (state) {
          // Trying to turn ON - check water level (30% threshold)
          if (canTurnOnPump(lastWaterPercent)) {
            oxygenPumpOn = true;
            digitalWrite(RELAY_OXYGEN_PIN, HIGH);
            pumpBlockedByWaterLevel = false;
            Serial.println("🫧 Manual: Oxygen pump turned ON");
          } else {
            // Water level too low - reject
            Serial.print("⚠️ SAFETY: Cannot turn on pump! Water level at ");
            Serial.print(lastWaterPercent, 1);
            Serial.print("% (min ");
            Serial.print(PUMP_THRESHOLD_PERCENT, 0);
            Serial.println("% required)");
            oxygenPumpOn = false;
            pumpBlockedByWaterLevel = true;
          }
        } else {
          // Turning OFF - always allowed
          oxygenPumpOn = false;
          digitalWrite(RELAY_OXYGEN_PIN, LOW);
          Serial.println("🫧 Manual: Oxygen pump turned OFF");
        }
      } else {
        Serial.println("⚠️ Pump is in AUTO mode - manual control disabled");
      }
    }
    publishActuatorStatus();
  }
  else if (topicStr == TOPIC_CMD_FEEDER) {
    // FEEDER CONTROL - mode toggle, manual trigger, or schedule sync
    const char* command = doc["command"];
    const char* action = doc["action"];
    
    // Handle syncSchedules command from backend
    if (command != nullptr && strcmp(command, "syncSchedules") == 0) {
      JsonArray schedulesArray = doc["schedules"];
      feedScheduleCount = 0;
      
      for (JsonObject sched : schedulesArray) {
        if (feedScheduleCount >= MAX_FEED_SCHEDULES) break;
        
        JsonArray daysArray = sched["days"];
        uint8_t daysBitmask = 0;
        for (int d : daysArray) {
          if (d >= 0 && d <= 6) {
            daysBitmask |= (1 << d);  // Set bit for each day
          }
        }
        
        feedSchedules[feedScheduleCount].enabled = true;
        feedSchedules[feedScheduleCount].days = daysBitmask;
        feedSchedules[feedScheduleCount].hour = sched["hour"] | 0;
        feedSchedules[feedScheduleCount].minute = sched["minute"] | 0;
        feedScheduleCount++;
      }
      
      Serial.print("📅 Synced ");
      Serial.print(feedScheduleCount);
      Serial.println(" feeding schedules from MongoDB");
    }
    else if (action != nullptr && strcmp(action, "trigger") == 0) {
      // Feed trigger - works in manual mode OR from AI source
      const char* source = doc["source"];
      bool isAiTrigger = (source != nullptr && strcmp(source, "ai") == 0);
      
      if (isAiTrigger && feederAiMode && feederEnabled) {
        Serial.println("🧠 AI feed triggered!");
        feederRotate();
      } else if (!feederAutoMode && !feederAiMode && feederEnabled) {
        Serial.println("🍽 Manual feed triggered!");
        feederRotate();
      } else if (feederAutoMode) {
        Serial.println("⚠️ Cannot manual feed in Auto mode");
      } else if (feederAiMode && !isAiTrigger) {
        Serial.println("⚠️ Cannot manual feed in AI mode");
      } else {
        Serial.println("⚠️ Feeder is disabled");
      }
    }
    else if (action != nullptr && strcmp(action, "setMode") == 0) {
      // Set mode: ai, auto, or manual
      const char* mode = doc["mode"];
      if (mode != nullptr && strcmp(mode, "ai") == 0) {
        feederAiMode = true;
        feederAutoMode = false;
        Serial.println("🍽 Feeder mode: AI (ML model)");
      } else if (state) {
        // state=true means auto
        feederAutoMode = true;
        feederAiMode = false;
        Serial.println("🍽 Feeder mode: AUTO (scheduled)");
      } else {
        // state=false means manual
        feederAutoMode = false;
        feederAiMode = false;
        Serial.println("🍽 Feeder mode: MANUAL");
      }
    }
    else {
      // Enable/disable feeder system
      feederEnabled = state;
      Serial.print("🍽 Feeder system ");
      Serial.println(state ? "ENABLED" : "DISABLED");
    }
    publishActuatorStatus();
  }
  else if (topicStr == TOPIC_CMD_RTC) {
    // RTC CONTROL - can set time, reset, or enable/disable sync
    const char* action = doc["action"];
    
    if (action != nullptr) {
      if (strcmp(action, "setTime") == 0) {
        // Manual time setting from web interface
        int year = doc["year"] | 2024;
        int month = doc["month"] | 1;
        int day = doc["day"] | 1;
        int hour = doc["hour"] | 0;
        int minute = doc["minute"] | 0;
        int second = doc["second"] | 0;
        
        RtcDateTime newTime(year, month, day, hour, minute, second);
        Rtc.SetDateTime(newTime);
        
        Serial.println("⏰ RTC time manually set to:");
        Serial.print("   ");
        Serial.print(year); Serial.print("-");
        Serial.print(month); Serial.print("-");
        Serial.print(day); Serial.print(" ");
        Serial.print(hour); Serial.print(":");
        Serial.print(minute); Serial.print(":");
        Serial.println(second);
        
        publishActuatorStatus();  // This will include new RTC time
      }
      else if (strcmp(action, "reset") == 0) {
        // Reset RTC - Set to a default time (will sync from NTP if available)
        // For now, just set to compile time
        RtcDateTime compiled = RtcDateTime(__DATE__, __TIME__);
        Rtc.SetDateTime(compiled);
        Serial.println("⏰ RTC reset to compile time");
        publishActuatorStatus();
      }
      else if (strcmp(action, "getTime") == 0) {
        // Request current RTC time
        RtcDateTime now = Rtc.GetDateTime();
        StaticJsonDocument<128> timeDoc;
        timeDoc["year"] = now.Year();
        timeDoc["month"] = now.Month();
        timeDoc["day"] = now.Day();
        timeDoc["hour"] = now.Hour();
        timeDoc["minute"] = now.Minute();
        timeDoc["second"] = now.Second();
        
        char buffer[128];
        serializeJson(timeDoc, buffer);
        mqtt.publish("aquasense/esp32/rtc/time", buffer);
        Serial.println("⏰ RTC time sent");
      }
    } else {
      // Simple on/off for RTC scheduling sync
      rtcSyncEnabled = state;
      Serial.print("⏰ RTC scheduling ");
      Serial.println(state ? "ENABLED" : "DISABLED");
      publishActuatorStatus();
    }
  }
  else if (topicStr == TOPIC_CMD_ALL) {
    // Batch command
    const char* cmd = doc["command"];
    if (cmd != nullptr && strcmp(cmd, "getActuators") == 0) {
      publishActuatorStatus();
    } else if (cmd != nullptr && strcmp(cmd, "getSensors") == 0) {
      publishSensorData();
    }
  }
}

void connectMQTT() {
  if (mqtt.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;
  
  Serial.print("📡 Connecting to MQTT: ");
  Serial.println(MQTT_SERVER);
  
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);  // Larger buffer for JSON
  
  String clientId = String(DEVICE_ID) + "_" + String(random(0xffff), HEX);
  
  bool connected = false;
  if (strlen(MQTT_USER) > 0) {
    connected = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
  } else {
    connected = mqtt.connect(clientId.c_str());
  }
  
  if (connected) {
    Serial.println("✅ MQTT Connected!");
    
    // Subscribe to command topics
    mqtt.subscribe(TOPIC_CMD_OXYGEN);
    mqtt.subscribe(TOPIC_CMD_FILTER);
    mqtt.subscribe(TOPIC_CMD_FEEDER);
    mqtt.subscribe(TOPIC_CMD_RTC);
    mqtt.subscribe(TOPIC_CMD_ALL);
    
    Serial.println("   Subscribed to command topics");
    
    // Publish online status
    publishStatus(true);
    publishActuatorStatus();
  } else {
    Serial.print("❌ MQTT failed, rc=");
    Serial.println(mqtt.state());
  }
}

void publishStatus(bool online) {
  StaticJsonDocument<128> doc;
  doc["device"] = DEVICE_ID;
  doc["online"] = online;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqtt.publish(TOPIC_STATUS, buffer, true);  // Retained message
}

void publishActuatorStatus() {
  StaticJsonDocument<512> doc;
  doc["oxygenPump"] = oxygenPumpOn;
  doc["pumpAutoMode"] = pumpAutoMode;    // true = Auto, false = Manual
  doc["feeder"] = feederEnabled;         // Feeder system enabled/disabled
  doc["feederActive"] = feederActive;    // True when servo is currently rotating
  doc["feederAutoMode"] = feederAutoMode; // true = Auto, false = Manual
  doc["feederAiMode"] = feederAiMode;    // true = AI model controls feeding
  doc["scheduleCount"] = feedScheduleCount;  // Number of synced schedules
  doc["rtc"] = rtcSyncEnabled;
  
  // Add safety status info
  doc["waterLevelPercent"] = lastWaterPercent;
  doc["pumpBlocked"] = pumpBlockedByWaterLevel;
  doc["pumpMinLevel"] = PUMP_THRESHOLD_PERCENT;
  
  // Add current RTC time for sync display
  RtcDateTime now = Rtc.GetDateTime();
  JsonObject rtcTime = doc.createNestedObject("rtcTime");
  rtcTime["year"] = now.Year();
  rtcTime["month"] = now.Month();
  rtcTime["day"] = now.Day();
  rtcTime["hour"] = now.Hour();
  rtcTime["minute"] = now.Minute();
  rtcTime["second"] = now.Second();
  
  // Format as ISO string too
  char timestamp[25];
  snprintf(timestamp, sizeof(timestamp), "%04d-%02d-%02dT%02d:%02d:%02d",
           now.Year(), now.Month(), now.Day(),
           now.Hour(), now.Minute(), now.Second());
  doc["rtcTimestamp"] = timestamp;
  
  char buffer[512];
  serializeJson(doc, buffer);
  mqtt.publish(TOPIC_ACTUATORS_STATE, buffer);
  
  Serial.println("📤 Actuator status published");
}

void publishSensorData() {
  // Read all sensors
  RtcDateTime now = Rtc.GetDateTime();
  bool motion = (digitalRead(PIR_PIN) == HIGH);
  int co2ppm = mhz19.getCO2();
  // Filter out invalid CO2 readings (0 = sensor warmup, negative = error)
  bool co2Valid = (co2ppm > 0);
  float ph = readPH();
  
  // Flush ADC between different analog sensors to avoid cross-talk
  // ESP32 ADC multiplexer retains charge from previous channel
  analogRead(TDS_PIN); delay(10);  // Dummy read to settle ADC on TDS channel
  
  float tds = readTDS();
  
  analogRead(TURB_PIN); delay(10); // Dummy read to settle ADC on turbidity channel
  
  int turb = readTurbidity();
  float tempC = readTemperatureC();
  float waterCm = readUltrasonicCm();
  
  // Water level in cm (distance from sensor to water surface)
  
  // ========== SERIAL PRINT ALL SENSOR DATA ==========
  Serial.println("\n══════════════════════════════════════════════════════");
  Serial.println("              📊 SENSOR READINGS");
  Serial.println("══════════════════════════════════════════════════════");
  
  // Date & Time
  Serial.print("🕒 Date/Time: ");
  Serial.print(now.Day()); Serial.print("/");
  Serial.print(now.Month()); Serial.print("/");
  Serial.print(now.Year());
  Serial.print("  ");
  if (now.Hour() < 10) Serial.print("0");
  Serial.print(now.Hour()); Serial.print(":");
  if (now.Minute() < 10) Serial.print("0");
  Serial.print(now.Minute()); Serial.print(":");
  if (now.Second() < 10) Serial.print("0");
  Serial.println(now.Second());
  
  Serial.println("──────────────────────────────────────────────────────");
  
  // Temperature
  Serial.print("🌡️  Temperature:   ");
  Serial.print(tempC, 2);
  Serial.print(" °C  [");
  Serial.print(getTempStatus(tempC));
  Serial.println("]");
  
  // pH Level
  Serial.print("🧪 pH Level:       ");
  Serial.print(ph, 2);
  Serial.print("     [");
  Serial.print(getPhStatus(ph));
  Serial.println("]");
  
  // CO2 Level
  Serial.print("💨 CO2:            ");
  if (co2Valid) {
    Serial.print(co2ppm);
    Serial.print(" ppm  [");
    Serial.print(getCo2Status(co2ppm));
    Serial.println("]");
  } else {
    Serial.println("N/A (sensor warming up)");
  }
  
  // TDS Level
  Serial.print("💧 TDS:            ");
  Serial.print(tds, 1);
  Serial.print(" ppm  [");
  if (tds <= TDS_LOW_MAX) Serial.print("optimal");
  else if (tds <= TDS_MOD_MAX) Serial.print("warning");
  else Serial.print("danger");
  Serial.println("]");
  
  // Turbidity
  Serial.print("🔍 Turbidity:      ");
  if (turb >= 0) {
    Serial.print(turb);
    Serial.print(" %    [");
    if (turb <= TURB_CLEAR_MAX) Serial.print("clear");
    else if (turb <= TURB_MOD_MAX) Serial.print("moderate");
    else Serial.print("dirty");
    Serial.println("]");
  } else {
    Serial.println("N/A (sensor in air)");
  }
  
  // Water Level (in cm + percentage)
  float waterPercent = getWaterLevelPercent(waterCm);
  Serial.print("📏 Water Level:    ");
  Serial.print(waterCm, 1);
  Serial.print(" cm (");
  Serial.print(waterPercent, 1);
  Serial.println("%)");
  
  // PIR Motion
  Serial.print("👁️  PIR Motion:     ");
  Serial.println(motion ? "DETECTED ⚠️" : "No motion");
  
  Serial.println("──────────────────────────────────────────────────────");
  Serial.println("              ⚙️  COMPONENT STATUS");
  Serial.println("──────────────────────────────────────────────────────");
  
  // Oxygen Pump with mode and safety status
  Serial.print("🫧 Oxygen Pump:    ");
  if (oxygenPumpOn) {
    Serial.println("ON  🟢");
  } else if (pumpBlockedByWaterLevel) {
    Serial.println("OFF 🔴 (BLOCKED - Low water!)");
  } else {
    Serial.println("OFF 🔴");
  }
  Serial.print("   Mode: ");
  Serial.println(pumpAutoMode ? "AUTO" : "MANUAL");
  Serial.print("   Threshold:        ");
  Serial.print(PUMP_THRESHOLD_PERCENT, 0);
  Serial.println("%");
  
  // Feeder
  Serial.print("🍽️  Feeder:         ");
  Serial.println(feederActive ? "FEEDING 🟢" : "IDLE 🔴");
  
  // RTC Sync
  Serial.print("⏰ RTC Sync:       ");
  Serial.println(rtcSyncEnabled ? "ENABLED" : "DISABLED");
  
  Serial.println("──────────────────────────────────────────────────────");
  Serial.println("              📡 CONNECTION STATUS");
  Serial.println("──────────────────────────────────────────────────────");
  
  // WiFi Status
  Serial.print("📶 WiFi:           ");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected (");
    Serial.print(WiFi.localIP());
    Serial.print(") RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("Disconnected ❌");
  }
  
  // MQTT Status
  Serial.print("📡 MQTT:           ");
  Serial.println(mqtt.connected() ? "Connected ✅" : "Disconnected ❌");
  
  Serial.println("══════════════════════════════════════════════════════\n");
  
  // Build JSON for MQTT
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = round(tempC * 100) / 100.0;
  doc["ph"] = round(ph * 100) / 100.0;
  doc["turbidity"] = turb >= 0 ? turb : 0;
  doc["tds"] = round(tds * 10) / 10.0;
  // Only include CO2 if the reading is valid (skip warmup zeros)
  if (co2Valid) {
    doc["co2"] = co2ppm;
  }
  doc["waterLevel"] = waterCm > 0 ? round(waterCm * 10) / 10.0 : 0;  // Send in cm with 1 decimal
  doc["waterLevelPercent"] = waterPercent;  // Water level as percentage
  doc["pir"] = motion;
  
  // Add pump safety info
  doc["oxygenPumpOn"] = oxygenPumpOn;
  doc["pumpAutoMode"] = pumpAutoMode;
  doc["pumpBlocked"] = pumpBlockedByWaterLevel;
  
  // Add timestamp from RTC
  char timestamp[25];
  snprintf(timestamp, sizeof(timestamp), "%04d-%02d-%02dT%02d:%02d:%02d",
           now.Year(), now.Month(), now.Day(),
           now.Hour(), now.Minute(), now.Second());
  doc["timestamp"] = timestamp;
  
  // Add status indicators
  doc["tempStatus"] = getTempStatus(tempC);
  doc["phStatus"] = getPhStatus(ph);
  if (co2Valid) {
    doc["co2Status"] = getCo2Status(co2ppm);
  }
  
  char buffer[512];
  serializeJson(doc, buffer);
  
  if (mqtt.publish(TOPIC_SENSORS, buffer)) {
    Serial.println("📤 Sensor data published to MQTT ✅");
  } else {
    Serial.println("❌ Failed to publish sensor data");
  }
  
  // Publish PIR separately if motion changed
  if (motion != lastMotionState) {
    lastMotionState = motion;
    StaticJsonDocument<64> pirDoc;
    pirDoc["motion"] = motion;
    char pirBuffer[64];
    serializeJson(pirDoc, pirBuffer);
    mqtt.publish(TOPIC_PIR, pirBuffer);
    Serial.println("👁️ PIR motion change published");
  }
}

// Status helper functions
const char* getTempStatus(float c) {
  if (c < TEMP_LOW_MIN) return "low";
  if (c > TEMP_HIGH_MAX) return "high";
  return "optimal";
}

const char* getPhStatus(float ph) {
  if (ph < PH_LOW_MIN) return "low";
  if (ph > PH_HIGH_MAX) return "high";
  return "optimal";
}

const char* getCo2Status(int ppm) {
  if (ppm <= CO2_LOW_MAX) return "optimal";
  if (ppm <= CO2_MOD_MAX) return "warning";
  return "danger";
}

/* =========================
   10) SENSOR READING FUNCTIONS (from your original code)
   ========================= */

// ============ FIXED ULTRASONIC READING ============
// This version handles WiFi/MQTT interrupt interference
float readUltrasonicCm() {
  // Take multiple readings for reliability (reduces noise from WiFi/MQTT interference)
  const int NUM_READINGS = 3;
  float readings[NUM_READINGS];
  int validCount = 0;
  
  for (int i = 0; i < NUM_READINGS; i++) {
    // Clear trigger
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(5);
    
    // Disable interrupts during critical timing section
    // This prevents WiFi/MQTT callbacks from interfering with pulse timing
    noInterrupts();
    
    // Send 10µs trigger pulse
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    
    // Read echo with 50ms timeout (enough for ~8.5m range)
    long duration = pulseIn(ECHO_PIN, HIGH, 50000);
    
    // Re-enable interrupts
    interrupts();
    
    if (duration > 0) {
      // Calculate distance (speed of sound = 343 m/s = 0.0343 cm/µs)
      float distance = (duration * 0.0343f) / 2.0f;
      
      // Filter out obviously invalid readings (sensor range is typically 2-400cm)
      if (distance >= 2.0f && distance <= 400.0f) {
        readings[validCount++] = distance;
      }
    }
    
    delay(30);  // Wait between readings to avoid echo interference
  }
  
  // Return error if no valid readings
  if (validCount == 0) return -1;
  
  // Sort readings and return median for best noise rejection
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }
  
  // Return median (middle value) or average of middle two
  if (validCount == 1) return readings[0];
  if (validCount == 2) return (readings[0] + readings[1]) / 2.0f;
  return readings[validCount / 2];  // Median
}

float readPH() {
  int buf[PH_SAMPLES];

  for (int i = 0; i < PH_SAMPLES; i++) {
    buf[i] = analogRead(PH_PIN);
    delay(20);
  }

  for (int i = 0; i < PH_SAMPLES - 1; i++) {
    for (int j = i + 1; j < PH_SAMPLES; j++) {
      if (buf[i] > buf[j]) {
        int tmp = buf[i]; buf[i] = buf[j]; buf[j] = tmp;
      }
    }
  }

  unsigned long sum = 0;
  for (int i = 2; i < PH_SAMPLES - 2; i++) sum += buf[i];

  float avg = (float)sum / (float)(PH_SAMPLES - 4);
  float volt = avg * 3.3f / 4095.0f;
  float ph = PH_SLOPE * volt + PH_CALIBRATION_VALUE + PH_OFFSET;

  // Clamp to valid pH range (0-14)
  ph = constrain(ph, 0.0f, 14.0f);

  phSmooth = phSmooth * (1.0f - PH_SMOOTH_ALPHA) + ph * PH_SMOOTH_ALPHA;
  return phSmooth;
}

float readTDS() {
  // Take multiple samples for accuracy (similar to pH reading)
  const int TDS_SAMPLES = 10;
  int samples[TDS_SAMPLES];
  
  for (int i = 0; i < TDS_SAMPLES; i++) {
    samples[i] = analogRead(TDS_PIN);
    delay(20);
  }
  
  // Sort samples (bubble sort)
  for (int i = 0; i < TDS_SAMPLES - 1; i++) {
    for (int j = i + 1; j < TDS_SAMPLES; j++) {
      if (samples[i] > samples[j]) {
        int tmp = samples[i];
        samples[i] = samples[j];
        samples[j] = tmp;
      }
    }
  }
  
  // Calculate average of middle samples (remove outliers)
  unsigned long sum = 0;
  for (int i = 2; i < TDS_SAMPLES - 2; i++) {
    sum += samples[i];
  }
  float avgRaw = (float)sum / (float)(TDS_SAMPLES - 4);
  
  // Initialize smoothing on first reading
  if (tdsSmoothRaw < 0) {
    tdsSmoothRaw = avgRaw;  // First reading - set directly
  } else {
    tdsSmoothRaw = TDS_ALPHA * avgRaw + (1.0f - TDS_ALPHA) * tdsSmoothRaw;
  }
  
  // Calculate TDS using calibration values
  // K = knownPPM / (rawCal - rawClean) = 920 / (2625 - 112) = 0.366
  float K = TDS_KNOWN_PPM / (float)(TDS_RAW_CAL - TDS_RAW_CLEAN);
  float ppm = (tdsSmoothRaw - TDS_RAW_CLEAN) * K;
  
  // Clamp to valid range
  if (ppm < 0) ppm = 0;
  if (ppm > 1000) ppm = 1000;
  
  return ppm;
}

int readTurbidity() {
  int raw = analogRead(TURB_PIN);

  if (raw >= TURB_AIR_MIN && raw <= TURB_AIR_MAX) {
    return -1;
  }

  raw = constrain(raw, TURB_DIRTY_ADC, TURB_CLEAR_ADC);
  int turb = map(raw, TURB_DIRTY_ADC, TURB_CLEAR_ADC, 100, 0);
  return constrain(turb, 0, 100);
}

float readTemperatureC() {
  tempSensors.requestTemperatures();
  return tempSensors.getTempCByIndex(0);
}

void feederRotate() {
  feederActive = true;
  publishActuatorStatus();
  
  for (int i = 0; i < SERVO_ROTATIONS; i++) {
    feederServo.write(SERVO_FEED_ANGLE);
    delay(SERVO_HOLD_MS);
    feederServo.write(SERVO_REST_ANGLE);
    delay(SERVO_PAUSE_MS);
  }
  
  feederActive = false;
  publishActuatorStatus();
}

bool isFeedTime(const RtcDateTime& now) {
  // Auto-feeding requires: Auto mode, feeder enabled, and schedules synced
  if (!feederAutoMode || !feederEnabled) return false;
  if (feedScheduleCount == 0) return false;  // No schedules synced
  
  // Get day of week (0 = Sunday in RtcDateTime::DayOfWeek())
  int currentDayOfWeek = now.DayOfWeek();
  int currentHour = (int)now.Hour();
  int currentMinute = (int)now.Minute();
  
  // Check each schedule
  for (int i = 0; i < feedScheduleCount; i++) {
    if (!feedSchedules[i].enabled) continue;
    
    // Check if current day is in the schedule's days bitmask
    if (!(feedSchedules[i].days & (1 << currentDayOfWeek))) continue;
    
    // Check if time matches
    if (currentHour == feedSchedules[i].hour && currentMinute == feedSchedules[i].minute) {
      // Prevent duplicate feeding in same minute
      if ((int)now.Day() == lastFeedDay &&
          currentHour == lastFeedHour &&
          currentMinute == lastFeedMinute) {
        return false;
      }
      
      // Record this feed time to prevent duplicates
      lastFeedDay = (int)now.Day();
      lastFeedHour = currentHour;
      lastFeedMinute = currentMinute;
      
      Serial.print("📅 Scheduled feed triggered: Schedule #");
      Serial.println(i + 1);
      return true;
    }
  }
  
  return false;
}

/* =========================
   11) SETUP
   ========================= */

void setup() {
  Serial.begin(115200);
  delay(600);

  Serial.println("\n===== ESP32 AQUASENSE360 SYSTEM START =====");
  Serial.println("Version: 2.0 (with WiFi + MQTT)");

  // ADC config
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // IO pins
  pinMode(PIR_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RELAY_OXYGEN_PIN, OUTPUT);

  digitalWrite(RELAY_OXYGEN_PIN, LOW);  // Start with pump off

  // RTC
  Rtc.Begin();
  if (!Rtc.GetIsRunning()) {
    Rtc.SetIsRunning(true);
  }
  Serial.println("✅ RTC OK");

  // CO2
  mhzSerial.begin(9600, SERIAL_8N1, CO2_RX_PIN, CO2_TX_PIN);
  mhz19.begin(mhzSerial);
  mhz19.autoCalibration(false);
  Serial.println("✅ MH-Z19C OK");

  // Temp sensor
  tempSensors.begin();
  Serial.println("✅ DS18B20 OK");

  // Servo
  feederServo.setPeriodHertz(50);
  feederServo.attach(SERVO_PIN, 500, 2400);
  feederServo.write(SERVO_REST_ANGLE);
  Serial.println("✅ Servo feeder OK");

  // WiFi
  connectWiFi();

  // MQTT
  connectMQTT();

  Serial.println("\n===== SYSTEM READY =====\n");
}

/* =========================
   12) LOOP
   ========================= */

void loop() {
  uint32_t now = millis();
  
  // Maintain WiFi connection
  if (now - lastWifiCheck >= WIFI_RECONNECT_INTERVAL) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ WiFi disconnected, reconnecting...");
      connectWiFi();
    }
  }
  
  // Maintain MQTT connection
  if (now - lastMqttCheck >= MQTT_RECONNECT_INTERVAL) {
    lastMqttCheck = now;
    if (!mqtt.connected()) {
      connectMQTT();
    }
  }
  
  // Process MQTT messages
  mqtt.loop();
  
  // RTC time
  RtcDateTime rtcNow = Rtc.GetDateTime();
  
  // Feeder schedule
  if (isFeedTime(rtcNow)) {
    Serial.println("🍽 FEED TIME! Servo rotating...");
    feederRotate();
    Serial.println("🍽 Feeding done.\n");
  }
  
  // ============ WATER LEVEL + PUMP AUTO/MANUAL LOGIC ============
  // Check water level frequently for pump safety & auto control
  if (now - lastUltraMs >= ULTRA_INTERVAL_MS) {
    lastUltraMs = now;
    float dist = readUltrasonicCm();
    
    if (dist > 0) {
      float waterPercent = getWaterLevelPercent(dist);
      lastWaterPercent = waterPercent;
      
      if (pumpAutoMode) {
        // ===== AUTO MODE: ON when >=30%, OFF when <30% =====
        if (waterPercent >= PUMP_THRESHOLD_PERCENT && !oxygenPumpOn) {
          // Water above 30% → turn pump ON
          oxygenPumpOn = true;
          digitalWrite(RELAY_OXYGEN_PIN, HIGH);
          pumpBlockedByWaterLevel = false;
          Serial.println("🫧 AUTO: Pump ON (water >= 30%)");
          if (mqtt.connected()) publishActuatorStatus();
        }
        else if (waterPercent < PUMP_THRESHOLD_PERCENT && oxygenPumpOn) {
          // Water below 30% → turn pump OFF
          oxygenPumpOn = false;
          digitalWrite(RELAY_OXYGEN_PIN, LOW);
          pumpBlockedByWaterLevel = true;
          Serial.println("⚠️ AUTO: Pump OFF (water < 30%)");
          if (mqtt.connected()) publishActuatorStatus();
        }
        // Update blocked status
        pumpBlockedByWaterLevel = (waterPercent < PUMP_THRESHOLD_PERCENT);
      } else {
        // ===== MANUAL MODE: Safety check only =====
        // If pump is ON and water drops below 30% → force OFF
        if (shouldAutoOffPump(waterPercent) && oxygenPumpOn) {
          oxygenPumpOn = false;
          digitalWrite(RELAY_OXYGEN_PIN, LOW);
          pumpBlockedByWaterLevel = true;
          Serial.println("⚠️ MANUAL SAFETY: Pump forced OFF (water < 30%)");
          if (mqtt.connected()) publishActuatorStatus();
        }
        
        // Update blocked status (below 30% = blocked in manual mode)
        if (waterPercent >= PUMP_THRESHOLD_PERCENT && pumpBlockedByWaterLevel) {
          pumpBlockedByWaterLevel = false;
          Serial.println("✅ Water level restored! Pump can now be turned ON.");
          if (mqtt.connected()) publishActuatorStatus();
        } else if (waterPercent < PUMP_THRESHOLD_PERCENT) {
          pumpBlockedByWaterLevel = true;
        }
      }
    }
  }
  
  // Publish sensor data to MQTT
  if (now - lastPublishMs >= MQTT_PUBLISH_INTERVAL) {
    lastPublishMs = now;
    
    if (mqtt.connected()) {
      publishSensorData();
    } else {
      Serial.println("⚠️ MQTT not connected - data not published");
    }
  }
}
