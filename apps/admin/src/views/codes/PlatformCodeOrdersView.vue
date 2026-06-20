<template>
  <PageScaffold
    :title="`${platformTitle}订单`"
    group="兑换码自动发货"
    phase="Phase 7"
    :description="description"
  >
    <template #actions>
      <AppButton variant="primary" :loading="syncingOrders" @click="syncOrders">
        同步订单
      </AppButton>
      <AppButton :loading="syncingRefunds" @click="syncRefunds">同步退款</AppButton>
    </template>

    <section class="content-panel code-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          :title="`${platformTitle}同步与发货队列`"
          :help="`这里看 ${platformTitle} 订单同步、SKU 识别、兑换码锁定和发货状态。真实授权没接好时，订单会转人工处理。`"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>{{ platformTitle }} {{ total }} 单</StatusChip>
          <StatusChip tone="cyan">店铺 {{ platforms.length }}</StatusChip>
          <StatusChip :tone="pendingCount > 0 ? 'orange' : 'green'">
            待发货 {{ pendingCount }}
          </StatusChip>
          <StatusChip :tone="manualCount > 0 ? 'orange' : 'green'" dot>
            {{ manualCount > 0 ? `人工 ${manualCount}` : '自动链路稳定' }}
          </StatusChip>
          <StatusChip tone="green">已发货 {{ deliveredCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.deliveryStatus"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="platformOrderColumnOptions"
        :status-options="deliveryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedOrders.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :primary-label="`同步${platformTitle}订单`"
        placeholder="搜索订单号、商品、SKU、业务"
        @search="handleSearch"
        @refresh="reloadAll"
        @primary="syncOrders"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.platformId"
            class="table-toolbar__select"
            placeholder="店铺/账号"
            @change="handleSearch"
          >
            <el-option
              v-for="shop in platforms"
              :key="shop.id"
              :label="shop.name"
              :value="shop.id"
            />
          </el-select>
        </template>
      </TableToolbar>

      <div v-if="!platforms.length && !loading" class="apple-core-empty-state">
        <strong>暂无启用的{{ platformTitle }}来源平台</strong>
        <span>请先到来源平台设置添加并启用店铺/账号，再同步平台订单。</span>
      </div>
      <el-table
        v-else
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
            <strong>暂无{{ platformTitle }}订单</strong>
            <span>可以同步平台订单，或清空筛选后重新查看当前平台发货队列。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" :loading="syncingOrders" @click="syncOrders">
                同步{{ platformTitle }}订单
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
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
        <el-table-column v-if="isColumnVisible('service')" label="业务" min-width="170">
          <template #default="{ row }">
            {{ row.service?.name ?? '-' }}
            <div class="muted-block">面值 {{ row.faceValue ?? '-' }} × {{ row.quantity }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('paidAmount')"
          prop="paidAmount"
          label="实收"
          width="110"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('profitAmount')"
          prop="profitAmount"
          label="利润"
          width="110"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('deliveryStatus')"
          prop="deliveryStatus"
          label="发货"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getDeliveryStatusTone(row.deliveryStatus)" dot>
              {{ getDeliveryStatusLabel(row.deliveryStatus) }}
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
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton
                variant="success"
                :disabled="row.deliveryStatus === 'delivered'"
                @click="platformDeliver(row)"
              >
                平台发货
              </AppButton>
              <AppButton
                variant="soft"
                :disabled="row.deliveryStatus === 'delivered' || row.deliveryStatus === 'manual'"
                @click="markManual(row)"
              >
                转人工
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="platforms.length && orders.length" class="mobile-record-list">
        <article v-for="order in orders" :key="order.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ order.externalOrderNo }}</strong>
              <span>{{ order.platform.name }} · {{ order.itemTitle || order.itemId }}</span>
            </div>
            <StatusChip :tone="getDeliveryStatusTone(order.deliveryStatus)" dot>
              {{ getDeliveryStatusLabel(order.deliveryStatus) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>实收</span>
              <strong>{{ order.paidAmount }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ order.profitAmount }}</strong>
            </div>
            <div>
              <span>数量</span>
              <strong>{{ order.quantity }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>业务</span>
              <strong>{{ order.service?.name ?? '-' }}</strong>
            </div>
            <div>
              <span>面值</span>
              <strong>{{ order.faceValue ?? '-' }}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>{{ formatDate(order.createdAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton
              size="small"
              variant="success"
              :disabled="order.deliveryStatus === 'delivered'"
              @click="platformDeliver(order)"
            >
              平台发货
            </AppButton>
            <AppButton
              size="small"
              variant="soft"
              :disabled="order.deliveryStatus === 'delivered' || order.deliveryStatus === 'manual'"
              @click="markManual(order)"
            >
              转人工
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else-if="platforms.length" class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无{{ platformTitle }}订单</strong>
          <span>可以同步平台订单，或清空筛选后重新查看当前平台发货队列。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" :loading="syncingOrders" @click="syncOrders">
              同步{{ platformTitle }}订单
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
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  codeOrdersApi,
  platformDeliveryApi,
  userTableViewsApi,
  type PlatformSyncResult
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  CodePlatformOrder,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  createSmartQueryKey,
  getSmartQueryData,
  invalidateSmartQueries,
  refreshSmartQuery
} from '@/utils/smartQuery';
import { loadSmartSourcePlatforms } from '@/utils/smartSystemQueries';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';

const props = defineProps<{
  platform: 'taobao' | 'xianyu';
  platformTitle: string;
  description: string;
}>();

const loading = ref(false);
const syncingOrders = ref(false);
const syncingRefunds = ref(false);
const platforms = ref<SourcePlatform[]>([]);
const orders = ref<CodePlatformOrder[]>([]);
const selectedOrders = ref<CodePlatformOrder[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeOrdersQueryKey = ref('');
const activatedOnce = ref(false);

type PlatformCodeOrderPage = Awaited<ReturnType<typeof codeOrdersApi.list>>;
type PlatformCodeOrderListParams = Parameters<typeof codeOrdersApi.list>[0];

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  platformId: '',
  deliveryStatus: ''
});

const tableKey = computed(() => `platform_code_orders_${props.platform}`);
const deliveryStatusOptions = [
  { label: '待发货', value: 'pending' },
  { label: '已发货', value: 'delivered' },
  { label: '失败', value: 'failed' },
  { label: '人工处理', value: 'manual' }
];
const platformOrderColumnOptions = [
  { label: '订单', value: 'order', required: true },
  { label: '商品/SKU', value: 'item' },
  { label: '业务', value: 'service' },
  { label: '实收', value: 'paidAmount' },
  { label: '利润', value: 'profitAmount' },
  { label: '发货状态', value: 'deliveryStatus' },
  { label: '创建时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const pendingCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'pending').length
);
const manualCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'manual').length
);
const deliveredCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'delivered').length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const platformLabel = platforms.value.find((platform) => platform.id === query.platformId)?.name;
  if (query.platformId && platformLabel) {
    chips.push({ key: 'platformId', label: '店铺/账号', value: platformLabel });
  }
  return chips;
});

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

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadPlatforms(options: { force?: boolean } = {}) {
  const data = await loadSmartSourcePlatforms(
    {
      page: 1,
      pageSize: 100,
      status: 'active'
    },
    options
  );
  platforms.value = data.items;
  if (!query.platformId) {
    query.platformId = platforms.value[0]?.id ?? '';
  }
}

async function loadOrders(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildOrderListParams();
  const key = createSmartQueryKey(`platform-code-orders-${props.platform}`, params);
  const cached = getSmartQueryData<PlatformCodeOrderPage>(key);

  activeOrdersQueryKey.value = key;

  if (cached) {
    applyOrderListResult(cached);
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
      applyOrderListResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(
        error instanceof Error ? error.message : `加载${props.platformTitle}订单失败`
      );
    }
  } finally {
    if (activeOrdersQueryKey.value === key) {
      loading.value = false;
    }
  }
}

function buildOrderListParams(): PlatformCodeOrderListParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    platformId: query.platformId || undefined,
    deliveryStatus: query.deliveryStatus || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyOrderListResult(data: PlatformCodeOrderPage) {
  orders.value = data.items;
  total.value = data.total;
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

function handleSelectionChange(rows: CodePlatformOrder[]) {
  selectedOrders.value = rows;
}

async function reloadAll() {
  try {
    await loadPlatforms({ force: true });
    await loadOrders({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `刷新${props.platformTitle}订单失败`);
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.platformId = platforms.value[0]?.id ?? '';
  query.deliveryStatus = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'platformId') {
    query.platformId = platforms.value[0]?.id ?? '';
  }
}

function exportList() {
  ElMessage.info(`${props.platformTitle}订单导出会进入数据中心导出任务，后续统一接入`);
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
      tableKey: tableKey.value
    });
    savedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyView(defaultView);
        return true;
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }

  return false;
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt(
      `请输入视图名称`,
      `保存${props.platformTitle}订单视图`,
      {
        inputValue: `${props.platformTitle}订单常用视图`,
        inputPattern: /^.{1,60}$/,
        inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
        confirmButtonText: '保存',
        cancelButtonText: '取消'
      }
    );
    const created = await userTableViewsApi.create({
      tableKey: tableKey.value,
      viewName: value.trim(),
      filters: {
        keyword: query.keyword,
        platformId: query.platformId,
        deliveryStatus: query.deliveryStatus
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : platformOrderColumnOptions.map((column) => column.value),
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
  query.platformId =
    typeof filters.platformId === 'string' && filters.platformId
      ? filters.platformId
      : (platforms.value[0]?.id ?? '');
  query.deliveryStatus = typeof filters.deliveryStatus === 'string' ? filters.deliveryStatus : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        platformOrderColumnOptions.some((option) => option.value === column)
      )
    : platformOrderColumnOptions.map((column) => column.value);
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
  if (prop === 'externalOrderNo') return 'externalOrderNo';
  if (prop === 'paidAmount') return 'paidAmount';
  if (prop === 'profitAmount') return 'profitAmount';
  if (prop === 'deliveryStatus') return 'deliveryStatus';
  if (prop === 'createdAt') return 'createdAt';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function showSyncResult(result: PlatformSyncResult) {
  const message = `${result.message}；同步 ${result.syncedCount}，跳过 ${result.skippedCount}，失败 ${result.failedCount}`;
  if (result.supported) {
    ElMessage.success(message);
  } else {
    ElMessage.warning(message);
  }
}

async function syncOrders() {
  syncingOrders.value = true;
  try {
    showSyncResult(await platformDeliveryApi.syncOrders(props.platform));
    invalidateSmartQueries(`platform-code-orders-${props.platform}`);
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${props.platformTitle}订单同步失败`);
  } finally {
    syncingOrders.value = false;
  }
}

async function syncRefunds() {
  syncingRefunds.value = true;
  try {
    showSyncResult(await platformDeliveryApi.syncRefunds(props.platform));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${props.platformTitle}退款同步失败`);
  } finally {
    syncingRefunds.value = false;
  }
}

async function platformDeliver(order: CodePlatformOrder) {
  try {
    await ElMessageBox.confirm(
      `${props.platformTitle}平台授权尚未完成，执行后会转入人工处理。`,
      '平台发货',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch {
    return;
  }

  try {
    const result = await platformDeliveryApi.deliver(props.platform, order.id, {});
    if (result.status === 'manual_required') {
      ElMessage.warning(result.message);
    } else {
      ElMessage.success(result.message);
    }
    invalidateSmartQueries(`platform-code-orders-${props.platform}`);
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '平台发货失败');
  }
}

async function markManual(order: CodePlatformOrder) {
  try {
    await codeOrdersApi.markManual(order.id, {
      reason: `${props.platformTitle}页面手动转人工`
    });
    ElMessage.success('订单已转入人工处理');
    invalidateSmartQueries(`platform-code-orders-${props.platform}`);
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '转人工失败');
  }
}

async function loadPageData() {
  await loadPlatforms({ force: false });

  const tableViewsPromise = loadTableViews(true);
  const ordersPromise = loadOrders({ force: false });
  const defaultViewApplied = await tableViewsPromise;

  await ordersPromise;

  if (defaultViewApplied) {
    await loadOrders({
      background: orders.value.length > 0,
      force: false
    });
  }
}

async function initializePage() {
  try {
    await loadPageData();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `加载${props.platformTitle}订单失败`);
  }
}

onMounted(initializePage);
onActivated(() => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }

  void loadOrders({
    background: orders.value.length > 0,
    force: false
  });
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [`platform-code-orders-${props.platform}`],
  () => {
    void loadOrders({
      background: orders.value.length > 0,
      force: true
    });
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.code-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.code-compact-list-panel .inline-actions {
  max-width: min(620px, 100%);
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (max-width: 840px) {
  .code-compact-list-panel .inline-actions {
    justify-content: flex-start;
  }
}
</style>
