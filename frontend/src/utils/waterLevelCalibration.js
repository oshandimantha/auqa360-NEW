// Water Level Calibration Utility
// Stores calibration settings in localStorage for persistence

const STORAGE_KEY = 'aquasense_water_level_calibration';

// Default calibration values
const DEFAULT_CALIBRATION = {
    fullLevel: 5,      // Distance when tank is FULL (water close to sensor)
    emptyLevel: 20,    // Distance when tank is EMPTY (water far from sensor)
    calibrated: false  // Whether user has calibrated
};

// Get current calibration from localStorage
export const getCalibration = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load calibration:', error);
    }
    return DEFAULT_CALIBRATION;
};

// Save calibration to localStorage
export const saveCalibration = (calibration) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...calibration,
            calibrated: true,
            updatedAt: new Date().toISOString()
        }));
        return true;
    } catch (error) {
        console.error('Failed to save calibration:', error);
        return false;
    }
};

// Set empty level (when tank is empty, capture current reading)
export const setEmptyLevel = (currentReading) => {
    const calibration = getCalibration();
    calibration.emptyLevel = currentReading;
    return saveCalibration(calibration);
};

// Set full level (when tank is full, capture current reading)
export const setFullLevel = (currentReading) => {
    const calibration = getCalibration();
    calibration.fullLevel = currentReading;
    return saveCalibration(calibration);
};

// Reset to defaults
export const resetCalibration = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Failed to reset calibration:', error);
        return false;
    }
};

// Calculate water level thresholds based on calibration
export const getWaterLevelThresholds = () => {
    const cal = getCalibration();
    const range = cal.emptyLevel - cal.fullLevel;

    return {
        min: cal.fullLevel,                           // Full tank
        max: cal.emptyLevel,                          // Empty tank  
        medium: cal.fullLevel + (range / 2),          // Medium level (half)
        unit: 'cm',
        icon: '💧',
        label: 'Water Level',
        reversed: true,
        calibrated: cal.calibrated
    };
};

// Get water level status based on calibrated thresholds
export const getWaterLevelStatus = (value) => {
    const thresholds = getWaterLevelThresholds();

    if (value <= thresholds.min) return 'optimal';      // Full
    if (value >= thresholds.max) return 'danger';       // Empty
    if (value <= thresholds.medium) return 'optimal';   // Good level (above medium)
    return 'warning';                                    // Getting low
};

// Get water level label based on value
export const getWaterLevelLabel = (value) => {
    const thresholds = getWaterLevelThresholds();

    if (value <= thresholds.min) return 'Full';
    if (value >= thresholds.max) return 'Empty';
    if (value <= thresholds.medium) return 'Good';
    return 'Low';
};

const waterLevelCalibration = {
    getCalibration,
    saveCalibration,
    setEmptyLevel,
    setFullLevel,
    resetCalibration,
    getWaterLevelThresholds,
    getWaterLevelStatus,
    getWaterLevelLabel
};

export default waterLevelCalibration;
