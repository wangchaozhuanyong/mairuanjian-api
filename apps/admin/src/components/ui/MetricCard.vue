<template>
  <div class="metric-card">
    <div class="metric-card__label">
      <span>{{ label }}</span>
      <StatusChip v-if="tag" :tone="effectiveTagTone">{{ tag }}</StatusChip>
    </div>
    <strong class="metric-card__value">{{ value }}</strong>
    <p class="metric-card__trend">{{ hint }}</p>
    <div v-if="$slots.sparkline" class="metric-card__spark">
      <slot name="sparkline" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import StatusChip from '@/components/ui/StatusChip.vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    hint: string;
    tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
    tag?: string;
    tagType?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
    tagTone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
  }>(),
  {
    tone: 'blue',
    tag: '',
    tagType: 'info',
    tagTone: undefined
  }
);

const tagTypeToneMap = {
  success: 'green',
  warning: 'orange',
  danger: 'red',
  info: 'blue',
  primary: 'blue'
} as const;

const effectiveTagTone = computed(() => props.tagTone ?? tagTypeToneMap[props.tagType]);
</script>
