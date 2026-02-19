const fs = require('fs');
const path = require('path');
const esp32Publisher = require('../mqtt/publishers/esp32.publisher');

// Local file path for schedules
const SCHEDULES_FILE = path.join(__dirname, '../../data/schedules.json');

// Ensure data directory exists
const dataDir = path.dirname(SCHEDULES_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Read schedules from file
const readSchedules = () => {
    try {
        if (fs.existsSync(SCHEDULES_FILE)) {
            const data = fs.readFileSync(SCHEDULES_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error reading schedules:', error);
        return [];
    }
};

// Write schedules to file
const writeSchedules = (schedules) => {
    try {
        fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing schedules:', error);
        return false;
    }
};

// Generate unique ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const feedingScheduleController = {
    /**
     * GET /api/feeding/schedules
     * Get all feeding schedules
     */
    async getAll(req, res) {
        try {
            const schedules = readSchedules();
            res.json(schedules);
        } catch (error) {
            console.error('Error fetching schedules:', error);
            res.status(500).json({ error: 'Failed to fetch schedules' });
        }
    },

    /**
     * POST /api/feeding/schedules
     * Create a new feeding schedule
     */
    async create(req, res) {
        try {
            const { name, days, hour, minute, enabled } = req.body;

            if (!days || !Array.isArray(days) || days.length === 0) {
                return res.status(400).json({ error: 'At least one day must be selected' });
            }

            if (hour === undefined || hour < 0 || hour > 23) {
                return res.status(400).json({ error: 'Hour must be between 0-23' });
            }

            const schedule = {
                _id: generateId(),
                name: name || 'Feeding Schedule',
                days,
                hour,
                minute: minute || 0,
                enabled: enabled !== false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const schedules = readSchedules();
            schedules.push(schedule);
            writeSchedules(schedules);

            // Sync schedules to ESP32
            feedingScheduleController.syncToESP32();

            res.status(201).json(schedule);
        } catch (error) {
            console.error('Error creating schedule:', error);
            res.status(500).json({ error: 'Failed to create schedule' });
        }
    },

    /**
     * PUT /api/feeding/schedules/:id
     * Update a feeding schedule
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const { name, days, hour, minute, enabled } = req.body;

            const schedules = readSchedules();
            const index = schedules.findIndex(s => s._id === id);

            if (index === -1) {
                return res.status(404).json({ error: 'Schedule not found' });
            }

            schedules[index] = {
                ...schedules[index],
                name: name !== undefined ? name : schedules[index].name,
                days: days !== undefined ? days : schedules[index].days,
                hour: hour !== undefined ? hour : schedules[index].hour,
                minute: minute !== undefined ? minute : schedules[index].minute,
                enabled: enabled !== undefined ? enabled : schedules[index].enabled,
                updatedAt: new Date().toISOString()
            };

            writeSchedules(schedules);

            // Sync schedules to ESP32
            feedingScheduleController.syncToESP32();

            res.json(schedules[index]);
        } catch (error) {
            console.error('Error updating schedule:', error);
            res.status(500).json({ error: 'Failed to update schedule' });
        }
    },

    /**
     * DELETE /api/feeding/schedules/:id
     * Delete a feeding schedule
     */
    async delete(req, res) {
        try {
            const { id } = req.params;

            const schedules = readSchedules();
            const index = schedules.findIndex(s => s._id === id);

            if (index === -1) {
                return res.status(404).json({ error: 'Schedule not found' });
            }

            schedules.splice(index, 1);
            writeSchedules(schedules);

            // Sync schedules to ESP32
            feedingScheduleController.syncToESP32();

            res.json({ success: true, message: 'Schedule deleted' });
        } catch (error) {
            console.error('Error deleting schedule:', error);
            res.status(500).json({ error: 'Failed to delete schedule' });
        }
    },

    /**
     * POST /api/feeding/sync
     * Manually sync schedules to ESP32
     */
    async sync(req, res) {
        try {
            feedingScheduleController.syncToESP32();
            res.json({ success: true, message: 'Schedules synced to ESP32' });
        } catch (error) {
            console.error('Error syncing schedules:', error);
            res.status(500).json({ error: 'Failed to sync schedules' });
        }
    },

    /**
     * GET /api/feeding/mode
     * Get current feeder mode
     */
    async getMode(req, res) {
        try {
            res.json({
                autoMode: true,
                feederEnabled: true
            });
        } catch (error) {
            console.error('Error getting mode:', error);
            res.status(500).json({ error: 'Failed to get mode' });
        }
    },

    /**
     * Internal: Sync schedules to ESP32 via MQTT
     */
    syncToESP32() {
        try {
            const schedules = readSchedules();
            const enabledSchedules = schedules
                .filter(s => s.enabled)
                .map(s => ({
                    days: s.days,
                    hour: s.hour,
                    minute: s.minute
                }));

            esp32Publisher.syncFeedingSchedules(enabledSchedules);
            console.log('📅 Synced', enabledSchedules.length, 'schedules to ESP32');
        } catch (error) {
            console.error('Error syncing to ESP32:', error);
        }
    }
};

module.exports = feedingScheduleController;
