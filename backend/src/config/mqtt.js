// MQTT Connection Configuration
const mqttConfig = {
    url: process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883',
    options: {
        clientId: `aquasense360_backend_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 5000,
        keepalive: 60,
        // Authentication (if required)
        username: process.env.MQTT_USER || undefined,
        password: process.env.MQTT_PASS || undefined,
    }
};

module.exports = mqttConfig;
