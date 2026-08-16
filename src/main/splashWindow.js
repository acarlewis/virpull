import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';

/* global SPLASH_WINDOW_VITE_DEV_SERVER_URL, SPLASH_WINDOW_VITE_NAME */

const SPLASH_WIDTH = 440;
const SPLASH_HEIGHT = 320;

export function createSplashWindow() {
  const splash = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Frameless + transparent gives the rounded-corner floating-card look;
    // the actual shape/shadow is drawn by splash.css, not by Windows chrome.
    transparent: true,
    hasShadow: true,
    center: true,
    show: false,
    skipTaskbar: true,
    title: 'VirPull',
    icon: app.isPackaged ? undefined : path.join(app.getAppPath(), 'build', 'icon.ico'),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Wait for the first real paint instead of showing an empty frame.
  splash.once('ready-to-show', () => splash.show());

  // Real startup steps can complete (and want to report status) faster
  // than the splash's own tiny bundle finishes loading and attaches its
  // IPC listener — messages sent before that would be silently dropped,
  // leaving the hardcoded fallback text in index.html on screen forever.
  // Buffer the latest status until the renderer confirms it's listening
  // (see splash.js / splash-preload.js's notifyListenerReady).
  splash._statusReady = false;
  splash._pendingStatus = null;
  const onListenerReady = (event) => {
    if (event.sender !== splash.webContents) return;
    splash._statusReady = true;
    if (splash._pendingStatus) {
      splash.webContents.send('splash:status', splash._pendingStatus);
      splash._pendingStatus = null;
    }
  };
  ipcMain.on('splash:listener-ready', onListenerReady);
  splash.once('closed', () => ipcMain.removeListener('splash:listener-ready', onListenerReady));

  if (SPLASH_WINDOW_VITE_DEV_SERVER_URL) {
    splash.loadURL(SPLASH_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    splash.loadFile(path.join(__dirname, `../renderer/${SPLASH_WINDOW_VITE_NAME}/index.html`));
  }

  return splash;
}

export function sendSplashStatus(splash, payload) {
  if (!splash || splash.isDestroyed()) return;
  if (splash._statusReady) {
    splash.webContents.send('splash:status', payload);
  } else {
    // Only the most recent status matters once the listener does attach.
    splash._pendingStatus = payload;
  }
}
