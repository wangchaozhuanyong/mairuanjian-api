<template>
  <div v-if="hasActions" class="topbar-page-actions">
    <div class="page-action-portal__inner">
      <ActionSlotRenderer />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue';
import { usePageActions } from '@/composables/pageActions';

const pageActions = usePageActions();
const hasActions = computed(() => Boolean(pageActions?.slot.value));

const ActionSlotRenderer = defineComponent({
  name: 'ActionSlotRenderer',
  setup() {
    return () => pageActions?.slot.value?.() ?? null;
  }
});
</script>
