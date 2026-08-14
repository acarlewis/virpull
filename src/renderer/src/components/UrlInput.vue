<script setup>
const model = defineModel({ type: String, default: '' });
defineProps({ disabled: { type: Boolean, default: false } });

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) model.value = text.trim();
  } catch {
    // Clipboard access can be denied by the OS; ignore silently.
  }
}
</script>

<template>
  <div class="field">
    <label class="field-label" for="url-input">URL</label>
    <div class="row">
      <input
        id="url-input"
        v-model="model"
        type="text"
        class="text-input"
        placeholder="Paste video or M3U8 URL"
        :disabled="disabled"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="button" class="btn-secondary" :disabled="disabled" @click="pasteFromClipboard">
        Paste
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
  transition: border-color 0.15s ease;
}
.text-input:focus {
  border-color: var(--primary);
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
