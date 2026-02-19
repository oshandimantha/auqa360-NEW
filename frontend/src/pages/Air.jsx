import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SensorCard from '../components/SensorCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { useSensorContext } from '../contexts/SensorContext';
import { getHistoricalData } from '../services/api';

const Air = () => {
    const { sensorData } = useSensorContext();

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
                    <SensorCard
                        sensorType="co2"
                        value={sensorData.co2}
                    />
                </div>
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
