<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import { useDownloadStore } from './stores/download';
import UrlInput from './components/UrlInput.vue';
import FolderPicker from './components/FolderPicker.vue';
import QualitySelect from './components/QualitySelect.vue';
import FormatSelect from './components/FormatSelect.vue';
import ProgressPanel from './components/ProgressPanel.vue';
import ErrorBanner from './components/ErrorBanner.vue';
import SettingsPanel from './components/SettingsPanel.vue';

const store = useDownloadStore();

onMounted(() => {
  store.init();
});
onUnmounted(() => {
  store.unsubscribers.forEach((unsub) => unsub());
});

const isDownloading = computed(() => store.isDownloading);
const isFinished = computed(() => store.status === 'finished');
const canStart = computed(() => !isDownloading.value);

function handleDownloadClick() {
  if (isDownloading.value) return;
  store.startDownload();
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>Video Downloader</h1>
    </header>

    <main class="app-main">
      <div v-if="!store.binariesReady && store.ready" class="binaries-warning">
        <strong>Missing components:</strong>
        <span v-if="!store.binaries.ytDlp.available">yt-dlp.exe</span>
        <span v-if="!store.binaries.ytDlp.available && !store.binaries.ffmpeg.available">, </span>
        <span v-if="!store.binaries.ffmpeg.available">ffmpeg.exe</span>
        not found. See Settings for details.
      </div>

      <UrlInput v-model="store.url" :disabled="isDownloading" />

      <FolderPicker v-model="store.outputDir" :disabled="isDownloading" @browse="store.browseFolder" />

      <div class="row-2">
        <QualitySelect v-model="store.quality" :disabled="isDownloading" />
        <FormatSelect v-model="store.format" :disabled="isDownloading" />
      </div>

      <div class="actions">
        <button
          v-if="!isDownloading"
          type="button"
          class="btn-primary"
          :disabled="!canStart"
          @click="handleDownloadClick"
        >
          Download
        </button>
        <button v-else type="button" class="btn-danger" @click="store.cancelDownload">Cancel</button>
      </div>

      <ProgressPanel
        :status="store.status"
        :status-label="store.statusLabel"
        :percent="store.percent"
        :downloaded-bytes="store.downloadedBytes"
        :total-bytes="store.totalBytes"
        :speed-bytes-per-sec="store.speedBytesPerSec"
        :eta-seconds="store.etaSeconds"
      />

      <div v-if="isFinished" class="finished-row">
        <span class="finished-text">Saved to {{ store.lastOutputDir }}</span>
        <button type="button" class="btn-link" @click="store.openDownloadFolder">Open folder</button>
      </div>

      <ErrorBanner :message="store.errorMessage" @dismiss="store.errorMessage = ''" />

      <SettingsPanel />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.app-header {
  padding: 20px 24px 4px;
}
.app-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px 24px;
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
.btn-danger {
  padding: 12px 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--danger);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  box-shadow: var(--shadow);
}
.btn-danger:hover {
  filter: brightness(0.95);
}
.binaries-warning {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  font-size: 13px;
}
.finished-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: #eefaf3;
  border: 1px solid #cdeedd;
  font-size: 13px;
}
.finished-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--success);
}
.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
}
</style>
