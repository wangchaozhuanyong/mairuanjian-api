<template>
  <el-drawer
    v-model="visible"
    :size="size"
    :title="title"
    direction="rtl"
    class="app-drawer"
    destroy-on-close
  >
    <slot />
    <template #footer>
      <div class="drawer-footer-actions">
        <el-button :disabled="confirmLoading" @click="visible = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="confirmLoading"
          :disabled="confirmDisabled"
          @click="$emit('confirm')"
        >
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    confirmText?: string;
    size?: string;
    confirmLoading?: boolean;
    confirmDisabled?: boolean;
  }>(),
  {
    confirmText: '确认',
    size: '560px',
    confirmLoading: false,
    confirmDisabled: false
  }
);

defineEmits<{
  confirm: [];
}>();

const visible = defineModel<boolean>({ default: false });
</script>
