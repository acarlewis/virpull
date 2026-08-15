import { isYouTubeUrl } from './youtube';

// Instant, client-side-only recognition — no yt-dlp call, just enough to
// give immediate visual feedback while the user is typing/pasting. This is
// deliberately optimistic for anything that isn't YouTube/HLS: yt-dlp
// supports thousands of sites via its Generic extractor and there's no
// reliable way to confirm support without actually asking it, which is
// what Analyze does. A badge here is a hint, not a guarantee.
export function quickRecognize(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { supported: false, platform: null, type: 'invalid' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { supported: false, platform: null, type: 'invalid' };
  }
  if (isYouTubeUrl(trimmed)) {
    return { supported: true, platform: 'YouTube', type: 'video' };
  }
  if (/\.m3u8(\?|#|$)/i.test(trimmed)) {
    return { supported: true, platform: 'HLS', type: 'hls' };
  }
  return { supported: true, platform: null, type: 'unknown' };
}
