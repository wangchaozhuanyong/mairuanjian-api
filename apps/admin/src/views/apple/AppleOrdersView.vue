<template>
  <PageScaffold
    title="Apple ID 订单管理"
    group="Apple ID 业务"
    phase="Phase 4"
    description="查看 Apple ID 订单、开通记录、余额消耗和利润。订单创建后会自动生成消费流水和开通记录。"
  >
    <template #actions>
      <AppButton variant="primary" @click="router.push('/apple/order-entry')">新建订单</AppButton>
    </template>

    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="Apple ID 订单队列"
          :help="[
            '这里看每一单有没有开通、用了哪个 ID、客户付了多少、系统算出来赚了多少。',
            '订单、开通记录和余额消费会分开记账，不会和兑换码发货混在一起。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 单</StatusChip>
          <StatusChip :tone="pendingOrderCount > 0 ? 'orange' : 'green'">
            待处理 {{ pendingOrderCount }}
          </StatusChip>
          <StatusChip tone="green">生效 {{ activeOrderCount }}</StatusChip>
          <StatusChip :tone="abnormalOrderCount > 0 ? 'red' : 'green'" dot>
            {{ abnormalOrderCount > 0 ? `异常 ${abnormalOrderCount}` : '无异常' }}
          </StatusChip>
          <StatusChip tone="cyan">实收 {{ sumField('paidAmount') }}</StatusChip>
          <StatusChip tone="orange">成本 {{ sumField('appleCostRmb') }}</StatusChip>
          <StatusChip :tone="Number(sumField('profitAmount')) >= 0 ? 'green' : 'red'">
            利润 {{ sumField('profitAmount') }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="orderColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :selected-count="selectedOrders.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新建订单"
        placeholder="搜索订单号、客户、业务、平台订单号"
        @search="handleSearch"
        @refresh="loadOrders"
        @primary="router.push('/apple/order-entry')"
        @clear-filters="clearFilters"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      />

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="orders"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 Apple ID 订单</strong>
            <span>可以新建订单录入业务，或清空筛选后重新查看订单队列。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="router.push('/apple/order-entry')">
                新建订单
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('orderNo')"
          prop="orderNo"
          label="订单号"
          min-width="150"
          sortable="custom"
        />
        <el-table-column v-if="isColumnVisible('customer')" label="客户" min-width="130">
          <template #default="{ row }">{{ row.customer.name }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务" min-width="150">
          <template #default="{ row }">{{ row.service.name }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="170">
          <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('amounts')"
          prop="paidAmount"
          label="实收/成本/利润"
          min-width="170"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              实收/成本/利润
              <FeatureHelp
                text="实收是客户给的钱；成本是这单消耗掉的 Apple 余额折成人民币；利润就是扣掉成本后的结果。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <div class="order-money-stack">
              <div>
                <span>实收</span>
                <strong>{{ row.paidAmount }}</strong>
              </div>
              <div>
                <span>成本</span>
                <strong>{{ row.appleCostRmb }}</strong>
              </div>
              <StatusChip :tone="getProfitTone(row.profitAmount)">
                利润 {{ row.profitAmount }}
              </StatusChip>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('consumed')"
          prop="appleCostValue"
          label="消耗"
          width="120"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              消耗
              <FeatureHelp text="这单用了多少 Apple 余额，比如用了 10 美元就会在这里显示出来。" />
            </span>
          </template>
          <template #default="{ row }"
            >{{ row.appleCostValue }} {{ row.service.currency }}</template
          >
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expireTime')"
          prop="expireTime"
          label="到期时间"
          min-width="170"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              到期时间
              <FeatureHelp text="客户这次开通到什么时候结束。后面续费提醒会看这个时间。" />
            </span>
          </template>
          <template #default="{ row }">{{ formatDate(row.expireTime) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="100"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              状态
              <FeatureHelp text="看这单现在处在哪一步：待处理、生效中、完成、取消或异常。" />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
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
            <div class="table-action-group table-action-group--wrap">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="orders.length" class="mobile-record-list" aria-label="Apple ID 订单移动列表">
        <article v-for="order in orders" :key="order.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ order.orderNo }}</strong>
              <span>{{ order.customer.name }} · {{ order.service.name }}</span>
            </div>
            <StatusChip :tone="getStatusTone(order.status)" dot>
              {{ getStatusLabel(order.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>客户实收</span>
              <strong>{{ order.paidAmount }}</strong>
            </div>
            <div>
              <span>Apple 成本</span>
              <strong>{{ order.appleCostRmb }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ order.profitAmount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>Apple ID</span>
              <strong>{{ order.appleAccount?.appleIdMasked ?? '-' }}</strong>
            </div>
            <div>
              <span>消耗</span>
              <strong>{{ order.appleCostValue }} {{ order.service.currency }}</strong>
            </div>
            <div>
              <span>到期时间</span>
              <strong>{{ formatDate(order.expireTime) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(order)">详情</AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 订单空状态">
        <div class="apple-core-empty-state">
          <strong>暂无 Apple ID 订单</strong>
          <span>可以新建订单录入业务，或清空筛选后重新查看订单队列。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="router.push('/apple/order-entry')">
              新建订单
            </AppButton>
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

    <AppDrawer v-model="detailDrawerVisible" :title="selectedOrder?.orderNo ?? '订单详情'">
      <div class="drawer-detail-grid">
        <div>
          <span>客户</span>
          <strong>{{ selectedOrder?.customer.name ?? '-' }}</strong>
        </div>
        <div>
          <span>业务</span>
          <strong>{{ selectedOrder?.service.name ?? '-' }}</strong>
        </div>
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedOrder?.appleAccount?.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>客户实收</span>
          <strong>{{ selectedOrder?.paidAmount ?? '-' }}</strong>
        </div>
        <div>
          <span>Apple 成本</span>
          <strong>{{ selectedOrder?.appleCostRmb ?? '-' }}</strong>
        </div>
        <div>
          <span>利润</span>
          <strong>{{ selectedOrder?.profitAmount ?? '-' }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">订单信息</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="平台">
            {{ selectedOrder?.sourcePlatform?.name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="平台订单号">
            {{ selectedOrder?.externalOrderNo ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="服务账号">
            {{ selectedOrder?.serviceAccount ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="套餐">
            {{ selectedOrder?.currentPlan ?? '-' }} -> {{ selectedOrder?.targetPlan ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="开通/到期">
            {{ formatDate(selectedOrder?.startTime) }} ->
            {{ formatDate(selectedOrder?.expireTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="开通记录 ID">
            <AppButton
              v-if="selectedOrder?.activationId"
              size="small"
              variant="soft"
              @click="router.push('/apple/activations')"
            >
              {{ selectedOrder.activationId }}
            </AppButton>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ selectedOrder?.remark ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleOrdersApi, userTableViewsApi } from '@/api/system';
import type { AppleOrderQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { AppleOrder, PageResult, TableDensity, UserTableView } from '@/types/system';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';

const router = useRouter();
const tableKey = 'apple_orders';
const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '生效中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
  { label: '异常', value: 'abnormal' }
];
const orderColumnOptions = [
  { label: '订单号', value: 'orderNo', required: true },
  { label: '客户', value: 'customer' },
  { label: '业务', value: 'service' },
  { label: 'Apple ID', value: 'appleAccount' },
  { label: '实收/成本/利润', value: 'amounts' },
  { label: '消耗', value: 'consumed' },
  { label: '到期时间', value: 'expireTime' },
  { label: '状态', value: 'status' },
  { label: '创建时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const detailDrawerVisible = ref(false);
const orders = ref<AppleOrder[]>([]);
const selectedOrders = ref<AppleOrder[]>([]);
const selectedOrder = ref<AppleOrder | null>(null);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeOrdersQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const pendingOrderCount = computed(
  () => orders.value.filter((order) => order.status === 'pending').length
);
const activeOrderCount = computed(
  () => orders.value.filter((order) => order.status === 'active').length
);
const abnormalOrderCount = computed(
  () => orders.value.filter((order) => order.status === 'abnormal').length
);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function sumField(field: 'paidAmount' | 'appleCostRmb' | 'profitAmount') {
  return orders.value.reduce((sum, order) => sum + Number(order[field]), 0).toFixed(2);
}

function getStatusLabel(status: AppleOrder['status']) {
  return {
    pending: '待处理',
    active: '生效中',
    completed: '已完成',
    cancelled: '已取消',
    abnormal: '异常'
  }[status];
}

function getStatusTone(status: AppleOrder['status']) {
  if (status === 'active' || status === 'completed') return 'green';
  if (status === 'pending') return 'orange';
  if (status === 'abnormal') return 'red';
  return 'neutral';
}

function getProfitTone(value: string) {
  return Number(value) >= 0 ? 'green' : 'red';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function buildOrderParams(): AppleOrderQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyOrderResult(data: PageResult<AppleOrder>) {
  orders.value = data.items;
  total.value = data.total;
}

async function loadOrders(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildOrderParams();
  const key = createSmartQueryKey('apple-orders', params);

  activeOrdersQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: () => appleOrdersApi.list(params),
      apply: applyOrderResult,
      background: options.background,
      isCurrent: () => activeOrdersQueryKey.value === key,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 订单失败');
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadOrders();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadOrders();
}

function handleSelectionChange(rows: AppleOrder[]) {
  selectedOrders.value = rows;
}

function openDetail(order: AppleOrder) {
  selectedOrder.value = order;
  detailDrawerVisible.value = true;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadOrders();
}

function exportList() {
  ElMessage.info('Apple ID 订单导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 订单视图', {
      inputValue: 'Apple ID 订单常用视图',
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
        status: query.status
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : orderColumnOptions.map((column) => column.value),
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
  await loadOrders();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) => orderColumnOptions.some((option) => option.value === column))
    : orderColumnOptions.map((column) => column.value);
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

function mapSortProp(prop?: string) {
  if (prop === 'paidAmount') return 'paidAmount';
  if (prop === 'appleCostValue') return 'appleCostValue';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

async function initializePage() {
  await loadTableViews(true);
  await loadOrders({ force: false });
}

onMounted(initializePage);

usePageRefresh(
  (options) =>
    loadOrders({
      background: options.background,
      force: options.force ?? true
    }),
  { label: 'Apple ID 订单列表' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-orders'], () => {
  void loadOrders({
    background: orders.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
