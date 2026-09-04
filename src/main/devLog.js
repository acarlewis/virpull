import { app } from 'electron';

// Sensitive query params that show up on signed/temporary media URLs (CDN
// tokens, expiry timestamps, signatures, ...). Redacted before anything
// touches the console so a pasted diagnostic log never leaks a usable link.
const SENSITIVE_PARAM_RE = /token|expire|signature|^sig$|auth|policy|key-pair-id|security-token|hdnea|hdntl/i;

// Best-effort: only rewrites recognizable query-string params. Anything that
// isn't a parseable URL (or has no query string) is returned unchanged —
// callers should still avoid logging obviously sensitive strings outright.
export function redactUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return rawUrl;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (SENSITIVE_PARAM_RE.test(key)) parsed.searchParams.set(key, '[REDACTED]');
  }
  return parsed.toString();
}

// Diagnostic-only pipeline tracing (URL analysis → format selection →
// yt-dlp invocation → exit). Silenced in packaged builds so it never ends
// up in an end user's console; use DevTools/terminal in `npm start` to see
// it. Never pass a raw signed URL here — redact with redactUrl() first.
export function devLog(...args) {
  if (app.isPackaged) return;
  console.log(...args);
}
