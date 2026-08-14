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

export function formatPercent(percent) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}
