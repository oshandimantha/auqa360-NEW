const { Server } = require('socket.io');
const corsConfig = require('../config/cors');

let io = null;

/**
 * Initialize Socket.io server
 */
const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: corsConfig.origin,
            methods: corsConfig.methods,
            credentials: corsConfig.credentials
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Send initial connection status
        socket.emit('connection', {
            connected: true,
            socketId: socket.id,
            timestamp: new Date()
        });

        // Handle client requesting current data
        socket.on('request-data', async (type) => {
            console.log(`📥 Client requested: ${type}`);
            // Data will be fetched and sent by controllers
        });

        // Handle actuator control commands from frontend
        socket.on('control', (data) => {
            console.log(`🎮 Control command:`, data);

            // Forward actuator commands to ESP32 via MQTT
            if (data.type === 'actuator' && data.name) {
                const esp32Publisher = require('../mqtt/publishers/esp32.publisher');
                const commandData = {};

                // Include action if present (e.g., 'setMode', 'trigger', 'setTime')
                if (data.action) {
                    commandData.action = data.action;
                }

                // Copy any extra params (year, month, day, etc.)
                const excludeKeys = ['type', 'name', 'state', 'action'];
                for (const [key, val] of Object.entries(data)) {
                    if (!excludeKeys.includes(key)) {
                        commandData[key] = val;
                    }
                }

                const published = esp32Publisher.toggleActuator(data.name, data.state, commandData);
                console.log(`📡 MQTT publish ${published ? 'OK' : 'FAILED'}: ${data.name} -> ${data.state}`);
            }

            // Re-emit for any other backend listeners
            io.emit('control-command', data);
        });

        // Handle stream control
        socket.on('stream', (data) => {
            console.log(`📹 Stream command:`, data);
            io.emit('stream-command', data);
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`Socket error for ${socket.id}:`, error);
        });
    });

    console.log('✅ Socket.io initialized');
    return io;
};

/**
 * Get Socket.io instance
 */
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

/**
 * Emit event to all connected clients
 */
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};

/**
 * Emit event to specific room
 */
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
    }
};

module.exports = {
    initSocket,
    getIO,
    emitToAll,
    emitToRoom
};
