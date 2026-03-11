import React, { useState, useEffect } from 'react';
import { THRESHOLDS, getStatus } from '../utils/thresholds';
import { formatValue, formatRelativeTime } from '../utils/format';

const SensorCard = ({
    sensorType,
    value,
    customIcon = null,
    customLabel = null,
    customUnit = null,
    showStatus = true,
    onClick = null,
    timestamp = null
}) => {
    const threshold = THRESHOLDS[sensorType] || {};
    const icon = customIcon || threshold.icon || '📊';
    const label = customLabel || threshold.label || sensorType;
    const unit = customUnit !== null ? customUnit : (threshold.unit || '');
    const status = getStatus(sensorType, value);

    // Live-ticking relative time (re-render every 30s)
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!timestamp) return;
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, [timestamp]);

    const getStatusLabel = () => {
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

    return (
        <div
            className={`sensor-card ${onClick ? 'clickable' : ''}`}
            onClick={onClick}
            style={onClick ? { cursor: 'pointer' } : {}}
        >
            <div className="sensor-icon">{icon}</div>
            <div className="sensor-label">{label}</div>
            <div className="sensor-value">
                {formatValue(value)}
                {unit && <span className="sensor-unit">{unit}</span>}
            </div>
            {showStatus && value !== null && value !== undefined && (
                <div className={`sensor-status ${status}`}>
                    {getStatusLabel()}
                </div>
            )}
            {timestamp && (
                <div className="sensor-timestamp">
                    🕐 {formatRelativeTime(timestamp)}
                </div>
            )}
        </div>
    );
};

export default SensorCard;
