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
import { Line } from 'react-chartjs-2';
import { CHART_COLORS } from '../utils/thresholds';
import { formatChartTime } from '../utils/format';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const ChartPanel = ({
    title = 'Sensor Trend',
    datasets = [],
    labels = [],
    height = 300,
    showLegend = true
}) => {
    const chartRef = useRef(null);

    // Build chart datasets
    const chartData = {
        labels: labels.map(l => formatChartTime(l)),
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
                    maxRotation: 0
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

    return (
        <div className="chart-container">
            <div className="chart-header">
                <h3 className="chart-title">{title}</h3>
            </div>
            <div className="chart-wrapper" style={{ height }}>
                <Line ref={chartRef} data={chartData} options={options} />
            </div>
        </div>
    );
};

export default ChartPanel;
