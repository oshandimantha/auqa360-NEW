import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DetectionCard from '../components/DetectionCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { formatRelativeTime } from '../utils/format';

// MJPEG stream URL from ML service
const STREAM_URL = process.env.REACT_APP_ML_STREAM_URL || 'http://localhost:8765/video_feed';

const Fish = () => {
    const [fishCount, setFishCount] = useState(null);
    const [fps, setFps] = useState(0);
    const [overallStatus, setOverallStatus] = useState(null);
    const [diseaseDetectionCount, setDiseaseDetectionCount] = useState(0);
    const [diseaseRisk, setDiseaseRisk] = useState(null);
    const [detectionLog, setDetectionLog] = useState([]);
    const [chartData, setChartData] = useState({
        labels: [],
        data: []
    });

    // Fish Disease Detection state (from ML service)
    const [diseaseData, setDiseaseData] = useState(null);
    const [streamConnected, setStreamConnected] = useState(false);

    // Throttle ref for disease data updates
    const lastUpdateRef = useRef(0);

    useEffect(() => {
        // Subscribe to detection updates (existing YOLO flow)
        const unsubscribe = socketService.subscribe('detection', (data) => {
            if (data.fishCount !== undefined) {
                setFishCount(data.fishCount);
            }
            if (data.fps !== undefined) {
                setFps(data.fps);
            }
            if (data.status) {
                setOverallStatus(data.status);
            }
            if (data.risk) {
                setDiseaseRisk(data.risk);
            }

            // Update chart data
            setChartData(prev => ({
                labels: [...prev.labels, new Date()].slice(-30),
                data: [...prev.data, data.fishCount || 0].slice(-30)
            }));

            // Add to detection log
            if (data.message) {
                setDetectionLog(prev => [
                    { message: data.message, time: new Date() },
                    ...prev
                ].slice(0, 10));
            }
        });

        // Subscribe to ML fish disease detections (metadata only — video via MJPEG)
        const unsubDisease = socketService.subscribe('fish-disease-detection', (data) => {
            // Throttle state updates to max 1/second
            const now = Date.now();
            if (now - lastUpdateRef.current >= 1000) {
                lastUpdateRef.current = now;
                setDiseaseData(data);

                // Update Detection Card with real YOLO data
                const count = data.detectionCount || 0;
                setFishCount(count);
                setDiseaseDetectionCount(count);
                setOverallStatus(count > 3 ? 'Critical' : (data.diseaseDetected ? 'Warning' : 'Normal'));
                setDiseaseRisk(data.diseaseDetected ? 'High' : 'Low');

                const statusText = data.diseaseDetected
                    ? `🔴 Disease detected (${data.maxConfidence}%)`
                    : '🟢 Healthy — no disease detected';
                setDetectionLog(prev => [
                    { message: statusText, time: new Date() },
                    ...prev
                ].slice(0, 10));
            }
        });

        return () => {
            unsubscribe();
            unsubDisease();
        };
    }, []);

    // Get disease status styling
    const getDiseaseStyle = () => {
        if (!diseaseData) return { color: 'var(--color-gray-400)', text: 'Waiting...', bg: 'transparent', border: 'var(--color-gray-700)' };
        if (diseaseData.diseaseDetected) {
            return {
                color: '#ff5252',
                text: 'Disease Detected',
                bg: 'rgba(255, 82, 82, 0.1)',
                border: 'rgba(255, 82, 82, 0.3)',
                glow: '0 0 20px rgba(255, 82, 82, 0.3)'
            };
        }
        return {
            color: '#00e676',
            text: 'Healthy',
            bg: 'rgba(0, 230, 118, 0.1)',
            border: 'rgba(0, 230, 118, 0.3)',
            glow: '0 0 20px rgba(0, 230, 118, 0.3)'
        };
    };

    const diseaseStyle = getDiseaseStyle();

    return (
        <div className="fish-page">
            <div className="page-header">
                <h2 className="page-title">Fish Health Monitoring (AI)</h2>
                <p className="page-subtitle">Real-time YOLO-based fish detection and health analysis</p>
            </div>

            {/* AI Fish Disease Detection Card */}
            <div className="card" style={{
                marginBottom: 'var(--spacing-lg)',
                background: diseaseStyle.bg,
                border: `1px solid ${diseaseStyle.border}`,
                boxShadow: diseaseStyle.glow || 'none',
                transition: 'all 0.5s ease'
            }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    🧠 AI Fish Disease Detection
                </h3>

                <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Disease Status */}
                    <div style={{ flex: '1', minWidth: '250px' }}>
                        <div style={{
                            fontSize: '1.8rem',
                            fontWeight: 700,
                            color: diseaseStyle.color,
                            marginBottom: 'var(--spacing-sm)'
                        }}>
                            {diseaseData ? (diseaseData.diseaseDetected ? '🔴' : '🟢') : '⏳'} {diseaseStyle.text}
                        </div>

                        {diseaseData && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-400)' }}>
                                <div>Detections: <strong style={{ color: 'var(--color-white)' }}>{diseaseData.detectionCount}</strong></div>
                                <div>Confidence: <strong style={{ color: 'var(--color-white)' }}>{diseaseData.maxConfidence}%</strong></div>
                                <div>Camera: <strong style={{ color: 'var(--color-white)' }}>{diseaseData.cameraSource || '—'}</strong></div>
                                <div>Updated: {diseaseData.timestamp ? new Date(diseaseData.timestamp).toLocaleTimeString() : '—'}</div>

                                {/* Detection classes */}
                                {diseaseData.detections && diseaseData.detections.length > 0 && (
                                    <div style={{ marginTop: 'var(--spacing-sm)' }}>
                                        {diseaseData.detections.map((d, i) => (
                                            <span key={i} style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                marginRight: '6px',
                                                marginBottom: '4px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: 'rgba(255, 82, 82, 0.2)',
                                                color: '#ff5252',
                                                border: '1px solid rgba(255, 82, 82, 0.3)'
                                            }}>
                                                {d.class} ({d.confidence}%)
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {!diseaseData && (
                            <p style={{ color: 'var(--color-gray-400)', fontSize: '0.85rem' }}>
                                ⏳ Waiting for ML service detection...
                            </p>
                        )}
                    </div>

                    {/* Camera Feed — Direct MJPEG stream from ML service */}
                    <div style={{
                        flex: '1',
                        minWidth: '280px',
                        maxWidth: '480px',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        border: `1px solid ${diseaseStyle.border}`,
                        transition: 'border-color 0.5s ease'
                    }}>
                        <img
                            src={STREAM_URL}
                            alt="Live YOLO Detection Feed"
                            onLoad={() => setStreamConnected(true)}
                            onError={() => setStreamConnected(false)}
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                minHeight: '200px',
                                background: 'var(--color-gray-900)'
                            }}
                        />
                        <div style={{
                            padding: '6px 10px',
                            fontSize: '0.7rem',
                            color: streamConnected ? '#00e676' : 'var(--color-gray-400)',
                            background: 'var(--color-gray-900)',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: streamConnected ? '#00e676' : '#ff5252',
                                display: 'inline-block',
                                animation: streamConnected ? 'pulse 2s infinite' : 'none'
                            }} />
                            {streamConnected ? 'Live YOLO Detection Feed' : 'Connecting to ML stream...'}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Detection Card */}
            <DetectionCard
                fishCount={fishCount}
                overallStatus={overallStatus}
                abnormalBehavior={diseaseDetectionCount > 3 ? 'Abnormal Behavior' : 'Normal Behavior'}
                diseaseRisk={diseaseRisk}
                hasData={diseaseData !== null}
            />

            {/* Detection Log */}
            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Recent Detections</h3>
                <div className="detection-log">
                    {detectionLog.length > 0 ? (
                        detectionLog.map((entry, index) => (
                            <p key={index} style={{
                                padding: 'var(--spacing-sm)',
                                borderBottom: '1px solid var(--color-gray-700)',
                                fontSize: '0.9rem'
                            }}>
                                {entry.message} - <span style={{ opacity: 0.7 }}>{formatRelativeTime(entry.time)}</span>
                            </p>
                        ))
                    ) : (
                        <p style={{ color: 'var(--color-gray-400)' }}>Waiting for detection data...</p>
                    )}
                </div>
            </div>

            {/* Fish Count Chart */}
            {chartData.labels.length > 0 && (
                <ChartPanel
                    title="Fish Count Over Time"
                    datasets={[
                        {
                            sensorType: 'fish',
                            label: 'Fish Count',
                            data: chartData.data
                        }
                    ]}
                    labels={chartData.labels}
                    height={250}
                />
            )}

            <Link to="/" className="btn-back">
                ← Back to Home
            </Link>
        </div>
    );
};

export default Fish;
