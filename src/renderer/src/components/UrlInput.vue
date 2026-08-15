<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const model = defineModel({ type: String, default: '' });
const props = defineProps({
  disabled: { type: Boolean, default: false },
  analyzing: { type: Boolean, default: false }
});
const emit = defineEmits(['analyze']);

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
    <label class="field-label" for="url-input">{{ t('form.url.label') }}</label>
    <div class="row">
      <input
        id="url-input"
        v-model="model"
        type="text"
        class="text-input"
        :placeholder="t('form.url.placeholder')"
        :disabled="disabled"
        autocomplete="off"
        spellcheck="false"
        @keydown.enter="!props.analyzing && !props.disabled && model.trim() && emit('analyze')"
      />
      <button type="button" class="btn-secondary" :disabled="disabled" @click="pasteFromClipboard">
        {{ t('form.url.paste') }}
      </button>
      <button
        type="button"
        class="btn-primary-outline"
        :disabled="disabled || analyzing || !model.trim()"
        @click="emit('analyze')"
      >
        {{ analyzing ? t('analysis.analyzeButtonBusy') : t('analysis.analyzeButton') }}
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
.btn-primary-outline {
  padding: 10px 14px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
}
.btn-primary-outline:hover:not(:disabled) {
  background: var(--primary);
  color: var(--primary-contrast);
}
.btn-primary-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
