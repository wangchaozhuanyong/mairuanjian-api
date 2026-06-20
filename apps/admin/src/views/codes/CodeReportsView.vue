<template>
  <PageScaffold
    title="兑换码报表"
    group="兑换码自动发货"
    phase="Phase 6"
    description="独立统计兑换码销售、成本、退款、售后损耗和净利润。"
  >
    <div class="metric-grid metric-grid--four report-metric-grid">
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

    <div class="apple-core-board-grid">
      <AppCard
        title="兑换码利润口径"
        subtitle="销售、发货、售后补发和退款都在兑换码业务域内独立核算。"
        :tag="activeTabLabel"
        tag-tone="blue"
      >
        <div class="apple-core-summary-list">
          <div class="apple-core-summary-item">
            <div>
              <strong>当前维度</strong>
              <span>表格、移动卡片和保存视图都跟随当前页签。</span>
            </div>
            <em>{{ activeTabLabel }}</em>
          </div>
          <div class="apple-core-summary-item">
            <div>
              <strong>可见记录</strong>
              <span>当前筛选范围内可核对的聚合维度或最近订单。</span>
            </div>
            <em>{{ activeVisibleRecordCount }}</em>
          </div>
          <div class="apple-core-summary-item">
            <div>
              <strong>需关注</strong>
              <span>低毛利维度、负净利订单或售后补发较多的记录。</span>
            </div>
            <em>{{ reportRiskCount }}</em>
          </div>
          <div class="apple-core-summary-item">
            <div>
              <strong>发货码数</strong>
              <span>已发货和售后补发消耗的兑换码数量。</span>
            </div>
            <em>{{ report.summary.codeCount }}</em>
          </div>
          <div class="apple-core-summary-item">
            <div>
              <strong>毛利率</strong>
              <span>净利润 / 销售额，用于判断当前筛选范围的整体质量。</span>
            </div>
            <em>{{ report.summary.grossMarginRate }}%</em>
          </div>
        </div>
      </AppCard>

      <AppCard
        title="库存与售后边界"
        subtitle="兑换码报表不读取 Apple ID 余额，也不生成 Apple ID 开通记录。"
        :tag="reportRiskCount > 0 ? '需复核' : '口径稳定'"
        :tag-tone="reportRiskCount > 0 ? 'orange' : 'green'"
      >
        <div class="apple-core-alert-stack">
          <div class="apple-core-alert apple-core-alert--blue">
            <StatusChip tone="blue">成本</StatusChip>
            <div>
              <strong>成本来自兑换码库存和补发损耗</strong>
              <p>发货码、补发码和退款金额共同影响净利润，平台手续费保留在订单层。</p>
            </div>
          </div>
          <div class="apple-core-alert apple-core-alert--purple">
            <StatusChip tone="purple">隔离</StatusChip>
            <div>
              <strong>兑换码订单不触碰 Apple ID 业务域</strong>
              <p>兑换码订单只消耗兑换码库存，不读取 Apple ID 成本、余额或续费任务。</p>
            </div>
          </div>
          <div class="apple-core-alert apple-core-alert--orange">
            <StatusChip tone="orange">售后</StatusChip>
            <div>
              <strong>
                售后单 {{ report.summary.afterSaleCount }} / 退款 {{ report.summary.refundAmount }}
              </strong>
              <p>补发和退款只进入兑换码利润报表，不影响 Apple ID 余额和移动平均成本。</p>
            </div>
          </div>
          <div
            class="apple-core-alert"
            :class="reportRiskCount > 0 ? 'apple-core-alert--orange' : 'apple-core-alert--green'"
          >
            <StatusChip :tone="reportRiskCount > 0 ? 'orange' : 'green'">
              {{ reportRiskCount > 0 ? '关注' : '稳定' }}
            </StatusChip>
            <div>
              <strong>{{ reportRiskTitle }}</strong>
              <p>{{ reportRiskDescription }}</p>
            </div>
          </div>
        </div>
      </AppCard>
    </div>

    <section class="content-panel">
      <div class="panel-title-row report-panel-title">
        <div>
          <h3>兑换码利润报表明细</h3>
          <p>按当前筛选范围聚合发货、成本、售后补发、退款和净利润。</p>
        </div>
        <StatusChip tone="blue" dot>{{ activeTabLabel }}</StatusChip>
      </div>

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

      <el-tabs v-model="activeTab" class="report-table-tabs">
        <el-tab-pane label="按日期" name="daily">
          <ReportTable
            :loading="loading"
            :items="report.daily"
            :table-size="tableSize"
            :visible-columns="reportVisibleColumns"
            first-label="日期"
          />
          <div v-if="report.daily.length" class="mobile-record-list">
            <article v-for="item in report.daily" :key="item.key" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ item.label }}</strong>
                  <span>订单 {{ item.orderCount }} · 码数 {{ item.codeCount }}</span>
                </div>
                <StatusChip :tone="getMarginTone(item.grossMarginRate)" dot>
                  毛利 {{ item.grossMarginRate }}%
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>销售额</span>
                  <strong>{{ item.paidAmount }}</strong>
                </div>
                <div>
                  <span>成本</span>
                  <strong>{{ item.costAmount }}</strong>
                </div>
                <div>
                  <span>净利润</span>
                  <strong>{{ item.netProfitAmount }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>手续费 / 退款</span>
                  <strong>{{ item.platformFee }} / {{ item.refundAmount }}</strong>
                </div>
                <div>
                  <span>单均利润</span>
                  <strong>{{ item.averageOrderProfit }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无按日期报表数据</strong>
              <span>调整日期或筛选条件后刷新查看。</span>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="按业务" name="service">
          <ReportTable
            :loading="loading"
            :items="report.byService"
            :table-size="tableSize"
            :visible-columns="reportVisibleColumns"
            first-label="业务"
          />
          <div v-if="report.byService.length" class="mobile-record-list">
            <article v-for="item in report.byService" :key="item.key" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ item.label }}</strong>
                  <span>订单 {{ item.orderCount }} · 码数 {{ item.codeCount }}</span>
                </div>
                <StatusChip :tone="getMarginTone(item.grossMarginRate)" dot>
                  毛利 {{ item.grossMarginRate }}%
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>销售额</span>
                  <strong>{{ item.paidAmount }}</strong>
                </div>
                <div>
                  <span>成本</span>
                  <strong>{{ item.costAmount }}</strong>
                </div>
                <div>
                  <span>净利润</span>
                  <strong>{{ item.netProfitAmount }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>手续费 / 退款</span>
                  <strong>{{ item.platformFee }} / {{ item.refundAmount }}</strong>
                </div>
                <div>
                  <span>单均利润</span>
                  <strong>{{ item.averageOrderProfit }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无按业务报表数据</strong>
              <span>调整业务、平台或日期筛选后刷新查看。</span>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="按平台" name="platform">
          <ReportTable
            :loading="loading"
            :items="report.byPlatform"
            :table-size="tableSize"
            :visible-columns="reportVisibleColumns"
            first-label="平台"
          />
          <div v-if="report.byPlatform.length" class="mobile-record-list">
            <article v-for="item in report.byPlatform" :key="item.key" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ item.label }}</strong>
                  <span>订单 {{ item.orderCount }} · 码数 {{ item.codeCount }}</span>
                </div>
                <StatusChip :tone="getMarginTone(item.grossMarginRate)" dot>
                  毛利 {{ item.grossMarginRate }}%
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>销售额</span>
                  <strong>{{ item.paidAmount }}</strong>
                </div>
                <div>
                  <span>成本</span>
                  <strong>{{ item.costAmount }}</strong>
                </div>
                <div>
                  <span>净利润</span>
                  <strong>{{ item.netProfitAmount }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>手续费 / 退款</span>
                  <strong>{{ item.platformFee }} / {{ item.refundAmount }}</strong>
                </div>
                <div>
                  <span>单均利润</span>
                  <strong>{{ item.averageOrderProfit }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无按平台报表数据</strong>
              <span>调整平台、日期或发货状态筛选后刷新查看。</span>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="最近订单" name="recent">
          <el-table
            v-loading="loading"
            class="desktop-data-table"
            :data="report.recentOrders"
            :size="tableSize"
            row-key="id"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无最近订单</strong>
                <span>当前筛选范围内还没有可展示的兑换码订单。</span>
              </div>
            </template>
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
                <StatusChip :tone="getDeliveryStatusTone(row.deliveryStatus)" dot>
                  {{ getDeliveryStatusLabel(row.deliveryStatus) }}
                </StatusChip>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="report.recentOrders.length" class="mobile-record-list">
            <article
              v-for="order in report.recentOrders"
              :key="order.id"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ order.externalOrderNo }}</strong>
                  <span>{{ formatDate(order.createdAt) }}</span>
                </div>
                <StatusChip :tone="getDeliveryStatusTone(order.deliveryStatus)" dot>
                  {{ getDeliveryStatusLabel(order.deliveryStatus) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>销售额</span>
                  <strong>{{ order.paidAmount }}</strong>
                </div>
                <div>
                  <span>成本</span>
                  <strong>{{ order.costAmount }}</strong>
                </div>
                <div>
                  <span>净利润</span>
                  <strong>{{ order.netProfitAmount }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>业务/平台</span>
                  <strong>{{ order.serviceName ?? '-' }} · {{ order.platformName }}</strong>
                </div>
                <div>
                  <span>手续费 / 退款</span>
                  <strong>{{ order.platformFee }} / {{ order.refundAmount }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无最近订单</strong>
              <span>当前筛选范围内还没有可展示的兑换码订单。</span>
            </div>
          </div>
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
import AppCard from '@/components/ui/AppCard.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
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
          class: 'desktop-data-table',
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
const activeTabLabel = computed(() => {
  const labels: Record<typeof activeTab.value, string> = {
    daily: '按日期',
    service: '按业务',
    platform: '按平台',
    recent: '最近订单'
  };
  return labels[activeTab.value] ?? '按日期';
});
const activeGroupRows = computed<CodeProfitGroup[]>(() => {
  if (activeTab.value === 'daily') {
    return report.value.daily;
  }

  if (activeTab.value === 'service') {
    return report.value.byService;
  }

  if (activeTab.value === 'platform') {
    return report.value.byPlatform;
  }

  return [];
});
const activeVisibleRecordCount = computed(() =>
  activeTab.value === 'recent' ? report.value.recentOrders.length : activeGroupRows.value.length
);
const reportRiskCount = computed(() => {
  if (activeTab.value === 'recent') {
    return report.value.recentOrders.filter((order) => {
      const netProfit = Number(order.netProfitAmount);

      return (!Number.isNaN(netProfit) && netProfit < 0) || order.afterSaleCount > 0;
    }).length;
  }

  return activeGroupRows.value.filter((item) => {
    const rate = Number(item.grossMarginRate);

    return (!Number.isNaN(rate) && rate < 10) || item.afterSaleCount > 0;
  }).length;
});
const reportRiskTitle = computed(() =>
  reportRiskCount.value > 0 ? '存在低毛利、负净利或售后补发记录' : '当前筛选范围暂无明显利润风险'
);
const reportRiskDescription = computed(() =>
  reportRiskCount.value > 0
    ? '建议先核对兑换码成本、平台手续费、退款金额和补发记录，再决定是否进入售后复盘。'
    : '可继续切换业务或平台维度，观察库存周转、退款和售后补发是否集中。'
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

function getDeliveryStatusTone(status: CodePlatformOrder['deliveryStatus']) {
  if (status === 'delivered') {
    return 'green';
  }
  if (status === 'pending') {
    return 'orange';
  }
  if (status === 'failed') {
    return 'red';
  }
  return 'neutral';
}

function getMarginTone(value: string) {
  const rate = Number(value);
  if (Number.isNaN(rate)) {
    return 'neutral';
  }
  if (rate >= 30) {
    return 'green';
  }
  if (rate >= 10) {
    return 'blue';
  }
  if (rate >= 0) {
    return 'orange';
  }
  return 'red';
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
