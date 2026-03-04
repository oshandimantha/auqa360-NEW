# AquaSense360 — Complete Software Installation List

Everything needed to install and run the entire AquaSense360 system on a fresh Windows PC.

---

## 1. System-Level Software (Install Manually)

| # | Software | Version | Download Link | Purpose |
|---|----------|---------|---------------|---------|
| 1 | **Node.js** | v18 or v20 LTS | [https://nodejs.org/](https://nodejs.org/) | Runs backend API server & React frontend |
| 2 | **Python** | 3.10.0 | [https://www.python.org/downloads/release/python-3100/](https://www.python.org/downloads/release/python-3100/) | Runs the ML/AI service (YOLO, predictions) |

| 3 | **Arduino IDE** | 2.x | [https://www.arduino.cc/en/software](https://www.arduino.cc/en/software) | Upload firmware to ESP32 board |


> **Note:** MongoDB and MQTT broker are **NOT** needed locally.
> - **Database:** MongoDB Atlas (cloud) — already configured.
> - **MQTT Broker:** HiveMQ public broker (`broker.hivemq.com:1883`) — no installation needed.

---

## 2. Arduino IDE — Board & Libraries (for ESP32)

### Board Manager
Install via *File → Preferences → Additional Board Manager URLs*:
```
https://dl.espressif.com/dl/package_esp32_index.json
```
Then *Tools → Board → Boards Manager → Search "ESP32" → Install*

### Arduino Libraries
Install via *Sketch → Include Library → Manage Libraries*:

| # | Library | Author | Version | Purpose |
|---|---------|--------|---------|---------|
| 1 | **PubSubClient** | Nick O'Leary | Latest | MQTT communication with broker |
| 2 | **ArduinoJson** | Benoit Blanchon | v6.x or v7.x | JSON data parsing/building |
| 3 | **MHZ19** | Jonathan Dempsey | Latest | MH-Z19B CO₂ sensor driver |
| 4 | **Rtc by Makuna** | Makuna | Latest | DS1302 real-time clock module |
| 5 | **DallasTemperature** | Miles Burton | Latest | DS18B20 waterproof temp sensor |
| 6 | **OneWire** | Jim Studt | Latest | OneWire protocol (required by DallasTemperature) |
| 7 | **ESP32Servo** | Kevin Harrington | Latest | Servo motor control for fish feeder |

---

## 3. Node.js Packages (auto-installed via `npm install`)

### 3.1 Root — Electron Desktop Shell

| Package | Installed Version | Purpose |
|---------|---------|---------|
| `concurrently` | 8.2.2 | Runs backend + frontend simultaneously |
| `electron` | 33.4.11 | Desktop application framework |
| `electron-builder` | 25.1.8 | Windows installer (.exe) builder |

### 3.2 Backend — Express API Server

| Package | Installed Version | Purpose |
|---------|---------|---------|
| `express` | 4.22.1 | Web API framework |
| `mongoose` | 8.22.0 | MongoDB object modeling (Atlas cloud) |
| `mqtt` | 5.14.1 | MQTT client (ESP32 & ML communication) |
| `socket.io` | 4.8.3 | Real-time WebSocket server |
| `cors` | 2.8.6 | Cross-Origin Resource Sharing |
| `dotenv` | 16.6.1 | Environment variable management |
| `nodemon` | 3.1.11 | Auto-restart server on file changes (dev) |

### 3.3 Frontend — React Dashboard

| Package | Installed Version | Purpose |
|---------|---------|---------|
| `react` | 19.2.4 | Main UI framework |
| `react-dom` | 19.2.4 | DOM rendering for React |
| `react-router-dom` | 7.13.0 | Client-side page routing |
| `react-scripts` | 5.0.1 | Create React App build tools |
| `axios` | 1.13.4 | HTTP API request client |
| `chart.js` | 4.5.1 | Charting engine for sensor graphs |
| `react-chartjs-2` | 5.3.1 | React wrapper for Chart.js |
| `socket.io-client` | 4.8.3 | Real-time WebSocket client |
| `web-vitals` | 2.1.4 | Performance monitoring |
| `@testing-library/react` | 16.3.2 | React component testing |
| `@testing-library/jest-dom` | 6.9.1 | Custom Jest matchers for DOM |
| `@testing-library/dom` | 10.4.1 | DOM testing utilities |
| `@testing-library/user-event` | 13.5.0 | User interaction simulation |

---

## 4. Python Packages (auto-installed via `pip install -r requirements.txt`)

> Requires **Python 3.10.0**

| Package | Installed Version | Purpose |
|---------|---------|---------|
| `paho-mqtt` | 1.6.1 | MQTT client (ML ↔ backend communication) |
| `scikit-learn` | 1.7.2 | Machine learning models (water quality, feeding, gas) |
| `numpy` | 1.26.4 | Numerical/array computations |
| `pandas` | 2.3.3 | Data processing and analysis |
| `ultralytics` | 8.4.14 | YOLOv8 object detection (fish tracking & disease) |
| `opencv-python` | 4.11.0.86 | Computer vision / video stream processing |
| `requests` | 2.32.5 | HTTP requests |
| `joblib` | 1.5.3 | ML model serialization/loading |
| `flask` | 3.1.3 | ML prediction REST API server |
| `flask-cors` | 6.0.2 | CORS support for Flask API |
| `torch` | 2.10.0 | PyTorch deep learning (auto-installed by ultralytics) |

> ⚠️ **Note:** Installing `ultralytics` will automatically install **PyTorch** (~2 GB download).

---

## 5. Cloud / External Services (No Installation Needed)

| Service | Details | Purpose |
|---------|---------|---------|
| **MongoDB Atlas** | Cloud-hosted cluster (already configured in `backend/.env`) | Database for sensor data, settings, reports |
| **HiveMQ Public Broker** | `broker.hivemq.com:1883` (no auth) | MQTT message broker for IoT communication |

---

## 6. Hardware Components

| # | Component | Connection | Purpose |
|---|-----------|------------|---------|
| 1 | **ESP32 Dev Module** | USB to PC | Main microcontroller |
| 2 | **DS18B20** | GPIO25 | Waterproof temperature sensor |
| 3 | **pH Sensor** | GPIO34 (analog) | Water pH measurement |
| 4 | **TDS Sensor** | GPIO35 (analog) | Total Dissolved Solids |
| 5 | **Turbidity Sensor** | GPIO36 (analog) | Water clarity |
| 6 | **MH-Z19B CO₂ Sensor** | GPIO16 (RX), GPIO17 (TX) | CO₂ / gas detection |
| 7 | **HC-SR04 Ultrasonic** | GPIO12 (TRIG), GPIO14 (ECHO) | Water level measurement |
| 8 | **PIR Motion Sensor** | GPIO26 | Motion detection near tank |
| 9 | **DS1302 RTC Module** | GPIO5 (CLK), GPIO4 (DAT), GPIO2 (RST) | Real-time clock |
| 10 | **Relay Module (Pump)** | GPIO27 | Oxygen pump ON/OFF |
| 11 | **Relay Module (Filter)** | GPIO32 | Filter ON/OFF |
| 12 | **Servo Motor (Feeder)** | GPIO13 | Automatic fish feeder |
| 13 | **USB Camera / IP Camera** | USB or network stream | Fish video feed for YOLO |

---

## 7. Step-by-Step Installation Commands

```bash
# ══════════════════════════════════════════════════════════════
# STEP 1: Root — Install Electron & Concurrently (exact versions)
# ══════════════════════════════════════════════════════════════

cd c:\Users\Oshan\Pictures\auqa360-NEW

npm install concurrently@8.2.2
npm install --save-dev electron@33.4.11
npm install --save-dev electron-builder@25.1.8

# ══════════════════════════════════════════════════════════════
# STEP 2: Backend — Install Express, MongoDB, MQTT, etc.
# ══════════════════════════════════════════════════════════════

cd backend

npm install express@4.22.1
npm install mongoose@8.22.0
npm install mqtt@5.14.1
npm install socket.io@4.8.3
npm install cors@2.8.6
npm install dotenv@16.6.1
npm install --save-dev nodemon@3.1.11

# ══════════════════════════════════════════════════════════════
# STEP 3: Frontend — Install React, Axios, Chart.js, etc.
# ══════════════════════════════════════════════════════════════

cd ..\frontend

npm install react@19.2.4
npm install react-dom@19.2.4
npm install react-router-dom@7.13.0
npm install react-scripts@5.0.1
npm install axios@1.13.4
npm install chart.js@4.5.1
npm install react-chartjs-2@5.3.1
npm install socket.io-client@4.8.3
npm install web-vitals@2.1.4
npm install @testing-library/react@16.3.2
npm install @testing-library/jest-dom@6.9.1
npm install @testing-library/dom@10.4.1
npm install @testing-library/user-event@13.5.0

# ══════════════════════════════════════════════════════════════
# STEP 4: Python ML Service — Install all ML packages
# ══════════════════════════════════════════════════════════════

cd ..\ml-service

# Create virtual environment (use Python 3.10.0)
python -m venv .venv

# Activate virtual environment (Windows)
.venv\Scripts\activate

# Install all Python packages (exact versions)
pip install paho-mqtt==1.6.1
pip install scikit-learn==1.7.2
pip install numpy==1.26.4
pip install pandas==2.3.3
pip install ultralytics==8.4.14
pip install opencv-python==4.11.0.86
pip install requests==2.32.5
pip install joblib==1.5.3
pip install flask==3.1.3
pip install flask-cors==6.0.2
pip install torch==2.10.0

# Return to root
cd ..
```

---

## 8. Running the System

| Terminal | Location | Command | Starts |
|----------|----------|---------|--------|
| **Terminal 1** | `auqa360/` (root) | `npm start` | Backend (port 5000) + Frontend (port 3000) |
| **Terminal 2** | `auqa360/ml-service/` | `.venv\Scripts\activate` then `python main.py` | AI/ML service (YOLO, predictions) |
| **Arduino IDE** | — | Upload `esp32/AquaSense360_ESP32.ino` | ESP32 sensor hardware |

---

## 9. IP Configuration (for Mobile Access)

If accessing from a phone on the same Wi-Fi:

1. Find your PC IP: `ipconfig` → look for **IPv4 Address** (e.g., `192.168.43.118`)
2. Update `backend/.env`:
   ```
   FRONTEND_URL=http://<YOUR_IP>:3000
   ```
3. Update `frontend/.env`:
   ```
   REACT_APP_API_URL=http://<YOUR_IP>:5000/api
   REACT_APP_SOCKET_URL=http://<YOUR_IP>:5000
   ```

---

## 10. Verification Commands (Check All Libraries Are Installed)

Run these commands to confirm everything is installed correctly.

### 10.1 Check System Software
```bash
# Check Node.js
node -v

# Check npm
npm -v

# Check Python
python --version

# Check pip
pip --version

# Check Git
git --version
```

### 10.2 Check Root Node.js Packages
```bash
cd c:\Users\Oshan\Pictures\auqa360-NEW
npm list --depth=0
```
**Expected output should include:**
- `concurrently@8.2.2`
- `electron@33.4.11`
- `electron-builder@25.1.8`

### 10.3 Check Backend Node.js Packages
```bash
cd c:\Users\Oshan\Pictures\auqa360-NEW\backend
npm list --depth=0
```
**Expected output should include:**
- `cors@2.8.6`
- `dotenv@16.6.1`
- `express@4.22.1`
- `mongoose@8.22.0`
- `mqtt@5.14.1`
- `socket.io@4.8.3`
- `nodemon@3.1.11`

### 10.4 Check Frontend Node.js Packages
```bash
cd c:\Users\Oshan\Pictures\auqa360-NEW\frontend
npm list --depth=0
```
**Expected output should include:**
- `react@19.2.4`
- `react-dom@19.2.4`
- `react-router-dom@7.13.0`
- `react-scripts@5.0.1`
- `axios@1.13.4`
- `chart.js@4.5.1`
- `react-chartjs-2@5.3.1`
- `socket.io-client@4.8.3`
- `web-vitals@2.1.4`

### 10.5 Check Python ML Packages
```bash
cd c:\Users\Oshan\Pictures\auqa360-NEW\ml-service
.venv\Scripts\activate
pip list
```
**Expected output should include:**
- `paho-mqtt` (1.6.1)
- `scikit-learn` (1.7.2)
- `numpy` (1.26.4)
- `pandas` (2.3.3)
- `ultralytics` (8.4.14)
- `opencv-python` (4.11.0.86)
- `requests` (2.32.5)
- `joblib` (1.5.3)
- `flask` (3.1.3)
- `flask-cors` (6.0.2)
- `torch` (2.10.0)

### 10.6 Quick One-Command Verify (Python)
```bash
cd c:\Users\Oshan\Pictures\auqa360-NEW\ml-service
.venv\Scripts\activate
python -c "import paho.mqtt; import sklearn; import numpy; import pandas; import ultralytics; import cv2; import requests; import joblib; import flask; import flask_cors; print('All Python packages OK')"
```

### 10.7 Quick One-Command Verify (Node.js — All 3 Folders)
```bash
cd c:\Users\Oshan\Pictures\auqa360-NEW && npm list --depth=0 && cd backend && npm list --depth=0 && cd ..\frontend && npm list --depth=0
```

---

## 11. Re-Install Commands (If Something Is Missing)

```bash
# ── Re-install ALL Node.js packages ──
cd c:\Users\Oshan\Pictures\auqa360-NEW
npm install
cd backend && npm install
cd ..\frontend && npm install
cd ..

# ── Re-install ALL Python packages ──
cd ml-service
.venv\Scripts\activate
pip install -r requirements.txt
cd ..

# ── Install a SINGLE missing Node.js package (example) ──
cd backend
npm install express

# ── Install a SINGLE missing Python package (example) ──
cd ml-service
.venv\Scripts\activate
pip install ultralytics
```
