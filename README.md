# AquaSense360

AquaSense360 is an IoT-based fish tank monitoring and automation system using the **MERN Stack** (MongoDB, Express.js, React, Node.js) with real-time sensor data from an ESP32 microcontroller. 

## System Overview

The system collects data from various sensors (Temperature, pH, Turbidity, TDS, CO2, Water Level, PIR Motion) connected to an ESP32, which publishes this data via MQTT. A Node.js backend processes this data, saves it to a MongoDB database, and pushes real-time updates to a React frontend dashboard via WebSockets. It also includes an ML service for object detection (fish and security monitoring).

## Key Features

- **Real-time Monitoring:** View live sensor data on a React-based dashboard.
- **Actuator Control:** Remotely control devices like oxygen pumps, filters, and automatic feeders.
- **AI Detection:** YOLO-based object detection for fish health/behavior monitoring and security.
- **Alerts & Thresholds:** Set thresholds for water quality metrics and receive real-time notifications.
- **Data Analytics:** Historical data tracking and visualizations using Chart.js.

## Project Structure

- `frontend/` - React Application (Dashboard UI)
- `backend/` - Node.js & Express API Server, MQTT client, Socket.io
- `esp32/` - Arduino Firmware for the ESP32 Microcontroller
- `ml-service/` - Python ML service using YOLOv8 for detection
- `electron/` - Desktop app wrapper

## Documentation

For a comprehensive guide covering the architecture, setup instructions, and API references, please see the [DOCUMENTATION.md](DOCUMENTATION.md) and [SYSTEM_GUIDE_A_TO_Z.md](SYSTEM_GUIDE_A_TO_Z.md) files in this repository.
