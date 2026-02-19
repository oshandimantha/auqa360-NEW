# AquaSense360 - Complete Technical Documentation

## System Overview

AquaSense360 is an IoT-based fish tank monitoring and automation system using the **MERN Stack** (MongoDB, Express.js, React, Node.js) with real-time sensor data from an ESP32 microcontroller.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AquaSense360 System                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐          │
│  │   ESP32      │  MQTT  │   Backend    │ Socket │   Frontend   │          │
│  │  (Sensors)   │───────→│  (Node.js)   │───────→│   (React)    │          │
│  │              │←───────│              │        │              │          │
│  └──────────────┘        └──────────────┘        └──────────────┘          │
│        │                       │                       │                    │
│        │                       │                       │                    │
│   Sensors:                MongoDB                  Browser                  │
│   - Temperature           (Database)              (localhost:3000)          │
│   - pH                                                                      │
│   - Turbidity                                                               │
│   - TDS                                                                     │
│   - CO2                                                                     │
│   - Water Level                                                             │
│   - PIR Motion                                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
auqa360/
├── frontend/                 # React Application
│   ├── package.json
│   ├── .env
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js          # Entry point
│       ├── App.js            # Main component with routing
│       ├── App.css           # Global styles
│       ├── pages/            # Page components
│       ├── components/       # Reusable UI components
│       ├── services/         # API & WebSocket services
│       └── utils/            # Helper functions
│
├── backend/                  # Express.js API Server
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── server.js         # Entry point
│       ├── app.js            # Express middleware
│       ├── config/           # Database & MQTT config
│       ├── mqtt/             # MQTT handlers & publishers
│       ├── sockets/          # Socket.io handlers
│       ├── routes/           # API routes
│       ├── controllers/      # Business logic
│       ├── models/           # MongoDB schemas
│       └── services/         # Threshold & analytics logic
│
└── esp32/                    # ESP32 Arduino Firmware
    ├── AquaSense360_ESP32.ino
    └── README.md
```

---

# Part 1: Frontend (React.js)

## 1.1 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| React Router DOM | 6.x | Client-side routing |
| Axios | 1.x | HTTP API requests |
| Socket.io-client | 4.x | Real-time WebSocket |
| Chart.js | 4.x | Data visualization |
| react-chartjs-2 | 5.x | React wrapper for Chart.js |

## 1.2 Installation

```bash
cd frontend
npm install
```

## 1.3 Dependencies Explained

### react-router-dom
```javascript
// Enables navigation between pages without page reload
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Usage in App.js
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/fish" element={<Fish />} />
  <Route path="/water" element={<Water />} />
</Routes>
```

### axios
```javascript
// HTTP client for REST API calls
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// GET request
const data = await api.get('/sensors');

// POST request
await api.post('/actuators/toggle', { actuator: 'pump', state: true });
```

### socket.io-client
```javascript
// Real-time bidirectional communication
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

// Listen for events
socket.on('sensor-update', (data) => {
  console.log('New sensor data:', data);
});

// Emit events
socket.emit('control', { actuator: 'pump', state: true });
```

### chart.js + react-chartjs-2
```javascript
// Data visualization
import { Line } from 'react-chartjs-2';

<Line 
  data={{
    labels: ['10:00', '10:05', '10:10'],
    datasets: [{
      label: 'Temperature',
      data: [25.5, 26.0, 25.8],
    }]
  }}
/>
```

## 1.4 Component Structure

### Pages (6 total)
| Page | File | Description |
|------|------|-------------|
| Home | `Home.jsx` | Dashboard with navigation cards |
| Fish Health | `Fish.jsx` | Video stream + AI detection |
| Water Quality | `Water.jsx` | Temperature, pH, Turbidity, TDS |
| Air Quality | `Air.jsx` | CO2 monitoring |
| Components | `Components.jsx` | Actuator controls |
| Reports | `Reports.jsx` | Analytics and charts |

### Reusable Components (6 total)
| Component | File | Usage |
|-----------|------|-------|
| Navbar | `Navbar.jsx` | Header with navigation |
| SensorCard | `SensorCard.jsx` | Display sensor value with status |
| DetectionCard | `DetectionCard.jsx` | AI detection results |
| ActuatorControls | `ActuatorControls.jsx` | Toggle switches |
| VideoStream | `VideoStream.jsx` | Pi camera embed |
| ChartPanel | `ChartPanel.jsx` | Chart.js wrapper |

## 1.5 State Management Pattern

```javascript
// Using React useState and useEffect hooks
const [sensorData, setSensorData] = useState({});
const [loading, setLoading] = useState(true);

