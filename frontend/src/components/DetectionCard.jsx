import React from 'react';

const DetectionCard = ({
    fishCount = null,
    overallStatus = null,
    abnormalBehavior = 'Normal Behavior',
    diseaseRisk = null,
    lastDetectionTime = null,
    hasData = false
}) => {
    const getStatusColor = (status) => {
        if (!status) return 'var(--color-gray-400)';
        switch (status.toLowerCase()) {
            case 'normal':
            case 'low':
                return 'var(--color-success)';
            case 'warning':
            case 'medium':
                return 'var(--color-warning)';
            case 'critical':
            case 'high':
                return 'var(--color-danger)';
            default:
                return 'var(--color-gray-400)';
        }
    };

    const getBehaviorColor = (behavior) => {
        if (!hasData) return 'var(--color-gray-400)';
        if (behavior === 'Abnormal Behavior') return 'var(--color-danger)';
        return 'var(--color-success)';
    };

    return (
        <div className="card detection-card">
            <div className="card-header">
                <div className="card-icon">🐟</div>
                <h3 className="card-title">AI Detection Status</h3>
            </div>

            <div className="detection-stats">
                <div className="detection-stat">
                    <span className="stat-label">Overall Status</span>
                    <span
                        className="stat-value"
                        style={{ color: getStatusColor(overallStatus) }}
                    >
                        {hasData ? overallStatus : 'Waiting...'}
                    </span>
                </div>

                <div className="detection-stat">
                    <span className="stat-label">Fish Disease Count</span>
                    <span className="stat-value">
                        {hasData ? (fishCount !== null ? fishCount : '—') : '—'}
                    </span>
                </div>

                <div className="detection-stat">
                    <span className="stat-label">Behavior</span>
                    <span
                        className="stat-value"
                        style={{ color: getBehaviorColor(abnormalBehavior) }}
                    >
                        {hasData ? abnormalBehavior : 'Waiting...'}
                    </span>
                </div>

                <div className="detection-stat">
                    <span className="stat-label">Disease Risk</span>
                    <span
                        className="stat-value"
                        style={{ color: getStatusColor(diseaseRisk) }}
                    >
                        {hasData ? diseaseRisk : 'Waiting...'}
                    </span>
                </div>
            </div>

            <style jsx>{`
        .detection-card {
          margin-top: var(--spacing-lg);
        }
        
        .detection-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-md);
        }
        
        .detection-stat {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          padding: var(--spacing-md);
          background: rgba(0, 0, 0, 0.2);
          border-radius: var(--border-radius-md);
        }
        
        .stat-label {
          font-size: 0.8rem;
          color: var(--color-gray-400);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .stat-value {
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        @media (max-width: 480px) {
          .detection-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    );
};

export default DetectionCard;
