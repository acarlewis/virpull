import { execFile } from 'node:child_process';
import { validateUrl, classifyError } from './downloader.js';

const PROBE_TIMEOUT_MS = 25000;
const MAX_BUFFER_BYTES = 20 * 1024 * 1024;

// Fetches metadata only (yt-dlp -J) — no video/audio data is downloaded.
// Deliberately passes no auth/cookie/geo-bypass flags: this only ever sees
// what yt-dlp can extract anonymously and publicly, so it can't be used to
// bypass sign-in walls, memberships, or DRM. Restricted videos simply fail
// here the same way they would at download time, and are reported via the
// same classifyError() used for actual downloads.
export function probeFormats(rawUrl, ytDlpPath) {
  const url = validateUrl(rawUrl);

  return new Promise((resolve, reject) => {
    execFile(
      ytDlpPath,
      ['--no-playlist', '--no-warnings', '--no-color', '-J', url],
      { windowsHide: true, timeout: PROBE_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed || err.signal) {
            reject(new Error('errors.network'));
            return;
          }
          reject(new Error(classifyError(stderr, err.code)));
          return;
        }
        try {
          const info = JSON.parse(stdout);
          const heights = [
            ...new Set(
              (info.formats || [])
                .filter((f) => f.vcodec && f.vcodec !== 'none' && Number.isFinite(f.height))
                .map((f) => f.height)
            )
          ].sort((a, b) => b - a);
          resolve({ title: typeof info.title === 'string' ? info.title : null, heights });
        } catch {
          reject(new Error('errors.network'));
        }
      }
    );
  });
}
