import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

// In development the binaries live in <project>/resources/binaries.
// In a packaged app they are copied next to the app as an extraResource,
// so they live in process.resourcesPath/binaries instead of inside the asar.
export function getBinariesDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'binaries');
  }
  return path.join(app.getAppPath(), 'resources', 'binaries');
}

export function getYtDlpPath() {
  return path.join(getBinariesDir(), 'yt-dlp.exe');
}

export function getFfmpegPath() {
  return path.join(getBinariesDir(), 'ffmpeg.exe');
}

export function binaryExists(binaryPath) {
  try {
    return fs.existsSync(binaryPath) && fs.statSync(binaryPath).isFile();
  } catch {
    return false;
  }
}

export function getSettingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getDefaultDownloadsDir() {
  return app.getPath('downloads');
}