useEffect(() => {
  // Fetch initial data
  const fetchData = async () => {
    const data = await getSensorData();
    setSensorData(data);
    setLoading(false);
  };
  fetchData();

  // Subscribe to real-time updates
  const unsubscribe = socketService.subscribe('sensor-update', (data) => {
    setSensorData(prev => ({ ...prev, ...data }));
  });

  return () => unsubscribe(); // Cleanup
}, []);
```

## 1.6 Running Frontend

```bash
cd frontend
npm start          # Development server at http://localhost:3000
npm run build      # Production build
```

---

# Part 2: Backend (Node.js + Express)

## 2.1 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.x | Web framework |
| Mongoose | 8.x | MongoDB ODM |
| Socket.io | 4.x | WebSocket server |
| mqtt | 5.x | MQTT client |
| cors | 2.x | Cross-origin requests |
| dotenv | 16.x | Environment variables |
| nodemon | 3.x | Development auto-reload |

## 2.2 Installation

```bash
cd backend
npm install
```

## 2.3 Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         ROUTES LAYER                            │
│  sensors.routes.js  |  actuators.routes.js  |  reports.routes   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      CONTROLLERS LAYER                          │
│  Handle request logic, validate input, call services            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICES LAYER                            │
│  rules.service.js (thresholds) | analytics.service.js (stats)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        MODELS LAYER                             │
│  MongoDB Schemas: SensorReading, FishDetection, ActuatorState   │
└─────────────────────────────────────────────────────────────────┘
```

## 2.4 API Endpoints

### Sensors API
```
GET  /api/sensors           → Latest sensor readings
GET  /api/sensors/history   → Historical data (query: period=daily|weekly|monthly)
GET  /api/sensors/aggregated → Aggregated statistics
GET  /api/sensors/:type     → Specific sensor (temperature, ph, etc.)
```

### Actuators API
```
GET  /api/actuators         → All actuator states
GET  /api/actuators/:name   → Specific actuator
POST /api/actuators/toggle  → Toggle actuator (body: {actuator, state})
POST /api/actuators/batch   → Batch update
POST /api/actuators/schedule → Set schedule
```

### Detections API
```
GET  /api/detections        → Latest detection
GET  /api/detections/history → Detection history
GET  /api/detections/alerts → Abnormal events
```

### Reports API
```
GET  /api/reports           → Comprehensive report
GET  /api/reports/summary   → Summary statistics
GET  /api/reports/trends    → Trend data for charts
```

## 2.5 MongoDB Schemas

### SensorReading Schema
```javascript
const sensorReadingSchema = new mongoose.Schema({
  temperature: Number,    // °C
  ph: Number,             // 0-14
  turbidity: Number,      // 0-100
  tds: Number,            // ppm
  co2: Number,            // ppm
  waterLevel: Number,     // %
  pir: Boolean,           // motion detected
  timestamp: { type: Date, default: Date.now }
});
```

### ActuatorState Schema
```javascript
const actuatorStateSchema = new mongoose.Schema({
  name: { type: String, enum: ['oxygenPump', 'filter', 'feeder', 'rtc'] },
  state: Boolean,
  mode: { type: String, enum: ['manual', 'auto', 'scheduled'] },
  lastUpdated: Date,
  schedule: {
    enabled: Boolean,
    onTime: String,   // "08:00"
    offTime: String   // "18:00"
  }
});
```

## 2.6 MQTT Communication

### Topics Structure
```
aquasense/
├── esp32/
│   ├── sensors           # ESP32 publishes sensor data
│   ├── status            # ESP32 online/offline
│   ├── actuators/status  # Current actuator states
│   ├── pir               # Motion detection
│   └── cmd/              # Backend publishes commands
│       ├── oxygenPump
│       ├── filter
│       ├── feeder
│       └── rtc
├── pi/
│   ├── detection         # Raspberry Pi YOLO results
│   └── stream/status     # Video stream status
└── laptop/
    └── detection         # Laptop YOLO results
```

### Message Flow
```
1. ESP32 publishes: {"temperature": 25.5, "ph": 7.2, ...}
         ↓
2. Backend receives via MQTT subscription
         ↓
3. Backend saves to MongoDB
         ↓
4. Backend emits via Socket.io: io.emit('sensor-update', data)
         ↓
5. Frontend receives in real-time
```

## 2.7 Socket.io Events

### Server → Client
```javascript
// Backend emits these events
io.emit('sensor-update', sensorData);
io.emit('detection', detectionData);
io.emit('actuator-update', { pump: true });
io.emit('alert', { type: 'warning', message: 'pH too high' });
io.emit('device-status', { device: 'esp32', online: true });
```

