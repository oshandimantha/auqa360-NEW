import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SensorCard from '../components/SensorCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { useSensorContext } from '../contexts/SensorContext';
import { getHistoricalData, getLatestWaterQualityPrediction } from '../services/api';

const Water = () => {
    const { sensorData } = useSensorContext();

    const [chartData, setChartData] = useState({
        labels: [],
        temperature: [],
        ph: [],
        turbidity: [],
        tds: []
    });
    // Start as false — show page immediately, chart loads in background
    const [chartLoading, setChartLoading] = useState(false);
    const [chartReady, setChartReady] = useState(false);
    const fetchedRef = useRef(false);

    // AI Water Quality Prediction state
    const [wqPrediction, setWqPrediction] = useState(null);

    const isStale = (timestamp) => {
        if (!timestamp) return true;
        const ageMs = Date.now() - new Date(timestamp).getTime();
        return ageMs > 2 * 60 * 1000; // older than 2 minutes = stale
    };

    useEffect(() => {
        // Prevent double-fetch in strict mode
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        // Fetch latest water quality prediction from API on mount
        // Only use it if it's fresh (< 2 min old), otherwise wait for live MQTT
        const fetchLatestPrediction = async () => {
            try {
                const data = await getLatestWaterQualityPrediction();
                if (data && data.prediction && !isStale(data.timestamp)) {
                    setWqPrediction(data);
                    console.log('Loaded fresh WQ prediction from API:', data.prediction);
                } else if (data && data.prediction) {
                    console.log('WQ prediction is stale — waiting for live data');
                }
            } catch (error) {
                console.warn('Could not fetch latest prediction:', error);
            }
        };
        fetchLatestPrediction();

        // Fetch historical data in the background — page is already visible
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

        // Delay chart fetch slightly so the page paints first
        const timer = setTimeout(fetchHistorical, 100);

        // Subscribe to real-time updates for chart
        const unsubscribe = socketService.subscribe('sensor-update', (data) => {
            setChartData(prev => ({
                labels: [...prev.labels, new Date()].slice(-50),
                temperature: [...prev.temperature, data.temperature].slice(-50),
                ph: [...prev.ph, data.ph].slice(-50),
                turbidity: [...prev.turbidity, data.turbidity].slice(-50),
                tds: [...prev.tds, data.tds].slice(-50)
            }));
        });

        // Subscribe to AI water quality predictions (real-time updates)
        const unsubWQ = socketService.subscribe('water-quality-prediction', (data) => {
            setWqPrediction(data);
        });

        return () => {
            clearTimeout(timer);
            unsubscribe();
            unsubWQ();
        };
    }, []);

    // Get prediction color and icon based on label
    const getPredictionStyle = (prediction) => {
        switch (prediction) {
            case 'Good':
                return { color: '#00e676', bg: 'rgba(0, 230, 118, 0.1)', border: 'rgba(0, 230, 118, 0.3)', icon: '✅', glow: '0 0 20px rgba(0, 230, 118, 0.3)' };
            case 'Moderate':
                return { color: '#ffab40', bg: 'rgba(255, 171, 64, 0.1)', border: 'rgba(255, 171, 64, 0.3)', icon: '⚠️', glow: '0 0 20px rgba(255, 171, 64, 0.3)' };
            case 'Poor':
                return { color: '#ff5252', bg: 'rgba(255, 82, 82, 0.1)', border: 'rgba(255, 82, 82, 0.3)', icon: '🔴', glow: '0 0 20px rgba(255, 82, 82, 0.3)' };
            default:
                return { color: 'var(--color-gray-400)', bg: 'transparent', border: 'var(--color-gray-700)', icon: '🔄', glow: 'none' };
        }
    };

    return (
        <div className="water-page">
            <div className="page-header">
                <h2 className="page-title">Water Quality Monitoring</h2>
                <p className="page-subtitle">Real-time water parameter monitoring and analysis</p>
            </div>

            {/* AI Water Quality Prediction Card */}
            <div className="card" style={{
                marginBottom: 'var(--spacing-lg)',
                background: wqPrediction
                    ? getPredictionStyle(wqPrediction.prediction).bg
                    : 'var(--color-gray-800)',
                border: `1px solid ${wqPrediction ? getPredictionStyle(wqPrediction.prediction).border : 'var(--color-gray-700)'}`,
                boxShadow: wqPrediction ? getPredictionStyle(wqPrediction.prediction).glow : 'none',
                transition: 'all 0.5s ease'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                    <div>
                        <h3 style={{ marginBottom: 'var(--spacing-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            🧠 AI Water Quality Prediction
                        </h3>
                        {wqPrediction ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                                <div>
                                    <span style={{
                                        fontSize: '2rem',
                                        fontWeight: 700,
                                        color: getPredictionStyle(wqPrediction.prediction).color,
                                        letterSpacing: '0.5px'
                                    }}>
                                        {getPredictionStyle(wqPrediction.prediction).icon} {wqPrediction.prediction}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--color-gray-400)' }}>
                                    <div>Confidence: <strong style={{ color: 'var(--color-white)' }}>{wqPrediction.confidence}%</strong></div>
                                    <div>Updated: {wqPrediction.timestamp ? new Date(wqPrediction.timestamp).toLocaleTimeString() : '—'}</div>
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginBottom: '4px' }}>
                                Confidence
                            </div>
                            <div style={{
                                height: '8px',
                                background: 'var(--color-gray-700)',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
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

            {/* Sensor Overview — instantly visible from shared context */}
            <section className="sensor-overview">
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Real-time Sensor Status</h3>
                <div className="sensor-grid">
                    <SensorCard
                        sensorType="temperature"
                        value={sensorData.temperature}
                        timestamp={sensorData.lastSensorUpdate}
                    />
                    <SensorCard
                        sensorType="ph"
                        value={sensorData.ph}
                        timestamp={sensorData.lastSensorUpdate}
                    />
                    <SensorCard
                        sensorType="turbidity"
                        value={sensorData.turbidity}
                        timestamp={sensorData.lastSensorUpdate}
                    />
                    <SensorCard
                        sensorType="tds"
                        value={sensorData.tds}
                        timestamp={sensorData.lastSensorUpdate}
                    />
                </div>
            </section>

            {/* SCADA-Style Trend Chart — loads in background */}
            {chartLoading && (
                <div className="chart-container" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    <div className="spinner" style={{ width: '30px', height: '30px', margin: '0 auto var(--spacing-sm)' }}></div>
                    <p style={{ color: 'var(--color-gray-400)', fontSize: '0.85rem' }}>Loading chart data...</p>
                </div>
            )}
            {chartReady && (
                <ChartPanel
                    title="Real-time Trend Monitoring"
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

            <Link to="/" className="btn-back">
                ← Back to Home
            </Link>
        </div>
    );
};

export default Water;
