<template>
  <section class="workspace-route-skeleton" role="status" aria-live="polite">
    <div class="workspace-route-skeleton__head">
      <span class="workspace-route-skeleton__badge" />
      <div>
        <strong>{{ title }}</strong>
        <p>正在打开页面</p>
      </div>
    </div>

    <div class="workspace-route-skeleton__metrics">
      <div v-for="index in 4" :key="index" class="workspace-route-skeleton__metric">
        <span />
        <strong />
        <small />
      </div>
    </div>

    <div class="workspace-route-skeleton__panel">
      <div class="workspace-route-skeleton__toolbar">
        <span />
        <span />
        <span />
      </div>
      <div v-for="index in 5" :key="`row-${index}`" class="workspace-route-skeleton__row" />
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
  }>(),
  {
    title: '后台页面'
  }
);
</script>
