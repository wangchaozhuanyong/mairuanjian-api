<template>
  <PageScaffold
    :title="moduleInfo.title"
    :group="moduleInfo.group"
    :phase="moduleInfo.phase"
    :description="moduleInfo.description"
  >
    <template #actions>
      <StatusChip :tone="getModuleStatusTone(moduleInfo.status)" dot>
        {{ getStatusText(moduleInfo.status) }}
      </StatusChip>
      <AppButton @click="previewDrawerVisible = true">查看交互</AppButton>
      <AppButton variant="primary" @click="showPlannedMessage">
        {{ moduleInfo.primaryAction ?? '新建记录' }}
      </AppButton>
    </template>

    <section class="content-panel" aria-label="模块概览">
      <div class="detail-note-grid">
        <div v-for="metric in metrics" :key="metric.label" class="detail-note-item">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <span>{{ metric.hint }}</span>
        </div>
      </div>
    </section>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="keyword"
        v-model:status="status"
        v-model:density="density"
        v-model:date-shortcut="dateShortcut"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :columns="columns"
        :saved-views="savedViews"
        :selected-count="selectedRows.length"
        :batch-actions="batchActions"
        :primary-label="moduleInfo.primaryAction ?? '新建记录'"
        placeholder="搜索关键字、客户、订单、账号、备注"
        @refresh="showRefreshMessage"
        @primary="showPlannedMessage"
        @search="handleSearch"
        @clear-filters="resetTableState"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="showExportMessage"
        @batch-action="handleBatchAction"
      />

      <el-table
        class="desktop-data-table"
        :data="sampleRows"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-for="column in displayColumns"
          :key="column"
          :prop="column"
          :label="column"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">
            <span v-if="column === '状态' || column === '发货状态' || column === '启用'">
              <StatusChip :tone="getSampleStatusTone(row[column])" dot>
                {{ row[column] }}
              </StatusChip>
            </span>
            <span v-else>{{ row[column] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default>
            <AppButton size="small" variant="ghost" @click="previewDrawerVisible = true">
              详情
            </AppButton>
            <AppButton size="small" variant="ghost" @click="showPlannedMessage">处理</AppButton>
          </template>
        </el-table-column>
      </el-table>

      <div class="mobile-record-list">
        <article v-for="row in sampleRows" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ moduleInfo.title }}记录 {{ row.id }}</strong>
              <span>{{ moduleInfo.phase }} · {{ getStatusText(moduleInfo.status) }}</span>
            </div>
            <StatusChip :tone="getModuleStatusTone(moduleInfo.status)" dot>
              {{ getStatusText(moduleInfo.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div v-for="column in displayColumns.slice(0, 3)" :key="column">
              <span>{{ column }}</span>
              <strong>{{ getSampleCell(row, column) }}</strong>
            </div>
          </div>

          <div v-if="displayColumns.length > 3" class="mobile-record-card__meta">
            <div v-for="column in displayColumns.slice(3, 5)" :key="column">
              <span>{{ column }}</span>
              <strong>{{ getSampleCell(row, column) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="previewDrawerVisible = true">
              详情
            </AppButton>
            <AppButton size="small" variant="soft" @click="showPlannedMessage">处理</AppButton>
          </div>
        </article>
      </div>

      <PaginationBar v-model:page="page" v-model:page-size="pageSize" :total="128" />
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <div>
          <h3>模块能力</h3>
          <p>页面已完成设计占位，后续只替换真实数据和接口。</p>
        </div>
        <StatusChip tone="neutral">不接假数据库</StatusChip>
      </div>
      <div class="feature-grid">
        <div v-for="feature in moduleInfo.features" :key="feature" class="feature-card">
          <strong>{{ feature }}</strong>
          <span>已纳入页面结构和后续开发入口</span>
        </div>
      </div>
    </section>

    <ExperiencePreview />

    <AppDrawer
      v-model="previewDrawerVisible"
      :title="`${moduleInfo.title} · 详情抽屉`"
      confirm-text="保存设计状态"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>模块</span>
          <strong>{{ moduleInfo.title }}</strong>
        </div>
        <div>
          <span>阶段</span>
          <strong>{{ moduleInfo.phase }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ getStatusText(moduleInfo.status) }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">交互说明</div>
        <div class="apple-core-alert apple-core-alert--blue">
          <StatusChip tone="blue">预留</StatusChip>
          <div>
            <strong>交互已预留</strong>
            <p>
              右侧抽屉用于详情、编辑、审批、发货异常、任务处理等高频操作。后续接入业务时优先复用该交互。
            </p>
          </div>
        </div>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { userTableViewsApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import ExperiencePreview from '@/components/ui/ExperiencePreview.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { allModules, getModuleByKey, getStatusText, type ModuleStatus } from '@/config/modules';
import type { TableDensity, UserTableView } from '@/types/system';

type SampleRow = { id: number } & Record<string, string | number>;

const route = useRoute();
const moduleKey = computed(() => String(route.meta.moduleKey ?? 'dashboard'));
const moduleInfo = computed(() => getModuleByKey(moduleKey.value) ?? allModules[0]);
const keyword = ref('');
const status = ref('');
const density = ref<TableDensity>('default');
const dateShortcut = ref('last_7_days');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const selectedRows = ref<Array<Record<string, unknown>>>([]);
const sortConfig = ref<Record<string, unknown>>({});
const page = ref(1);
const pageSize = ref(20);
const previewDrawerVisible = ref(false);
const batchActions = [
  { label: '批量标记', value: 'mark' },
  { label: '批量导出', value: 'export' }
];

const metrics = computed(
  () =>
    moduleInfo.value.metrics ?? [
      {
        label: '页面状态',
        value: getStatusText(moduleInfo.value.status),
        hint: moduleInfo.value.phase,
        tone: 'blue' as const
      },
      {
        label: '设计组件',
        value: moduleInfo.value.features.length,
        hint: '已规划能力点',
        tone: 'green' as const
      },
      { label: '接口状态', value: '待接入', hint: '后续按 Phase 开发', tone: 'orange' as const },
      { label: '体验状态', value: '完成', hint: '加载/空/错状态可预览', tone: 'purple' as const }
    ]
);

const columns = computed(
  () => moduleInfo.value.tableColumns ?? ['名称', '模块', '状态', '负责人', '更新时间']
);
const displayColumns = computed(() =>
  visibleColumns.value.length
    ? columns.value.filter((column) => visibleColumns.value.includes(column))
    : columns.value
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);

const sampleRows = computed<SampleRow[]>(
  () =>
    Array.from({ length: 3 }, (_, index) =>
      Object.fromEntries(
        columns.value.map((column, columnIndex) => [
          column,
          column === '状态' || column === '发货状态' || column === '启用'
            ? index === 0
              ? '正常'
              : '待接入'
            : `${column}示例 ${index + 1}${columnIndex === 0 ? '' : ''}`
        ])
      )
    ).map((row, index) => ({
      id: index + 1,
      ...row
    })) as SampleRow[]
);

function getModuleStatusTone(status: ModuleStatus) {
  const toneMap: Record<ModuleStatus, 'green' | 'blue' | 'orange' | 'neutral'> = {
    ready: 'green',
    'design-ready': 'blue',
    planned: 'orange',
    later: 'neutral'
  };

  return toneMap[status];
}

function getSampleStatusTone(value: unknown) {
  return value === '正常' || value === '已接入' ? 'green' : 'orange';
}

function formatSampleCell(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }
  return String(value);
}

function getSampleCell(row: unknown, column: string) {
  return formatSampleCell((row as Record<string, unknown>)[column]);
}

function showRefreshMessage() {
  ElMessage.success('设计预览已刷新');
}

function showPlannedMessage() {
  ElMessage.info('该模块已完成页面设计，真实功能将在对应 Phase 接入');
}

function showExportMessage() {
  ElMessage.info('导出会进入数据中心导出任务，后续业务页面复用该入口');
}

function handleSearch() {
  page.value = 1;
}

function handleBatchAction(action: string) {
  ElMessage.info(`已触发${action === 'export' ? '批量导出' : '批量操作'}入口`);
}

function handleSelectionChange(rows: Array<Record<string, unknown>>) {
  selectedRows.value = rows;
}

function handleSortChange(payload: { prop?: string; order?: string | null }) {
  sortConfig.value = payload.prop
    ? {
        prop: payload.prop,
        order: payload.order
      }
    : {};
}

function resetTableState() {
  keyword.value = '';
  status.value = '';
  density.value = 'default';
  dateShortcut.value = 'last_7_days';
  visibleColumns.value = [...columns.value];
  savedViewId.value = '';
  selectedRows.value = [];
  sortConfig.value = {};
  page.value = 1;
  pageSize.value = 20;
}

async function loadTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: moduleKey.value
    });
    savedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存表格视图', {
      inputValue: `${moduleInfo.value.title}视图`,
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: moduleKey.value,
      viewName: value.trim(),
      filters: {
        keyword: keyword.value,
        status: status.value,
        dateShortcut: dateShortcut.value
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length ? visibleColumns.value : columns.value,
      density: density.value,
      pageSize: pageSize.value,
      isDefault: savedViews.value.length === 0
    });
    await loadTableViews();
    savedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

function applySavedView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyView(view);
  ElMessage.success('已应用保存视图');
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  keyword.value = typeof filters.keyword === 'string' ? filters.keyword : '';
  status.value = typeof filters.status === 'string' ? filters.status : '';
  dateShortcut.value =
    typeof filters.dateShortcut === 'string' ? filters.dateShortcut : 'last_7_days';
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) => columns.value.includes(column))
    : [...columns.value];
  sortConfig.value = view.sortConfig;
  pageSize.value = view.pageSize;
  savedViewId.value = view.id;
}

watch(
  moduleKey,
  () => {
    resetTableState();
    void loadTableViews(true);
  },
  { immediate: true }
);
</script>
