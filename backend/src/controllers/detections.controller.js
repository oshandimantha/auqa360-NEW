const FishDetection = require('../models/FishDetection');
const LaptopDetection = require('../models/LaptopDetection');

/**
 * Detections Controller
 * Handles REST API endpoints for fish detection data
 */
const detectionsController = {
    /**
     * GET /api/detections
     * Get latest detection from all sources
     */
    async getLatest(req, res) {
        try {
            const { source } = req.query;

            let piDetection = null;
            let laptopDetection = null;

            if (!source || source === 'pi' || source === 'all') {
                piDetection = await FishDetection.getLatest();
            }

            if (!source || source === 'laptop' || source === 'all') {
                laptopDetection = await LaptopDetection.getLatest();
            }

            // Return based on source filter
            if (source === 'pi') {
                return res.json(piDetection || { message: 'No Pi detection data' });
            }

            if (source === 'laptop') {
                return res.json(laptopDetection || { message: 'No laptop detection data' });
            }

            // Return both sources
            res.json({
                pi: piDetection || null,
                laptop: laptopDetection || null,
                // Combined latest (whichever is more recent)
                latest: this.getMostRecent(piDetection, laptopDetection)
            });
        } catch (error) {
            console.error('Error fetching latest detection:', error);
            res.status(500).json({ error: 'Failed to fetch detection data' });
        }
    },

    /**
     * Helper to get most recent detection
     */
    getMostRecent(piDetection, laptopDetection) {
        if (!piDetection && !laptopDetection) return null;
        if (!piDetection) return { ...laptopDetection.toObject(), source: 'laptop' };
        if (!laptopDetection) return { ...piDetection.toObject(), source: 'pi' };

        return piDetection.timestamp > laptopDetection.timestamp
            ? { ...piDetection.toObject(), source: 'pi' }
            : { ...laptopDetection.toObject(), source: 'laptop' };
    },

    /**
     * GET /api/detections/history
     * Get detection history
     */
    async getHistory(req, res) {
        try {
            const { period = 'daily', source = 'all', limit = 100 } = req.query;

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
            }

            const results = {};

            if (source === 'all' || source === 'pi') {
                results.pi = await FishDetection.getHistory(startDate, endDate, parseInt(limit));
            }

            if (source === 'all' || source === 'laptop') {
                results.laptop = await LaptopDetection.getHistory(startDate, endDate, parseInt(limit));
            }

            res.json({
                period,
                startDate,
                endDate,
                ...results
            });
        } catch (error) {
            console.error('Error fetching detection history:', error);
            res.status(500).json({ error: 'Failed to fetch detection history' });
        }
    },

    /**
     * GET /api/detections/alerts
     * Get abnormal detection events
     */
    async getAlerts(req, res) {
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

            const abnormalEvents = await FishDetection.getAbnormalEvents(startDate, endDate);

            res.json({
                period,
                count: abnormalEvents.length,
                alerts: abnormalEvents
            });
        } catch (error) {
            console.error('Error fetching detection alerts:', error);
            res.status(500).json({ error: 'Failed to fetch detection alerts' });
        }
    },

    /**
     * GET /api/detections/stats
     * Get detection statistics
     */
    async getStats(req, res) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [todayPi, totalPi, todayLaptop, totalLaptop] = await Promise.all([
                FishDetection.countDocuments({ timestamp: { $gte: today } }),
                FishDetection.countDocuments(),
                LaptopDetection.countDocuments({ timestamp: { $gte: today } }),
                LaptopDetection.countDocuments()
            ]);

            res.json({
                pi: {
                    today: todayPi,
                    total: totalPi
                },
                laptop: {
                    today: todayLaptop,
                    total: totalLaptop
                }
            });
        } catch (error) {
            console.error('Error fetching detection stats:', error);
            res.status(500).json({ error: 'Failed to fetch detection stats' });
        }
    }
};

module.exports = detectionsController;
