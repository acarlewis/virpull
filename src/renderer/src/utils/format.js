export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}

export function formatSpeed(bytesPerSec) {
  const formatted = formatBytes(bytesPerSec);
  return formatted ? `${formatted}/s` : null;
}

export function formatEta(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Same h:mm:ss/mm:ss shape as formatEta — duration and ETA are both just
// "a number of seconds", so this is a semantic alias rather than a copy.
export const formatDuration = formatEta;

export function formatPercent(percent) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

const HEIGHT_QUALIFIERS = { 4320: '8K', 2160: '4K', 1440: '2K' };

export function formatHeightLabel(height) {
  const qualifier = HEIGHT_QUALIFIERS[height];
  return qualifier ? `${height}p (${qualifier})` : `${height}p`;
}

const ACTIVE_STATUSES = new Set([
  'starting',
  'fetching-info',
  'downloading',
  'merging',
  'extracting-audio',
  'processing',
  'already-downloaded'
]);

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.has(status);
}

const INDETERMINATE_STATUSES = new Set(['starting', 'fetching-info', 'merging', 'extracting-audio', 'processing']);

export function isIndeterminateStatus(status) {
  return INDETERMINATE_STATUSES.has(status);
}
