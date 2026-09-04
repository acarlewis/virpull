// Centralized classification of yt-dlp failures (download AND analysis) into
// i18n keys — see src/renderer/src/locales/*.json under "errors". The main
// process never produces final user-facing text; it only ever returns a key
// (or, as a last resort, yt-dlp's own raw English line when nothing matches)
// and the renderer translates via translateMessage()/translateIpcError().
//
// IMPORTANT: HTTP 403 ("Forbidden") used to be mapped straight to
// errors.expiredLink. That's wrong — a bare 403 from yt-dlp is just as
// often geo-blocking, bot/anti-scraping checks, a missing referer/cookie,
// or plain access-denied as it is an actually-expired signed URL, and
// VirPull re-invokes yt-dlp against the ORIGINAL page URL for every
// download (see downloader.js buildArgs()/queue.js) rather than caching a
// temporary extracted media URL — so a stale token isn't even the likely
// cause. errors.expiredLink is now reserved for signals that actually say
// so (HTTP 410 Gone, or explicit "expired" wording); a plain 403 gets its
// own, more accurate errors.forbidden message. See queue.js for the
// single-retry-then-report behavior built on top of this distinction.
const PATTERNS = [
  [/no space left on device|enospc/i, 'errors.noSpace'],
  [/permission denied|eacces|eperm/i, 'errors.permissionDenied'],
  [/drm|widevine|protected stream|decryption/i, 'errors.drmProtected'],
  [
    /sign in to confirm|sign in if you|age[- ]restricted|requires authentication|log in to continue|this content isn'?t available/i,
    'errors.ageRestricted'
  ],
  [/members-only|join this channel|available to this channel/i, 'errors.membersOnly'],
  [/premieres in|will begin in|live event will begin/i, 'errors.notYetAvailable'],
  [/video unavailable|this video is not available|has been removed|private video/i, 'errors.videoUnavailable'],
  [
    /http error 410|\bgone\b|link has expired|url has expired|expired (?:link|url|token|signature)|signature (?:has )?expired|token (?:has )?expired/i,
    'errors.expiredLink'
  ],
  [/http error 401|unauthorized/i, 'errors.authRequired'],
  // A 403 on the MEDIA FETCH specifically (yt-dlp got through extraction —
  // metadata, formats and the chosen format id are all in hand — and only
  // then had the byte fetch rejected) is the signature of an out-of-date
  // extractor, not of the site denying the user. Sites like YouTube rotate
  // their player/signature scheme; a yt-dlp build from before a rotation
  // still parses the page fine but produces media URLs the CDN rejects.
  // Verified against this exact case: bundled yt-dlp 2026.07.04 failed here
  // with "unable to download video data: HTTP Error 403" while 2026.08.19
  // downloaded the same URL, same args, same machine, seconds apart.
  // Must precede the generic 403 rule below.
  [
    /(?:unable to download video data|unable to download format|fragment .{0,40}not found|giving up after .{0,20}fragment retries)[\s\S]{0,200}?http error 403/i,
    'errors.extractorOutdated'
  ],
  [/http error 403|forbidden/i, 'errors.forbidden'],
  [/http error 404/i, 'errors.notFound'],
  [/unsupported url|no extractor|unable to extract/i, 'errors.unsupportedUrl'],
  [
    /unable to download webpage|getaddrinfo|enotfound|econnrefused|econnreset|network is unreachable|timed out/i,
    'errors.network'
  ],
  [/ffmpeg not found|ffprobe not found/i, 'errors.ffmpegMissing'],
  [/ffmpeg\.exe.*not found|yt-dlp\.exe.*not found/i, 'errors.componentMissing'],
  [/could not write to output file|no such file or directory/i, 'errors.writeFailed']
];

// Exported so callers (queue.js's single-retry logic) can recognize this
// specific classification without duplicating the string literal.
export const EXPIRED_LINK_KEY = 'errors.expiredLink';

export function classifyError(stderrText, exitCode) {
  const text = stderrText || '';
  for (const [regex, key] of PATTERNS) {
    if (regex.test(text)) return key;
  }
  // Last resort: yt-dlp's own (English) error line, or a bare exit-code
  // message. Neither matches a translation key, so the renderer shows it
  // verbatim rather than translating it.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lastError = [...lines].reverse().find((l) => /^error/i.test(l));
  if (lastError) {
    return lastError.replace(/^ERROR:\s*/i, '');
  }
  return `Failed unexpectedly (exit code ${exitCode}).`;
}
