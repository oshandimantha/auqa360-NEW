// Sensor thresholds for status determination
export const THRESHOLDS = {
    temperature: {
        min: 24,
        max: 30,
        unit: '°C',
        icon: '🌡️',
        label: 'Temperature'
    },
    ph: {
        min: 6.5,
        max: 8.5,
        unit: '',
        icon: '🧪',
        label: 'pH Level'
    },
    turbidity: {
        min: 0,
        max: 50,
        unit: 'NTU',
        icon: '🌊',
        label: 'Turbidity'
    },
    tds: {
        min: 100,
        max: 500,
        unit: 'ppm',
        icon: '💧',
        label: 'TDS'
    },
    co2: {
        min: 350,
        max: 1000,
        unit: 'ppm',
        icon: '🌿',
        label: 'CO2 Level'
    },
    waterLevel: {
        min: 5,      // Full tank: water close to sensor (~5cm)
        max: 15,     // Empty tank: water far from sensor (>15cm)
        unit: 'cm',
        icon: '💧',
        label: 'Water Level',
        reversed: true  // Lower value = better (full tank)
    }
};

// Get status based on value and thresholds
export const getStatus = (sensorType, value) => {
    const threshold = THRESHOLDS[sensorType];
    if (!threshold) return 'unknown';

    // For water level (reversed logic):
    // - Low distance (close to sensor) = Full tank = optimal
    // - High distance (far from sensor) = Empty tank = danger
    if (threshold.reversed) {
        if (value <= threshold.min) return 'optimal';  // Full tank
        if (value >= threshold.max) return 'danger';   // Empty tank
        return 'warning';  // Getting low
    }

    // Normal logic for other sensors
    if (value < threshold.min) return 'warning';
    if (value > threshold.max) return 'danger';
    return 'optimal';
};

// Get status label
export const getStatusLabel = (sensorType, value) => {
    const threshold = THRESHOLDS[sensorType];
    const status = getStatus(sensorType, value);

    // Special labels for water level
    if (threshold?.reversed) {
        switch (status) {
            case 'optimal':
                return 'Full';
            case 'warning':
                return 'Medium';
            case 'danger':
                return 'Low';
            default:
                return 'Unknown';
        }
    }

    // Default labels for other sensors
    switch (status) {
        case 'optimal':
            return 'Optimal';
        case 'warning':
            return 'Low';
        case 'danger':
            return 'High';
        default:
            return 'Unknown';
    }
};

// Actuator configurations (Feeder is handled by dedicated FeederControl component)
export const ACTUATORS = {
    oxygenPump: {
        icon: '💨',
        label: 'Oxygen Pump',
        description: 'Auto: ON ≥30%, OFF <30%',
        hasSafety: true,
        safetyMessage: 'Cannot turn ON when water level is below 30%'
    }
};

// Chart colors for sensors
export const CHART_COLORS = {
    temperature: {
        line: '#e74c3c',
        background: 'rgba(231, 76, 60, 0.1)'
    },
    ph: {
        line: '#9b59b6',
        background: 'rgba(155, 89, 182, 0.1)'
    },
    turbidity: {
        line: '#3498db',
        background: 'rgba(52, 152, 219, 0.1)'
    },
    tds: {
        line: '#1abc9c',
        background: 'rgba(26, 188, 156, 0.1)'
    },
    co2: {
        line: '#27ae60',
        background: 'rgba(39, 174, 96, 0.1)'
    }
};
