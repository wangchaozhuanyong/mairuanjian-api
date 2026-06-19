<template>
  <div class="metric-card" :class="`metric-card--${tone}`">
    <div class="metric-card__top">
      <span>{{ label }}</span>
      <el-tag v-if="tag" :type="tagType" size="small" effect="light">{{ tag }}</el-tag>
    </div>
    <strong>{{ value }}</strong>
    <p>{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    hint: string;
    tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
    tag?: string;
    tagType?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
  }>(),
  {
    tone: 'blue',
    tag: '',
    tagType: 'info'
  }
);
</script>
