<template>
  <PageScaffold
    title="兑换码订单"
    group="兑换码自动发货"
    phase="Phase 6"
    description="处理手工订单导入、平台映射识别、锁定未售兑换码和生成半自动发货内容。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="订单数" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="待发货" :value="pendingCount" hint="当前页" tone="orange" />
      <MetricCard label="已锁码" :value="lockedCount" hint="当前页" tone="green" />
      <MetricCard label="发货失败" :value="failedCount" hint="当前页" tone="red" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.deliveryStatus"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="orderColumnOptions"
        :status-options="deliveryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedOrders.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="手工导入订单"
        placeholder="搜索订单号、买家、商品、SKU、业务"
        @search="handleSearch"
        @refresh="reloadAll"
        @primary="openCreate"
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
        <el-table-column v-if="isColumnVisible('service')" label="匹配业务" min-width="170">
          <template #default="{ row }">
            <span v-if="row.service">{{ row.service.name }}</span>
            <el-tag v-else type="warning" size="small">未匹配</el-tag>
            <div class="muted-block">面值 {{ row.faceValue || '-' }} × {{ row.quantity }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('amounts')"
          prop="paidAmount"
          label="金额"
          width="150"
          sortable="custom"
        >
          <template #default="{ row }">
            实收 {{ row.paidAmount }}
            <div class="muted-block">利润 {{ row.profitAmount }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('locked')" label="锁码" width="100">
          <template #default="{ row }">
            <el-tag :type="row.lockedCodeCount ? 'success' : 'info'" size="small">
              {{ row.lockedCodeCount }}/{{ row.quantity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('deliveryStatus')"
          prop="deliveryStatus"
          label="发货状态"
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
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="warning" @click="matchCode(row)">匹配锁码</el-button>
            <el-button text @click="openGenerate(row)">生成发货</el-button>
            <el-button
              text
              type="success"
              :disabled="row.deliveryStatus === 'delivered'"
              @click="openDeliver(row)"
            >
              确认发货
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

    <el-dialog v-model="dialogVisible" title="手工导入兑换码订单" width="760px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="平台" prop="platformId">
            <el-select v-model="form.platformId" class="full-input" filterable>
              <el-option
                v-for="platform in platforms"
                :key="platform.id"
                :label="platform.name"
                :value="platform.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="平台订单号" prop="externalOrderNo">
            <el-input v-model.trim="form.externalOrderNo" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="商品 ID" prop="itemId">
            <el-input v-model.trim="form.itemId" />
          </el-form-item>
          <el-form-item label="SKU ID">
            <el-input v-model.trim="form.skuId" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="商品标题">
            <el-input v-model.trim="form.itemTitle" />
          </el-form-item>
          <el-form-item label="SKU 名称">
            <el-input v-model.trim="form.skuName" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="兑换码业务">
            <el-select v-model="form.serviceId" class="full-input" clearable filterable>
              <el-option
                v-for="service in services"
                :key="service.id"
                :label="`${service.name} · ${service.faceValue}`"
                :value="service.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="面值">
            <el-input v-model.trim="form.faceValue" placeholder="留空使用映射或业务面值" />
          </el-form-item>
          <el-form-item label="数量">
            <el-input-number v-model="form.quantity" :min="1" class="full-input" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="实付金额">
            <el-input v-model.trim="form.paidAmount" />
          </el-form-item>
          <el-form-item label="平台手续费">
            <el-input v-model.trim="form.platformFee" />
          </el-form-item>
          <el-form-item label="买家脱敏">
            <el-input v-model.trim="form.buyerNameMasked" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveOrder">保存</el-button>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="detailVisible"
      :title="`兑换码订单 · ${selectedOrder?.externalOrderNo ?? ''}`"
    >
      <el-descriptions v-if="selectedOrder" :column="1" border>
        <el-descriptions-item label="平台">{{ selectedOrder.platform.name }}</el-descriptions-item>
        <el-descriptions-item label="商品">{{
          selectedOrder.itemTitle || selectedOrder.itemId
        }}</el-descriptions-item>
        <el-descriptions-item label="业务">{{
          selectedOrder.service?.name || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="面值/数量">
          {{ selectedOrder.faceValue || '-' }} × {{ selectedOrder.quantity }}
        </el-descriptions-item>
        <el-descriptions-item label="锁定兑换码">
          <el-tag
            v-for="code in selectedOrder.lockedCodes"
            :key="code.id"
            class="tag-gap"
            size="small"
          >
            尾号 {{ code.codeTail }}
          </el-tag>
          <span v-if="!selectedOrder.lockedCodes.length">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="成本/利润">
          {{ selectedOrder.costAmount }} / {{ selectedOrder.profitAmount }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="drawer-section">
        <div class="drawer-section__title">发货记录</div>
        <el-table :data="deliveryLogs" size="small">
          <el-table-column label="尾号" width="90">
            <template #default="{ row }">尾号 {{ row.code.codeTail }}</template>
          </el-table-column>
          <el-table-column label="方式" width="100">
            <template #default="{ row }">{{ getDeliveryMethodLabel(row.deliveryMethod) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.deliveryStatus === 'success' ? 'success' : 'danger'" size="small">
                {{ row.deliveryStatus === 'success' ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="利润" width="90" prop="profit" />
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!deliveryLogs.length" description="暂无发货记录" :image-size="80" />
      </div>
    </AppDrawer>

    <el-dialog v-model="generateDialogVisible" title="生成发货内容" width="620px">
      <el-form
        ref="generateFormRef"
        :model="generateForm"
        :rules="generateRules"
        label-position="top"
      >
        <el-form-item label="订单">
          <el-input :model-value="selectedOrder?.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="生成原因" prop="reason">
          <el-input
            v-model.trim="generateForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如：手工复制发货给客户"
          />
        </el-form-item>
        <el-form-item v-if="generateForm.content" label="发货内容">
          <el-input v-model="generateForm.content" type="textarea" :rows="7" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="generating" @click="generateDelivery"> 生成 </el-button>
        <el-button
          type="success"
          :disabled="!generateForm.content"
          :loading="delivering"
          @click="confirmDeliveryFromGenerated"
        >
          确认发货
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="deliverDialogVisible" title="确认兑换码发货" width="640px">
      <el-alert
        title="确认后会把锁定兑换码标记为已发货，并写入发货日志；同一订单不能重复发货。"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-form ref="deliverFormRef" :model="deliverForm" :rules="deliverRules" label-position="top">
        <el-form-item label="订单">
          <el-input :model-value="selectedOrder?.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="发货方式">
          <el-select v-model="deliverForm.deliveryMethod" class="full-input">
            <el-option label="手工发货" value="manual" />
            <el-option label="电子凭证" value="eticket" />
            <el-option label="虚拟无需物流" value="dummy_send" />
            <el-option label="消息卡片" value="message_card" />
          </el-select>
        </el-form-item>
        <el-form-item label="发货内容快照" prop="deliveryContent">
          <el-input
            v-model="deliverForm.deliveryContent"
            type="textarea"
            :rows="7"
            placeholder="请先生成发货内容，或粘贴实际发给客户的内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliverDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="delivering" @click="confirmDelivery">
          确认发货
        </el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  codeOrdersApi,
  codeServicesApi,
  sourcePlatformsApi,
  userTableViewsApi
} from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  CodeDeliveryLog,
  CodePlatformOrder,
  CodeService,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';

const tableKey = 'code_orders';
const deliveryStatusOptions = [
  { label: '待发货', value: 'pending' },
  { label: '已发货', value: 'delivered' },
  { label: '失败', value: 'failed' },
  { label: '人工处理', value: 'manual' }
];
const orderColumnOptions = [
  { label: '订单', value: 'order', required: true },
  { label: '商品/SKU', value: 'item' },
  { label: '匹配业务', value: 'service' },
  { label: '金额', value: 'amounts' },
  { label: '锁码', value: 'locked' },
  { label: '发货状态', value: 'deliveryStatus' },
  { label: '创建时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const generating = ref(false);
const delivering = ref(false);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const generateDialogVisible = ref(false);
const deliverDialogVisible = ref(false);
const orders = ref<CodePlatformOrder[]>([]);
const deliveryLogs = ref<CodeDeliveryLog[]>([]);
const platforms = ref<SourcePlatform[]>([]);
const services = ref<CodeService[]>([]);
const selectedOrder = ref<CodePlatformOrder | null>(null);
const selectedOrders = ref<CodePlatformOrder[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const generatedOrderId = ref('');
const total = ref(0);
const formRef = ref<FormInstance>();
const generateFormRef = ref<FormInstance>();
const deliverFormRef = ref<FormInstance>();

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  platformId: '',
  deliveryStatus: ''
});

const form = reactive({
  platformId: '',
  externalOrderNo: '',
  buyerId: '',
  buyerNameMasked: '',
  itemId: '',
  skuId: '',
  itemTitle: '',
  skuName: '',
  serviceId: '',
  faceValue: '',
  quantity: 1,
  paidAmount: '0',
  platformFee: '0'
});

const generateForm = reactive({
  reason: '',
  content: ''
});

const deliverForm = reactive({
  deliveryMethod: 'manual' as CodeDeliveryLog['deliveryMethod'],
  deliveryContent: ''
});

const rules: FormRules<typeof form> = {
  platformId: [{ required: true, message: '请选择平台', trigger: 'change' }],
  externalOrderNo: [{ required: true, message: '请输入平台订单号', trigger: 'blur' }],
  itemId: [{ required: true, message: '请输入商品 ID', trigger: 'blur' }]
};

const generateRules: FormRules<typeof generateForm> = {
  reason: [{ required: true, message: '请输入生成原因', trigger: 'blur' }]
};

const deliverRules: FormRules<typeof deliverForm> = {
  deliveryContent: [{ required: true, message: '请输入发货内容快照', trigger: 'blur' }]
};

const pendingCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'pending').length
);
const lockedCount = computed(
  () => orders.value.filter((order) => order.lockedCodeCount > 0).length
);
const failedCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'failed').length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const platformLabel = platforms.value.find((platform) => platform.id === query.platformId)?.name;
  if (query.platformId && platformLabel) {
    chips.push({ key: 'platformId', label: '平台', value: platformLabel });
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
  if (status === 'pending') {
    return 'warning';
  }
  if (status === 'delivered') {
    return 'success';
  }
  if (status === 'failed') {
    return 'danger';
  }
  return 'info';
}

function getDeliveryMethodLabel(method: CodeDeliveryLog['deliveryMethod']) {
  const labels: Record<CodeDeliveryLog['deliveryMethod'], string> = {
    eticket: '电子凭证',
    dummy_send: '无需物流',
    message_card: '消息卡片',
    manual: '手工'
  };
  return labels[method];
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadDependencies() {
  const [platformData, serviceData] = await Promise.all([
    sourcePlatformsApi.list({
      page: 1,
      pageSize: 100,
      status: 'active'
    }),
    codeServicesApi.list({
      page: 1,
      pageSize: 100,
      status: 'enabled'
    })
  ]);
  platforms.value = platformData.items;
  services.value = serviceData.items;
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
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单失败');
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
    await Promise.all([loadDependencies(), loadOrders()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新兑换码订单失败');
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.platformId = '';
  query.deliveryStatus = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'platformId') {
    query.platformId = '';
  }
}

function exportList() {
  ElMessage.info('兑换码订单导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存兑换码订单视图', {
      inputValue: '兑换码订单常用视图',
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
        platformId: query.platformId,
        deliveryStatus: query.deliveryStatus
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
  query.platformId = typeof filters.platformId === 'string' ? filters.platformId : '';
  query.deliveryStatus = typeof filters.deliveryStatus === 'string' ? filters.deliveryStatus : '';
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
  if (prop === 'externalOrderNo') return 'externalOrderNo';
  if (prop === 'paidAmount') return 'paidAmount';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function openCreate() {
  form.platformId = platforms.value[0]?.id ?? '';
  form.externalOrderNo = '';
  form.buyerId = '';
  form.buyerNameMasked = '';
  form.itemId = '';
  form.skuId = '';
  form.itemTitle = '';
  form.skuName = '';
  form.serviceId = '';
  form.faceValue = '';
  form.quantity = 1;
  form.paidAmount = '0';
  form.platformFee = '0';
  dialogVisible.value = true;
}

async function openDetail(order: CodePlatformOrder) {
  selectedOrder.value = order;
  await loadDeliveryLogs(order.id);
  detailVisible.value = true;
}

async function loadDeliveryLogs(orderId: string) {
  try {
    const data = await codeOrdersApi.listOrderDeliveryLogs(orderId);
    deliveryLogs.value = data.items;
  } catch (error) {
    deliveryLogs.value = [];
    ElMessage.error(error instanceof Error ? error.message : '加载发货记录失败');
  }
}

async function saveOrder() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    await codeOrdersApi.createManual({
      platformId: form.platformId,
      externalOrderNo: form.externalOrderNo,
      buyerId: form.buyerId || null,
      buyerNameMasked: form.buyerNameMasked || null,
      itemId: form.itemId,
      skuId: form.skuId || null,
      itemTitle: form.itemTitle || null,
      skuName: form.skuName || null,
      serviceId: form.serviceId || null,
      faceValue: form.faceValue || null,
      quantity: form.quantity,
      paidAmount: form.paidAmount,
      platformFee: form.platformFee
    });
    ElMessage.success('手工订单已导入');
    dialogVisible.value = false;
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入手工订单失败');
  } finally {
    saving.value = false;
  }
}

async function matchCode(order: CodePlatformOrder) {
  try {
    await codeOrdersApi.matchCode(order.id);
    ElMessage.success('已匹配并锁定兑换码');
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '匹配锁码失败');
  }
}

function openGenerate(order: CodePlatformOrder) {
  selectedOrder.value = order;
  generatedOrderId.value = order.id;
  generateForm.reason = '';
  generateForm.content = '';
  generateDialogVisible.value = true;
}

function openDeliver(order: CodePlatformOrder) {
  selectedOrder.value = order;
  deliverForm.deliveryMethod = 'manual';
  deliverForm.deliveryContent =
    generatedOrderId.value === order.id && generateForm.content ? generateForm.content : '';
  deliverDialogVisible.value = true;
}

async function generateDelivery() {
  const valid = await generateFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedOrder.value) {
    return;
  }

  generating.value = true;
  try {
    const data = await codeOrdersApi.generateDeliveryContent(selectedOrder.value.id, {
      reason: generateForm.reason
    });
    generatedOrderId.value = selectedOrder.value.id;
    generateForm.content = data.deliveryContent;
    deliverForm.deliveryContent = data.deliveryContent;
    ElMessage.success('发货内容已生成并写入审计日志');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成发货内容失败');
  } finally {
    generating.value = false;
  }
}

async function confirmDeliveryFromGenerated() {
  if (!selectedOrder.value || !generateForm.content) {
    return;
  }

  deliverForm.deliveryMethod = 'manual';
  deliverForm.deliveryContent = generateForm.content;
  await confirmDelivery();
}

async function confirmDelivery() {
  const valid = deliverDialogVisible.value
    ? await deliverFormRef.value?.validate().catch(() => false)
    : Boolean(deliverForm.deliveryContent.trim());
  if (!valid || !selectedOrder.value) {
    ElMessage.warning('请先填写发货内容快照');
    return;
  }

  try {
    await ElMessageBox.confirm(
      '确认后该订单会变为已发货，锁定兑换码也会变为已发货，不能重复发货。',
      '确认发货',
      {
        confirmButtonText: '确认发货',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch {
    return;
  }

  delivering.value = true;
  try {
    const data = await codeOrdersApi.confirmDelivery(selectedOrder.value.id, {
      deliveryMethod: deliverForm.deliveryMethod,
      deliveryContent: deliverForm.deliveryContent
    });
    ElMessage.success('已确认发货并写入发货日志');
    selectedOrder.value = data;
    deliverDialogVisible.value = false;
    generateDialogVisible.value = false;
    await Promise.all([loadOrders(), loadDeliveryLogs(data.id)]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '确认发货失败');
  } finally {
    delivering.value = false;
  }
}

async function initializePage() {
  try {
    await loadDependencies();
    await loadTableViews(true);
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单失败');
  }
}

onMounted(initializePage);
</script>