### Client → Server
```javascript
// Frontend emits these events
socket.emit('control', { actuator: 'pump', state: true });
socket.emit('stream', { action: 'start' });
```

## 2.8 Threshold Logic (rules.service.js)

```javascript
const THRESHOLDS = {
  temperature: { min: 24, max: 30, unit: '°C' },
  ph: { min: 6.5, max: 8.5, unit: '' },
  turbidity: { min: 0, max: 50, unit: 'NTU' },
  tds: { min: 100, max: 500, unit: 'ppm' },
  co2: { min: 350, max: 1000, unit: 'ppm' },
  waterLevel: { min: 20, max: 100, unit: '%' }
};

// Status determination
function getStatus(sensor, value) {
  const { min, max } = THRESHOLDS[sensor];
  if (value < min) return 'low';      // Warning
  if (value > max) return 'high';     // Warning
  return 'optimal';                    // Good
}
```

## 2.9 Running Backend

```bash
cd backend
npm run dev        # Development with auto-reload (nodemon)
npm start          # Production mode
```

---

# Part 3: ESP32 Firmware

## 3.1 Hardware Components

| Component | Model | Purpose |
|-----------|-------|---------|
| Microcontroller | ESP32 DevKit | Main controller with WiFi |
| RTC | DS1302 | Real-time clock for scheduling |
| CO2 Sensor | MH-Z19C | Air quality monitoring |
| pH Sensor | Analog pH Module | Water acidity |
| TDS Sensor | Analog TDS Module | Water conductivity |
| Turbidity Sensor | Analog | Water clarity |
| Temperature | DS18B20 | Waterproof temp sensor |
| Motion | HC-SR501 PIR | Detect movement |
| Distance | HC-SR04 | Water level via ultrasonic |
| Feeder | SG90 Servo | Automatic fish feeding |
| Actuators | 5V Relay Module | Control pump/filter |

## 3.2 Required Arduino Libraries

```
1. WiFi                - Built-in (ESP32 Arduino Core)
2. PubSubClient        - MQTT client (by Nick O'Leary)
3. ArduinoJson         - JSON parsing (by Benoit Blanchon)
4. MHZ19               - CO2 sensor (by Jonathan Dempsey)
5. Rtc by Makuna       - DS1302 RTC support
6. DallasTemperature   - DS18B20 (by Miles Burton)
7. OneWire             - 1-Wire protocol (by Jim Studt)
8. ESP32Servo          - Servo control (by Kevin Harrington)
```

## 3.3 Pin Configuration

```cpp
// RTC (DS1302)
#define RTC_CLK_PIN  5
#define RTC_DAT_PIN  4
#define RTC_RST_PIN  2

// CO2 Sensor (UART)
#define CO2_RX_PIN 16
#define CO2_TX_PIN 17

// Analog Sensors (ADC1 pins recommended)
#define PH_PIN        34   // ADC1_CH6
#define TDS_PIN       35   // ADC1_CH7
#define TURB_PIN      36   // ADC1_CH0 (VP)

// Digital Sensors
#define PIR_PIN       26
#define ONE_WIRE_BUS  25   // DS18B20

// Ultrasonic
#define TRIG_PIN      12
#define ECHO_PIN      14

// Actuators
#define RELAY_PUMP_PIN   27
#define RELAY_FILTER_PIN 32
#define SERVO_PIN        13
```

## 3.4 WiFi + MQTT Connection

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

// Configuration
const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "YourPassword";
const char* MQTT_SERVER = "broker.hivemq.com";
const int   MQTT_PORT = 1883;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void connectMQTT() {
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.connect("esp32_fishtank");
  
  // Subscribe to command topics
  mqtt.subscribe("aquasense/esp32/cmd/oxygenPump");
  mqtt.subscribe("aquasense/esp32/cmd/filter");
}
```

## 3.5 Publishing Sensor Data (JSON)

```cpp
#include <ArduinoJson.h>

void publishSensorData() {
  StaticJsonDocument<512> doc;
  
  doc["temperature"] = 25.5;
  doc["ph"] = 7.2;
  doc["turbidity"] = 15;
  doc["tds"] = 320;
  doc["co2"] = 650;
  doc["waterLevel"] = 85;
  doc["pir"] = false;
  
  char buffer[512];
  serializeJson(doc, buffer);
  
  mqtt.publish("aquasense/esp32/sensors", buffer);
}
```

## 3.6 Receiving Commands

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);
  
  bool state = doc["state"];
  
  if (String(topic) == "aquasense/esp32/cmd/oxygenPump") {
    digitalWrite(RELAY_PUMP_PIN, state ? HIGH : LOW);
  }
  else if (String(topic) == "aquasense/esp32/cmd/filter") {
    digitalWrite(RELAY_FILTER_PIN, state ? HIGH : LOW);
  }
  else if (String(topic) == "aquasense/esp32/cmd/feeder") {
    if (state) feederRotate();
  }
}
```

