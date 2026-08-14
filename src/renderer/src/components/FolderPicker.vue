<script setup>
const model = defineModel({ type: String, default: '' });
defineProps({ disabled: { type: Boolean, default: false } });
const emit = defineEmits(['browse']);
</script>

<template>
  <div class="field">
    <label class="field-label" for="folder-input">Save to</label>
    <div class="row">
      <input
        id="folder-input"
        :value="model"
        type="text"
        class="text-input"
        readonly
        :disabled="disabled"
        placeholder="Choose a download folder"
      />
      <button type="button" class="btn-secondary" :disabled="disabled" @click="emit('browse')">
        Browse
      </button>
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
.text-input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  outline: none;
  color: var(--text);
}
.text-input:disabled {
  opacity: 0.6;
}
.btn-secondary {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-weight: 500;
  white-space: nowrap;
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg);
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
