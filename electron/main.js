const { app, BrowserWindow, dialog, Menu, Tray } = require('electron');
const path = require('path');
const { fork, spawn } = require('child_process');
const http = require('http');

// ─── Configuration ───
const BACKEND_PORT = 5000;
const FRONTEND_PORT = 3000;
const isDev = !app.isPackaged;

let mainWindow = null;
let backendProcess = null;
let mlProcess = null;
let tray = null;

// ─── Resolve paths (works in dev and packaged) ───
function getBackendPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'backend', 'src', 'server.js');
    }
    // In packaged app, backend is in resources/app.asar.unpacked/backend
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'src', 'server.js');
}

function getFrontendPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'frontend', 'build', 'index.html');
    }
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'frontend', 'build', 'index.html');
}

function getBackendEnvPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'backend');
    }
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'backend');
}

function getIconPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'build', 'icon.ico');
    }
    return path.join(process.resourcesPath, 'icon.ico');
}

function getMLPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'ml-service', 'dist', 'aquasense-ml', 'aquasense-ml.exe');
    }
    return path.join(process.resourcesPath, 'extraResources', 'ml', 'aquasense-ml.exe');
}

function getMLCwd() {
    if (isDev) {
        return path.join(__dirname, '..', 'ml-service', 'dist', 'aquasense-ml');
    }
    return path.join(process.resourcesPath, 'extraResources', 'ml');
}

// ─── Start Backend Server ───
function startBackend() {
    return new Promise((resolve, reject) => {
        const serverPath = getBackendPath();
        const envPath = getBackendEnvPath();

        console.log(`[Electron] Starting backend: ${serverPath}`);

        backendProcess = fork(serverPath, [], {
            cwd: envPath,
            env: {
                ...process.env,
                PORT: BACKEND_PORT.toString(),
                NODE_ENV: 'production',
                ELECTRON: 'true',
            },
            silent: true,
        });

        backendProcess.stdout.on('data', (data) => {
            console.log(`[Backend] ${data.toString().trim()}`);
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`[Backend Error] ${data.toString().trim()}`);
        });

        backendProcess.on('error', (err) => {
            console.error('[Electron] Failed to start backend:', err);
            reject(err);
        });

        backendProcess.on('exit', (code) => {
            console.log(`[Electron] Backend exited with code ${code}`);
            backendProcess = null;
        });

        // Poll until backend is ready
        const maxRetries = 30;
        let retries = 0;

        const checkReady = () => {
            retries++;
            http
                .get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
                    if (res.statusCode === 200) {
                        console.log('[Electron] Backend is ready!');
                        resolve();
                    } else if (retries < maxRetries) {
                        setTimeout(checkReady, 1000);
                    } else {
                        // Accept even non-200 — server is at least responding
                        console.log('[Electron] Backend responding (non-200), proceeding...');
                        resolve();
                    }
                })
                .on('error', () => {
                    if (retries < maxRetries) {
                        setTimeout(checkReady, 1000);
                    } else {
                        console.warn('[Electron] Backend health check timed out, proceeding anyway...');
                        resolve(); // Proceed even if health check fails
                    }
                });
        };

        setTimeout(checkReady, 2000); // Give backend 2s head start
    });
}

// ─── Stop Backend Server ───
function stopBackend() {
    if (backendProcess) {
        console.log('[Electron] Stopping backend...');
        backendProcess.kill('SIGINT');
        backendProcess = null;
    }
}

// ─── Start ML Service ───
function startML() {
    const mlPath = getMLPath();
    const mlCwd = getMLCwd();

    console.log(`[Electron] Starting ML Service: ${mlPath}`);

    mlProcess = spawn(mlPath, [], {
        cwd: mlCwd,
        env: {
            ...process.env,
            ELECTRON: 'true',
        }
    });

    mlProcess.stdout.on('data', (data) => {
        console.log(`[ML] ${data.toString().trim()}`);
    });

    mlProcess.stderr.on('data', (data) => {
        console.error(`[ML Error] ${data.toString().trim()}`);
    });

    mlProcess.on('error', (err) => {
        console.error('[Electron] Failed to start ML service:', err);
    });

    mlProcess.on('exit', (code) => {
        console.log(`[Electron] ML Service exited with code ${code}`);
        mlProcess = null;
    });
}

// ─── Stop ML Service ───
function stopML() {
    if (mlProcess) {
        console.log('[Electron] Stopping ML Service...');
        mlProcess.kill('SIGINT');
        mlProcess = null;
    }
}

// ─── Create Main Window ───
function createWindow() {
    const iconPath = getIconPath();

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        icon: iconPath,
        title: 'AquaSense360',
        backgroundColor: '#0a1628',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Remove the default menu bar
    mainWindow.setMenuBarVisibility(false);

    // Load the frontend
    if (isDev) {
        // In dev, try the dev server first, then fall back to build
        mainWindow
            .loadURL(`http://localhost:${FRONTEND_PORT}`)
            .catch(() => {
                console.log('[Electron] Dev server not running, loading build...');
                mainWindow.loadFile(getFrontendPath());
            });
    } else {
        // In production, always load the static build
        mainWindow.loadFile(getFrontendPath());
    }

    // Show window once ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

// ─── Create Splash Screen ───
function createSplash() {
    const splash = new BrowserWindow({
        width: 500,
        height: 350,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        icon: getIconPath(),
        webPreferences: {
            contextIsolation: true,
        },
    });

    splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSplashHTML())}`);
    return splash;
}

function getSplashHTML() {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: transparent;
      -webkit-app-region: drag;
    }
    .container {
      background: linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0f2b46 100%);
      border-radius: 20px;
      padding: 50px 60px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(0, 200, 255, 0.15);
      width: 460px;
    }
    .logo {
      font-size: 42px;
      margin-bottom: 8px;
    }
    h1 {
      color: #00d4ff;
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: 1px;
    }
    .subtitle {
      color: rgba(255, 255, 255, 0.5);
      font-size: 13px;
      margin-bottom: 32px;
    }
    .loader {
      width: 200px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      margin: 0 auto 16px;
      overflow: hidden;
    }
    .loader-bar {
      width: 40%;
      height: 100%;
      background: linear-gradient(90deg, #00d4ff, #7c3aed);
      border-radius: 4px;
      animation: loading 1.5s ease-in-out infinite;
    }
    @keyframes loading {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }
    .status {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🐟</div>
    <h1>AquaSense360</h1>
    <p class="subtitle">IoT Smart Fish Health Monitoring System</p>
    <div class="loader"><div class="loader-bar"></div></div>
    <p class="status">Starting services...</p>
  </div>
</body>
</html>`;
}

// ─── App Lifecycle ───
app.whenReady().then(async () => {
    const splash = createSplash();

    try {
        startML();  // Start ML in parallel
        await startBackend();
    } catch (err) {
        console.error('[Electron] Backend start error:', err);
        dialog.showErrorBox(
            'AquaSense360 — Startup Error',
            `Failed to start the backend server.\n\n${err.message}\n\nThe application will try to continue without the backend.`
        );
    }

    createWindow();

    // Close splash when main window is ready
    if (mainWindow) {
        mainWindow.once('ready-to-show', () => {
            setTimeout(() => {
                if (splash && !splash.isDestroyed()) {
                    splash.close();
                }
            }, 800);
        });
    }
});

app.on('window-all-closed', () => {
    stopBackend();
    stopML();
    app.quit();
});

app.on('before-quit', () => {
    stopBackend();
    stopML();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
