import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import socketService from '../services/socket';
import NotificationBell from './NotificationBell';
import { getCurrentTime } from '../utils/format';

const Navbar = () => {
    const location = useLocation();
    const [currentTime, setCurrentTime] = useState(getCurrentTime());
    // Check initial connection status immediately
    const [isConnected, setIsConnected] = useState(socketService.isConnected());
    const [connectionStatus, setConnectionStatus] = useState(
        socketService.isConnected() ? 'Connected' : 'Connecting...'
    );

    useEffect(() => {
        // Update time every second
        const timer = setInterval(() => {
            setCurrentTime(getCurrentTime());
        }, 1000);

        // Connect to socket (safe to call multiple times — skips if already connected)
        socketService.connect();

        // Check connection status immediately in case we missed the 'connect' event
        if (socketService.isConnected()) {
            setIsConnected(true);
            setConnectionStatus('Connected');
        }

        // Subscribe to future connection status changes
        const unsubscribe = socketService.subscribe('connection', (data) => {
            setIsConnected(data.connected);
            setConnectionStatus(data.connected ? 'Connected' : 'Disconnected');
        });

        // Poll connection status every 3 seconds as a safety net
        const connectionCheck = setInterval(() => {
            const connected = socketService.isConnected();
            setIsConnected(connected);
            if (connected) {
                setConnectionStatus('Connected');
            }
        }, 3000);

        return () => {
            clearInterval(timer);
            clearInterval(connectionCheck);
            unsubscribe();
        };
    }, []);

    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <header className="header">
            <div className="header-left">
                <div className="connection-status">
                    <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                    <span>{connectionStatus}</span>
                </div>
                <div className="time">{currentTime}</div>
            </div>

            <Link to="/" style={{ textDecoration: 'none' }}>
                <h1>AquaSense360</h1>
            </Link>

            <div className="header-right">
                <nav className="nav-links">
                    <Link to="/" className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
                        Home
                    </Link>
                    <Link to="/fish" className={`nav-link ${isActive('/fish') ? 'active' : ''}`}>
                        Fish
                    </Link>
                    <Link to="/water" className={`nav-link ${isActive('/water') ? 'active' : ''}`}>
                        Water
                    </Link>
                    <Link to="/air" className={`nav-link ${isActive('/air') ? 'active' : ''}`}>
                        Air
                    </Link>
                    <Link to="/components" className={`nav-link ${isActive('/components') ? 'active' : ''}`}>
                        Controls
                    </Link>
                    <Link to="/security" className={`nav-link ${isActive('/security') ? 'active' : ''}`}>
                        🛡️ Security
                    </Link>
                </nav>
                <NotificationBell />
            </div>
        </header>
    );
};

export default Navbar;
