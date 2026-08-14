import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { DownloadJob, validateUrl, validateOutputDir, ValidationError } from './downloader.js';
import { getYtDlpPath, getFfmpegPath, binaryExists, getDefaultDownloadsDir } from './paths.js';
import * as settings from './settings.js';

let activeJob = null;
let activeJobMeta = null;
let lastProgressSnapshot = null;

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
  ipcMain.handle('settings:get', () => settings.load());

  ipcMain.handle('settings:update', (_event, partial) => {
    const allowedKeys = ['downloadDir', 'quality', 'format', 'autoOpenFolder'];
    const sanitized = {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(partial ?? {}, key)) {
        sanitized[key] = partial[key];
      }
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

  ipcMain.handle('download:start', async (event, payload) => {
    if (activeJob) {
      throw new Error('A download is already in progress.');
    }
    const win = BrowserWindow.fromWebContents(event.sender);

    let url;
    let outputDir;
    try {
      url = validateUrl(payload?.url);
      outputDir = validateOutputDir(payload?.outputDir);
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }
      throw new Error('Invalid download request.');
    }

    const quality = typeof payload?.quality === 'string' ? payload.quality : 'best';
    const format = typeof payload?.format === 'string' ? payload.format : 'mp4';

    const ytDlpPath = getYtDlpPath();
    const ffmpegPath = getFfmpegPath();
    if (!binaryExists(ytDlpPath)) {
      throw new Error('yt-dlp.exe was not found. Please reinstall the application.');
    }
    if (!binaryExists(ffmpegPath)) {
      throw new Error('FFmpeg was not found. Please reinstall the application.');
    }

    settings.save({ downloadDir: outputDir, quality, format });

    const job = new DownloadJob({ url, outputDir, quality, format, ytDlpPath, ffmpegPath });
    activeJob = job;
    activeJobMeta = { id: job.id, url, outputDir, quality, format };
    lastProgressSnapshot = { status: 'starting' };

    let lastProgressSent = 0;
    job.start({
      onProgress: (data) => {
        lastProgressSnapshot = data;
        const now = Date.now();
        if (now - lastProgressSent < 150 && data.status !== 'finished') return;
        lastProgressSent = now;
        sendToRenderer(win, 'download:progress', { id: job.id, ...data });
      },
      onStatus: (status) => {
        lastProgressSnapshot = { status };
        sendToRenderer(win, 'download:status', { id: job.id, status });
      },
      onDone: (result) => {
        activeJob = null;
        activeJobMeta = null;
        lastProgressSnapshot = null;
        sendToRenderer(win, 'download:complete', {
          id: job.id,
          filePath: result.filePath,
          outputDir
        });
      },
      onError: (message) => {
        activeJob = null;
        activeJobMeta = null;
        lastProgressSnapshot = null;
        sendToRenderer(win, 'download:error', { id: job.id, message });
      }
    });

    return { id: job.id };
  });

  ipcMain.handle('download:cancel', () => {
    if (activeJob) {
      activeJob.cancel();
      activeJob = null;
      activeJobMeta = null;
      lastProgressSnapshot = null;
      return true;
    }
    return false;
  });

  // Lets a freshly (re)loaded renderer reattach to a download that's still
  // running in the main process, e.g. after a dev-time HMR reload.
  ipcMain.handle('download:get-active', () => {
    if (!activeJobMeta) return null;
    return { ...activeJobMeta, progress: lastProgressSnapshot };
  });

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
