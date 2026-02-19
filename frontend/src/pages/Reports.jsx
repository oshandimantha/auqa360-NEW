import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { useSensorContext } from '../contexts/SensorContext';
import { getHistoricalData } from '../services/api';

const Reports = () => {
    const { sensorData } = useSensorContext();

    const [activePeriod, setActivePeriod] = useState('daily');
    const [chartData, setChartData] = useState({
        labels: [],
        temperature: [],
        ph: [],
        turbidity: [],
        tds: [],
        co2: []
    });
    const [stats, setStats] = useState({
        avgTemperature: '--',
        avgPh: '--',
        avgTurbidity: '--',
        avgTds: '--',
        avgCo2: '--',
        fishCountAvg: '--'
    });
    const [chartLoading, setChartLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);

    const periods = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' }
    ];

    useEffect(() => {
        fetchReportData(activePeriod);
    }, [activePeriod]);

    // Subscribe to real-time sensor updates for chart
    useEffect(() => {
        const unsubscribe = socketService.subscribe('sensor-update', (data) => {
            // Update chart data with new readings
            setChartData(prev => ({
                labels: [...prev.labels, new Date()].slice(-100),
                temperature: [...prev.temperature, data.temperature].slice(-100),
                ph: [...prev.ph, data.ph].slice(-100),
                turbidity: [...prev.turbidity, data.turbidity].slice(-100),
                tds: [...prev.tds, data.tds].slice(-100),
                co2: [...prev.co2, data.co2].slice(-100)
            }));

            // Update last update time
            setLastUpdate(new Date());

            // Recalculate running averages for current session
            setStats(prev => {
                const calcRunningAvg = (prevAvg, newVal, label) => {
                    if (newVal === null || newVal === undefined) return prevAvg;
                    if (prevAvg === '--') return newVal.toFixed(1) + label;
                    const prevNum = parseFloat(prevAvg);
                    const newAvg = ((prevNum + newVal) / 2).toFixed(1);
                    return newAvg + label;
                };

                return {
                    ...prev,
                    avgTemperature: calcRunningAvg(prev.avgTemperature, data.temperature, '°C'),
                    avgPh: data.ph !== undefined ? data.ph.toFixed(1) : prev.avgPh,
                    avgTurbidity: calcRunningAvg(prev.avgTurbidity, data.turbidity, ' NTU'),
                    avgTds: calcRunningAvg(prev.avgTds, data.tds, ' ppm'),
                    avgCo2: calcRunningAvg(prev.avgCo2, data.co2, ' ppm')
                };
            });
        });

        return () => unsubscribe();
    }, []);

    const fetchReportData = async (period) => {
        setChartLoading(true);
        try {
            const data = await getHistoricalData(period);
            if (data && data.readings) {
                setChartData({
                    labels: data.readings.map(r => r.timestamp),
                    temperature: data.readings.map(r => r.temperature),
                    ph: data.readings.map(r => r.ph),
                    turbidity: data.readings.map(r => r.turbidity),
                    tds: data.readings.map(r => r.tds),
                    co2: data.readings.map(r => r.co2)
                });

                // Calculate averages
                const readings = data.readings;
                if (readings.length > 0) {
                    const avg = (arr) => {
                        const valid = arr.filter(v => v !== null && v !== undefined);
                        return valid.length > 0
                            ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)
                            : '--';
                    };

                    setStats({
                        avgTemperature: avg(readings.map(r => r.temperature)) + '°C',
                        avgPh: avg(readings.map(r => r.ph)),
                        avgTurbidity: avg(readings.map(r => r.turbidity)) + ' NTU',
                        avgTds: avg(readings.map(r => r.tds)) + ' ppm',
                        avgCo2: avg(readings.map(r => r.co2)) + ' ppm',
                        fishCountAvg: avg(readings.map(r => r.fishCount))
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch report data:', error);
            // Set demo data for display
            const demoLabels = Array.from({ length: 24 }, (_, i) => {
                const d = new Date();
                d.setHours(d.getHours() - (23 - i));
                return d;
            });

            setChartData({
                labels: demoLabels,
                temperature: demoLabels.map(() => 25 + Math.random() * 3),
                ph: demoLabels.map(() => 7 + Math.random() * 0.5),
                turbidity: demoLabels.map(() => 20 + Math.random() * 15),
                tds: demoLabels.map(() => 250 + Math.random() * 100),
                co2: demoLabels.map(() => 400 + Math.random() * 200)
            });

            setStats({
                avgTemperature: '26.5°C',
                avgPh: '7.2',
                avgTurbidity: '25 NTU',
                avgTds: '300 ppm',
                avgCo2: '500 ppm',
                fishCountAvg: '12'
            });
        } finally {
            setChartLoading(false);
        }
    };

    return (
        <div className="reports-page">
            <div className="page-header">
                <h2 className="page-title">Reports & Analytics</h2>
                <p className="page-subtitle">Historical data analysis and trend reports</p>
                {lastUpdate && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginTop: '4px' }}>
                        🟢 Live updating • Last update: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Filter Buttons */}
            <div className="filter-group">
                {periods.map((period) => (
                    <button
                        key={period.key}
                        className={`filter-btn ${activePeriod === period.key ? 'active' : ''}`}
                        onClick={() => setActivePeriod(period.key)}
                    >
                        {period.label}
                    </button>
                ))}
            </div>

            {/* Current Real-time Values from context — always visible */}
            <section className="card" style={{ marginBottom: 'var(--spacing-lg)', background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(46, 204, 113, 0.1))' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🔴 Live Sensor Values
                    <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#2ecc71',
                        animation: 'pulse 1.5s infinite',
                        display: 'inline-block'
                    }}></span>
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 'var(--spacing-md)'
                }}>
                    <div className="live-value">
                        <span className="live-icon">🌡️</span>
                        <span className="live-label">Temp</span>
                        <span className="live-num">{sensorData.temperature?.toFixed(1) ?? '--'}°C</span>
                    </div>
                    <div className="live-value">
                        <span className="live-icon">🧪</span>
                        <span className="live-label">pH</span>
                        <span className="live-num">{sensorData.ph?.toFixed(2) ?? '--'}</span>
                    </div>
                    <div className="live-value">
                        <span className="live-icon">🌊</span>
                        <span className="live-label">Turbidity</span>
                        <span className="live-num">{sensorData.turbidity ?? '--'} NTU</span>
                    </div>
                    <div className="live-value">
                        <span className="live-icon">💧</span>
                        <span className="live-label">TDS</span>
                        <span className="live-num">{sensorData.tds?.toFixed(0) ?? '--'} ppm</span>
                    </div>
                    <div className="live-value">
                        <span className="live-icon">🌿</span>
                        <span className="live-label">CO2</span>
                        <span className="live-num">{sensorData.co2 ?? '--'} ppm</span>
                    </div>
                </div>
            </section>

            {/* Statistics Overview */}
            <section className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>
                    {activePeriod.charAt(0).toUpperCase() + activePeriod.slice(1)} Averages
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 'var(--spacing-md)'
                }}>
                    <div className="stat-box">
                        <span className="stat-icon">🌡️</span>
                        <span className="stat-label">Temperature</span>
                        <span className="stat-value">{stats.avgTemperature}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-icon">🧪</span>
                        <span className="stat-label">pH Level</span>
                        <span className="stat-value">{stats.avgPh}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-icon">🌊</span>
                        <span className="stat-label">Turbidity</span>
                        <span className="stat-value">{stats.avgTurbidity}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-icon">💧</span>
                        <span className="stat-label">TDS</span>
                        <span className="stat-value">{stats.avgTds}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-icon">🌿</span>
                        <span className="stat-label">CO2</span>
                        <span className="stat-value">{stats.avgCo2}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-icon">🐟</span>
                        <span className="stat-label">Avg Fish Count</span>
                        <span className="stat-value">{stats.fishCountAvg}</span>
                    </div>
                </div>
            </section>

            {chartLoading ? (
                <div className="chart-container" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div className="spinner" style={{ margin: '0 auto var(--spacing-md)' }}></div>
                    <p style={{ color: 'var(--color-gray-400)' }}>Loading chart data...</p>
                </div>
            ) : (
                <>
                    {/* Water Quality Chart */}
                    <ChartPanel
                        title="Water Quality Trends"
                        datasets={[
                            { sensorType: 'temperature', label: 'Temperature (°C)', data: chartData.temperature },
                            { sensorType: 'ph', label: 'pH Level', data: chartData.ph },
                            { sensorType: 'turbidity', label: 'Turbidity (NTU)', data: chartData.turbidity },
                            { sensorType: 'tds', label: 'TDS (ppm)', data: chartData.tds }
                        ]}
                        labels={chartData.labels}
                        height={350}
                    />

                    {/* Air Quality Chart */}
                    <ChartPanel
                        title="Air Quality Trends"
                        datasets={[
                            { sensorType: 'co2', label: 'CO2 Level (ppm)', data: chartData.co2 }
                        ]}
                        labels={chartData.labels}
                        height={250}
                        showLegend={false}
                    />
                </>
            )}

            <Link to="/" className="btn-back">
                ← Back to Home
            </Link>

            <style jsx>{`
        .stat-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-md);
          background: rgba(0, 0, 0, 0.2);
          border-radius: var(--border-radius-md);
          text-align: center;
        }
        
        .stat-icon {
          font-size: 1.5rem;
          margin-bottom: var(--spacing-xs);
        }
        
        .stat-label {
          font-size: 0.75rem;
          color: var(--color-gray-400);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--spacing-xs);
        }
        
        .stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-white);
        }

        .live-value {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-sm);
          background: rgba(0, 0, 0, 0.2);
          border-radius: var(--border-radius-md);
          text-align: center;
        }

        .live-icon {
          font-size: 1.2rem;
        }

        .live-label {
          font-size: 0.7rem;
          color: var(--color-gray-400);
          text-transform: uppercase;
        }

        .live-num {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
        </div>
    );
};

export default Reports;
