<template>
  <el-drawer
    v-model="visible"
    :size="size"
    :title="title"
    direction="rtl"
    class="app-drawer"
    :style="drawerStyle"
    destroy-on-close
  >
    <template #header>
      <div class="app-drawer__header-copy">
        <span v-if="eyebrow" class="app-drawer__eyebrow">{{ eyebrow }}</span>
        <strong>{{ title }}</strong>
        <p v-if="description">{{ description }}</p>
      </div>
    </template>

    <div class="app-drawer__content" :class="bodyClass">
      <slot />
    </div>

    <template #footer>
      <div class="app-drawer__footer-wrap">
        <p v-if="footerHint" class="app-drawer__footer-hint">{{ footerHint }}</p>
        <div
          class="drawer-footer-actions"
          :class="{ 'drawer-footer-actions--single': !showConfirmButton }"
        >
          <AppButton :disabled="confirmLoading" @click="visible = false">{{ closeText }}</AppButton>
          <AppButton
            v-if="showConfirmButton"
            :variant="confirmVariant"
            :loading="confirmLoading"
            :disabled="confirmDisabled"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </AppButton>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, useAttrs } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';

const DEFAULT_CONFIRM_TEXT = '确认';
type AppDrawerButtonVariant = 'default' | 'primary' | 'soft' | 'danger' | 'success' | 'ghost';

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    eyebrow?: string;
    confirmText?: string;
    closeText?: string;
    size?: string;
    bodyClass?: string;
    footerHint?: string;
    confirmVariant?: AppDrawerButtonVariant;
    confirmLoading?: boolean;
    confirmDisabled?: boolean;
    showConfirm?: boolean | null;
  }>(),
  {
    description: '',
    eyebrow: '',
    confirmText: DEFAULT_CONFIRM_TEXT,
    closeText: '关闭',
    size: '560px',
    bodyClass: '',
    footerHint: '',
    confirmVariant: 'primary',
    confirmLoading: false,
    confirmDisabled: false,
    showConfirm: null
  }
);

const emit = defineEmits<{
  confirm: [];
}>();

const visible = defineModel<boolean>({ default: false });
const instance = getCurrentInstance();
const attrs = useAttrs();
const hasConfirmListener = computed(() => hasListener(instance?.vnode.props) || hasListener(attrs));
const hasCustomConfirmText = computed(() => props.confirmText !== DEFAULT_CONFIRM_TEXT);
const showConfirmButton = computed(
  () => props.showConfirm ?? (hasConfirmListener.value || hasCustomConfirmText.value)
);
const drawerStyle = computed(() => ({
  '--app-drawer-size': props.size
}));

function hasListener(source: Record<string, unknown> | null | undefined) {
  return Object.keys(source ?? {}).some((key) => key.toLowerCase() === 'onconfirm');
}

function handleConfirm() {
  emit('confirm');

  if (!hasConfirmListener.value) {
    visible.value = false;
  }
}
</script>
