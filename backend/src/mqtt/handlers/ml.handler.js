const WaterQualityPrediction = require('../../models/WaterQualityPrediction');
const FishDetection = require('../../models/FishDetection');
const { TOPICS } = require('../mqtt.topics');
const systemStatus = require('../../utils/systemStatus');
const { updateLatestWaterQuality, updateLatestFishDisease, updateLatestFishFeeding, updateLatestFishGas } = require('../../routes/ml.routes');

// ─── Throttle timer for fish disease DB saves ───
let lastDbSaveTime = 0;
const DB_SAVE_INTERVAL = 5000;    // Save to DB at most once every 5s

/**
 * Handle ML Service MQTT messages (from Python ML service)
 */
const mlHandler = {
    async handle(topic, payload, io) {
        try {
            if (topic === TOPICS.ML.WATER_QUALITY) {
                await this.handleWaterQuality(payload, io);
            } else if (topic === TOPICS.ML.FISH_DISEASE) {
                await this.handleFishDisease(payload, io);
            } else if (topic === TOPICS.ML.FISH_FEEDING) {
                await this.handleFishFeeding(payload, io);
            } else if (topic === TOPICS.ML.FISH_GAS) {
                await this.handleFishGas(payload, io);
            } else if (topic === TOPICS.ML.SECURITY) {
                await this.handleSecurity(payload, io);
            } else if (topic === TOPICS.ML.STATUS) {
                await this.handleStatus(payload, io);
            }
        } catch (error) {
            console.error('ML handler error:', error);
        }
    },

    /**
     * Handle water quality prediction from ML service
     */
    async handleWaterQuality(data, io) {
        console.log('🔬 Water quality prediction:', data.prediction, `(${data.confidence}%)`);

        // ML service is running on the laptop — mark it as connected
        systemStatus.updateRaspberryPi({});

        const predictionData = {
            prediction: data.prediction,
            classId: data.classId,
            confidence: data.confidence,
            sensorValues: data.sensorValues,
            timestamp: data.timestamp || new Date()
        };

        // Update in-memory store (instant, no DB dependency)
        updateLatestWaterQuality(predictionData);

        // Emit to frontend via Socket.IO FIRST (instant — no DB wait)
        if (io) {
            io.emit('water-quality-prediction', predictionData);

            // Send alert for poor water quality
            if (data.prediction === 'Poor') {
                io.emit('alert', {
                    type: 'danger',
                    source: 'ml-water-quality',
                    message: `AI Water Quality Alert: Water quality is POOR (${data.confidence}% confidence)`,
                    severity: 'critical',
                    timestamp: new Date()
                });
            } else if (data.prediction === 'Moderate') {
                io.emit('alert', {
                    type: 'warning',
                    source: 'ml-water-quality',
                    message: `Water quality is Moderate (${data.confidence}% confidence)`,
                    severity: 'medium',
                    timestamp: new Date()
                });
            }
        }

        // Save prediction to database in background (non-blocking)
        WaterQualityPrediction.create({
            prediction: data.prediction,
            classId: data.classId,
            confidence: data.confidence,
            sensorSnapshot: {
                temperature: data.sensorValues?.temperature,
                ph: data.sensorValues?.ph,
                turbidity: data.sensorValues?.turbidity,
                tds: data.sensorValues?.tds,
                dissolvedOxygen: data.sensorValues?.do,
                ammonia: data.sensorValues?.ammonia,
            },
            timestamp: data.timestamp || new Date()
        }).catch(err => console.warn('Could not save water quality prediction:', err.message));
    },

    /**
     * Handle fish disease detection from ML service
     */
    async handleFishDisease(data, io) {
        const status = data.diseaseDetected ? '🔴 DISEASE' : '🟢 Healthy';
        console.log(`🐟 Fish disease: ${status} (${data.detectionCount} detections)`);

        // Update system status — YOLO is running, laptop is connected
        systemStatus.updateYOLO({ modelLoaded: true });
        systemStatus.updateRaspberryPi({});

        // Update in-memory store (instant, no DB dependency)
        updateLatestFishDisease({
            diseaseDetected: data.diseaseDetected,
            detections: data.detections || [],
            detectionCount: data.detectionCount || 0,
            maxConfidence: data.maxConfidence || 0,
            status: data.status || 'healthy',
            cameraSource: data.cameraSource,
            timestamp: data.timestamp || new Date()
        });

        // Throttled DB save — only write once every 5 seconds
        const now = Date.now();
        if (now - lastDbSaveTime >= DB_SAVE_INTERVAL) {
            lastDbSaveTime = now;
            try {
                const detection = new FishDetection({
                    source: 'ml-service',
                    fishCount: data.detectionCount || 0,
                    fps: 2,
                    detections: (data.detections || []).map(d => ({
                        class: d.class,
                        confidence: d.confidence / 100,
                        bbox: d.bbox
                    })),
                    abnormalBehavior: data.diseaseDetected ? 'Disease detected' : null,
                    diseaseRisk: data.diseaseDetected ? 'high' : 'low',
                    status: data.diseaseDetected ? 'critical' : 'normal',
                    confidence: (data.maxConfidence || 0) / 100,
                    timestamp: data.timestamp || new Date()
                });

                await detection.save();
            } catch (dbError) {
                console.warn('Could not save fish disease detection:', dbError.message);
            }
        }

        // Emit to frontend via Socket.IO (metadata only — video via MJPEG stream)
        if (io) {
            io.emit('fish-disease-detection', {
                diseaseDetected: data.diseaseDetected,
                detections: data.detections || [],
                detectionCount: data.detectionCount || 0,
                maxConfidence: data.maxConfidence || 0,
                status: data.status || 'healthy',
                cameraSource: data.cameraSource,
                behaviorTrackingActive: data.behaviorTrackingActive || false,
                tracking: data.tracking || [],
                timestamp: data.timestamp || new Date()
            });

            // Alert for disease detection
            if (data.diseaseDetected) {
                const diseaseClasses = (data.detections || []).map(d => d.class).join(', ');
                io.emit('alert', {
                    type: 'danger',
                    source: 'ml-fish-disease',
                    message: `Fish Disease Detected: ${diseaseClasses} (${data.maxConfidence}% confidence)`,
                    severity: 'critical',
                    timestamp: new Date()
                });
            }
        }
    },

    /**
     * Handle fish feeding prediction from ML service
     */
    async handleFishFeeding(data, io) {
        const levelLabel = data.feedingLabel || 'Unknown';
        console.log(`🍽️ Fish feeding prediction: ${levelLabel} (CO2=${data.co2Value}ppm, ${data.confidence}%)`);

        const feedingData = {
            feedingLevel: data.feedingLevel,
            feedingLabel: data.feedingLabel,
            confidence: data.confidence,
            sensorValues: data.sensorValues || {},
            aiModeActive: data.aiModeActive || false,
            timestamp: data.timestamp || new Date()
        };

        // Cache for instant load on new connections
        updateLatestFishFeeding(feedingData);

        // Emit to frontend via Socket.IO
        if (io) {
            io.emit('fish-feeding-prediction', feedingData);
        }
    },

    /**
     * Handle human/animal security detection from ML service
     */
    async handleSecurity(data, io) {
        if (data.detectionCount > 0) {
            const classes = (data.detectedClasses || []).join(', ');
            console.log(`🛡️ Security detection: ${classes} (${data.detectionCount} object(s))`);
        }

        if (io) {
            console.log(`[DEBUG] Emitting security-update to frontend. Person? ${data.personDetected}, Animal? ${data.animalDetected}, Cam: ${data.cameraSource}`);
            io.emit('security-update', {
                personDetected: data.personDetected || false,
                animalDetected: data.animalDetected || false,
                detections: data.detections || [],
                detectedClasses: data.detectedClasses || [],
                detectionCount: data.detectionCount || 0,
                maxConfidence: data.maxConfidence || 0,
                cameraSource: data.cameraSource,
                inferenceMs: data.inferenceMs || 0,
                timestamp: data.timestamp || new Date()
            });

            // Alert when person or animal is detected — one alert per unique class
            if (data.personDetected || data.animalDetected) {
                const detections = data.detections || [];
                const seenClasses = new Set();

                detections.forEach(d => {
                    const cls = (d.class || '').toLowerCase();
                    if (seenClasses.has(cls)) return;   // skip duplicates within same frame
                    seenClasses.add(cls);

                    const isHuman = cls === 'person' || cls === 'human';
                    const confidence = d.confidence ? Math.round(d.confidence) : (data.maxConfidence || 0);

                    io.emit('alert', {
                        type: isHuman ? 'danger' : 'warning',
                        source: 'security',
                        sensor: `security-${cls}`,      // unique key for dedup in bell
                        message: isHuman
                            ? `🧍 Human Detected near fish tank! (${confidence}% confidence)`
                            : `🐾 Animal Detected: ${cls.charAt(0).toUpperCase() + cls.slice(1)} near fish tank! (${confidence}% confidence)`,
                        timestamp: new Date()
                    });
                });

                // Fallback: if no per-class detections, emit a generic alert
                if (seenClasses.size === 0) {
                    const who = data.personDetected ? '🧍 Human' : '🐾 Animal';
                    io.emit('alert', {
                        type: data.personDetected ? 'danger' : 'warning',
                        source: 'security',
                        sensor: 'security-unknown',
                        message: `${who} Detected near fish tank!`,
                        timestamp: new Date()
                    });
                }
            }
        }
    },

    /**
     * Handle fish gas detection from ML service
     */
    async handleFishGas(data, io) {
        const label = data.gasLabel || 'Unknown';
        console.log(`💨 Fish gas detection: ${label} (${data.confidence}%)`);

        const gasData = {
            gasLevel: data.gasLevel,
            gasLabel: data.gasLabel,
            confidence: data.confidence,
            sensorValues: data.sensorValues || {},
            timestamp: data.timestamp || new Date()
        };

        // Cache for instant load on new connections
        updateLatestFishGas(gasData);

        if (io) {
            io.emit('fish-gas-detection', gasData);

            // Emit alert if gas danger detected
            if (data.gasLevel === 1) {
                io.emit('alert', {
                    type: 'critical',
                    source: 'gas-detection',
                    message: `⚠️ Dangerous gas levels detected (${data.confidence}% confidence)`,
                    severity: 'critical',
                    timestamp: new Date()
                });
            }
        }
    },

    /**
     * Handle ML service online/offline status
     */
    async handleStatus(data, io) {
        console.log('🧠 ML Service status:', data.status);

        const isOnline = data.status === 'online';

        // Update system status for YOLO and laptop
        if (isOnline) {
            systemStatus.updateRaspberryPi({});
            if (data.models?.fishDisease) {
                systemStatus.updateYOLO({ modelLoaded: true });
            }
        }

        if (io) {
            io.emit('device-status', {
                device: 'laptop',
                online: isOnline,
                status: data.status,
                models: data.models,
                timestamp: data.timestamp || new Date()
            });

            io.emit('model-status', {
                running: isOnline && data.models?.fishDisease,
                modelLoaded: data.models?.fishDisease || false,
                waterQualityLoaded: data.models?.waterQuality || false,
                securityLoaded: data.models?.security || false,
                timestamp: data.timestamp || new Date()
            });
        }
    }
};

module.exports = mlHandler;
