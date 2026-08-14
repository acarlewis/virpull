<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import { useQueueStore } from './stores/queue';
import UrlInput from './components/UrlInput.vue';
import FolderPicker from './components/FolderPicker.vue';
import QualitySelect from './components/QualitySelect.vue';
import FormatSelect from './components/FormatSelect.vue';
import ErrorBanner from './components/ErrorBanner.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import QueueList from './components/QueueList.vue';

const store = useQueueStore();

onMounted(() => {
  store.init();
});
onUnmounted(() => {
  store.unsubscribers.forEach((unsub) => unsub());
});

const themeLabels = { light: 'Light', dark: 'Dark' };
const themeTitle = computed(() => `Theme: ${themeLabels[store.theme]} (click to switch)`);
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <img src="/logo.png" alt="" class="app-logo" />
      <h1>VirPull</h1>
      <button
        type="button"
        class="theme-toggle"
        :title="themeTitle"
        :aria-label="themeTitle"
        @click="store.cycleTheme"
      >
        <svg
          v-if="store.theme === 'dark'"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      </button>
    </header>

    <div class="app-body">
      <main class="app-main">
        <div v-if="!store.binariesReady && store.ready" class="binaries-warning">
          <strong>Missing components:</strong>
          <span v-if="!store.binaries.ytDlp.available">yt-dlp.exe</span>
          <span v-if="!store.binaries.ytDlp.available && !store.binaries.ffmpeg.available">, </span>
          <span v-if="!store.binaries.ffmpeg.available">ffmpeg.exe</span>
          not found. See Settings for details.
        </div>

        <UrlInput v-model="store.url" />

        <FolderPicker v-model="store.outputDir" @browse="store.browseFolder" />

        <div class="row-2">
          <QualitySelect v-model="store.quality" />
          <FormatSelect v-model="store.format" />
        </div>

        <div class="actions">
          <button type="button" class="btn-primary" @click="store.addToQueue">Add to Queue</button>
        </div>

        <ErrorBanner :message="store.formError" @dismiss="store.formError = ''" />
      </main>

      <aside class="sidebar">
        <div class="sidebar-tabs">
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: store.sidebarView === 'queue' }"
            @click="store.setSidebarView('queue')"
          >
            Queue
            <span v-if="store.activeCount" class="tab-badge">{{ store.activeCount }}</span>
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: store.sidebarView === 'settings' }"
            @click="store.setSidebarView('settings')"
          >
            Settings
          </button>
        </div>
        <div class="sidebar-content">
          <QueueList v-if="store.sidebarView === 'queue'" />
          <SettingsPanel v-else />
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.app-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px 12px;
  flex-shrink: 0;
}
.app-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.app-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  flex: 1;
}
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
}
.theme-toggle:hover {
  color: var(--text);
  background: var(--bg);
}
.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
  border-top: 1px solid var(--border);
}
.app-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  overflow-y: auto;
}
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.actions {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}
.btn-primary {
  padding: 12px 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: var(--primary-contrast);
  font-weight: 600;
  font-size: 14px;
  box-shadow: var(--shadow);
  transition: background 0.15s ease;
}
.btn-primary:hover:not(:disabled) {
  background: var(--primary-hover);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.binaries-warning {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  font-size: 13px;
}
.sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg);
  min-height: 0;
}
.sidebar-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.sidebar-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 8px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 13px;
}
.sidebar-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--primary);
  color: var(--primary-contrast);
  font-size: 10.5px;
  font-weight: 700;
}
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
</style>
