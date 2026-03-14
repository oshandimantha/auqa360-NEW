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
    // Build groupId that produces a sortable, readable timestamp string
    let groupId;
    let dateFormat;

    if (interval === 'hour') {
        // Group by year+month+day+hour -> "2026-03-14 14:00"
        groupId = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' }
        };
        dateFormat = {
            $dateToString: {
                format: '%Y-%m-%d %H:00',
                date: '$firstTs'
            }
        };
    } else {
        // Group by year+month+day -> "2026-03-14"
        groupId = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
        };
        dateFormat = {
            $dateToString: {
                format: '%Y-%m-%d',
                date: '$firstTs'
            }
        };
    }

    return this.aggregate([
        {
            $match: {
                timestamp: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: groupId,
                firstTs: { $min: '$timestamp' },
                avgTemperature: { $avg: '$temperature' },
                avgPh: { $avg: '$ph' },
                avgTurbidity: { $avg: '$turbidity' },
                avgTds: { $avg: '$tds' },
                avgCo2: { $avg: '$co2' },
                avgWaterLevel: { $avg: '$waterLevel' },
                count: { $sum: 1 }
            }
        },
        { $sort: { firstTs: 1 } },
        {
            $project: {
                _id: 0,
                timestamp: dateFormat,
                avgTemperature: { $round: ['$avgTemperature', 2] },
                avgPh: { $round: ['$avgPh', 2] },
                avgTurbidity: { $round: ['$avgTurbidity', 2] },
                avgTds: { $round: ['$avgTds', 2] },
                avgCo2: { $round: ['$avgCo2', 2] },
                avgWaterLevel: { $round: ['$avgWaterLevel', 2] },
                count: 1
            }
        }
    ]);
};

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
