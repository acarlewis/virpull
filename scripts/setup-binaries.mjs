#!/usr/bin/env node
// Downloads yt-dlp.exe and ffmpeg.exe into resources/binaries/ so
// contributors don't have to hunt down download links manually. Safe to
// re-run — it skips any binary that's already present. Also wired up as a
// (non-fatal) postinstall hook; see the try/catch in main().
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BINARIES_DIR = path.join(__dirname, '..', 'resources', 'binaries');
const YTDLP_PATH = path.join(BINARIES_DIR, 'yt-dlp.exe');
const FFMPEG_PATH = path.join(BINARIES_DIR, 'ffmpeg.exe');

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_ZIP_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

function progressTransform(label, totalBytes) {
  let downloaded = 0;
  let lastPct = -10;
  return new Transform({
    transform(chunk, _enc, callback) {
      downloaded += chunk.length;
      if (totalBytes) {
        const pct = Math.floor((downloaded / totalBytes) * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          console.log(`  ${label}: ${pct}% (${(downloaded / 1024 / 1024).toFixed(0)} MB)`);
        }
      }
      callback(null, chunk);
    }
  });
}

async function downloadFile(url, destPath, label) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status} ${res.statusText}): ${url}`);
  }
  const totalBytes = Number(res.headers.get('content-length')) || 0;
  const tmpPath = `${destPath}.download`;
  await pipeline(Readable.fromWeb(res.body), progressTransform(label, totalBytes), fs.createWriteStream(tmpPath));
  fs.renameSync(tmpPath, destPath);
}

function findFileRecursive(dir, filename) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(full, filename);
      if (found) return found;
    } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
      return full;
    }
  }
  return null;
}

async function ensureYtDlp() {
  if (fs.existsSync(YTDLP_PATH)) {
    console.log('yt-dlp.exe already present, skipping.');
    return;
  }
  console.log('Downloading yt-dlp.exe ...');
  await downloadFile(YTDLP_URL, YTDLP_PATH, 'yt-dlp.exe');
  console.log('yt-dlp.exe downloaded.');
}

async function ensureFfmpeg() {
  if (fs.existsSync(FFMPEG_PATH)) {
    console.log('ffmpeg.exe already present, skipping.');
    return;
  }
  if (process.platform !== 'win32') {
    console.log(
      'Skipping automatic FFmpeg extraction (needs Windows/PowerShell). ' +
        'Download a Windows ffmpeg.exe build manually and place it in resources/binaries/.'
    );
    return;
  }

  console.log('Downloading FFmpeg (a full static build, ~150-200 MB — this can take a few minutes) ...');
  const zipPath = path.join(BINARIES_DIR, '_ffmpeg-download.zip');
  const extractDir = path.join(BINARIES_DIR, '_ffmpeg-extract');
  try {
    await downloadFile(FFMPEG_ZIP_URL, zipPath, 'ffmpeg.zip');

    console.log('Extracting ffmpeg.exe ...');
    fs.rmSync(extractDir, { recursive: true, force: true });
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`
    ]);

    const found = findFileRecursive(extractDir, 'ffmpeg.exe');
    if (!found) {
      throw new Error('ffmpeg.exe was not found inside the downloaded archive.');
    }
    fs.copyFileSync(found, FFMPEG_PATH);
    console.log('ffmpeg.exe extracted.');
  } finally {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

async function main() {
  fs.mkdirSync(BINARIES_DIR, { recursive: true });
  const isPostinstall = process.env.npm_lifecycle_event === 'postinstall';

  try {
    await ensureYtDlp();
    await ensureFfmpeg();
    console.log('\nBinaries are ready in resources/binaries/.');
  } catch (err) {
    console.error(`\nCould not fetch binaries automatically: ${err.message}`);
    console.error(
      'Retry with "npm run setup:binaries", or place yt-dlp.exe / ffmpeg.exe in\n' +
        'resources/binaries/ manually (see README.md for download links).'
    );
    // Don't fail `npm install` over this — binaries are only needed to run
    // or package the app, not to install its dependencies.
    process.exit(isPostinstall ? 0 : 1);
  }
}

main();
