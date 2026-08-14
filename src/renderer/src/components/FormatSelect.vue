<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const model = defineModel({ type: String, default: 'mp4' });
defineProps({ disabled: { type: Boolean, default: false } });

const options = computed(() => [
  { value: 'mp4', label: t('form.format.mp4') },
  { value: 'mkv', label: t('form.format.mkv') },
  { value: 'webm', label: t('form.format.webm') },
  { value: 'mp3', label: t('form.format.mp3') }
]);
</script>

<template>
  <div class="field">
    <label class="field-label" for="format-select">{{ t('form.format.label') }}</label>
    <select id="format-select" v-model="model" class="select-input" :disabled="disabled">
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
