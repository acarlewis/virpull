import fs from 'node:fs';
import { getSettingsFilePath, getDefaultDownloadsDir } from './paths.js';

export const VALID_THEMES = ['light', 'dark', 'midnight', 'cyberpunk', 'ocean', 'forest'];
export const VALID_LANGUAGES = ['en', 'fr', 'nl'];

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

export const DEFAULT_SETTINGS = {
  downloadDir: null, // resolved lazily to the Windows Downloads folder
  quality: 'best',
  format: 'mp4',
  autoOpenFolder: true,
  theme: 'dark',
  language: 'en',
  filenameTemplate: FILENAME_TEMPLATES.default
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
