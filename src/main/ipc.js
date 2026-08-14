import { ipcMain, dialog, shell, app, BrowserWindow, nativeTheme } from 'electron';
import { execFile } from 'node:child_process';
import { ValidationError } from './downloader.js';
import { QueueManager } from './queue.js';
import { getYtDlpPath, getFfmpegPath, binaryExists, getDefaultDownloadsDir } from './paths.js';
import * as settings from './settings.js';

function getVersion(binaryPath, args = ['--version']) {
  return new Promise((resolve) => {
    if (!binaryExists(binaryPath)) {
      resolve(null);
      return;
    }
    execFile(binaryPath, args, { windowsHide: true, timeout: 10000 }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(stdout.trim().split(/\r?\n/)[0] || null);
    });
  });
}

function sendToRenderer(win, channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

export function registerIpcHandlers(mainWindow) {
  const queue = new QueueManager({
    getYtDlpPath,
    getFfmpegPath,
    binaryExists,
    onEvent: (channel, payload) => sendToRenderer(mainWindow, channel, payload)
  });

  ipcMain.handle('settings:get', () => settings.load());

  ipcMain.handle('settings:update', (_event, partial) => {
    const allowedKeys = ['downloadDir', 'quality', 'format', 'autoOpenFolder', 'theme'];
    const sanitized = {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(partial ?? {}, key)) {
        sanitized[key] = partial[key];
      }
    }
    if (['light', 'dark'].includes(sanitized.theme)) {
      nativeTheme.themeSource = sanitized.theme;
    }
    return settings.save(sanitized);
  });

  ipcMain.handle('dialog:select-download-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: settings.load().downloadDir || getDefaultDownloadsDir()
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const chosen = result.filePaths[0];
    settings.save({ downloadDir: chosen });
    return chosen;
  });

  ipcMain.handle('paths:get-default-downloads-dir', () => getDefaultDownloadsDir());

  ipcMain.handle('binaries:check', async () => {
    const ytDlpPath = getYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    const ytDlpOk = binaryExists(ytDlpPath);
    const ffmpegOk = binaryExists(ffmpegPath);
    const [ytDlpVersion, ffmpegVersionRaw] = await Promise.all([
      ytDlpOk ? getVersion(ytDlpPath) : Promise.resolve(null),
      ffmpegOk ? getVersion(ffmpegPath, ['-version']) : Promise.resolve(null)
    ]);
    const ffmpegVersion = ffmpegVersionRaw ? ffmpegVersionRaw.split(' ')[2] || ffmpegVersionRaw : null;
    return {
      ytDlp: { available: ytDlpOk, version: ytDlpVersion },
      ffmpeg: { available: ffmpegOk, version: ffmpegVersion }
    };
  });

  ipcMain.handle('folder:open', async (_event, targetPath) => {
    if (typeof targetPath !== 'string' || !targetPath) return false;
    const err = await shell.openPath(targetPath);
    return !err;
  });

  ipcMain.handle('queue:add', (_event, payload) => {
    try {
      const item = queue.add({
        url: payload?.url,
        outputDir: payload?.outputDir,
        quality: payload?.quality,
        format: payload?.format
      });
      settings.save({ downloadDir: item.outputDir, quality: item.quality, format: item.format });
      return item;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new Error('Invalid download request.');
    }
  });

  ipcMain.handle('queue:cancel', (_event, id) => queue.cancel(id));
  ipcMain.handle('queue:remove', (_event, id) => queue.remove(id));
  ipcMain.handle('queue:get-state', () => queue.getState());

  ipcMain.handle('binaries:update-ytdlp', async () => {
    const ytDlpPath = getYtDlpPath();
    if (!binaryExists(ytDlpPath)) {
      throw new Error('yt-dlp.exe was not found. Please reinstall the application.');
    }
    await new Promise((resolve, reject) => {
      execFile(ytDlpPath, ['-U'], { windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error('Could not update yt-dlp. Check your internet connection and try again.'));
          return;
        }
        resolve(stdout || stderr);
      });
    });
    const version = await getVersion(ytDlpPath);
    return { version };
  });

  ipcMain.handle('app:get-version', () => app.getVersion());
}
