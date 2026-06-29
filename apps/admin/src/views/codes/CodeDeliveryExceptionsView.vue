<template>
  <PageScaffold
    title="发货异常"
    group="兑换码自动发货"
    phase="Phase 7"
    description="集中查看失败、转人工和待确认发货订单，辅助发货员进入订单页处理。"
  >
    <template #actions>
      <StatusChip :tone="totalExceptionCount > 0 ? 'orange' : 'green'" dot>
        {{ totalExceptionCount > 0 ? `待关注 ${totalExceptionCount}` : '发货稳定' }}
      </StatusChip>
      <AppButton :loading="loading || summaryLoading" @click="() => reloadAll()">刷新</AppButton>
      <AppButton variant="primary" @click="() => goToCodeOrders()">进入发货处理</AppButton>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="待关注订单"
        :value="totalExceptionCount"
        hint="失败、人工和待确认发货"
        :tone="totalExceptionCount > 0 ? 'orange' : 'green'"
      />
      <MetricCard
        label="发货失败"
        :value="exceptionStats.failed"
        hint="需查看失败原因"
        :tone="exceptionStats.failed > 0 ? 'red' : 'green'"
      />
      <MetricCard
        label="已转人工"
        :value="exceptionStats.manual"
        hint="等待人工发货或复核"
        tone="orange"
      />
      <MetricCard
        label="待确认发货"
        :value="exceptionStats.pending"
        hint="包含未锁码或已锁码待发"
        tone="blue"
      />
    </div>

    <section class="content-panel code-delivery-exception-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="异常处理看板"
          help="这里按兑换码订单状态汇总发货异常，比如失败、转人工、待锁码。处理时进入订单页完成发货动作。"
        />
        <div class="inline-actions">
          <StatusChip tone="red" dot>失败 {{ exceptionStats.failed }}</StatusChip>
          <StatusChip tone="orange">人工 {{ exceptionStats.manual }}</StatusChip>
          <StatusChip tone="blue">待发 {{ exceptionStats.pending }}</StatusChip>
        </div>
      </div>

      <ListRequestError
        v-if="summaryLoadError"
        title="发货异常看板加载失败"
        :message="summaryLoadError"
        @retry="() => loadSummary({ force: true })"
      />

      <div class="delivery-exception-board">
        <AppCard
          v-for="lane in exceptionLanes"
          :key="lane.status"
          :title="lane.title"
          :subtitle="lane.description"
          :tag="String(lane.total)"
          :tag-tone="lane.tone"
          :loading="summaryLoading"
          :empty="!summaryLoading && lane.orders.length === 0"
          state-compact
          :empty-title="`${lane.title}为空`"
          empty-description="当前筛选下没有对应订单。"
        >
          <div class="exception-lane-list">
            <article
              v-for="order in lane.orders"
              :key="order.id"
              class="exception-mini-card"
              @click="openDetail(order)"
            >
              <div class="exception-mini-card__head">
                <strong>{{ order.externalOrderNo }}</strong>
                <StatusChip :tone="getDeliveryStatusTone(order.deliveryStatus)" dot>
                  {{ getDeliveryStatusLabel(order.deliveryStatus) }}
                </StatusChip>
              </div>
              <p>{{ getExceptionReason(order) }}</p>
              <div class="exception-mini-card__meta">
                <span>{{ order.platform.name }}</span>
                <span>{{ order.service?.name || order.itemTitle || order.itemId }}</span>
                <span>锁码 {{ order.lockedCodeCount }}/{{ order.quantity }}</span>
              </div>
            </article>
          </div>
        </AppCard>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.deliveryStatus"
        v-model:visible-columns="visibleColumns"
        :column-options="columnOptions"
        :status-options="deliveryStatusOptions"
        :filter-chips="filterChips"
        :show-date-shortcut="false"
        :show-save-view="false"
        primary-label="进入发货处理"
        placeholder="搜索订单号、买家、商品、SKU、业务"
        @search="handleSearch"
        @refresh="() => reloadAll()"
        @primary="() => goToCodeOrders()"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @export="exportList"
      >
        <template #filters>
          <el-select
            v-model="query.platformId"
            class="table-toolbar__select"
            clearable
            placeholder="平台"
            @change="handleSearch"
          >
            <el-option
              v-for="platform in platforms"
              :key="platform.id"
              :label="platform.name"
              :value="platform.id"
            />
          </el-select>
        </template>
      </TableToolbar>

      <ListRequestError
        v-if="ordersLoadError && orders.length"
        title="发货异常列表刷新失败"
        :message="ordersLoadError"
        @retry="() => loadOrders({ force: true })"
      />

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="orders"
        :size="tableSize"
        row-key="id"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <ListRequestError
            v-if="ordersLoadError"
            title="发货异常列表加载失败"
            :message="ordersLoadError"
            @retry="() => loadOrders({ force: true })"
          />
          <div v-else class="apple-core-empty-state">
            <strong>暂无发货异常</strong>
            <span>当前筛选下没有失败、转人工或待确认发货订单。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="() => goToCodeOrders()">
                进入发货处理
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column v-if="isColumnVisible('exception')" label="异常类型" min-width="150">
          <template #default="{ row }">
            <StatusChip :tone="getExceptionTone(row)" dot>
              {{ getExceptionLabel(row) }}
            </StatusChip>
            <div class="muted-block">{{ getExceptionReason(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('order')"
          prop="externalOrderNo"
          label="订单"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.externalOrderNo }}
            <div class="muted-block">{{ row.platform.name }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('item')" label="商品/SKU" min-width="220">
          <template #default="{ row }">
            {{ row.itemTitle || row.itemId }}
            <div class="muted-block">SKU {{ row.skuName || row.skuId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务/面值" min-width="170">
          <template #default="{ row }">
            <span>{{ row.service?.name || '未匹配业务' }}</span>
            <div class="muted-block">面值 {{ row.faceValue || '-' }} × {{ row.quantity }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('locked')"
          prop="lockedCodeCount"
          label="锁码"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="row.lockedCodeCount >= row.quantity ? 'green' : 'orange'" dot>
              {{ row.lockedCodeCount }}/{{ row.quantity }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('refundStatus')"
          prop="refundStatus"
          label="退款"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getRefundTone(row.refundStatus)">
              {{ getRefundLabel(row.refundStatus) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('updatedAt')"
          prop="updatedAt"
          label="更新时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">查看</AppButton>
              <AppButton size="small" variant="soft" @click="goToCodeOrders(row)">处理</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="orders.length" class="mobile-record-list">
        <article v-for="order in orders" :key="order.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ order.externalOrderNo }}</strong>
              <span>{{ order.platform.name }} · {{ order.itemTitle || order.itemId }}</span>
            </div>
            <StatusChip :tone="getExceptionTone(order)" dot>{{
              getExceptionLabel(order)
            }}</StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>锁码</span>
              <strong>{{ order.lockedCodeCount }}/{{ order.quantity }}</strong>
            </div>
            <div>
              <span>面值</span>
              <strong>{{ order.faceValue || '-' }}</strong>
            </div>
            <div>
              <span>实付</span>
              <strong>{{ order.paidAmount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>原因</span>
              <strong>{{ getExceptionReason(order) }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(order.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(order)">查看</AppButton>
            <AppButton size="small" variant="soft" @click="goToCodeOrders(order)">去处理</AppButton>
          </div>
        </article>
      </div>

      <div v-else-if="ordersLoadError" class="mobile-record-list" aria-label="发货异常列表加载失败">
        <ListRequestError
          title="发货异常列表加载失败"
          :message="ordersLoadError"
          @retry="() => loadOrders({ force: true })"
        />
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无发货异常</strong>
          <span>当前筛选下没有需要展示的异常订单。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="() => goToCodeOrders()"> 进入发货处理 </AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadOrders"
      />
    </section>

    <AppDrawer
      v-model="detailVisible"
      :title="`发货异常 · ${selectedOrder?.externalOrderNo ?? ''}`"
      description="这里展示订单状态和处理建议；具体发货、转人工、重试在兑换码订单页完成。"
      confirm-text="进入发货处理"
      @confirm="goToSelectedOrderProcessing"
    >
      <div v-if="selectedOrder" class="drawer-section">
        <div class="drawer-section__title">异常摘要</div>
        <div class="drawer-detail-grid">
          <div>
            <span>异常类型</span>
            <strong>{{ getExceptionLabel(selectedOrder) }}</strong>
          </div>
          <div>
            <span>发货状态</span>
            <strong>{{ getDeliveryStatusLabel(selectedOrder.deliveryStatus) }}</strong>
          </div>
          <div>
            <span>平台</span>
            <strong>{{ selectedOrder.platform.name }}</strong>
          </div>
          <div>
            <span>锁码进度</span>
            <strong>{{ selectedOrder.lockedCodeCount }}/{{ selectedOrder.quantity }}</strong>
          </div>
        </div>
      </div>

      <div v-if="selectedOrder" class="drawer-section">
        <div class="drawer-section__title">订单信息</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="商品">
            {{ selectedOrder.itemTitle || selectedOrder.itemId }}
          </el-descriptions-item>
          <el-descriptions-item label="业务">
            {{ selectedOrder.service?.name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="面值/数量">
            {{ selectedOrder.faceValue || '-' }} × {{ selectedOrder.quantity }}
          </el-descriptions-item>
          <el-descriptions-item label="实收/利润">
            {{ selectedOrder.paidAmount }} / {{ selectedOrder.profitAmount }}
          </el-descriptions-item>
          <el-descriptions-item label="退款状态">
            {{ getRefundLabel(selectedOrder.refundStatus) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(selectedOrder.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">建议处理</div>
        <div class="apple-core-alert" :class="`apple-core-alert--${drawerAlertTone}`">
          <StatusChip :tone="drawerStatusTone">{{ drawerStatusLabel }}</StatusChip>
          <div>
            <strong>{{ drawerAdviceTitle }}</strong>
            <p>{{ drawerAdviceDescription }}</p>
          </div>
        </div>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { codeOrdersApi } from '@/api/system';
import type { CodeOrderQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import ListRequestError from '@/components/ui/ListRequestError.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type { CodePlatformOrder, PageResult, SourcePlatform, TableDensity } from '@/types/system';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { getLoadErrorMessage } from '@/utils/loadErrorMessage';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import { loadSmartSourcePlatforms } from '@/utils/smartSystemQueries';

type ExceptionStatus = 'failed' | 'manual' | 'pending';
type ChipTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
type SortOrder = 'ascending' | 'descending' | null;
interface DeliveryExceptionSummary {
  stats: Record<ExceptionStatus, number>;
  lanes: Record<ExceptionStatus, CodePlatformOrder[]>;
}

const router = useRouter();
const authStore = useAuthStore();
const exceptionStatuses: ExceptionStatus[] = ['failed', 'manual', 'pending'];
const deliveryStatusOptions: Array<{ label: string; value: ExceptionStatus }> = [
  { label: '发货失败', value: 'failed' },
  { label: '人工处理', value: 'manual' },
  { label: '待确认发货', value: 'pending' }
];
const columnOptions = [
  { label: '异常类型', value: 'exception', required: true },
  { label: '订单', value: 'order', required: true },
  { label: '商品/SKU', value: 'item' },
  { label: '业务/面值', value: 'service' },
  { label: '锁码', value: 'locked' },
  { label: '退款', value: 'refundStatus' },
  { label: '更新时间', value: 'updatedAt' }
];

const loading = ref(false);
const summaryLoading = ref(false);
const detailVisible = ref(false);
const selectedOrder = ref<CodePlatformOrder | null>(null);
const orders = ref<CodePlatformOrder[]>([]);
const ordersLoadError = ref('');
const summaryLoadError = ref('');
const platforms = ref<SourcePlatform[]>([]);
const total = ref(0);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const sortConfig = ref<{ prop?: string; order?: SortOrder }>({});
const activeOrdersQueryKey = ref('');
const activeSummaryQueryKey = ref('');
const exceptionStats = reactive<Record<ExceptionStatus, number>>({
  failed: 0,
  manual: 0,
  pending: 0
});
const laneOrders = reactive<Record<ExceptionStatus, CodePlatformOrder[]>>({
  failed: [],
  manual: [],
  pending: []
});
const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  platformId: '',
  deliveryStatus: 'failed' as ExceptionStatus
});

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const totalExceptionCount = computed(
  () => exceptionStats.failed + exceptionStats.manual + exceptionStats.pending
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const platformLabel = platforms.value.find((platform) => platform.id === query.platformId)?.name;

  if (query.platformId && platformLabel) {
    chips.push({ key: 'platformId', label: '平台', value: platformLabel });
  }

  return chips;
});
const exceptionLanes = computed(() => [
  {
    status: 'failed' as const,
    title: '发货失败',
    description: '平台发货失败，需要复核后重试或转人工。',
    tone: 'red' as const,
    total: exceptionStats.failed,
    orders: laneOrders.failed
  },
  {
    status: 'manual' as const,
    title: '已转人工',
    description: '自动流程已暂停，等待发货员复制话术或手工确认。',
    tone: 'orange' as const,
    total: exceptionStats.manual,
    orders: laneOrders.manual
  },
  {
    status: 'pending' as const,
    title: '待确认发货',
    description: '待锁码、锁码未满或已锁码但未确认发货。',
    tone: 'blue' as const,
    total: exceptionStats.pending,
    orders: laneOrders.pending
  }
]);
const selectedAdvice = computed(() => {
  const order = selectedOrder.value;

  if (!order) {
    return {
      label: '待查看',
      title: '选择一条订单查看处理建议',
      description: '页面不会直接改变订单状态，处理动作请进入兑换码订单页完成。',
      tone: 'blue' as ChipTone,
      alert: 'blue'
    };
  }

  if (order.deliveryStatus === 'failed') {
    return {
      label: '失败复核',
      title: '先查看失败原因，再决定重试或转人工',
      description: '请在兑换码订单页查看发货记录、平台状态和锁码情况，避免重复发送。',
      tone: 'red' as ChipTone,
      alert: 'red'
    };
  }

  if (order.deliveryStatus === 'manual') {
    return {
      label: '人工处理',
      title: '按人工发货流程复制话术并确认结果',
      description: '处理前核对订单号、面值、锁码尾号和退款状态，处理后在订单页保存发货记录。',
      tone: 'orange' as ChipTone,
      alert: 'orange'
    };
  }

  if (order.lockedCodeCount < order.quantity) {
    return {
      label: '锁码不足',
      title: '先确认库存或重新匹配锁码',
      description: '当前订单锁码数量不足，建议进入订单页执行匹配锁码或转人工，不在本页修改库存。',
      tone: 'orange' as ChipTone,
      alert: 'orange'
    };
  }

  return {
    label: '待确认',
    title: '已具备发货条件，等待订单页确认发货',
    description: '发货确认会保存发货记录并改变订单状态，请在兑换码订单页完成。',
    tone: 'blue' as ChipTone,
    alert: 'blue'
  };
});
const drawerStatusLabel = computed(() => selectedAdvice.value.label);
const drawerAdviceTitle = computed(() => selectedAdvice.value.title);
const drawerAdviceDescription = computed(() => selectedAdvice.value.description);
const drawerStatusTone = computed(() => selectedAdvice.value.tone);
const drawerAlertTone = computed(() => selectedAdvice.value.alert);
const canViewCodeOrders = computed(() => hasDeliveryExceptionPermission('code.order.view'));
const canViewSourcePlatforms = computed(() =>
  hasDeliveryExceptionPermission('source_platform.view')
);

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

function getDeliveryStatusTone(status: CodePlatformOrder['deliveryStatus']): ChipTone {
  if (status === 'failed') return 'red';
  if (status === 'manual') return 'orange';
  if (status === 'pending') return 'blue';
  return 'green';
}

function getRefundLabel(status: CodePlatformOrder['refundStatus']) {
  const labels: Record<CodePlatformOrder['refundStatus'], string> = {
    none: '无退款',
    refunding: '退款中',
    refunded: '已退款'
  };
  return labels[status];
}

function getRefundTone(status: CodePlatformOrder['refundStatus']): ChipTone {
  if (status === 'refunded') return 'red';
  if (status === 'refunding') return 'orange';
  return 'neutral';
}

function getExceptionLabel(order: CodePlatformOrder) {
  if (order.deliveryStatus === 'failed') return '发货失败';
  if (order.deliveryStatus === 'manual') return '已转人工';
  if (order.lockedCodeCount < order.quantity) return '锁码不足';
  return '待确认发货';
}

function getExceptionTone(order: CodePlatformOrder): ChipTone {
  if (order.deliveryStatus === 'failed') return 'red';
  if (order.deliveryStatus === 'manual') return 'orange';
  if (order.lockedCodeCount < order.quantity) return 'orange';
  return 'blue';
}

function getExceptionReason(order: CodePlatformOrder) {
  if (order.deliveryStatus === 'failed') {
    return '发货失败，需查看记录后重试或转人工';
  }

  if (order.deliveryStatus === 'manual') {
    return '已转人工，等待发货员处理';
  }

  if (order.lockedCodeCount < order.quantity) {
    return `锁码 ${order.lockedCodeCount}/${order.quantity}，需确认库存或重新匹配`;
  }

  return '已锁码，等待确认发货';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function mapSortProp(prop?: string) {
  if (prop === 'externalOrderNo') return 'externalOrderNo';
  if (prop === 'lockedCodeCount') return 'lockedCodeCount';
  return prop;
}

function mapSortOrder(order?: SortOrder) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

async function loadPlatforms(options: { force?: boolean } = {}) {
  if (!canViewSourcePlatforms.value) {
    platforms.value = [];
    return;
  }

  const data = await loadSmartSourcePlatforms(
    {
      page: 1,
      pageSize: 100,
      status: 'active'
    },
    options
  );
  platforms.value = data.items;
}

function buildExceptionBaseParams() {
  return {
    keyword: query.keyword || undefined,
    platformId: query.platformId || undefined
  };
}

function buildOrderParams(): CodeOrderQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    ...buildExceptionBaseParams(),
    deliveryStatus: query.deliveryStatus,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applySummaryResult(data: DeliveryExceptionSummary) {
  for (const status of exceptionStatuses) {
    exceptionStats[status] = data.stats[status];
    laneOrders[status] = data.lanes[status];
  }
  summaryLoadError.value = '';
}

function applyOrderResult(data: PageResult<CodePlatformOrder>) {
  orders.value = data.items;
  total.value = data.total;
  ordersLoadError.value = '';
}

async function loadSummary(options: { background?: boolean; force?: boolean } = {}) {
  if (!canViewCodeOrders.value) {
    applySummaryResult({
      stats: {
        failed: 0,
        manual: 0,
        pending: 0
      },
      lanes: {
        failed: [],
        manual: [],
        pending: []
      }
    });
    return;
  }

  const params = buildExceptionBaseParams();
  const key = createSmartQueryKey('code-delivery-exceptions-summary', params);
  const cached = getSmartQueryData<DeliveryExceptionSummary>(key);

  activeSummaryQueryKey.value = key;

  if (cached) {
    applySummaryResult(cached);
  }

  summaryLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: async () => {
        const results = await Promise.all(
          exceptionStatuses.map((status) =>
            codeOrdersApi.list({
              page: 1,
              pageSize: 4,
              ...params,
              deliveryStatus: status
            })
          )
        );

        return exceptionStatuses.reduce<DeliveryExceptionSummary>(
          (summary, status, index) => {
            const page = results[index];
            summary.stats[status] = page?.total ?? 0;
            summary.lanes[status] = page?.items ?? [];
            return summary;
          },
          {
            stats: {
              failed: 0,
              manual: 0,
              pending: 0
            },
            lanes: {
              failed: [],
              manual: [],
              pending: []
            }
          }
        );
      },
      force: options.force ?? true
    });

    if (activeSummaryQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applySummaryResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      summaryLoadError.value = getLoadErrorMessage(error, '加载发货异常看板失败');
      ElMessage.error(summaryLoadError.value);
    }
  } finally {
    if (activeSummaryQueryKey.value === key) {
      summaryLoading.value = false;
    }
  }
}

async function loadOrders(options: { background?: boolean; force?: boolean } = {}) {
  if (!canViewCodeOrders.value) {
    applyOrderResult(emptyPageResult<CodePlatformOrder>(query.pageSize));
    return;
  }

  const params = buildOrderParams();
  const key = createSmartQueryKey('code-delivery-exceptions', params);
  const cached = getSmartQueryData<PageResult<CodePlatformOrder>>(key);

  activeOrdersQueryKey.value = key;

  if (cached) {
    applyOrderResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => codeOrdersApi.list(params),
      force: options.force ?? true
    });

    if (activeOrdersQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyOrderResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ordersLoadError.value = getLoadErrorMessage(error, '加载发货异常订单失败');
      ElMessage.error(ordersLoadError.value);
    }
  } finally {
    if (activeOrdersQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function reloadAll(options: { background?: boolean; force?: boolean } = {}) {
  try {
    await Promise.all([loadSummary(options), loadOrders(options)]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新发货异常失败');
  }
}

async function handleSearch() {
  query.page = 1;
  await reloadAll();
}

async function handleSortChange(payload: { prop?: string; order?: SortOrder }) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadOrders();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.platformId = '';
  query.deliveryStatus = 'failed';
  sortConfig.value = {};
  void reloadAll();
}

function removeFilter(key: string) {
  if (key === 'platformId') {
    query.platformId = '';
    void handleSearch();
  }
}

function openDetail(order: CodePlatformOrder) {
  selectedOrder.value = order;
  detailVisible.value = true;
}

function goToCodeOrders(order?: CodePlatformOrder) {
  if (!canViewCodeOrders.value) {
    ElMessage.warning('当前账号没有查看兑换码订单权限');
    return;
  }

  const targetQuery: Record<string, string> = {};

  if (order) {
    targetQuery.keyword = order.externalOrderNo;
    targetQuery.deliveryStatus = order.deliveryStatus;
    if (order.platform?.id) {
      targetQuery.platformId = order.platform.id;
    }
  } else {
    if (query.keyword) {
      targetQuery.keyword = query.keyword;
    }
    if (query.platformId) {
      targetQuery.platformId = query.platformId;
    }
    if (query.deliveryStatus) {
      targetQuery.deliveryStatus = query.deliveryStatus;
    }
  }

  void router.push({
    path: '/codes/orders',
    query: targetQuery
  });
}

function goToSelectedOrderProcessing() {
  goToCodeOrders(selectedOrder.value ?? undefined);
}

function emptyPageResult<TItem>(pageSize: number): PageResult<TItem> {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize
  };
}

function hasDeliveryExceptionPermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

function exportList() {
  if (!orders.value.length) {
    ElMessage.warning('暂无可导出的发货异常数据');
    return;
  }

  const count = exportRowsToCsv(
    'code-delivery-exceptions',
    [
      { header: '订单号', value: (row) => row.externalOrderNo },
      { header: '平台', value: (row) => row.platform.name },
      { header: '买家', value: (row) => row.buyerNameMasked ?? row.buyerId ?? '' },
      { header: '商品', value: (row) => row.itemTitle ?? row.itemId },
      { header: 'SKU', value: (row) => row.skuName ?? row.skuId },
      { header: '匹配业务', value: (row) => row.service?.name ?? '' },
      { header: '异常类型', value: (row) => getExceptionLabel(row) },
      { header: '发货状态', value: (row) => getDeliveryStatusLabel(row.deliveryStatus) },
      { header: '退款状态', value: (row) => getRefundLabel(row.refundStatus) },
      { header: '实收', value: (row) => row.paidAmount },
      { header: '成本', value: (row) => row.costAmount },
      { header: '利润', value: (row) => row.profitAmount },
      { header: '锁定码数', value: (row) => row.lockedCodeCount },
      { header: '已发码数', value: (row) => row.deliveredCodeCount },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) },
      { header: '发货时间', value: (row) => formatDate(row.deliveredAt) }
    ],
    orders.value
  );

  ElMessage.success(`已导出 ${count} 条发货异常数据`);
}

async function initializePage() {
  try {
    await loadPlatforms({ force: false });
    await reloadAll({ force: false });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载发货异常页面失败');
  }
}

onMounted(initializePage);

usePageRefresh(
  (options) =>
    reloadAll({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '发货异常' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['code-delivery-exceptions'], () => {
  void reloadAll({
    background: orders.value.length > 0 || totalExceptionCount.value > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.code-delivery-exception-panel .panel-title-row {
  align-items: flex-start;
}

.delivery-exception-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.exception-lane-list {
  display: grid;
  gap: 12px;
}

.exception-mini-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e4eaf3;
  border-radius: 16px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.exception-mini-card:hover {
  border-color: #bfd0ee;
  box-shadow: 0 12px 26px rgba(23, 32, 51, 0.08);
  transform: translateY(-1px);
}

.exception-mini-card__head,
.exception-mini-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.exception-mini-card__head strong {
  min-width: 0;
  overflow: hidden;
  color: #172033;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exception-mini-card p {
  margin: 0;
  color: #56657f;
  font-size: 13px;
  line-height: 1.6;
}

.exception-mini-card__meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: #7b879c;
  font-size: 12px;
}

.exception-mini-card__meta span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .delivery-exception-board {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 840px) {
  .code-delivery-exception-panel .inline-actions {
    justify-content: flex-start;
  }

  .exception-mini-card__head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
