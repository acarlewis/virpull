import { ipcMain, dialog, shell, app, BrowserWindow, nativeTheme } from 'electron';
import { execFile } from 'node:child_process';
import { ValidationError } from './downloader.js';
import { probeFormats } from './formats.js';
import { QueueManager } from './queue.js';
import { getYtDlpPath, getFfmpegPath, binaryExists, getDefaultDownloadsDir } from './paths.js';
import * as settings from './settings.js';
import { VALID_THEMES, VALID_LANGUAGES, FILENAME_TEMPLATES, THEME_NATIVE_SOURCE } from './settings.js';

const REPO = 'acarlewis/virpull';

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

function isNewerVersion(latest, current) {
  const toParts = (v) => v.split('.').map((p) => parseInt(p, 10) || 0);
  const a = toParts(latest);
  const b = toParts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
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
    const allowedKeys = ['downloadDir', 'quality', 'format', 'autoOpenFolder', 'theme', 'language', 'filenameTemplate'];
    const sanitized = {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(partial ?? {}, key)) {
        sanitized[key] = partial[key];
      }
    }
    if (sanitized.theme !== undefined) {
      if (!VALID_THEMES.includes(sanitized.theme)) delete sanitized.theme;
      else nativeTheme.themeSource = THEME_NATIVE_SOURCE[sanitized.theme];
    }
    if (sanitized.language !== undefined && !VALID_LANGUAGES.includes(sanitized.language)) {
      delete sanitized.language;
    }
    if (sanitized.filenameTemplate !== undefined && !Object.values(FILENAME_TEMPLATES).includes(sanitized.filenameTemplate)) {
      delete sanitized.filenameTemplate;
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
        format: payload?.format,
        filenameTemplate: payload?.filenameTemplate
      });
      settings.save({
        downloadDir: item.outputDir,
        quality: item.quality,
        format: item.format,
        filenameTemplate: item.filenameTemplate
      });
      return item;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new Error('errors.invalidRequest');
    }
  });

  ipcMain.handle('formats:probe', async (_event, url) => {
    const ytDlpPath = getYtDlpPath();
    if (!binaryExists(ytDlpPath)) {
      throw new Error('errors.ytDlpMissing');
    }
    try {
      return await probeFormats(url, ytDlpPath);
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw err instanceof Error ? err : new Error('errors.network');
    }
  });

  ipcMain.handle('queue:cancel', (_event, id) => queue.cancel(id));
  ipcMain.handle('queue:remove', (_event, id) => queue.remove(id));
  ipcMain.handle('queue:get-state', () => queue.getState());

  ipcMain.handle('binaries:update-ytdlp', async () => {
    const ytDlpPath = getYtDlpPath();
    if (!binaryExists(ytDlpPath)) {
      throw new Error('errors.ytDlpMissing');
    }
    await new Promise((resolve, reject) => {
      execFile(ytDlpPath, ['-U'], { windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error('errors.ytDlpUpdateFailed'));
          return;
        }
        resolve(stdout || stderr);
      });
    });
    const version = await getVersion(ytDlpPath);
    return { version };
  });

  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:check-for-update', async () => {
    const currentVersion = app.getVersion();
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
      const data = await res.json();
      const latestVersion = (data.tag_name || '').replace(/^v/i, '');
      return {
        currentVersion,
        latestVersion: latestVersion || null,
        hasUpdate: Boolean(latestVersion) && isNewerVersion(latestVersion, currentVersion),
        url: data.html_url || `https://github.com/${REPO}/releases/latest`
      };
    } catch {
      throw new Error('errors.network');
    }
  });

  ipcMain.handle('app:open-external', (_event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });
}
