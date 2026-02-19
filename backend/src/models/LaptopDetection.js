const mongoose = require('mongoose');

const laptopDetectionSchema = new mongoose.Schema({
    source: {
        type: String,
        default: 'laptop'
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
    modelName: {
        type: String,
        default: 'YOLOv8'
    },
    processingTime: {
        type: Number, // in milliseconds
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
laptopDetectionSchema.index({ timestamp: -1 });

// Static methods
laptopDetectionSchema.statics.getLatest = function () {
    return this.findOne().sort({ timestamp: -1 });
};

laptopDetectionSchema.statics.getHistory = function (startDate, endDate, limit = 100) {
    return this.find({
        timestamp: { $gte: startDate, $lte: endDate }
    })
        .sort({ timestamp: -1 })
        .limit(limit);
};

module.exports = mongoose.model('LaptopDetection', laptopDetectionSchema);
