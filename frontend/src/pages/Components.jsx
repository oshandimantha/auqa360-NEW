import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ActuatorControls from '../components/ActuatorControls';
import FeederControl from '../components/FeederControl';
import { useSensorContext } from '../contexts/SensorContext';
import { toggleActuator } from '../services/api';
import socketService from '../services/socket';
import {
    getCalibration,
    setEmptyLevel,
    setFullLevel,
    resetCalibration,
    getWaterLevelStatus,
    getWaterLevelLabel
} from '../utils/waterLevelCalibration';

const Components = () => {
    const {
        sensorData,
        actuatorStates,
        pumpSafety,
        systemStatus,
        rtcTime,
        updateActuatorState,
    } = useSensorContext();

    // Calibration state
    const [calibration, setCalibration] = useState(getCalibration());
    const [showCalibration, setShowCalibration] = useState(false);
    const [calibrationMessage, setCalibrationMessage] = useState('');

    // RTC Control state
    const [showRtcControl, setShowRtcControl] = useState(false);
    const [rtcMessage, setRtcMessage] = useState('');
    const [manualTime, setManualTime] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        day: new Date().getDate(),
        hour: new Date().getHours(),
        minute: new Date().getMinutes(),
        second: 0
    });

    const handleToggle = async (actuatorName, state, extraParams = {}) => {
        // Use WebSocket first for instant response
        const socketSent = socketService.toggleActuator(actuatorName, state, extraParams);

        // Fall back to HTTP API if socket is not connected
        if (!socketSent) {
            try {
                await toggleActuator(actuatorName, state, extraParams);
            } catch (error) {
                console.error('Failed to toggle actuator:', error);
                throw error;
            }
        }
    };

    // Calibration handlers
    const handleSetEmpty = () => {
        if (sensorData.waterLevel !== null) {
            setEmptyLevel(sensorData.waterLevel);
            setCalibration(getCalibration());
            setCalibrationMessage(`✅ Empty level set to ${sensorData.waterLevel} cm`);
            setTimeout(() => setCalibrationMessage(''), 3000);
        }
    };

    const handleSetFull = () => {
        if (sensorData.waterLevel !== null) {
            setFullLevel(sensorData.waterLevel);
            setCalibration(getCalibration());
            setCalibrationMessage(`✅ Full level set to ${sensorData.waterLevel} cm`);
            setTimeout(() => setCalibrationMessage(''), 3000);
        }
    };

    const handleReset = () => {
        resetCalibration();
        setCalibration(getCalibration());
        setCalibrationMessage('🔄 Calibration reset to defaults');
        setTimeout(() => setCalibrationMessage(''), 3000);
    };

    // RTC Control handlers
    const handleSetRtcTime = async () => {
        try {
            await toggleActuator('rtc', true, {
                action: 'setTime',
                ...manualTime
            });
            setRtcMessage('✅ RTC time set successfully!');
            setTimeout(() => setRtcMessage(''), 3000);
        } catch (error) {
            console.error('Failed to set RTC time:', error);
            setRtcMessage('❌ Failed to set RTC time');
            setTimeout(() => setRtcMessage(''), 3000);
        }
    };

    const handleSyncToBrowserTime = () => {
        const now = new Date();
        setManualTime({
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            second: now.getSeconds()
        });
        setRtcMessage('📋 Browser time copied to input');
        setTimeout(() => setRtcMessage(''), 2000);
    };

    const handleManualTimeChange = (field, value) => {
        setManualTime(prev => ({
            ...prev,
            [field]: parseInt(value) || 0
        }));
    };

    // Input style for RTC time fields
    const inputStyle = {
        width: '100%',
        padding: '8px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(155, 89, 182, 0.3)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '1rem',
        textAlign: 'center'
    };

    // Get water level display info
    const getWaterLevelDisplayStatus = () => {
        if (sensorData.waterLevel === null) return 'unknown';
        return getWaterLevelStatus(sensorData.waterLevel);
    };

    const getWaterLevelDisplayLabel = () => {
        if (sensorData.waterLevel === null) return 'N/A';
        return getWaterLevelLabel(sensorData.waterLevel);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'optimal': return 'var(--color-success)';
            case 'warning': return 'var(--color-warning)';
            case 'danger': return 'var(--color-danger)';
            default: return 'var(--color-gray-400)';
        }
    };

    const currentPirStatus = sensorData.pir ? 'Motion detected!' : 'No motion detected';

    // ESP32 online = connected AND last seen within 30s (via systemStatus or lastSensorUpdate)
    const esp32Online = !!(systemStatus?.esp32?.connected);

    // Water level reading — only show when ESP32 is live
    const liveWaterLevel = esp32Online ? sensorData.waterLevel : null;
    const livePir = esp32Online ? sensorData.pir : null;  // null = no data

    return (
        <div className="components-page">
            <div className="page-header">
                <h2 className="page-title">Components Control</h2>
                <p className="page-subtitle">Manage actuators and view system component status</p>
            </div>

            {/* Actuator Controls */}
            <section className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <ActuatorControls
                    actuatorStates={actuatorStates}
                    onToggle={handleToggle}
                    pumpSafety={pumpSafety}
                />
            </section>

            {/* Feeder Control with AI/Auto/Manual Mode */}
            <FeederControl
                feederState={{
                    enabled: actuatorStates.feeder,
                    autoMode: actuatorStates.feederAutoMode,
                    aiMode: actuatorStates.feederAiMode,
                    scheduleCount: actuatorStates.scheduleCount
                }}
                rtcTime={rtcTime}
                onModeChange={(isAuto, isAi) => {
                    updateActuatorState('feederAutoMode', isAuto);
                    updateActuatorState('feederAiMode', isAi || false);
                }}
            />

            {/* Status Components */}
            <section className="components-status">
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Component Status</h3>
                <div className="sensor-grid">
                    {/* PIR Status */}
                    <div className="sensor-card">
                        <div className="sensor-icon">👁️</div>
                        <div className="sensor-label">PIR Status</div>
                        {esp32Online ? (
                            <>
                                <div className="sensor-value" style={{
                                    fontSize: '1.5rem',
                                    color: livePir ? 'var(--color-warning)' : 'var(--color-gray-400)'
                                }}>
                                    {livePir ? 'Active' : 'Inactive'}
                                </div>
                                <div style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-gray-400)', fontSize: '0.9rem' }}>
                                    {livePir ? 'Motion detected!' : 'No motion detected'}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="sensor-value" style={{ fontSize: '1.5rem', color: 'var(--color-gray-600)' }}>--</div>
                                <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    📡 ESP32 Offline
                                </div>
                            </>
                        )}
                    </div>

                    {/* Water Level - Custom display with calibration */}
                    <div className="sensor-card">
                        <div className="sensor-icon">💧</div>
                        <div className="sensor-label">Water Level</div>
                        {esp32Online && liveWaterLevel !== null ? (
                            <>
                                <div className="sensor-value" style={{
                                    fontSize: '2rem',
                                    color: getStatusColor(getWaterLevelDisplayStatus())
                                }}>
                                    {liveWaterLevel.toFixed(1)} cm
                                </div>
                                <div style={{
                                    marginTop: 'var(--spacing-sm)',
                                    padding: '4px 12px',
                                    borderRadius: '12px',
                                    background: getStatusColor(getWaterLevelDisplayStatus()),
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    display: 'inline-block'
                                }}>
                                    {getWaterLevelDisplayLabel()}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="sensor-value" style={{ fontSize: '2rem', color: 'var(--color-gray-600)' }}>--</div>
                                <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                                    📡 ESP32 Offline
                                </div>
                                {calibration.calibrated && (
                                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                                        ✅ Calibration saved (Full: {calibration.fullLevel}cm / Empty: {calibration.emptyLevel}cm)
                                    </div>
                                )}
                            </>
                        )}
                        <button
                            onClick={() => setShowCalibration(!showCalibration)}
                            style={{
                                marginTop: 'var(--spacing-md)',
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '6px',
                                color: 'var(--color-gray-300)',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            ⚙️ {showCalibration ? 'Hide' : 'Calibrate'}
                        </button>
                    </div>
                </div>
            </section>

            {/* Water Level Calibration Panel */}
            {showCalibration && (
                <section className="card" style={{
                    marginTop: 'var(--spacing-lg)',
                    background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(155, 89, 182, 0.1))',
                    border: '1px solid rgba(52, 152, 219, 0.3)'
                }}>
                    <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔧 Water Level Calibration
                    </h3>
                    <p style={{ color: 'var(--color-gray-400)', marginBottom: 'var(--spacing-lg)', fontSize: '0.9rem' }}>
                        Calibrate the water level sensor to match your tank depth.
                        Make sure the tank is at the desired level before clicking each button.
                    </p>

                    {/* Current Reading */}
                    <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: 'var(--spacing-md)',
                        borderRadius: 'var(--border-radius-md)',
                        marginBottom: 'var(--spacing-lg)',
                        textAlign: 'center'
                    }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem', marginBottom: '4px' }}>
                            Current Sensor Reading
                        </p>
                        <p style={{ fontSize: '2rem', fontWeight: '700', color: esp32Online ? 'var(--color-primary)' : 'var(--color-gray-600)' }}>
                            {esp32Online && liveWaterLevel !== null ? `${liveWaterLevel.toFixed(1)} cm` : '—'}
                        </p>
                        {!esp32Online && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                                📡 Connect ESP32 to capture a live reading
                            </p>
                        )}
                    </div>

                    {/* Calibration Buttons */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <button
                            onClick={handleSetFull}
                            disabled={!esp32Online || liveWaterLevel === null}
                            title={!esp32Online ? 'ESP32 must be online to calibrate' : 'Click when tank is FULL'}
                            style={{
                                padding: 'var(--spacing-md)',
                                background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                                border: 'none',
                                borderRadius: 'var(--border-radius-md)',
                                color: '#fff',
                                cursor: (esp32Online && liveWaterLevel !== null) ? 'pointer' : 'not-allowed',
                                opacity: (esp32Online && liveWaterLevel !== null) ? 1 : 0.4,
                                fontWeight: '600',
                                fontSize: '0.9rem'
                            }}
                        >
                            🟢 Set as FULL
                            <br />
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                (Saved: {calibration.fullLevel} cm)
                            </span>
                        </button>

                        <button
                            onClick={handleSetEmpty}
                            disabled={!esp32Online || liveWaterLevel === null}
                            title={!esp32Online ? 'ESP32 must be online to calibrate' : 'Click when tank is EMPTY'}
                            style={{
                                padding: 'var(--spacing-md)',
                                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                                border: 'none',
                                borderRadius: 'var(--border-radius-md)',
                                color: '#fff',
                                cursor: (esp32Online && liveWaterLevel !== null) ? 'pointer' : 'not-allowed',
                                opacity: (esp32Online && liveWaterLevel !== null) ? 1 : 0.4,
                                fontWeight: '600',
                                fontSize: '0.9rem'
                            }}
                        >
                            🔴 Set as EMPTY
                            <br />
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                (Saved: {calibration.emptyLevel} cm)
                            </span>
                        </button>

                        <button
                            onClick={handleReset}
                            style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: 'var(--border-radius-md)',
                                color: 'var(--color-gray-300)',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '0.9rem'
                            }}
                        >
                            🔄 Reset to Default
                        </button>
                    </div>

                    {/* Calibration Message */}
                    {calibrationMessage && (
                        <div style={{
                            padding: 'var(--spacing-sm) var(--spacing-md)',
                            background: 'rgba(46, 204, 113, 0.2)',
                            border: '1px solid rgba(46, 204, 113, 0.5)',
                            borderRadius: 'var(--border-radius-md)',
                            color: '#2ecc71',
                            textAlign: 'center',
                            marginBottom: 'var(--spacing-md)'
                        }}>
                            {calibrationMessage}
                        </div>
                    )}

                    {/* Current Calibration Info */}
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: 'var(--spacing-md)',
                        borderRadius: 'var(--border-radius-md)',
                        fontSize: '0.85rem'
                    }}>
                        <p style={{ fontWeight: '600', marginBottom: 'var(--spacing-sm)' }}>
                            📊 Current Calibration:
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-sm)', color: 'var(--color-gray-300)' }}>
                            <div>
                                <span style={{ color: '#2ecc71' }}>🟢 Full:</span> ≤ {calibration.fullLevel} cm
                            </div>
                            <div>
                                <span style={{ color: '#f39c12' }}>🟡 Medium:</span> {calibration.fullLevel} - {((calibration.emptyLevel + calibration.fullLevel) / 2).toFixed(1)} cm
                            </div>
                            <div>
                                <span style={{ color: '#e74c3c' }}>🔴 Empty:</span> ≥ {calibration.emptyLevel} cm
                            </div>
                        </div>
                        <p style={{ marginTop: 'var(--spacing-sm)', color: 'var(--color-gray-500)', fontSize: '0.8rem' }}>
                            {calibration.calibrated ? '✅ Calibrated' : '⚠️ Using default values'}
                        </p>
                    </div>
                </section>
            )}

            {/* System Info */}
            <section className="card" style={{ marginTop: 'var(--spacing-xl)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>System Information</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--spacing-md)'
                }}>
                    <div style={{
                        padding: 'var(--spacing-md)',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--border-radius-md)'
                    }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem' }}>ESP32 Status</p>
                        <p style={{
                            color: systemStatus.esp32?.connected ? 'var(--color-success)' : 'var(--color-danger)',
                            fontWeight: '600'
                        }}>
                            {systemStatus.esp32?.connected ? '🟢 Online' : '🔴 Offline'}
                        </p>
                        {systemStatus.esp32?.timeSinceLastSeen !== null && systemStatus.esp32?.timeSinceLastSeen !== undefined && (
                            <p style={{ color: 'var(--color-gray-500)', fontSize: '0.7rem', marginTop: '4px' }}>
                                Last seen: {systemStatus.esp32.timeSinceLastSeen}s ago
                            </p>
                        )}
                    </div>
                    <div style={{
                        padding: 'var(--spacing-md)',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--border-radius-md)'
                    }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem' }}>Raspberry Pi / Laptop</p>
                        <p style={{
                            color: systemStatus.raspberryPi?.connected ? 'var(--color-success)' : 'var(--color-danger)',
                            fontWeight: '600'
                        }}>
                            {systemStatus.raspberryPi?.connected ? '🟢 Online' : '🔴 Offline'}
                        </p>
                        {systemStatus.raspberryPi?.timeSinceLastSeen !== null && systemStatus.raspberryPi?.timeSinceLastSeen !== undefined && (
                            <p style={{ color: 'var(--color-gray-500)', fontSize: '0.7rem', marginTop: '4px' }}>
                                Last seen: {systemStatus.raspberryPi.timeSinceLastSeen}s ago
                            </p>
                        )}
                    </div>
                    <div style={{
                        padding: 'var(--spacing-md)',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--border-radius-md)'
                    }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem' }}>MQTT Broker</p>
                        <p style={{
                            color: systemStatus.mqtt?.connected ? 'var(--color-success)' : 'var(--color-danger)',
                            fontWeight: '600'
                        }}>
                            {systemStatus.mqtt?.connected ? '🟢 Connected' : '🔴 Disconnected'}
                        </p>
                    </div>
                    <div style={{
                        padding: 'var(--spacing-md)',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: 'var(--border-radius-md)'
                    }}>
                        <p style={{ color: 'var(--color-gray-400)', fontSize: '0.8rem' }}>YOLO Model</p>
                        <p style={{
                            color: systemStatus.yolo?.running ? 'var(--color-success)' : 'var(--color-danger)',
                            fontWeight: '600'
                        }}>
                            {systemStatus.yolo?.running ? '🟢 Running' : '🔴 Not Running'}
                        </p>
                        {systemStatus.yolo?.timeSinceLastDetection !== null && systemStatus.yolo?.timeSinceLastDetection !== undefined && (
                            <p style={{ color: 'var(--color-gray-500)', fontSize: '0.7rem', marginTop: '4px' }}>
                                Last detection: {systemStatus.yolo.timeSinceLastDetection}s ago
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <Link to="/" className="btn-back">
                ← Back to Home
            </Link>
        </div>
    );
};

export default Components;
