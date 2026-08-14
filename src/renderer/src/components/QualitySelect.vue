<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const model = defineModel({ type: String, default: 'best' });
defineProps({ disabled: { type: Boolean, default: false } });

const options = computed(() => [
  { value: 'best', label: t('form.quality.best') },
  { value: '2160', label: t('form.quality.p2160') },
  { value: '1440', label: t('form.quality.p1440') },
  { value: '1080', label: t('form.quality.p1080') },
  { value: '720', label: t('form.quality.p720') },
  { value: '480', label: t('form.quality.p480') },
  { value: '360', label: t('form.quality.p360') }
]);
</script>

<template>
  <div class="field">
    <label class="field-label" for="quality-select">{{ t('form.quality.label') }}</label>
    <select id="quality-select" v-model="model" class="select-input" :disabled="disabled">
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
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
.select-input:disabled {
  opacity: 0.6;
}
</style>
