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
    const [streamError, setStreamError] = useState(false);
    const [streamConnecting, setStreamConnecting] = useState(true);
    const [lastDetection, setLastDetection] = useState(null);
    const [recentDetections, setRecentDetections] = useState([]);
    const imgRef = useRef(null);
    const retryTimerRef = useRef(null);

    // Check stream availability via /health JSON endpoint
    useEffect(() => {
        const checkStream = async () => {
            try {
                const res = await fetch(
                    `${STREAM_HOST.replace('/video_feed', '/health')}?t=${Date.now()}`,
                    { signal: AbortSignal.timeout(3000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    const isLive = data.stream === true;
                    setStreamOnline(isLive);
                    setStreamConnecting(!isLive);
                    if (isLive) setStreamError(false);
                } else {
                    setStreamOnline(false);
                    setStreamConnecting(false);
                }
            } catch {
                setStreamOnline(false);
                setStreamConnecting(false);
            }
        };
        checkStream();
        const interval = setInterval(checkStream, 4000);
        return () => clearInterval(interval);
    }, []);

    // Auto-retry when stream img errors
    const handleStreamError = () => {
        setStreamError(true);
        setStreamOnline(false);
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
            if (imgRef.current) {
                imgRef.current.src = `${STREAM_HOST}?t=${Date.now()}`;
                setStreamError(false);
            }
        }, 3000);
    };

    const handleStreamLoad = () => {
        setStreamOnline(true);
        setStreamError(false);
        setStreamConnecting(false);
    };

    // Subscribe to security socket events
    useEffect(() => {
        const unsubscribe = socketService.subscribe('security-update', (data) => {
            setSecurityData(data);

            const pCount = (data.detections || []).filter(d => d.class === 'person').length;
            const isAnimal = data.animalDetected;

            // Only add to history if there's an actual alert (3+ humans OR any animal)
            if (pCount > 3 || isAnimal) {
                setLastDetection(new Date());

                // Build summary for history list
                const summary = [
                    ...(pCount > 0 ? [`${pCount} Person${pCount > 1 ? 's' : ''}`] : []),
                    ...((data.detections || [])
                        .filter(d => d.class !== 'person')
                        .reduce((acc, d) => {
                            const existing = acc.find(a => a.cls === d.class);
                            if (existing) existing.count++;
                            else acc.push({ cls: d.class, count: 1 });
                            return acc;
                        }, [])
                        .map(a => `${a.count} ${a.cls.charAt(0).toUpperCase() + a.cls.slice(1)}${a.count > 1 ? 's' : ''}`)
                    )
                ].join(', ');

                setRecentDetections(prev => [
                    {
                        classes: data.detectedClasses || [],
                        summary: summary,
                        personCount: pCount,
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

    const personCount = securityData
        ? securityData.detections.filter(d => d.class === 'person').length
        : 0;
    const animalDetected = securityData ? securityData.animalDetected : false;

    // Alert only when: 3+ humans OR any animal detected
    const hasDetection = (personCount > 3) || animalDetected;

    // Build a readable summary of what was detected
    const detectedSummary = securityData ? [
        ...(personCount > 0 ? [`${personCount} Person${personCount > 1 ? 's' : ''}`] : []),
        ...(securityData.detections
            .filter(d => d.class !== 'person')
            .reduce((acc, d) => {
                const existing = acc.find(a => a.cls === d.class);
                if (existing) existing.count++;
                else acc.push({ cls: d.class, count: 1 });
                return acc;
            }, [])
            .map(a => `${a.count} ${a.cls.charAt(0).toUpperCase() + a.cls.slice(1)}${a.count > 1 ? 's' : ''}`)
        )
    ].join(', ') : '';

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
                        <span className={`stream-badge ${streamError ? 'badge-offline' :
                            streamConnecting ? 'badge-connecting' :
                                streamOnline ? 'badge-online' : 'badge-offline'
                            }`}>
                            {streamError ? '○ OFFLINE' :
                                streamConnecting ? '◌ CONNECTING' :
                                    streamOnline ? '● LIVE' : '○ OFFLINE'}
                        </span>
                    </div>
                    <div className="stream-wrapper">
                        {/* Always render the img — MJPEG streams handle their own state */}
                        <img
                            ref={imgRef}
                            src={STREAM_HOST}
                            alt="Security Camera Stream"
                            className="security-stream-img"
                            style={{ display: streamError ? 'none' : 'block' }}
                            onLoad={handleStreamLoad}
                            onError={handleStreamError}
                        />
                        {streamError && (
                            <div className="stream-placeholder">
                                <span>📷</span>
                                <p>Security camera stream offline</p>
                                <small>Make sure ML service is running with a second USB camera</small>
                                <button
                                    onClick={() => {
                                        setStreamError(false);
                                        if (imgRef.current) imgRef.current.src = `${STREAM_HOST}?t=${Date.now()}`;
                                    }}
                                    style={{ marginTop: '12px', padding: '6px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '0.8rem' }}
                                >
                                    🔄 Retry
                                </button>
                            </div>
                        )}
                        {streamConnecting && !streamError && (
                            <div style={{ position: 'absolute', bottom: '12px', left: '12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                ⏳ Connecting to camera...
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

                    {/* Live Detection Card - always visible */}
                    <div className="detection-list-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0 }}>🔍 Live Detections</h4>
                            {securityData ? (
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-400)' }}>
                                    Cam {securityData.cameraSource} · {securityData.inferenceMs}ms
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-500)' }}>Waiting…</span>
                            )}
                        </div>

                        {securityData && (securityData.detections || []).length > 0 ? (
                            <div className="live-detection-table">
                                {/* Group by class */}
                                {Object.entries(
                                    (securityData.detections || []).reduce((acc, d) => {
                                        const cls = d.class || 'unknown';
                                        if (!acc[cls]) acc[cls] = { count: 0, maxConf: 0 };
                                        acc[cls].count++;
                                        if (d.confidence > acc[cls].maxConf) acc[cls].maxConf = d.confidence;
                                        return acc;
                                    }, {})
                                ).map(([cls, info]) => (
                                    <div key={cls} className="live-det-row">
                                        <span className="live-det-icon">{cls === 'person' ? '👤' : '🐾'}</span>
                                        <span className="live-det-class">{cls.charAt(0).toUpperCase() + cls.slice(1)}</span>
                                        <span className="live-det-count">×{info.count}</span>
                                        <span className={`live-det-badge ${cls === 'person' && info.count > 3 ? 'badge-danger' : cls !== 'person' ? 'badge-warning' : 'badge-ok'}`}>
                                            {cls === 'person' && info.count > 3 ? '⚠ ALERT' : cls !== 'person' ? '⚠ ANIMAL' : '●'}
                                        </span>
                                    </div>
                                ))}
                                <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--color-gray-500)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                                    🕐 {new Date().toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '0.85rem' }}>
                                {securityData
                                    ? <><span style={{ color: '#22c55e', fontSize: '0.7rem' }}>● Monitoring</span> — No detections<br /><small style={{ color: 'var(--color-gray-600)' }}>Camera {securityData.cameraSource} active</small></>
                                    : 'Waiting for ML service...'}
                            </div>
                        )}
                    </div>

                    {/* Detection Stats */}
                    <div className="security-stats-card">
                        <h4>Detection Stats</h4>
                        <div className="stats-grid">
                            <div className="stat-item">
                                <span className="stat-label">Last Alert</span>
                                <span className="stat-value">
                                    {lastDetection
                                        ? new Date(lastDetection).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })
                                        : 'None'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Camera Source</span>
                                <span className="stat-value">
                                    {securityData ? `Camera ${securityData.cameraSource}` : '—'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Inference</span>
                                <span className="stat-value">
                                    {securityData ? `${securityData.inferenceMs}ms` : '—'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Stream</span>
                                <span className={`stat-value ${streamOnline ? 'text-green' : 'text-red'}`}>
                                    {streamOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detection History */}
                    <div className="detection-history-card">
                        <h4>Recent Detection Alerts</h4>
                        {recentDetections.length > 0 ? (
                            <div className="history-list">
                                {recentDetections.map((item, i) => (
                                    <div key={i} className="history-item">
                                        <span className="history-icon">
                                            {item.personCount > 3 ? '⚠️' : '🐾'}
                                        </span>
                                        <span className="history-classes">
                                            {item.summary}
                                        </span>
                                        <span className="history-time">
                                            {new Date(item.time).toLocaleString('en-US', {
                                                month: 'short', day: '2-digit',
                                                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                                            })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="no-history">No alerts recorded this session</p>
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

                .badge-connecting {
                    background: rgba(251, 191, 36, 0.15);
                    color: #fbbf24;
                    border: 1px solid rgba(251, 191, 36, 0.3);
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

                /* Live detection table */
                .live-detection-table {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .live-det-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                }

                .live-det-icon { font-size: 1.1rem; flex-shrink: 0; }

                .live-det-class {
                    flex: 1;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--color-gray-100, #f1f5f9);
                }

                .live-det-count {
                    font-size: 0.82rem;
                    color: var(--color-gray-400);
                    min-width: 28px;
                }

                .live-det-conf {
                    font-size: 0.78rem;
                    color: var(--color-gray-400);
                    min-width: 38px;
                    text-align: right;
                }

                .live-det-badge {
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 4px;
                    letter-spacing: 0.04em;
                }

                .badge-danger {
                    background: rgba(239,68,68,0.2);
                    color: #ef4444;
                    border: 1px solid rgba(239,68,68,0.35);
                    animation: border-pulse 1.2s infinite;
                }

                .badge-warning {
                    background: rgba(245,158,11,0.2);
                    color: #f59e0b;
                    border: 1px solid rgba(245,158,11,0.35);
                }

                .badge-ok {
                    background: rgba(100,116,139,0.15);
                    color: var(--color-gray-400);
                    border: 1px solid rgba(255,255,255,0.08);
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
