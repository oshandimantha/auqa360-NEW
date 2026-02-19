const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');

// GET /api/reports - Get comprehensive report
router.get('/', reportsController.getReport);

// GET /api/reports/summary - Get summary statistics
router.get('/summary', reportsController.getSummary);

// GET /api/reports/trends - Get trend data for charts
router.get('/trends', reportsController.getTrends);

module.exports = router;
