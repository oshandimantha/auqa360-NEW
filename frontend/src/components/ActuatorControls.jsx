import React, { useState, useEffect } from 'react';
import { ACTUATORS } from '../utils/thresholds';
import socketService from '../services/socket';

const ActuatorControls = ({ actuatorStates = {}, onToggle, pumpSafety = {} }) => {
    const [localStates, setLocalStates] = useState(actuatorStates);
    const [loading, setLoading] = useState({});
    const [pumpAutoMode, setPumpAutoMode] = useState(actuatorStates.pumpAutoMode ?? true);

    useEffect(() => {
        setLocalStates(actuatorStates);
        if (actuatorStates.pumpAutoMode !== undefined) {
            setPumpAutoMode(actuatorStates.pumpAutoMode);
        }
    }, [actuatorStates]);

    // Switch pump mode (Auto <-> Manual) via WebSocket instantly
    const handlePumpModeSwitch = (isAuto) => {
        setPumpAutoMode(isAuto);

        // Send mode change via WebSocket (instant)
        socketService.sendCommand('control', {
            type: 'actuator',
            name: 'oxygenPump',
            state: isAuto,
            action: 'setMode'
        });
    };

    const handleToggle = async (actuatorName, newState) => {
        // In auto mode, pump toggle is disabled
        if (actuatorName === 'oxygenPump' && pumpAutoMode) {
            return;
        }

        // Check safety restrictions for oxygen pump in manual mode
        if (actuatorName === 'oxygenPump' && newState === true) {
            if (pumpSafety.blocked || (pumpSafety.waterPercent < pumpSafety.minLevel)) {
                console.warn('Cannot turn on pump - water level too low');
                return;
            }
        }

        // Update local state optimistically — instant UI response
        setLocalStates(prev => ({ ...prev, [actuatorName]: newState }));

        // Try WebSocket first (instant), fall back to HTTP
        const socketSent = socketService.toggleActuator(actuatorName, newState);

        if (!socketSent) {
            // Socket not connected — use HTTP as fallback
            setLoading(prev => ({ ...prev, [actuatorName]: true }));
            try {
                if (onToggle) {
                    await onToggle(actuatorName, newState);
                }
            } catch (error) {
                // Revert on error
                setLocalStates(prev => ({ ...prev, [actuatorName]: !newState }));
                console.error('Failed to toggle actuator:', error);
            } finally {
                setLoading(prev => ({ ...prev, [actuatorName]: false }));
            }
        }
    };

    // Handle action (e.g., "Feed Now" trigger)
    const handleAction = async (actuatorName, action) => {
        // Check if feeder is enabled before triggering
        if (actuatorName === 'feeder' && !localStates.feeder) {
            console.warn('Feeder is disabled - enable it first');
            return;
        }

        // Try WebSocket first (instant)
        const socketSent = socketService.toggleActuator(actuatorName, true, { action });

        if (!socketSent) {
            // Socket not connected — use HTTP as fallback
            setLoading(prev => ({ ...prev, [`${actuatorName}_action`]: true }));
            try {
                if (onToggle) {
                    await onToggle(actuatorName, true, { action });
                }
            } catch (error) {
                console.error('Failed to trigger action:', error);
            } finally {
                setLoading(prev => ({ ...prev, [`${actuatorName}_action`]: false }));
            }
        }
    };

    // Check if oxygen pump toggle should be disabled
    const isPumpBlocked = (key) => {
        if (key === 'oxygenPump') {
            // In auto mode, manual toggle is disabled
            if (pumpAutoMode) return false; // Not "blocked" — just auto-controlled

            const isOn = localStates[key] || false;
            // Block turning ON if water too low (turning OFF is always allowed)
            if (!isOn && pumpSafety.blocked) return true;
            if (!isOn && pumpSafety.waterPercent < pumpSafety.minLevel) return true;
        }
        return false;
    };

    return (
        <div className="actuator-controls">
            <h3>Component Controls</h3>
            <div className="control-grid">
                {Object.entries(ACTUATORS).map(([key, config]) => {
                    const isOn = localStates[key] || false;
                    const isLoading = loading[key] || false;
                    const isBlocked = isPumpBlocked(key);
                    const showSafetyWarning = key === 'oxygenPump' && isBlocked;
                    const isPumpComponent = key === 'oxygenPump';

                    return (
                        <div
                            key={key}
                            className={`control-card ${isBlocked ? 'blocked' : ''}`}
                            data-component={key}
                        >
                            <div className="control-header">
                                <div className="control-icon">{config.icon}</div>
                                <div className="control-label">{config.label}</div>
                            </div>

                            <div className="control-status">
                                <span
                                    className="status-indicator"
                                    style={{
                                        color: isOn ? 'var(--color-success)' :
                                            isBlocked ? 'var(--color-danger)' :
                                                'var(--color-gray-600)',
                                    }}
                                >
                                    ●
                                </span>
                                <span>
                                    {isOn ? 'ON' : isBlocked ? 'BLOCKED' : 'OFF'}
                                </span>
                            </div>

                            {/* Pump Auto/Manual Mode Toggle */}
                            {isPumpComponent && (
                                <div className="mode-toggle-container">
                                    <button
                                        className={`mode-btn ${pumpAutoMode ? 'active' : ''}`}
                                        onClick={() => handlePumpModeSwitch(true)}
                                    >
                                        🤖 Auto Mode
                                    </button>
                                    <button
                                        className={`mode-btn ${!pumpAutoMode ? 'active' : ''}`}
                                        onClick={() => handlePumpModeSwitch(false)}
                                    >
                                        🔧 Manual Mode
                                    </button>
                                </div>
                            )}

                            {/* Auto mode info */}
                            {isPumpComponent && pumpAutoMode && (
                                <div className="auto-mode-info">
                                    ⚡ Auto: ON ≥30% / OFF &lt;30%
                                    <br />
                                    <small style={{ color: 'var(--color-gray-500)' }}>
                                        Water: {pumpSafety.waterPercent?.toFixed(0)}%
                                    </small>
                                </div>
                            )}

                            {/* Safety warning for oxygen pump (manual mode) */}
                            {showSafetyWarning && (
                                <div className="safety-warning">
                                    ⚠️ Water level too low ({pumpSafety.waterPercent?.toFixed(0)}%)
                                    <br />
                                    <small>Min {pumpSafety.minLevel}% required</small>
                                </div>
                            )}

                            {/* Water level indicator for pump */}
                            {isPumpComponent && pumpSafety.waterPercent !== undefined && (
                                <div className="water-level-bar">
                                    <div
                                        className="water-level-fill"
                                        style={{
                                            width: `${Math.min(100, Math.max(0, pumpSafety.waterPercent))}%`,
                                            background: pumpSafety.waterPercent >= 30 ?
                                                'var(--color-success)' :
                                                'var(--color-danger)'
                                        }}
                                    />
                                    <span className="water-level-text">
                                        💧 {pumpSafety.waterPercent?.toFixed(0)}%
                                    </span>
                                </div>
                            )}

                            {/* Toggle switch — disabled in auto mode for pump */}
                            <label className={`toggle-switch ${isLoading ? 'loading' : ''} ${(isBlocked || (isPumpComponent && pumpAutoMode)) ? 'disabled' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={isOn}
                                    onChange={(e) => handleToggle(key, e.target.checked)}
                                    disabled={isLoading || isBlocked || (isPumpComponent && pumpAutoMode)}
                                />
                                <span className="toggle-slider"></span>
                            </label>

                            {/* Action button (e.g., Feed Now) */}
                            {config.hasAction && (
                                <button
                                    className={`action-button ${loading[`${key}_action`] ? 'loading' : ''} ${!isOn ? 'disabled' : ''}`}
                                    onClick={() => handleAction(key, 'trigger')}
                                    disabled={loading[`${key}_action`] || !isOn}
                                    title={!isOn ? 'Enable feeder first' : config.actionDescription}
                                >
                                    {loading[`${key}_action`] ? '🔄 Feeding...' : config.actionLabel}
                                </button>
                            )}

                            {config.description && (
                                <div className="control-desc">
                                    {isPumpComponent && pumpAutoMode
                                        ? 'Auto: ON ≥30%, OFF <30%'
                                        : isPumpComponent && !pumpAutoMode
                                            ? 'Manual: toggle ON above 30%'
                                            : config.description
                                    }
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
        .actuator-controls h3 {
          margin-bottom: var(--spacing-lg);
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .toggle-switch.loading {
          opacity: 0.5;
          pointer-events: none;
        }
        
        .toggle-switch.disabled {
          opacity: 0.4;
          pointer-events: none;
        }
        
        .control-card.blocked {
          border-color: var(--color-danger) !important;
          background: rgba(231, 76, 60, 0.1) !important;
        }
        
        .control-status {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 0.9rem;
          color: var(--color-gray-400);
          margin-bottom: var(--spacing-sm);
        }
        
        .status-indicator {
          font-size: 1.2rem;
        }
        
        .mode-toggle-container {
          display: flex;
          gap: 4px;
          margin-bottom: var(--spacing-sm);
          border-radius: 8px;
          overflow: hidden;
          background: rgba(0,0,0,0.2);
        }
        
        .mode-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--color-gray-400);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        
        .mode-btn.active {
          background: var(--color-primary);
          color: white;
          font-weight: 600;
        }
        
        .mode-btn:hover:not(.active) {
          background: rgba(255,255,255,0.05);
        }
        
        .auto-mode-info {
          background: rgba(39, 174, 96, 0.15);
          border: 1px solid rgba(39, 174, 96, 0.3);
          border-radius: var(--border-radius-sm);
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: 0.75rem;
          color: #27ae60;
          margin-bottom: var(--spacing-sm);
          text-align: center;
        }

        .safety-warning {
          background: rgba(231, 76, 60, 0.2);
          border: 1px solid rgba(231, 76, 60, 0.5);
          border-radius: var(--border-radius-sm);
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: 0.75rem;
          color: #e74c3c;
          margin-bottom: var(--spacing-sm);
          text-align: center;
        }
        
        .water-level-bar {
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
          height: 20px;
          margin-bottom: var(--spacing-sm);
          position: relative;
          overflow: hidden;
        }
        
        .water-level-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease, background 0.3s ease;
        }
        
        .water-level-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.7rem;
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        
        .control-desc {
          font-size: 0.7rem;
          color: var(--color-gray-500);
          margin-top: var(--spacing-xs);
          text-align: center;
        }
      `}</style>
        </div>
    );
};

export default ActuatorControls;
