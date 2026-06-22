<template>
  <section
    class="app-card"
    :class="cardClasses"
    :aria-busy="loading || undefined"
    :aria-label="title || undefined"
  >
    <header v-if="title || subtitle || tag || $slots.actions" class="app-card__header">
      <div class="app-card__heading">
        <h3 v-if="title" class="app-card__title">
          <span>{{ title }}</span>
          <FeatureHelp
            v-if="cardHelpItems.length"
            class="app-card__title-help"
            placement="right"
            :title="title"
            :text="cardHelpItems"
          />
        </h3>
        <p v-else-if="subtitle" class="app-card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="tag || $slots.actions" class="app-card__actions">
        <StatusChip v-if="tag" :tone="tagTone">{{ tag }}</StatusChip>
        <slot name="actions" />
      </div>
    </header>
    <div class="app-card__body" :class="{ 'app-card__body--state': hasState }">
      <AppState
        v-if="hasState"
        :type="stateType"
        :title="stateTitle"
        :description="stateDescription"
        :compact="stateCompact"
      >
        <slot name="state-actions" />
      </AppState>
      <slot v-else />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppState from '@/components/ui/AppState.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { normalizeHelpText } from '@/utils/helpText';

type AppCardTagTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    help?: string | string[];
    tag?: string;
    tagTone?: AppCardTagTone;
    padded?: boolean;
    loading?: boolean;
    empty?: boolean;
    error?: boolean | string;
    stateCompact?: boolean;
    loadingTitle?: string;
    loadingDescription?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    errorTitle?: string;
    errorDescription?: string;
  }>(),
  {
    title: '',
    subtitle: '',
    help: '',
    tag: '',
    tagTone: 'blue',
    padded: false,
    loading: false,
    empty: false,
    error: false,
    stateCompact: false,
    loadingTitle: '正在加载',
    loadingDescription: '数据正在读取，请稍候。',
    emptyTitle: '暂无数据',
    emptyDescription: '当前筛选条件下没有可展示记录。',
    errorTitle: '加载失败',
    errorDescription: '数据暂时无法读取，请刷新后重试。'
  }
);

const hasState = computed(() => props.loading || Boolean(props.error) || props.empty);
const cardHelpItems = computed(() => normalizeHelpText(props.help || props.subtitle));
const stateType = computed(() => {
  if (props.loading) return 'loading';
  if (props.error) return 'error';
  return 'empty';
});
const stateTitle = computed(() => {
  if (props.loading) return props.loadingTitle;
  if (props.error) return props.errorTitle;
  return props.emptyTitle;
});
const stateDescription = computed(() => {
  if (props.loading) return props.loadingDescription;
  if (typeof props.error === 'string') return props.error;
  if (props.error) return props.errorDescription;
  return props.emptyDescription;
});
const cardClasses = computed(() => ({
  'app-card--pad': props.padded,
  'app-card--state': hasState.value,
  'app-card--loading': props.loading,
  'app-card--empty': !props.loading && !props.error && props.empty,
  'app-card--error': !props.loading && Boolean(props.error)
}));
</script>
