# ESP32 AquaSense360 Firmware

## Required Libraries (Install in Arduino IDE)

Open Arduino IDE → Sketch → Include Library → Manage Libraries:

1. **PubSubClient** by Nick O'Leary (for MQTT)
2. **ArduinoJson** by Benoit Blanchon (for JSON)
3. **MHZ19** by Jonathan Dempsey (for CO2 sensor)
4. **Rtc by Makuna** (for DS1302 RTC)
5. **DallasTemperature** by Miles Burton (for DS18B20)
6. **OneWire** by Jim Studt
7. **ESP32Servo** by Kevin Harrington

## Configuration

Edit these values in `AquaSense360_ESP32.ino`:

```cpp
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // <<<< CHANGE THIS
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";    // <<<< CHANGE THIS

// MQTT Broker (use HiveMQ for testing)
const char* MQTT_SERVER = "broker.hivemq.com";   // Free public broker
const int   MQTT_PORT = 1883;
```

## For Local MQTT (when backend runs on your PC)

Change MQTT_SERVER to your computer's IP:

```cpp
const char* MQTT_SERVER = "192.168.1.100";  // Your PC's local IP
```

Find your IP: Open CMD → type `ipconfig` → look for IPv4 Address

## Pin Connections

| Component | ESP32 GPIO |
|-----------|------------|
| RTC CLK | GPIO5 |
| RTC DAT | GPIO4 |
| RTC RST | GPIO2 |
| CO2 RX | GPIO16 |
| CO2 TX | GPIO17 |
| PIR | GPIO26 |
| Ultrasonic TRIG | GPIO12 |
| Ultrasonic ECHO | GPIO14 |
| Pump Relay | GPIO27 |
| Filter Relay | GPIO32 |
| Servo Feeder | GPIO13 |
| pH Sensor | GPIO34 |
| TDS Sensor | GPIO35 |
| Turbidity | GPIO36 |
| DS18B20 | GPIO25 |

## MQTT Topics

**Publishes to:**
- `aquasense/esp32/sensors` - All sensor data (JSON)
- `aquasense/esp32/status` - Online/offline status
- `aquasense/esp32/actuators/status` - Relay states
- `aquasense/esp32/pir` - Motion detection events

**Subscribes to:**
- `aquasense/esp32/cmd/oxygenPump` - Control pump
- `aquasense/esp32/cmd/filter` - Control filter
- `aquasense/esp32/cmd/feeder` - Trigger feeder
- `aquasense/esp32/cmd/rtc` - Enable/disable RTC sync

## Upload to ESP32

1. Connect ESP32 via USB
2. Open `AquaSense360_ESP32.ino` in Arduino IDE
3. Select Board: "ESP32 Dev Module"
4. Select correct COM port
5. Click Upload

## Testing

After upload, open Serial Monitor (115200 baud) to see:
- WiFi connection status
- MQTT connection status
- Sensor readings every 5 seconds
