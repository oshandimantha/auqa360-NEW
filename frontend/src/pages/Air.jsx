import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SensorCard from '../components/SensorCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { useSensorContext } from '../contexts/SensorContext';
import { getHistoricalData, getLatestFishGas } from '../services/api';

const Air = () => {
    const { sensorData, systemStatus } = useSensorContext();
    const esp32Online = !!(systemStatus?.esp32?.connected);
    const [gasDetection, setGasDetection] = useState(null);

    const [chartData, setChartData] = useState({
        labels: [],
        co2: []
    });
    // Start as false — show page immediately
    const [chartLoading, setChartLoading] = useState(false);
    const [chartReady, setChartReady] = useState(false);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        // Fetch historical data in background
        const fetchHistorical = async () => {
            setChartLoading(true);
            try {
                const data = await getHistoricalData('daily', 'co2');
                if (data && data.readings) {
                    setChartData({
                        labels: data.readings.map(r => r.timestamp),
                        co2: data.readings.map(r => r.co2)
                    });
                }
            } catch (error) {
                console.error('Failed to fetch historical data:', error);
            } finally {
                setChartLoading(false);
                setChartReady(true);
            }
        };

        // Delay chart fetch so page paints first
        const timer = setTimeout(fetchHistorical, 100);

        // Subscribe to real-time updates for chart
        const unsubscribe = socketService.subscribe('sensor-update', (data) => {
            if (data.co2 !== undefined) {
                setChartData(prev => ({
                    labels: [...prev.labels, new Date()].slice(-50),
                    co2: [...prev.co2, data.co2].slice(-50)
                }));
            }
        });

        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, []);

    // Separate effect for gas detection — always active
    useEffect(() => {
        const fetchLatestGas = async () => {
            const data = await getLatestFishGas();
            if (data && data.gasLevel !== null) {
                setGasDetection(data);
            }
        };
        fetchLatestGas();

        console.log('🔌 Air page: subscribing to fish-gas-detection');
        const unsubGas = socketService.subscribe('fish-gas-detection', (data) => {
            console.log('💨 Gas detection received:', data);
            setGasDetection(data);
        });
        return () => unsubGas();
    }, []);

    return (
        <div className="air-page">
            <div className="page-header">
                <h2 className="page-title">Air Quality Monitoring</h2>
                <p className="page-subtitle">Real-time CO2 level and air quality analysis</p>
            </div>

            {/* Sensor Overview — instantly visible from shared context */}
            <section className="sensor-overview">
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Real-time Air Quality Status</h3>
                <div className="sensor-grid">
                    {esp32Online ? (
                        <SensorCard
                            sensorType="co2"
                            value={sensorData.co2}
                            timestamp={sensorData.lastSensorUpdate}
                        />
                    ) : (
                        <div className="sensor-card">
                            <div className="sensor-icon">💨</div>
                            <div className="sensor-label">CO2</div>
                            <div className="sensor-value" style={{ fontSize: '2rem', color: 'var(--color-gray-600)' }}>--</div>
                            <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--color-danger)' }}>📡 ESP32 Offline</div>
                        </div>
                    )}
                </div>
            </section>

            {/* AI Gas Detection Status */}
            <section className="card" style={{
                marginTop: 'var(--spacing-xl)',
                background: gasDetection
                    ? (gasDetection.gasLevel === 0
                        ? 'linear-gradient(135deg, rgba(39, 174, 96, 0.1), rgba(46, 204, 113, 0.05))'
                        : 'linear-gradient(135deg, rgba(231, 76, 60, 0.15), rgba(192, 57, 43, 0.05))')
                    : 'var(--color-card-bg)',
                border: gasDetection
                    ? `1px solid ${gasDetection.gasLevel === 0 ? 'rgba(39, 174, 96, 0.3)' : 'rgba(231, 76, 60, 0.4)'}`
                    : '1px solid rgba(255,255,255,0.1)'
            }}>
                <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🧠 AI Gas Detection
                    <span style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(155, 89, 182, 0.2)',
                        color: '#9b59b6'
                    }}>ML Model</span>
                </h3>

                {!esp32Online ? (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-danger)' }}>
                        📡 ESP32 Offline — AI gas detection paused
                        <p style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--color-gray-500)' }}>
                            Predictions will resume when the ESP32 reconnects
                        </p>
                    </div>
                ) : gasDetection ? (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '4px' }}>
                            {gasDetection.gasLevel === 0 ? '🟢' : '🔴'}
                        </div>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: gasDetection.gasLevel === 0 ? '#27ae60' : '#e74c3c'
                        }}>
                            {gasDetection.gasLabel}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-400)', marginTop: '4px' }}>
                            {gasDetection.confidence}% confidence
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-gray-400)' }}>
                        ⏳ Waiting for AI gas detection prediction...
                        <p style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--color-gray-500)' }}>
                            ML model analyzes gas levels every 30s using sensor data
                        </p>
                    </div>
                )}
            </section>

            {/* Info Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--spacing-lg)',
                marginTop: 'var(--spacing-xl)'
            }}>
                <div className="card">
                    <h4 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-success)' }}>
                        🌿 Good (350-600 ppm)
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-400)' }}>
                        Normal outdoor and well-ventilated indoor levels. Optimal for fish health.
                    </p>
                </div>
                <div className="card">
                    <h4 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-warning)' }}>
                        ⚠️ Moderate (600-1000 ppm)
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-400)' }}>
                        Typical indoor levels. Monitor for prolonged high readings.
                    </p>
                </div>
                <div className="card">
                    <h4 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-danger)' }}>
                        🚨 High (1000+ ppm)
                    </h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-400)' }}>
                        Poor ventilation. May affect fish behavior and health. Take action.
                    </p>
                </div>
            </div>

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
                        { sensorType: 'co2', label: 'CO2 Level (ppm)', data: chartData.co2 }
                    ]}
                    labels={chartData.labels}
                    height={350}
                    showLegend={false}
                />
            )}

            <Link to="/" className="btn-back">
                ← Back to Home
            </Link>
        </div>
    );
};

export default Air;
