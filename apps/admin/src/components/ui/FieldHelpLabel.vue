<template>
  <span class="field-help-label">
    <span class="field-help-label__text">{{ label }}</span>
    <FeatureHelp
      class="field-help-label__trigger"
      :placement="placement"
      :text="helpItems"
      :title="label"
      :width="width"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';

const props = withDefaults(
  defineProps<{
    label: string;
    purpose?: string;
    example?: string;
    help?: string | string[];
    placement?: 'top' | 'bottom' | 'left' | 'right';
    width?: number;
  }>(),
  {
    purpose: '',
    example: '',
    help: '',
    placement: 'top',
    width: 340
  }
);

const helpItems = computed(() => {
  if (props.help) {
    const items = Array.isArray(props.help) ? props.help : [props.help];
    return items.map((item) => item.trim()).filter(Boolean);
  }

  return [
    props.purpose ? `用途：${props.purpose}` : '',
    props.example ? `举例：${props.example}` : ''
  ].filter(Boolean);
});
</script>
