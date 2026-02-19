// MQTT Topic Definitions
// Centralized topic names for easy management

const TOPICS = {
    // ESP32 Sensor Topics (ESP32 publishes)
    ESP32: {
        SENSORS: 'aquasense/esp32/sensors',          // All sensor readings
        TEMPERATURE: 'aquasense/esp32/temperature',
        PH: 'aquasense/esp32/ph',
        TURBIDITY: 'aquasense/esp32/turbidity',
        TDS: 'aquasense/esp32/tds',
        CO2: 'aquasense/esp32/co2',
        WATER_LEVEL: 'aquasense/esp32/waterLevel',
        PIR: 'aquasense/esp32/pir',
        STATUS: 'aquasense/esp32/status',            // ESP32 online/offline
        ACTUATORS_STATUS: 'aquasense/esp32/actuators/status', // Current actuator states
    },

    // ESP32 Command Topics (Backend publishes)
    ESP32_CMD: {
        OXYGEN_PUMP: 'aquasense/esp32/cmd/oxygenPump',
        FILTER: 'aquasense/esp32/cmd/filter',
        FEEDER: 'aquasense/esp32/cmd/feeder',
        RTC: 'aquasense/esp32/cmd/rtc',
        ALL: 'aquasense/esp32/cmd/all',              // Batch commands
    },

    // Raspberry Pi Topics (Pi publishes)
    PI: {
        DETECTION: 'aquasense/pi/detection',         // YOLO fish detection results
        STREAM_STATUS: 'aquasense/pi/stream/status', // Stream on/off
        STATUS: 'aquasense/pi/status',               // Pi online/offline
    },

    // Pi Command Topics (Backend publishes)
    PI_CMD: {
        STREAM: 'aquasense/pi/cmd/stream',           // Start/stop stream
        CAPTURE: 'aquasense/pi/cmd/capture',         // Take snapshot
    },

    // Laptop Model Topics (Laptop publishes)
    LAPTOP: {
        DETECTION: 'aquasense/laptop/detection',     // Laptop YOLO results
        MODEL_STATUS: 'aquasense/laptop/model/status', // Model running status
        STATUS: 'aquasense/laptop/status',           // Laptop online/offline
    },

    // System Topics
    SYSTEM: {
        ALERTS: 'aquasense/system/alerts',           // System alerts
        LOGS: 'aquasense/system/logs',               // System logs
    }
};

// Topics to subscribe to (from devices)
const SUBSCRIBE_TOPICS = [
    TOPICS.ESP32.SENSORS,
    TOPICS.ESP32.STATUS,
    TOPICS.ESP32.ACTUATORS_STATUS,
    TOPICS.ESP32.PIR,
    TOPICS.PI.DETECTION,
    TOPICS.PI.STATUS,
    TOPICS.PI.STREAM_STATUS,
    TOPICS.LAPTOP.DETECTION,
    TOPICS.LAPTOP.STATUS,
];

module.exports = {
    TOPICS,
    SUBSCRIBE_TOPICS
};
