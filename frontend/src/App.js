import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import PageLoader from './components/PageLoader';
import { SensorProvider } from './contexts/SensorContext';
import socketService from './services/socket';

// Lazy load all pages for code splitting
const Home = React.lazy(() => import('./pages/Home'));
const Fish = React.lazy(() => import('./pages/Fish'));
const Water = React.lazy(() => import('./pages/Water'));
const Air = React.lazy(() => import('./pages/Air'));
const Components = React.lazy(() => import('./pages/Components'));
const Reports = React.lazy(() => import('./pages/Reports'));

function App() {
  // Connect to WebSocket when app starts
  useEffect(() => {
    console.log('🔌 Connecting to WebSocket...');
    socketService.connect();

    return () => {
      console.log('🔌 Disconnecting WebSocket...');
      socketService.disconnect();
    };
  }, []);

  return (
    <Router>
      <SensorProvider>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/fish" element={<Fish />} />
                <Route path="/water" element={<Water />} />
                <Route path="/air" element={<Air />} />
                <Route path="/components" element={<Components />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </Suspense>
          </main>
          <footer className="footer">
            <div className="footer-content">
              <p>© 2025 AquaSense360 | IoT-Based Smart Fish Health Monitoring System</p>
              <p className="footer-meta">ESP32 + Raspberry Pi 3 + YOLO</p>
            </div>
          </footer>
        </div>
      </SensorProvider>
    </Router>
  );
}

export default App;
