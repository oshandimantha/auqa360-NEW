/**
 * Analytics Service
 * Statistical calculations for reports
 */

const analyticsService = {
    /**
     * Calculate statistics for sensor readings
     */
    calculateSensorStats(readings) {
        if (!readings || readings.length === 0) {
            return {
                count: 0,
                temperature: null,
                ph: null,
                turbidity: null,
                tds: null,
                co2: null,
                waterLevel: null
            };
        }

        const stats = {
            count: readings.length,
            temperature: this.calculateFieldStats(readings, 'temperature'),
            ph: this.calculateFieldStats(readings, 'ph'),
            turbidity: this.calculateFieldStats(readings, 'turbidity'),
            tds: this.calculateFieldStats(readings, 'tds'),
            co2: this.calculateFieldStats(readings, 'co2'),
            waterLevel: this.calculateFieldStats(readings, 'waterLevel')
        };

        return stats;
    },

    /**
     * Calculate stats for a single field
     */
    calculateFieldStats(readings, field) {
        const values = readings
            .map(r => r[field])
            .filter(v => v !== null && v !== undefined && !isNaN(v));

        if (values.length === 0) {
            return { avg: null, min: null, max: null, count: 0 };
        }

        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return {
            avg: parseFloat(avg.toFixed(2)),
            min: parseFloat(min.toFixed(2)),
            max: parseFloat(max.toFixed(2)),
            count: values.length
        };
    },

    /**
     * Calculate detection statistics
     */
    calculateDetectionStats(detections) {
        if (!detections || detections.length === 0) {
            return {
                count: 0,
                avgFishCount: 0,
                maxFishCount: 0,
                avgFps: 0,
                abnormalCount: 0,
                statusBreakdown: {}
            };
        }

        const fishCounts = detections.map(d => d.fishCount || 0);
        const fpsValues = detections.map(d => d.fps || 0).filter(v => v > 0);

        const abnormalCount = detections.filter(d =>
            d.abnormalBehavior && d.abnormalBehavior !== 'None detected'
        ).length;

        const statusBreakdown = {
            normal: detections.filter(d => d.status === 'normal').length,
            warning: detections.filter(d => d.status === 'warning').length,
            critical: detections.filter(d => d.status === 'critical').length
        };

        return {
            count: detections.length,
            avgFishCount: parseFloat((fishCounts.reduce((a, b) => a + b, 0) / fishCounts.length).toFixed(1)),
            maxFishCount: Math.max(...fishCounts),
            avgFps: fpsValues.length > 0
                ? parseFloat((fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length).toFixed(1))
                : 0,
            abnormalCount,
            statusBreakdown
        };
    },

    /**
     * Generate time-series data for charts
     */
    generateTimeSeries(readings, field, interval = 'hour') {
        if (!readings || readings.length === 0) {
            return [];
        }

        const grouped = new Map();

        readings.forEach(reading => {
            const date = new Date(reading.timestamp);
            let key;

            switch (interval) {
                case 'minute':
                    key = `${date.getHours()}:${Math.floor(date.getMinutes() / 5) * 5}`;
                    break;
                case 'hour':
                    key = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
                    break;
                case 'day':
                    key = `${date.getMonth() + 1}/${date.getDate()}`;
                    break;
                default:
                    key = date.toISOString();
            }

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }

            if (reading[field] !== null && reading[field] !== undefined) {
                grouped.get(key).push(reading[field]);
            }
        });

        const series = [];
        grouped.forEach((values, key) => {
            if (values.length > 0) {
                const avg = values.reduce((a, b) => a + b, 0) / values.length;
                series.push({
                    time: key,
                    value: parseFloat(avg.toFixed(2))
                });
            }
        });

        return series;
    },

    /**
     * Calculate moving average
     */
    calculateMovingAverage(values, windowSize = 5) {
        if (values.length < windowSize) {
            return values;
        }

        const result = [];
        for (let i = 0; i <= values.length - windowSize; i++) {
            const window = values.slice(i, i + windowSize);
            const avg = window.reduce((a, b) => a + b, 0) / windowSize;
            result.push(parseFloat(avg.toFixed(2)));
        }

        return result;
    }
};

module.exports = analyticsService;
