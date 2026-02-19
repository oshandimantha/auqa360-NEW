const mqttClient = require('../mqtt.client');
const { TOPICS } = require('../mqtt.topics');

/**
 * Publisher for ESP32 commands
 */
const esp32Publisher = {
    /**
     * Toggle oxygen pump
     */
    toggleOxygenPump(state) {
        return mqttClient.publish(TOPICS.ESP32_CMD.OXYGEN_PUMP, {
            command: 'toggle',
            state: state,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Toggle filter
     */
    toggleFilter(state) {
        return mqttClient.publish(TOPICS.ESP32_CMD.FILTER, {
            command: 'toggle',
            state: state,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Toggle feeder
     */
    toggleFeeder(state) {
        return mqttClient.publish(TOPICS.ESP32_CMD.FEEDER, {
            command: 'toggle',
            state: state,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Sync feeding schedules to ESP32
     */
    syncFeedingSchedules(schedules) {
        return mqttClient.publish(TOPICS.ESP32_CMD.FEEDER, {
            command: 'syncSchedules',
            schedules: schedules,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Toggle RTC control
     */
    toggleRTC(state) {
        return mqttClient.publish(TOPICS.ESP32_CMD.RTC, {
            command: 'toggle',
            state: state,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Send batch command to all actuators
     */
    setAllActuators(states) {
        return mqttClient.publish(TOPICS.ESP32_CMD.ALL, {
            command: 'setAll',
            states: states,
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Toggle any actuator by name (with optional command data)
     */
    toggleActuator(name, state, commandData = {}) {
        const topicMap = {
            oxygenPump: TOPICS.ESP32_CMD.OXYGEN_PUMP,
            filter: TOPICS.ESP32_CMD.FILTER,
            feeder: TOPICS.ESP32_CMD.FEEDER,
            rtc: TOPICS.ESP32_CMD.RTC
        };

        const topic = topicMap[name];
        if (!topic) {
            console.error(`Unknown actuator: ${name}`);
            return false;
        }

        // Build message with optional action and extra params
        const message = {
            command: 'toggle',
            state: state,
            timestamp: new Date().toISOString(),
            ...commandData  // Include action, year, month, day, hour, minute, second if provided
        };

        return mqttClient.publish(topic, message);
    },

    /**
     * Request current sensor readings
     */
    requestSensorData() {
        return mqttClient.publish(TOPICS.ESP32_CMD.ALL, {
            command: 'getSensors',
            timestamp: new Date().toISOString()
        });
    },

    /**
     * Request current actuator states
     */
    requestActuatorStates() {
        return mqttClient.publish(TOPICS.ESP32_CMD.ALL, {
            command: 'getActuators',
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = esp32Publisher;
