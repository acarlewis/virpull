<script setup>
import { ref } from 'vue';
import { useDownloadStore } from '../stores/download';

const store = useDownloadStore();
const updating = ref(false);
const updateError = ref('');
const updateSuccess = ref(false);

async function onToggleAutoOpen(event) {
  store.autoOpenFolder = event.target.checked;
  await store.saveSettings();
}

async function onUpdateYtDlp() {
  updating.value = true;
  updateError.value = '';
  updateSuccess.value = false;
  try {
    await store.updateYtDlp();
    updateSuccess.value = true;
  } catch (err) {
    updateError.value = err?.message || 'Could not update yt-dlp.';
  } finally {
    updating.value = false;
  }
}
</script>

<template>
  <details class="settings">
    <summary>Settings</summary>
    <div class="settings-body">
      <div class="settings-row">
        <span class="settings-key">Default download folder</span>
        <div class="settings-value folder-value">
          <span class="path-text" :title="store.outputDir">{{ store.outputDir }}</span>
          <button type="button" class="btn-link" @click="store.browseFolder">Change</button>
        </div>
      </div>

      <div class="settings-row">
        <span class="settings-key">Preferred quality</span>
        <select v-model="store.quality" class="settings-select" @change="store.saveSettings">
          <option value="best">Best available</option>
          <option value="2160">2160p (4K)</option>
          <option value="1440">1440p (2K)</option>
          <option value="1080">1080p</option>
          <option value="720">720p</option>
          <option value="480">480p</option>
          <option value="360">360p</option>
        </select>
      </div>

      <div class="settings-row">
        <span class="settings-key">Preferred format</span>
        <select v-model="store.format" class="settings-select" @change="store.saveSettings">
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
          <option value="webm">WEBM</option>
          <option value="mp3">MP3 (audio only)</option>
        </select>
      </div>

      <div class="settings-row">
        <span class="settings-key">Auto-open folder after download</span>
        <input type="checkbox" :checked="store.autoOpenFolder" @change="onToggleAutoOpen" />
      </div>

      <hr class="divider" />

      <div class="settings-row">
        <span class="settings-key">yt-dlp version</span>
        <span class="settings-value" :class="{ missing: !store.binaries.ytDlp.available }">
          {{ store.binaries.ytDlp.available ? store.binaries.ytDlp.version : 'Not found' }}
        </span>
      </div>
      <div class="settings-row">
        <span class="settings-key">FFmpeg version</span>
        <span class="settings-value" :class="{ missing: !store.binaries.ffmpeg.available }">
          {{ store.binaries.ffmpeg.available ? store.binaries.ffmpeg.version : 'Not found' }}
        </span>
      </div>

      <div class="update-row">
        <button
          type="button"
          class="btn-secondary"
          :disabled="updating || !store.binaries.ytDlp.available"
          @click="onUpdateYtDlp"
        >
          {{ updating ? 'Updating…' : 'Update yt-dlp' }}
        </button>
        <span v-if="updateSuccess" class="update-success">Updated successfully.</span>
        <span v-if="updateError" class="update-error">{{ updateError }}</span>
      </div>
    </div>
  </details>
</template>

<style scoped>
.settings {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 4px 14px;
}
summary {
  padding: 10px 0;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 6px;
  transition: transform 0.15s ease;
}
details[open] summary::before {
  transform: rotate(90deg);
}
.settings-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 14px;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.settings-key {
  font-size: 13px;
  color: var(--text-muted);
}
.settings-value {
  font-size: 13px;
}
.settings-value.missing {
  color: var(--danger);
}
.folder-value {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.path-text {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  padding: 0;
  white-space: nowrap;
}
.settings-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
}
.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
}
.update-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.btn-secondary {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-weight: 500;
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.update-success {
  font-size: 12px;
  color: var(--success);
}
.update-error {
  font-size: 12px;
  color: var(--danger);
}
</style>
