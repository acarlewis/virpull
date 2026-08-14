<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../../stores/queue';
import { translateIpcError } from '../../i18n';

const { t } = useI18n();
const store = useQueueStore();

const appVersion = ref(null);
const updatingYtDlp = ref(false);
const ytDlpUpdateError = ref('');
const ytDlpUpdateSuccess = ref(false);

const checkingUpdate = ref(false);
const updateError = ref('');
const updateResult = ref(null); // { hasUpdate, latestVersion, url }

const SUPPORT_URL = 'https://github.com/acarlewis/virpull';

onMounted(async () => {
  appVersion.value = await window.api.getAppVersion();
});

async function onUpdateYtDlp() {
  updatingYtDlp.value = true;
  ytDlpUpdateError.value = '';
  ytDlpUpdateSuccess.value = false;
  try {
    await store.updateYtDlp();
    ytDlpUpdateSuccess.value = true;
  } catch (err) {
    ytDlpUpdateError.value = translateIpcError(err, 'errors.ytDlpUpdateFailed');
  } finally {
    updatingYtDlp.value = false;
  }
}

async function onCheckForUpdate() {
  checkingUpdate.value = true;
  updateError.value = '';
  updateResult.value = null;
  try {
    updateResult.value = await store.checkForUpdate();
  } catch (err) {
    updateError.value = translateIpcError(err, 'errors.network');
  } finally {
    checkingUpdate.value = false;
  }
}

function openSupport() {
  store.openExternal(SUPPORT_URL);
}

function openRelease() {
  if (updateResult.value?.url) store.openExternal(updateResult.value.url);
}
</script>

<template>
  <div class="info">
    <div class="settings-group settings-row">
      <span class="settings-key">{{ t('settings.info.version') }}</span>
      <span class="settings-value">{{ appVersion || '…' }}</span>
    </div>
    <div class="settings-group settings-row">
      <span class="settings-key">{{ t('settings.info.ytDlpVersion') }}</span>
      <span class="settings-value" :class="{ missing: !store.binaries.ytDlp.available }">
        {{ store.binaries.ytDlp.available ? store.binaries.ytDlp.version : t('settings.info.notFound') }}
      </span>
    </div>
    <div class="settings-group settings-row">
      <span class="settings-key">{{ t('settings.info.ffmpegVersion') }}</span>
      <span class="settings-value" :class="{ missing: !store.binaries.ffmpeg.available }">
        {{ store.binaries.ffmpeg.available ? store.binaries.ffmpeg.version : t('settings.info.notFound') }}
      </span>
    </div>

    <div class="action-row">
      <button type="button" class="btn-secondary" :disabled="updatingYtDlp || !store.binaries.ytDlp.available" @click="onUpdateYtDlp">
        {{ updatingYtDlp ? t('settings.info.updating') : t('settings.info.updateYtDlp') }}
      </button>
      <span v-if="ytDlpUpdateSuccess" class="msg-success">{{ t('settings.info.updateSuccess') }}</span>
      <span v-if="ytDlpUpdateError" class="msg-error">{{ ytDlpUpdateError }}</span>
    </div>

    <hr class="divider" />

    <div class="action-row">
      <button type="button" class="btn-secondary" :disabled="checkingUpdate" @click="onCheckForUpdate">
        {{ checkingUpdate ? t('settings.info.checking') : t('settings.info.checkForUpdate') }}
      </button>
      <template v-if="updateResult">
        <span v-if="updateResult.hasUpdate" class="msg-update">
          {{ t('settings.info.updateAvailable', { version: updateResult.latestVersion }) }}
          <button type="button" class="btn-link" @click="openRelease">{{ t('settings.info.viewRelease') }}</button>
        </span>
        <span v-else class="msg-success">{{ t('settings.info.upToDate') }}</span>
      </template>
      <span v-if="updateError" class="msg-error">{{ updateError }}</span>
    </div>

    <div class="action-row">
      <button type="button" class="btn-secondary" @click="openSupport">{{ t('settings.info.support') }}</button>
    </div>

    <hr class="divider" />

    <div class="disclaimer">
      <div class="disclaimer-heading">{{ t('settings.info.disclaimerHeading') }}</div>
      <p class="disclaimer-text">{{ t('settings.info.disclaimer') }}</p>
    </div>
  </div>
</template>

<style scoped>
.info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.settings-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.settings-key {
  font-size: 12px;
  color: var(--text-muted);
}
.settings-value {
  font-size: 13px;
}
.settings-value.missing {
  color: var(--danger);
}
.action-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.btn-secondary {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  font-weight: 500;
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-link {
  background: none;
  border: none;
  color: var(--primary);
  font-weight: 600;
  font-size: 12px;
  padding: 0;
  margin-left: 6px;
}
.msg-success {
  font-size: 12px;
  color: var(--success);
}
.msg-error {
  font-size: 12px;
  color: var(--danger);
}
.msg-update {
  font-size: 12px;
  color: var(--text);
}
.divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0;
}
.disclaimer {
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--bg);
  border: 1px solid var(--border);
}
.disclaimer-heading {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.disclaimer-text {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
