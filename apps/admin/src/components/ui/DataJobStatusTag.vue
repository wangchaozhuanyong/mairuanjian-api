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
      pending: '待处理',
      running: '运行中',
      success: '成功',
      failed: '失败',
      cancelled: '已取消'
    })[props.status] ?? props.status
);

const tone = computed(() => {
  if (props.status === 'success') return 'green';
  if (props.status === 'failed') return 'red';
  if (props.status === 'running') return 'blue';
  if (props.status === 'cancelled') return 'neutral';
  return 'orange';
});
</script>
