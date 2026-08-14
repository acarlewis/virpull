<script setup>
const model = defineModel({ type: String, default: 'best' });
defineProps({ disabled: { type: Boolean, default: false } });

const options = [
  { value: 'best', label: 'Best available' },
  { value: '2160', label: '2160p (4K)' },
  { value: '1440', label: '1440p (2K)' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' }
];
</script>

<template>
  <div class="field">
    <label class="field-label" for="quality-select">Quality</label>
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
