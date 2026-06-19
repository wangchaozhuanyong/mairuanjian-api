<template>
  <section class="page-scaffold">
    <div v-if="$slots.actions" class="page-scaffold__toolbar">
      <div class="page-scaffold__actions">
        <slot name="actions" />
      </div>
    </div>

    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  group: string;
  description: string;
  phase?: string;
}>();
</script>
