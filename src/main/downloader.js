import { spawn, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FILENAME_TEMPLATES, isValidSpeedLimit } from './settings.js';
import { classifyError, EXPIRED_LINK_KEY } from './errorClassifier.js';
import { devLog, redactUrl } from './devLog.js';

export { classifyError, EXPIRED_LINK_KEY };

// Unique markers so we can pick our structured progress/print lines out of
// yt-dlp's normal chatter on stdout without ambiguity.
const SEP = '';
const MARKER_PROGRESS = 'YTDLP-PROGRESS';
const MARKER_FILEPATH = 'YTDLP-FILEPATH';

const VIDEO_FORMATS = new Set(['mp4', 'mkv', 'webm']);
const AUDIO_FORMATS = new Set(['mp3']);

export class ValidationError extends Error {}

// Messages are i18n keys (see src/renderer/src/locales/*.json under "errors")
// rather than final English text — the renderer translates them via
// `te(key) ? t(key) : key`, keeping the main process language-agnostic.
export function validateUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    throw new ValidationError('errors.urlRequired');
  }
  const url = rawUrl.trim();
  if (!url) {
    throw new ValidationError('errors.urlRequired');
  }
  // yt-dlp treats any argument starting with "-" as an option, which would
  // let a crafted "URL" inject extra command-line flags. Reject outright.
  if (url.startsWith('-')) {
    throw new ValidationError('errors.urlInvalid');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('errors.urlInvalid');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('errors.urlProtocol');
  }
  return url;
}

export function validateOutputDir(dir) {
  if (typeof dir !== 'string' || !dir.trim()) {
    throw new ValidationError('errors.folderRequired');
  }
  if (!path.isAbsolute(dir)) {
    throw new ValidationError('errors.folderNotAbsolute');
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new ValidationError('errors.folderPermission');
    }
    throw new ValidationError('errors.folderInvalid');
  }
  return dir;
}

export function resolveFilenameTemplate(template) {
  return Object.values(FILENAME_TEMPLATES).includes(template) ? template : FILENAME_TEMPLATES.default;
}

// 'best' (or anything non-numeric) means no height filter. Any other value
// is coerced through Number() — this deliberately accepts arbitrary real
// heights (144, 720, 4320, ...) reported by format probing, not just the
// fixed preset list, while staying injection-safe: a malicious/garbled
// string just coerces to NaN and falls back to no filter rather than being
// interpolated as-is.
function resolveHeight(quality) {
  if (!quality || quality === 'best') return null;
  const height = Number(quality);
  return Number.isFinite(height) && height > 0 ? height : null;
}

function buildFormatArgs(quality, format) {
  const args = [];
  const height = resolveHeight(quality);

  if (AUDIO_FORMATS.has(format)) {
    args.push('-f', 'bestaudio/best');
    args.push('-x', '--audio-format', format);
    return args;
  }

  const outputFormat = VIDEO_FORMATS.has(format) ? format : 'mp4';
  const filter = height ? `[height<=${height}]` : '';
  args.push('-f', `bestvideo${filter}+bestaudio/best${filter}`);
  args.push('--merge-output-format', outputFormat);
  return args;
}