## 3.7 Sensor Reading Functions

### pH Sensor (with smoothing)
```cpp
float readPH() {
  int samples[10];
  for (int i = 0; i < 10; i++) {
    samples[i] = analogRead(PH_PIN);
    delay(20);
  }
  
  // Sort and average middle values
  sort(samples, 10);
  float avg = average(samples + 2, 6);
  
  float voltage = avg * 3.3 / 4095.0;
  float ph = -5.70 * voltage + 22.59;  // Calibration formula
  
  return ph;
}
```

### Temperature (DS18B20)
```cpp
#include <DallasTemperature.h>

DallasTemperature sensors(&oneWire);

float readTemperature() {
  sensors.requestTemperatures();
  return sensors.getTempCByIndex(0);
}
```

### Ultrasonic Distance
```cpp
float readUltrasonicCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  return duration * 0.0343 / 2;  // Speed of sound / 2
}
```

## 3.8 Main Loop Structure

```cpp
void loop() {
  // 1. Maintain connections
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();
  
  // 2. Check scheduled feeding
  if (isFeedTime()) feederRotate();
  
  // 3. Read sensors and publish (every 5 seconds)
  if (millis() - lastPublish >= 5000) {
    lastPublish = millis();
    publishSensorData();
  }
}
```

---

# Part 4: Communication Protocols

## 4.1 MQTT Protocol

### What is MQTT?
- **M**essage **Q**ueuing **T**elemetry **T**ransport
- Lightweight publish/subscribe messaging protocol
- Designed for IoT devices with limited bandwidth
- Uses TCP/IP (port 1883)

### Key Concepts
```
┌──────────┐     publish      ┌──────────┐     deliver     ┌──────────┐
│  ESP32   │ ───────────────→ │  Broker  │ ─────────────→ │ Backend  │
│(Publisher│                  │(HiveMQ)  │                │(Subscriber│
└──────────┘                  └──────────┘                └──────────┘
                                   ↑
                              Broker stores
                              messages and
                              routes them
```

### QoS Levels
| Level | Description | Use Case |
|-------|-------------|----------|
| 0 | At most once | Sensor data (fast, may lose) |
| 1 | At least once | Commands (guaranteed) |
| 2 | Exactly once | Critical operations |

## 4.2 WebSocket (Socket.io)

### What is Socket.io?
- Real-time bidirectional communication
- Uses WebSocket with fallback to HTTP polling
- Event-based messaging

### Frontend Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => console.log('Connected'));
socket.on('sensor-update', (data) => updateUI(data));
```

### Backend Setup
```javascript
const { Server } = require('socket.io');
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:3000' }
});

io.on('connection', (socket) => {
  socket.emit('welcome', { message: 'Connected!' });
});
```

## 4.3 REST API

### HTTP Methods Used
| Method | Purpose | Example |
|--------|---------|---------|
| GET | Retrieve data | GET /api/sensors |
| POST | Create/Action | POST /api/actuators/toggle |
| PUT | Full update | PUT /api/actuators/1 |
| PATCH | Partial update | PATCH /api/settings |
| DELETE | Remove | DELETE /api/logs/123 |

### Request/Response Format
```
Request:
POST /api/actuators/toggle
Content-Type: application/json

{
  "actuator": "oxygenPump",
  "state": true
}

Response:
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "actuator": "oxygenPump",
  "state": true,
  "mqttPublished": true
}
```

---

# Part 5: Data Flow Diagrams

## 5.1 Sensor Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ESP32 reads sensors every 5 seconds                         │
│    (temperature, pH, turbidity, TDS, CO2, water level, PIR)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ESP32 creates JSON payload                                   │
│    { "temperature": 25.5, "ph": 7.2, "co2": 650, ... }         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. ESP32 publishes to MQTT topic: aquasense/esp32/sensors      │
│    → HiveMQ broker receives message                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Backend (subscribed) receives message via mqtt.client.js    │
│    → esp32.handler.js processes it                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Handler saves to MongoDB (SensorReading model)              │
│    → Checks thresholds via rules.service.js                    │
│    → Generates alerts if values out of range                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Handler emits via Socket.io: io.emit('sensor-update', data) │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. Frontend receives via socket.js subscription                │
│    → Updates React state → UI re-renders with new values       │
└─────────────────────────────────────────────────────────────────┘
```

