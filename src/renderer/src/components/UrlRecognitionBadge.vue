<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const recognition = computed(() => store.urlRecognition);

const badge = computed(() => {
  const r = recognition.value;
  if (!r) return null;
  if (!r.supported) {
    return { icon: '⚠', tone: 'warn', title: t('recognition.unsupported.title'), subtitle: t('recognition.unsupported.subtitle') };
  }
  if (r.type === 'hls') {
    return { icon: '🔵', tone: 'info', title: t('recognition.hls.title'), subtitle: t('recognition.hls.subtitle') };
  }
  if (r.platform === 'YouTube') {
    return { icon: '🔴', tone: 'info', title: t('recognition.youtube.title'), subtitle: t('recognition.youtube.subtitle') };
  }
  if (r.platform) {
    return { icon: '🟣', tone: 'info', title: r.platform, subtitle: t('recognition.supported.subtitle') };
  }
  return null;
});
</script>

<template>
  <div v-if="badge" class="badge" :class="badge.tone">
    <span class="badge-icon" aria-hidden="true">{{ badge.icon }}</span>
    <span class="badge-text">
      <strong>{{ badge.title }}</strong>
      <span class="badge-subtitle">{{ badge.subtitle }}</span>
    </span>
  </div>
</template>

<style scoped>
.badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  margin-top: -8px;
}
.badge.info {
  color: var(--text-muted);
}
.badge.warn {
  color: var(--danger);
}
.badge-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.badge-subtitle {
  font-size: 11px;
  opacity: 0.85;
}
</style>
