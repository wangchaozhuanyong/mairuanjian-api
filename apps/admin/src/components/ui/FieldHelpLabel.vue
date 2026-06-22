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
import { buildFieldHelpText, normalizeHelpText } from '@/utils/helpText';

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
    return normalizeHelpText(props.help);
  }

  return buildFieldHelpText(props.label, props.purpose, props.example);
});
</script>
