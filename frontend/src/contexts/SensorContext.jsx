import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import socketService from '../services/socket';
import { getSensorData, getSystemStatus } from '../services/api';

const SensorContext = createContext(null);

export const useSensorContext = () => {
    const context = useContext(SensorContext);
    if (!context) {
        throw new Error('useSensorContext must be used within a SensorProvider');
    }
    return context;
};

export const SensorProvider = ({ children }) => {
    // Sensor data — shared across Water, Air, Components, Reports pages
    const [sensorData, setSensorData] = useState({
        temperature: null,
        ph: null,
        turbidity: null,
        tds: null,
        co2: null,
        waterLevel: null,
        waterLevelPercent: null,
        pir: false,
        oxygenPumpOn: false,
        pumpBlocked: false,
    });

    // Actuator states — shared across Components page and others
    const [actuatorStates, setActuatorStates] = useState({
        oxygenPump: false,
        pumpAutoMode: true,
        feeder: false,
        feederAutoMode: true,
        scheduleCount: 0,
        rtc: false,
    });

    // Pump safety state
    const [pumpSafety, setPumpSafety] = useState({
        waterPercent: 100,
        blocked: false,
        minLevel: 30,
    });

    // System status
    const [systemStatus, setSystemStatus] = useState({
        esp32: { connected: false },
        raspberryPi: { connected: false },
        yolo: { running: false },
        mqtt: { connected: false },
    });

    // RTC time from ESP32
    const [rtcTime, setRtcTime] = useState(null);

    // Track whether initial data has been loaded
    const [initialLoaded, setInitialLoaded] = useState(false);

    // Fetch initial data once on app startup
    useEffect(() => {
        let cancelled = false;

        // Mark as loaded immediately — real-time data will arrive via Socket.IO
        setInitialLoaded(true);

        const fetchInitial = async () => {
            // Only fetch system status (doesn't use MongoDB — fast!)
            try {
                const status = await getSystemStatus();
                if (cancelled) return;
                if (status?.devices) {
                    setSystemStatus({
                        esp32: status.devices.esp32 || { connected: false },
                        raspberryPi: status.devices.raspberryPi || { connected: false },
                        yolo: status.devices.yolo || { running: false },
                        mqtt: status.services?.mqtt || { connected: false },
                    });
                }
            } catch (err) {
                console.warn('SensorContext: status fetch failed (will use socket updates)');
            }

            // Try sensor data from API (MongoDB) — don't block if slow
            try {
                const sensors = await getSensorData();
                if (cancelled || !sensors) return;
                setSensorData(prev => ({
                    ...prev,
                    temperature: sensors.temperature ?? prev.temperature,
                    ph: sensors.ph ?? prev.ph,
                    turbidity: sensors.turbidity ?? prev.turbidity,
                    tds: sensors.tds ?? prev.tds,
                    co2: sensors.co2 ?? prev.co2,
                    waterLevel: sensors.waterLevel ?? prev.waterLevel,
                    pir: sensors.pir ?? prev.pir,
                }));
            } catch (err) {
                console.warn('SensorContext: sensor API slow/unavailable — using socket data only');
            }
        };

        // Delay API calls so the app renders immediately
        const timer = setTimeout(fetchInitial, 200);

        return () => { cancelled = true; clearTimeout(timer); };
    }, []);

    // Subscribe to real-time WebSocket events
    useEffect(() => {
        // Sensor updates
        const unsubSensor = socketService.subscribe('sensor-update', (data) => {
            setSensorData(prev => ({
                ...prev,
                temperature: data.temperature ?? prev.temperature,
                ph: data.ph ?? prev.ph,
                turbidity: data.turbidity ?? prev.turbidity,
                tds: data.tds ?? prev.tds,
                co2: data.co2 ?? prev.co2,
                waterLevel: data.waterLevel ?? prev.waterLevel,
                waterLevelPercent: data.waterLevelPercent ?? prev.waterLevelPercent,
                pir: data.pir ?? prev.pir,
                oxygenPumpOn: data.oxygenPumpOn ?? prev.oxygenPumpOn,
                pumpBlocked: data.pumpBlocked ?? prev.pumpBlocked,
            }));

            // Update pump safety from sensor data
            if (data.waterLevelPercent !== undefined || data.pumpBlocked !== undefined) {
                setPumpSafety(prev => ({
                    ...prev,
                    waterPercent: data.waterLevelPercent ?? prev.waterPercent,
                    blocked: data.pumpBlocked ?? prev.blocked,
                }));
            }

            // Sync oxygen pump state
            if (data.oxygenPumpOn !== undefined) {
                setActuatorStates(prev => ({
                    ...prev,
                    oxygenPump: data.oxygenPumpOn,
                }));
            }

            // Sync pump auto mode from sensor data
            if (data.pumpAutoMode !== undefined) {
                setActuatorStates(prev => ({
                    ...prev,
                    pumpAutoMode: data.pumpAutoMode,
                }));
            }

            // ESP32 is online if we receive sensor data
            setSystemStatus(prev => ({
                ...prev,
                esp32: { ...prev.esp32, connected: true },
            }));
        });

        // Actuator updates
        const unsubActuator = socketService.subscribe('actuator-update', (data) => {
            if (data.oxygenPump !== undefined) {
                setActuatorStates(prev => ({ ...prev, oxygenPump: data.oxygenPump }));
            }
            if (data.pumpAutoMode !== undefined) {
                setActuatorStates(prev => ({ ...prev, pumpAutoMode: data.pumpAutoMode }));
            }
            if (data.feeder !== undefined) {
                setActuatorStates(prev => ({ ...prev, feeder: data.feeder }));
            }
            if (data.feederAutoMode !== undefined) {
                setActuatorStates(prev => ({ ...prev, feederAutoMode: data.feederAutoMode }));
            }
            if (data.scheduleCount !== undefined) {
                setActuatorStates(prev => ({ ...prev, scheduleCount: data.scheduleCount }));
            }
            if (data.rtc !== undefined) {
                setActuatorStates(prev => ({ ...prev, rtc: data.rtc }));
            }

            // Legacy support
            if (data.name && data.state !== undefined) {
                setActuatorStates(prev => ({ ...prev, [data.name]: data.state }));
            }

            // Pump safety
            if (data.waterLevelPercent !== undefined || data.pumpBlocked !== undefined) {
                setPumpSafety(prev => ({
                    waterPercent: data.waterLevelPercent ?? prev.waterPercent,
                    blocked: data.pumpBlocked ?? prev.blocked,
                    minLevel: data.pumpMinLevel ?? prev.minLevel,
                }));
            }

            // RTC time
            if (data.rtcTimestamp) {
                setRtcTime(data.rtcTimestamp);
            }
        });

        // Device status
        const unsubDevice = socketService.subscribe('device-status', (data) => {
            if (data.device === 'esp32') {
                setSystemStatus(prev => ({ ...prev, esp32: { connected: data.online, ...data } }));
            } else if (data.device === 'laptop') {
                setSystemStatus(prev => ({ ...prev, raspberryPi: { connected: data.online, ...data } }));
            }
        });

        // MQTT status
        const unsubMqtt = socketService.subscribe('mqtt-status', (data) => {
            setSystemStatus(prev => ({ ...prev, mqtt: { connected: data.connected } }));
        });

        // YOLO model status
        const unsubModel = socketService.subscribe('model-status', (data) => {
            setSystemStatus(prev => ({ ...prev, yolo: { running: data.running, ...data } }));
        });

        // Detection events
        const unsubDetection = socketService.subscribe('detection', (data) => {
            if (data.source === 'laptop') {
                setSystemStatus(prev => ({
                    ...prev,
                    yolo: { running: true },
                    raspberryPi: { connected: true },
                }));
            }
        });

        // Poll system status every 30s (reduced from 10s per-page)
        const statusInterval = setInterval(async () => {
            try {
                const status = await getSystemStatus();
                if (status?.devices) {
                    setSystemStatus({
                        esp32: status.devices.esp32 || { connected: false },
                        raspberryPi: status.devices.raspberryPi || { connected: false },
                        yolo: status.devices.yolo || { running: false },
                        mqtt: status.services?.mqtt || { connected: false },
                    });
                }
            } catch (err) { /* silent */ }
        }, 30000);

        return () => {
            unsubSensor();
            unsubActuator();
            unsubDevice();
            unsubMqtt();
            unsubModel();
            unsubDetection();
            clearInterval(statusInterval);
        };
    }, []);

    // Helper to update actuator state from child components
    const updateActuatorState = useCallback((key, value) => {
        setActuatorStates(prev => ({ ...prev, [key]: value }));
    }, []);

    const value = {
        sensorData,
        actuatorStates,
        pumpSafety,
        systemStatus,
        rtcTime,
        initialLoaded,
        updateActuatorState,
    };

    return (
        <SensorContext.Provider value={value}>
            {children}
        </SensorContext.Provider>
    );
};

export default SensorContext;
