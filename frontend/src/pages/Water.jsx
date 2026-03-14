import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SensorCard from '../components/SensorCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { useSensorContext } from '../contexts/SensorContext';
import { getHistoricalData, getLatestWaterQualityPrediction } from '../services/api';
import { THRESHOLDS, getStatus } from '../utils/thresholds';

// ─── Threshold ranges (re-used from thresholds.js for alert logic) ───────────
const checkSensorAlerts = (sensorData) => {
    const alerts = [];

    const { temperature, ph, turbidity, tds, waterLevel } = sensorData;

    // Temperature
    if (temperature !== null && temperature !== undefined) {
        if (temperature < THRESHOLDS.temperature.min)
            alerts.push({ level: 'warning', icon: '🌡️', msg: `Temperature too LOW (${temperature?.toFixed(1)}°C). Safe range: ${THRESHOLDS.temperature.min}–${THRESHOLDS.temperature.max}°C.` });
        else if (temperature > THRESHOLDS.temperature.max)
            alerts.push({ level: 'danger', icon: '🌡️', msg: `Temperature too HIGH (${temperature?.toFixed(1)}°C). Safe range: ${THRESHOLDS.temperature.min}–${THRESHOLDS.temperature.max}°C.` });
    }

    // pH
    if (ph !== null && ph !== undefined) {
        if (ph < THRESHOLDS.ph.min)
            alerts.push({ level: 'danger', icon: '🧪', msg: `pH too LOW (${ph?.toFixed(2)}). Fish need pH ${THRESHOLDS.ph.min}–${THRESHOLDS.ph.max}. Consider adding buffer.` });
        else if (ph > THRESHOLDS.ph.max)
            alerts.push({ level: 'danger', icon: '🧪', msg: `pH too HIGH (${ph?.toFixed(2)}). Fish need pH ${THRESHOLDS.ph.min}–${THRESHOLDS.ph.max}. Partial water change recommended.` });
    }

    // Turbidity
    if (turbidity !== null && turbidity !== undefined) {
        if (turbidity > THRESHOLDS.turbidity.max)
            alerts.push({ level: 'warning', icon: '🌊', msg: `Turbidity HIGH (${turbidity} NTU). Water appears cloudy — consider a partial water change or filter check.` });
    }

    // TDS
    if (tds !== null && tds !== undefined) {
        if (tds < THRESHOLDS.tds.min)
            alerts.push({ level: 'warning', icon: '💧', msg: `TDS too LOW (${tds?.toFixed(0)} ppm). Minerals may be insufficient for fish health.` });
        else if (tds > THRESHOLDS.tds.max)
            alerts.push({ level: 'danger', icon: '💧', msg: `TDS too HIGH (${tds?.toFixed(0)} ppm). Water is over-mineralised — perform a partial water change.` });
    }

    // Water Level
    if (waterLevel !== null && waterLevel !== undefined) {
        if (waterLevel >= THRESHOLDS.waterLevel.max)
            alerts.push({ level: 'danger', icon: '📏', msg: `Water Level CRITICALLY LOW (sensor reads ${waterLevel?.toFixed(1)} cm gap). Refill the tank immediately!` });
        else if (waterLevel > THRESHOLDS.waterLevel.min)
            alerts.push({ level: 'warning', icon: '📏', msg: `Water Level getting LOW (sensor reads ${waterLevel?.toFixed(1)} cm gap). Top up the tank soon.` });
    }

    return alerts;
};

// Water level human-readable status
const getWaterLevelStatus = (waterLevel) => {
    if (waterLevel === null || waterLevel === undefined) return { label: 'Unknown', color: 'var(--color-gray-400)', icon: '📏' };
    const status = getStatus('waterLevel', waterLevel);
    switch (status) {
        case 'optimal': return { label: 'Tank is Fine / Full', color: '#2ecc71', icon: '✅' };
        case 'warning': return { label: 'Water Getting Low', color: '#f39c12', icon: '⚠️' };
        case 'danger': return { label: 'Need to Change / Refill Water', color: '#e74c3c', icon: '🚨' };
        default: return { label: 'Unknown', color: 'var(--color-gray-400)', icon: '📏' };
    }
};

