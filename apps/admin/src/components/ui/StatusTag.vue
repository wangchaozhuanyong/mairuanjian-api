<template>
  <StatusChip :tone="status === 'active' ? 'green' : 'neutral'" dot>
    {{ status === 'active' ? activeText : disabledText }}
  </StatusChip>
</template>

<script setup lang="ts">
import StatusChip from '@/components/ui/StatusChip.vue';

withDefaults(
  defineProps<{
    status: 'active' | 'disabled';
    activeText?: string;
    disabledText?: string;
  }>(),
  {
    activeText: '启用',
    disabledText: '停用'
  }
);
</script>
