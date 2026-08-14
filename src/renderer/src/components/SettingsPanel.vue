<script setup>
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';
import GeneralSettings from './settings/GeneralSettings.vue';
import AppearanceSettings from './settings/AppearanceSettings.vue';
import InfoSettings from './settings/InfoSettings.vue';

const { t } = useI18n();
const store = useQueueStore();

const SECTIONS = ['general', 'appearance', 'info'];
</script>

<template>
  <div class="settings-shell">
    <nav class="settings-nav">
      <button
        v-for="section in SECTIONS"
        :key="section"
        type="button"
        class="nav-item"
        :class="{ active: store.settingsSection === section }"
        @click="store.setSettingsSection(section)"
      >
        {{ t(`settings.nav.${section}`) }}
      </button>
    </nav>
    <div class="settings-section">
      <GeneralSettings v-if="store.settingsSection === 'general'" />
      <AppearanceSettings v-else-if="store.settingsSection === 'appearance'" />
      <InfoSettings v-else />
    </div>
  </div>
</template>

<style scoped>
.settings-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-nav {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}
.nav-item {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}
.nav-item.active {
  background: var(--bg);
  color: var(--text);
}
</style>
