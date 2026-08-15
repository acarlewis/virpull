export const QUALITY_MODES = ['recommended', 'best', 'balanced', 'smallest', 'custom'];

const LARGE_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB

function videoFormatsWithHeight(formats) {
  return (formats || []).filter((f) => f.hasVideo && Number.isFinite(f.height) && f.height > 0);
}

function closestFormatAtOrBelow(videoFormats, targetHeight) {
  const atOrBelow = videoFormats.filter((f) => f.height <= targetHeight);
  if (!atOrBelow.length) return null;
  return atOrBelow.reduce((best, f) => (f.height > best.height ? f : best));
}

// Pure function: (analysis data, mode) -> quality value ('best' or a height
// string), the same shape QualitySelect/downloader already expect — no new
// download-side concept, just a different way of picking the value.
export function recommendQuality(analysisData, mode) {
  const videoFormats = videoFormatsWithHeight(analysisData?.formats);
  if (videoFormats.length === 0) return 'best';

  const heights = [...new Set(videoFormats.map((f) => f.height))].sort((a, b) => b - a);

  if (mode === 'best') return 'best';

  if (mode === 'smallest') {
    return String(heights[heights.length - 1]);
  }

  if (mode === 'balanced') {
    if (heights.includes(720)) return '720';
    const atOrBelow720 = heights.filter((h) => h <= 720);
    return String(atOrBelow720[0] ?? heights[heights.length - 1]);
  }

  // 'recommended' (default) and unrecognized modes fall through here:
  // prefer 1080p when available, otherwise the highest quality up to
  // 1440p (avoids defaulting to 4K/8K just because it exists), otherwise
  // whatever the single best option is. If the chosen resolution's known
  // filesize is unusually large, step down one tier rather than commit to
  // a huge download by default.
  let target = heights.includes(1080) ? 1080 : heights.find((h) => h <= 1440) ?? heights[0];
  const chosen = closestFormatAtOrBelow(videoFormats, target);
  if (chosen?.filesizeBytes && chosen.filesizeBytes > LARGE_FILE_THRESHOLD_BYTES && heights.includes(720)) {
    target = 720;
  }
  return String(target);
}
