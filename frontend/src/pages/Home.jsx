import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
    const menuItems = [
        {
            path: '/fish',
            icon: '🐟',
            title: 'Fish Health Details',
            description: 'AI-powered fish detection and health monitoring'
        },
        {
            path: '/water',
            icon: '💧',
            title: 'Water Quality Details',
            description: 'Temperature, pH, Turbidity, TDS monitoring'
        },
        {
            path: '/air',
            icon: '🌬️',
            title: 'Air Quality Details',
            description: 'CO2 level and air quality monitoring'
        },
        {
            path: '/components',
            icon: '⚙️',
            title: 'Components Status',
            description: 'Control actuators and view system status'
        },
        {
            path: '/reports',
            icon: '📊',
            title: 'Reports & Analytics',
            description: 'Historical data and trend analysis'
        }
    ];

    return (
        <div className="home-page">
            <div className="welcome-section">
                <h2>Welcome to AquaSense360</h2>
                <p className="welcome-text">Smart Fish Health Monitoring System</p>
                <p className="welcome-subtext">
                    Select a section below to view detailed monitoring information
                </p>
            </div>

            <div className="menu-grid">
                {menuItems.map((item) => (
                    <Link key={item.path} to={item.path} className="menu-card">
                        <div className="menu-icon">{item.icon}</div>
                        <div className="menu-text">
                            <h3>{item.title}</h3>
                            <p>{item.description}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default Home;