export function buildArgs({ url, outputDir, quality, format, ffmpegPath, filenameTemplate, downloadSpeedLimit }) {
  const outputTemplate = path.join(outputDir, resolveFilenameTemplate(filenameTemplate));
  const args = [
    url,
    '--newline',
    // REQUIRED, do not remove: the `--print` below implies `--quiet`, and
    // yt-dlp's quiet mode also switches off progress reporting — which
    // silently killed every --progress-template line, leaving the UI stuck
    // at 0% for the whole download. `--progress` forces progress output
    // even while quiet. (`--no-quiet` does NOT work here: it restores the
    // [download]/[Merger] chatter but still emits zero progress lines.)
    '--progress',
    '--no-color',
    '--no-playlist',
    '--windows-filenames',
    '--ffmpeg-location',
    ffmpegPath,
    '-o',
    outputTemplate,
    '--progress-template',
    `download:${MARKER_PROGRESS}${SEP}%(progress.status)s${SEP}%(progress.downloaded_bytes)s${SEP}%(progress.total_bytes,progress.total_bytes_estimate)s${SEP}%(progress.speed)s${SEP}%(progress.eta)s`,
    '--print',
    `after_move:${MARKER_FILEPATH}${SEP}%(filepath)s`,
    ...buildFormatArgs(quality, format)
  ];
  // Validated against a strict digits+K/M/G pattern (see isValidSpeedLimit)
  // before ever reaching here, so this can never inject extra flags.
  if (isValidSpeedLimit(downloadSpeedLimit) && downloadSpeedLimit) {
    args.push('--limit-rate', downloadSpeedLimit);
  }
  return args;
}

