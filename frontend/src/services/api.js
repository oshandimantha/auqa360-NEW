import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.message);
        return Promise.reject(error);
    }
);

// Get latest sensor data
export const getSensorData = async () => {
    try {
        const response = await api.get('/sensors');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch sensor data:', error);
        throw error;
    }
};

// Get historical sensor data
export const getHistoricalData = async (period = 'daily', sensorType = null) => {
    try {
        const params = { period };
        if (sensorType) params.sensor = sensorType;

        const response = await api.get('/sensors/history', { params });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch historical data:', error);
        throw error;
    }
};

// Get actuator states
export const getActuatorStates = async () => {
    try {
        const response = await api.get('/actuators');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch actuator states:', error);
        throw error;
    }
};

// Toggle actuator state (with optional extra params for actions)
export const toggleActuator = async (actuatorName, state, extraParams = {}) => {
    try {
        const response = await api.post('/actuators/toggle', {
            actuator: actuatorName,
            state: state,
            ...extraParams
        });
        return response.data;
    } catch (error) {
        console.error('Failed to toggle actuator:', error);
        throw error;
    }
};

// Get fish detection data
export const getDetectionData = async (source = 'all') => {
    try {
        const response = await api.get('/detections', { params: { source } });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch detection data:', error);
        throw error;
    }
};

// Get alerts
export const getAlerts = async (period = 'daily') => {
    try {
        const response = await api.get('/detections/alerts', { params: { period } });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch alerts:', error);
        throw error;
    }
};

// Get reports data
export const getReportData = async (period = 'daily') => {
    try {
        const response = await api.get('/reports', { params: { period } });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch report data:', error);
        throw error;
    }
};

// Get system status (devices and services connection status)
export const getSystemStatus = async () => {
    try {
        const response = await api.get('/status');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch system status:', error);
        // Return default offline status
        return {
            devices: {
                esp32: { connected: false },
                raspberryPi: { connected: false },
                yolo: { running: false }
            },
            services: {
                mongodb: { connected: false },
                mqtt: { connected: false },
                socketio: { connected: false }
            }
        };
    }
};

// ==================== FEEDING SCHEDULES ====================

// Get all feeding schedules
export const getFeedingSchedules = async () => {
    try {
        const response = await api.get('/feeding/schedules');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch feeding schedules:', error);
        throw error;
    }
};

// Create new feeding schedule
export const createFeedingSchedule = async (schedule) => {
    try {
        const response = await api.post('/feeding/schedules', schedule);
        return response.data;
    } catch (error) {
        console.error('Failed to create schedule:', error);
        throw error;
    }
};

// Update feeding schedule
export const updateFeedingSchedule = async (id, schedule) => {
    try {
        const response = await api.put(`/feeding/schedules/${id}`, schedule);
        return response.data;
    } catch (error) {
        console.error('Failed to update schedule:', error);
        throw error;
    }
};

// Delete feeding schedule
export const deleteFeedingSchedule = async (id) => {
    try {
        const response = await api.delete(`/feeding/schedules/${id}`);
        return response.data;
    } catch (error) {
        console.error('Failed to delete schedule:', error);
        throw error;
    }
};

// Sync schedules to ESP32
export const syncFeedingSchedules = async () => {
    try {
        const response = await api.post('/feeding/sync');
        return response.data;
    } catch (error) {
        console.error('Failed to sync schedules:', error);
        throw error;
    }
};

// ==================== ML PREDICTIONS ====================

// Get latest water quality prediction
export const getLatestWaterQualityPrediction = async () => {
    try {
        const response = await api.get('/ml/water-quality/latest');
        return response.data;
    } catch (error) {
        console.warn('Failed to fetch water quality prediction:', error.message);
        return null;
    }
};

// Get latest fish disease detection
export const getLatestFishDisease = async () => {
    try {
        const response = await api.get('/ml/fish-disease/latest');
        return response.data;
    } catch (error) {
        console.warn('Failed to fetch fish disease data:', error.message);
        return null;
    }
};

// Get latest fish feeding prediction
export const getLatestFishFeeding = async () => {
    try {
        const response = await api.get('/ml/fish-feeding/latest');
        return response.data;
    } catch (error) {
        console.warn('Failed to fetch feeding data:', error.message);
        return null;
    }
};

// Get latest fish gas detection
export const getLatestFishGas = async () => {
    try {
        const response = await api.get('/ml/fish-gas/latest');
        return response.data;
    } catch (error) {
        console.warn('Failed to fetch gas detection data:', error.message);
        return null;
    }
};

export default api;
