<template>
  <PageScaffold
    title="Apple ID 开通记录"
    group="Apple ID 业务"
    phase="Phase 4"
    description="查看每笔 Apple ID 业务开通后的服务记录、到期时间、成本利润和续费状态。"
  >
    <div class="metric-grid metric-grid--four">
      <MetricCard label="记录数量" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="开通中" :value="activeCount" hint="当前页" tone="green" />
      <MetricCard label="7天内到期" :value="expiringSoonCount" hint="当前页" tone="orange" />
      <MetricCard label="当前页利润" :value="sumProfit" hint="人民币" tone="red" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="activationColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedActivations.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-primary="false"
        placeholder="搜索订单号、客户、业务、Apple ID、平台订单号"
        @search="handleSearch"
        @refresh="loadActivations"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.renewalDecision"
            class="table-toolbar__select"
            clearable
            placeholder="续费决定"
            @change="handleSearch"
          >
            <el-option
              v-for="item in renewalDecisionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="quickDate"
            class="table-toolbar__select"
            clearable
            placeholder="到期时间"
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
        :data="activations"
        :size="tableSize"
        row-key="id"
        empty-text="暂无开通记录"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column v-if="isColumnVisible('order')" label="订单/客户" min-width="190">
          <template #default="{ row }">
            <strong>{{ row.order.orderNo }}</strong>
            <div class="muted-block">{{ row.customer.name }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务" min-width="150">
          <template #default="{ row }">{{ row.service.name }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="170">
          <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('plan')" label="套餐" min-width="150">
          <template #default="{ row }">
            {{ row.currentPlan ?? '-' }} -> {{ row.targetPlan ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('amounts')"
          prop="profitAmount"
          label="消耗/成本/利润"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.consumedValue }} {{ row.currency }} / {{ row.costRmb }} /
            {{ row.profitAmount }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expireTime')"
          prop="expireTime"
          label="到期"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatDate(row.expireTime) }}
            <el-tag
              v-if="row.daysUntilExpire !== null && row.daysUntilExpire !== undefined"
              class="tag-gap"
              :type="getExpireTagType(row.daysUntilExpire)"
              size="small"
              effect="light"
            >
              {{ getExpireText(row.daysUntilExpire) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('renewalDecision')"
          prop="renewalDecision"
          label="续费"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag size="small" effect="light">{{
              getRenewalDecisionLabel(row.renewalDecision)
            }}</el-tag>
          </template>
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
        <el-table-column
          v-if="isColumnVisible('createdAt')"
          prop="createdAt"
          label="创建时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
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
          @current-change="loadActivations"
          @size-change="loadActivations"
        />
      </div>
    </section>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="
        selectedActivation ? `开通记录 · ${selectedActivation.order.orderNo}` : '开通记录详情'
      "
      confirm-text="刷新详情"
      @confirm="refreshDetail"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>客户</span>
          <strong>{{ selectedActivation?.customer.name ?? '-' }}</strong>
        </div>
        <div>
          <span>业务</span>
          <strong>{{ selectedActivation?.service.name ?? '-' }}</strong>
        </div>
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedActivation?.appleAccount?.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>消耗</span>
          <strong>
            {{ selectedActivation?.consumedValue ?? '-' }}
            {{ selectedActivation?.currency ?? '' }}
          </strong>
        </div>
        <div>
          <span>成本</span>
          <strong>{{ selectedActivation?.costRmb ?? '-' }}</strong>
        </div>
        <div>
          <span>利润</span>
          <strong>{{ selectedActivation?.profitAmount ?? '-' }}</strong>
        </div>
      </div>

      <el-descriptions class="detail-descriptions" :column="1" border>
        <el-descriptions-item label="开通记录 ID">
          {{ selectedActivation?.id ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="订单号">
          {{ selectedActivation?.order.orderNo ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="来源平台">
          {{ selectedActivation?.sourcePlatform?.name ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="平台订单号">
          {{ selectedActivation?.externalOrderNo ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="套餐">
          {{ selectedActivation?.currentPlan ?? '-' }} ->
          {{ selectedActivation?.targetPlan ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="开通/到期">
          {{ formatDate(selectedActivation?.startTime) }} ->
          {{ formatDate(selectedActivation?.expireTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="消费时平均成本">
          {{ selectedActivation?.avgUnitCost ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="实收/手续费/损耗">
          {{ selectedActivation?.paidAmount ?? '-' }} /
          {{ selectedActivation?.platformFee ?? '-' }} /
          {{ selectedActivation?.refundLoss ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="自动续费">
          {{ getAutoRenewStatusLabel(selectedActivation?.autoRenewStatus) }}
        </el-descriptions-item>
        <el-descriptions-item label="续费决定">
          {{ getRenewalDecisionLabel(selectedActivation?.renewalDecision) }}
        </el-descriptions-item>
        <el-descriptions-item label="续费备注">
          {{ selectedActivation?.renewalNote ?? '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { appleActivationsApi, userTableViewsApi } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { ServiceActivation, TableDensity, UserTableView } from '@/types/system';

const loading = ref(false);
const detailDrawerVisible = ref(false);
const activations = ref<ServiceActivation[]>([]);
const selectedActivations = ref<ServiceActivation[]>([]);
const selectedActivation = ref<ServiceActivation | null>(null);
const total = ref(0);
const quickDate = ref('');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const tableKey = 'apple_activations';

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  renewalDecision: '',
  expireFrom: '',
  expireTo: ''
});

const statusOptions: Array<{ label: string; value: ServiceActivation['status'] }> = [
  { label: '开通中', value: 'active' },
  { label: '已到期', value: 'expired' },
  { label: '已取消', value: 'cancelled' },
  { label: '异常', value: 'abnormal' }
];

const renewalDecisionOptions: Array<{
  label: string;
  value: ServiceActivation['renewalDecision'];
}> = [
  { label: '未确认', value: 'unconfirmed' },
  { label: '续费', value: 'renew' },
  { label: '不续费', value: 'no_renew' },
  { label: '换套餐', value: 'change_plan' }
];

const quickDateOptions = [
  { label: '近7天到期', value: 'next7' },
  { label: '近30天到期', value: 'next30' },
  { label: '已过期', value: 'expired' }
];

const activationColumnOptions = [
  { label: '订单/客户', value: 'order', required: true },
  { label: '业务', value: 'service' },
  { label: 'Apple ID', value: 'appleAccount' },
  { label: '套餐', value: 'plan' },
  { label: '消耗/成本/利润', value: 'amounts' },
  { label: '到期', value: 'expireTime' },
  { label: '续费', value: 'renewalDecision' },
  { label: '状态', value: 'status' },
  { label: '创建时间', value: 'createdAt' }
];

const batchActions = [{ label: '批量导出', value: 'export' }];

const activeCount = computed(
  () => activations.value.filter((activation) => activation.status === 'active').length
);
const expiringSoonCount = computed(
  () =>
    activations.value.filter(
      (activation) =>
        activation.daysUntilExpire !== null &&
        activation.daysUntilExpire !== undefined &&
        activation.daysUntilExpire >= 0 &&
        activation.daysUntilExpire <= 7
    ).length
);
const sumProfit = computed(() =>
  activations.value.reduce((sum, activation) => sum + Number(activation.profitAmount), 0).toFixed(2)
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const renewalDecisionLabel = renewalDecisionOptions.find(
    (item) => item.value === query.renewalDecision
  )?.label;
  const quickDateLabel = quickDateOptions.find((item) => item.value === quickDate.value)?.label;

  if (query.renewalDecision && renewalDecisionLabel) {
    chips.push({ key: 'renewalDecision', label: '续费决定', value: renewalDecisionLabel });
  }
  if (quickDate.value && quickDateLabel) {
    chips.push({ key: 'quickDate', label: '到期时间', value: quickDateLabel });
  }

  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function applyQuickDate() {
  const now = new Date();
  query.expireFrom = '';
  query.expireTo = '';
  query.page = 1;

  if (quickDate.value === 'next7') {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    query.expireFrom = formatDateOnly(now);
    query.expireTo = formatDateOnly(next);
  }

  if (quickDate.value === 'next30') {
    const next = new Date(now);
    next.setDate(next.getDate() + 30);
    query.expireFrom = formatDateOnly(now);
    query.expireTo = formatDateOnly(next);
  }

  if (quickDate.value === 'expired') {
    query.expireTo = formatDateOnly(now);
  }

  await loadActivations();
}

function getStatusLabel(status?: ServiceActivation['status']) {
  if (!status) {
    return '-';
  }

  return {
    active: '开通中',
    expired: '已到期',
    cancelled: '已取消',
    abnormal: '异常'
  }[status];
}

function getStatusType(status: ServiceActivation['status']) {
  return status === 'active'
    ? 'success'
    : status === 'expired'
      ? 'warning'
      : status === 'abnormal'
        ? 'danger'
        : 'info';
}

function getRenewalDecisionLabel(value?: ServiceActivation['renewalDecision']) {
  if (!value) {
    return '-';
  }

  return {
    unconfirmed: '未确认',
    renew: '续费',
    no_renew: '不续费',
    change_plan: '换套餐'
  }[value];
}

function getAutoRenewStatusLabel(value?: ServiceActivation['autoRenewStatus']) {
  if (!value) {
    return '-';
  }

  return {
    enabled: '已开启',
    disabled: '已关闭',
    unknown: '未知'
  }[value];
}

function getExpireText(days: number) {
  if (days < 0) {
    return `已过期 ${Math.abs(days)} 天`;
  }

  if (days === 0) {
    return '今天到期';
  }

  return `${days} 天后`;
}

function getExpireTagType(days: number) {
  if (days < 0) {
    return 'danger';
  }

  return days <= 7 ? 'warning' : 'info';
}

async function loadActivations() {
  loading.value = true;
  try {
    const data = await appleActivationsApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      renewalDecision: query.renewalDecision || undefined,
      expireFrom: query.expireFrom || undefined,
      expireTo: query.expireTo || undefined,
      sortBy: sortConfig.value.prop,
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    activations.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载开通记录失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadActivations();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadActivations();
}

function handleSelectionChange(rows: ServiceActivation[]) {
  selectedActivations.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.renewalDecision = '';
  quickDate.value = '';
  query.expireFrom = '';
  query.expireTo = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'renewalDecision') {
    query.renewalDecision = '';
  }
  if (key === 'quickDate') {
    quickDate.value = '';
    query.expireFrom = '';
    query.expireTo = '';
  }
}

function exportList() {
  ElMessage.info('Apple ID 开通记录导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 开通记录视图', {
      inputValue: 'Apple ID 开通记录常用视图',
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
        renewalDecision: query.renewalDecision,
        quickDate: quickDate.value,
        expireFrom: query.expireFrom,
        expireTo: query.expireTo
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : activationColumnOptions.map((column) => column.value),
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
  await loadActivations();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.renewalDecision =
    typeof filters.renewalDecision === 'string' ? filters.renewalDecision : '';
  quickDate.value = typeof filters.quickDate === 'string' ? filters.quickDate : '';
  query.expireFrom = typeof filters.expireFrom === 'string' ? filters.expireFrom : '';
  query.expireTo = typeof filters.expireTo === 'string' ? filters.expireTo : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        activationColumnOptions.some((option) => option.value === column)
      )
    : activationColumnOptions.map((column) => column.value);
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

async function openDetail(activation: ServiceActivation) {
  selectedActivation.value = activation;
  detailDrawerVisible.value = true;
}

async function refreshDetail() {
  if (!selectedActivation.value) {
    return;
  }

  try {
    selectedActivation.value = await appleActivationsApi.get(selectedActivation.value.id);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新开通记录详情失败');
  }
}

async function initializePage() {
  await loadTableViews(true);
  await loadActivations();
}

onMounted(initializePage);
</script>
