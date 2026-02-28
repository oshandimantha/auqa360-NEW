/**
 * Rules Service
 * Threshold checking and alert generation logic
 */

// Sensor thresholds
const THRESHOLDS = {
    temperature: { min: 24, max: 30, unit: '°C' },
    ph: { min: 6.5, max: 8.5, unit: '' },
    turbidity: { min: 0, max: 50, unit: 'NTU' },
    tds: { min: 100, max: 500, unit: 'ppm' },
    co2: { min: 350, max: 1000, unit: 'ppm' },
    waterLevel: { min: 5, max: 15, unit: 'cm', reversed: true }
};

// Alert severity levels
const SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const rulesService = {
    /**
     * Check all sensor values against thresholds
     */
    checkThresholds(sensorData) {
        const alerts = [];

        for (const [sensor, value] of Object.entries(sensorData)) {
            if (value === null || value === undefined) continue;
            if (!THRESHOLDS[sensor]) continue;

            const threshold = THRESHOLDS[sensor];
            const alert = this.checkSingleThreshold(sensor, value, threshold);

            if (alert) {
                alerts.push(alert);
            }
        }

        return alerts;
    },

    /**
     * Check single sensor against its threshold
     */
    checkSingleThreshold(sensor, value, threshold) {
        const { min, max, unit, reversed } = threshold;

        if (reversed) {
            // Reversed logic (e.g., Water Level uses distance: higher distance = lower water)
            if (value > max * 1.2) {
                return {
                    type: 'danger',
                    sensor,
                    value,
                    threshold: { min, max },
                    message: `CRITICAL: ${this.formatSensorName(sensor)} is critically low (Distance: ${value}${unit} > max safe ${max}${unit})`,
                    severity: SEVERITY.CRITICAL,
                    timestamp: new Date()
                };
            }
            if (value > max) {
                return {
                    type: 'warning',
                    sensor,
                    value,
                    threshold: { min, max },
                    message: `${this.formatSensorName(sensor)} is getting low (Distance: ${value}${unit} > ${max}${unit})`,
                    severity: SEVERITY.MEDIUM,
                    timestamp: new Date()
                };
            }
            // For reversed sensors, falling below minimum is generally safe (e.g. 0cm = full tank)
            return null;
        }

        // Standard non-reversed logic
        // Critical low
        if (value < min * 0.8) {
            return {
                type: 'danger',
                sensor,
                value,
                threshold: { min, max },
                message: `CRITICAL: ${this.formatSensorName(sensor)} is critically low at ${value}${unit} (min: ${min}${unit})`,
                severity: SEVERITY.CRITICAL,
                timestamp: new Date()
            };
        }

        // Warning low
        if (value < min) {
            return {
                type: 'warning',
                sensor,
                value,
                threshold: { min, max },
                message: `${this.formatSensorName(sensor)} is low at ${value}${unit} (min: ${min}${unit})`,
                severity: SEVERITY.MEDIUM,
                timestamp: new Date()
            };
        }

        // Critical high
        if (value > max * 1.2) {
            return {
                type: 'danger',
                sensor,
                value,
                threshold: { min, max },
                message: `CRITICAL: ${this.formatSensorName(sensor)} is critically high at ${value}${unit} (max: ${max}${unit})`,
                severity: SEVERITY.CRITICAL,
                timestamp: new Date()
            };
        }

        // Warning high
        if (value > max) {
            return {
                type: 'warning',
                sensor,
                value,
                threshold: { min, max },
                message: `${this.formatSensorName(sensor)} is high at ${value}${unit} (max: ${max}${unit})`,
                severity: SEVERITY.MEDIUM,
                timestamp: new Date()
            };
        }

        return null; // Within normal range
    },

    /**
     * Format sensor name for display
     */
    formatSensorName(sensor) {
        const names = {
            temperature: 'Temperature',
            ph: 'pH Level',
            turbidity: 'Turbidity',
            tds: 'TDS',
            co2: 'CO2 Level',
            waterLevel: 'Water Level'
        };
        return names[sensor] || sensor;
    },

    /**
     * Get threshold for a sensor
     */
    getThreshold(sensor) {
        return THRESHOLDS[sensor] || null;
    },

    /**
     * Get status based on value
     */
    getStatus(sensor, value) {
        const threshold = THRESHOLDS[sensor];
        if (!threshold) return 'unknown';

        if (threshold.reversed) {
            if (value <= threshold.min) return 'optimal';
            if (value >= threshold.max) return 'high'; // maps to out-of-bounds
            return 'low';
        }

        if (value < threshold.min) return 'low';
        if (value > threshold.max) return 'high';
        return 'optimal';
    },

    /**
     * Check if value is in critical range
     */
    isCritical(sensor, value) {
        const threshold = THRESHOLDS[sensor];
        if (!threshold) return false;

        if (threshold.reversed) {
            return value > threshold.max * 1.2;
        }

        return value < threshold.min * 0.8 || value > threshold.max * 1.2;
    }
};

module.exports = rulesService;
