<template>
  <span class="table-header-help">
    <span class="table-header-help__label">{{ label }}</span>
    <FeatureHelp :title="title || label" :text="text" :placement="placement" :width="width" />
  </span>
</template>

<script setup lang="ts">
import FeatureHelp from '@/components/ui/FeatureHelp.vue';

withDefaults(
  defineProps<{
    label: string;
    text: string | string[];
    title?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    width?: number;
  }>(),
  {
    title: '',
    placement: 'top',
    width: 340
  }
);
</script>
