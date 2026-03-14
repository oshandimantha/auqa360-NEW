import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';
import { formatRelativeTime } from '../utils/format';

const SECURITY_STREAM_URL = 'http://localhost:8766/video_feed';

const STREAM_HOST = window.location.hostname !== 'localhost'
    ? `http://${window.location.hostname}:8766/video_feed`
    : SECURITY_STREAM_URL;

const Security = () => {
    const [securityData, setSecurityData] = useState(null);
    const [streamOnline, setStreamOnline] = useState(false);
    const [lastDetection, setLastDetection] = useState(null);
    const [recentDetections, setRecentDetections] = useState([]);
    const imgRef = useRef(null);

    // Check stream availability
    useEffect(() => {
        const checkStream = () => {
            const img = new Image();
            img.onload = () => setStreamOnline(true);
            img.onerror = () => setStreamOnline(false);
            img.src = `${STREAM_HOST.replace('/video_feed', '/health')}?t=${Date.now()}`;
        };
        checkStream();
        const interval = setInterval(checkStream, 5000);
        return () => clearInterval(interval);
    }, []);

    // Subscribe to security socket events
    useEffect(() => {
        const unsubscribe = socketService.subscribe('security-update', (data) => {
            setSecurityData(data);
            if (data.detectionCount > 0) {
                setLastDetection(new Date());
                setRecentDetections(prev => [
                    {
                        classes: data.detectedClasses,
                        confidence: data.maxConfidence,
                        time: new Date(),
                        personDetected: data.personDetected,
                        animalDetected: data.animalDetected,
                    },
                    ...prev
                ].slice(0, 15));
            }
        });
        return () => unsubscribe();
    }, []);

    const hasDetection = securityData && securityData.detectionCount > 0;

    return (
        <div className="page security-page">
            <div className="page-header">
                <h2> AI Security Detection</h2>
                <p className="page-subtitle">Real-time human &amp; animal detection using YOLO</p>
            </div>

            <div className="security-layout">
                {/* Live Stream */}
                <div className="security-stream-card">
                    <div className="stream-header">
                        <span className="stream-title">📷 Security Camera Live Feed</span>
                        <span className={`stream-badge ${streamOnline ? 'badge-online' : 'badge-offline'}`}>
                            {streamOnline ? '● LIVE' : '○ OFFLINE'}
                        </span>
                    </div>
                    <div className="stream-wrapper">
                        {streamOnline ? (
                            <img
                                ref={imgRef}
                                src={STREAM_HOST}
                                alt="Security Camera Stream"
                                className="security-stream-img"
                                onError={() => setStreamOnline(false)}
                            />
                        ) : (
                            <div className="stream-placeholder">
                                <span>📷</span>
                                <p>Security camera stream offline</p>
                                <small>Make sure ML service is running with a second USB camera</small>
                            </div>
                        )}

                        {/* Live Detection Overlay */}
                        {hasDetection && (
                            <div className="detection-overlay-badge">
                                {securityData.personDetected && <span className="det-tag person">👤 Person</span>}
                                {securityData.animalDetected && <span className="det-tag animal">🐾 Animal</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel */}
                <div className="security-info-panel">
                    {/* Current Status */}
                    <div className={`security-status-card ${hasDetection ? 'status-alert' : 'status-clear'}`}>
                        <div className="status-icon-large">
                            {hasDetection
                                ? (securityData.personDetected ? '⚠️' : '🐾')
                                : '✅'}
                        </div>
                        <div className="status-text">
                            <h3>{hasDetection
                                ? (securityData.personDetected ? 'Person Detected!' : 'Animal Detected!')
                                : 'Area Clear'}</h3>
                            <p>{hasDetection
                                ? `${securityData.detectionCount} object(s) — ${securityData.maxConfidence.toFixed(0)}% confidence`
                                : 'No humans or animals detected'}</p>
                        </div>
                    </div>

                    {/* Current Detections */}
                    {hasDetection && (
                        <div className="detection-list-card">
                            <h4>Current Detections</h4>
                            {securityData.detections.map((det, i) => (
                                <div key={i} className="det-item">
                                    <span className="det-class">
                                        {det.class === 'person' ? '👤' : '🐾'} {det.class}
                                    </span>
                                    <span className="det-conf">{det.confidence.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="security-stats-card">
                        <h4>Detection Stats</h4>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <span className="stat-label">Last Detection</span>
                                <span className="stat-value">
                                    {lastDetection ? formatRelativeTime(lastDetection) : 'None'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Inference Time</span>
                                <span className="stat-value">
                                    {securityData ? `${securityData.inferenceMs}ms` : '—'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Camera Source</span>
                                <span className="stat-value">
                                    {securityData ? `Camera ${securityData.cameraSource}` : '—'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Stream Status</span>
                                <span className={`stat-value ${streamOnline ? 'text-green' : 'text-red'}`}>
                                    {streamOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Detection History */}
                    <div className="detection-history-card">
                        <h4>Recent Detections</h4>
                        {recentDetections.length > 0 ? (
                            <div className="history-list">
                                {recentDetections.map((item, i) => (
                                    <div key={i} className="history-item">
                                        <span className="history-icon">
                                            {item.personDetected ? '👤' : '🐾'}
                                        </span>
                                        <span className="history-classes">
                                            {item.classes.join(', ')}
                                        </span>
                                        <span className="history-time">
                                            {formatRelativeTime(item.time)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-history">No detections recorded this session</p>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .security-page {
                    padding: 24px;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 24px;
                }

                .page-header h2 {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: var(--color-gray-100, #f1f5f9);
                    margin: 0 0 4px 0;
                }

                .page-subtitle {
                    color: var(--color-gray-400, #94a3b8);
                    font-size: 0.9rem;
                    margin: 0;
                }

                .security-layout {
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 20px;
                    align-items: start;
                }

                @media (max-width: 1024px) {
                    .security-layout {
                        grid-template-columns: 1fr;
                    }
                }

                /* Stream Card */
                .security-stream-card {
                    background: var(--color-gray-800, #1e293b);
                    border: 1px solid var(--color-gray-700, #334155);
                    border-radius: 14px;
                    overflow: hidden;
                }

                .stream-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 14px 18px;
                    border-bottom: 1px solid var(--color-gray-700, #334155);
                }

                .stream-title {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: var(--color-gray-200, #e2e8f0);
                }

                .stream-badge {
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 20px;
                    letter-spacing: 0.5px;
                }

                .badge-online {
                    background: rgba(34, 197, 94, 0.15);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    animation: pulse-green 2s infinite;
                }

                .badge-offline {
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }

                @keyframes pulse-green {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                .stream-wrapper {
                    position: relative;
                    background: #0f172a;
                    min-height: 360px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .security-stream-img {
                    width: 100%;
                    height: auto;
                    display: block;
                }

                .stream-placeholder {
                    text-align: center;
                    color: var(--color-gray-500, #64748b);
                    padding: 60px 20px;
                }

                .stream-placeholder span {
                    font-size: 3rem;
                    display: block;
                    margin-bottom: 12px;
                }

                .stream-placeholder p {
                    font-size: 1rem;
                    margin: 0 0 6px 0;
                    color: var(--color-gray-400, #94a3b8);
                }

                .stream-placeholder small {
                    font-size: 0.78rem;
                    color: var(--color-gray-500, #64748b);
                }

                .detection-overlay-badge {
                    position: absolute;
                    bottom: 12px;
                    left: 12px;
                    display: flex;
                    gap: 8px;
                }

                .det-tag {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    backdrop-filter: blur(8px);
                }

                .det-tag.person {
                    background: rgba(239, 68, 68, 0.85);
                    color: white;
                    animation: pulse-alert 1s infinite;
                }

                .det-tag.animal {
                    background: rgba(245, 158, 11, 0.85);
                    color: white;
                }

                @keyframes pulse-alert {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }

                /* Info Panel */
                .security-info-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .security-status-card {
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    border: 1px solid;
                    transition: all 0.3s ease;
                }

                .status-clear {
                    background: rgba(34, 197, 94, 0.08);
                    border-color: rgba(34, 197, 94, 0.25);
                }

                .status-alert {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.35);
                    animation: border-pulse 1.5s infinite;
                }

                @keyframes border-pulse {
                    0%, 100% { border-color: rgba(239, 68, 68, 0.35); }
                    50% { border-color: rgba(239, 68, 68, 0.7); }
                }

                .status-icon-large {
                    font-size: 2.2rem;
                    flex-shrink: 0;
                }

                .status-text h3 {
                    margin: 0 0 4px 0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--color-gray-100, #f1f5f9);
                }

                .status-text p {
                    margin: 0;
                    font-size: 0.82rem;
                    color: var(--color-gray-400, #94a3b8);
                }

                /* Detection list */
                .detection-list-card,
                .security-stats-card,
                .detection-history-card {
                    background: var(--color-gray-800, #1e293b);
                    border: 1px solid var(--color-gray-700, #334155);
                    border-radius: 12px;
                    padding: 16px;
                }

                .detection-list-card h4,
                .security-stats-card h4,
                .detection-history-card h4 {
                    margin: 0 0 12px 0;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-gray-300, #cbd5e1);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .det-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .det-item:last-child {
                    border-bottom: none;
                }

                .det-class {
                    font-size: 0.85rem;
                    color: var(--color-gray-200, #e2e8f0);
                    text-transform: capitalize;
                }

                .det-conf {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #f59e0b;
                }

                /* Stats */
                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }

                .stat-item {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .stat-label {
                    font-size: 0.7rem;
                    color: var(--color-gray-500, #64748b);
                    text-transform: uppercase;
                    letter-spacing: 0.4px;
                }

                .stat-value {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-gray-200, #e2e8f0);
                }

                .text-green { color: #22c55e; }
                .text-red { color: #ef4444; }

                /* History */
                .history-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    max-height: 200px;
                    overflow-y: auto;
                }

                .history-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 5px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    font-size: 0.8rem;
                }

                .history-icon {
                    font-size: 1rem;
                    flex-shrink: 0;
                }

                .history-classes {
                    flex: 1;
                    color: var(--color-gray-200, #e2e8f0);
                    text-transform: capitalize;
                }

                .history-time {
                    color: var(--color-gray-500, #64748b);
                    flex-shrink: 0;
                    font-size: 0.72rem;
                }

                .no-history {
                    font-size: 0.82rem;
                    color: var(--color-gray-500, #64748b);
                    text-align: center;
                    margin: 8px 0 0 0;
                }
            `}</style>
        </div>
    );
};

export default Security;
