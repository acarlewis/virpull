import path from 'node:path';
import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc.js';
import * as settings from './settings.js';
import { THEME_NATIVE_SOURCE } from './settings.js';

// MAIN_WINDOW_VITE_DEV_SERVER_URL / MAIN_WINDOW_VITE_NAME are bare globals
// textually injected by @electron-forge/plugin-vite's esbuild `define` at
// build time — referencing them via `globalThis.` would not be replaced.
/* global MAIN_WINDOW_VITE_DEV_SERVER_URL, MAIN_WINDOW_VITE_NAME */

if (started) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) return;
    event.preventDefault();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(() => {
  const { theme } = settings.load();
  nativeTheme.themeSource = THEME_NATIVE_SOURCE[theme] ?? 'dark';
  createWindow();
  registerIpcHandlers(mainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
