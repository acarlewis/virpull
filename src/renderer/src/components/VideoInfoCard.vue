<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';
import { formatDuration } from '../utils/format';

const { t, locale } = useI18n();
const store = useQueueStore();

const data = computed(() => store.analysis.data);
const thumbError = ref(false);
// A new analysis result means a new (or absent) thumbnail URL — don't carry
// the "broken image" state over from whatever was analyzed previously.
watch(data, () => {
  thumbError.value = false;
});

const durationText = computed(() => (data.value?.duration != null ? formatDuration(data.value.duration) : null));

const uploadDateText = computed(() => {
  const iso = data.value?.uploadDate;
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
});
</script>

<template>
  <div v-if="store.analysis.status === 'ready' && data" class="info-card">
    <div class="thumb-wrap">
      <img v-if="data.thumbnail && !thumbError" :src="data.thumbnail" alt="" class="thumb" @error="thumbError = true" />
      <div v-else class="thumb-placeholder">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="m21 15-5-5-9 9" />
        </svg>
      </div>
      <button
        v-if="store.previewEnabled"
        type="button"
        class="preview-btn"
        :title="t('preview.button')"
        @click="store.openPreview"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </button>
    </div>
    <div class="info-body">
      <div class="info-title" :title="data.title || ''">{{ data.title || t('analysis.untitled') }}</div>
      <div class="info-meta">
        <span v-if="data.platform">{{ data.platform }}</span>
        <span v-if="data.platform && durationText"> • </span>
        <span v-if="durationText">{{ durationText }}</span>
      </div>
      <div v-if="data.uploader" class="info-row">
        <span class="info-icon" aria-hidden="true">👤</span>{{ data.uploader }}
      </div>
      <div v-if="uploadDateText" class="info-row">
        <span class="info-icon" aria-hidden="true">📅</span>{{ uploadDateText }}
      </div>
      <div v-if="data.hasSeparateAudioVideo" class="info-note">{{ t('analysis.mergeNote') }}</div>
    </div>
  </div>
</template>

<style scoped>
.info-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  flex-wrap: wrap;
}
.thumb-wrap {
  position: relative;
  width: 120px;
  height: 68px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg);
}
.preview-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.thumb-wrap:hover .preview-btn,
.preview-btn:focus-visible {
  opacity: 1;
}
.preview-btn svg {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}
.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}
.info-body {
  flex: 1;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-title {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.info-meta {
  font-size: 12px;
  color: var(--text-muted);
}
.info-row {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 5px;
}
.info-icon {
  font-size: 11px;
}
.info-note {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}
</style>
