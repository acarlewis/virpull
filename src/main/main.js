import path from 'node:path';
import { app, BrowserWindow, shell, nativeTheme, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc.js';
import { createSplashWindow, sendSplashStatus } from './splashWindow.js';
import { getYtDlpPath, getFfmpegPath, binaryExists } from './paths.js';
import * as settings from './settings.js';
import { THEME_NATIVE_SOURCE } from './settings.js';

// MAIN_WINDOW_VITE_DEV_SERVER_URL / MAIN_WINDOW_VITE_NAME are bare globals
// textually injected by @electron-forge/plugin-vite's esbuild `define` at
// build time — referencing them via `globalThis.` would not be replaced.
/* global MAIN_WINDOW_VITE_DEV_SERVER_URL, MAIN_WINDOW_VITE_NAME */

if (started) {
  app.quit();
}

// Safety net only — not how the splash decides when to close. If the
// renderer never sends app:renderer-ready (a genuine hang/bug) we still
// need to surface the error state instead of leaving the splash spinning
// forever.
const RENDERER_READY_TIMEOUT_MS = 20000;

// The splash must stay visible for at least this long regardless of how
// fast initialization finishes — see startApp()'s wait after readyPromise.
const MIN_SPLASH_DURATION = 6000;

let mainWindow = null;
let splashWindow = null;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 880,
    height: 700,
    minWidth: 720,
    minHeight: 480,
    title: 'VirPull',
    // In a packaged build the .exe already has this icon embedded (see
    // packagerConfig.icon in forge.config.js), so the taskbar picks it up
    // automatically. In dev mode Electron's own icon would show instead
    // unless we set it explicitly here.
    icon: app.isPackaged ? undefined : path.join(app.getAppPath(), 'build', 'icon.ico'),
    autoHideMenuBar: true,
    // Stays hidden until the splash hands off — see waitForRendererReady().
    // backgroundColor matches the app's default dark theme so there is no
    // flash of an unstyled/white frame in the instant before content paints.
    show: false,
    backgroundColor: '#1c1e26',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Keep the app from navigating to or opening arbitrary external content
  // in a way that would grant it access to Electron/Node APIs. Only
  // http(s) links are handed off to the OS browser; anything else (file:,
  // custom protocols, etc.) is silently dropped.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) return;
    event.preventDefault();
  });

  return win;
}

function loadMainWindow(win) {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }
  return win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}

// Resolves once the renderer has actually mounted and finished its initial
// data load (queue.js's init() sends app:renderer-ready only after
// settings/binaries/queue state have all resolved over IPC) — i.e. the
// moment the window would show real content, not a blank shell. Rejects on
// a load failure or the safety-net timeout above.
function waitForRendererReady(win) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      ipcMain.removeListener('app:renderer-ready', onReady);
      win.webContents.removeListener('did-fail-load', onFailLoad);
    };
    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onFailLoad = (_event, code, description) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`did-fail-load: ${description} (${code})`));
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Timed out waiting for the application to become ready.'));
    }, RENDERER_READY_TIMEOUT_MS);
    ipcMain.once('app:renderer-ready', onReady);
    win.webContents.once('did-fail-load', onFailLoad);
  });
}

async function startApp() {
  const splashStartTime = Date.now();
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = createSplashWindow();
    splashWindow.on('closed', () => {
      // If the user closes the splash before the main window is ever
      // shown, treat it the same as closing the app during startup rather
      // than leaving a hidden, half-initialized window behind.
      if (!mainWindow || !mainWindow.isVisible()) {
        app.quit();
      }
    });
  }
  const splash = splashWindow;
  sendSplashStatus(splash, { label: 'Starting VirPull…' });

  try {
    sendSplashStatus(splash, { label: 'Loading settings…' });
    const { theme } = settings.load();
    nativeTheme.themeSource = THEME_NATIVE_SOURCE[theme] ?? 'dark';

    sendSplashStatus(splash, { label: 'Checking media tools…' });
    binaryExists(getYtDlpPath());
    binaryExists(getFfmpegPath());

    sendSplashStatus(splash, { label: 'Initializing download engine…' });
    mainWindow = createMainWindow();
    registerIpcHandlers(mainWindow);

    sendSplashStatus(splash, { label: 'Preparing application…' });
    const readyPromise = waitForRendererReady(mainWindow);
    // Failures surface through the did-fail-load listener inside
    // waitForRendererReady rather than this promise, which some Electron
    // versions resolve inconsistently relative to renderer readiness.
    loadMainWindow(mainWindow).catch(() => {});
    await readyPromise;

    // Initialization may finish well before MIN_SPLASH_DURATION has
    // elapsed — keep the splash (and its existing animation) up until the
    // minimum is reached instead of closing as soon as init resolves.
    const remaining = MIN_SPLASH_DURATION - (Date.now() - splashStartTime);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }

    sendSplashStatus(splash, { label: 'Ready' });
    await new Promise((resolve) => setTimeout(resolve, 150));

    sendSplashStatus(splash, { state: 'leaving' });
    mainWindow.show();
    splashWindow = null;
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.close();
    }, 240);
  } catch (err) {
    console.error('VirPull failed to start:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    mainWindow = null;
    sendSplashStatus(splash, {
      state: 'error',
      label: 'Something went wrong while starting the application.'
    });
  }
}

app.whenReady().then(() => {
  ipcMain.on('splash:retry', () => {
    startApp();
  });
  ipcMain.on('splash:close', () => {
    app.quit();
  });
  startApp();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) startApp();
});
