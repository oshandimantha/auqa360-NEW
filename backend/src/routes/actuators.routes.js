const express = require('express');
const router = express.Router();
const actuatorsController = require('../controllers/actuators.controller');

// GET /api/actuators - Get all actuator states
router.get('/', actuatorsController.getAll);

// GET /api/actuators/:name - Get specific actuator
router.get('/:name', actuatorsController.getOne);

// POST /api/actuators/toggle - Toggle actuator state
router.post('/toggle', actuatorsController.toggle);

// POST /api/actuators/batch - Batch update actuators
router.post('/batch', actuatorsController.batchUpdate);

// POST /api/actuators/schedule - Set actuator schedule
router.post('/schedule', actuatorsController.setSchedule);

module.exports = router;
