<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatSpeed, formatEta, formatPercent, isActiveStatus, isIndeterminateStatus } from '../utils/format';
import { translateMessage } from '../i18n';

const { t } = useI18n();

const props = defineProps({
  item: { type: Object, required: true }
});
const emit = defineEmits(['cancel', 'remove', 'open-folder']);

const isTerminal = computed(() => ['finished', 'error', 'cancelled'].includes(props.item.status));
const isActive = computed(() => isActiveStatus(props.item.status));
const isQueued = computed(() => props.item.status === 'queued');
const indeterminate = computed(() => isIndeterminateStatus(props.item.status));
const displayPercent = computed(() => formatPercent(props.item.percent));
const speedText = computed(() => formatSpeed(props.item.speedBytesPerSec));
const etaText = computed(() => formatEta(props.item.etaSeconds));
const statusText = computed(() => t(`status.${props.item.status}`));
const errorText = computed(() => translateMessage(props.item.errorMessage));

const fileName = computed(() => {
  if (!props.item.filePath) return null;
  const parts = props.item.filePath.split(/[\\/]/);
  return parts[parts.length - 1];
});
</script>

<template>
  <div class="queue-item" :class="item.status">
    <div class="queue-item-main">
      <div class="queue-item-title" :title="item.url">{{ fileName || item.url }}</div>
      <div class="queue-item-meta">
        <span class="badge">{{ item.format.toUpperCase() }}</span>
        <span class="badge">{{ item.quality === 'best' ? t('form.quality.best') : item.quality + 'p' }}</span>
        <span class="status-text" :class="item.status">{{ statusText }}</span>
      </div>

      <div v-if="isActive" class="mini-track" :class="{ indeterminate }">
        <div v-if="!indeterminate" class="mini-fill" :style="{ width: displayPercent + '%' }" />
        <div v-else class="mini-fill-indeterminate" />
      </div>
      <div v-if="isActive && (speedText || etaText)" class="queue-item-stats">
        <span v-if="!indeterminate">{{ displayPercent }}%</span>
        <span v-if="speedText">{{ speedText }}</span>
        <span v-if="etaText">{{ etaText }} {{ t('queue.left') }}</span>
      </div>

      <div v-if="item.status === 'error' && item.errorMessage" class="queue-item-error">
        {{ errorText }}
      </div>
    </div>

    <div class="queue-item-actions">
      <button
        v-if="item.status === 'finished'"
        type="button"
        class="icon-btn"
        :title="t('queue.openFolder')"
        @click="emit('open-folder')"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
      </button>
      <button
        v-if="isActive || isQueued"
        type="button"
        class="icon-btn"
        :title="t('queue.cancel')"
        @click="emit('cancel')"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
      <button
        v-if="isTerminal"
        type="button"
        class="icon-btn"
        :title="t('queue.remove')"
        @click="emit('remove')"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.queue-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
}
.queue-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.queue-item-title {
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue-item-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--track);
  color: var(--text-muted);
}
.status-text {
  font-size: 11.5px;
  color: var(--text-muted);
}
.status-text.error {
  color: var(--danger);
}
.status-text.finished {
  color: var(--success);
}
.mini-track {
  position: relative;
  height: 5px;
  border-radius: 999px;
  background: var(--track);
  overflow: hidden;
}
.mini-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  border-radius: 999px;
  transition: width 0.2s ease;
}
.mini-fill-indeterminate {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, var(--primary), var(--primary-hover));
  border-radius: 999px;
  animation: mini-slide 1.2s ease-in-out infinite;
}
@keyframes mini-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}
.queue-item-stats {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.queue-item-error {
  font-size: 11.5px;
  color: var(--danger);
  line-height: 1.35;
}
.queue-item-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
}
.icon-btn:hover {
  color: var(--text);
  background: var(--bg);
}
</style>
