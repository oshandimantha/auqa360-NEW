const LaptopDetection = require('../../models/LaptopDetection');
const { TOPICS } = require('../mqtt.topics');
const systemStatus = require('../../utils/systemStatus');

/**
 * Handle Laptop MQTT messages (for laptop-based YOLO model)
 */
const laptopHandler = {
    async handle(topic, payload, io) {
        try {
            if (topic === TOPICS.LAPTOP.DETECTION) {
                await this.handleDetection(payload, io);
            } else if (topic === TOPICS.LAPTOP.STATUS) {
                await this.handleStatus(payload, io);
            } else if (topic === TOPICS.LAPTOP.MODEL_STATUS) {
                await this.handleModelStatus(payload, io);
            }
        } catch (error) {
            console.error('Laptop handler error:', error);
        }
    },

    /**
     * Handle YOLO detection results from laptop
     */
    async handleDetection(data, io) {
        console.log('💻 Laptop detection:', data);

        // Update YOLO status (it's running since we got detections)
        systemStatus.updateYOLO({ modelLoaded: true });

        // Save detection to database
        try {
            const detection = new LaptopDetection({
                source: 'laptop',
                fishCount: data.fishCount || data.count || 0,
                fps: data.fps || 0,
                detections: data.detections || [],
                abnormalBehavior: data.abnormal || null,
                diseaseRisk: data.diseaseRisk || 'low',
                status: data.status || 'normal',
                confidence: data.confidence || 0,
                modelName: data.modelName || 'YOLOv8',
                processingTime: data.processingTime || 0,
                timestamp: data.timestamp || new Date()
            });

            await detection.save();
        } catch (dbError) {
            console.warn('Could not save detection:', dbError.message);
        }

        // Emit to frontend
        if (io) {
            io.emit('detection', {
                source: 'laptop',
                fishCount: data.fishCount || data.count || 0,
                fps: data.fps || 0,
                status: data.status || 'normal',
                abnormal: data.abnormal || null,
                risk: data.diseaseRisk || 'low',
                confidence: data.confidence || 0,
                modelName: data.modelName || 'YOLOv8',
                timestamp: data.timestamp || new Date()
            });

            // Alert for abnormal behavior
            if (data.abnormal && data.abnormal !== 'None detected') {
                io.emit('alert', {
                    type: 'warning',
                    source: 'laptop-detection',
                    message: `Abnormal behavior (Laptop AI): ${data.abnormal}`,
                    timestamp: new Date()
                });
            }
        }
    },

    /**
     * Handle laptop online/offline status
     */
    async handleStatus(data, io) {
        console.log('🔌 Laptop status:', data);

        // Update Raspberry Pi status (laptop used as Raspberry Pi replacement)
        systemStatus.updateRaspberryPi({ ip: data.ip });

        if (io) {
            io.emit('device-status', {
                device: 'laptop',
                ...data
            });
        }
    },

    /**
     * Handle YOLO model running status
     */
    async handleModelStatus(data, io) {
        console.log('🤖 Model status:', data);

        // Update YOLO status
        systemStatus.updateYOLO({ modelLoaded: data.running });

        if (io) {
            io.emit('model-status', {
                device: 'laptop',
                running: data.running,
                modelName: data.modelName,
                gpuUsage: data.gpuUsage,
                cpuUsage: data.cpuUsage
            });
        }
    }
};

module.exports = laptopHandler;
