import React, { useState, useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socket';
import { formatRelativeTime } from '../utils/format';

const MAX_ALERTS = 20;

const DEDUP_INTERVAL_MS = 30000; // Don't repeat same sensor alert for 30s

const NotificationBell = () => {
    const [alerts, setAlerts] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentToast, setCurrentToast] = useState(null);
    const dropdownRef = useRef(null);
    const toastQueueRef = useRef([]);
    const toastTimerRef = useRef(null);
    const lastAlertBySensorRef = useRef({});

    // Get icon for alert type
    const getAlertIcon = (type, source) => {
        if (source === 'pir') return '👁️';
        switch (type) {
            case 'danger': return '🚨';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '🔔';
        }
    };

    // Get color for alert type
    const getAlertColor = (type) => {
        switch (type) {
            case 'danger': return '#e74c3c';
            case 'warning': return '#f39c12';
            case 'info': return '#3498db';
            default: return '#95a5a6';
        }
    };

    // Show next toast from queue (1 at a time, rotating)
    const showNextToast = useCallback(() => {
        if (toastQueueRef.current.length === 0) {
            setCurrentToast(null);
            return;
        }
        const next = toastQueueRef.current.shift();
        setCurrentToast(next);

        // Auto-advance to next toast after 4 seconds
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            showNextToast();
        }, 4000);
    }, []);

    // Queue a toast (deduplicates by sensor)
    const queueToast = useCallback((alert) => {
        // Deduplicate: skip if same sensor alerted within 30s
        const key = alert.sensor || alert.message;
        const now = Date.now();
        if (lastAlertBySensorRef.current[key] && now - lastAlertBySensorRef.current[key] < DEDUP_INTERVAL_MS) {
            return; // Skip duplicate
        }
        lastAlertBySensorRef.current[key] = now;

        toastQueueRef.current.push(alert);

        // If no toast is showing, start showing
        if (!toastTimerRef.current || toastQueueRef.current.length === 1) {
            showNextToast();
        }
    }, [showNextToast]);

    // Subscribe to alerts
    useEffect(() => {
        const unsubscribe = socketService.subscribe('alert', (data) => {
            const alert = {
                type: data.type || 'info',
                message: data.message,
                source: data.source,
                sensor: data.sensor,
                severity: data.severity,
                time: new Date(),
            };

            setAlerts(prev => [alert, ...prev].slice(0, MAX_ALERTS));
            setUnreadCount(prev => prev + 1);

            // Queue toast for danger/warning alerts (1 at a time)
            if (data.type === 'danger' || data.type === 'warning') {
                queueToast(alert);
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(toastTimerRef.current);
        };
    }, [queueToast]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBellClick = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setUnreadCount(0);
        }
    };

    const clearAlerts = () => {
        setAlerts([]);
        setUnreadCount(0);
    };

    const dismissToast = () => {
        clearTimeout(toastTimerRef.current);
        showNextToast(); // Show next one or clear
    };

    return (
        <>
            {/* Bell Button */}
            <div className="notification-wrapper" ref={dropdownRef}>
                <button
                    className="notification-bell"
                    onClick={handleBellClick}
                    title="Notifications"
                >
                    🔔
                    {unreadCount > 0 && (
                        <span className="notification-badge">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {/* Dropdown Panel */}
                {isOpen && (
                    <div className="notification-dropdown">
                        <div className="notification-header">
                            <span className="notification-title">Alerts</span>
                            {alerts.length > 0 && (
                                <button className="clear-btn" onClick={clearAlerts}>
                                    Clear All
                                </button>
                            )}
                        </div>
                        <div className="notification-list">
                            {alerts.length > 0 ? (
                                alerts.map((alert, index) => (
                                    <div
                                        key={index}
                                        className="notification-item"
                                        style={{ borderLeft: `3px solid ${getAlertColor(alert.type)}` }}
                                    >
                                        <span className="notification-icon">
                                            {getAlertIcon(alert.type, alert.source)}
                                        </span>
                                        <div className="notification-content">
                                            <p className="notification-message">{alert.message}</p>
                                            <span className="notification-time">
                                                {formatRelativeTime(alert.time)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="notification-empty">
                                    <span>✅</span>
                                    <p>No alerts — all systems normal</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Single Toast Popup (rotates one by one) */}
            {currentToast && (
                <div className="toast-container">
                    <div
                        key={currentToast.message}
                        className={`toast toast-${currentToast.type}`}
                        onClick={dismissToast}
                    >
                        <span className="toast-icon">
                            {getAlertIcon(currentToast.type, currentToast.source)}
                        </span>
                        <div className="toast-body">
                            <p className="toast-message">{currentToast.message}</p>
                            <span className="toast-time">{formatRelativeTime(currentToast.time)}</span>
                        </div>
                        <span className="toast-close">✕</span>
                    </div>
                </div>
            )}

            <style jsx>{`
                .notification-wrapper {
                    position: relative;
                }

                .notification-bell {
                    position: relative;
                    background: none;
                    border: none;
                    font-size: 1.3rem;
                    cursor: pointer;
                    padding: 6px 10px;
                    border-radius: 8px;
                    transition: background 0.2s ease;
                }

                .notification-bell:hover {
                    background: rgba(255,255,255,0.1);
                }

                .notification-badge {
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    background: #e74c3c;
                    color: white;
                    font-size: 0.6rem;
                    font-weight: 700;
                    min-width: 16px;
                    height: 16px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    animation: badge-pulse 2s infinite;
                }

                @keyframes badge-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                }

                .notification-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    width: 340px;
                    max-height: 420px;
                    background: var(--color-gray-800, #1e293b);
                    border: 1px solid var(--color-gray-700, #334155);
                    border-radius: 12px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
                    z-index: 1000;
                    overflow: hidden;
                    animation: dropdown-in 0.2s ease;
                }

                @keyframes dropdown-in {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .notification-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--color-gray-700, #334155);
                }

                .notification-title {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: white;
                }

                .clear-btn {
                    background: none;
                    border: none;
                    color: var(--color-primary, #3b82f6);
                    font-size: 0.8rem;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                }

                .clear-btn:hover {
                    background: rgba(59,130,246,0.1);
                }

                .notification-list {
                    max-height: 360px;
                    overflow-y: auto;
                }

                .notification-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    padding: 10px 14px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    transition: background 0.2s;
                }

                .notification-item:hover {
                    background: rgba(255,255,255,0.03);
                }

                .notification-icon {
                    font-size: 1.1rem;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .notification-content {
                    flex: 1;
                    min-width: 0;
                }

                .notification-message {
                    font-size: 0.82rem;
                    color: var(--color-gray-200, #e2e8f0);
                    margin: 0;
                    line-height: 1.4;
                    word-wrap: break-word;
                }

                .notification-time {
                    font-size: 0.7rem;
                    color: var(--color-gray-500, #64748b);
                    margin-top: 2px;
                    display: block;
                }

                .notification-empty {
                    text-align: center;
                    padding: 30px 16px;
                    color: var(--color-gray-400, #94a3b8);
                }

                .notification-empty span {
                    font-size: 2rem;
                    display: block;
                    margin-bottom: 8px;
                }

                .notification-empty p {
                    font-size: 0.85rem;
                    margin: 0;
                }

                /* Toast Container */
                .toast-container {
                    position: fixed;
                    top: 70px;
                    right: 20px;
                    z-index: 2000;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    pointer-events: none;
                }

                .toast {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    border-radius: 10px;
                    min-width: 280px;
                    max-width: 380px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                    cursor: pointer;
                    pointer-events: auto;
                    animation: toast-in 0.35s ease;
                    backdrop-filter: blur(12px);
                }

                .toast-danger {
                    background: rgba(231, 76, 60, 0.92);
                    border: 1px solid rgba(231, 76, 60, 0.5);
                    color: white;
                }

                .toast-warning {
                    background: rgba(243, 156, 18, 0.92);
                    border: 1px solid rgba(243, 156, 18, 0.5);
                    color: white;
                }

                .toast-info {
                    background: rgba(52, 152, 219, 0.92);
                    border: 1px solid rgba(52, 152, 219, 0.5);
                    color: white;
                }

                .toast-icon {
                    font-size: 1.3rem;
                    flex-shrink: 0;
                }

                .toast-body {
                    flex: 1;
                }

                .toast-message {
                    font-size: 0.85rem;
                    font-weight: 500;
                    margin: 0;
                    line-height: 1.3;
                }

                .toast-time {
                    font-size: 0.7rem;
                    opacity: 0.8;
                    margin-top: 2px;
                    display: block;
                }

                .toast-close {
                    font-size: 0.85rem;
                    opacity: 0.7;
                    cursor: pointer;
                    padding: 2px 6px;
                    flex-shrink: 0;
                }

                @keyframes toast-in {
                    from {
                        opacity: 0;
                        transform: translateX(60px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>
        </>
    );
};

export default NotificationBell;
