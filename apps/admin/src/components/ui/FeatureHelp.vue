<template>
  <el-popover
    :placement="placement"
    trigger="hover"
    :width="width"
    popper-class="feature-help-popper"
  >
    <template #reference>
      <span v-bind="attrs" class="feature-help" :aria-label="accessibilityLabel" tabindex="0">
        <span class="feature-help__marker" aria-hidden="true">
          <el-icon>
            <QuestionFilled />
          </el-icon>
        </span>
      </span>
    </template>
    <span class="feature-help-popper__content" role="tooltip">
      <strong v-if="title">{{ title }}</strong>
      <span>{{ text }}</span>
    </span>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { QuestionFilled } from '@element-plus/icons-vue';

defineOptions({
  inheritAttrs: false
});

const props = withDefaults(
  defineProps<{
    text: string;
    title?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    width?: number;
  }>(),
  {
    title: '',
    placement: 'top',
    width: 320
  }
);

const attrs = useAttrs();
const accessibilityLabel = computed(() =>
  props.title ? `${props.title}：${props.text}` : `说明：${props.text}`
);
</script>
