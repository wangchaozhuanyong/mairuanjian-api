<template>
  <PageScaffold
    title="兑换码报表"
    group="兑换码自动发货"
    phase="Phase 6"
    description="独立统计兑换码销售、成本、退款、售后损耗和净利润。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="订单数"
        :value="report.summary.orderCount"
        hint="当前筛选范围"
        tone="blue"
      />
      <MetricCard label="销售额" :value="report.summary.paidAmount" hint="实收金额" tone="green" />
      <MetricCard
        label="兑换码成本"
        :value="report.summary.costAmount"
        hint="含补发成本"
        tone="orange"
      />
      <MetricCard
        label="净利润"
        :value="report.summary.netProfitAmount"
        hint="扣除退款"
        tone="red"
      />
    </div>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="发货码数"
        :value="report.summary.codeCount"
        hint="已发/补发数量"
        tone="purple"
      />
      <MetricCard
        label="售后单"
        :value="report.summary.afterSaleCount"
        hint="补发记录数"
        tone="orange"
      />
      <MetricCard
        label="退款金额"
        :value="report.summary.refundAmount"
        hint="非拒绝退款"
        tone="red"
      />
      <MetricCard
        label="毛利率"
        :value="`${report.summary.grossMarginRate}%`"
        hint="净利润 / 销售额"
        tone="green"
      />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.deliveryStatus"
        v-model:date-shortcut="quickDate"
        v-model:density="density"
        v-model:visible-columns="reportVisibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="reportColumnOptions"
        :status-options="deliveryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :show-primary="false"
        placeholder="搜索订单号、商品、SKU、业务、平台"
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
        <el-tab-pane label="按日期" name="daily">
          <ReportTable
            :loading="loading"
            :items="report.daily"
            :table-size="tableSize"
            :visible-columns="reportVisibleColumns"
            first-label="日期"
          />
        </el-tab-pane>
        <el-tab-pane label="按业务" name="service">
          <ReportTable
            :loading="loading"
            :items="report.byService"
            :table-size="tableSize"
            :visible-columns="reportVisibleColumns"
            first-label="业务"
          />
        </el-tab-pane>
        <el-tab-pane label="按平台" name="platform">
          <ReportTable
            :loading="loading"
            :items="report.byPlatform"
            :table-size="tableSize"
            :visible-columns="reportVisibleColumns"
            first-label="平台"
          />
        </el-tab-pane>
        <el-tab-pane label="最近订单" name="recent">
          <el-table
            v-loading="loading"
            :data="report.recentOrders"
            :size="tableSize"
            row-key="id"
            empty-text="暂无最近订单"
          >
            <el-table-column v-if="isColumnVisible('recentOrder')" label="订单" min-width="170">
              <template #default="{ row }">
                {{ row.externalOrderNo }}
                <div class="muted-block">{{ formatDate(row.createdAt) }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isColumnVisible('recentService')"
              label="业务/平台"
              min-width="190"
            >
              <template #default="{ row }">
                {{ row.serviceName ?? '-' }}
                <div class="muted-block">{{ row.platformName }}</div>
              </template>
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
              v-if="isColumnVisible('costAmount')"
              prop="costAmount"
              label="成本"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('refundAmount')"
              prop="refundAmount"
              label="退款"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('netProfitAmount')"
              prop="netProfitAmount"
              label="净利润"
              width="100"
            />
            <el-table-column
              v-if="isColumnVisible('recentDeliveryStatus')"
              label="发货"
              width="100"
            >
              <template #default="{ row }">
                <el-tag :type="getDeliveryStatusType(row.deliveryStatus)" size="small">
                  {{ getDeliveryStatusLabel(row.deliveryStatus) }}
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
import { ElMessage, ElMessageBox, ElTable, ElTableColumn } from 'element-plus';
import type { PropType } from 'vue';
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue';
import { codeReportsApi, userTableViewsApi, type CodeProfitReportQuery } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  CodePlatformOrder,
  CodeProfitGroup,
  CodeProfitReport,
  TableDensity,
  UserTableView
} from '@/types/system';

const ReportTable = defineComponent({
  props: {
    loading: {
      type: Boolean,
      required: true
    },
    items: {
      type: Array as PropType<CodeProfitGroup[]>,
      required: true
    },
    firstLabel: {
      type: String,
      required: true
    },
    tableSize: {
      type: String as PropType<'default' | 'small' | 'large'>,
      required: true
    },
    visibleColumns: {
      type: Array as PropType<string[]>,
      required: true
    }
  },
  setup(props) {
    const isVisible = (column: string) =>
      props.visibleColumns.length ? props.visibleColumns.includes(column) : true;

    return () =>
      h(
        ElTable,
        {
          loading: props.loading,
          data: props.items,
          size: props.tableSize,
          emptyText: `暂无${props.firstLabel}报表数据`,
          rowKey: 'key'
        },
        {
          default: () => [
            isVisible('label') &&
              h(ElTableColumn, { prop: 'label', label: props.firstLabel, minWidth: 180 }),
            isVisible('orderCount') &&
              h(ElTableColumn, { prop: 'orderCount', label: '订单数', width: 90 }),
            isVisible('codeCount') &&
              h(ElTableColumn, { prop: 'codeCount', label: '码数', width: 90 }),
            isVisible('paidAmount') &&
              h(ElTableColumn, { prop: 'paidAmount', label: '销售额', width: 110 }),
            isVisible('platformFee') &&
              h(ElTableColumn, { prop: 'platformFee', label: '手续费', width: 100 }),
            isVisible('costAmount') &&
              h(ElTableColumn, { prop: 'costAmount', label: '成本', width: 100 }),
            isVisible('refundAmount') &&
              h(ElTableColumn, { prop: 'refundAmount', label: '退款', width: 100 }),
            isVisible('netProfitAmount') &&
              h(ElTableColumn, { prop: 'netProfitAmount', label: '净利润', width: 110 }),
            isVisible('grossMarginRate') &&
              h(ElTableColumn, { prop: 'grossMarginRate', label: '毛利率%', width: 110 }),
            isVisible('averageOrderProfit') &&
              h(ElTableColumn, { prop: 'averageOrderProfit', label: '单均利润', width: 110 })
          ]
        }
      );
  }
});

