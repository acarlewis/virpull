import crypto from 'node:crypto';
import { DownloadJob, validateUrl, validateOutputDir, resolveFilenameTemplate, EXPIRED_LINK_KEY } from './downloader.js';
import { isValidSpeedLimit } from './settings.js';
import { devLog } from './devLog.js';

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
    // Item ids that have already had their one automatic retry after an
    // EXPIRED_LINK_KEY failure (see _handleJobError) — never retried twice.
    this.expiredRetryAttempted = new Set();
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
      this.expiredRetryAttempted.delete(id);
      this._emitItemUpdate(item);
      this._processNext();
      return true;
    }

    const pendingIndex = this.pendingIds.indexOf(id);
    if (pendingIndex !== -1) {
      this.pendingIds.splice(pendingIndex, 1);
      item.status = 'cancelled';
      this.expiredRetryAttempted.delete(id);
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

    this._runJob(item, ytDlpPath, ffmpegPath);
  }

  // Spawns a DownloadJob for `item` and wires its callbacks. Split out from
  // _processNext so the same start-a-job logic can be reused for the
  // single automatic retry in _handleJobError — that retry restarts the
  // *same* item in place, it doesn't go back through the pending FIFO.
  _runJob(item, ytDlpPath, ffmpegPath) {
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
    item.errorMessage = null;
    // A restart (the expired-link auto-retry) re-downloads from scratch, so
    // clear stale progress rather than resuming the bar mid-way — and reset
    // the monotonic floor applied in onProgress below.
    item.percent = 0;
    item.downloadedBytes = null;
    item.totalBytes = null;
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
          const pct = Math.min(100, (data.downloadedBytes / data.totalBytes) * 100);
          // A `bestvideo+bestaudio` job downloads two separate streams, and
          // yt-dlp reports progress per stream — so the raw ratio drops back
          // to 0 when the audio stream starts, making the bar visibly reset
          // mid-download. Only ever move forwards within a single job
          // (_runJob resets this back to 0 when a job actually restarts).
          item.percent = Math.max(item.percent, pct);
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
        this.expiredRetryAttempted.delete(item.id);
        this._emitItemUpdate(item);
        this.currentJob = null;
        this.currentItemId = null;
        this.onEvent('queue:item-complete', { id: item.id, filePath: result.filePath, outputDir: item.outputDir });
        this._processNext();
      },
      onError: (message) => this._handleJobError(item, message, ytDlpPath, ffmpegPath)
    });
  }

  // yt-dlp re-extracts formats from the original page URL on every
  // invocation (see downloader.js buildArgs()/DownloadJob) — VirPull never
  // hands it a stale, previously-extracted media URL. So when a failure is
  // classified as an expired/gone link, simply re-running the same item
  // already gets a fresh extraction; no separate "refresh" step is needed.
  // We do this exactly once per item to avoid looping against a source
  // that's genuinely down/broken for other reasons.
  _handleJobError(item, message, ytDlpPath, ffmpegPath) {
    if (message === EXPIRED_LINK_KEY && !this.expiredRetryAttempted.has(item.id)) {
      this.expiredRetryAttempted.add(item.id);
      devLog('[Download] Link appeared expired — re-extracting from the original URL and retrying once');
      this.currentJob = null;
      this.currentItemId = null;
      this._runJob(item, ytDlpPath, ffmpegPath);
      return;
    }

    // Reaching here with EXPIRED_LINK_KEY means the retry branch above
    // already ran once for this item and it failed the same way again —
    // say so plainly instead of repeating "link expired" as if VirPull had
    // never tried to refresh it.
    const finalMessage = message === EXPIRED_LINK_KEY ? 'errors.expiredLinkRetryFailed' : message;

    item.status = 'error';
    item.errorMessage = finalMessage;
    this.expiredRetryAttempted.delete(item.id);
    this._emitItemUpdate(item);
    this.currentJob = null;
    this.currentItemId = null;
    this._processNext();
  }

  // Manual re-run of a failed item, e.g. from the queue UI's "Try again"
  // action — same url/settings, fresh yt-dlp invocation (and therefore
  // fresh extraction) just like the automatic retry above.
  retry(id) {
    const item = this._findItem(id);
    if (!item || item.status !== 'error') return false;

    item.status = 'queued';
    item.errorMessage = null;
    item.percent = 0;
    item.downloadedBytes = null;
    item.totalBytes = null;
    item.speedBytesPerSec = null;
    item.etaSeconds = null;
    this.expiredRetryAttempted.delete(id);
    this._emitItemUpdate(item);

    if (!this.pendingIds.includes(id)) this.pendingIds.push(id);
    this._processNext();
    return true;
  }
}
