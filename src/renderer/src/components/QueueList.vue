<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQueueStore } from '../stores/queue';
import QueueItemRow from './QueueItemRow.vue';

const { t } = useI18n();
const store = useQueueStore();

const items = computed(() => [...store.queue].sort((a, b) => b.createdAt - a.createdAt));
</script>

<template>
  <div class="queue-list">
    <div v-if="items.length === 0" class="empty-state">
      <p>{{ t('queue.empty.title') }}</p>
      <p class="empty-hint">{{ t('queue.empty.hint') }}</p>
    </div>
    <QueueItemRow
      v-for="item in items"
      :key="item.id"
      :item="item"
      @cancel="store.cancelItem(item.id)"
      @remove="store.removeItem(item.id)"
      @open-folder="store.openItemFolder(item)"
    />
  </div>
</template>

<style scoped>
.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-state {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-muted);
}
.empty-state p {
  margin: 0 0 4px;
  font-size: 13px;
}
.empty-hint {
  font-size: 12px;
}
</style>