## 5.2 Actuator Control Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks toggle switch on Components page                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. React calls: toggleActuator('oxygenPump', true)             │
│    → api.js sends: POST /api/actuators/toggle                  │
│      Body: { actuator: 'oxygenPump', state: true }             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Backend actuators.controller.js receives request            │
│    → Validates actuator name                                   │
│    → Calls esp32.publisher.js                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Publisher sends MQTT: aquasense/esp32/cmd/oxygenPump        │
│    Payload: { "command": "toggle", "state": true }             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. ESP32 (subscribed) receives command in mqttCallback()       │
│    → Sets GPIO: digitalWrite(RELAY_PUMP_PIN, HIGH)             │
│    → Publishes confirmation to actuators/status topic          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Backend emits: io.emit('actuator-update', { pump: true })   │
│    → Frontend updates toggle switch state                      │
└─────────────────────────────────────────────────────────────────┘
```

---

# Part 6: Setup & Installation Guide

## 6.1 Prerequisites

1. **Node.js** v18+ → https://nodejs.org
2. **MongoDB** (local or Atlas) → https://mongodb.com
3. **Arduino IDE** → https://arduino.cc
4. **ESP32 Board Support** → In Arduino IDE, add ESP32 URL

## 6.2 Quick Start

### Step 1: Clone Project
```bash
cd C:\Users\Oshan\Pictures\auqa360
```

### Step 2: Install & Run Frontend
```bash
cd frontend
npm install
npm start
# Opens http://localhost:3000
```

### Step 3: Install & Run Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### Step 4: Configure ESP32
1. Open `esp32/AquaSense360_ESP32.ino` in Arduino IDE
2. Edit WiFi credentials:
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI";
   const char* WIFI_PASS = "YOUR_PASSWORD";
   ```
3. Upload to ESP32

## 6.3 Environment Variables

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_PI_STREAM_URL=http://raspberrypi:8080/stream
```

### Backend (.env)
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/aquasense360
MQTT_URL=mqtt://broker.hivemq.com:1883
MQTT_USER=
MQTT_PASS=
FRONTEND_URL=http://localhost:3000
```

---

# Part 7: Testing & Verification

## 7.1 Test MQTT Connection

Use MQTT Explorer (free tool) or HiveMQ WebSocket client:
- URL: `mqtt://broker.hivemq.com:1883`
- Subscribe to: `aquasense/#`
- Watch for ESP32 messages

## 7.2 Test API Endpoints

```bash
# Health check
curl http://localhost:5000/api/health

# Get sensors
curl http://localhost:5000/api/sensors

# Toggle actuator
curl -X POST http://localhost:5000/api/actuators/toggle \
  -H "Content-Type: application/json" \
  -d '{"actuator":"oxygenPump","state":true}'
```

## 7.3 Test Socket.io

Open browser console on frontend:
```javascript
// Check connection
socket.connected  // should be true

// Listen for events
socket.on('sensor-update', console.log);
```

---

# Part 8: Troubleshooting

## Common Issues

| Problem | Solution |
|---------|----------|
| MongoDB not connected | Install MongoDB locally or use MongoDB Atlas |
| MQTT connection refused | Check MQTT_URL in .env, try broker.hivemq.com |
| ESP32 not publishing | Check WiFi credentials, Serial Monitor for errors |
| Frontend can't reach backend | Check CORS settings, verify ports match |
| Sensors reading 0 | Check wiring, verify ADC pin numbers |

## Debug Commands

```bash
# Check backend logs
npm run dev  # nodemon shows all console output

# Check ESP32
# Open Arduino Serial Monitor at 115200 baud

# Check MQTT traffic
# Use MQTT Explorer or mosquitto_sub
mosquitto_sub -h broker.hivemq.com -t "aquasense/#" -v
```

---

## Summary

This documentation covers:
- ✅ Complete system architecture
- ✅ All libraries and their purposes
- ✅ Frontend React components and patterns
- ✅ Backend Express API structure
- ✅ ESP32 firmware with MQTT
- ✅ Communication protocols (MQTT, WebSocket, REST)
- ✅ Data flow diagrams
- ✅ Installation and setup procedures
- ✅ Testing and troubleshooting

For questions or issues, check the Serial Monitor (ESP32), browser console (Frontend), and terminal output (Backend) for error messages.
