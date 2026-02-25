const mongoose = require('mongoose');

const waterQualityPredictionSchema = new mongoose.Schema({
    prediction: {
        type: String,
        enum: ['Poor', 'Moderate', 'Good'],
        required: true
    },
    classId: {
        type: Number,
        required: true
    },
    confidence: {
        type: Number,
        default: 0
    },
    sensorSnapshot: {
        temperature: { type: Number, default: null },
        ph: { type: Number, default: null },
        turbidity: { type: Number, default: null },
        tds: { type: Number, default: null },
        dissolvedOxygen: { type: Number, default: null },
        ammonia: { type: Number, default: null }
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
waterQualityPredictionSchema.index({ timestamp: -1 });
waterQualityPredictionSchema.index({ prediction: 1, timestamp: -1 });

// Static methods
waterQualityPredictionSchema.statics.getLatest = function () {
    return this.findOne().sort({ timestamp: -1 });
};

waterQualityPredictionSchema.statics.getHistory = function (startDate, endDate, limit = 100) {
    return this.find({
        timestamp: { $gte: startDate, $lte: endDate }
    })
        .sort({ timestamp: -1 })
        .limit(limit);
};

waterQualityPredictionSchema.statics.getPoorEvents = function (startDate, endDate) {
    return this.find({
        timestamp: { $gte: startDate, $lte: endDate },
        prediction: 'Poor'
    }).sort({ timestamp: -1 });
};

module.exports = mongoose.model('WaterQualityPrediction', waterQualityPredictionSchema);
