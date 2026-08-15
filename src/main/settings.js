import fs from 'node:fs';
import { getSettingsFilePath, getDefaultDownloadsDir } from './paths.js';

export const VALID_THEMES = ['light', 'dark', 'midnight', 'cyberpunk', 'ocean', 'forest'];
export const VALID_LANGUAGES = ['en', 'fr', 'nl'];
export const VALID_QUALITY_MODES = ['recommended', 'best', 'balanced', 'smallest', 'custom'];

// Custom themes have no native equivalent; nativeTheme only knows
// light/dark, so each maps to whichever native chrome (dialogs, etc.)
// reads closest.
export const THEME_NATIVE_SOURCE = {
  light: 'light',
  dark: 'dark',
  midnight: 'dark',
  cyberpunk: 'dark',
  ocean: 'light',
  forest: 'light'
};
export const FILENAME_TEMPLATES = {
  default: '%(title)s.%(ext)s',
  date: '%(upload_date)s - %(title)s.%(ext)s',
  uploader: '%(uploader)s/%(title)s.%(ext)s'
};

// yt-dlp's --limit-rate accepts a plain number of bytes/sec or a number
// followed by K/M/G (e.g. "500K", "4.2M"). null means unlimited.
export function isValidSpeedLimit(value) {
  return value === null || (typeof value === 'string' && /^\d+(\.\d+)?[KMG]$/i.test(value));
}

export const DEFAULT_SETTINGS = {
  downloadDir: null, // resolved lazily to the Windows Downloads folder
  quality: 'best',
  format: 'mp4',
  autoOpenFolder: true,
  theme: 'dark',
  language: 'en',
  filenameTemplate: FILENAME_TEMPLATES.default,
  qualityMode: 'recommended',
  downloadSpeedLimit: null,
  clipboardDetectionEnabled: true,
  previewEnabled: true
};

let cache = null;

function readFromDisk() {
  const filePath = getSettingsFilePath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!VALID_THEMES.includes(merged.theme)) merged.theme = 'dark';
    if (!VALID_LANGUAGES.includes(merged.language)) merged.language = 'en';
    if (!Object.values(FILENAME_TEMPLATES).includes(merged.filenameTemplate)) {
      merged.filenameTemplate = FILENAME_TEMPLATES.default;
    }
    if (!VALID_QUALITY_MODES.includes(merged.qualityMode)) merged.qualityMode = 'recommended';
    if (!isValidSpeedLimit(merged.downloadSpeedLimit)) merged.downloadSpeedLimit = null;
    merged.clipboardDetectionEnabled = Boolean(merged.clipboardDetectionEnabled);
    merged.previewEnabled = Boolean(merged.previewEnabled);
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
