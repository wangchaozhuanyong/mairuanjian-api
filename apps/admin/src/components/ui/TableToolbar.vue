<template>
  <div class="table-toolbar">
    <div v-if="selectedCount > 0" class="table-toolbar__batch">
      <span>已选 {{ selectedCount }} 项</span>
      <el-button
        v-for="action in batchActions"
        :key="action.value"
        size="small"
        @click="$emit('batchAction', action.value)"
      >
        {{ action.label }}
      </el-button>
    </div>

    <div class="table-toolbar__main">
      <el-input
        v-model="keywordModel"
        class="table-toolbar__search"
        clearable
        :prefix-icon="Search"
        :placeholder="placeholder"
        @keyup.enter="$emit('search')"
        @clear="$emit('search')"
      />
      <el-select
        v-if="showStatus"
        v-model="statusModel"
        class="table-toolbar__select"
        clearable
        placeholder="状态"
        @change="$emit('search')"
      >
        <el-option
          v-for="option in effectiveStatusOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <slot name="filters" />
      <div v-if="showDateShortcut" class="quick-date" role="group" aria-label="日期快捷筛选">
        <button
          v-for="item in dateOptions"
          :key="item.value"
          :class="{ active: dateShortcutModel === item.value }"
          type="button"
          @click="selectDateShortcut(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="table-toolbar__ops">
      <el-select
        v-if="savedViews.length"
        v-model="savedViewIdModel"
        class="table-toolbar__view-select"
        clearable
        placeholder="保存视图"
        @change="applySavedView"
      >
        <el-option
          v-for="view in savedViews"
          :key="view.id"
          :label="view.isDefault ? `${view.viewName}（默认）` : view.viewName"
          :value="view.id"
        />
      </el-select>
      <el-button :icon="Refresh" @click="$emit('refresh')">刷新</el-button>
      <el-button v-if="showExport" :icon="Download" @click="$emit('export')">导出</el-button>
      <el-dropdown trigger="click" :hide-on-click="false">
        <el-button :icon="Setting">列显示</el-button>
        <template #dropdown>
          <el-dropdown-menu class="table-toolbar__columns-menu">
            <el-checkbox-group v-model="selectedColumns">
              <el-checkbox
                v-for="column in effectiveColumnOptions"
                :key="column.value"
                :value="column.value"
                :disabled="column.required"
              >
                {{ column.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-radio-group v-model="densityModel" size="small" class="density-toggle">
        <el-radio-button v-for="item in densityOptions" :key="item.value" :value="item.value">
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
      <el-button v-if="showSaveView" :icon="Collection" @click="$emit('saveView')">
        保存视图
      </el-button>
      <el-button
        v-if="showPrimary"
        type="primary"
        :loading="primaryLoading"
        :disabled="primaryDisabled"
        @click="$emit('primary')"
      >
        {{ primaryLabel }}
      </el-button>
    </div>

    <div v-if="activeChips.length" class="filter-chips table-toolbar__chips">
      <el-tag
        v-for="chip in activeChips"
        :key="chip.key"
        closable
        effect="plain"
        @close="removeChip(chip.key)"
      >
        {{ chip.label }}：{{ chip.value }}
      </el-tag>
      <el-button text type="primary" @click="clearFilters">清空筛选</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Collection, Download, Refresh, Search, Setting } from '@element-plus/icons-vue';
import { computed, watch } from 'vue';
import type { UserTableView } from '@/types/system';

interface SelectOption {
  label: string;
  value: string;
}

interface ColumnOption extends SelectOption {
  required?: boolean;
}

interface FilterChip {
  key: string;
  label: string;
  value: string;
}

type BuiltInChipKey = 'keyword' | 'status' | 'date' | 'density' | 'view';

const props = withDefaults(
  defineProps<{
    placeholder: string;
    columns?: string[];
    columnOptions?: ColumnOption[];
    statusOptions?: SelectOption[];
    primaryLabel?: string;
    savedViews?: UserTableView[];
    filterChips?: FilterChip[];
    selectedCount?: number;
    batchActions?: SelectOption[];
    showStatus?: boolean;
    showDateShortcut?: boolean;
    showExport?: boolean;
    showSaveView?: boolean;
    showPrimary?: boolean;
    primaryLoading?: boolean;
    primaryDisabled?: boolean;
  }>(),
  {
    primaryLabel: '新建记录',
    columns: () => [],
    columnOptions: () => [],
    statusOptions: () => [],
    savedViews: () => [],
    filterChips: () => [],
    selectedCount: 0,
    batchActions: () => [],
    showStatus: true,
    showDateShortcut: true,
    showExport: true,
    showSaveView: true,
    showPrimary: true,
    primaryLoading: false,
    primaryDisabled: false
  }
);

const emit = defineEmits<{
  refresh: [];
  primary: [];
  search: [];
  clearFilters: [];
  saveView: [];
  export: [];
  applyView: [id: string];
  batchAction: [action: string];
  removeFilter: [key: string];
}>();

const keywordModel = defineModel<string>('keyword', { default: '' });
const statusModel = defineModel<string>('status', { default: '' });
const densityModel = defineModel<string>('density', { default: 'default' });
const dateShortcutModel = defineModel<string>('dateShortcut', { default: 'last_7_days' });
const visibleColumnsModel = defineModel<string[]>('visibleColumns', { default: () => [] });
const savedViewIdModel = defineModel<string>('savedViewId', { default: '' });

const dateOptions: SelectOption[] = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '近7天', value: 'last_7_days' },
  { label: '近30天', value: 'last_30_days' },
  { label: '本月', value: 'this_month' },
  { label: '上月', value: 'last_month' },
  { label: '自定义', value: 'custom' }
];

