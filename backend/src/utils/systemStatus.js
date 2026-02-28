// System Status Tracker
// Tracks connection status of all devices and services

class SystemStatus {
    constructor() {
        // Device statuses with last seen timestamps
        this.devices = {
            esp32: {
                connected: false,
                lastSeen: null,
                ip: null,
                rssi: null
            },
            raspberryPi: {
                connected: false,
                lastSeen: null,
                ip: null
            },
            yolo: {
                running: false,
                lastDetection: null,
                modelLoaded: false
            }
        };

        // Service statuses
        this.services = {
            mongodb: {
                connected: false,
                lastCheck: null
            },
            mqtt: {
                connected: false,
                broker: null,
                lastMessage: null
            },
            socketio: {
                connected: false,
                clients: 0
            }
        };

        // Timeout thresholds (in milliseconds)
        this.timeouts = {
            esp32: 15000,        // 15 seconds (ESP32 publishes every 5s)
            raspberryPi: 30000,  // 30 seconds
            yolo: 30000          // 30 seconds
        };
    }

    // Update ESP32 status
    updateESP32(data) {
        this.devices.esp32.connected = true;
        this.devices.esp32.lastSeen = new Date();
        if (data.ip) this.devices.esp32.ip = data.ip;
        if (data.rssi) this.devices.esp32.rssi = data.rssi;
    }

    // Update Raspberry Pi status
    updateRaspberryPi(data) {
        this.devices.raspberryPi.connected = true;
        this.devices.raspberryPi.lastSeen = new Date();
        if (data.ip) this.devices.raspberryPi.ip = data.ip;
    }

    // Update YOLO status
    updateYOLO(data) {
        this.devices.yolo.running = true;
        this.devices.yolo.lastDetection = new Date();
        if (data.modelLoaded !== undefined) {
            this.devices.yolo.modelLoaded = data.modelLoaded;
        }
    }

    // Update MongoDB status
    updateMongoDB(connected) {
        this.services.mongodb.connected = connected;
        this.services.mongodb.lastCheck = new Date();
    }

    // Update MQTT status
    updateMQTT(connected, broker = null) {
        this.services.mqtt.connected = connected;
        this.services.mqtt.broker = broker;
        if (connected) {
            this.services.mqtt.lastMessage = new Date();
        }
    }

    // Update MQTT last message time (called on each message)
    mqttMessageReceived() {
        this.services.mqtt.lastMessage = new Date();
    }

    // Update Socket.io status
    updateSocketIO(connected, clients = 0) {
        this.services.socketio.connected = connected;
        this.services.socketio.clients = clients;
    }

    // Attach Socket.io instance and start active offline detection
    setIO(io) {
        this.io = io;
        if (!this.checkInterval) {
            // Check every 5 seconds for any devices that timed out
            this.checkInterval = setInterval(() => this.checkDeviceTimeouts(), 5000);
        }
    }

    // Actively broadcast offline events if a device times out
    checkDeviceTimeouts() {
        if (!this.io) return;

        ['esp32', 'raspberryPi', 'yolo'].forEach(device => {
            const isNowAlive = this.isDeviceAlive(device);
            const wasAlive = device === 'yolo' ? this.devices.yolo.running : this.devices[device].connected;

            if (wasAlive && !isNowAlive) {
                console.log(`⚠️ ${device} timed out and is now offline.`);
                // Update internal state
                if (device === 'yolo') {
                    this.devices.yolo.running = false;
                    this.io.emit('model-status', { running: false });
                } else {
                    this.devices[device].connected = false;
                    this.io.emit('device-status', { device, online: false });
                }
            }
        });
    }

    // Check if device is still "alive" based on timeout
    isDeviceAlive(deviceName) {
        const device = this.devices[deviceName];
        if (!device) return false;

        // YOLO uses lastDetection instead of lastSeen
        const lastActive = device.lastSeen || device.lastDetection;
        if (!lastActive) return false;

        const timeout = this.timeouts[deviceName] || 60000;
        const timeSinceLastSeen = Date.now() - new Date(lastActive).getTime();
        return timeSinceLastSeen < timeout;
    }

    // Get full status report
    getStatus() {
        const now = Date.now();

        return {
            devices: {
                esp32: {
                    connected: this.isDeviceAlive('esp32'),
                    lastSeen: this.devices.esp32.lastSeen,
                    ip: this.devices.esp32.ip,
                    rssi: this.devices.esp32.rssi,
                    timeSinceLastSeen: this.devices.esp32.lastSeen
                        ? Math.floor((now - new Date(this.devices.esp32.lastSeen).getTime()) / 1000)
                        : null
                },
                raspberryPi: {
                    connected: this.isDeviceAlive('raspberryPi'),
                    lastSeen: this.devices.raspberryPi.lastSeen,
                    ip: this.devices.raspberryPi.ip,
                    timeSinceLastSeen: this.devices.raspberryPi.lastSeen
                        ? Math.floor((now - new Date(this.devices.raspberryPi.lastSeen).getTime()) / 1000)
                        : null
                },
                yolo: {
                    running: this.isDeviceAlive('yolo'),
                    lastDetection: this.devices.yolo.lastDetection,
                    modelLoaded: this.devices.yolo.modelLoaded,
                    timeSinceLastDetection: this.devices.yolo.lastDetection
                        ? Math.floor((now - new Date(this.devices.yolo.lastDetection).getTime()) / 1000)
                        : null
                }
            },
            services: {
                mongodb: this.services.mongodb,
                mqtt: {
                    ...this.services.mqtt,
                    timeSinceLastMessage: this.services.mqtt.lastMessage
                        ? Math.floor((now - new Date(this.services.mqtt.lastMessage).getTime()) / 1000)
                        : null
                },
                socketio: this.services.socketio
            },
            timestamp: new Date().toISOString()
        };
    }
}

// Export singleton instance
const systemStatus = new SystemStatus();
module.exports = systemStatus;
