const express = require('express');
const WaterQualityPrediction = require('../models/WaterQualityPrediction');
const mongoose = require('mongoose');

const router = express.Router();

// In-memory store for latest predictions (works even without MongoDB)
let latestWaterQuality = null;
let latestFishDisease = null;
let latestFishFeeding = null;
let latestFishGas = null;

// Called by ml.handler.js to update in-memory store
const updateLatestWaterQuality = (data) => {
    latestWaterQuality = { ...data, updatedAt: new Date() };
};

const updateLatestFishDisease = (data) => {
    latestFishDisease = { ...data, updatedAt: new Date() };
};

const updateLatestFishFeeding = (data) => {
    latestFishFeeding = { ...data, updatedAt: new Date() };
};

const updateLatestFishGas = (data) => {
    latestFishGas = { ...data, updatedAt: new Date() };
};

// GET /api/ml/water-quality/latest
router.get('/water-quality/latest', async (req, res) => {
    // Always try in-memory first (fast, no DB dependency)
    if (latestWaterQuality) {
        return res.json(latestWaterQuality);
    }

    // Fallback to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
        try {
            const prediction = await WaterQualityPrediction.findOne()
                .sort({ timestamp: -1 })
                .lean()
                .maxTimeMS(3000);

            if (prediction) {
                return res.json({
                    prediction: prediction.prediction,
                    classId: prediction.classId,
                    confidence: prediction.confidence,
                    sensorValues: prediction.sensorSnapshot,
                    timestamp: prediction.timestamp,
                });
            }
        } catch (error) {
            console.warn('MongoDB query failed:', error.message);
        }
    }

    // No data available
    res.json({ prediction: null });
});

// GET /api/ml/fish-disease/latest
router.get('/fish-disease/latest', (req, res) => {
    if (latestFishDisease) {
        return res.json(latestFishDisease);
    }
    res.json({ diseaseDetected: null });
});

// GET /api/ml/fish-feeding/latest
router.get('/fish-feeding/latest', (req, res) => {
    if (latestFishFeeding) {
        return res.json(latestFishFeeding);
    }
    res.json({ feedingLevel: null });
});

// GET /api/ml/fish-gas/latest
router.get('/fish-gas/latest', (req, res) => {
    if (latestFishGas) {
        return res.json(latestFishGas);
    }
    res.json({ gasLevel: null });
});

// GET /api/ml/water-quality/history
router.get('/water-quality/history', async (req, res) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({ predictions: [] });
    }

    try {
        const limit = parseInt(req.query.limit) || 50;
        const predictions = await WaterQualityPrediction.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean()
            .maxTimeMS(5000);

        res.json({ predictions });
    } catch (error) {
        console.error('Error fetching prediction history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// POST /api/ml/behavior/scan
router.post('/behavior/scan', (req, res) => {
    try {
        const action = req.body.action || 'start';

        // Lazy-require to avoid circular dependency:
        // ml.routes -> mqtt.client -> ml.handler -> ml.routes
        const mqttClient = require('../mqtt/mqtt.client');
        mqttClient.publish('aquasense/ml/cmd/behavior', {
            action: action,
            timestamp: new Date().toISOString()
        });

        const msg = action === 'start' ? 'Behavior tracking enabled' : 'Behavior tracking disabled';
        res.json({ success: true, message: msg, action });
    } catch (error) {
        console.error('Error toggling behavior tracking:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle behavior tracking' });
    }
});

module.exports = router;
module.exports.updateLatestWaterQuality = updateLatestWaterQuality;
module.exports.updateLatestFishDisease = updateLatestFishDisease;
module.exports.updateLatestFishFeeding = updateLatestFishFeeding;
module.exports.updateLatestFishGas = updateLatestFishGas;
