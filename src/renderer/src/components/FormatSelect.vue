<script setup>
const model = defineModel({ type: String, default: 'mp4' });
defineProps({ disabled: { type: Boolean, default: false } });

const options = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mkv', label: 'MKV' },
  { value: 'webm', label: 'WEBM' },
  { value: 'mp3', label: 'MP3 (audio only)' }
];
</script>

<template>
  <div class="field">
    <label class="field-label" for="format-select">Format</label>
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
