<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';

const { t } = useI18n();
const store = useQueueStore();

const videoEl = ref(null);
const failed = ref(false);
let hls = null;

const preview = computed(() => store.analysis.data?.preview ?? null);
const title = computed(() => store.analysis.data?.title || t('analysis.untitled'));

function teardownHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
}

// Preview is intentionally isolated from the downloader: any failure here
// only ever affects this modal's own state, never the queue/download flow.
async function setup() {
  failed.value = false;
  teardownHls();
  const p = preview.value;
  if (!p || p.kind === 'youtube-embed') return;
  await nextTick();
  const el = videoEl.value;
  if (!el) return;

  if (p.kind === 'direct') {
    el.src = p.url;
    return;
  }

  if (p.kind === 'hls') {
    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = p.url;
      return;
    }
    const { default: Hls } = await import('hls.js');
    if (!Hls.isSupported()) {
      failed.value = true;
      return;
    }
    hls = new Hls();
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) failed.value = true;
    });
    hls.loadSource(p.url);
    hls.attachMedia(el);
  }
}

watch(() => store.previewOpen, (open) => {
  if (open) setup();
  else teardownHls();
});

onBeforeUnmount(teardownHls);
</script>

<template>
  <div v-if="store.previewOpen" class="preview-overlay" @click.self="store.closePreview">
    <div class="preview-panel">
      <div class="preview-header">
        <span class="preview-title">{{ title }}</span>
        <button type="button" class="preview-close" :aria-label="t('preview.close')" @click="store.closePreview">✕</button>
      </div>

      <div class="preview-body">
        <iframe
          v-if="preview?.kind === 'youtube-embed'"
          :src="`https://www.youtube-nocookie.com/embed/${preview.videoId}?autoplay=1`"
          allow="autoplay; encrypted-media"
          allowfullscreen
          frameborder="0"
        ></iframe>

        <video
          v-else-if="preview && !failed"
          ref="videoEl"
          controls
          autoplay
          @error="failed = true"
        ></video>

        <div v-else class="preview-unavailable">{{ t('preview.unavailable') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.preview-panel {
  width: min(720px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.preview-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 600;
}
.preview-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 15px;
  padding: 4px;
  flex-shrink: 0;
}
.preview-body {
  aspect-ratio: 16 / 9;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-body iframe,
.preview-body video {
  width: 100%;
  height: 100%;
}
.preview-unavailable {
  color: var(--text-muted);
  font-size: 13.5px;
  padding: 20px;
  text-align: center;
}
</style>
