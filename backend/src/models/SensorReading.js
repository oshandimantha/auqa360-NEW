const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
    temperature: {
        type: Number,
        default: null
    },
    ph: {
        type: Number,
        default: null
    },
    turbidity: {
        type: Number,
        default: null
    },
    tds: {
        type: Number,
        default: null
    },
    co2: {
        type: Number,
        default: null
    },
    waterLevel: {
        type: Number,
        default: null
    },
    pir: {
        type: Boolean,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Index for efficient time-based queries
sensorReadingSchema.index({ timestamp: -1 });

// Static method to get latest reading
sensorReadingSchema.statics.getLatest = function () {
    return this.findOne().sort({ timestamp: -1 });
};

// Static method to get readings for a time period
sensorReadingSchema.statics.getHistory = function (startDate, endDate, limit = 100) {
    return this.find({
        timestamp: { $gte: startDate, $lte: endDate }
    })
        .sort({ timestamp: -1 })
        .limit(limit);
};

// Static method to get aggregated data
sensorReadingSchema.statics.getAggregated = function (startDate, endDate, interval = 'hour') {
    const groupBy = {
        hour: { $hour: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        week: { $week: '$timestamp' },
        month: { $month: '$timestamp' }
    };

    return this.aggregate([
        {
            $match: {
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: groupBy[interval] || groupBy.hour,
                avgTemperature: { $avg: '$temperature' },
                avgPh: { $avg: '$ph' },
                avgTurbidity: { $avg: '$turbidity' },
                avgTds: { $avg: '$tds' },
                avgCo2: { $avg: '$co2' },
                avgWaterLevel: { $avg: '$waterLevel' },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
