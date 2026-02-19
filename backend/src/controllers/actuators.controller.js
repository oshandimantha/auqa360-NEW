const ActuatorState = require('../models/ActuatorState');
const esp32Publisher = require('../mqtt/publishers/esp32.publisher');

/**
 * Actuators Controller
 * Handles REST API endpoints for actuator control
 */
const actuatorsController = {
    /**
     * GET /api/actuators
     * Get all actuator states
     */
    async getAll(req, res) {
        try {
            const states = await ActuatorState.getAllStates();

            // If no actuators found, return defaults
            if (Object.keys(states).length === 0) {
                await ActuatorState.initDefaults();
                return res.json({
                    oxygenPump: false,
                    filter: false,
                    feeder: false,
                    rtc: false
                });
            }

            res.json(states);
        } catch (error) {
            console.error('Error fetching actuator states:', error);
            res.status(500).json({ error: 'Failed to fetch actuator states' });
        }
    },

    /**
     * GET /api/actuators/:name
     * Get specific actuator state
     */
    async getOne(req, res) {
        try {
            const { name } = req.params;
            const validNames = ['oxygenPump', 'filter', 'feeder', 'rtc'];

            if (!validNames.includes(name)) {
                return res.status(400).json({
                    error: `Invalid actuator name. Valid names: ${validNames.join(', ')}`
                });
            }

            const actuator = await ActuatorState.findOne({ name });

            if (!actuator) {
                return res.json({ name, state: false, lastUpdated: null });
            }

            res.json(actuator);
        } catch (error) {
            console.error('Error fetching actuator state:', error);
            res.status(500).json({ error: 'Failed to fetch actuator state' });
        }
    },

    /**
     * POST /api/actuators/toggle
     * Toggle actuator state
     */
    async toggle(req, res) {
        try {
            const { actuator, state, action, ...extraParams } = req.body;
            const validNames = ['oxygenPump', 'filter', 'feeder', 'rtc'];

            if (!actuator || !validNames.includes(actuator)) {
                return res.status(400).json({
                    error: `Invalid actuator name. Valid names: ${validNames.join(', ')}`
                });
            }

            if (typeof state !== 'boolean') {
                return res.status(400).json({ error: 'State must be a boolean' });
            }

            // Build command data with optional action and extra params
            const commandData = {};
            if (action) {
                commandData.action = action;
                Object.assign(commandData, extraParams);
            }

            // Publish command to MQTT
            const published = esp32Publisher.toggleActuator(actuator, state, commandData);

            if (!published) {
                console.warn('MQTT publish failed, but updating database');
            }

            // For action-based commands (trigger, setTime), don't update persistent state
            if (action && (action === 'trigger' || action === 'setTime')) {
                return res.json({
                    success: true,
                    actuator,
                    action,
                    mqttPublished: published,
                    message: `${action} command sent`
                });
            }

            // Update state in database for toggle operations
            const updated = await ActuatorState.toggle(actuator, state);

            // Emit to connected clients via Socket.io
            const io = req.app.get('io');
            if (io) {
                io.emit('actuator-update', { [actuator]: state });
            }

            res.json({
                success: true,
                actuator: updated.name,
                state: updated.state,
                mqttPublished: published,
                lastUpdated: updated.lastUpdated
            });
        } catch (error) {
            console.error('Error toggling actuator:', error);
            res.status(500).json({ error: 'Failed to toggle actuator' });
        }
    },

    /**
     * POST /api/actuators/batch
     * Set multiple actuators at once
     */
    async batchUpdate(req, res) {
        try {
            const { states } = req.body;

            if (!states || typeof states !== 'object') {
                return res.status(400).json({ error: 'States object required' });
            }

            const results = {};

            for (const [actuator, state] of Object.entries(states)) {
                if (typeof state === 'boolean') {
                    esp32Publisher.toggleActuator(actuator, state);
                    await ActuatorState.toggle(actuator, state);
                    results[actuator] = state;
                }
            }

            // Emit to connected clients
            const io = req.app.get('io');
            if (io) {
                io.emit('actuator-update', results);
            }

            res.json({
                success: true,
                updated: results
            });
        } catch (error) {
            console.error('Error batch updating actuators:', error);
            res.status(500).json({ error: 'Failed to batch update actuators' });
        }
    },

    /**
     * POST /api/actuators/schedule
     * Set actuator schedule
     */
    async setSchedule(req, res) {
        try {
            const { actuator, schedule } = req.body;

            if (!actuator || !schedule) {
                return res.status(400).json({ error: 'Actuator and schedule required' });
            }

            const updated = await ActuatorState.findOneAndUpdate(
                { name: actuator },
                {
                    mode: schedule.enabled ? 'scheduled' : 'manual',
                    schedule
                },
                { new: true }
            );

            res.json({
                success: true,
                actuator: updated.name,
                schedule: updated.schedule
            });
        } catch (error) {
            console.error('Error setting schedule:', error);
            res.status(500).json({ error: 'Failed to set schedule' });
        }
    }
};

module.exports = actuatorsController;
