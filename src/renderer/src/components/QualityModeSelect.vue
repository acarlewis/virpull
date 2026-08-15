<script setup>
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const MODES = ['recommended', 'best', 'balanced', 'smallest', 'custom'];

function onChange(event) {
  store.setQualityMode(event.target.value);
}
</script>

<template>
  <div class="field">
    <label class="field-label" for="quality-mode-select">{{ t('qualityMode.label') }}</label>
    <select id="quality-mode-select" class="select-input" :value="store.qualityMode" @change="onChange">
      <option v-for="mode in MODES" :key="mode" :value="mode">
        {{ t(`qualityMode.modes.${mode}`) }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.select-input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
}
</style>
