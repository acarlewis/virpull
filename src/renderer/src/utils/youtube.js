const YOUTUBE_HOST_RE = /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;

// Client-side hint only, used purely to decide whether to trigger format
// probing — the main process treats every URL the same way regardless
// (validated generically, handed to yt-dlp as-is), so a false positive/
// negative here has no security implications, just a UX one.
export function isYouTubeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return YOUTUBE_HOST_RE.test(parsed.hostname);
}
