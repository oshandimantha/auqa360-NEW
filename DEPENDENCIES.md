# AquaSense360 — Node.js Dependencies

This document lists all Node.js libraries and versions used in the AquaSense360 project, split by component.

## 1. Backend (Node.js/Express)
Libraries used for the API server, database management, and IoT communication.

| Library | Version | Description |
|---------|---------|-------------|
| `express` | ^4.18.2 | Web framework for the API |
| `mongoose` | ^8.0.3 | MongoDB Object Modeling |
| `mqtt` | ^5.3.4 | MQTT client for ESP32/ML communication |
| `socket.io` | ^4.6.1 | Real-time WebSocket server |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `dotenv` | ^16.3.1 | Environment variable management |
| `nodemon` | ^3.0.2 | Dev-mode auto-reload (Dev Tool) |

## 2. Frontend (React)
Libraries used for the browser-based dashboard.

| Library | Version | Description |
|---------|---------|-------------|
| `react` | ^19.2.4 | Main UI library |
| `react-dom` | ^19.2.4 | DOM rendering for React |
| `react-router-dom`| ^7.13.0 | Client-side routing |
| `axios` | ^1.13.4 | API request client |
| `chart.js` | ^4.5.1 | Charting engine |
| `react-chartjs-2` | ^5.3.1 | React wrapper for Chart.js |
| `socket.io-client`| ^4.8.3 | Real-time WebSocket client |
| `web-vitals` | ^2.1.4 | Performance monitoring |

## 3. Desktop Shell (Electron)
Libraries used to build and package the desktop installer.

| Library | Version | Description |
|---------|---------|-------------|
| `electron` | ^33.3.1 | Desktop application framework |
| `electron-builder`| ^25.1.8 | Packaging and installer builder |
| `concurrently` | ^8.2.2 | Tool to run backend/frontend simultaneously |

---

## Installation Summary
To install all dependencies across the project, run:
```bash
# Root & Electron
npm install

# Backend
npm install --prefix backend

# Frontend
npm install --prefix frontend
```
