<template>
  <el-button
    v-bind="$attrs"
    class="app-button"
    :class="[`app-button--${variant}`, { 'app-button--icon': iconOnly }]"
    :disabled="disabled"
    :loading="loading"
    @click="$emit('click', $event)"
  >
    <slot />
  </el-button>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'soft' | 'danger' | 'success' | 'ghost';
    loading?: boolean;
    disabled?: boolean;
    iconOnly?: boolean;
  }>(),
  {
    variant: 'default',
    loading: false,
    disabled: false,
    iconOnly: false
  }
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>
