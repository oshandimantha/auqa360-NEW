const SensorReading = require('../../models/SensorReading');
const ActuatorState = require('../../models/ActuatorState');
const rulesService = require('../../services/rules.service');
const { TOPICS } = require('../mqtt.topics');
const systemStatus = require('../../utils/systemStatus');

/**
 * Handle ESP32 MQTT messages
 */
const esp32Handler = {
    async handle(topic, payload, io) {
        try {
            // Handle different ESP32 topics
            if (topic === TOPICS.ESP32.SENSORS) {
                await this.handleSensorData(payload, io);
            } else if (topic === TOPICS.ESP32.STATUS) {
                await this.handleStatus(payload, io);
            } else if (topic === TOPICS.ESP32.ACTUATORS_STATUS) {
                await this.handleActuatorStatus(payload, io);
            } else if (topic === TOPICS.ESP32.PIR) {
                await this.handlePIR(payload, io);
            }
        } catch (error) {
            console.error('ESP32 handler error:', error);
        }
    },

    /**
     * Handle sensor data from ESP32
     */
    async handleSensorData(data, io) {
        console.log('📊 Received sensor data:', data);

        // Update ESP32 status (it's alive since we got data from it)
        systemStatus.updateESP32({ ip: data.ip, rssi: data.rssi });

        // Try to save to MongoDB (optional - don't fail if DB is down)
        try {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState === 1) {
                const reading = new SensorReading({
                    temperature: data.temperature,
                    ph: data.ph,
                    turbidity: data.turbidity,
                    tds: data.tds,
                    co2: data.co2,
                    waterLevel: data.waterLevel,
                    pir: data.pir,
                    timestamp: data.timestamp || new Date()
                });
                await reading.save();
                console.log('💾 Sensor data saved to MongoDB');
            }
        } catch (dbError) {
            console.warn('⚠️ Could not save to MongoDB:', dbError.message);
        }

        // Check thresholds and generate alerts
        const alerts = rulesService.checkThresholds(data);

        // Emit to frontend via Socket.io (always do this!)
        if (io) {
            io.emit('sensor-update', {
                ...data,
                timestamp: data.timestamp || new Date(),
                alerts: alerts
            });
            console.log('📡 Sensor data emitted to frontend');

            // Emit any critical alerts
            if (alerts.length > 0) {
                alerts.forEach(alert => {
                    io.emit('alert', alert);
                });
            }
        }
    },

    /**
     * Handle ESP32 online/offline status
     */
    async handleStatus(data, io) {
        console.log('🔌 ESP32 status:', data);

        // Update system status
        systemStatus.updateESP32({ ip: data.ip, rssi: data.rssi });

        if (io) {
            io.emit('device-status', {
                device: 'esp32',
                ...data
            });
        }
    },

    /**
     * Handle actuator state updates from ESP32
     */
    async handleActuatorStatus(data, io) {
        console.log('⚙️ Actuator status update:', data);

        // Update actuator states in database
        try {
            for (const [actuator, state] of Object.entries(data)) {
                await ActuatorState.findOneAndUpdate(
                    { name: actuator },
                    {
                        name: actuator,
                        state: state,
                        lastUpdated: new Date()
                    },
                    { upsert: true, new: true }
                );
            }
        } catch (error) {
            console.warn('Could not save actuator state:', error.message);
        }

        // Emit to frontend
        if (io) {
            io.emit('actuator-update', data);
        }
    },

    /**
     * Handle PIR motion detection
     */
    async handlePIR(data, io) {
        console.log('👁️ PIR motion:', data);

        if (io) {
            io.emit('sensor-update', {
                pir: data.motion || data.pir,
                timestamp: new Date()
            });

            // Alert if motion detected
            if (data.motion || data.pir) {
                io.emit('alert', {
                    type: 'info',
                    source: 'pir',
                    message: 'Motion detected near fish tank',
                    timestamp: new Date()
                });
            }
        }
    }
};

module.exports = esp32Handler;
