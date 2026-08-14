<script setup>
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const THEMES = [
  { value: 'light', swatch: ['#f5f6fa', '#4f6bff'] },
  { value: 'dark', swatch: ['#1c1e26', '#6d87ff'] },
  { value: 'midnight', swatch: ['#0b0f1a', '#5b7cfa'] },
  { value: 'cyberpunk', swatch: ['#0a0612', '#ff2ea6'] },
  { value: 'ocean', swatch: ['#eaf6f6', '#0a9396'] },
  { value: 'forest', swatch: ['#f3f6ee', '#4c7a3f'] }
];
</script>

<template>
  <div class="appearance">
    <div class="settings-key">{{ t('settings.appearance.heading') }}</div>
    <div class="theme-grid">
      <button
        v-for="theme in THEMES"
        :key="theme.value"
        type="button"
        class="theme-swatch"
        :class="{ active: store.theme === theme.value }"
        @click="store.setTheme(theme.value)"
      >
        <span class="swatch-preview" :style="{ background: theme.swatch[0] }">
          <span class="swatch-accent" :style="{ background: theme.swatch[1] }" />
        </span>
        <span class="swatch-label">{{ t(`settings.appearance.themes.${theme.value}`) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.appearance {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.settings-key {
  font-size: 12px;
  color: var(--text-muted);
}
.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.theme-swatch {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 8px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}
.theme-swatch.active {
  border-color: var(--primary);
}
.swatch-preview {
  width: 100%;
  height: 36px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  display: flex;
  align-items: flex-end;
  padding: 5px;
}
.swatch-accent {
  width: 16px;
  height: 8px;
  border-radius: 4px;
}
.swatch-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
</style>
