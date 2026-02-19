const FishDetection = require('../../models/FishDetection');
const { TOPICS } = require('../mqtt.topics');

/**
 * Handle Raspberry Pi MQTT messages
 */
const piHandler = {
    async handle(topic, payload, io) {
        try {
            if (topic === TOPICS.PI.DETECTION) {
                await this.handleDetection(payload, io);
            } else if (topic === TOPICS.PI.STATUS) {
                await this.handleStatus(payload, io);
            } else if (topic === TOPICS.PI.STREAM_STATUS) {
                await this.handleStreamStatus(payload, io);
            }
        } catch (error) {
            console.error('Pi handler error:', error);
        }
    },

    /**
     * Handle YOLO fish detection results from Pi
     */
    async handleDetection(data, io) {
        console.log('🐟 Pi detection:', data);

        // Save detection to database
        const detection = new FishDetection({
            source: 'raspberry_pi',
            fishCount: data.fishCount || data.count || 0,
            fps: data.fps || 0,
            detections: data.detections || [],
            abnormalBehavior: data.abnormal || null,
            diseaseRisk: data.diseaseRisk || 'low',
            status: data.status || 'normal',
            confidence: data.confidence || 0,
            timestamp: data.timestamp || new Date()
        });

        await detection.save();

        // Emit to frontend
        if (io) {
            io.emit('detection', {
                source: 'pi',
                fishCount: detection.fishCount,
                fps: detection.fps,
                status: detection.status,
                abnormal: detection.abnormalBehavior,
                risk: detection.diseaseRisk,
                confidence: detection.confidence,
                timestamp: detection.timestamp
            });

            // Alert for abnormal behavior
            if (detection.abnormalBehavior && detection.abnormalBehavior !== 'None detected') {
                io.emit('alert', {
                    type: 'warning',
                    source: 'pi-detection',
                    message: `Abnormal fish behavior detected: ${detection.abnormalBehavior}`,
                    timestamp: new Date()
                });
            }

            // Alert for high disease risk
            if (detection.diseaseRisk === 'high') {
                io.emit('alert', {
                    type: 'danger',
                    source: 'pi-detection',
                    message: 'High disease risk detected in fish population',
                    timestamp: new Date()
                });
            }
        }
    },

    /**
     * Handle Pi online/offline status
     */
    async handleStatus(data, io) {
        console.log('🔌 Pi status:', data);

        if (io) {
            io.emit('device-status', {
                device: 'raspberry_pi',
                ...data
            });
        }
    },

    /**
     * Handle video stream status
     */
    async handleStreamStatus(data, io) {
        console.log('📹 Stream status:', data);

        if (io) {
            io.emit('stream-status', {
                active: data.active || data.streaming,
                url: data.url || process.env.PI_STREAM_URL
            });
        }
    }
};

module.exports = piHandler;
