<template>
  <PageScaffold
    title="Apple ID 订单管理"
    group="Apple ID 业务"
    phase="Phase 4"
    description="查看 Apple ID 订单、开通记录、余额消耗和利润。订单创建后会自动生成消费流水和开通记录。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="订单数量" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="当前页实收" :value="sumField('paidAmount')" hint="人民币" tone="green" />
      <MetricCard
        label="当前页成本"
        :value="sumField('appleCostRmb')"
        hint="Apple 余额成本"
        tone="orange"
      />
      <MetricCard
        label="当前页利润"
        :value="sumField('profitAmount')"
        hint="实收减成本费用"
        tone="red"
      />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
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
        :data="orders"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
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
          <template #default="{ row }">
            {{ row.paidAmount }} / {{ row.appleCostRmb }} / {{ row.profitAmount }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('consumed')"
          prop="appleCostValue"
          label="消耗"
          width="120"
          sortable="custom"
        >
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
          <template #default="{ row }">{{ formatDate(row.expireTime) }}</template>
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
          @current-change="loadOrders"
          @size-change="loadOrders"
        />
      </div>
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
          {{ formatDate(selectedOrder?.startTime) }} -> {{ formatDate(selectedOrder?.expireTime) }}
        </el-descriptions-item>
        <el-descriptions-item label="开通记录 ID">
          <el-button
            v-if="selectedOrder?.activationId"
            text
            type="primary"
            @click="router.push('/apple/activations')"
          >
            {{ selectedOrder.activationId }}
          </el-button>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注">
          {{ selectedOrder?.remark ?? '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleOrdersApi, userTableViewsApi } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { AppleOrder, TableDensity, UserTableView } from '@/types/system';

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

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
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

function getStatusType(status: AppleOrder['status']) {
  return status === 'active'
    ? 'success'
    : status === 'pending'
      ? 'warning'
      : status === 'abnormal'
        ? 'danger'
        : 'info';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadOrders() {
  loading.value = true;
  try {
    const data = await appleOrdersApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      sortBy: mapSortProp(sortConfig.value.prop),
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    orders.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 订单失败');
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
  density.value = view.density;
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
  await loadOrders();
}

onMounted(initializePage);
</script>
