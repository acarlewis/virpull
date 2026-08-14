import { defineStore } from 'pinia';
import { i18n, translateMessage, translateIpcError } from '../i18n';

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
    language: 'en',
    filenameTemplate: '%(title)s.%(ext)s',

    // Sidebar
    sidebarView: 'queue', // 'queue' | 'settings'
    settingsSection: 'general', // 'general' | 'appearance' | 'info'

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
      this.language = settings.language;
      this.filenameTemplate = settings.filenameTemplate;
      this._applyTheme();
      this._applyLanguage();
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

    setSettingsSection(section) {
      this.settingsSection = section;
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
        autoOpenFolder: this.autoOpenFolder,
        filenameTemplate: this.filenameTemplate
      });
    },

    _applyTheme() {
      document.documentElement.dataset.theme = this.theme;
    },

    async setTheme(theme) {
      this.theme = theme;
      this._applyTheme();
      await window.api.updateSettings({ theme });
    },

    _applyLanguage() {
      i18n.global.locale.value = this.language;
    },

    async setLanguage(language) {
      this.language = language;
      this._applyLanguage();
      await window.api.updateSettings({ language });
    },

    async setFilenameTemplate(template) {
      this.filenameTemplate = template;
      await window.api.updateSettings({ filenameTemplate: template });
    },

    async addToQueue() {
      this.formError = '';
      if (!this.url.trim()) {
        this.formError = translateMessage('errors.urlRequired');
        return;
      }
      if (!this.outputDir) {
        this.formError = translateMessage('errors.folderRequired');
        return;
      }
      if (!this.binariesReady) {
        this.formError = translateMessage('errors.binariesMissing');
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
          format: this.format,
          filenameTemplate: this.filenameTemplate
        });
        this.url = '';
      } catch (err) {
        this.formError = translateIpcError(err, 'errors.addFailed');
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
    },

    async checkForUpdate() {
      return window.api.checkForUpdate();
    },

    async openExternal(url) {
      await window.api.openExternal(url);
    }
  }
});
