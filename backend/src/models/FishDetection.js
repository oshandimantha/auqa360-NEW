const mongoose = require('mongoose');

const fishDetectionSchema = new mongoose.Schema({
    source: {
        type: String,
        enum: ['raspberry_pi', 'pi', 'laptop', 'ml-service'],
        default: 'raspberry_pi'
    },
    fishCount: {
        type: Number,
        default: 0
    },
    fps: {
        type: Number,
        default: 0
    },
    detections: [{
        class: String,
        confidence: Number,
        bbox: {
            x: Number,
            y: Number,
            width: Number,
            height: Number
        }
    }],
    abnormalBehavior: {
        type: String,
        default: null
    },
    diseaseRisk: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
    },
    status: {
        type: String,
        enum: ['normal', 'warning', 'critical'],
        default: 'normal'
    },
    confidence: {
        type: Number,
        default: 0
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
fishDetectionSchema.index({ timestamp: -1 });
fishDetectionSchema.index({ source: 1, timestamp: -1 });

// Static methods
fishDetectionSchema.statics.getLatest = function (source = null) {
    const query = source ? { source } : {};
    return this.findOne(query).sort({ timestamp: -1 });
};

fishDetectionSchema.statics.getHistory = function (startDate, endDate, limit = 100) {
    return this.find({
        timestamp: { $gte: startDate, $lte: endDate }
    })
        .sort({ timestamp: -1 })
        .limit(limit);
};

fishDetectionSchema.statics.getAbnormalEvents = function (startDate, endDate) {
    return this.find({
        timestamp: { $gte: startDate, $lte: endDate },
        $or: [
            { abnormalBehavior: { $ne: null, $ne: 'None detected' } },
            { diseaseRisk: { $in: ['medium', 'high'] } }
        ]
    }).sort({ timestamp: -1 });
};

module.exports = mongoose.model('FishDetection', fishDetectionSchema);
