const SensorReading = require('../models/SensorReading');
const FishDetection = require('../models/FishDetection');
const LaptopDetection = require('../models/LaptopDetection');
const analyticsService = require('../services/analytics.service');

/**
 * Reports Controller
 * Handles REST API endpoints for reports and analytics
 */
const reportsController = {
    /**
     * GET /api/reports
     * Get comprehensive report data
     */
    async getReport(req, res) {
        try {
            const { period = 'daily' } = req.query;

            const endDate = new Date();
            let startDate = new Date();

            switch (period) {
                case 'daily':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'weekly':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'monthly':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
            }

            // Fetch sensor readings for the period
            const sensorReadings = await SensorReading.find({
                timestamp: { $gte: startDate, $lte: endDate }
            }).sort({ timestamp: 1 });

            // Calculate averages
            const sensorStats = analyticsService.calculateSensorStats(sensorReadings);

            // Fetch detection data
            const detections = await FishDetection.find({
                timestamp: { $gte: startDate, $lte: endDate }
            }).sort({ timestamp: 1 });

            const detectionStats = analyticsService.calculateDetectionStats(detections);

            res.json({
                period,
                startDate,
                endDate,
                sensors: {
                    stats: sensorStats,
                    readings: sensorReadings
                },
                detections: {
                    stats: detectionStats,
                    count: detections.length
                }
            });
        } catch (error) {
            console.error('Error generating report:', error);
            res.status(500).json({ error: 'Failed to generate report' });
        }
    },

    /**
     * GET /api/reports/summary
     * Get summary statistics
     */
    async getSummary(req, res) {
        try {
            const { period = 'daily' } = req.query;

            const endDate = new Date();
            let startDate = new Date();

            switch (period) {
                case 'daily':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'weekly':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'monthly':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
            }

            // Get aggregated sensor data
            const sensorAgg = await SensorReading.aggregate([
                {
                    $match: { timestamp: { $gte: startDate, $lte: endDate } }
                },
                {
                    $group: {
                        _id: null,
                        avgTemperature: { $avg: '$temperature' },
                        minTemperature: { $min: '$temperature' },
                        maxTemperature: { $max: '$temperature' },
                        avgPh: { $avg: '$ph' },
                        minPh: { $min: '$ph' },
                        maxPh: { $max: '$ph' },
                        avgTurbidity: { $avg: '$turbidity' },
                        avgTds: { $avg: '$tds' },
                        avgCo2: { $avg: '$co2' },
                        avgWaterLevel: { $avg: '$waterLevel' },
                        totalReadings: { $sum: 1 }
                    }
                }
            ]);

            // Get detection summary
            const detectionAgg = await FishDetection.aggregate([
                {
                    $match: { timestamp: { $gte: startDate, $lte: endDate } }
                },
                {
                    $group: {
                        _id: null,
                        avgFishCount: { $avg: '$fishCount' },
                        maxFishCount: { $max: '$fishCount' },
                        avgFps: { $avg: '$fps' },
                        totalDetections: { $sum: 1 },
                        abnormalCount: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ['$abnormalBehavior', null] },
                                            { $ne: ['$abnormalBehavior', 'None detected'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            res.json({
                period,
                sensors: sensorAgg[0] || {},
                detections: detectionAgg[0] || {}
            });
        } catch (error) {
            console.error('Error generating summary:', error);
            res.status(500).json({ error: 'Failed to generate summary' });
        }
    },

    /**
     * GET /api/reports/trends
     * Get trend data for charts
     */
    async getTrends(req, res) {
        try {
            const { period = 'daily', sensor = 'all' } = req.query;

            const endDate = new Date();
            let startDate = new Date();
            let interval = 'hour';

            switch (period) {
                case 'daily':
                    startDate.setDate(startDate.getDate() - 1);
                    interval = 'hour';
                    break;
                case 'weekly':
                    startDate.setDate(startDate.getDate() - 7);
                    interval = 'day';
                    break;
                case 'monthly':
                    startDate.setMonth(startDate.getMonth() - 1);
                    interval = 'day';
                    break;
            }

            const aggregated = await SensorReading.getAggregated(startDate, endDate, interval);

            res.json({
                period,
                interval,
                startDate,
                endDate,
                trends: aggregated
            });
        } catch (error) {
            console.error('Error fetching trends:', error);
            res.status(500).json({ error: 'Failed to fetch trends' });
        }
    }
};

module.exports = reportsController;
