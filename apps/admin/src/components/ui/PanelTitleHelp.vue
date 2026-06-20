<template>
  <div class="panel-title-help-block">
    <h3 class="panel-title-help-block__title">
      <span>{{ title }}</span>
      <FeatureHelp
        v-if="helpText"
        class="panel-title-help-block__trigger"
        :placement="placement"
        :title="title"
        :text="helpText"
      />
    </h3>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    help?: string | string[];
    placement?: 'top' | 'bottom' | 'left' | 'right';
  }>(),
  {
    help: '',
    placement: 'right'
  }
);

const helpText = computed(() => {
  const items = Array.isArray(props.help) ? props.help : [props.help];
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ');
});
</script>
