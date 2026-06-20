<template>
  <span class="status-chip" :class="`status-chip--${tone}`">
    <span v-if="dot" class="status-chip__dot" />
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
    dot?: boolean;
  }>(),
  {
    tone: 'neutral',
    dot: false
  }
);
</script>
