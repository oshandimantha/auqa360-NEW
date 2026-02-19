const mongoose = require('mongoose');

const feedingScheduleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Feeding Schedule'
    },
    enabled: {
        type: Boolean,
        default: true
    },
    // Days of week: 0 = Sunday, 1 = Monday, ... 6 = Saturday
    days: [{
        type: Number,
        min: 0,
        max: 6
    }],
    hour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    minute: {
        type: Number,
        required: true,
        min: 0,
        max: 59,
        default: 0
    }
}, {
    timestamps: true
});

// Get all enabled schedules for ESP32 sync
feedingScheduleSchema.statics.getEnabledSchedules = async function () {
    return this.find({ enabled: true }).lean();
};

// Format schedules for ESP32 (compact format)
feedingScheduleSchema.statics.getSchedulesForESP32 = async function () {
    const schedules = await this.find({ enabled: true }).lean();
    return schedules.map(s => ({
        days: s.days,
        hour: s.hour,
        minute: s.minute
    }));
};

const FeedingSchedule = mongoose.model('FeedingSchedule', feedingScheduleSchema);

module.exports = FeedingSchedule;
