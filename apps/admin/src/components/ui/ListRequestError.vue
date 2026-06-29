<template>
  <AppState
    class="list-request-error"
    type="error"
    :title="title"
    :description="message"
    :compact="compact"
    :primary-label="retryLabel"
    @primary="$emit('retry')"
  />
</template>

<script setup lang="ts">
import AppState from '@/components/ui/AppState.vue';

withDefaults(
  defineProps<{
    title?: string;
    message: string;
    compact?: boolean;
    retryLabel?: string;
  }>(),
  {
    title: '数据加载失败',
    compact: true,
    retryLabel: '重试'
  }
);

defineEmits<{
  retry: [];
}>();
</script>
