import { spawn, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Unique markers so we can pick our structured progress/print lines out of
// yt-dlp's normal chatter on stdout without ambiguity.
const SEP = '';
const MARKER_PROGRESS = 'YTDLP-PROGRESS';
const MARKER_FILEPATH = 'YTDLP-FILEPATH';

const QUALITY_HEIGHTS = {
  best: null,
  '2160': 2160,
  '1440': 1440,
  '1080': 1080,
  '720': 720,
  '480': 480,
  '360': 360
};

const VIDEO_FORMATS = new Set(['mp4', 'mkv', 'webm']);
const AUDIO_FORMATS = new Set(['mp3']);

export class ValidationError extends Error {}

export function validateUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    throw new ValidationError('Please enter a video URL.');
  }
  const url = rawUrl.trim();
  if (!url) {
    throw new ValidationError('Please enter a video URL.');
  }
  // yt-dlp treats any argument starting with "-" as an option, which would
  // let a crafted "URL" inject extra command-line flags. Reject outright.
  if (url.startsWith('-')) {
    throw new ValidationError('That does not look like a valid URL.');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('That does not look like a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only http:// and https:// URLs are supported.');
  }
  return url;
}

export function validateOutputDir(dir) {
  if (typeof dir !== 'string' || !dir.trim()) {
    throw new ValidationError('Please choose a download location.');
  }
  if (!path.isAbsolute(dir)) {
    throw new ValidationError('The download location must be an absolute path.');
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw new ValidationError('Permission denied for the selected download folder.');
    }
    throw new ValidationError('The selected download folder is not usable.');
  }
  return dir;
}

function buildFormatArgs(quality, format) {
  const args = [];
  const height = Object.prototype.hasOwnProperty.call(QUALITY_HEIGHTS, quality)
    ? QUALITY_HEIGHTS[quality]
    : null;

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

export function buildArgs({ url, outputDir, quality, format, ffmpegPath }) {
  const outputTemplate = path.join(outputDir, '%(title)s.%(ext)s');
  return [
    url,
    '--newline',
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
}

function classifyError(stderrText, exitCode) {
  const text = stderrText || '';
  const patterns = [
    [/no space left on device|enospc/i, 'Not enough disk space to complete the download.'],
    [/permission denied|eacces|eperm/i, 'Permission denied. Choose a different download folder and try again.'],
    [/sign in to confirm|age[- ]restricted/i, 'This video requires sign-in or is age-restricted and cannot be downloaded.'],
    [/video unavailable|this video is not available|has been removed/i, 'This video is unavailable. It may have been removed or made private.'],
    [/http error 403|forbidden/i, 'Download link has expired. Please obtain a fresh video URL and try again.'],
    [/http error 404/i, 'The video could not be found at that URL.'],
    [/unsupported url/i, 'This URL is not supported.'],
    [/unable to download webpage|getaddrinfo|enotfound|econnrefused|econnreset|network is unreachable|timed out/i, 'Network error. Check your internet connection and try again.'],
    [/ffmpeg not found|ffprobe not found/i, 'FFmpeg is missing. Please reinstall the application.'],
    [/ffmpeg\.exe.*not found|yt-dlp\.exe.*not found/i, 'A required component is missing. Please reinstall the application.'],
    [/could not write to output file|no such file or directory/i, 'Could not write the downloaded file. Check the download folder and try again.']
  ];
  for (const [regex, message] of patterns) {
    if (regex.test(text)) return message;
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lastError = [...lines].reverse().find((l) => /^error/i.test(l));
  if (lastError) {
    return `The download failed: ${lastError.replace(/^ERROR:\s*/i, '')}`;
  }
  return `The download failed unexpectedly (exit code ${exitCode}).`;
}

function parseNumeric(value) {
  if (value === undefined || value === null || value === 'NA' || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export class DownloadJob {
  constructor({ url, outputDir, quality, format, ytDlpPath, ffmpegPath }) {
    this.id = crypto.randomUUID();
    this.url = url;
    this.outputDir = outputDir;
    this.quality = quality;
    this.format = format;
    this.ytDlpPath = ytDlpPath;
    this.ffmpegPath = ffmpegPath;
    this.cancelled = false;
    this.child = null;
    this.stderrBuffer = '';
    this.finalFilePath = null;
  }

  start({ onProgress, onStatus, onDone, onError }) {
    const args = buildArgs({
      url: this.url,
      outputDir: this.outputDir,
      quality: this.quality,
      format: this.format,
      ffmpegPath: this.ffmpegPath
    });

    let child;
    try {
      child = spawn(this.ytDlpPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (err) {
      onError('Failed to start yt-dlp. Please reinstall the application.');
      return;
    }
    this.child = child;

    let stdoutTail = '';
    child.stdout.on('data', (chunk) => {
      stdoutTail += chunk.toString('utf-8');
      const lines = stdoutTail.split(/\r?\n/);
      stdoutTail = lines.pop() ?? '';
      for (const line of lines) this._handleStdoutLine(line, { onProgress, onStatus });
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf-8');
      this.stderrBuffer += text;
      if (this.stderrBuffer.length > 20000) {
        this.stderrBuffer = this.stderrBuffer.slice(-20000);
      }
    });

    child.on('error', (err) => {
      if (this.cancelled) return;
      onError('Failed to start yt-dlp. Please reinstall the application.');
    });

    child.on('close', (code) => {
      if (this.cancelled) {
        onStatus('cancelled');
        return;
      }
      if (code === 0) {
        onDone({ filePath: this.finalFilePath });
      } else {
        onError(classifyError(this.stderrBuffer, code));
      }
    });
  }

  _handleStdoutLine(line, { onProgress, onStatus }) {
    if (line.startsWith(MARKER_PROGRESS + SEP)) {
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
