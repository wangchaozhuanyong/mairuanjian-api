<template>
  <StatusChip :tone="tone" dot>
    {{ label }}
  </StatusChip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatusChip from '@/components/ui/StatusChip.vue';

const props = defineProps<{
  status: string;
}>();

const label = computed(
  () =>
    ({
      normal: '正常',
      warning: '警告',
      error: '异常',
      critical: '严重',
      unknown: '未知',
      running: '运行中',
      success: '成功',
      failed: '失败',
      skipped: '跳过'
    })[props.status] ?? props.status
);

const tone = computed(() => {
  if (props.status === 'normal' || props.status === 'success') return 'green';
  if (props.status === 'running') return 'blue';
  if (props.status === 'warning' || props.status === 'unknown') return 'orange';
  if (props.status === 'error' || props.status === 'critical' || props.status === 'failed') {
    return 'red';
  }
  return 'neutral';
});
</script>
