<template>
  <section
    class="page-scaffold"
    :class="{ 'page-scaffold--with-actions': Boolean($slots.actions) }"
    :aria-label="title"
    :data-page-group="group"
    :data-page-phase="phase"
  >
    <header class="visually-hidden">
      <h1>{{ title }}</h1>
      <p>{{ group }} · {{ description }}</p>
    </header>

    <div v-if="$slots.actions" class="page-scaffold__mobile-actions" aria-label="页面操作">
      <div class="page-scaffold__actions">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </section>
</template>

<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, useSlots } from 'vue';
import { usePageActions } from '@/composables/pageActions';

defineProps<{
  title: string;
  group: string;
  description: string;
  phase?: string;
}>();

const slots = useSlots();
const pageActions = usePageActions();

function registerActions() {
  pageActions?.clearActions();

  if (slots.actions) {
    pageActions?.setActions(slots.actions);
  }
}

function clearActions() {
  if (slots.actions) {
    pageActions?.clearActions(slots.actions);
  }
}

onMounted(registerActions);
onActivated(registerActions);
onDeactivated(clearActions);
onBeforeUnmount(clearActions);
</script>
