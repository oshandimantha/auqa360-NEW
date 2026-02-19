const mongoose = require('mongoose');

const actuatorStateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ['oxygenPump', 'filter', 'feeder', 'rtc']
    },
    state: {
        type: Boolean,
        default: false
    },
    mode: {
        type: String,
        enum: ['manual', 'auto', 'scheduled'],
        default: 'manual'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    lastCommand: {
        type: String,
        default: null
    },
    schedule: {
        enabled: { type: Boolean, default: false },
        onTime: { type: String, default: null },  // "08:00"
        offTime: { type: String, default: null }, // "18:00"
        daysOfWeek: [{ type: Number }] // 0-6 (Sunday-Saturday)
    }
}, {
    timestamps: true
});

// Static method to get all actuator states
actuatorStateSchema.statics.getAllStates = async function () {
    const actuators = await this.find();
    const statesObj = {};
    actuators.forEach(a => {
        statesObj[a.name] = a.state;
    });
    return statesObj;
};

// Static method to toggle actuator
actuatorStateSchema.statics.toggle = async function (name, state) {
    return this.findOneAndUpdate(
        { name },
        {
            state,
            lastUpdated: new Date(),
            lastCommand: state ? 'ON' : 'OFF'
        },
        { upsert: true, new: true }
    );
};

// Initialize default actuator states
actuatorStateSchema.statics.initDefaults = async function () {
    const defaults = ['oxygenPump', 'filter', 'feeder', 'rtc'];
    for (const name of defaults) {
        await this.findOneAndUpdate(
            { name },
            { $setOnInsert: { name, state: false } },
            { upsert: true }
        );
    }
};

module.exports = mongoose.model('ActuatorState', actuatorStateSchema);
