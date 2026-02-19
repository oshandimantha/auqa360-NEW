require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./sockets/realtime.socket');
const mqttClient = require('./mqtt/mqtt.client');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);

// Make io accessible to routes
app.set('io', io);

// Track connection states
let mongoConnected = false;
let mqttConnected = false;

// Start server
const startServer = async () => {
    // Try to connect to MongoDB (optional - server runs without it)
    try {
        await connectDB();
        mongoConnected = true;
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.warn('⚠️  MongoDB connection failed:', error.message);
        console.warn('   Server will run without database.');
        console.warn('   To fix: Install MongoDB locally or use MongoDB Atlas (update MONGO_URI in .env)\n');
    }

    // Try to connect to MQTT broker (optional)
    try {
        mqttClient.connect(io);
        mqttConnected = true;
        console.log('✅ MQTT client initialized');
    } catch (error) {
        console.warn('⚠️  MQTT connection failed:', error.message);
        console.warn('   Server will run without MQTT.\n');
    }

    // Start listening (always starts even if DB/MQTT fail)
    server.listen(PORT, () => {
        console.log(`\n🚀 AquaSense360 Backend running on port ${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   MongoDB: ${mongoConnected ? 'Connected' : 'Not connected'}`);
        console.log(`   MQTT: ${mqttConnected ? 'Connected' : 'Not connected'}`);
        console.log(`   API: http://localhost:${PORT}/api`);
        console.log(`   Health: http://localhost:${PORT}/api/health`);
        console.log(`   Socket.io: ws://localhost:${PORT}\n`);
    });
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    if (mqttConnected) mqttClient.disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

startServer();
