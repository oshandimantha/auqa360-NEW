// Format sensor value with unit
export const formatValue = (value, unit = '') => {
    if (value === null || value === undefined || isNaN(value)) {
        return '--';
    }

    // Format to max 2 decimal places
    const formatted = Number(value).toFixed(value % 1 === 0 ? 0 : 1);
    return unit ? `${formatted}${unit}` : formatted;
};

// Format timestamp to readable time
export const formatTime = (timestamp) => {
    if (!timestamp) return '--:--:--';

    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

// Format timestamp to readable date
export const formatDate = (timestamp) => {
    if (!timestamp) return '--';

    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

// Format timestamp for chart labels (legacy — time only)
export const formatChartTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

// Format chart label based on period:
// daily   -> "14:00"
// weekly  -> "Sat 14:00"
// monthly -> "Mar 14"
export const formatChartLabel = (timestamp, period = 'daily') => {
    if (!timestamp) return '';

    // Handle both ISO strings and Date objects
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return String(timestamp);

    if (period === 'daily') {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    if (period === 'weekly') {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            hour: '2-digit',
            hour12: false
        }).replace(',', '');
    }

    // monthly
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
};

// Get current time string
export const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
};

// Get current date string
export const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
};

// Format relative time (e.g., "2 minutes ago")
export const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'N/A';

    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
};

// Capitalize first letter
export const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

// Format boolean to ON/OFF
export const formatOnOff = (value) => {
    return value ? 'ON' : 'OFF';
};

// Generate random ID
export const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
};
