const express = require('express');
const router = express.Router();
const sensorsController = require('../controllers/sensors.controller');

// GET /api/sensors - Get latest sensor readings
router.get('/', sensorsController.getLatest);

// GET /api/sensors/history - Get historical readings
router.get('/history', sensorsController.getHistory);

// GET /api/sensors/aggregated - Get aggregated data
router.get('/aggregated', sensorsController.getAggregated);

// GET /api/sensors/:type - Get specific sensor type data
router.get('/:type', sensorsController.getSensorType);

module.exports = router;
