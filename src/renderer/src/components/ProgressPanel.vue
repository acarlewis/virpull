<script setup>
import { computed } from 'vue';
import { formatBytes, formatSpeed, formatEta, formatPercent } from '../utils/format';

const props = defineProps({
  status: { type: String, default: 'idle' },
  statusLabel: { type: String, default: '' },
  percent: { type: Number, default: 0 },
  downloadedBytes: { type: Number, default: null },
  totalBytes: { type: Number, default: null },
  speedBytesPerSec: { type: Number, default: null },
  etaSeconds: { type: Number, default: null }
});

const displayPercent = computed(() => formatPercent(props.percent));
const speedText = computed(() => formatSpeed(props.speedBytesPerSec));
const etaText = computed(() => formatEta(props.etaSeconds));
const sizeText = computed(() => {
  const downloaded = formatBytes(props.downloadedBytes);
  const total = formatBytes(props.totalBytes);
  if (downloaded && total) return `${downloaded} / ${total}`;
  return downloaded || '';
});

const indeterminate = computed(() =>
  ['starting', 'fetching-info', 'merging', 'extracting-audio', 'processing'].includes(props.status)
);
</script>

<template>
  <div class="progress-panel">
    <div class="progress-label">Progress</div>
    <div class="track" :class="{ indeterminate }">
      <div
        v-if="!indeterminate"
        class="fill"
        :style="{ width: displayPercent + '%' }"
      />
      <div v-else class="fill-indeterminate" />
    </div>
    <div class="stats">
      <span v-if="!indeterminate">{{ displayPercent }}%</span>
      <span v-if="speedText">• {{ speedText }}</span>
      <span v-if="etaText">• {{ etaText }} remaining</span>
      <span v-if="sizeText">• {{ sizeText }}</span>
    </div>
    <div class="status-line">Status: {{ statusLabel || 'Idle' }}</div>
  </div>
</template>

<style scoped>
.progress-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.progress-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--track);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #7d95ff);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.fill-indeterminate {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, var(--primary), #7d95ff);
  border-radius: 999px;
  animation: slide 1.2s ease-in-out infinite;
}
@keyframes slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}
.stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--text-muted);
}
.status-line {
  font-size: 13px;
  color: var(--text);
}
</style>
