import React, { useState, useEffect, useRef } from 'react';

const VideoStream = ({
    streamUrl = null,
    fishCount = 0,
    fps = 0,
    onStreamStart,
    onStreamStop
}) => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [error, setError] = useState(null);
    const containerRef = useRef(null);

    const piStreamUrl = streamUrl || process.env.REACT_APP_PI_STREAM_URL || 'http://raspberrypi:8080/stream';

    const handleStartStream = () => {
        setIsStreaming(true);
        setError(null);
        if (onStreamStart) onStreamStart();
    };

    const handleStopStream = () => {
        setIsStreaming(false);
        if (onStreamStop) onStreamStop();
    };

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleImageError = () => {
        setError('Failed to load stream. Check Raspberry Pi connection.');
        setIsStreaming(false);
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    return (
        <div className="video-container" ref={containerRef}>
            <div className="video-header">
                <h3>Live Camera Feed with YOLO Detection</h3>
                <div className="video-controls">
                    <button
                        className="btn btn-small btn-primary"
                        onClick={isStreaming ? handleStopStream : handleStartStream}
                    >
                        {isStreaming ? 'Stop Stream' : 'Start Stream'}
                    </button>
                    <button
                        className="btn btn-small btn-secondary"
                        onClick={handleToggleFullscreen}
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? '⛶' : '⛶'}
                    </button>
                </div>
            </div>

            <div className="video-wrapper">
                {isStreaming ? (
                    <>
                        <img
                            src={piStreamUrl}
                            alt="Live Stream"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={handleImageError}
                        />
                        <div className="video-overlay">
                            <div className="overlay-stat">
                                <span>Fish: {fishCount}</span>
                            </div>
                            <div className="overlay-stat">
                                <span>FPS: {fps}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="video-placeholder">
                        <div className="icon">📹</div>
                        {error ? (
                            <p style={{ color: 'var(--color-danger)' }}>{error}</p>
                        ) : (
                            <>
                                <p>Camera feed will appear here</p>
                                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                                    Click "Start Stream" to begin
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoStream;
