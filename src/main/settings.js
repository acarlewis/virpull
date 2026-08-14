import fs from 'node:fs';
import { getSettingsFilePath, getDefaultDownloadsDir } from './paths.js';

export const DEFAULT_SETTINGS = {
  downloadDir: null, // resolved lazily to the Windows Downloads folder
  quality: 'best',
  format: 'mp4',
  autoOpenFolder: true,
  theme: 'dark' // 'light' | 'dark'
};

let cache = null;

function readFromDisk() {
  const filePath = getSettingsFilePath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    // Older builds had a 'system' theme option; fold it into the new default.
    if (merged.theme !== 'light' && merged.theme !== 'dark') merged.theme = 'dark';
    return merged;
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
