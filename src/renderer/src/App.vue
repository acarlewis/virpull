<script setup>
import { onMounted, onUnmounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from './stores/queue';
import { formatHeightLabel } from './utils/format';
import UrlInput from './components/UrlInput.vue';
import UrlRecognitionBadge from './components/UrlRecognitionBadge.vue';
import VideoInfoCard from './components/VideoInfoCard.vue';
import PreviewModal from './components/PreviewModal.vue';
import ClipboardToast from './components/ClipboardToast.vue';
import FolderPicker from './components/FolderPicker.vue';
import QualitySelect from './components/QualitySelect.vue';
import QualityModeSelect from './components/QualityModeSelect.vue';
import DownloadSpeedSelect from './components/DownloadSpeedSelect.vue';
import FormatSelect from './components/FormatSelect.vue';
import ErrorBanner from './components/ErrorBanner.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import QueueList from './components/QueueList.vue';

const { t } = useI18n();
const store = useQueueStore();

onMounted(() => {
  store.init();
});
onUnmounted(() => {
  store.unsubscribers.forEach((unsub) => unsub());
});

// A URL edit invalidates whatever was previously analyzed — reset rather
// than show stale metadata/quality options for a different video.
watch(
  () => store.url,
  () => store.onUrlChanged()
);

function openAppearance() {
  store.setSidebarView('settings');
  store.setSettingsSection('appearance');
}

const resolvedQualityLabel = computed(() => {
  if (store.quality === 'best') return t('form.quality.best');
  const height = Number(store.quality);
  return Number.isFinite(height) ? formatHeightLabel(height) : store.quality;
});
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <img src="/logo.png" alt="" class="app-logo" />
      <h1>VirPull</h1>
      <button
        type="button"
        class="theme-toggle"
        :title="t('settings.appearance.heading')"
        :aria-label="t('settings.appearance.heading')"
        @click="openAppearance"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
          <path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 1.9-4.1 1.6 1.6 0 0 1 1.2-2.6H17a5 5 0 0 0 5-5c0-4.4-4.5-8.3-10-8.3Z" />
        </svg>
      </button>
    </header>

    <div class="app-body">
      <main class="app-main">
        <div v-if="!store.binariesReady && store.ready" class="binaries-warning">
          <strong>{{ t('binariesWarning.prefix') }}</strong>
          <span v-if="!store.binaries.ytDlp.available">yt-dlp.exe</span>
          <span v-if="!store.binaries.ytDlp.available && !store.binaries.ffmpeg.available">, </span>
          <span v-if="!store.binaries.ffmpeg.available">ffmpeg.exe</span>
          {{ t('binariesWarning.suffix') }}
        </div>

        <UrlInput v-model="store.url" :analyzing="store.isAnalyzing" @analyze="store.analyzeUrl" />

        <UrlRecognitionBadge v-if="store.url.trim()" />

        <div v-if="store.isAnalyzing" class="analysis-status loading">{{ t('analysis.analyzing') }}</div>
        <div v-else-if="store.analysis.status === 'error'" class="analysis-status error">
          {{ store.analysis.errorMessage }}
        </div>
        <div v-else-if="store.probedHeights && store.probedHeights.length" class="analysis-status ready">
          {{ t('analysis.qualitiesFound', { count: store.probedHeights.length }) }}
        </div>

        <VideoInfoCard />

        <FolderPicker v-model="store.outputDir" @browse="store.browseFolder" />

        <div class="row-2">
          <QualityModeSelect />
          <FormatSelect v-model="store.format" />
        </div>

        <QualitySelect v-if="store.qualityMode === 'custom'" v-model="store.quality" />
        <div v-else class="resolved-quality">{{ t('qualityMode.resolvesTo', { quality: resolvedQualityLabel }) }}</div>

        <DownloadSpeedSelect />

        <div class="actions">
          <button type="button" class="btn-primary" @click="store.addToQueue">{{ t('form.addToQueue') }}</button>
        </div>

        <ErrorBanner :message="store.formError" @dismiss="store.formError = ''" />
      </main>

      <aside class="sidebar">
        <div class="sidebar-tabs">
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: store.sidebarView === 'queue' }"
            @click="store.setSidebarView('queue')"
          >
            {{ t('queue.tabLabel') }}
            <span v-if="store.activeCount" class="tab-badge">{{ store.activeCount }}</span>
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: store.sidebarView === 'settings' }"
            @click="store.setSidebarView('settings')"
          >
            {{ t('settings.tabLabel') }}
          </button>
        </div>
        <div class="sidebar-content">
          <QueueList v-if="store.sidebarView === 'queue'" />
          <SettingsPanel v-else />
        </div>
      </aside>
    </div>

    <ClipboardToast />
    <PreviewModal />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.app-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px 12px;
  flex-shrink: 0;
  overflow: hidden;
}
.app-header::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('/header-bg.gif');
  background-size: cover;
  background-position: center;
  opacity: 0.15;
  z-index: 0;
}

.app-header > * {
  position: relative;
  z-index: 1;
}
.app-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.app-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  flex: 1;
}
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
}
.theme-toggle:hover {
  color: var(--text);
  background: var(--bg);
}
.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
  border-top: 1px solid var(--border);
}
.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  overflow-y: auto;
}
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.actions {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}
.btn-primary {
  padding: 12px 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: var(--primary-contrast);
  font-weight: 600;
  font-size: 14px;
  box-shadow: var(--shadow);
  transition: background 0.15s ease;
}
.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.resolved-quality {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: -8px;
}
.analysis-status {
  font-size: 12.5px;
  margin-top: -8px;
}
.analysis-status.loading {
  color: var(--text-muted);
}
.analysis-status.error {
  color: var(--danger);
}
.analysis-status.ready {
  color: var(--success);
}
.binaries-warning {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  font-size: 13px;
}
.sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg);
  min-height: 0;
}
.sidebar-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.sidebar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 13px;
}
.sidebar-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-contrast);
  font-size: 10.5px;
  font-weight: 700;
}
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>
