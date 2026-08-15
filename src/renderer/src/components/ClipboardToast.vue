<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const shortUrl = computed(() => {
  const url = store.clipboardSuggestion || '';
  return url.length > 60 ? `${url.slice(0, 57)}…` : url;
});
</script>

<template>
  <Transition name="toast">
    <div v-if="store.clipboardSuggestion" class="clipboard-toast" role="status">
      <span class="icon">📋</span>
      <div class="body">
        <div class="title">{{ t('clipboard.detected') }}</div>
        <div class="url" :title="store.clipboardSuggestion">{{ shortUrl }}</div>
      </div>
      <div class="actions">
        <button type="button" class="btn-use" @click="store.acceptClipboardSuggestion">{{ t('clipboard.use') }}</button>
        <button type="button" class="btn-dismiss" :aria-label="t('clipboard.dismiss')" @click="store.dismissClipboardSuggestion">✕</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.clipboard-toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 360px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.icon {
  font-size: 18px;
  flex-shrink: 0;
}
.body {
  min-width: 0;
  flex: 1;
}
.title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}
.url {
  font-size: 11.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.btn-use {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: var(--primary);
  color: var(--primary-contrast);
  font-size: 12px;
  font-weight: 600;
}
.btn-dismiss {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 13px;
  padding: 4px;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