function parseNumeric(value) {
  if (value === undefined || value === null || value === 'NA' || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export class DownloadJob {
  constructor({ url, outputDir, quality, format, filenameTemplate, downloadSpeedLimit, ytDlpPath, ffmpegPath }) {
    this.id = crypto.randomUUID();
    this.url = url;
    this.outputDir = outputDir;
    this.quality = quality;
    this.format = format;
    this.filenameTemplate = filenameTemplate;
    this.downloadSpeedLimit = downloadSpeedLimit;
    this.ytDlpPath = ytDlpPath;
    this.ffmpegPath = ffmpegPath;
    this.cancelled = false;
    this.child = null;
    this.stderrBuffer = '';
    this.finalFilePath = null;
  }

  start({ onProgress, onStatus, onDone, onError }) {
    devLog('[Download] Starting download:', redactUrl(this.url));
    devLog('[Download] Selected format: quality =', this.quality, '- format =', this.format);

    const args = buildArgs({
      url: this.url,
      outputDir: this.outputDir,
      quality: this.quality,
      format: this.format,
      filenameTemplate: this.filenameTemplate,
      downloadSpeedLimit: this.downloadSpeedLimit,
      ffmpegPath: this.ffmpegPath
    });

    // args[0] is always the target url (see buildArgs) — every download
    // re-runs yt-dlp against this ORIGINAL url, never a media URL captured
    // during a prior analysis pass, so extraction happens fresh right here.
    devLog('[Download] Starting yt-dlp:', [redactUrl(args[0]), ...args.slice(1)].join(' '));

    let child;
    try {
      child = spawn(this.ytDlpPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        // yt-dlp's --progress-template hook (unlike its default progress bar)
        // doesn't flush stdout per update, so under Node's non-tty pipe its
        // output gets fully block-buffered by Python and only appears in one
        // burst right before the process exits — the UI would sit at
        // "Starting…" with no progress for the whole download. Forcing
        // unbuffered mode makes every update arrive as it's written.
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });
    } catch (err) {
      onError('errors.startFailed');
      return;
    }
    this.child = child;

    let stdoutTail = '';
    let sawStdoutProgress = false;
    child.stdout.on('data', (chunk) => {
      sawStdoutProgress = true;
      stdoutTail += chunk.toString('utf-8');
      const lines = stdoutTail.split(/\r?\n/);
      stdoutTail = lines.pop() ?? '';
      for (const line of lines) this._handleStdoutLine(line, { onProgress, onStatus });
    });

    // yt-dlp's --progress-template hook writes to stdout without an explicit
    // flush, and under some Electron/Windows main-process configurations that
    // output only surfaces as one burst right as the process exits — the UI
    // would sit at "Starting…" with zero feedback for the whole download.
    // As a robust fallback that doesn't depend on yt-dlp's stdout timing at
    // all, watch the growing .part file on disk directly. If real stdout
    // progress does arrive, it simply overwrites these numbers with more
    // precise ones (percent/eta), so this never fights the primary path.
    let lastPollBytes = 0;
    let lastPollTime = Date.now();
    const pollTimer = setInterval(() => {
      if (sawStdoutProgress) return;
      fs.readdir(this.outputDir, (err, files) => {
        if (err || this.cancelled) return;
        let best = null;
        for (const name of files) {
          if (!name.endsWith('.part')) continue;
          const full = path.join(this.outputDir, name);
          try {
            const st = fs.statSync(full);
            if (!best || st.mtimeMs > best.mtimeMs) best = { size: st.size, mtimeMs: st.mtimeMs };
          } catch {
            /* file may have been renamed/removed between readdir and stat */
          }
        }
        if (!best) return;
        const now = Date.now();
        const elapsedSec = (now - lastPollTime) / 1000;
        const speed = elapsedSec > 0 && lastPollBytes > 0 ? Math.max(0, (best.size - lastPollBytes) / elapsedSec) : null;
        lastPollBytes = best.size;
        lastPollTime = now;
        onProgress({ status: 'downloading', downloadedBytes: best.size, totalBytes: null, speedBytesPerSec: speed, etaSeconds: null });
      });
    }, 750);
    child.once('close', () => clearInterval(pollTimer));

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf-8');
      this.stderrBuffer += text;
      if (this.stderrBuffer.length > 20000) {
        this.stderrBuffer = this.stderrBuffer.slice(-20000);
      }
    });

    child.on('error', (err) => {
      if (this.cancelled) return;
      onError('errors.startFailed');
    });

    child.on('close', (code) => {
      devLog('[Download] Process exited with code:', code);
      if (this.cancelled) {
        onStatus('cancelled');
        return;
      }
      if (code === 0) {
        onDone({ filePath: this.finalFilePath });
      } else {
        const classified = classifyError(this.stderrBuffer, code);
        devLog('[Download] Classified failure as:', classified);
        onError(classified);
      }
    });
  }

  _handleStdoutLine(line, { onProgress, onStatus }) {
    if (line.startsWith(MARKER_PROGRESS + SEP)) {
      // One-shot: confirms progress reporting is actually alive. Silence
      // here means yt-dlp emitted no progress at all (the --progress /
      // implied-quiet trap documented in buildArgs), which is otherwise
      // invisible because the UI just sits at 0%.
      if (!this._loggedFirstProgress) {
        this._loggedFirstProgress = true;
        devLog('[Download] Progress reporting active (first update received)');
      }
      const [, status, downloaded, total, speed, eta] = line.split(SEP);
      onProgress({
        status,
        downloadedBytes: parseNumeric(downloaded),
        totalBytes: parseNumeric(total),
        speedBytesPerSec: parseNumeric(speed),
        etaSeconds: parseNumeric(eta)
      });
      return;
    }
    if (line.startsWith(MARKER_FILEPATH + SEP)) {
      const [, filePath] = line.split(SEP);
      this.finalFilePath = filePath;
      return;
    }
    if (/^\[Merger\]/.test(line)) onStatus('merging');
    else if (/^\[ExtractAudio\]/.test(line)) onStatus('extracting-audio');
    else if (/^\[ffmpeg\]/.test(line)) onStatus('processing');
    else if (/^\[(youtube|info|generic)\]/.test(line)) onStatus('fetching-info');
    else if (/has already been downloaded/i.test(line)) onStatus('already-downloaded');
  }

  cancel() {
    if (!this.child || this.cancelled) return;
    this.cancelled = true;
    const pid = this.child.pid;
    if (process.platform === 'win32' && pid) {
      // yt-dlp spawns ffmpeg as a subprocess; a plain kill() only signals
      // the yt-dlp process itself and can leave ffmpeg running orphaned.
      exec(`taskkill /pid ${pid} /T /F`, () => {});
    } else {
      this.child.kill('SIGKILL');
    }
  }
}
