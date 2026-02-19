import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import VideoStream from '../components/VideoStream';
import DetectionCard from '../components/DetectionCard';
import ChartPanel from '../components/ChartPanel';
import socketService from '../services/socket';
import { formatRelativeTime } from '../utils/format';

const Fish = () => {
    const [fishCount, setFishCount] = useState(0);
    const [fps, setFps] = useState(0);
    const [overallStatus, setOverallStatus] = useState('Normal');
    const [abnormalBehavior, setAbnormalBehavior] = useState('None detected');
    const [diseaseRisk, setDiseaseRisk] = useState('Low');
    const [detectionLog, setDetectionLog] = useState([]);
    const [chartData, setChartData] = useState({
        labels: [],
        data: []
    });

    useEffect(() => {
        // Subscribe to detection updates
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
            if (data.abnormal) {
                setAbnormalBehavior(data.abnormal);
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

        return () => {
            unsubscribe();
        };
    }, []);

    const handleStreamStart = () => {
        socketService.startStream();
    };

    const handleStreamStop = () => {
        socketService.stopStream();
    };

    return (
        <div className="fish-page">
            <div className="page-header">
                <h2 className="page-title">Fish Health Monitoring (AI)</h2>
                <p className="page-subtitle">Real-time YOLO-based fish detection and health analysis</p>
            </div>

            {/* Video Stream */}
            <VideoStream
                fishCount={fishCount}
                fps={fps}
                onStreamStart={handleStreamStart}
                onStreamStop={handleStreamStop}
            />

            {/* AI Detection Card */}
            <DetectionCard
                fishCount={fishCount}
                overallStatus={overallStatus}
                abnormalBehavior={abnormalBehavior}
                diseaseRisk={diseaseRisk}
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