const tableKey = 'code_profit_report';
const deliveryStatusOptions = [
  { label: '待发货', value: 'pending' },
  { label: '已发货', value: 'delivered' },
  { label: '失败', value: 'failed' },
  { label: '人工', value: 'manual' }
];
const reportColumnOptions = [
  { label: '维度/订单', value: 'label', required: true },
  { label: '订单数', value: 'orderCount' },
  { label: '码数', value: 'codeCount' },
  { label: '销售额', value: 'paidAmount' },
  { label: '手续费', value: 'platformFee' },
  { label: '成本', value: 'costAmount' },
  { label: '退款', value: 'refundAmount' },
  { label: '净利润', value: 'netProfitAmount' },
  { label: '毛利率%', value: 'grossMarginRate' },
  { label: '单均利润', value: 'averageOrderProfit' },
  { label: '最近订单', value: 'recentOrder' },
  { label: '最近订单业务/平台', value: 'recentService' },
  { label: '最近订单发货', value: 'recentDeliveryStatus' }
];

const loading = ref(false);
const activeTab = ref('daily');
const quickDate = ref('last_30_days');
const density = ref<TableDensity>('default');
const reportVisibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const query = reactive<CodeProfitReportQuery>({
  dateFrom: '',
  dateTo: '',
  keyword: '',
  deliveryStatus: ''
});
const report = ref<CodeProfitReport>(createEmptyReport());

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
    report.value = await codeReportsApi.profit({
      ...query,
      keyword: query.keyword || undefined,
      deliveryStatus: query.deliveryStatus || undefined,
      dateFrom: query.dateFrom || undefined,
      dateTo: query.dateTo || undefined
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码报表失败');
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

function getDeliveryStatusLabel(status: CodePlatformOrder['deliveryStatus']) {
  const labels: Record<CodePlatformOrder['deliveryStatus'], string> = {
    pending: '待发货',
    delivered: '已发货',
    failed: '失败',
    manual: '人工'
  };
  return labels[status];
}

function getDeliveryStatusType(status: CodePlatformOrder['deliveryStatus']) {
  if (status === 'delivered') {
    return 'success';
  }
  if (status === 'pending') {
    return 'warning';
  }
  if (status === 'failed') {
    return 'danger';
  }
  return 'info';
}

function isColumnVisible(column: string) {
  return reportVisibleColumns.value.length ? reportVisibleColumns.value.includes(column) : true;
}

function clearFilters() {
  query.keyword = '';
  query.deliveryStatus = '';
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
  ElMessage.info('兑换码报表导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存兑换码报表视图', {
      inputValue: '兑换码报表常用视图',
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
        deliveryStatus: query.deliveryStatus,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      },
      sortConfig: {},
      columns: reportVisibleColumns.value.length
        ? reportVisibleColumns.value
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
  activeTab.value = isReportTab(filters.activeTab) ? filters.activeTab : 'daily';
  quickDate.value = isDateShortcut(filters.quickDate) ? filters.quickDate : 'last_30_days';
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.deliveryStatus = isDeliveryStatus(filters.deliveryStatus) ? filters.deliveryStatus : '';
  query.dateFrom = typeof filters.dateFrom === 'string' ? filters.dateFrom : '';
  query.dateTo = typeof filters.dateTo === 'string' ? filters.dateTo : '';
  density.value = view.density;
  reportVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) => reportColumnOptions.some((option) => option.value === column))
    : reportColumnOptions.map((column) => column.value);
  savedViewId.value = view.id;
}

async function initializePage() {
  await loadTableViews(true);
  await handleSearch();
}

function isDeliveryStatus(value: unknown): value is CodeProfitReportQuery['deliveryStatus'] {
  return (
    value === '' ||
    value === 'pending' ||
    value === 'delivered' ||
    value === 'failed' ||
    value === 'manual'
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
  return value === 'daily' || value === 'service' || value === 'platform' || value === 'recent';
}

function createEmptyReport(): CodeProfitReport {
  return {
    summary: {
      orderCount: 0,
      codeCount: 0,
      afterSaleCount: 0,
      paidAmount: '0.00',
      platformFee: '0.00',
      costAmount: '0.00',
      refundAmount: '0.00',
      profitAmount: '0.00',
      netProfitAmount: '0.00',
      grossMarginRate: '0.00',
      averageOrderProfit: '0.00'
    },
    daily: [],
    byService: [],
    byPlatform: [],
    recentOrders: []
  };
}
</script>
