import fs from 'node:fs';
import { getSettingsFilePath, getDefaultDownloadsDir } from './paths.js';

export const DEFAULT_SETTINGS = {
  downloadDir: null, // resolved lazily to the Windows Downloads folder
  quality: 'best',
  format: 'mp4',
  autoOpenFolder: true
};

let cache = null;

function readFromDisk() {
  const filePath = getSettingsFilePath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function load() {
  if (!cache) {
    cache = readFromDisk();
    if (!cache.downloadDir) {
      cache.downloadDir = getDefaultDownloadsDir();
    }
  }
  return cache;
}

export function save(partial) {
  cache = { ...load(), ...partial };
  const filePath = getSettingsFilePath();
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf-8');
  return cache;
}
