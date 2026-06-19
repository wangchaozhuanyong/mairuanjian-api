<template>
  <PageScaffold
    title="Apple ID 操作计划"
    group="工作台"
    phase="Phase 5"
    description="按 Apple ID 聚合临期业务、续费、取消订阅、待客户确认和误扣费风险，形成当天操作清单。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="计划数量" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="风险计划" :value="riskCount" hint="当前页误扣费风险" tone="red" />
      <MetricCard label="建议充值" :value="suggestedTopupSum" hint="当前页合计" tone="orange" />
      <MetricCard label="操作项" :value="itemCountSum" hint="当前页合计" tone="purple" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="actionPlanColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedPlans.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :primary-loading="generating"
        primary-label="生成操作计划"
        placeholder="搜索 Apple ID、客户、业务、计划备注"
        @search="handleSearch"
        @refresh="loadPlans"
        @primary="generatePlans"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.hasWrongChargeRisk"
            class="table-toolbar__select"
            clearable
            placeholder="误扣费风险"
            @change="handleSearch"
          >
            <el-option
              v-for="item in riskOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="quickDate"
            class="table-toolbar__select"
            clearable
            placeholder="计划日期"
            @change="applyQuickDate"
          >
            <el-option
              v-for="item in quickDateOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="plans"
        :size="tableSize"
        row-key="id"
        empty-text="暂无操作计划"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="190">
          <template #default="{ row }">
            <strong>{{ row.appleAccount.appleIdMasked }}</strong>
            <div class="muted-block">
              {{ row.appleAccount.region }} / {{ row.appleAccount.currency }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('balance')"
          prop="currentBalance"
          label="余额/建议充值"
          min-width="160"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.currentBalance }} / {{ row.suggestedTopupAmount }}
            <div class="muted-block">预计续费 {{ row.requiredRenewalAmount }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('services')" label="业务分布" min-width="190">
          <template #default="{ row }">
            开通 {{ row.activeServiceCount }} · 续费 {{ row.renewServicesCount }} · 取消
            {{ row.cancelServicesCount }}
            <div class="muted-block">等客户 {{ row.pendingCustomerCount }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('risk')"
          prop="hasWrongChargeRisk"
          label="风险"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag
              :type="row.hasWrongChargeRisk ? 'danger' : 'success'"
              size="small"
              effect="light"
            >
              {{ row.hasWrongChargeRisk ? '有风险' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('itemCount')"
          prop="itemCount"
          label="操作项"
          width="100"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.itemCount }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('planDate')"
          prop="planDate"
          label="计划日期"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.planDate, true) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="100"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button
              text
              type="success"
              :disabled="row.status === 'completed'"
              @click="completePlan(row)"
            >
              完成
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadPlans"
          @size-change="loadPlans"
        />
      </div>
    </section>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="
        selectedPlan ? `操作计划 · ${selectedPlan.appleAccount.appleIdMasked}` : '操作计划详情'
      "
      confirm-text="刷新详情"
      size="720px"
      @confirm="refreshDetail"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedPlan?.appleAccount.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>当前余额</span>
          <strong>{{ selectedPlan?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>建议充值</span>
          <strong>{{ selectedPlan?.suggestedTopupAmount ?? '-' }}</strong>
        </div>
        <div>
          <span>续费项</span>
          <strong>{{ selectedPlan?.renewServicesCount ?? '-' }}</strong>
        </div>
        <div>
          <span>取消项</span>
          <strong>{{ selectedPlan?.cancelServicesCount ?? '-' }}</strong>
        </div>
        <div>
          <span>风险</span>
          <strong>{{ selectedPlan?.hasWrongChargeRisk ? '有误扣费风险' : '正常' }}</strong>
        </div>
      </div>

      <el-alert
        v-if="selectedPlan?.hasWrongChargeRisk"
        class="detail-alert"
        title="存在误扣费风险"
        description="该 Apple ID 中存在客户不续费但自动续费未明确关闭，或临期未确认且自动续费开启的业务。"
        type="error"
        show-icon
        :closable="false"
      />

      <el-descriptions class="detail-descriptions" :column="1" border>
        <el-descriptions-item label="计划备注">
          {{ selectedPlan?.mainNote ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="计划日期">
          {{ formatDate(selectedPlan?.planDate, true) }}
        </el-descriptions-item>
        <el-descriptions-item label="平均成本">
          {{ selectedPlan?.avgUnitCost ?? '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <el-table :data="selectedPlan?.items ?? []" row-key="id">
        <el-table-column label="客户/业务" min-width="170">
          <template #default="{ row }">
            {{ row.customer.name }}
            <div class="muted-block">{{ row.service.name }}</div>
          </template>
        </el-table-column>
        <el-table-column label="动作" width="120">
          <template #default="{ row }">
            <el-tag :type="getActionType(row.actionType)" size="small" effect="light">
              {{ getActionLabel(row.actionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期/截止" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.expireTime) }}
            <div class="muted-block">取消截止 {{ formatDate(row.cancelDeadline) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="预计扣费" width="110">
          <template #default="{ row }">{{ row.expectedChargeAmount }}</template>
        </el-table-column>
        <el-table-column label="关联任务" min-width="150">
          <template #default="{ row }">
            {{ row.task?.title ?? '-' }}
            <div v-if="row.task" class="muted-block">{{ row.task.status }}</div>
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="220">
          <template #default="{ row }">{{ row.note ?? '-' }}</template>
        </el-table-column>
      </el-table>

      <div class="drawer-inline-actions">
        <el-button
          type="success"
          :disabled="!selectedPlan || selectedPlan.status === 'completed'"
          @click="completeSelectedPlan"
        >
          标记计划完成
        </el-button>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { appleActionPlansApi, userTableViewsApi, type AppleActionPlanQuery } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  AppleActionPlan,
  AppleActionPlanItem,
  TableDensity,
  UserTableView
} from '@/types/system';

const plans = ref<AppleActionPlan[]>([]);
const total = ref(0);
const loading = ref(false);
const generating = ref(false);
const quickDate = ref('');
const selectedPlans = ref<AppleActionPlan[]>([]);
const selectedPlan = ref<AppleActionPlan | null>(null);
const detailDrawerVisible = ref(false);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const tableKey = 'apple_action_plans';

const query = reactive<AppleActionPlanQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  hasWrongChargeRisk: '',
  planDateFrom: '',
  planDateTo: ''
});

const statusOptions: Array<{ label: string; value: AppleActionPlan['status'] }> = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '异常', value: 'abnormal' }
];

const riskOptions = [
  { label: '有风险', value: 'true' },
  { label: '无风险', value: 'false' }
];

const quickDateOptions = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '近7天', value: 'last7' },
  { label: '本月', value: 'month' }
];

const actionPlanColumnOptions = [
  { label: 'Apple ID', value: 'appleAccount', required: true },
  { label: '余额/建议充值', value: 'balance' },
  { label: '业务分布', value: 'services' },
  { label: '风险', value: 'risk' },
  { label: '操作项', value: 'itemCount' },
  { label: '计划日期', value: 'planDate' },
  { label: '状态', value: 'status' }
];

const batchActions = [{ label: '批量导出', value: 'export' }];

const riskCount = computed(() => plans.value.filter((plan) => plan.hasWrongChargeRisk).length);
const suggestedTopupSum = computed(() =>
  plans.value.reduce((sum, plan) => sum + Number(plan.suggestedTopupAmount || 0), 0).toFixed(2)
);
const itemCountSum = computed(() =>
  plans.value.reduce((sum, plan) => sum + Number(plan.itemCount || 0), 0)
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const riskLabel = riskOptions.find((item) => item.value === query.hasWrongChargeRisk)?.label;
  const quickDateLabel = quickDateOptions.find((item) => item.value === quickDate.value)?.label;

  if (query.hasWrongChargeRisk && riskLabel) {
    chips.push({ key: 'hasWrongChargeRisk', label: '误扣费风险', value: riskLabel });
  }
  if (quickDate.value && quickDateLabel) {
    chips.push({ key: 'quickDate', label: '计划日期', value: quickDateLabel });
  }

  return chips;
});

onMounted(initializePage);

async function loadPlans() {
  loading.value = true;
  try {
    const result = await appleActionPlansApi.list({
      ...query,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      hasWrongChargeRisk: query.hasWrongChargeRisk || undefined,
      planDateFrom: query.planDateFrom || undefined,
      planDateTo: query.planDateTo || undefined,
      sortBy: sortConfig.value.prop,
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    plans.value = result.items;
    total.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载操作计划失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadPlans();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadPlans();
}

function handleSelectionChange(rows: AppleActionPlan[]) {
  selectedPlans.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.hasWrongChargeRisk = '';
  quickDate.value = '';
  clearPlanDateRange();
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'hasWrongChargeRisk') {
    query.hasWrongChargeRisk = '';
  }
  if (key === 'quickDate') {
    quickDate.value = '';
    clearPlanDateRange();
  }
}

function exportList() {
  ElMessage.info('Apple ID 操作计划导出会进入数据中心导出任务，后续统一接入');
}

function handleBatchAction(action: string) {
  if (action === 'export') {
    exportList();
  }
}

async function loadTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 操作计划视图', {
      inputValue: 'Apple ID 操作计划常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey,
      viewName: value.trim(),
      filters: {
        keyword: query.keyword,
        status: query.status,
        hasWrongChargeRisk: query.hasWrongChargeRisk,
        quickDate: quickDate.value,
        planDateFrom: query.planDateFrom,
        planDateTo: query.planDateTo
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : actionPlanColumnOptions.map((column) => column.value),
      density: density.value,
      pageSize: query.pageSize,
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

async function applySavedView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyView(view);
  ElMessage.success('已应用保存视图');
  await loadPlans();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.hasWrongChargeRisk =
    typeof filters.hasWrongChargeRisk === 'string' ? filters.hasWrongChargeRisk : '';
  quickDate.value = typeof filters.quickDate === 'string' ? filters.quickDate : '';
  query.planDateFrom = typeof filters.planDateFrom === 'string' ? filters.planDateFrom : '';
  query.planDateTo = typeof filters.planDateTo === 'string' ? filters.planDateTo : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        actionPlanColumnOptions.some((option) => option.value === column)
      )
    : actionPlanColumnOptions.map((column) => column.value);
  sortConfig.value = parseSortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function parseSortConfig(value: Record<string, unknown>): {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
} {
  const prop = typeof value.prop === 'string' ? value.prop : undefined;
  const order =
    value.order === 'ascending' || value.order === 'descending' || value.order === null
      ? value.order
      : undefined;
  return prop ? { prop, order } : {};
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function generatePlans() {
  generating.value = true;
  try {
    const result = await appleActionPlansApi.generate({ daysAhead: 7 });
    ElMessage.success(
      `扫描 ${result.scannedActivations} 条开通记录，生成 ${result.accountCount} 个 Apple ID 计划，操作项 ${result.itemCount} 个`
    );
    await loadPlans();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成操作计划失败');
  } finally {
    generating.value = false;
  }
}

async function openDetail(plan: AppleActionPlan) {
  try {
    selectedPlan.value = await appleActionPlansApi.get(plan.id);
    detailDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载计划详情失败');
  }
}

async function refreshDetail() {
  if (!selectedPlan.value) return;
  await openDetail(selectedPlan.value);
}

async function completePlan(plan: AppleActionPlan) {
  selectedPlan.value = plan;
  await completeSelectedPlan();
}

async function completeSelectedPlan() {
  if (!selectedPlan.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入完成备注', '完成操作计划', {
      inputType: 'textarea',
      inputValue: selectedPlan.value.mainNote ?? '',
      confirmButtonText: '完成',
      cancelButtonText: '取消'
    });
    selectedPlan.value = await appleActionPlansApi.complete(selectedPlan.value.id, {
      mainNote: value || selectedPlan.value.mainNote || null
    });
    ElMessage.success('操作计划已完成');
    await loadPlans();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '完成操作计划失败');
    }
  }
}

async function applyQuickDate() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  query.page = 1;
  clearPlanDateRange();

  if (quickDate.value === 'today') {
    end.setDate(end.getDate() + 1);
    query.planDateFrom = start.toISOString();
    query.planDateTo = end.toISOString();
  } else if (quickDate.value === 'yesterday') {
    start.setDate(start.getDate() - 1);
    query.planDateFrom = start.toISOString();
    query.planDateTo = end.toISOString();
  } else if (quickDate.value === 'last7') {
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 1);
    query.planDateFrom = start.toISOString();
    query.planDateTo = end.toISOString();
  } else if (quickDate.value === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    query.planDateFrom = monthStart.toISOString();
    query.planDateTo = monthEnd.toISOString();
  }

  await loadPlans();
}

function clearPlanDateRange() {
  query.planDateFrom = '';
  query.planDateTo = '';
}

async function initializePage() {
  await loadTableViews(true);
  await loadPlans();
}

function formatDate(value?: string | null, dateOnly = false) {
  if (!value) return '-';
  const options: Intl.DateTimeFormatOptions = dateOnly
    ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { hour12: false };
  return new Date(value).toLocaleString('zh-CN', options);
}

function getStatusLabel(value: AppleActionPlan['status']) {
  const labels: Record<AppleActionPlan['status'], string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    abnormal: '异常'
  };
  return labels[value];
}

function getStatusType(value: AppleActionPlan['status']) {
  if (value === 'completed') return 'success';
  if (value === 'abnormal') return 'danger';
  if (value === 'processing') return 'warning';
  return 'primary';
}

function getActionLabel(value: AppleActionPlanItem['actionType']) {
  const labels: Record<AppleActionPlanItem['actionType'], string> = {
    renew: '续费',
    cancel: '取消订阅',
    change_plan: '改套餐',
    wait_customer: '等客户'
  };
  return labels[value];
}

function getActionType(value: AppleActionPlanItem['actionType']) {
  if (value === 'cancel') return 'danger';
  if (value === 'renew') return 'success';
  if (value === 'change_plan') return 'warning';
  return 'info';
}
</script>
