import { defineStore } from 'pinia';

const STATUS_LABELS = {
  idle: '',
  starting: 'Starting…',
  'fetching-info': 'Fetching video information…',
  downloading: 'Downloading…',
  merging: 'Merging audio and video…',
  'extracting-audio': 'Extracting audio…',
  processing: 'Finalizing…',
  'already-downloaded': 'File already downloaded',
  finished: 'Download complete',
  error: 'Error',
  cancelled: 'Download cancelled'
};

export const useDownloadStore = defineStore('download', {
  state: () => ({
    ready: false,
    url: '',
    outputDir: '',
    quality: 'best',
    format: 'mp4',
    autoOpenFolder: true,

    activeDownloadId: null,
    status: 'idle',
    percent: 0,
    downloadedBytes: null,
    totalBytes: null,
    speedBytesPerSec: null,
    etaSeconds: null,
    errorMessage: '',
    lastFilePath: null,
    lastOutputDir: null,

    binaries: {
      ytDlp: { available: false, version: null },
      ffmpeg: { available: false, version: null }
    },

    unsubscribers: []
  }),

  getters: {
    statusLabel: (state) => STATUS_LABELS[state.status] ?? '',
    isDownloading: (state) =>
      !['idle', 'finished', 'error', 'cancelled'].includes(state.status),
    binariesReady: (state) => state.binaries.ytDlp.available && state.binaries.ffmpeg.available
  },

  actions: {
    async init() {
      const [settings, binaries] = await Promise.all([
        window.api.getSettings(),
        window.api.checkBinaries()
      ]);
      this.outputDir = settings.downloadDir;
      this.quality = settings.quality;
      this.format = settings.format;
      this.autoOpenFolder = settings.autoOpenFolder;
      this.binaries = binaries;
      this._subscribe();
      await this._reattachActiveDownload();
      this.ready = true;
    },

    async _reattachActiveDownload() {
      const active = await window.api.getActiveDownload();
      if (!active) return;
      this.url = active.url;
      this.outputDir = active.outputDir;
      this.quality = active.quality;
      this.format = active.format;
      this.activeDownloadId = active.id;
      const progress = active.progress;
      if (progress?.status) {
        this.status = ['downloading', 'finished'].includes(progress.status)
          ? progress.status === 'finished'
            ? 'processing'
            : 'downloading'
          : progress.status;
      } else {
        this.status = 'starting';
      }
      if (progress?.totalBytes && progress?.downloadedBytes !== undefined) {
        this.downloadedBytes = progress.downloadedBytes;
        this.totalBytes = progress.totalBytes;
        this.percent = progress.totalBytes ? (progress.downloadedBytes / progress.totalBytes) * 100 : 0;
        this.speedBytesPerSec = progress.speedBytesPerSec;
        this.etaSeconds = progress.etaSeconds;
      }
    },

    _subscribe() {
      this.unsubscribers.push(
        window.api.onDownloadProgress((data) => {
          if (data.id !== this.activeDownloadId) return;
          if (data.status === 'downloading') this.status = 'downloading';
          else if (data.status === 'finished') this.status = 'processing';
          if (data.totalBytes && data.downloadedBytes !== null) {
            this.percent = Math.min(100, (data.downloadedBytes / data.totalBytes) * 100);
          }
          this.downloadedBytes = data.downloadedBytes;
          this.totalBytes = data.totalBytes;
          this.speedBytesPerSec = data.speedBytesPerSec;
          this.etaSeconds = data.etaSeconds;
        })
      );
      this.unsubscribers.push(
        window.api.onDownloadStatus((data) => {
          if (data.id !== this.activeDownloadId) return;
          this.status = data.status;
        })
      );
      this.unsubscribers.push(
        window.api.onDownloadComplete((data) => {
          if (data.id !== this.activeDownloadId) return;
          this.status = 'finished';
          this.percent = 100;
          this.lastFilePath = data.filePath;
          this.lastOutputDir = data.outputDir;
          this.activeDownloadId = null;
          if (this.autoOpenFolder) {
            window.api.openFolder(data.outputDir);
          }
        })
      );
      this.unsubscribers.push(
        window.api.onDownloadError((data) => {
          if (data.id !== this.activeDownloadId) return;
          this.status = 'error';
          this.errorMessage = data.message;
          this.activeDownloadId = null;
        })
      );
    },

    async browseFolder() {
      const dir = await window.api.selectDownloadFolder();
      if (dir) this.outputDir = dir;
    },

    async saveSettings() {
      await window.api.updateSettings({
        downloadDir: this.outputDir,
        quality: this.quality,
        format: this.format,
        autoOpenFolder: this.autoOpenFolder
      });
    },

    resetProgress() {
      this.status = 'idle';
      this.percent = 0;
      this.downloadedBytes = null;
      this.totalBytes = null;
      this.speedBytesPerSec = null;
      this.etaSeconds = null;
      this.errorMessage = '';
      this.lastFilePath = null;
    },

    async startDownload() {
      this.errorMessage = '';
      if (!this.url.trim()) {
        this.errorMessage = 'Please enter a video URL.';
        return;
      }
      if (!this.outputDir) {
        this.errorMessage = 'Please choose a download location.';
        return;
      }
      if (!this.binariesReady) {
        this.errorMessage = 'yt-dlp or FFmpeg is missing. Check Settings for details.';
        return;
      }
      this.resetProgress();
      this.status = 'starting';
      await this.saveSettings();
      try {
        const { id } = await window.api.startDownload({
          url: this.url.trim(),
          outputDir: this.outputDir,
          quality: this.quality,
          format: this.format
        });
        this.activeDownloadId = id;
      } catch (err) {
        this.status = 'error';
        const cleaned = err?.message
          ?.replace(/^Error invoking remote method '.*?': ?/, '')
          ?.replace(/^[A-Za-z]*Error: ?/, '');
        this.errorMessage = cleaned || 'Failed to start the download.';
      }
    },

    async cancelDownload() {
      await window.api.cancelDownload();
      this.status = 'cancelled';
      this.activeDownloadId = null;
    },

    async openDownloadFolder() {
      const target = this.lastOutputDir || this.outputDir;
      if (target) await window.api.openFolder(target);
    },

    async updateYtDlp() {
      const { version } = await window.api.updateYtDlp();
      this.binaries.ytDlp.version = version;
      const refreshed = await window.api.checkBinaries();
      this.binaries = refreshed;
    }
  }
});
