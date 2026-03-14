import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { getHistoricalData, getSensorData } from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────

const avg = (arr) => {
    const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) : null;
};

const sensorFields = [
    { key: 'temperature', label: 'Temperature', icon: '🌡️', unit: '°C' },
    { key: 'ph', label: 'pH Level', icon: '🧪', unit: '' },
    { key: 'turbidity', label: 'Turbidity', icon: '🌊', unit: ' NTU' },
    { key: 'tds', label: 'TDS', icon: '💧', unit: ' ppm' },
    { key: 'co2', label: 'CO₂', icon: '🌿', unit: ' ppm' },
    { key: 'waterLevel', label: 'Water Level', icon: '📏', unit: ' cm' },
];

// ─── component ───────────────────────────────────────────────────────────────

const Reports = () => {
    const [activePeriod, setActivePeriod] = useState('daily');
    const [chartData, setChartData] = useState({ labels: [], temperature: [], ph: [], turbidity: [], tds: [], co2: [] });
    const [stats, setStats] = useState({ avgTemperature: '--', avgPh: '--', avgTurbidity: '--', avgTds: '--', avgCo2: '--' });
    const [chartLoading, setChartLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [latestSensor, setLatestSensor] = useState(null);
    const [sensorStatus, setSensorStatus] = useState({});

    const periods = [
        { key: 'daily', label: 'Daily' },
        { key: 'weekly', label: 'Weekly' },
        { key: 'monthly', label: 'Monthly' },
    ];

    // ── Fetch aggregated chart data from MongoDB ──────────────────────────────
    const fetchReportData = useCallback(async (period) => {
        setChartLoading(true);
        try {
            const data = await getHistoricalData(period);
            if (data && data.readings && data.readings.length > 0) {
                const readings = data.readings;
                setChartData({
                    labels: readings.map(r => r.timestamp),
                    temperature: readings.map(r => r.temperature),
                    ph: readings.map(r => r.ph),
                    turbidity: readings.map(r => r.turbidity),
                    tds: readings.map(r => r.tds),
                    co2: readings.map(r => r.co2),
                });

                setStats({
                    avgTemperature: avg(readings.map(r => r.temperature)) != null ? avg(readings.map(r => r.temperature)) + '°C' : '--',
                    avgPh: avg(readings.map(r => r.ph)) != null ? avg(readings.map(r => r.ph)) : '--',
                    avgTurbidity: avg(readings.map(r => r.turbidity)) != null ? avg(readings.map(r => r.turbidity)) + ' NTU' : '--',
                    avgTds: avg(readings.map(r => r.tds)) != null ? avg(readings.map(r => r.tds)) + ' ppm' : '--',
                    avgCo2: avg(readings.map(r => r.co2)) != null ? avg(readings.map(r => r.co2)) + ' ppm' : '--',
                });
            } else {
                // We got a response but no data yet — likely empty DB for this period
                setChartData({ labels: [], temperature: [], ph: [], turbidity: [], tds: [], co2: [] });
                setStats({ avgTemperature: 'No data', avgPh: 'No data', avgTurbidity: 'No data', avgTds: 'No data', avgCo2: 'No data' });
            }
        } catch (error) {
            console.error('Failed to fetch report data:', error);
            setChartData({ labels: [], temperature: [], ph: [], turbidity: [], tds: [], co2: [] });
        } finally {
            setChartLoading(false);
        }
    }, []);

    // ── Period change ─────────────────────────────────────────────────────────
    useEffect(() => {
        fetchReportData(activePeriod);
    }, [activePeriod, fetchReportData]);

    // ── Poll latest sensor reading for status panel ───────────────────────────
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const latest = await getSensorData();
                setLatestSensor(latest);

                // A sensor field is "online" if its value is not null and was updated
                // recently (within 5 minutes)
                const now = Date.now();
                const ts = latest?.timestamp ? new Date(latest.timestamp).getTime() : 0;
                const age = now - ts; // ms
                const onlineThreshold = 5 * 60 * 1000; // 5 min

                const statusMap = {};
                sensorFields.forEach(({ key }) => {
                    statusMap[key] = age < onlineThreshold && latest?.[key] !== null && latest?.[key] !== undefined;
                });
                setSensorStatus(statusMap);
            } catch {
                // all offline
                const statusMap = {};
                sensorFields.forEach(({ key }) => { statusMap[key] = false; });
                setSensorStatus(statusMap);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Real-time socket updates ──────────────────────────────────────────────
    useEffect(() => {
        const unsubscribe = socketService.subscribe('sensor-update', (data) => {
            setLastUpdate(new Date());
        });
        return () => unsubscribe();
    }, []);

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="reports-page">

            {/* ── Header ── */}
            <div className="page-header">
                <h2 className="page-title">Reports &amp; Analytics</h2>
                <p className="page-subtitle">Historical data analysis and trend reports</p>
                {lastUpdate && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginTop: '4px' }}>
                        🟢 Live updating • Last update: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* ── Period selector ── */}
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

            {/* ── Sensor Status Panel ── */}
            <section className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📡 Sensor Status
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', fontWeight: 400 }}>
                        (last reading: {latestSensor?.timestamp
                            ? new Date(latestSensor.timestamp).toLocaleString()
                            : 'N/A'})
                    </span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--spacing-md)' }}>
                    {sensorFields.map(({ key, label, icon, unit }) => {
                        const online = sensorStatus[key];
                        const val = latestSensor?.[key];
                        return (
                            <div key={key} className="sensor-status-box" data-online={online}>
                                <span style={{ fontSize: '1.3rem' }}>{icon}</span>
                                <span className="sensor-status-label">{label}</span>
                                <span className="sensor-status-dot" style={{ background: online ? '#2ecc71' : '#e74c3c' }}>
                                    {online ? '● Online' : '○ Offline'}
                                </span>
                                <span className="sensor-status-val">
                                    {val !== null && val !== undefined ? Number(val).toFixed(1) + unit : '--'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Average Stats (from MongoDB) ── */}
            <section className="card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>
                    {activePeriod.charAt(0).toUpperCase() + activePeriod.slice(1)} Averages
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', fontWeight: 400, marginLeft: 8 }}>from MongoDB</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-md)' }}>
                    <div className="stat-box"><span className="stat-icon">🌡️</span><span className="stat-label">Temperature</span><span className="stat-value">{stats.avgTemperature}</span></div>
                    <div className="stat-box"><span className="stat-icon">🧪</span><span className="stat-label">pH Level</span><span className="stat-value">{stats.avgPh}</span></div>
                    <div className="stat-box"><span className="stat-icon">🌊</span><span className="stat-label">Turbidity</span><span className="stat-value">{stats.avgTurbidity}</span></div>
                    <div className="stat-box"><span className="stat-icon">💧</span><span className="stat-label">TDS</span><span className="stat-value">{stats.avgTds}</span></div>
                    <div className="stat-box"><span className="stat-icon">🌿</span><span className="stat-label">CO₂</span><span className="stat-value">{stats.avgCo2}</span></div>
                </div>
            </section>

            {/* ── Trend Charts ── */}
            {chartLoading ? (
                <div className="chart-container" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div className="spinner" style={{ margin: '0 auto var(--spacing-md)' }} />
                    <p style={{ color: 'var(--color-gray-400)' }}>Loading {activePeriod} chart data from MongoDB…</p>
                </div>
            ) : chartData.labels.length === 0 ? (
                <div className="chart-container" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <p style={{ fontSize: '2rem' }}>📭</p>
                    <p style={{ color: 'var(--color-gray-400)' }}>No {activePeriod} data found in MongoDB yet.</p>
                    <p style={{ color: 'var(--color-gray-500)', fontSize: '0.85rem' }}>Data will appear once the ESP32 starts sending readings.</p>
                </div>
            ) : (
                <>
                    {/* Water Quality Chart */}
                    <ChartPanel
                        title="Water Quality Trends"
                        period={activePeriod}
                        datasets={[
                            { sensorType: 'temperature', label: 'Temperature (°C)', data: chartData.temperature },
                            { sensorType: 'ph', label: 'pH Level', data: chartData.ph },
                            { sensorType: 'turbidity', label: 'Turbidity (NTU)', data: chartData.turbidity },
                            { sensorType: 'tds', label: 'TDS (ppm)', data: chartData.tds },
                        ]}
                        labels={chartData.labels}
                        height={350}
                    />

                    {/* Air Quality Chart */}
                    <ChartPanel
                        title="Air Quality Trends (CO₂)"
                        period={activePeriod}
                        datasets={[
                            { sensorType: 'co2', label: 'CO₂ Level (ppm)', data: chartData.co2 },
                        ]}
                        labels={chartData.labels}
                        height={250}
                        showLegend={false}
                    />
                </>
            )}

            <Link to="/" className="btn-back">← Back to Home</Link>

            <style>{`
                .sensor-status-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--spacing-md);
                    background: rgba(0,0,0,0.2);
                    border-radius: var(--border-radius-md);
                    text-align: center;
                    gap: 4px;
                    transition: border 0.2s;
                    border: 1px solid transparent;
                }
                .sensor-status-box[data-online="true"]  { border-color: rgba(46,204,113,0.3); }
                .sensor-status-box[data-online="false"] { border-color: rgba(231,76,60,0.2);  }
                .sensor-status-label {
                    font-size: 0.7rem;
                    color: var(--color-gray-400);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .sensor-status-dot {
                    font-size: 0.65rem;
                    padding: 2px 8px;
                    border-radius: 20px;
                    color: #fff;
                }
                .sensor-status-val {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--color-white);
                }
                .stat-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--spacing-md);
                    background: rgba(0,0,0,0.2);
                    border-radius: var(--border-radius-md);
                    text-align: center;
                }
                .stat-icon  { font-size: 1.5rem; margin-bottom: var(--spacing-xs); }
                .stat-label { font-size: 0.75rem; color: var(--color-gray-400); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--spacing-xs); }
                .stat-value { font-size: 1.25rem; font-weight: 600; color: var(--color-white); }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
            `}</style>
        </div>
    );
};

export default Reports;