const Water = () => {
    const { sensorData, systemStatus } = useSensorContext();

    // Only trust sensor values when ESP32 is actively connected
    const esp32Online = !!(systemStatus?.esp32?.connected);

    const [chartData, setChartData] = useState({ labels: [], temperature: [], ph: [], turbidity: [], tds: [] });
    const [chartLoading, setChartLoading] = useState(false);
    const [chartReady, setChartReady] = useState(false);
    const fetchedRef = useRef(false);

    const [wqPrediction, setWqPrediction] = useState(null);

    const isStale = (timestamp) => {
        if (!timestamp) return true;
        return Date.now() - new Date(timestamp).getTime() > 2 * 60 * 1000;
    };

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const fetchLatestPrediction = async () => {
            try {
                const data = await getLatestWaterQualityPrediction();
                if (data && data.prediction && !isStale(data.timestamp)) {
                    setWqPrediction(data);
                }
            } catch (error) {
                console.warn('Could not fetch latest prediction:', error);
            }
        };
        fetchLatestPrediction();

        const fetchHistorical = async () => {
            setChartLoading(true);
            try {
                const data = await getHistoricalData('daily');
                if (data && data.readings) {
                    setChartData({
                        labels: data.readings.map(r => r.timestamp),
                        temperature: data.readings.map(r => r.temperature),
                        ph: data.readings.map(r => r.ph),
                        turbidity: data.readings.map(r => r.turbidity),
                        tds: data.readings.map(r => r.tds)
                    });
                }
            } catch (error) {
                console.error('Failed to fetch historical data:', error);
            } finally {
                setChartLoading(false);
                setChartReady(true);
            }
        };

        const timer = setTimeout(fetchHistorical, 100);

        const unsubscribe = socketService.subscribe('sensor-update', (data) => {
            setChartData(prev => ({
                labels: [...prev.labels, new Date()].slice(-50),
                temperature: [...prev.temperature, data.temperature].slice(-50),
                ph: [...prev.ph, data.ph].slice(-50),
                turbidity: [...prev.turbidity, data.turbidity].slice(-50),
                tds: [...prev.tds, data.tds].slice(-50)
            }));
        });

        const unsubWQ = socketService.subscribe('water-quality-prediction', (data) => {
            setWqPrediction(data);
        });

        return () => {
            clearTimeout(timer);
            unsubscribe();
            unsubWQ();
        };
    }, []);

    const getPredictionStyle = (prediction) => {
        switch (prediction) {
            case 'Good': return { color: '#00e676', bg: 'rgba(0, 230, 118, 0.1)', border: 'rgba(0, 230, 118, 0.3)', icon: '✅', glow: '0 0 20px rgba(0, 230, 118, 0.3)' };
            case 'Moderate': return { color: '#ffab40', bg: 'rgba(255, 171, 64, 0.1)', border: 'rgba(255, 171, 64, 0.3)', icon: '⚠️', glow: '0 0 20px rgba(255, 171, 64, 0.3)' };
            case 'Poor': return { color: '#ff5252', bg: 'rgba(255, 82, 82, 0.1)', border: 'rgba(255, 82, 82, 0.3)', icon: '🔴', glow: '0 0 20px rgba(255, 82, 82, 0.3)' };
            default: return { color: 'var(--color-gray-400)', bg: 'transparent', border: 'var(--color-gray-700)', icon: '🔄', glow: 'none' };
        }
    };

    // Compute live alerts and water level status — only when ESP32 is online
    const sensorAlerts = esp32Online ? checkSensorAlerts(sensorData) : [];
    const wlStatus = esp32Online ? getWaterLevelStatus(sensorData.waterLevel)
        : { label: '—', color: 'var(--color-gray-500)', icon: '📏' };
    const hasAlerts = sensorAlerts.length > 0;

    // Timestamp — only show when ESP32 is live
    const readingTime = (esp32Online && sensorData.lastSensorUpdate)
        ? new Date(sensorData.lastSensorUpdate).toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        })
        : null;

    return (
        <div className="water-page">
            <div className="page-header">
                <h2 className="page-title">Water Quality Monitoring</h2>
                <p className="page-subtitle">Real-time water parameter monitoring and analysis</p>
                {readingTime && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginTop: '4px' }}>
                        🕐 Last reading recorded: <strong>{readingTime}</strong>
                    </p>
                )}
                {!esp32Online && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                        📡 ESP32 Offline — waiting for live sensor data
                    </p>
                )}
            </div>

            {/* ── Water Level Status Banner — only when ESP32 online ── */}
            {esp32Online && sensorData.waterLevel !== null && sensorData.waterLevel !== undefined ? (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 20px',
                    background: `${wlStatus.color}18`,
                    border: `1px solid ${wlStatus.color}50`,
                    borderRadius: '10px',
                    marginBottom: 'var(--spacing-lg)'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>{wlStatus.icon}</span>
                    <div>
                        <strong style={{ color: wlStatus.color, fontSize: '1rem' }}>{wlStatus.label}</strong>
                        <span style={{ color: 'var(--color-gray-400)', fontSize: '0.85rem', marginLeft: 8 }}>
                            ({Number(sensorData.waterLevel).toFixed(1)} cm from sensor)
                        </span>
                    </div>
                </div>
            ) : esp32Online ? (
                <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: 'var(--spacing-lg)', fontSize: '0.85rem', color: 'var(--color-gray-400)' }}>
                    📏 Water level sensor waiting...
                </div>
            ) : (
                <div style={{ padding: '10px 16px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '8px', marginBottom: 'var(--spacing-lg)', fontSize: '0.85rem', color: 'var(--color-danger)' }}>
                    📡 Water level: ESP32 offline — values not available
                </div>
            )}

            {/* ── Sensor Alerts — only when ESP32 online ── */}
            {esp32Online && hasAlerts && (
                <section style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div style={{
                        background: 'rgba(231,76,60,0.08)',
                        border: '1px solid rgba(231,76,60,0.3)',
                        borderRadius: '10px',
                        padding: 'var(--spacing-md)'
                    }}>
                        <h4 style={{ marginBottom: 'var(--spacing-sm)', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🚨 Sensor Alerts
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sensorAlerts.map((alert, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                                    padding: '8px 12px',
                                    background: alert.level === 'danger' ? 'rgba(231,76,60,0.12)' : 'rgba(243,156,18,0.12)',
                                    border: `1px solid ${alert.level === 'danger' ? 'rgba(231,76,60,0.3)' : 'rgba(243,156,18,0.3)'}`,
                                    borderRadius: '8px'
                                }}>
                                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{alert.icon}</span>
                                    <span style={{ fontSize: '0.87rem', color: alert.level === 'danger' ? '#e74c3c' : '#f39c12', lineHeight: 1.5 }}>{alert.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── All normal — only when ESP32 online and no alerts ── */}
            {esp32Online && !hasAlerts && sensorData.temperature !== null && sensorData.temperature !== undefined && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px',
                    background: 'rgba(46,204,113,0.1)',
                    border: '1px solid rgba(46,204,113,0.3)',
                    borderRadius: '8px',
                    marginBottom: 'var(--spacing-lg)',
                    fontSize: '0.87rem',
                    color: '#2ecc71'
                }}>
                    ✅ All sensor readings are within normal range
                </div>
            )}

            {/* ── AI Water Quality Prediction Card ── */}
            <div className="card" style={{
                marginBottom: 'var(--spacing-lg)',
                background: wqPrediction ? getPredictionStyle(wqPrediction.prediction).bg : 'var(--color-gray-800)',
                border: `1px solid ${wqPrediction ? getPredictionStyle(wqPrediction.prediction).border : 'var(--color-gray-700)'}`,
                boxShadow: wqPrediction ? getPredictionStyle(wqPrediction.prediction).glow : 'none',
                transition: 'all 0.5s ease'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                    <div>
                        <h3 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            🧠 AI Water Quality Prediction
                        </h3>
                        {!esp32Online ? (
                            <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>
                                📡 ESP32 Offline — AI prediction paused
                                <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '4px', color: 'var(--color-gray-500)' }}>
                                    Predictions resume when ESP32 reconnects
                                </span>
                            </p>
                        ) : wqPrediction ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{
                                        fontSize: '2rem', fontWeight: 700,
                                        color: getPredictionStyle(wqPrediction.prediction).color,
                                        letterSpacing: '0.5px'
                                    }}>
                                        {getPredictionStyle(wqPrediction.prediction).icon} {wqPrediction.prediction}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-400)' }}>
                                    <div>Confidence: <strong style={{ color: 'var(--color-white)' }}>{wqPrediction.confidence}%</strong></div>
                                    <div>Updated: {wqPrediction.timestamp
                                        ? new Date(wqPrediction.timestamp).toLocaleString('en-US', {
                                            month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                                        })
                                        : '—'}
                                    </div>
                                    {wqPrediction.prediction === 'Poor' && (
                                        <div style={{ marginTop: '6px', color: '#ff5252', fontWeight: 600 }}>
                                            ⚠️ Water quality is POOR — consider a significant water change!
                                        </div>
                                    )}
                                    {wqPrediction.prediction === 'Moderate' && (
                                        <div style={{ marginTop: '6px', color: '#ffab40' }}>
                                            ℹ️ Water is moderate — monitor readings and plan a partial water change soon.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--color-gray-400)', fontSize: '0.9rem' }}>
                                ⏳ Waiting for live sensor data...
                                <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '4px', color: 'var(--color-gray-500)' }}>
                                    Predictions resume when ESP32 is online
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Confidence bar */}
                    {wqPrediction && (
                        <div style={{ minWidth: '150px' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '4px' }}>Confidence</div>
                            <div style={{ height: '8px', background: 'var(--color-gray-700)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${wqPrediction.confidence}%`,
                                    background: getPredictionStyle(wqPrediction.prediction).color,
                                    borderRadius: '4px',
                                    transition: 'width 0.5s ease'
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Sensor Overview ── */}
            <section className="sensor-overview">
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Real-time Sensor Status</h3>
                <div className="sensor-grid">
                    <SensorCard sensorType="temperature" value={sensorData.temperature} timestamp={sensorData.lastSensorUpdate} />
                    <SensorCard sensorType="ph" value={sensorData.ph} timestamp={sensorData.lastSensorUpdate} />
                    <SensorCard sensorType="turbidity" value={sensorData.turbidity} timestamp={sensorData.lastSensorUpdate} />
                    <SensorCard sensorType="tds" value={sensorData.tds} timestamp={sensorData.lastSensorUpdate} />
                </div>
            </section>

            {/* ── Trend Chart ── */}
            {chartLoading && (
                <div className="chart-container" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    <div className="spinner" style={{ width: '30px', height: '30px', margin: '0 auto var(--spacing-sm)' }} />
                    <p style={{ color: 'var(--color-gray-400)', fontSize: '0.85rem' }}>Loading chart data...</p>
                </div>
            )}
            {chartReady && (
                <ChartPanel
                    title="Real-time Trend Monitoring"
                    period="daily"
                    datasets={[
                        { sensorType: 'temperature', label: 'Temperature (°C)', data: chartData.temperature },
                        { sensorType: 'ph', label: 'pH Level', data: chartData.ph },
                        { sensorType: 'turbidity', label: 'Turbidity (NTU)', data: chartData.turbidity },
                        { sensorType: 'tds', label: 'TDS (ppm)', data: chartData.tds }
                    ]}
                    labels={chartData.labels}
                    height={350}
                />
            )}

            <Link to="/" className="btn-back">← Back to Home</Link>
        </div>
    );
};

export default Water;
