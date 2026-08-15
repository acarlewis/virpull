<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const PRESETS = ['', '10M', '5M', '2M', '1M', '500K'];
const isCustom = computed(() => store.downloadSpeedLimit !== null && !PRESETS.includes(store.downloadSpeedLimit));

const customValue = ref(isCustom.value ? store.downloadSpeedLimit.replace(/[KMG]$/i, '') : '');
const customUnit = ref(isCustom.value ? store.downloadSpeedLimit.slice(-1).toUpperCase() : 'M');

function onSelectChange(event) {
  const value = event.target.value;
  if (value === 'custom') {
    applyCustom();
    return;
  }
  store.setDownloadSpeedLimit(value === '' ? null : value);
}

function applyCustom() {
  const num = Number(customValue.value);
  if (Number.isFinite(num) && num > 0) {
    store.setDownloadSpeedLimit(`${customValue.value}${customUnit.value}`);
  }
}

watch([customValue, customUnit], () => {
  if (isCustom.value) applyCustom();
});

const selectValue = computed(() => (isCustom.value ? 'custom' : store.downloadSpeedLimit || ''));
</script>

<template>
  <div class="field">
    <label class="field-label" for="speed-select">{{ t('speed.label') }}</label>
    <div class="row">
      <select id="speed-select" class="select-input" :value="selectValue" @change="onSelectChange">
        <option value="">{{ t('speed.unlimited') }}</option>
        <option value="10M">10 MB/s</option>
        <option value="5M">5 MB/s</option>
        <option value="2M">2 MB/s</option>
        <option value="1M">1 MB/s</option>
        <option value="500K">500 KB/s</option>
        <option value="custom">{{ t('speed.custom') }}</option>
      </select>
      <template v-if="isCustom">
        <input
          v-model="customValue"
          type="number"
          min="1"
          step="1"
          class="custom-input"
          :placeholder="t('speed.customPlaceholder')"
        />
        <select v-model="customUnit" class="unit-select">
          <option value="K">KB/s</option>
          <option value="M">MB/s</option>
        </select>
      </template>
    </div>
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
.row {
  display: flex;
  gap: 8px;
}
.select-input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
}
.custom-input {
  width: 70px;
  padding: 10px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
}
.unit-select {
  padding: 10px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
}
</style>
