<template>
  <section
    class="app-state"
    :class="[
      `app-state--${type}`,
      {
        'app-state--compact': compact,
        'app-state--with-actions': Boolean($slots.default || primaryLabel || secondaryLabel)
      }
    ]"
    :role="stateRole"
    :aria-busy="type === 'loading' || undefined"
    :aria-live="type === 'loading' ? 'polite' : undefined"
  >
    <div class="app-state__icon" aria-hidden="true">
      <el-icon v-if="type === 'loading'" class="is-loading">
        <Loading />
      </el-icon>
      <el-icon v-else>
        <component :is="iconComponent" />
      </el-icon>
    </div>

    <div class="app-state__copy">
      <h3>{{ title }}</h3>
      <p v-if="description">{{ description }}</p>
    </div>

    <div v-if="$slots.default || primaryLabel || secondaryLabel" class="app-state__actions">
      <slot>
        <AppButton v-if="secondaryLabel" @click="$emit('secondary')">
          {{ secondaryLabel }}
        </AppButton>
        <AppButton v-if="primaryLabel" :variant="primaryVariant" @click="$emit('primary')">
          {{ primaryLabel }}
        </AppButton>
      </slot>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  Box,
  CircleCloseFilled,
  InfoFilled,
  Loading,
  Lock,
  SuccessFilled,
  WarningFilled
} from '@element-plus/icons-vue';
import { computed } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';

type AppStateType = 'empty' | 'error' | 'forbidden' | 'info' | 'loading' | 'success' | 'warning';
type AppStateActionVariant = 'default' | 'primary' | 'soft' | 'danger' | 'success' | 'ghost';

const props = withDefaults(
  defineProps<{
    type?: AppStateType;
    title: string;
    description?: string;
    compact?: boolean;
    primaryLabel?: string;
    secondaryLabel?: string;
    primaryVariant?: AppStateActionVariant;
  }>(),
  {
    type: 'empty',
    description: '',
    compact: false,
    primaryLabel: '',
    secondaryLabel: '',
    primaryVariant: 'primary'
  }
);

defineEmits<{
  primary: [];
  secondary: [];
}>();

const iconComponent = computed(() => {
  const icons = {
    empty: Box,
    error: CircleCloseFilled,
    forbidden: Lock,
    info: InfoFilled,
    success: SuccessFilled,
    warning: WarningFilled
  };

  return icons[props.type === 'loading' ? 'info' : props.type];
});

const stateRole = computed(() =>
  props.type === 'error' || props.type === 'warning' ? 'alert' : 'status'
);
</script>
