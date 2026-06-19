<template>
  <PageScaffold
    title="Apple ID 业务设置"
    group="Apple ID 业务"
    phase="Phase 4"
    description="维护业务售价、官方消耗金额、币种、周期、允许地区和 Apple ID 锁定规则。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="业务数量" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="启用业务" :value="enabledCount" hint="当前页" tone="green" />
      <MetricCard label="自动匹配" :value="autoMatchCount" hint="当前页" tone="orange" />
      <MetricCard label="全局锁定" :value="globalLockCount" hint="当前页" tone="red" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="serviceColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedServices.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增业务"
        placeholder="搜索业务名称、分类、币种、备注"
        @search="handleSearch"
        @refresh="loadServices"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-input
            v-model.trim="query.category"
            class="table-toolbar__select"
            placeholder="分类"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-input
            v-model.trim="query.currency"
            class="table-toolbar__select"
            placeholder="币种"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="services"
        :size="tableSize"
        row-key="id"
        empty-text="暂无 Apple ID 业务"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="业务"
          min-width="160"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('category')"
          prop="category"
          label="分类"
          width="110"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('defaultPrice')"
          prop="defaultPrice"
          label="售价"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.defaultPrice }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('officialCostValue')"
          prop="officialCostValue"
          label="消耗"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.officialCostValue }} {{ row.currency }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('period')"
          prop="defaultPeriodValue"
          label="周期"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ getPeriodLabel(row.defaultPeriodType, row.defaultPeriodValue) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('lockRule')"
          prop="lockRule"
          label="锁定规则"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ getLockRuleLabel(row.lockRule) }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('allowedRegions')" label="允许地区" min-width="160">
          <template #default="{ row }">
            <el-tag v-for="region in row.allowedRegions" :key="region" class="tag-gap" size="small">
              {{ region }}
            </el-tag>
            <span v-if="!row.allowedRegions.length">不限</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="90"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusLabel(row.status) }}
            </el-tag>
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
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text @click="openMappings(row)">平台映射</el-button>
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
          @current-change="loadServices"
          @size-change="loadServices"
        />
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingService ? '编辑业务' : '新增业务'"
      width="760px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="业务名称" prop="name">
            <el-input v-model.trim="form.name" />
          </el-form-item>
          <el-form-item label="分类">
            <el-input v-model.trim="form.category" placeholder="例如 streaming" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="默认售价" prop="defaultPrice">
            <el-input v-model.trim="form.defaultPrice" />
          </el-form-item>
          <el-form-item label="官方消耗金额" prop="officialCostValue">
            <el-input v-model.trim="form.officialCostValue" />
          </el-form-item>
          <el-form-item label="币种" prop="currency">
            <el-input v-model.trim="form.currency" placeholder="USD" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="周期类型">
            <el-select v-model="form.defaultPeriodType" class="full-input">
              <el-option label="按月" value="month" />
              <el-option label="按天" value="day" />
              <el-option label="手工" value="manual" />
            </el-select>
          </el-form-item>
          <el-form-item label="周期值">
            <el-input-number v-model="form.defaultPeriodValue" :min="1" class="full-input" />
          </el-form-item>
          <el-form-item label="到期计算">
            <el-select v-model="form.expireCalcType" class="full-input">
              <el-option label="按月" value="by_month" />
              <el-option label="按天" value="by_day" />
              <el-option label="手工" value="manual" />
            </el-select>
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="锁定规则">
            <el-select v-model="form.lockRule" class="full-input">
              <el-option label="按业务锁定" value="by_service" />
              <el-option label="全局锁定" value="global" />
            </el-select>
          </el-form-item>
          <el-form-item label="最低余额要求">
            <el-input v-model.trim="form.minBalanceRequired" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" class="full-input">
              <el-option label="启用" value="enabled" />
              <el-option label="暂停" value="paused" />
              <el-option label="停用" value="disabled" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="允许地区">
          <el-select
            v-model="form.allowedRegions"
            class="full-input"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="留空表示不限地区"
          >
            <el-option label="US" value="US" />
            <el-option label="HK" value="HK" />
            <el-option label="JP" value="JP" />
            <el-option label="CN" value="CN" />
          </el-select>
        </el-form-item>
        <el-form-item label="能力">
          <el-checkbox v-model="form.requireAppleId">需要 Apple ID</el-checkbox>
          <el-checkbox v-model="form.requireServiceAccount">需要客户网站账号</el-checkbox>
          <el-checkbox v-model="form.autoMatchAppleId">自动匹配 Apple ID</el-checkbox>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveService">保存</el-button>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="mappingDrawerVisible"
      :title="`平台映射 · ${selectedService?.name ?? ''}`"
      confirm-text="新增映射"
      size="860px"
      @confirm="openCreateMapping"
    >
      <div class="panel-title-row">
        <div>
          <h3>来源平台商品/SKU 映射</h3>
          <p>用于后续平台订单同步时识别 Apple ID 业务，不和兑换码平台映射混用。</p>
        </div>
        <el-button @click="loadMappings">刷新</el-button>
      </div>

      <el-table v-loading="mappingLoading" :data="mappings" row-key="id">
        <el-table-column label="平台/店铺" min-width="170">
          <template #default="{ row }">
            {{ row.sourcePlatform.name }}
            <div class="muted-block">{{ row.shopName || row.sourcePlatform.code }}</div>
          </template>
        </el-table-column>
        <el-table-column label="商品/SKU" min-width="190">
          <template #default="{ row }">
            {{ row.platformItemId }}
            <div class="muted-block">SKU {{ row.platformSkuId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="关键词" min-width="160">
          <template #default="{ row }">{{ row.skuKeyword || '-' }}</template>
        </el-table-column>
        <el-table-column label="售价/手续费" min-width="160">
          <template #default="{ row }">
            {{ row.platformPrice }}
            <div class="muted-block">
              {{ getFeeTypeLabel(row.platformFeeType) }} {{ row.platformFeeValue }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="自动订单" width="100">
          <template #default="{ row }">
            <el-tag :type="row.allowAutoOrder ? 'success' : 'info'" size="small" effect="light">
              {{ row.allowAutoOrder ? '允许' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="light">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openEditMapping(row)">编辑</el-button>
            <el-button text type="danger" @click="removeMapping(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </AppDrawer>

    <el-dialog
      v-model="mappingDialogVisible"
      :title="editingMapping ? '编辑平台映射' : '新增平台映射'"
      width="720px"
    >
      <el-form ref="mappingFormRef" :model="mappingForm" :rules="mappingRules" label-position="top">
        <div class="form-grid">
          <el-form-item label="来源平台" prop="sourcePlatformId">
            <el-select
              v-model="mappingForm.sourcePlatformId"
              class="full-input"
              filterable
              placeholder="选择来源平台"
            >
              <el-option
                v-for="platform in sourcePlatforms"
                :key="platform.id"
                :label="`${platform.name} / ${platform.code}`"
                :value="platform.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="店铺/账号名称">
            <el-input v-model.trim="mappingForm.shopName" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="平台商品 ID" prop="platformItemId">
            <el-input v-model.trim="mappingForm.platformItemId" />
          </el-form-item>
          <el-form-item label="平台 SKU ID">
            <el-input v-model.trim="mappingForm.platformSkuId" placeholder="没有 SKU 可留空" />
          </el-form-item>
        </div>
        <el-form-item label="SKU 关键词">
          <el-input
            v-model.trim="mappingForm.skuKeyword"
            placeholder="例如 GPT Plus 月卡 / Claude Pro"
          />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="平台售价">
            <el-input v-model.trim="mappingForm.platformPrice" />
          </el-form-item>
          <el-form-item label="手续费类型">
            <el-select v-model="mappingForm.platformFeeType" class="full-input">
              <el-option label="无" value="none" />
              <el-option label="比例" value="rate" />
              <el-option label="固定" value="fixed" />
              <el-option label="比例 + 固定" value="mixed" />
            </el-select>
          </el-form-item>
          <el-form-item label="手续费值">
            <el-input v-model.trim="mappingForm.platformFeeValue" />
          </el-form-item>
        </div>
        <el-form-item label="开关">
          <el-checkbox v-model="mappingForm.allowAutoOrder">允许自动生成 Apple ID 订单</el-checkbox>
          <el-checkbox v-model="mappingForm.enabled">启用映射</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mappingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingMapping" @click="saveMapping">保存映射</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { appleServicesApi, sourcePlatformsApi, userTableViewsApi } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  AppleService,
  AppleServicePlatformMapping,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';

const tableKey = 'apple_services';
const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '暂停', value: 'paused' },
  { label: '停用', value: 'disabled' }
];
const serviceColumnOptions = [
  { label: '业务', value: 'name', required: true },
  { label: '分类', value: 'category' },
  { label: '售价', value: 'defaultPrice' },
  { label: '消耗', value: 'officialCostValue' },
  { label: '周期', value: 'period' },
  { label: '锁定规则', value: 'lockRule' },
  { label: '允许地区', value: 'allowedRegions' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const mappingLoading = ref(false);
const savingMapping = ref(false);
const dialogVisible = ref(false);
const mappingDrawerVisible = ref(false);
const mappingDialogVisible = ref(false);
const editingService = ref<AppleService | null>(null);
const selectedService = ref<AppleService | null>(null);
const editingMapping = ref<AppleServicePlatformMapping | null>(null);
const formRef = ref<FormInstance>();
const mappingFormRef = ref<FormInstance>();
const services = ref<AppleService[]>([]);
const selectedServices = ref<AppleService[]>([]);
const mappings = ref<AppleServicePlatformMapping[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
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
  status: '',
  category: '',
  currency: ''
});

const form = reactive({
  name: '',
  category: 'default',
  defaultPrice: '0',
  officialCostValue: '0',
  currency: 'USD',
  defaultPeriodType: 'month' as AppleService['defaultPeriodType'],
  defaultPeriodValue: 1,
  expireCalcType: 'by_month' as AppleService['expireCalcType'],
  requireAppleId: true,
  requireServiceAccount: false,
  autoMatchAppleId: true,
  lockRule: 'by_service' as AppleService['lockRule'],
  allowedRegions: [] as string[],
  minBalanceRequired: '0',
  status: 'enabled' as AppleService['status'],
  remark: ''
});

const mappingForm = reactive({
  sourcePlatformId: '',
  shopName: '',
  platformItemId: '',
  platformSkuId: '',
  skuKeyword: '',
  platformPrice: '0',
  platformFeeType: 'none' as AppleServicePlatformMapping['platformFeeType'],
  platformFeeValue: '0',
  allowAutoOrder: false,
  enabled: true
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入业务名称', trigger: 'blur' }],
  defaultPrice: [{ required: true, message: '请输入默认售价', trigger: 'blur' }],
  officialCostValue: [{ required: true, message: '请输入官方消耗金额', trigger: 'blur' }],
  currency: [{ required: true, message: '请输入币种', trigger: 'blur' }]
};

const mappingRules: FormRules<typeof mappingForm> = {
  sourcePlatformId: [{ required: true, message: '请选择来源平台', trigger: 'change' }],
  platformItemId: [{ required: true, message: '请输入平台商品 ID', trigger: 'blur' }]
};

const enabledCount = computed(
  () => services.value.filter((service) => service.status === 'enabled').length
);
const autoMatchCount = computed(
  () => services.value.filter((service) => service.autoMatchAppleId).length
);
const globalLockCount = computed(
  () => services.value.filter((service) => service.lockRule === 'global').length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (query.category) {
    chips.push({ key: 'category', label: '分类', value: query.category });
  }
  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getStatusLabel(status: AppleService['status']) {
  return { enabled: '启用', paused: '暂停', disabled: '停用' }[status] ?? status;
}

function getStatusType(status: AppleService['status']) {
  return status === 'enabled' ? 'success' : status === 'paused' ? 'warning' : 'info';
}

function getLockRuleLabel(rule: AppleService['lockRule']) {
  return rule === 'global' ? '全局锁定' : '按业务锁定';
}

function getPeriodLabel(type: AppleService['defaultPeriodType'], value: number) {
  if (type === 'manual') {
    return '手工';
  }

  return `${value}${type === 'month' ? '个月' : '天'}`;
}

function getFeeTypeLabel(type: AppleServicePlatformMapping['platformFeeType']) {
  return {
    none: '无手续费',
    rate: '比例',
    fixed: '固定',
    mixed: '混合'
  }[type];
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadServices() {
  loading.value = true;
  try {
    const data = await appleServicesApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      category: query.category || undefined,
      currency: query.currency || undefined,
      sortBy: sortConfig.value.prop,
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    services.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 业务失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadServices();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadServices();
}

function handleSelectionChange(rows: AppleService[]) {
  selectedServices.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.category = '';
  query.currency = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'category') {
    query.category = '';
  }
  if (key === 'currency') {
    query.currency = '';
  }
}

function exportList() {
  ElMessage.info('Apple ID 业务设置导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 业务视图', {
      inputValue: 'Apple ID 业务常用视图',
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
        category: query.category,
        currency: query.currency
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : serviceColumnOptions.map((column) => column.value),
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
  await loadServices();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isServiceStatus(filters.status) ? filters.status : '';
  query.category = typeof filters.category === 'string' ? filters.category : '';
  query.currency = typeof filters.currency === 'string' ? filters.currency : '';
  query.pageSize = view.pageSize;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        serviceColumnOptions.some((option) => option.value === column)
      )
    : serviceColumnOptions.map((column) => column.value);
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

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isServiceStatus(value: unknown): value is AppleService['status'] | '' {
  return value === '' || value === 'enabled' || value === 'paused' || value === 'disabled';
}

async function initializePage() {
  await loadTableViews(true);
  await loadServices();
}

async function loadSourcePlatforms() {
  try {
    const data = await sourcePlatformsApi.list({
      page: 1,
      pageSize: 100,
      status: 'active'
    });
    sourcePlatforms.value = data.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载来源平台失败');
  }
}

function resetForm() {
  form.name = '';
  form.category = 'default';
  form.defaultPrice = '0';
  form.officialCostValue = '0';
  form.currency = 'USD';
  form.defaultPeriodType = 'month';
  form.defaultPeriodValue = 1;
  form.expireCalcType = 'by_month';
  form.requireAppleId = true;
  form.requireServiceAccount = false;
  form.autoMatchAppleId = true;
  form.lockRule = 'by_service';
  form.allowedRegions = [];
  form.minBalanceRequired = '0';
  form.status = 'enabled';
  form.remark = '';
}

function openCreate() {
  editingService.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(service: AppleService) {
  editingService.value = service;
  form.name = service.name;
  form.category = service.category;
  form.defaultPrice = service.defaultPrice;
  form.officialCostValue = service.officialCostValue;
  form.currency = service.currency;
  form.defaultPeriodType = service.defaultPeriodType;
  form.defaultPeriodValue = service.defaultPeriodValue;
  form.expireCalcType = service.expireCalcType;
  form.requireAppleId = service.requireAppleId;
  form.requireServiceAccount = service.requireServiceAccount;
  form.autoMatchAppleId = service.autoMatchAppleId;
  form.lockRule = service.lockRule;
  form.allowedRegions = [...service.allowedRegions];
  form.minBalanceRequired = service.minBalanceRequired;
  form.status = service.status;
  form.remark = service.remark ?? '';
  dialogVisible.value = true;
}

async function openMappings(service: AppleService) {
  selectedService.value = service;
  mappingDrawerVisible.value = true;
  await Promise.all([loadSourcePlatforms(), loadMappings()]);
}

async function loadMappings() {
  if (!selectedService.value) {
    return;
  }

  mappingLoading.value = true;
  try {
    const data = await appleServicesApi.listPlatformMappings(selectedService.value.id);
    mappings.value = data.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载平台映射失败');
  } finally {
    mappingLoading.value = false;
  }
}

function resetMappingForm() {
  mappingForm.sourcePlatformId = sourcePlatforms.value[0]?.id ?? '';
  mappingForm.shopName = '';
  mappingForm.platformItemId = '';
  mappingForm.platformSkuId = '';
  mappingForm.skuKeyword = '';
  mappingForm.platformPrice = selectedService.value?.defaultPrice ?? '0';
  mappingForm.platformFeeType = 'none';
  mappingForm.platformFeeValue = '0';
  mappingForm.allowAutoOrder = false;
  mappingForm.enabled = true;
}

async function openCreateMapping() {
  if (!selectedService.value) {
    return;
  }

  if (!sourcePlatforms.value.length) {
    await loadSourcePlatforms();
  }

  editingMapping.value = null;
  resetMappingForm();
  mappingDialogVisible.value = true;
}

function openEditMapping(mapping: AppleServicePlatformMapping) {
  editingMapping.value = mapping;
  mappingForm.sourcePlatformId = mapping.sourcePlatformId;
  mappingForm.shopName = mapping.shopName ?? '';
  mappingForm.platformItemId = mapping.platformItemId;
  mappingForm.platformSkuId = mapping.platformSkuId;
  mappingForm.skuKeyword = mapping.skuKeyword ?? '';
  mappingForm.platformPrice = mapping.platformPrice;
  mappingForm.platformFeeType = mapping.platformFeeType;
  mappingForm.platformFeeValue = mapping.platformFeeValue;
  mappingForm.allowAutoOrder = mapping.allowAutoOrder;
  mappingForm.enabled = mapping.enabled;
  mappingDialogVisible.value = true;
}

async function saveService() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      category: form.category,
      defaultPrice: form.defaultPrice,
      officialCostValue: form.officialCostValue,
      currency: form.currency,
      defaultPeriodType: form.defaultPeriodType,
      defaultPeriodValue: form.defaultPeriodValue,
      expireCalcType: form.expireCalcType,
      requireAppleId: form.requireAppleId,
      requireServiceAccount: form.requireServiceAccount,
      autoMatchAppleId: form.autoMatchAppleId,
      lockRule: form.lockRule,
      allowedRegions: form.allowedRegions,
      minBalanceRequired: form.minBalanceRequired,
      status: form.status,
      remark: form.remark || null
    };

    if (editingService.value) {
      await appleServicesApi.update(editingService.value.id, payload);
    } else {
      await appleServicesApi.create(payload);
    }

    ElMessage.success('Apple ID 业务已保存');
    dialogVisible.value = false;
    await loadServices();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 业务失败');
  } finally {
    saving.value = false;
  }
}

async function saveMapping() {
  const valid = await mappingFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedService.value) {
    return;
  }

  savingMapping.value = true;
  try {
    const payload = {
      sourcePlatformId: mappingForm.sourcePlatformId,
      shopName: mappingForm.shopName || null,
      platformItemId: mappingForm.platformItemId,
      platformSkuId: mappingForm.platformSkuId || null,
      skuKeyword: mappingForm.skuKeyword || null,
      platformPrice: mappingForm.platformPrice,
      platformFeeType: mappingForm.platformFeeType,
      platformFeeValue: mappingForm.platformFeeValue,
      allowAutoOrder: mappingForm.allowAutoOrder,
      enabled: mappingForm.enabled
    };

    if (editingMapping.value) {
      await appleServicesApi.updatePlatformMapping(editingMapping.value.id, payload);
    } else {
      await appleServicesApi.createPlatformMapping(selectedService.value.id, payload);
    }

    ElMessage.success('平台映射已保存');
    mappingDialogVisible.value = false;
    await loadMappings();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存平台映射失败');
  } finally {
    savingMapping.value = false;
  }
}

async function removeMapping(mapping: AppleServicePlatformMapping) {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${mapping.sourcePlatform.name} / ${mapping.platformItemId} 的映射？`,
      '删除平台映射',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );
    await appleServicesApi.removePlatformMapping(mapping.id);
    ElMessage.success('平台映射已删除');
    await loadMappings();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除平台映射失败');
    }
  }
}

onMounted(initializePage);
</script>
