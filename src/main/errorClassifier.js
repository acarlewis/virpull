// Centralized classification of yt-dlp failures (download AND analysis) into
// i18n keys — see src/renderer/src/locales/*.json under "errors". The main
// process never produces final user-facing text; it only ever returns a key
// (or, as a last resort, yt-dlp's own raw English line when nothing matches)
// and the renderer translates via translateMessage()/translateIpcError().
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
  [/http error 403|forbidden/i, 'errors.expiredLink'],
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
