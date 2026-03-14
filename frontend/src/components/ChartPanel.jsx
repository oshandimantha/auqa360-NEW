import React, { useRef } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from 'react-chartjs-2';
import { CHART_COLORS } from '../utils/thresholds';
import { formatChartLabel } from '../utils/format';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    zoomPlugin
);

const ChartPanel = ({
    title = 'Sensor Trend',
    datasets = [],
    labels = [],
    height = 300,
    showLegend = true,
    period = 'daily'
}) => {
    const chartRef = useRef(null);

    // Build chart datasets
    const chartData = {
        labels: labels.map(l => formatChartLabel(l, period)),
        datasets: datasets.map((ds, index) => {
            const colors = CHART_COLORS[ds.sensorType] || {
                line: `hsl(${index * 60}, 70%, 50%)`,
                background: `hsla(${index * 60}, 70%, 50%, 0.1)`
            };

            return {
                label: ds.label || ds.sensorType,
                data: ds.data,
                borderColor: colors.line,
                backgroundColor: colors.background,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: colors.line
            };
        })
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: {
            legend: {
                display: showLegend,
                position: 'top',
                labels: {
                    color: '#9999b3',
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        family: 'Inter, sans-serif',
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(30, 30, 46, 0.95)',
                titleColor: '#fff',
                bodyColor: '#9999b3',
                borderColor: 'rgba(10, 147, 150, 0.5)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                titleFont: {
                    family: 'Inter, sans-serif',
                    size: 14,
                    weight: '600'
                },
                bodyFont: {
                    family: 'Inter, sans-serif',
                    size: 12
                }
            },
            zoom: {
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    mode: 'x'
                },
                pan: {
                    enabled: true,
                    mode: 'x'
                },
                limits: {
                    x: { minRange: 2 }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#5a5a7a',
                    font: {
                        family: 'Inter, sans-serif',
                        size: 11
                    },
                    maxRotation: 30,
                    maxTicksLimit: period === 'daily' ? 12 : period === 'weekly' ? 14 : 15
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#5a5a7a',
                    font: {
                        family: 'Inter, sans-serif',
                        size: 11
                    }
                }
            }
        },
        animation: {
            duration: 500
        }
    };

    const handleResetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
        }
    };

    return (
        <div className="chart-container">
            <div className="chart-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="chart-title">{title}</h3>
                <button
                    onClick={handleResetZoom}
                    title="Reset Zoom"
                    style={{
                        background: 'rgba(10, 147, 150, 0.15)',
                        border: '1px solid rgba(10, 147, 150, 0.4)',
                        borderRadius: '6px',
                        color: '#0a9396',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(10, 147, 150, 0.3)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(10, 147, 150, 0.15)'}
                >
                    ↺ Reset Zoom
                </button>
            </div>
            <p style={{ margin: '2px 0 8px', fontSize: '0.7rem', color: '#5a5a7a' }}>
                🖱️ Drag to pan • Scroll wheel to zoom
            </p>
            <div className="chart-wrapper" style={{ height }}>
                <Line ref={chartRef} data={chartData} options={options} />
            </div>
        </div>
    );
};

export default ChartPanel;
