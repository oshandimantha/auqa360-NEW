const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['info', 'warning', 'danger', 'alert', 'system'],
        default: 'info'
    },
    source: {
        type: String,
        enum: ['esp32', 'raspberry_pi', 'laptop', 'backend', 'user'],
        required: true
    },
    category: {
        type: String,
        enum: ['sensor', 'detection', 'actuator', 'connection', 'alert'],
        default: 'system'
    },
    message: {
        type: String,
        required: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    acknowledged: {
        type: Boolean,
        default: false
    },
    acknowledgedAt: {
        type: Date,
        default: null
    },
    acknowledgedBy: {
        type: String,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Indexes
eventLogSchema.index({ timestamp: -1 });
eventLogSchema.index({ type: 1, timestamp: -1 });
eventLogSchema.index({ source: 1, timestamp: -1 });

// Static methods
eventLogSchema.statics.getRecent = function (limit = 50) {
    return this.find()
        .sort({ timestamp: -1 })
        .limit(limit);
};

eventLogSchema.statics.getUnacknowledged = function () {
    return this.find({ acknowledged: false })
        .sort({ timestamp: -1 });
};

eventLogSchema.statics.getByType = function (type, startDate, endDate) {
    return this.find({
        type,
        timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
};

eventLogSchema.statics.logEvent = function (type, source, message, data = null) {
    return this.create({
        type,
        source,
        message,
        data,
        timestamp: new Date()
    });
};

module.exports = mongoose.model('EventLog', eventLogSchema);
