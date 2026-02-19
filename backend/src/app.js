const express = require('express');
const cors = require('cors');
const corsConfig = require('./config/cors');
const systemStatus = require('./utils/systemStatus');

// Import routes
const sensorsRoutes = require('./routes/sensors.routes');
const detectionsRoutes = require('./routes/detections.routes');
const actuatorsRoutes = require('./routes/actuators.routes');
const reportsRoutes = require('./routes/reports.routes');
const feedingScheduleRoutes = require('./routes/feedingSchedule.routes');

const app = express();

// Middleware
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint (basic)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'AquaSense360 Backend'
    });
});

// System status endpoint (detailed)
app.get('/api/status', (req, res) => {
    const status = systemStatus.getStatus();
    res.json(status);
});

// API Routes
app.use('/api/sensors', sensorsRoutes);
app.use('/api/detections', detectionsRoutes);
app.use('/api/actuators', actuatorsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/feeding', feedingScheduleRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

module.exports = app;
