<template>
  <section class="page-scaffold">
    <header class="page-scaffold__head">
      <div>
        <div class="page-kicker">
          <span>{{ group }}</span>
          <span v-if="phase">/</span>
          <span v-if="phase">{{ phase }}</span>
        </div>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
      </div>
      <div class="page-scaffold__actions">
        <slot name="actions" />
      </div>
    </header>

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
