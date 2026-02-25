import React, { useState, useEffect } from 'react';
import {
    getFeedingSchedules,
    createFeedingSchedule,
    updateFeedingSchedule,
    deleteFeedingSchedule,
    toggleActuator,
    getLatestFishFeeding
} from '../services/api';
import socketService from '../services/socket';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Feeding level colors and icons
const FEEDING_STYLES = {
    0: { color: '#e74c3c', icon: '⛔', bg: 'rgba(231, 76, 60, 0.15)', border: 'rgba(231, 76, 60, 0.3)' },
    1: { color: '#f39c12', icon: '🍽️', bg: 'rgba(243, 156, 18, 0.15)', border: 'rgba(243, 156, 18, 0.3)' },
    2: { color: '#27ae60', icon: '✅', bg: 'rgba(39, 174, 96, 0.15)', border: 'rgba(39, 174, 96, 0.3)' }
};

const FeederControl = ({ feederState = {}, rtcTime, onModeChange }) => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [message, setMessage] = useState('');
    const [feedLoading, setFeedLoading] = useState(false);
    const [feedingPrediction, setFeedingPrediction] = useState(null);

    // Feeder mode: 'ai' | 'auto' | 'manual'
    const currentMode = feederState.aiMode ? 'ai' : (feederState.autoMode ? 'auto' : 'manual');

    // New schedule form state
    const [formData, setFormData] = useState({
        name: '',
        days: [],
        hour: 8,
        minute: 0,
        enabled: true
    });

    // Fetch schedules on mount
    useEffect(() => {
        fetchSchedules();
        fetchLatestPrediction();

        // Subscribe to AI feeding predictions
        const unsubFeeding = socketService.subscribe('fish-feeding-prediction', (data) => {
            setFeedingPrediction(data);
        });

        return () => {
            unsubFeeding();
        };
    }, []);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const data = await getFeedingSchedules();
            setSchedules(data);
        } catch (error) {
            console.error('Failed to fetch schedules:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLatestPrediction = async () => {
        const data = await getLatestFishFeeding();
        if (data && data.feedingLevel !== null) {
            setFeedingPrediction(data);
        }
    };

    const handleModeToggle = async (mode) => {
        // Optimistic update — change UI instantly, don't wait for MQTT round-trip
        if (mode === 'ai') {
            if (onModeChange) onModeChange(false, true);
        } else if (mode === 'auto') {
            if (onModeChange) onModeChange(true, false);
        } else {
            if (onModeChange) onModeChange(false, false);
        }

        // Fire-and-forget API call in the background
        try {
            if (mode === 'ai') {
                await toggleActuator('feeder', true, { action: 'setMode', mode: 'ai' });
            } else if (mode === 'auto') {
                await toggleActuator('feeder', true, { action: 'setMode' });
            } else {
                await toggleActuator('feeder', false, { action: 'setMode' });
            }
        } catch (error) {
            console.error('Mode toggle failed:', error);
            setMessage('❌ Failed to change mode — retrying...');
            setTimeout(() => setMessage(''), 2000);
        }
    };

    const handleFeedNow = async () => {
        if (currentMode !== 'manual') {
            setMessage(`⚠️ Cannot manual feed in ${currentMode === 'ai' ? 'AI' : 'Auto'} mode`);
            setTimeout(() => setMessage(''), 2000);
            return;
        }

        setFeedLoading(true);
        try {
            await toggleActuator('feeder', true, { action: 'trigger' });
            setMessage('🍽️ Feed triggered!');
            setTimeout(() => setMessage(''), 2000);
        } catch (error) {
            setMessage('❌ Failed to trigger feed');
            setTimeout(() => setMessage(''), 2000);
        } finally {
            setFeedLoading(false);
        }
    };

    const handleSaveSchedule = async () => {
        if (formData.days.length === 0) {
            setMessage('⚠️ Select at least one day');
            setTimeout(() => setMessage(''), 2000);
            return;
        }

        try {
            if (editingSchedule) {
                await updateFeedingSchedule(editingSchedule._id, formData);
                setMessage('✅ Schedule updated');
            } else {
                await createFeedingSchedule(formData);
                setMessage('✅ Schedule created');
            }

            setShowAddModal(false);
            setEditingSchedule(null);
            resetForm();
            fetchSchedules();
            setTimeout(() => setMessage(''), 2000);
        } catch (error) {
            console.error('Schedule save error:', error);
            const errMsg = error.response?.data?.error || error.message || 'Unknown error';
            setMessage(`❌ Failed: ${errMsg}`);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleDeleteSchedule = async (id) => {
        if (!window.confirm('Delete this schedule?')) return;

        try {
            await deleteFeedingSchedule(id);
            setMessage('✅ Schedule deleted');
            fetchSchedules();
            setTimeout(() => setMessage(''), 2000);
        } catch (error) {
            setMessage('❌ Failed to delete schedule');
            setTimeout(() => setMessage(''), 2000);
        }
    };

    const handleEditSchedule = (schedule) => {
        setEditingSchedule(schedule);
        setFormData({
            name: schedule.name,
            days: schedule.days,
            hour: schedule.hour,
            minute: schedule.minute,
            enabled: schedule.enabled
        });
        setShowAddModal(true);
    };

    const toggleDay = (dayIndex) => {
        setFormData(prev => ({
            ...prev,
            days: prev.days.includes(dayIndex)
                ? prev.days.filter(d => d !== dayIndex)
                : [...prev.days, dayIndex].sort()
        }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            days: [],
            hour: 8,
            minute: 0,
            enabled: true
        });
    };

    const formatTime = (hour, minute) => {
        const h = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
    };

    const formatDays = (days) => {
        if (days.length === 7) return 'Every day';
        if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
        if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
        return days.map(d => DAY_NAMES[d]).join(', ');
    };

    const inputStyle = {
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(243, 156, 18, 0.3)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '1rem'
    };

    const buttonStyle = {
        padding: '10px 20px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s ease'
    };

    return (
        <section className="card" style={{
            marginTop: 'var(--spacing-lg)',
            background: 'linear-gradient(135deg, rgba(243, 156, 18, 0.1), rgba(230, 126, 34, 0.1))',
            border: '1px solid rgba(243, 156, 18, 0.3)'
        }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--spacing-lg)' }}>
                🍽️ Feeder Control
            </h3>

            {/* 3-Mode Toggle: AI / Auto / Manual */}
            <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: 'var(--spacing-lg)',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '10px',
                padding: '4px'
            }}>
                <button
                    onClick={() => handleModeToggle('ai')}
                    style={{
                        ...buttonStyle,
                        flex: 1,
                        padding: '10px 8px',
                        background: currentMode === 'ai'
                            ? 'linear-gradient(135deg, #9b59b6, #8e44ad)'
                            : 'transparent',
                        color: currentMode === 'ai' ? '#fff' : 'var(--color-gray-400)',
                        border: 'none',
                        fontSize: '0.85rem'
                    }}
                >
                    🧠 AI Mode
                </button>
                <button
                    onClick={() => handleModeToggle('auto')}
                    style={{
                        ...buttonStyle,
                        flex: 1,
                        padding: '10px 8px',
                        background: currentMode === 'auto'
                            ? 'linear-gradient(135deg, #f39c12, #e67e22)'
                            : 'transparent',
                        color: currentMode === 'auto' ? '#fff' : 'var(--color-gray-400)',
                        border: 'none',
                        fontSize: '0.85rem'
                    }}
                >
                    🤖 Auto Mode
                </button>
                <button
                    onClick={() => handleModeToggle('manual')}
                    style={{
                        ...buttonStyle,
                        flex: 1,
                        padding: '10px 8px',
                        background: currentMode === 'manual'
                            ? 'linear-gradient(135deg, #3498db, #2980b9)'
                            : 'transparent',
                        color: currentMode === 'manual' ? '#fff' : 'var(--color-gray-400)',
                        border: 'none',
                        fontSize: '0.85rem'
                    }}
                >
                    ✋ Manual
                </button>
            </div>

            {/* AI Feeding Prediction Display */}
            {currentMode === 'ai' && (
                <div style={{
                    background: feedingPrediction
                        ? (FEEDING_STYLES[feedingPrediction.feedingLevel]?.bg || 'rgba(0,0,0,0.2)')
                        : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${feedingPrediction
                        ? (FEEDING_STYLES[feedingPrediction.feedingLevel]?.border || 'rgba(255,255,255,0.1)')
                        : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 'var(--border-radius-md)',
                    padding: 'var(--spacing-md)',
                    marginBottom: 'var(--spacing-lg)',
                    textAlign: 'center'
                }}>
                    {feedingPrediction ? (
                        <>
                            <div style={{
                                fontSize: '2rem',
                                marginBottom: '8px'
                            }}>
                                {FEEDING_STYLES[feedingPrediction.feedingLevel]?.icon || '❓'}
                            </div>
                            <div style={{
                                fontSize: '1.3rem',
                                fontWeight: 700,
                                color: FEEDING_STYLES[feedingPrediction.feedingLevel]?.color || '#fff',
                                marginBottom: '8px'
                            }}>
                                {feedingPrediction.feedingLabel}
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '6px',
                                fontSize: '0.8rem',
                                color: 'var(--color-gray-400)',
                                marginBottom: '8px'
                            }}>
                                <span>pH: <strong style={{ color: '#fff' }}>{feedingPrediction.sensorValues?.ph?.toFixed(1)}</strong></span>
                                <span>TDS: <strong style={{ color: '#fff' }}>{feedingPrediction.sensorValues?.tds?.toFixed(0)}</strong></span>
                                <span>Temp: <strong style={{ color: '#fff' }}>{feedingPrediction.sensorValues?.temperature?.toFixed(1)}°C</strong></span>
                                <span>Turb: <strong style={{ color: '#fff' }}>{feedingPrediction.sensorValues?.turbidity}</strong></span>
                                <span>CO₂: <strong style={{ color: '#fff' }}>{feedingPrediction.sensorValues?.co2} ppm</strong></span>
                                <span>Conf: <strong style={{ color: '#fff' }}>{feedingPrediction.confidence}%</strong></span>
                            </div>
                            <p style={{
                                marginTop: '4px',
                                fontSize: '0.75rem',
                                color: 'var(--color-gray-500)'
                            }}>
                                ML model uses 5 sensor inputs to predict feeding level every 30s
                            </p>
                        </>
                    ) : (
                        <p style={{ color: 'var(--color-gray-400)' }}>
                            ⏳ Waiting for AI feeding prediction...
                        </p>
                    )}
                </div>
            )}

            {/* Manual Feed Button */}
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--border-radius-md)',
                marginBottom: 'var(--spacing-lg)',
                textAlign: 'center'
            }}>
                <button
                    onClick={handleFeedNow}
                    disabled={currentMode !== 'manual' || feedLoading}
                    style={{
                        ...buttonStyle,
                        padding: '15px 40px',
                        fontSize: '1.1rem',
                        background: (currentMode === 'manual' && !feedLoading)
                            ? 'linear-gradient(135deg, #27ae60, #2ecc71)'
                            : 'rgba(100,100,100,0.3)',
                        color: '#fff',
                        cursor: (currentMode === 'manual' && !feedLoading) ? 'pointer' : 'not-allowed',
                        opacity: currentMode !== 'manual' ? 0.5 : 1
                    }}
                >
                    {feedLoading ? '🔄 Feeding...' : '🍽️ Feed Now'}
                </button>
                <p style={{
                    marginTop: 'var(--spacing-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--color-gray-400)'
                }}>
                    {currentMode === 'ai'
                        ? '🧠 AI model controls feeding automatically'
                        : currentMode === 'auto'
                            ? '⚠️ Disabled in Auto mode'
                            : '✅ Click to trigger feeding'}
                </p>
            </div>

            {/* Schedules Section (Only in Auto Mode) */}
            <div style={{
                background: 'rgba(0,0,0,0.2)',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--border-radius-md)',
                opacity: currentMode === 'auto' ? 1 : 0.5
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    <h4 style={{ margin: 0 }}>📅 Feeding Schedules</h4>
                    <button
                        onClick={() => { resetForm(); setEditingSchedule(null); setShowAddModal(true); }}
                        disabled={currentMode !== 'auto'}
                        style={{
                            ...buttonStyle,
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            background: 'linear-gradient(135deg, #f39c12, #e67e22)'
                        }}
                    >
                        ➕ Add Schedule
                    </button>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--color-gray-400)' }}>Loading schedules...</p>
                ) : schedules.length === 0 ? (
                    <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                        No schedules yet. Click "Add Schedule" to create one.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {schedules.map(schedule => (
                            <div key={schedule._id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                background: schedule.enabled ? 'rgba(243, 156, 18, 0.1)' : 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(243, 156, 18, 0.2)',
                                borderRadius: '8px'
                            }}>
                                <div>
                                    <div style={{ fontWeight: '600' }}>
                                        {schedule.name || 'Feeding Schedule'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-400)' }}>
                                        {formatDays(schedule.days)} @ {formatTime(schedule.hour, schedule.minute)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleEditSchedule(schedule)}
                                        style={{ ...buttonStyle, padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(52, 152, 219, 0.3)' }}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSchedule(schedule._id)}
                                        style={{ ...buttonStyle, padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(231, 76, 60, 0.3)' }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <p style={{
                    marginTop: 'var(--spacing-md)',
                    fontSize: '0.75rem',
                    color: 'var(--color-gray-500)'
                }}>
                    {feederState.scheduleCount || 0} schedules synced to ESP32
                </p>
            </div>

            {/* RTC Time Display */}
            <div style={{
                marginTop: 'var(--spacing-lg)',
                padding: 'var(--spacing-md)',
                background: 'rgba(155, 89, 182, 0.1)',
                borderRadius: '8px',
                textAlign: 'center'
            }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)', marginBottom: '4px' }}>
                    ⏰ ESP32 RTC Time
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#9b59b6', marginBottom: 'var(--spacing-sm)' }}>
                    {rtcTime ? new Date(rtcTime).toLocaleString() : 'Waiting for data...'}
                </p>
                <button
                    onClick={async () => {
                        const now = new Date();
                        try {
                            await toggleActuator('rtc', true, {
                                action: 'setTime',
                                year: now.getFullYear(),
                                month: now.getMonth() + 1,
                                day: now.getDate(),
                                hour: now.getHours(),
                                minute: now.getMinutes(),
                                second: now.getSeconds()
                            });
                            setMessage('✅ RTC synced to browser time!');
                            setTimeout(() => setMessage(''), 2000);
                        } catch (error) {
                            setMessage('❌ Failed to sync RTC');
                            setTimeout(() => setMessage(''), 2000);
                        }
                    }}
                    style={{
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #9b59b6, #8e44ad)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                    }}
                >
                    🔄 Sync RTC to Browser Time
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={{
                    marginTop: 'var(--spacing-md)',
                    padding: 'var(--spacing-sm)',
                    background: message.includes('✅') ? 'rgba(46, 204, 113, 0.2)' :
                        message.includes('⚠️') ? 'rgba(243, 156, 18, 0.2)' :
                            'rgba(231, 76, 60, 0.2)',
                    border: `1px solid ${message.includes('✅') ? 'rgba(46, 204, 113, 0.5)' :
                        message.includes('⚠️') ? 'rgba(243, 156, 18, 0.5)' :
                            'rgba(231, 76, 60, 0.5)'}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                }}>
                    {message}
                </div>
            )}

            {/* Add/Edit Schedule Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--color-bg-secondary)',
                        padding: 'var(--spacing-xl)',
                        borderRadius: 'var(--border-radius-lg)',
                        width: '90%',
                        maxWidth: '450px',
                        border: '1px solid rgba(243, 156, 18, 0.3)'
                    }}>
                        <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>
                            {editingSchedule ? '✏️ Edit Schedule' : '➕ New Schedule'}
                        </h3>

                        {/* Name */}
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>
                                Schedule Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Morning Feed"
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>

                        {/* Days Selection */}
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>
                                Days
                            </label>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {DAY_NAMES.map((day, index) => (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(index)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: formData.days.includes(index)
                                                ? 'linear-gradient(135deg, #f39c12, #e67e22)'
                                                : 'rgba(0,0,0,0.3)',
                                            color: '#fff',
                                            fontWeight: formData.days.includes(index) ? '600' : '400'
                                        }}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Selection */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>
                                    Hour
                                </label>
                                <select
                                    value={formData.hour}
                                    onChange={(e) => setFormData(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                                    style={{ ...inputStyle, width: '100%' }}
                                >
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i}>
                                            {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>
                                    Minute
                                </label>
                                <select
                                    value={formData.minute}
                                    onChange={(e) => setFormData(prev => ({ ...prev, minute: parseInt(e.target.value) }))}
                                    style={{ ...inputStyle, width: '100%' }}
                                >
                                    {Array.from({ length: 60 }, (_, i) => (
                                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                            <button
                                onClick={() => { setShowAddModal(false); setEditingSchedule(null); resetForm(); }}
                                style={{
                                    ...buttonStyle,
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.3)',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.2)'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveSchedule}
                                style={{
                                    ...buttonStyle,
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
                                    color: '#fff'
                                }}
                            >
                                {editingSchedule ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default FeederControl;
