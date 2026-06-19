<template>
  <PageScaffold
    title="售后补发"
    group="兑换码自动发货"
    phase="Phase 6"
    description="处理已发货兑换码的售后补发，记录原码、新码、损耗成本和处理状态。"
  >
    <div class="metric-grid metric-grid--four">
      <MetricCard label="售后单" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="待处理" :value="pendingCount" hint="当前页" tone="orange" />
      <MetricCard label="已补发" :value="reissuedCount" hint="当前页" tone="green" />
      <MetricCard label="已完成" :value="completedCount" hint="当前页" tone="purple" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="afterSaleColumnOptions"
        :status-options="afterSaleStatusOptions"
        :saved-views="savedViews"
        :selected-count="selectedAfterSales.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增售后单"
        placeholder="搜索订单号、原码尾号、新码尾号、原因"
        @search="handleSearch"
        @refresh="reloadAll"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      />

      <el-table
        v-loading="loading"
        :data="afterSales"
        :size="tableSize"
        empty-text="暂无售后补发记录"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('afterSale')"
          prop="createdAt"
          label="售后单"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.id.slice(0, 8) }}
            <div class="muted-block">{{ formatDate(row.createdAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('order')" label="订单" min-width="190">
          <template #default="{ row }">
            {{ row.order.externalOrderNo }}
            <div class="muted-block">{{ row.order.platform.name }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务/面值" min-width="180">
          <template #default="{ row }">
            {{ row.order.service?.name ?? '-' }}
            <div class="muted-block">面值 {{ row.originalCode.faceValue }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('codes')" label="原码/新码" min-width="160">
          <template #default="{ row }">
            原 {{ row.originalCode.codeTail }}
            <div class="muted-block">新 {{ row.newCode?.codeTail ?? '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('loss')" label="损耗" width="100">
          <template #default="{ row }">{{ row.newCode?.cost ?? '0.00' }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="getAfterSaleStatusType(row.status)" size="small" effect="light">
              {{ getAfterSaleStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('completedAt')"
          prop="completedAt"
          label="完成时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button
              text
              type="warning"
              :disabled="row.status !== 'pending' || Boolean(row.newCodeId)"
              @click="openReissue(row)"
            >
              补发
            </el-button>
            <el-button
              text
              type="success"
              :disabled="row.status !== 'pending' || !row.newCodeId"
              @click="completeAfterSale(row)"
            >
              完成
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
          @current-change="loadAfterSales"
          @size-change="loadAfterSales"
        />
      </div>
    </section>

    <el-dialog v-model="createDialogVisible" title="新增售后单" width="680px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="已发货订单" prop="orderId">
          <el-select
            v-model="createForm.orderId"
            class="full-input"
            filterable
            placeholder="选择已发货订单"
            @change="handleOrderChange"
          >
            <el-option
              v-for="order in deliveredOrders"
              :key="order.id"
              :label="`${order.externalOrderNo} · ${order.platform.name}`"
              :value="order.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="原兑换码">
          <el-select v-model="createForm.originalCodeId" class="full-input" clearable>
            <el-option
              v-for="code in selectedOrder?.deliveredCodes ?? []"
              :key="code.id"
              :label="`尾号 ${code.codeTail} · 面值 ${code.faceValue}`"
              :value="code.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="售后原因" prop="reason">
          <el-input
            v-model.trim="createForm.reason"
            type="textarea"
            :rows="4"
            placeholder="例如：客户反馈兑换失败，需要补发同面值兑换码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAfterSale">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reissueDialogVisible" title="售后补发" width="680px">
      <el-alert
        title="补发会自动选择同业务、同面值的未售兑换码，并把补发成本计入原订单利润。"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-form ref="reissueFormRef" :model="reissueForm" label-position="top">
        <el-form-item label="售后单">
          <el-input :model-value="selectedAfterSale?.order.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="发货方式">
          <el-select v-model="reissueForm.deliveryMethod" class="full-input">
            <el-option label="手工发货" value="manual" />
            <el-option label="电子凭证" value="eticket" />
            <el-option label="虚拟无需物流" value="dummy_send" />
            <el-option label="消息卡片" value="message_card" />
          </el-select>
        </el-form-item>
        <el-form-item label="发货内容快照">
          <el-input
            v-model="reissueForm.deliveryContent"
            type="textarea"
            :rows="7"
            placeholder="留空时系统会生成包含新兑换码的补发内容"
          />
        </el-form-item>
        <el-form-item v-if="generatedContent" label="本次补发内容">
          <el-input v-model="generatedContent" type="textarea" :rows="7" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reissueDialogVisible = false">关闭</el-button>
        <el-button type="warning" :loading="reissuing" @click="reissueAfterSale">
          确认补发
        </el-button>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="detailVisible"
      :title="`售后单 · ${selectedAfterSale?.id.slice(0, 8) ?? ''}`"
    >
      <el-descriptions v-if="selectedAfterSale" :column="1" border>
        <el-descriptions-item label="订单号">
          {{ selectedAfterSale.order.externalOrderNo }}
        </el-descriptions-item>
        <el-descriptions-item label="平台">
          {{ selectedAfterSale.order.platform.name }}
        </el-descriptions-item>
        <el-descriptions-item label="原码">
          尾号 {{ selectedAfterSale.originalCode.codeTail }} · 成本
          {{ selectedAfterSale.originalCode.cost }}
        </el-descriptions-item>
        <el-descriptions-item label="新码">
          <span v-if="selectedAfterSale.newCode">
            尾号 {{ selectedAfterSale.newCode.codeTail }} · 成本
            {{ selectedAfterSale.newCode.cost }}
          </span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ getAfterSaleStatusLabel(selectedAfterSale.status) }}
        </el-descriptions-item>
        <el-descriptions-item label="原因">
          {{ selectedAfterSale.reason }}
        </el-descriptions-item>
      </el-descriptions>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { codeAfterSalesApi, codeOrdersApi, userTableViewsApi } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  CodeAfterSale,
  CodeDeliveryLog,
  CodePlatformOrder,
  TableDensity,
  UserTableView
} from '@/types/system';

const tableKey = 'code_after_sales';
const afterSaleStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已完成', value: 'completed' },
  { label: '已拒绝', value: 'rejected' }
];
const afterSaleColumnOptions = [
  { label: '售后单', value: 'afterSale', required: true },
  { label: '订单', value: 'order' },
  { label: '业务/面值', value: 'service' },
  { label: '原码/新码', value: 'codes' },
  { label: '损耗', value: 'loss' },
  { label: '状态', value: 'status' },
  { label: '完成时间', value: 'completedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const reissuing = ref(false);
const createDialogVisible = ref(false);
const reissueDialogVisible = ref(false);
const detailVisible = ref(false);
const afterSales = ref<CodeAfterSale[]>([]);
const deliveredOrders = ref<CodePlatformOrder[]>([]);
const selectedAfterSales = ref<CodeAfterSale[]>([]);
const selectedOrder = ref<CodePlatformOrder | null>(null);
const selectedAfterSale = ref<CodeAfterSale | null>(null);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const generatedContent = ref('');
const total = ref(0);
const createFormRef = ref<FormInstance>();

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const createForm = reactive({
  orderId: '',
  originalCodeId: '',
  reason: ''
});

const reissueForm = reactive({
  deliveryMethod: 'manual' as CodeDeliveryLog['deliveryMethod'],
  deliveryContent: ''
});

const createRules: FormRules<typeof createForm> = {
  orderId: [{ required: true, message: '请选择已发货订单', trigger: 'change' }],
  reason: [{ required: true, message: '请输入售后原因', trigger: 'blur' }]
};

const pendingCount = computed(
  () => afterSales.value.filter((item) => item.status === 'pending').length
);
const reissuedCount = computed(() => afterSales.value.filter((item) => item.newCodeId).length);
const completedCount = computed(
  () => afterSales.value.filter((item) => item.status === 'completed').length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getAfterSaleStatusLabel(status: CodeAfterSale['status']) {
  const labels: Record<CodeAfterSale['status'], string> = {
    pending: '待处理',
    completed: '已完成',
    rejected: '已拒绝'
  };
  return labels[status];
}

function getAfterSaleStatusType(status: CodeAfterSale['status']) {
  if (status === 'pending') {
    return 'warning';
  }
  if (status === 'completed') {
    return 'success';
  }
  return 'danger';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadAfterSales() {
  loading.value = true;
  try {
    const data = await codeAfterSalesApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      sortBy: mapSortProp(sortConfig.value.prop),
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    afterSales.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载售后补发失败');
  } finally {
    loading.value = false;
  }
}

async function loadDeliveredOrders() {
  const data = await codeOrdersApi.list({
    page: 1,
    pageSize: 100,
    deliveryStatus: 'delivered'
  });
  deliveredOrders.value = data.items;
}

async function handleSearch() {
  query.page = 1;
  await loadAfterSales();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadAfterSales();
}

function handleSelectionChange(rows: CodeAfterSale[]) {
  selectedAfterSales.value = rows;
}

async function reloadAll() {
  try {
    await Promise.all([loadDeliveredOrders(), loadAfterSales()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新售后补发失败');
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  void key;
  // 当前售后列表暂无额外筛选项，保留钩子便于后续扩展。
}

function exportList() {
  ElMessage.info('售后补发导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存售后补发视图', {
      inputValue: '售后补发常用视图',
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
        : afterSaleColumnOptions.map((column) => column.value),
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
  await loadAfterSales();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        afterSaleColumnOptions.some((option) => option.value === column)
      )
    : afterSaleColumnOptions.map((column) => column.value);
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
  if (prop === 'createdAt') return 'createdAt';
  if (prop === 'status') return 'status';
  if (prop === 'completedAt') return 'completedAt';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function openCreate() {
  createForm.orderId = deliveredOrders.value[0]?.id ?? '';
  createForm.originalCodeId = '';
  createForm.reason = '';
  handleOrderChange();
  createDialogVisible.value = true;
}

function handleOrderChange() {
  selectedOrder.value =
    deliveredOrders.value.find((order) => order.id === createForm.orderId) ?? null;
  createForm.originalCodeId = selectedOrder.value?.deliveredCodes[0]?.id ?? '';
}

async function saveAfterSale() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    await codeAfterSalesApi.create({
      orderId: createForm.orderId,
      originalCodeId: createForm.originalCodeId || null,
      reason: createForm.reason
    });
    ElMessage.success('售后单已创建');
    createDialogVisible.value = false;
    await reloadAll();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建售后单失败');
  } finally {
    saving.value = false;
  }
}

function openDetail(afterSale: CodeAfterSale) {
  selectedAfterSale.value = afterSale;
  detailVisible.value = true;
}

function openReissue(afterSale: CodeAfterSale) {
  selectedAfterSale.value = afterSale;
  generatedContent.value = '';
  reissueForm.deliveryMethod = 'manual';
  reissueForm.deliveryContent = '';
  reissueDialogVisible.value = true;
}

async function reissueAfterSale() {
  if (!selectedAfterSale.value) {
    return;
  }

  reissuing.value = true;
  try {
    const data = await codeAfterSalesApi.reissue(selectedAfterSale.value.id, {
      deliveryMethod: reissueForm.deliveryMethod,
      deliveryContent: reissueForm.deliveryContent || null
    });
    generatedContent.value = data.deliveryContent;
    selectedAfterSale.value = data.afterSale;
    ElMessage.success(`已补发兑换码，尾号 ${data.codeTail}`);
    await reloadAll();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '售后补发失败');
  } finally {
    reissuing.value = false;
  }
}

async function completeAfterSale(afterSale: CodeAfterSale) {
  try {
    await ElMessageBox.confirm('确认该售后补发已经处理完成？', '完成售后', {
      confirmButtonText: '确认完成',
      cancelButtonText: '取消',
      type: 'warning'
    });
  } catch {
    return;
  }

  try {
    await codeAfterSalesApi.complete(afterSale.id);
    ElMessage.success('售后单已完成');
    await reloadAll();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '完成售后单失败');
  }
}

async function initializePage() {
  try {
    await loadDeliveredOrders();
    await loadTableViews(true);
    await loadAfterSales();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载售后补发失败');
  }
}

onMounted(initializePage);
</script>
