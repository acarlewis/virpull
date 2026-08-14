<script setup>
import { ref } from 'vue';
import { useQueueStore } from '../stores/queue';

const store = useQueueStore();
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
  <div class="settings">
    <div class="settings-group">
      <label class="settings-key" for="settings-folder">Default download folder</label>
      <div class="folder-value">
        <span id="settings-folder" class="path-text" :title="store.outputDir">{{ store.outputDir }}</span>
        <button type="button" class="btn-link" @click="store.browseFolder">Change</button>
      </div>
    </div>

    <div class="settings-group">
      <label class="settings-key" for="settings-quality">Preferred quality</label>
      <select id="settings-quality" v-model="store.quality" class="settings-select" @change="store.saveSettings">
        <option value="best">Best available</option>
        <option value="2160">2160p (4K)</option>
        <option value="1440">1440p (2K)</option>
        <option value="1080">1080p</option>
        <option value="720">720p</option>
        <option value="480">480p</option>
        <option value="360">360p</option>
      </select>
    </div>

    <div class="settings-group">
      <label class="settings-key" for="settings-format">Preferred format</label>
      <select id="settings-format" v-model="store.format" class="settings-select" @change="store.saveSettings">
        <option value="mp4">MP4</option>
        <option value="mkv">MKV</option>
        <option value="webm">WEBM</option>
        <option value="mp3">MP3 (audio only)</option>
      </select>
    </div>

    <div class="settings-group settings-row">
      <label class="settings-key" for="settings-autoopen">Auto-open folder after download</label>
      <input id="settings-autoopen" type="checkbox" :checked="store.autoOpenFolder" @change="onToggleAutoOpen" />
    </div>

    <hr class="divider" />

    <div class="settings-group settings-row">
      <span class="settings-key">yt-dlp version</span>
      <span class="settings-value" :class="{ missing: !store.binaries.ytDlp.available }">
        {{ store.binaries.ytDlp.available ? store.binaries.ytDlp.version : 'Not found' }}
      </span>
    </div>
    <div class="settings-group settings-row">
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
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.settings-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.settings-key {
  font-size: 12px;
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
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.path-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 12.5px;
  padding: 0;
  white-space: nowrap;
  flex-shrink: 0;
}
.settings-select {
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  width: 100%;
}
.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
}
.update-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
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
