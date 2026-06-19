<template>
  <PageScaffold
    title="兑换码库存"
    group="兑换码自动发货"
    phase="Phase 6"
    description="管理兑换码批次、尾号、面值、成本和库存状态。完整兑换码已加密保存，列表只显示尾号。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="库存记录" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="未售" :value="unsoldCount" hint="当前页" tone="green" />
      <MetricCard label="锁定中" :value="lockedCount" hint="当前页" tone="orange" />
      <MetricCard label="已发货" :value="deliveredCount" hint="当前页" tone="purple" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="inventoryColumnOptions"
        :status-options="inventoryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedCodes.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="批量导入兑换码"
        placeholder="搜索尾号、批次、业务、备注"
        @search="handleSearch"
        @refresh="reloadAll"
        @primary="openImport"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.serviceId"
            class="table-toolbar__select"
            clearable
            placeholder="业务"
            @change="handleSearch"
          >
            <el-option
              v-for="service in services"
              :key="service.id"
              :label="`${service.name} · ${service.faceValue}`"
              :value="service.id"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="inventory"
        :size="tableSize"
        row-key="id"
        empty-text="暂无兑换码库存"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('codeTail')"
          prop="codeTail"
          label="兑换码尾号"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag effect="light">尾号 {{ row.codeTail }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务" min-width="180">
          <template #default="{ row }">
            {{ row.service.name }}
            <div class="muted-block">面值 {{ row.faceValue }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('cost')"
          prop="cost"
          label="成本"
          width="110"
          sortable="custom"
        />
        <el-table-column v-if="isColumnVisible('batch')" label="批次" min-width="170">
          <template #default="{ row }">
            {{ row.batch.batchNo }}
            <div class="muted-block">{{ formatDate(row.batch.createdAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('delivery')" label="发货信息" min-width="170">
          <template #default="{ row }">
            <span v-if="row.deliveredOrderId">订单 {{ row.deliveredOrderId }}</span>
            <span v-else-if="row.lockedOrderId">锁定 {{ row.lockedOrderId }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expireAt')"
          prop="expireAt"
          label="有效期"
          min-width="150"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.expireAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('createdAt')"
          prop="createdAt"
          label="入库时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-if="canRevealCode" text type="warning" @click="openRevealDialog(row)">
              查看完整码
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
          @current-change="loadInventory"
          @size-change="loadInventory"
        />
      </div>
    </section>

    <el-dialog v-model="importDialogVisible" title="批量导入兑换码" width="760px">
      <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-position="top">
        <div class="form-grid">
          <el-form-item label="兑换码业务" prop="serviceId">
            <el-select v-model="importForm.serviceId" class="full-input" filterable>
              <el-option
                v-for="service in services"
                :key="service.id"
                :label="`${service.name} · 面值 ${service.faceValue}`"
                :value="service.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="批次号">
            <el-input v-model.trim="importForm.batchNo" placeholder="留空自动生成" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="默认成本">
            <el-input v-model.trim="importForm.defaultCost" placeholder="留空使用业务默认成本" />
          </el-form-item>
          <el-form-item label="统一有效期">
            <el-date-picker
              v-model="importForm.expireAt"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
              placeholder="可选"
            />
          </el-form-item>
        </div>
        <el-form-item label="兑换码内容" prop="codesText">
          <el-input
            v-model="importForm.codesText"
            type="textarea"
            :rows="10"
            placeholder="一行一个兑换码。完整内容会加密保存，列表只显示后 4 位。"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="importForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="importResult"
        class="result-alert"
        :title="`导入完成：成功 ${importResult.successCount} 条，失败 ${importResult.failedCount} 条`"
        :type="importResult.failedCount ? 'warning' : 'success'"
        show-icon
        :closable="false"
      />
      <el-table
        v-if="importResult?.errors.length"
        class="result-table"
        :data="importResult.errors"
        max-height="220"
      >
        <el-table-column prop="rowNo" label="行号" width="90" />
        <el-table-column prop="codeTail" label="尾号" width="110" />
        <el-table-column prop="reason" label="失败原因" />
      </el-table>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>

    <AppDrawer v-model="detailVisible" :title="`兑换码库存 · 尾号 ${selectedCode?.codeTail ?? ''}`">
      <el-descriptions v-if="selectedCode" :column="1" border>
        <el-descriptions-item label="业务">{{ selectedCode.service.name }}</el-descriptions-item>
        <el-descriptions-item label="批次">{{ selectedCode.batch.batchNo }}</el-descriptions-item>
        <el-descriptions-item label="面值">{{ selectedCode.faceValue }}</el-descriptions-item>
        <el-descriptions-item label="成本">{{ selectedCode.cost }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          {{ getStatusLabel(selectedCode.status) }}
        </el-descriptions-item>
        <el-descriptions-item label="有效期">
          {{ formatDate(selectedCode.expireAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ selectedCode.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </AppDrawer>

    <el-dialog
      v-model="revealDialogVisible"
      title="查看完整兑换码"
      width="560px"
      @closed="resetRevealDialog"
    >
      <el-alert
        title="完整兑换码属于敏感信息，查看原因会写入审计日志。"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-form
        ref="revealFormRef"
        class="reveal-form"
        :model="revealForm"
        :rules="revealRules"
        label-position="top"
      >
        <el-form-item label="库存记录">
          <el-input :model-value="revealRecordLabel" disabled />
        </el-form-item>
        <el-form-item label="查看原因" prop="reason">
          <el-input
            v-model.trim="revealForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如：售后核对、人工发货给客户"
          />
        </el-form-item>
        <el-form-item v-if="revealForm.code" label="完整兑换码">
          <el-input v-model="revealForm.code" type="textarea" :rows="3" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="revealDialogVisible = false">关闭</el-button>
        <el-button type="warning" :loading="revealing" @click="revealCode">查看完整码</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { codeServicesApi, redeemCodesApi, userTableViewsApi } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { useAuthStore } from '@/stores/auth';
import type {
  CodeService,
  RedeemCodeImportResult,
  RedeemCodeInventoryItem,
  TableDensity,
  UserTableView
} from '@/types/system';

const tableKey = 'code_inventory';
const inventoryStatusOptions = [
  { label: '未售', value: 'unsold' },
  { label: '锁定中', value: 'locked' },
  { label: '已发货', value: 'delivered' },
  { label: '发货失败', value: 'delivery_failed' },
  { label: '售后中', value: 'after_sale' },
  { label: '已补发', value: 'reissued' },
  { label: '已作废', value: 'voided' },
  { label: '已退款', value: 'refunded' }
];
const inventoryColumnOptions = [
  { label: '兑换码尾号', value: 'codeTail', required: true },
  { label: '业务', value: 'service' },
  { label: '成本', value: 'cost' },
  { label: '批次', value: 'batch' },
  { label: '状态', value: 'status' },
  { label: '发货信息', value: 'delivery' },
  { label: '有效期', value: 'expireAt' },
  { label: '入库时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const authStore = useAuthStore();
const loading = ref(false);
const importing = ref(false);
const revealing = ref(false);
const importDialogVisible = ref(false);
const detailVisible = ref(false);
const revealDialogVisible = ref(false);
const services = ref<CodeService[]>([]);
const inventory = ref<RedeemCodeInventoryItem[]>([]);
const selectedCode = ref<RedeemCodeInventoryItem | null>(null);
const selectedRevealCode = ref<RedeemCodeInventoryItem | null>(null);
const selectedCodes = ref<RedeemCodeInventoryItem[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const importResult = ref<RedeemCodeImportResult | null>(null);
const importFormRef = ref<FormInstance>();
const revealFormRef = ref<FormInstance>();

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  serviceId: ''
});

const importForm = reactive({
  serviceId: '',
  batchNo: '',
  defaultCost: '',
  expireAt: '',
  remark: '',
  codesText: ''
});

const revealForm = reactive({
  reason: '',
  code: ''
});

const importRules: FormRules<typeof importForm> = {
  serviceId: [{ required: true, message: '请选择兑换码业务', trigger: 'change' }],
  codesText: [{ required: true, message: '请输入兑换码内容', trigger: 'blur' }]
};

const revealRules: FormRules<typeof revealForm> = {
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const unsoldCount = computed(
  () => inventory.value.filter((item) => item.status === 'unsold').length
);
const lockedCount = computed(
  () => inventory.value.filter((item) => item.status === 'locked').length
);
const deliveredCount = computed(
  () => inventory.value.filter((item) => item.status === 'delivered').length
);
const canRevealCode = computed(
  () =>
    authStore.user?.roles.includes('admin') ||
    authStore.user?.permissions.includes('code.inventory.view_full')
);
const revealRecordLabel = computed(() => {
  if (!selectedRevealCode.value) {
    return '-';
  }

  return `${selectedRevealCode.value.service.name} · 尾号 ${selectedRevealCode.value.codeTail}`;
});
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const serviceLabel = services.value.find((service) => service.id === query.serviceId)?.name;
  if (query.serviceId && serviceLabel) {
    chips.push({ key: 'serviceId', label: '业务', value: serviceLabel });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getStatusLabel(status: RedeemCodeInventoryItem['status']) {
  const labels: Record<RedeemCodeInventoryItem['status'], string> = {
    unsold: '未售',
    locked: '锁定中',
    delivered: '已发货',
    delivery_failed: '发货失败',
    after_sale: '售后中',
    reissued: '已补发',
    voided: '已作废',
    refunded: '已退款'
  };
  return labels[status];
}

function getStatusType(status: RedeemCodeInventoryItem['status']) {
  if (status === 'unsold') {
    return 'success';
  }
  if (status === 'locked') {
    return 'warning';
  }
  if (status === 'delivered' || status === 'reissued') {
    return 'info';
  }
  if (status === 'delivery_failed') {
    return 'danger';
  }
  return 'info';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadServices() {
  const data = await codeServicesApi.list({
    page: 1,
    pageSize: 100,
    status: 'enabled'
  });
  services.value = data.items;
}

async function loadInventory() {
  loading.value = true;
  try {
    const data = await redeemCodesApi.listInventory({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      serviceId: query.serviceId || undefined,
      sortBy: mapSortProp(sortConfig.value.prop),
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    inventory.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码库存失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadInventory();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadInventory();
}

function handleSelectionChange(rows: RedeemCodeInventoryItem[]) {
  selectedCodes.value = rows;
}

async function reloadAll() {
  try {
    await Promise.all([loadServices(), loadInventory()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新兑换码库存失败');
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.serviceId = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'serviceId') {
    query.serviceId = '';
  }
}

function exportList() {
  ElMessage.info('兑换码库存导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存兑换码库存视图', {
      inputValue: '兑换码库存常用视图',
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
        status: query.status,
        serviceId: query.serviceId
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : inventoryColumnOptions.map((column) => column.value),
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
  await loadInventory();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.serviceId = typeof filters.serviceId === 'string' ? filters.serviceId : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        inventoryColumnOptions.some((option) => option.value === column)
      )
    : inventoryColumnOptions.map((column) => column.value);
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
  if (prop === 'codeTail') return 'codeTail';
  if (prop === 'cost') return 'cost';
  if (prop === 'status') return 'status';
  if (prop === 'expireAt') return 'expireAt';
  if (prop === 'createdAt') return 'createdAt';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function openImport() {
  importForm.serviceId = services.value[0]?.id ?? '';
  importForm.batchNo = '';
  importForm.defaultCost = '';
  importForm.expireAt = '';
  importForm.remark = '';
  importForm.codesText = '';
  importResult.value = null;
  importDialogVisible.value = true;
}

function openDetail(code: RedeemCodeInventoryItem) {
  selectedCode.value = code;
  detailVisible.value = true;
}

function openRevealDialog(code: RedeemCodeInventoryItem) {
  selectedRevealCode.value = code;
  revealForm.reason = '';
  revealForm.code = '';
  revealDialogVisible.value = true;
}

function resetRevealDialog() {
  selectedRevealCode.value = null;
  revealForm.reason = '';
  revealForm.code = '';
}

async function submitImport() {
  const valid = await importFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const codes = importForm.codesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!codes.length) {
    ElMessage.warning('请输入至少一个兑换码');
    return;
  }

  importing.value = true;
  try {
    const result = await redeemCodesApi.importBatch({
      serviceId: importForm.serviceId,
      batchNo: importForm.batchNo || null,
      defaultCost: importForm.defaultCost || null,
      expireAt: importForm.expireAt || null,
      remark: importForm.remark || null,
      codes
    });
    importResult.value = result;
    ElMessage.success(`成功导入 ${result.successCount} 条兑换码`);
    await loadInventory();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入兑换码失败');
  } finally {
    importing.value = false;
  }
}

async function revealCode() {
  const valid = await revealFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedRevealCode.value) {
    return;
  }

  revealing.value = true;
  try {
    const data = await redeemCodesApi.reveal(selectedRevealCode.value.id, {
      reason: revealForm.reason
    });
    revealForm.code = data.redeemCode;
    ElMessage.success('完整兑换码已显示并写入审计日志');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整兑换码失败');
  } finally {
    revealing.value = false;
  }
}

async function initializePage() {
  try {
    await loadServices();
    await loadTableViews(true);
    await loadInventory();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码库存失败');
  }
}

onMounted(initializePage);
</script>

<style scoped>
.result-alert {
  margin-top: 12px;
}

.result-table {
  margin-top: 12px;
}

.reveal-form {
  margin-top: 16px;
}
</style>
