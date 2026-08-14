import { defineStore } from 'pinia';

export const useQueueStore = defineStore('queue', {
  state: () => ({
    ready: false,

    // "Add to queue" form fields
    url: '',
    outputDir: '',
    quality: 'best',
    format: 'mp4',
    formError: '',

    // Preferences
    autoOpenFolder: true,
    theme: 'dark',

    // Sidebar
    sidebarView: 'queue', // 'queue' | 'settings'

    queue: [],

    binaries: {
      ytDlp: { available: false, version: null },
      ffmpeg: { available: false, version: null }
    },

    unsubscribers: []
  }),

  getters: {
    binariesReady: (state) => state.binaries.ytDlp.available && state.binaries.ffmpeg.available,
    activeCount: (state) => state.queue.filter((i) => !['finished', 'error', 'cancelled'].includes(i.status)).length
  },

  actions: {
    async init() {
      const [settings, binaries, queueState] = await Promise.all([
        window.api.getSettings(),
        window.api.checkBinaries(),
        window.api.getQueueState()
      ]);
      this.outputDir = settings.downloadDir;
      this.quality = settings.quality;
      this.format = settings.format;
      this.autoOpenFolder = settings.autoOpenFolder;
      this.theme = settings.theme;
      this._applyTheme();
      this.binaries = binaries;
      this.queue = queueState;
      this._subscribe();
      this.ready = true;
    },

    _subscribe() {
      this.unsubscribers.push(
        window.api.onQueueItemUpdated((item) => {
          const index = this.queue.findIndex((i) => i.id === item.id);
          if (index === -1) this.queue.push(item);
          else this.queue[index] = item;
        })
      );
      this.unsubscribers.push(
        window.api.onQueueItemComplete((data) => {
          if (this.autoOpenFolder) {
            window.api.openFolder(data.outputDir);
          }
        })
      );
    },

    setSidebarView(view) {
      this.sidebarView = view;
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

    _applyTheme() {
      document.documentElement.dataset.theme = this.theme;
    },

    async cycleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      this._applyTheme();
      await window.api.updateSettings({ theme: this.theme });
    },

    async addToQueue() {
      this.formError = '';
      if (!this.url.trim()) {
        this.formError = 'Please enter a video URL.';
        return;
      }
      if (!this.outputDir) {
        this.formError = 'Please choose a download location.';
        return;
      }
      if (!this.binariesReady) {
        this.formError = 'yt-dlp or FFmpeg is missing. Check Settings for details.';
        return;
      }
      try {
        // The new item's state arrives via the queue:item-updated event
        // (emitted synchronously before this call even resolves), not the
        // invoke() return value — see the comment in queue.js's add().
        await window.api.addToQueue({
          url: this.url.trim(),
          outputDir: this.outputDir,
          quality: this.quality,
          format: this.format
        });
        this.url = '';
      } catch (err) {
        const cleaned = err?.message
          ?.replace(/^Error invoking remote method '.*?': ?/, '')
          ?.replace(/^[A-Za-z]*Error: ?/, '');
        this.formError = cleaned || 'Failed to add the download.';
      }
    },

    async cancelItem(id) {
      await window.api.cancelQueueItem(id);
    },

    async removeItem(id) {
      const ok = await window.api.removeQueueItem(id);
      if (ok) this.queue = this.queue.filter((i) => i.id !== id);
    },

    async openItemFolder(item) {
      if (item?.outputDir) await window.api.openFolder(item.outputDir);
    },

    async updateYtDlp() {
      const { version } = await window.api.updateYtDlp();
      this.binaries.ytDlp.version = version;
      const refreshed = await window.api.checkBinaries();
      this.binaries = refreshed;
    }
  }
});