const densityOptions: SelectOption[] = [
  { label: '紧凑', value: 'compact' },
  { label: '标准', value: 'default' },
  { label: '宽松', value: 'loose' }
];

const defaultStatusOptions: SelectOption[] = [
  { label: '已接入', value: 'ready' },
  { label: '设计完成', value: 'design-ready' },
  { label: '待接入接口', value: 'planned' }
];

const effectiveStatusOptions = computed(() => props.statusOptions ?? defaultStatusOptions);
const savedViews = computed(() => props.savedViews ?? []);
const batchActions = computed(() => props.batchActions ?? []);
const extraFilterChips = computed(() => props.filterChips ?? []);
const effectiveColumnOptions = computed<ColumnOption[]>(() => {
  if (props.columnOptions?.length) {
    return props.columnOptions;
  }

  return (props.columns ?? []).map((column) => ({
    label: column,
    value: column
  }));
});
const allColumnValues = computed(() => effectiveColumnOptions.value.map((column) => column.value));
const requiredColumnValues = computed(() =>
  effectiveColumnOptions.value.filter((column) => column.required).map((column) => column.value)
);

const selectedColumns = computed({
  get() {
    return visibleColumnsModel.value.length ? visibleColumnsModel.value : allColumnValues.value;
  },
  set(value: string[]) {
    const allowed = new Set(allColumnValues.value);
    visibleColumnsModel.value = [...new Set([...value, ...requiredColumnValues.value])].filter(
      (column) => allowed.has(column)
    );
  }
});

const activeChips = computed(() => {
  const chips: FilterChip[] = [];
  const statusLabel = effectiveStatusOptions.value.find(
    (option) => option.value === statusModel.value
  )?.label;
  const dateLabel = dateOptions.find((option) => option.value === dateShortcutModel.value)?.label;
  const densityLabel = densityOptions.find((option) => option.value === densityModel.value)?.label;
  const viewLabel = savedViews.value.find((view) => view.id === savedViewIdModel.value)?.viewName;

  if (keywordModel.value) chips.push({ key: 'keyword', label: '搜索', value: keywordModel.value });
  if (statusModel.value && statusLabel)
    chips.push({ key: 'status', label: '状态', value: statusLabel });
  if (props.showDateShortcut && dateLabel)
    chips.push({ key: 'date', label: '日期', value: dateLabel });
  if (densityLabel) chips.push({ key: 'density', label: '密度', value: densityLabel });
  if (viewLabel) chips.push({ key: 'view', label: '视图', value: viewLabel });

  return [...chips, ...extraFilterChips.value];
});

watch(
  allColumnValues,
  (values) => {
    if (!values.length) {
      visibleColumnsModel.value = [];
      return;
    }

    if (!visibleColumnsModel.value.length) {
      visibleColumnsModel.value = [...values];
      return;
    }

    const allowed = new Set(values);
    const filtered = visibleColumnsModel.value.filter((column) => allowed.has(column));
    visibleColumnsModel.value = filtered.length ? filtered : [...values];
  },
  { immediate: true }
);

function selectDateShortcut(value: string) {
  dateShortcutModel.value = value;
  emit('search');
}

function applySavedView(value: string) {
  if (value) {
    emit('applyView', value);
  }
}

function removeChip(key: string) {
  if (key === 'keyword') keywordModel.value = '';
  if (key === 'status') statusModel.value = '';
  if (key === 'date') dateShortcutModel.value = 'last_7_days';
  if (key === 'density') densityModel.value = 'default';
  if (key === 'view') savedViewIdModel.value = '';
  if (!isBuiltInChipKey(key)) emit('removeFilter', key);
  emit('search');
}

function clearFilters() {
  keywordModel.value = '';
  statusModel.value = '';
  dateShortcutModel.value = 'last_7_days';
  densityModel.value = 'default';
  savedViewIdModel.value = '';
  emit('clearFilters');
  emit('search');
}

function isBuiltInChipKey(key: string): key is BuiltInChipKey {
  return ['keyword', 'status', 'date', 'density', 'view'].includes(key);
}
</script>
