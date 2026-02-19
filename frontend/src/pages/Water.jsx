import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SensorCard from '../components/SensorCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { useSensorContext } from '../contexts/SensorContext';
import { getHistoricalData } from '../services/api';

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

    useEffect(() => {
        // Prevent double-fetch in strict mode
        if (fetchedRef.current) return;
        fetchedRef.current = true;

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

        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, []);

    return (
        <div className="water-page">
            <div className="page-header">
                <h2 className="page-title">Water Quality Monitoring</h2>
                <p className="page-subtitle">Real-time water parameter monitoring and analysis</p>
            </div>

            {/* Sensor Overview — instantly visible from shared context */}
            <section className="sensor-overview">
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Real-time Sensor Status</h3>
                <div className="sensor-grid">
                    <SensorCard
                        sensorType="temperature"
                        value={sensorData.temperature}
                    />
                    <SensorCard
                        sensorType="ph"
                        value={sensorData.ph}
                    />
                    <SensorCard
                        sensorType="turbidity"
                        value={sensorData.turbidity}
                    />
                    <SensorCard
                        sensorType="tds"
                        value={sensorData.tds}
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
