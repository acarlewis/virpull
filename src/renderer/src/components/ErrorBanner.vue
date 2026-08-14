<script setup>
defineProps({ message: { type: String, default: '' } });
const emit = defineEmits(['dismiss']);
</script>

<template>
  <div v-if="message" class="error-banner">
    <span class="error-text">{{ message }}</span>
    <button type="button" class="dismiss" aria-label="Dismiss error" @click="emit('dismiss')">✕</button>
  </div>
</template>

<style scoped>
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--radius-sm);
  color: var(--danger);
}
.error-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.4;
}
.dismiss {
  background: none;
  border: none;
  color: var(--danger);
  font-size: 13px;
  line-height: 1;
  padding: 2px;
}
</style>
