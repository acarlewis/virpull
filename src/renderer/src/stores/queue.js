import { defineStore } from 'pinia';
import { i18n, translateMessage, translateIpcError } from '../i18n';
import { quickRecognize } from '../utils/urlRecognition';
import { recommendQuality } from '../utils/recommendation';

// Debounces the auto-analyze triggered by onUrlChanged() so a paste (one
// value change) analyzes right away while character-by-character typing
// doesn't fire an IPC/yt-dlp call per keystroke. Module-level rather than
// store state since it's a timer handle, not app data.
let urlAnalyzeTimer = null;

export const useQueueStore = defineStore('queue', {
  state: () => ({
    ready: false,

    // "Add to queue" form fields
    url: '',
    outputDir: '',
    quality: 'best',
    format: 'mp4',
    qualityMode: 'recommended', // 'recommended' | 'best' | 'balanced' | 'smallest' | 'custom'
    downloadSpeedLimit: null, // null (unlimited) | yt-dlp --limit-rate value, e.g. '5M'
    formError: '',

    // URL analysis (auto-triggered on paste/edit — see onUrlChanged())
    analysis: {
      status: 'idle', // 'idle' | 'analyzing' | 'ready' | 'error'
      data: null,
      errorMessage: ''
    },

    // Preferences
    autoOpenFolder: true,
    theme: 'dark',
    language: 'en',
    filenameTemplate: '%(title)s.%(ext)s',
    clipboardDetectionEnabled: true,
    previewEnabled: true,

    // Non-intrusive "we noticed a URL in your clipboard" suggestion — never
    // auto-filled or auto-downloaded, only shown for the user to accept.
    clipboardSuggestion: null,
    lastDismissedClipboardUrl: null,

    previewOpen: false,

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
    activeCount: (state) => state.queue.filter((i) => !['finished', 'error', 'cancelled'].includes(i.status)).length,
    isAnalyzing: (state) => state.analysis.status === 'analyzing',
    // Instant heuristic badge while typing, upgraded to the confirmed result
    // once Analyze actually runs (or downgraded to "unsupported" if it
    // failed specifically because yt-dlp has no extractor for it).
    urlRecognition: (state) => {
      if (state.analysis.status === 'ready' && state.analysis.data) {
        const { platform, type } = state.analysis.data;
        return { supported: true, platform, type };
      }
      if (state.analysis.status === 'error' && state.analysis.errorMessage) {
        return { supported: false, platform: null, type: 'invalid' };
      }
      return quickRecognize(state.url);
    },
    probedHeights: (state) => {
      if (state.analysis.status !== 'ready' || !state.analysis.data) return null;
      const heights = [
        ...new Set(state.analysis.data.formats.filter((f) => f.hasVideo && f.height).map((f) => f.height))
      ].sort((a, b) => b - a);
      return heights;
    }
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
      this.qualityMode = settings.qualityMode;
      this.downloadSpeedLimit = settings.downloadSpeedLimit;
      this.clipboardDetectionEnabled = settings.clipboardDetectionEnabled;
      this.previewEnabled = settings.previewEnabled;
      this._applyTheme();
      this._applyLanguage();
      this.binaries = binaries;
      this.queue = queueState;
      this._subscribe();
      this.ready = true;
      window.api.notifyReady();
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
      this.unsubscribers.push(window.api.onClipboardUrlDetected((url) => this._handleClipboardUrl(url)));
    },

    _handleClipboardUrl(url) {
      if (!this.clipboardDetectionEnabled) return;
      if (url === this.url.trim()) return;
      if (url === this.lastDismissedClipboardUrl) return;
      this.clipboardSuggestion = url;
    },

    acceptClipboardSuggestion() {
      if (!this.clipboardSuggestion) return;
      this.url = this.clipboardSuggestion;
      this.clipboardSuggestion = null;
    },

    dismissClipboardSuggestion() {
      this.lastDismissedClipboardUrl = this.clipboardSuggestion;
      this.clipboardSuggestion = null;
    },

    async setClipboardDetectionEnabled(enabled) {
      this.clipboardDetectionEnabled = enabled;
      if (!enabled) this.clipboardSuggestion = null;
      await window.api.updateSettings({ clipboardDetectionEnabled: enabled });
    },

    async setPreviewEnabled(enabled) {
      this.previewEnabled = enabled;
      await window.api.updateSettings({ previewEnabled: enabled });
    },

    openPreview() {
      this.previewOpen = true;
    },

    closePreview() {
      this.previewOpen = false;
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

    // In every mode except 'custom', the resolution is derived automatically
    // from the current analysis (or 'best' if nothing's been analyzed yet)
    // rather than picked by hand — see utils/recommendation.js.
    _applyQualityMode() {
      if (this.qualityMode === 'custom') return;
      this.quality = recommendQuality(this.analysis.data, this.qualityMode);
    },

    async setQualityMode(mode) {
      this.qualityMode = mode;
      this._applyQualityMode();
      await window.api.updateSettings({ qualityMode: mode });
    },

    async setDownloadSpeedLimit(value) {
      this.downloadSpeedLimit = value;
      await window.api.updateSettings({ downloadSpeedLimit: value });
    },

    // A URL edit invalidates whatever was previously analyzed/selected —
    // reset rather than risk showing stale metadata or an out-of-range
    // quality for the new URL. Then, if it looks like a real URL, kick off
    // analysis automatically (debounced — see urlAnalyzeTimer) instead of
    // waiting for an explicit user action.
    onUrlChanged() {
      this.analysis = { status: 'idle', data: null, errorMessage: '' };
      this._applyQualityMode();

      clearTimeout(urlAnalyzeTimer);
      const trimmed = this.url.trim();
      if (!trimmed || quickRecognize(trimmed)?.type === 'invalid') return;
      urlAnalyzeTimer = setTimeout(() => {
        if (this.url.trim() === trimmed) this.analyzeUrl();
      }, 400);
    },

    async analyzeUrl() {
      const url = this.url.trim();
      if (!url) {
        this.formError = translateMessage('errors.urlRequired');
        return;
      }
      if (!this.binariesReady) {
        this.formError = translateMessage('errors.binariesMissing');
        return;
      }
      this.formError = '';
      this.analysis = { status: 'analyzing', data: null, errorMessage: '' };
      try {
        const data = await window.api.analyzeUrl(url);
        if (this.url.trim() !== url) return; // URL changed while analyzing; discard stale result
        this.analysis = { status: 'ready', data, errorMessage: '' };
        if (this.qualityMode === 'custom') {
          const validValues = ['best', ...(this.probedHeights || []).map(String)];
          if (!validValues.includes(this.quality)) this.quality = 'best';
        } else {
          this._applyQualityMode();
        }
      } catch (err) {
        if (this.url.trim() !== url) return;
        this.analysis = { status: 'error', data: null, errorMessage: translateIpcError(err, 'errors.network') };
      }
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
          filenameTemplate: this.filenameTemplate,
          downloadSpeedLimit: this.downloadSpeedLimit
        });
        this.url = '';
        this.onUrlChanged();
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

    async retryItem(id) {
      await window.api.retryQueueItem(id);
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
