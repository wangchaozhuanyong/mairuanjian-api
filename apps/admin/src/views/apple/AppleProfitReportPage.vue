<template>
  <PageScaffold :title="title" group="Apple ID 业务" :phase="phase" :description="description">
    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row report-panel-title">
        <div>
          <h3>
            报表明细
            <FeatureHelp
              placement="right"
              text="这里看 Apple ID 业务到底赚不赚钱。销售额是客户给的钱，成本是用掉的 Apple 余额折成人民币，手续费和退款会一起扣掉。"
            />
          </h3>
          <p>按当前筛选范围聚合销售额、手续费、余额成本和利润。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>{{ activeTabLabel }}</StatusChip>
          <StatusChip tone="blue">订单 {{ report.summary.orderCount }}</StatusChip>
          <StatusChip tone="green">销售额 {{ report.summary.paidAmount }}</StatusChip>
          <StatusChip tone="orange">成本 {{ report.summary.appleCostRmb }}</StatusChip>
          <StatusChip tone="purple">利润 {{ report.summary.profitAmount }}</StatusChip>
          <StatusChip tone="cyan">毛利率 {{ report.summary.grossMarginRate }}%</StatusChip>
          <StatusChip :tone="reportRiskCount > 0 ? 'orange' : 'green'">
            {{ reportRiskCount > 0 ? `需关注 ${reportRiskCount}` : '口径稳定' }}
          </StatusChip>
        </div>
      </div>

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

      <el-tabs v-model="activeTab" class="report-table-tabs">
        <el-tab-pane label="按日期对账" name="daily">
          <el-table
            v-if="activeTab === 'daily'"
            v-loading="loading"
            class="desktop-data-table"
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
            class="desktop-data-table"
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
            class="desktop-data-table"
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
            class="desktop-data-table"
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
            class="desktop-data-table"
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
                <StatusChip :tone="getOrderStatusTone(row.status)" dot>
                  {{ getOrderStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <div
        v-if="activeTab !== 'recent'"
        class="mobile-record-list"
        aria-label="Apple ID 报表移动列表"
      >
        <article v-for="item in activeGroupRows" :key="item.key" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ item.label }}</strong>
              <span>{{ activeTabLabel }}</span>
            </div>
            <StatusChip :tone="getMarginTone(item.grossMarginRate)" dot>
              {{ item.grossMarginRate }}%
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>订单数</span>
              <strong>{{ item.orderCount }}</strong>
            </div>
            <div>
              <span>销售额</span>
              <strong>{{ item.paidAmount }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ item.profitAmount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>Apple 成本</span>
              <strong>{{ item.appleCostRmb }}</strong>
            </div>
            <div>
              <span>平台手续费 / 退款损耗</span>
              <strong>{{ item.platformFee }} / {{ item.refundLoss }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip tone="blue">单均 {{ item.averageOrderProfit }}</StatusChip>
            <StatusChip :tone="item.orderCount > 0 ? 'green' : 'neutral'">
              {{ item.orderCount > 0 ? '有订单' : '无订单' }}
            </StatusChip>
          </div>
        </article>

        <div v-if="!loading && activeGroupRows.length === 0" class="apple-core-empty-state">
          <strong>暂无报表数据</strong>
          <span>可调整日期、状态或关键词后重新查询。</span>
        </div>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 最近订单移动列表">
        <article v-for="order in report.recentOrders" :key="order.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ order.orderNo }}</strong>
              <span>{{ formatDate(order.createdAt) }}</span>
            </div>
            <StatusChip :tone="getOrderStatusTone(order.status)" dot>
              {{ getOrderStatusLabel(order.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>销售额</span>
              <strong>{{ order.paidAmount }}</strong>
            </div>
            <div>
              <span>成本</span>
              <strong>{{ order.appleCostRmb }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ order.profitAmount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>业务 / 平台</span>
              <strong
                >{{ order.serviceName ?? '-' }} / {{ order.sourcePlatformName ?? '-' }}</strong
              >
            </div>
            <div>
              <span>Apple ID</span>
              <strong>{{ order.appleAccountMasked ?? '-' }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip tone="orange">手续费 {{ order.platformFee }}</StatusChip>
            <StatusChip tone="red">损耗 {{ order.refundLoss }}</StatusChip>
          </div>
        </article>

        <div v-if="!loading && report.recentOrders.length === 0" class="apple-core-empty-state">
          <strong>暂无最近订单</strong>
          <span>可切换日期范围或清空筛选后再查看最近订单。</span>
        </div>
      </div>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { appleReportsApi, userTableViewsApi, type AppleProfitReportQuery } from '@/api/system';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  AppleOrder,
  AppleProfitGroup,
  AppleProfitReport,
  TableDensity,
  UserTableView
} from '@/types/system';

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
const activeTabLabel = computed(() => {
  const labels: Record<typeof activeTab.value, string> = {
    daily: '按日期对账',
    service: '按业务',
    source: '按来源平台',
    account: '按 Apple ID',
    recent: '最近订单'
  };
  return labels[activeTab.value] ?? '报表明细';
});
const activeGroupRows = computed<AppleProfitGroup[]>(() => {
  if (activeTab.value === 'daily') {
    return report.value.daily;
  }

  if (activeTab.value === 'service') {
    return report.value.byService;
  }

  if (activeTab.value === 'source') {
    return report.value.bySourcePlatform;
  }

  if (activeTab.value === 'account') {
    return report.value.byAppleAccount;
  }

  return [];
});
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
const reportRiskCount = computed(() => {
  if (activeTab.value === 'recent') {
    return report.value.recentOrders.filter((order) => Number(order.profitAmount) < 0).length;
  }

  return activeGroupRows.value.filter((item) => {
    const rate = Number(item.grossMarginRate);

    return !Number.isNaN(rate) && rate < 20;
  }).length;
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

function getOrderStatusTone(status: AppleOrder['status']) {
  const tones: Record<AppleOrder['status'], 'green' | 'orange' | 'red' | 'neutral' | 'blue'> = {
    pending: 'orange',
    active: 'green',
    completed: 'green',
    cancelled: 'neutral',
    abnormal: 'red'
  };
  return tones[status] ?? 'neutral';
}

function getMarginTone(rate: string) {
  const numericRate = Number(rate);

  if (Number.isNaN(numericRate)) {
    return 'neutral';
  }

  if (numericRate < 0) {
    return 'red';
  }

  if (numericRate < 20) {
    return 'orange';
  }

  return 'green';
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
