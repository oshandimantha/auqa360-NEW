import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    // Connect to the socket server
    connect() {
        if (this.socket?.connected) {
            console.log('Socket already connected');
            return;
        }

        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.notifyListeners('connection', { connected: true });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.notifyListeners('connection', { connected: false, reason });
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.notifyListeners('connection', { connected: false, error: error.message });
        });

        // Listen for sensor updates
        this.socket.on('sensor-update', (data) => {
            this.notifyListeners('sensor-update', data);
        });

        // Listen for detection updates from YOLO
        this.socket.on('detection', (data) => {
            this.notifyListeners('detection', data);
        });

        // Listen for actuator state changes
        this.socket.on('actuator-update', (data) => {
            this.notifyListeners('actuator-update', data);
        });

        // Listen for alerts
        this.socket.on('alert', (data) => {
            this.notifyListeners('alert', data);
        });

        // Listen for ML water quality predictions
        this.socket.on('water-quality-prediction', (data) => {
            this.notifyListeners('water-quality-prediction', data);
        });

        // Listen for ML fish disease detections
        this.socket.on('fish-disease-detection', (data) => {
            this.notifyListeners('fish-disease-detection', data);
        });

        // Listen for ML fish feeding predictions
        this.socket.on('fish-feeding-prediction', (data) => {
            this.notifyListeners('fish-feeding-prediction', data);
        });

        // Listen for ML gas detection
        this.socket.on('fish-gas-detection', (data) => {
            this.notifyListeners('fish-gas-detection', data);
        });

        // Listen for device status changes
        this.socket.on('device-status', (data) => {
            this.notifyListeners('device-status', data);
        });

        // Listen for MQTT status
        this.socket.on('mqtt-status', (data) => {
            this.notifyListeners('mqtt-status', data);
        });

        // Listen for model status
        this.socket.on('model-status', (data) => {
            this.notifyListeners('model-status', data);
        });
    }

    // Disconnect from the socket server
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Check if connected
    isConnected() {
        return this.socket?.connected || false;
    }

    // Subscribe to an event
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    // Notify all listeners of an event
    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in socket listener:', error);
                }
            });
        }
    }

    // Emit a control command
    sendCommand(command, data) {
        if (this.socket?.connected) {
            this.socket.emit(command, data);
            return true;
        }
        console.warn('Socket not connected, cannot send command');
        return false;
    }

    // Toggle actuator via socket (with optional extra params for actions)
    toggleActuator(actuatorName, state, extraParams = {}) {
        return this.sendCommand('control', {
            type: 'actuator',
            name: actuatorName,
            state: state,
            ...extraParams
        });
    }

    // Start video stream
    startStream() {
        return this.sendCommand('stream', { action: 'start' });
    }

    // Stop video stream
    stopStream() {
        return this.sendCommand('stream', { action: 'stop' });
    }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;
