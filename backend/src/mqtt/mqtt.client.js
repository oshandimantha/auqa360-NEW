const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt');
const { TOPICS, SUBSCRIBE_TOPICS } = require('./mqtt.topics');
const esp32Handler = require('./handlers/esp32.handler');
const piHandler = require('./handlers/pi.handler');
const laptopHandler = require('./handlers/laptop.handler');
const mlHandler = require('./handlers/ml.handler');
const systemStatus = require('../utils/systemStatus');

class MQTTClient {
    constructor() {
        this.client = null;
        this.io = null;
        this.isConnected = false;
    }

    connect(io) {
        this.io = io;

        console.log(`📡 Connecting to MQTT broker: ${mqttConfig.url}`);
        this.client = mqtt.connect(mqttConfig.url, mqttConfig.options);

        // Connection successful
        this.client.on('connect', () => {
            this.isConnected = true;
            console.log('✅ MQTT connected to broker');

            // Update system status
            systemStatus.updateMQTT(true, mqttConfig.url);

            // Subscribe to all device topics
            SUBSCRIBE_TOPICS.forEach(topic => {
                this.client.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`Failed to subscribe to ${topic}:`, err);
                    } else {
                        console.log(`   📥 Subscribed: ${topic}`);
                    }
                });
            });

            // Notify frontend of connection
            if (this.io) {
                this.io.emit('mqtt-status', { connected: true });
            }
        });

        // Handle incoming messages
        this.client.on('message', (topic, message) => {
            console.log(`📨 MQTT Message received on topic: ${topic}`);
            console.log(`   Raw message: ${message.toString().substring(0, 200)}`);

            // Update MQTT last message time
            systemStatus.mqttMessageReceived();

            try {
                const payload = JSON.parse(message.toString());
                this.handleMessage(topic, payload);
            } catch (error) {
                console.error('Failed to parse MQTT message:', error);
                // Try handling as raw string
                this.handleMessage(topic, message.toString());
            }
        });

        // Connection error
        this.client.on('error', (error) => {
            console.error('MQTT connection error:', error);
            this.isConnected = false;
            systemStatus.updateMQTT(false);
        });

        // Disconnection
        this.client.on('close', () => {
            console.warn('MQTT connection closed');
            this.isConnected = false;
            systemStatus.updateMQTT(false);
            if (this.io) {
                this.io.emit('mqtt-status', { connected: false });
            }
        });

        // Reconnection
        this.client.on('reconnect', () => {
            console.log('MQTT reconnecting...');
        });

        return this.client;
    }

    handleMessage(topic, payload) {
        // Route messages to appropriate handlers
        if (topic.startsWith('aquasense/esp32')) {
            esp32Handler.handle(topic, payload, this.io);
        } else if (topic.startsWith('aquasense/pi')) {
            piHandler.handle(topic, payload, this.io);
        } else if (topic.startsWith('aquasense/laptop')) {
            laptopHandler.handle(topic, payload, this.io);
        } else if (topic.startsWith('aquasense/ml')) {
            mlHandler.handle(topic, payload, this.io);
        } else {
            console.log(`Unhandled topic: ${topic}`);
        }
    }

    publish(topic, message) {
        if (!this.client || !this.isConnected) {
            console.error('MQTT client not connected');
            return false;
        }

        const payload = typeof message === 'string' ? message : JSON.stringify(message);

        this.client.publish(topic, payload, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to publish to ${topic}:`, err);
            } else {
                console.log(`📤 Published to ${topic}:`, payload);
            }
        });

        return true;
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            console.log('MQTT client disconnected');
        }
    }

    getStatus() {
        return {
            connected: this.isConnected,
            broker: mqttConfig.url
        };
    }
}

// Export singleton instance
const mqttClient = new MQTTClient();
module.exports = mqttClient;
