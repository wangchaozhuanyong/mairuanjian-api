<template>
  <el-tag :type="status === 'active' ? 'success' : 'info'" size="small" effect="light">
    {{ status === 'active' ? activeText : disabledText }}
  </el-tag>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    status: 'active' | 'disabled';
    activeText?: string;
    disabledText?: string;
  }>(),
  {
    activeText: '启用',
    disabledText: '停用'
  }
);
</script>
