import crypto from 'node:crypto';
import { DownloadJob, validateUrl, validateOutputDir, resolveFilenameTemplate } from './downloader.js';
import { isValidSpeedLimit } from './settings.js';

const TERMINAL_STATUSES = new Set(['finished', 'error', 'cancelled']);

// Sequential download queue: only one yt-dlp process runs at a time (kinder
// to bandwidth/CPU and keeps the child-process model simple), with
// additional items waiting their turn as 'queued'.
export class QueueManager {
  constructor({ getYtDlpPath, getFfmpegPath, binaryExists, onEvent }) {
    this.getYtDlpPath = getYtDlpPath;
    this.getFfmpegPath = getFfmpegPath;
    this.binaryExists = binaryExists;
    this.onEvent = onEvent; // (channel, payload) => void

    this.items = []; // display order, oldest first
    this.pendingIds = []; // FIFO of ids waiting to start
    this.currentJob = null;
    this.currentItemId = null;
  }

  _findItem(id) {
    return this.items.find((item) => item.id === id);
  }

  _emitItemUpdate(item) {
    this.onEvent('queue:item-updated', { ...item });
  }

  add({ url, outputDir, quality, format, filenameTemplate, downloadSpeedLimit }) {
    // Validation errors throw synchronously and never reach the queue —
    // the caller (ipc.js) surfaces them as an immediate rejection.
    const cleanUrl = validateUrl(url);
    const cleanOutputDir = validateOutputDir(outputDir);

    const item = {
      id: crypto.randomUUID(),
      url: cleanUrl,
      outputDir: cleanOutputDir,
      quality: typeof quality === 'string' ? quality : 'best',
      format: typeof format === 'string' ? format : 'mp4',
      filenameTemplate: resolveFilenameTemplate(filenameTemplate),
      downloadSpeedLimit: isValidSpeedLimit(downloadSpeedLimit) ? downloadSpeedLimit : null,
      status: 'queued',
      percent: 0,
      downloadedBytes: null,
      totalBytes: null,
      speedBytesPerSec: null,
      etaSeconds: null,
      errorMessage: null,
      filePath: null,
      createdAt: Date.now()
    };

    this.items.push(item);
    this.pendingIds.push(item.id);
    // Emit before processing starts so the renderer's *only* write path for
    // queue items is this event stream — the ipcMain.handle return value is
    // for the id/promise, never used to mutate renderer state. Pushing from
    // both the invoke() result and this event raced and produced duplicates.
    this._emitItemUpdate(item);
    this._processNext();
    return { ...item };
  }

  cancel(id) {
    const item = this._findItem(id);
    if (!item || TERMINAL_STATUSES.has(item.status)) return false;

    if (this.currentItemId === id && this.currentJob) {
      this.currentJob.cancel();
      this.currentJob = null;
      this.currentItemId = null;
      item.status = 'cancelled';
      this._emitItemUpdate(item);
      this._processNext();
      return true;
    }

    const pendingIndex = this.pendingIds.indexOf(id);
    if (pendingIndex !== -1) {
      this.pendingIds.splice(pendingIndex, 1);
      item.status = 'cancelled';
      this._emitItemUpdate(item);
      return true;
    }

    return false;
  }

  remove(id) {
    const item = this._findItem(id);
    if (!item) return false;
    if (!TERMINAL_STATUSES.has(item.status)) {
      this.cancel(id);
    }
    this.items = this.items.filter((i) => i.id !== id);
    return true;
  }

  getState() {
    return this.items.map((item) => ({ ...item }));
  }

  _processNext() {
    if (this.currentJob) return; // already busy
    const nextId = this.pendingIds.shift();
    if (!nextId) return; // nothing waiting

    const item = this._findItem(nextId);
    if (!item) {
      this._processNext();
      return;
    }

    const ytDlpPath = this.getYtDlpPath();
    const ffmpegPath = this.getFfmpegPath();
    if (!this.binaryExists(ytDlpPath) || !this.binaryExists(ffmpegPath)) {
      item.status = 'error';
      item.errorMessage = 'errors.binariesMissing';
      this._emitItemUpdate(item);
      this._processNext();
      return;
    }

    const job = new DownloadJob({
      url: item.url,
      outputDir: item.outputDir,
      quality: item.quality,
      format: item.format,
      filenameTemplate: item.filenameTemplate,
      downloadSpeedLimit: item.downloadSpeedLimit,
      ytDlpPath,
      ffmpegPath
    });
    this.currentJob = job;
    this.currentItemId = item.id;
    item.status = 'starting';
    this._emitItemUpdate(item);

    let lastEmit = 0;
    job.start({
      onProgress: (data) => {
        item.status = data.status === 'finished' ? 'processing' : data.status;
        item.downloadedBytes = data.downloadedBytes;
        item.totalBytes = data.totalBytes;
        item.speedBytesPerSec = data.speedBytesPerSec;
        item.etaSeconds = data.etaSeconds;
        if (data.totalBytes && data.downloadedBytes !== null) {
          item.percent = Math.min(100, (data.downloadedBytes / data.totalBytes) * 100);
        }
        const now = Date.now();
        if (now - lastEmit < 150 && data.status !== 'finished') return;
        lastEmit = now;
        this._emitItemUpdate(item);
      },
      onStatus: (status) => {
        item.status = status;
        this._emitItemUpdate(item);
      },
      onDone: (result) => {
        item.status = 'finished';
        item.percent = 100;
        item.filePath = result.filePath;
        this._emitItemUpdate(item);
        this.currentJob = null;
        this.currentItemId = null;
        this.onEvent('queue:item-complete', { id: item.id, filePath: result.filePath, outputDir: item.outputDir });
        this._processNext();
      },
      onError: (message) => {
        item.status = 'error';
        item.errorMessage = message;
        this._emitItemUpdate(item);
        this.currentJob = null;
        this.currentItemId = null;
        this._processNext();
      }
    });
  }
}
