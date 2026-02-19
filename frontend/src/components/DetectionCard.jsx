import React from 'react';

const DetectionCard = ({
    fishCount = 0,
    overallStatus = 'Normal',
    abnormalBehavior = 'None detected',
    diseaseRisk = 'Low',
    lastDetectionTime = null
}) => {
    const getStatusColor = (status) => {
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
                        {overallStatus}
                    </span>
                </div>

                <div className="detection-stat">
                    <span className="stat-label">Fish Count</span>
                    <span className="stat-value">{fishCount}</span>
                </div>

                <div className="detection-stat">
                    <span className="stat-label">Abnormal Behavior</span>
                    <span
                        className="stat-value"
                        style={{
                            color: abnormalBehavior === 'None detected'
                                ? 'var(--color-success)'
                                : 'var(--color-warning)'
                        }}
                    >
                        {abnormalBehavior}
                    </span>
                </div>

                <div className="detection-stat">
                    <span className="stat-label">Disease Risk</span>
                    <span
                        className="stat-value"
                        style={{ color: getStatusColor(diseaseRisk) }}
                    >
                        {diseaseRisk}
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
