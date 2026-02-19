const express = require('express');
const router = express.Router();
const detectionsController = require('../controllers/detections.controller');

// GET /api/detections - Get latest detections
router.get('/', detectionsController.getLatest);

// GET /api/detections/history - Get detection history
router.get('/history', detectionsController.getHistory);

// GET /api/detections/alerts - Get abnormal events
router.get('/alerts', detectionsController.getAlerts);

// GET /api/detections/stats - Get detection statistics
router.get('/stats', detectionsController.getStats);

module.exports = router;
