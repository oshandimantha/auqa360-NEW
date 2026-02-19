const SensorReading = require('../models/SensorReading');

/**
 * Sensors Controller
 * Handles REST API endpoints for sensor data
 */
const sensorsController = {
    /**
     * GET /api/sensors
     * Get latest sensor readings
     */
    async getLatest(req, res) {
        try {
            const latest = await SensorReading.getLatest();

            if (!latest) {
                return res.json({
                    temperature: null,
                    ph: null,
                    turbidity: null,
                    tds: null,
                    co2: null,
                    waterLevel: null,
                    pir: false,
                    timestamp: null,
                    message: 'No sensor data available'
                });
            }

            res.json(latest);
        } catch (error) {
            console.error('Error fetching latest sensors:', error);
            res.status(500).json({ error: 'Failed to fetch sensor data' });
        }
    },

    /**
     * GET /api/sensors/history
     * Get historical sensor readings
     */
    async getHistory(req, res) {
        try {
            const { period = 'daily', sensor = null, limit = 100 } = req.query;

            // Calculate date range based on period
            const endDate = new Date();
            let startDate = new Date();

            switch (period) {
                case 'hourly':
                    startDate.setHours(startDate.getHours() - 1);
                    break;
                case 'daily':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case 'weekly':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'monthly':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 1);
            }

            const readings = await SensorReading.getHistory(startDate, endDate, parseInt(limit));

            // Reverse to get chronological order
            const chronological = readings.reverse();

            res.json({
                period,
                startDate,
                endDate,
                count: chronological.length,
                readings: chronological
            });
        } catch (error) {
            console.error('Error fetching sensor history:', error);
            res.status(500).json({ error: 'Failed to fetch sensor history' });
        }
    },

    /**
     * GET /api/sensors/aggregated
     * Get aggregated sensor data for reports
     */
    async getAggregated(req, res) {
        try {
            const { period = 'daily', interval = 'hour' } = req.query;

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
                default:
                    startDate.setDate(startDate.getDate() - 1);
            }

            const aggregated = await SensorReading.getAggregated(startDate, endDate, interval);

            res.json({
                period,
                interval,
                startDate,
                endDate,
                data: aggregated
            });
        } catch (error) {
            console.error('Error fetching aggregated data:', error);
            res.status(500).json({ error: 'Failed to fetch aggregated data' });
        }
    },

    /**
     * GET /api/sensors/:type
     * Get specific sensor type data
     */
    async getSensorType(req, res) {
        try {
            const { type } = req.params;
            const { limit = 50 } = req.query;

            const validTypes = ['temperature', 'ph', 'turbidity', 'tds', 'co2', 'waterLevel'];

            if (!validTypes.includes(type)) {
                return res.status(400).json({ error: `Invalid sensor type. Valid types: ${validTypes.join(', ')}` });
            }

            const readings = await SensorReading.find()
                .select(`${type} timestamp`)
                .sort({ timestamp: -1 })
                .limit(parseInt(limit));

            res.json({
                sensor: type,
                count: readings.length,
                readings: readings.reverse()
            });
        } catch (error) {
            console.error('Error fetching sensor type:', error);
            res.status(500).json({ error: 'Failed to fetch sensor data' });
        }
    }
};

module.exports = sensorsController;
