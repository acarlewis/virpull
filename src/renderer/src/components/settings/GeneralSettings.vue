<script setup>
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const FILENAME_TEMPLATES = {
  default: '%(title)s.%(ext)s',
  date: '%(upload_date)s - %(title)s.%(ext)s',
  uploader: '%(uploader)s/%(title)s.%(ext)s'
};

function onFilenameTemplateChange(event) {
  store.setFilenameTemplate(event.target.value);
}

function onLanguageChange(event) {
  store.setLanguage(event.target.value);
}
</script>

<template>
  <div class="settings">
    <div class="settings-group">
      <label class="settings-key" for="settings-folder">{{ t('settings.general.downloadFolder') }}</label>
      <div class="folder-value">
        <span id="settings-folder" class="path-text" :title="store.outputDir">{{ store.outputDir }}</span>
        <button type="button" class="btn-link" @click="store.browseFolder">{{ t('settings.general.change') }}</button>
      </div>
    </div>

    <div class="settings-group">
      <label class="settings-key" for="settings-quality">{{ t('settings.general.quality') }}</label>
      <select id="settings-quality" v-model="store.quality" class="settings-select" @change="store.saveSettings">
        <option value="best">{{ t('form.quality.best') }}</option>
        <option value="2160">{{ t('form.quality.p2160') }}</option>
        <option value="1440">{{ t('form.quality.p1440') }}</option>
        <option value="1080">{{ t('form.quality.p1080') }}</option>
        <option value="720">{{ t('form.quality.p720') }}</option>
        <option value="480">{{ t('form.quality.p480') }}</option>
        <option value="360">{{ t('form.quality.p360') }}</option>
      </select>
    </div>

    <div class="settings-group">
      <label class="settings-key" for="settings-format">{{ t('settings.general.format') }}</label>
      <select id="settings-format" v-model="store.format" class="settings-select" @change="store.saveSettings">
        <option value="mp4">{{ t('form.format.mp4') }}</option>
        <option value="mkv">{{ t('form.format.mkv') }}</option>
        <option value="webm">{{ t('form.format.webm') }}</option>
        <option value="mp3">{{ t('form.format.mp3') }}</option>
      </select>
    </div>

    <div class="settings-group">
      <label class="settings-key" for="settings-filename">{{ t('settings.general.filenameTemplate') }}</label>
      <select id="settings-filename" class="settings-select" :value="store.filenameTemplate" @change="onFilenameTemplateChange">
        <option :value="FILENAME_TEMPLATES.default">{{ t('settings.general.filenameTemplateOptions.default') }}</option>
        <option :value="FILENAME_TEMPLATES.date">{{ t('settings.general.filenameTemplateOptions.date') }}</option>
        <option :value="FILENAME_TEMPLATES.uploader">{{ t('settings.general.filenameTemplateOptions.uploader') }}</option>
      </select>
    </div>

    <div class="settings-group">
      <label class="settings-key" for="settings-language">{{ t('settings.general.language') }}</label>
      <select id="settings-language" class="settings-select" :value="store.language" @change="onLanguageChange">
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="nl">Nederlands</option>
      </select>
    </div>

    <div class="settings-group settings-row">
      <label class="settings-key" for="settings-autoopen">{{ t('settings.general.autoOpen') }}</label>
      <input
        id="settings-autoopen"
        type="checkbox"
        :checked="store.autoOpenFolder"
        @change="store.autoOpenFolder = $event.target.checked; store.saveSettings()"
      />
    </div>

    <div class="settings-group settings-row">
      <label class="settings-key" for="settings-clipboard">{{ t('settings.general.clipboardDetection') }}</label>
      <input
        id="settings-clipboard"
        type="checkbox"
        :checked="store.clipboardDetectionEnabled"
        @change="store.setClipboardDetectionEnabled($event.target.checked)"
      />
    </div>

    <div class="settings-group settings-row">
      <label class="settings-key" for="settings-preview">{{ t('settings.general.previewEnabled') }}</label>
      <input
        id="settings-preview"
        type="checkbox"
        :checked="store.previewEnabled"
        @change="store.setPreviewEnabled($event.target.checked)"
      />
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
</style>
