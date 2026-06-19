<template>
  <PageScaffold :title="title" group="Apple ID 业务" :phase="phase" :description="description">
    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="订单数"
        :value="report.summary.orderCount"
        hint="当前筛选范围"
        tone="blue"
      />
      <MetricCard
        label="销售额"
        :value="report.summary.paidAmount"
        hint="实收金额合计"
        tone="green"
      />
      <MetricCard
        label="Apple 成本"
        :value="report.summary.appleCostRmb"
        hint="余额成本消耗"
        tone="orange"
      />
      <MetricCard
        label="利润"
        :value="report.summary.profitAmount"
        hint="扣除手续费和损耗"
        tone="red"
      />
    </div>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="平台手续费"
        :value="report.summary.platformFee"
        hint="当前范围合计"
        tone="purple"
      />
      <MetricCard
        label="退款损耗"
        :value="report.summary.refundLoss"
        hint="订单退款损耗"
        tone="orange"
      />
      <MetricCard
        label="毛利率"
        :value="`${report.summary.grossMarginRate}%`"
        hint="利润 / 销售额"
        tone="green"
      />
      <MetricCard
        label="单均利润"
        :value="report.summary.averageOrderProfit"
        hint="利润 / 订单数"
        tone="blue"
      />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:date-shortcut="quickDate"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="reportColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :show-primary="false"
        placeholder="搜索订单号、客户、业务、Apple ID"
        @search="handleSearch"
        @refresh="loadReport"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
      >
        <template #filters>
          <el-input
            v-model.trim="query.dateFrom"
            class="table-toolbar__select"
            placeholder="开始日期 YYYY-MM-DD"
            clearable
            @focus="quickDate = 'custom'"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-input
            v-model.trim="query.dateTo"
            class="table-toolbar__select"
            placeholder="结束日期 YYYY-MM-DD"
            clearable
            @focus="quickDate = 'custom'"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </template>
      </TableToolbar>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="按日期对账" name="daily">
          <el-table
            v-if="activeTab === 'daily'"
            v-loading="loading"
            :data="report.daily"
            :size="tableSize"
            row-key="key"
            empty-text="暂无日期对账数据"
          >
            <el-table-column
              v-if="isColumnVisible('label')"
              prop="label"
              label="日期"
              min-width="190"
            />
            <el-table-column
              v-if="isColumnVisible('orderCount')"
              prop="orderCount"
              label="订单数"
              width="90"
            />
            <el-table-column
              v-if="isColumnVisible('paidAmount')"
              prop="paidAmount"
              label="销售额"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('platformFee')"
              prop="platformFee"
              label="手续费"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('refundLoss')"
              prop="refundLoss"
              label="退款损耗"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('appleCostRmb')"
              prop="appleCostRmb"
              label="成本"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('profitAmount')"
              prop="profitAmount"
              label="利润"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('grossMarginRate')"
              prop="grossMarginRate"
              label="毛利率%"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('averageOrderProfit')"
              prop="averageOrderProfit"
              label="单均利润"
              width="110"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="按业务" name="service">
          <el-table
            v-if="activeTab === 'service'"
            v-loading="loading"
            :data="report.byService"
            :size="tableSize"
            row-key="key"
            empty-text="暂无业务报表数据"
          >
            <el-table-column
              v-if="isColumnVisible('label')"
              prop="label"
              label="业务"
              min-width="190"
            />
            <el-table-column
              v-if="isColumnVisible('orderCount')"
              prop="orderCount"
              label="订单数"
              width="90"
            />
            <el-table-column
              v-if="isColumnVisible('paidAmount')"
              prop="paidAmount"
              label="销售额"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('platformFee')"
              prop="platformFee"
              label="手续费"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('refundLoss')"
              prop="refundLoss"
              label="退款损耗"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('appleCostRmb')"
              prop="appleCostRmb"
              label="成本"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('profitAmount')"
              prop="profitAmount"
              label="利润"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('grossMarginRate')"
              prop="grossMarginRate"
              label="毛利率%"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('averageOrderProfit')"
              prop="averageOrderProfit"
              label="单均利润"
              width="110"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="按来源平台" name="source">
          <el-table
            v-if="activeTab === 'source'"
            v-loading="loading"
            :data="report.bySourcePlatform"
            :size="tableSize"
            row-key="key"
            empty-text="暂无来源平台报表数据"
          >
            <el-table-column
              v-if="isColumnVisible('label')"
              prop="label"
              label="来源平台"
              min-width="190"
            />
            <el-table-column
              v-if="isColumnVisible('orderCount')"
              prop="orderCount"
              label="订单数"
              width="90"
            />
            <el-table-column
              v-if="isColumnVisible('paidAmount')"
              prop="paidAmount"
              label="销售额"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('platformFee')"
              prop="platformFee"
              label="手续费"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('refundLoss')"
              prop="refundLoss"
              label="退款损耗"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('appleCostRmb')"
              prop="appleCostRmb"
              label="成本"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('profitAmount')"
              prop="profitAmount"
              label="利润"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('grossMarginRate')"
              prop="grossMarginRate"
              label="毛利率%"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('averageOrderProfit')"
              prop="averageOrderProfit"
              label="单均利润"
              width="110"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="按 Apple ID" name="account">
          <el-table
            v-if="activeTab === 'account'"
            v-loading="loading"
            :data="report.byAppleAccount"
            :size="tableSize"
            row-key="key"
            empty-text="暂无 Apple ID 报表数据"
          >
            <el-table-column
              v-if="isColumnVisible('label')"
              prop="label"
              label="Apple ID"
              min-width="190"
            />
            <el-table-column
              v-if="isColumnVisible('orderCount')"
              prop="orderCount"
              label="订单数"
              width="90"
            />
            <el-table-column
              v-if="isColumnVisible('paidAmount')"
              prop="paidAmount"
              label="销售额"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('platformFee')"
              prop="platformFee"
              label="手续费"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('refundLoss')"
              prop="refundLoss"
              label="退款损耗"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('appleCostRmb')"
              prop="appleCostRmb"
              label="成本"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('profitAmount')"
              prop="profitAmount"
              label="利润"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('grossMarginRate')"
              prop="grossMarginRate"
              label="毛利率%"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('averageOrderProfit')"
              prop="averageOrderProfit"
              label="单均利润"
              width="110"
            />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="最近订单" name="recent">
          <el-table
            v-if="activeTab === 'recent'"
            v-loading="loading"
            :data="report.recentOrders"
            :size="tableSize"
            row-key="id"
            empty-text="暂无最近订单"
          >
            <el-table-column v-if="isColumnVisible('recentOrder')" label="订单" min-width="150">
              <template #default="{ row }">
                <strong>{{ row.orderNo }}</strong>
                <div class="muted-block">{{ formatDate(row.createdAt) }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible('recentService')"
              label="业务/平台"
              min-width="180"
            >
              <template #default="{ row }">
                {{ row.serviceName ?? '-' }}
                <div class="muted-block">{{ row.sourcePlatformName ?? '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible('recentAppleAccount')"
              label="Apple ID"
              min-width="170"
            >
              <template #default="{ row }">{{ row.appleAccountMasked ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible('paidAmount')"
              prop="paidAmount"
              label="销售额"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('platformFee')"
              prop="platformFee"
              label="手续费"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('refundLoss')"
              prop="refundLoss"
              label="退款损耗"
              width="110"
            />
            <el-table-column
              v-if="isColumnVisible('appleCostRmb')"
              prop="appleCostRmb"
              label="成本"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('profitAmount')"
              prop="profitAmount"
              label="利润"
              width="100"
            />
            <el-table-column v-if="isColumnVisible('recentStatus')" label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="getOrderStatusType(row.status)" size="small" effect="light">
                  {{ getOrderStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { appleReportsApi, userTableViewsApi, type AppleProfitReportQuery } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { AppleOrder, AppleProfitReport, TableDensity, UserTableView } from '@/types/system';

const props = withDefaults(
  defineProps<{
    title: string;
    description: string;
    phase?: string;
    defaultTab?: 'daily' | 'service' | 'source' | 'account' | 'recent';
  }>(),
  {
    phase: 'Phase 4',
    defaultTab: 'daily'
  }
);

const tableKey = props.defaultTab === 'daily' ? 'apple_finance_report' : 'apple_profit_report';
const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已开通', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
  { label: '异常', value: 'abnormal' }
];
const reportColumnOptions = [
  { label: '维度/订单', value: 'label', required: true },
  { label: '订单数', value: 'orderCount' },
  { label: '销售额', value: 'paidAmount' },
  { label: '手续费', value: 'platformFee' },
  { label: '退款损耗', value: 'refundLoss' },
  { label: '成本', value: 'appleCostRmb' },
  { label: '利润', value: 'profitAmount' },
  { label: '毛利率%', value: 'grossMarginRate' },
  { label: '单均利润', value: 'averageOrderProfit' },
  { label: '最近订单', value: 'recentOrder' },
  { label: '最近订单业务/平台', value: 'recentService' },
  { label: '最近订单 Apple ID', value: 'recentAppleAccount' },
  { label: '最近订单状态', value: 'recentStatus' }
];

const loading = ref(false);
const activeTab = ref(props.defaultTab);
const quickDate = ref('last_30_days');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const query = reactive<AppleProfitReportQuery>({
  dateFrom: '',
  dateTo: '',
  keyword: '',
  status: ''
});
const report = ref<AppleProfitReport>(createEmptyReport());

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  if (quickDate.value !== 'custom' || (!query.dateFrom && !query.dateTo)) {
    return [];
  }

  return [
    {
      key: 'dateRange',
      label: '自定义日期',
      value: `${query.dateFrom || '不限'} ~ ${query.dateTo || '不限'}`
    }
  ];
});

onMounted(initializePage);

async function loadReport() {
  loading.value = true;
  try {
    report.value = await appleReportsApi.profit({
      ...query,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 报表失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  if (quickDate.value !== 'custom') {
    applyQuickDate(false);
  }
  await loadReport();
}

function applyQuickDate(shouldLoad = true) {
  if (quickDate.value === 'custom') {
    if (shouldLoad) {
      loadReport();
    }
    return;
  }

  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (quickDate.value === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (quickDate.value === 'last_7_days') {
    start.setDate(start.getDate() - 6);
  } else if (quickDate.value === 'last_30_days') {
    start.setDate(start.getDate() - 29);
  } else if (quickDate.value === 'this_month') {
    start.setDate(1);
  } else if (quickDate.value === 'last_month') {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(1);
    end.setDate(0);
  }

  query.dateFrom = toDateInput(start);
  query.dateTo = toDateInput(end);
  if (shouldLoad) {
    loadReport();
  }
}

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getOrderStatusLabel(status: AppleOrder['status']) {
  const labels: Record<AppleOrder['status'], string> = {
    pending: '待处理',
    active: '已开通',
    completed: '已完成',
    cancelled: '已取消',
    abnormal: '异常'
  };
  return labels[status] ?? status;
}

function getOrderStatusType(status: AppleOrder['status']) {
  const types: Record<AppleOrder['status'], 'success' | 'warning' | 'danger' | 'info' | 'primary'> =
    {
      pending: 'warning',
      active: 'success',
      completed: 'success',
      cancelled: 'info',
      abnormal: 'danger'
    };
  return types[status] ?? 'info';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function clearFilters() {
  query.keyword = '';
  query.status = '';
  query.dateFrom = '';
  query.dateTo = '';
  quickDate.value = 'last_30_days';
  density.value = 'default';
  savedViewId.value = '';
}

function removeFilter(key: string) {
  if (key === 'dateRange') {
    query.dateFrom = '';
    query.dateTo = '';
    quickDate.value = 'last_30_days';
  }
}

function exportList() {
  ElMessage.info('Apple ID 报表导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 报表视图', {
      inputValue: props.defaultTab === 'daily' ? 'Apple ID 财务对账视图' : 'Apple ID 报表视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey,
      viewName: value.trim(),
      filters: {
        activeTab: activeTab.value,
        quickDate: quickDate.value,
        keyword: query.keyword,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      },
      sortConfig: {},
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : reportColumnOptions.map((column) => column.value),
      density: density.value,
      pageSize: 20,
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
  await handleSearch();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  activeTab.value = isReportTab(filters.activeTab) ? filters.activeTab : props.defaultTab;
  quickDate.value = isDateShortcut(filters.quickDate) ? filters.quickDate : 'last_30_days';
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isOrderStatus(filters.status) ? filters.status : '';
  query.dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : '';
  query.dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : '';
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) => reportColumnOptions.some((option) => option.value === column))
    : reportColumnOptions.map((column) => column.value);
  savedViewId.value = view.id;
}

async function initializePage() {
  await loadTableViews(true);
  await handleSearch();
}

function isOrderStatus(value: unknown): value is AppleProfitReportQuery['status'] {
  return (
    value === '' ||
    value === 'pending' ||
    value === 'active' ||
    value === 'completed' ||
    value === 'cancelled' ||
    value === 'abnormal'
  );
}

function isDateShortcut(value: unknown): value is string {
  return (
    value === 'today' ||
    value === 'yesterday' ||
    value === 'last_7_days' ||
    value === 'last_30_days' ||
    value === 'this_month' ||
    value === 'last_month' ||
    value === 'custom'
  );
}

function isReportTab(value: unknown): value is typeof activeTab.value {
  return (
    value === 'daily' ||
    value === 'service' ||
    value === 'source' ||
    value === 'account' ||
    value === 'recent'
  );
}

function createEmptyReport(): AppleProfitReport {
  return {
    summary: {
      orderCount: 0,
      paidAmount: '0.00',
      platformFee: '0.00',
      refundLoss: '0.00',
      appleCostRmb: '0.0000',
      profitAmount: '0.0000',
      grossMarginRate: '0.00',
      averageOrderProfit: '0.0000'
    },
    daily: [],
    byService: [],
    bySourcePlatform: [],
    byAppleAccount: [],
    recentOrders: []
  };
}
</script>
