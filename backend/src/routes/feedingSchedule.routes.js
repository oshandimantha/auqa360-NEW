const express = require('express');
const router = express.Router();
const feedingScheduleController = require('../controllers/feedingSchedule.controller');

// Get all schedules
router.get('/schedules', feedingScheduleController.getAll);

// Create new schedule
router.post('/schedules', feedingScheduleController.create);

// Update schedule
router.put('/schedules/:id', feedingScheduleController.update);

// Delete schedule
router.delete('/schedules/:id', feedingScheduleController.delete);

// Sync schedules to ESP32
router.post('/sync', feedingScheduleController.sync);

// Get feeder mode
router.get('/mode', feedingScheduleController.getMode);

module.exports = router;
