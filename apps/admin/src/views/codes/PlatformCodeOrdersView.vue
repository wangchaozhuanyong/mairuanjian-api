<template>
  <PageScaffold
    :title="`${platformTitle}订单`"
    group="兑换码自动发货"
    phase="Phase 7"
    :description="description"
  >
    <template #actions>
      <el-button type="primary" :loading="syncingOrders" @click="syncOrders">同步订单</el-button>
      <el-button :loading="syncingRefunds" @click="syncRefunds">同步退款</el-button>
    </template>

    <el-alert
      :title="`${platformTitle}开放平台真实接口尚未接入`"
      description="当前页面已经接入统一平台适配层。同步接口会返回占位结果；自动发货会转入人工处理，后续拿到平台授权后只需要替换适配器。"
      type="warning"
      :closable="false"
      show-icon
    />

    <div class="metric-grid metric-grid--four">
      <MetricCard label="订单数" :value="total" hint="当前平台筛选结果" tone="blue" />
      <MetricCard label="待发货" :value="pendingCount" hint="当前页" tone="orange" />
      <MetricCard label="人工处理" :value="manualCount" hint="当前页" tone="purple" />
      <MetricCard label="已发货" :value="deliveredCount" hint="当前页" tone="green" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.deliveryStatus"
        v-model:density="density"
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

      <el-empty
        v-if="!platforms.length && !loading"
        :description="`暂无启用的${platformTitle}来源平台，请先到来源平台设置添加。`"
      />
      <el-table
        v-else
        v-loading="loading"
        :data="orders"
        :size="tableSize"
        empty-text="暂无平台订单"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
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
            <el-tag :type="getDeliveryStatusType(row.deliveryStatus)" size="small" effect="light">
              {{ getDeliveryStatusLabel(row.deliveryStatus) }}
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
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button
              text
              type="primary"
              :disabled="row.deliveryStatus === 'delivered'"
              @click="platformDeliver(row)"
            >
              平台发货
            </el-button>
            <el-button
              text
              type="warning"
              :disabled="row.deliveryStatus === 'delivered' || row.deliveryStatus === 'manual'"
              @click="markManual(row)"
            >
              转人工
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
          @current-change="loadOrders"
          @size-change="loadOrders"
        />
      </div>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  codeOrdersApi,
  platformDeliveryApi,
  sourcePlatformsApi,
  userTableViewsApi,
  type PlatformSyncResult
} from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  CodePlatformOrder,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';

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
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadPlatforms() {
  const data = await sourcePlatformsApi.list({
    page: 1,
    pageSize: 100,
    type: props.platform,
    status: 'active'
  });
  platforms.value = data.items;
  if (!query.platformId) {
    query.platformId = platforms.value[0]?.id ?? '';
  }
}

async function loadOrders() {
  loading.value = true;
  try {
    const data = await codeOrdersApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      platformId: query.platformId || undefined,
      deliveryStatus: query.deliveryStatus || undefined,
      sortBy: mapSortProp(sortConfig.value.prop),
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    orders.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `加载${props.platformTitle}订单失败`);
  } finally {
    loading.value = false;
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

function handleSelectionChange(rows: CodePlatformOrder[]) {
  selectedOrders.value = rows;
}

async function reloadAll() {
  try {
    await loadPlatforms();
    await loadOrders();
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
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
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
  density.value = view.density;
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
      `${props.platformTitle}真实发货接口当前是占位适配器，执行后会转入人工处理。`,
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
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '转人工失败');
  }
}

async function initializePage() {
  try {
    await loadPlatforms();
    await loadTableViews(true);
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `加载${props.platformTitle}订单失败`);
  }
}

onMounted(initializePage);
</script>
