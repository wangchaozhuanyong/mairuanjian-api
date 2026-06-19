<template>
  <PageScaffold
    title="来源平台设置"
    group="系统管理"
    phase="Phase 2"
    description="配置淘宝、闲鱼、微信、手工等客户来源和平台能力。手续费字段会按 Decimal 字符串提交。"
  >
    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="platformColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedPlatforms.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增来源平台"
        placeholder="搜索平台名称、编码、备注"
        @search="handleSearch"
        @refresh="loadPlatforms"
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
            v-model="query.type"
            class="table-toolbar__select"
            clearable
            placeholder="类型"
            @change="handleSearch"
          >
            <el-option
              v-for="item in platformTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="platforms"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="平台"
          min-width="150"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('code')"
          prop="code"
          label="编码"
          min-width="120"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('type')"
          prop="type"
          label="类型"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ getTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('feeRate')"
          prop="feeRate"
          label="费率"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.feeRate }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('feeFixed')"
          prop="feeFixed"
          label="固定费用"
          width="120"
          sortable="custom"
        />
        <el-table-column v-if="isColumnVisible('syncEnabled')" label="同步" width="90">
          <template #default="{ row }">
            <el-tag :type="row.syncEnabled ? 'success' : 'info'" size="small">
              {{ row.syncEnabled ? '支持' : '关闭' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('deliveryEnabled')" label="发货" width="90">
          <template #default="{ row }">
            <el-tag :type="row.deliveryEnabled ? 'success' : 'info'" size="small">
              {{ row.deliveryEnabled ? '支持' : '关闭' }}
            </el-tag>
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
            <StatusTag :status="row.status" />
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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
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
          @current-change="loadPlatforms"
          @size-change="loadPlatforms"
        />
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingPlatform ? '编辑来源平台' : '新增来源平台'"
      width="620px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="平台名称" prop="name">
          <el-input v-model.trim="form.name" />
        </el-form-item>
        <el-form-item label="平台编码" prop="code">
          <el-input v-model.trim="form.code" placeholder="例如 taobao_main" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" class="full-input">
            <el-option
              v-for="item in platformTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手续费率">
          <el-input v-model.trim="form.feeRate" placeholder="例如 0.006" />
        </el-form-item>
        <el-form-item label="固定手续费">
          <el-input v-model.trim="form.feeFixed" placeholder="例如 0.00" />
        </el-form-item>
        <el-form-item label="能力">
          <el-checkbox v-model="form.syncEnabled">支持订单同步</el-checkbox>
          <el-checkbox v-model="form.deliveryEnabled">支持自动发货</el-checkbox>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePlatform">保存</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { sourcePlatformsApi, userTableViewsApi } from '@/api/system';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { SourcePlatform, TableDensity, UserTableView } from '@/types/system';

const platformTypes: Array<{ label: string; value: SourcePlatform['type'] }> = [
  { label: '淘宝', value: 'taobao' },
  { label: '闲鱼', value: 'xianyu' },
  { label: '微信', value: 'wechat' },
  { label: '手工', value: 'manual' },
  { label: '其他', value: 'other' }
];

const tableKey = 'source_platforms';
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const platformColumnOptions = [
  { label: '平台', value: 'name', required: true },
  { label: '编码', value: 'code' },
  { label: '类型', value: 'type' },
  { label: '费率', value: 'feeRate' },
  { label: '固定费用', value: 'feeFixed' },
  { label: '同步', value: 'syncEnabled' },
  { label: '发货', value: 'deliveryEnabled' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingPlatform = ref<SourcePlatform | null>(null);
const formRef = ref<FormInstance>();
const platforms = ref<SourcePlatform[]>([]);
const selectedPlatforms = ref<SourcePlatform[]>([]);
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
  type: ''
});

const form = reactive({
  name: '',
  code: '',
  type: 'other' as SourcePlatform['type'],
  feeRate: '0',
  feeFixed: '0',
  syncEnabled: false,
  deliveryEnabled: false,
  status: 'active' as 'active' | 'disabled',
  remark: ''
});

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const typeLabel = platformTypes.find((item) => item.value === query.type)?.label;
  if (query.type && typeLabel) {
    chips.push({ key: 'type', label: '类型', value: typeLabel });
  }
  return chips;
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入平台名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入平台编码', trigger: 'blur' }]
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getTypeLabel(type: SourcePlatform['type']) {
  return platformTypes.find((item) => item.value === type)?.label ?? type;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadPlatforms() {
  loading.value = true;
  try {
    const data = await sourcePlatformsApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      type: query.type || undefined,
      sortBy: sortConfig.value.prop,
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    platforms.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载来源平台失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadPlatforms();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadPlatforms();
}

function handleSelectionChange(rows: SourcePlatform[]) {
  selectedPlatforms.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.type = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'type') {
    query.type = '';
  }
}

function exportList() {
  ElMessage.info('来源平台导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存来源平台视图', {
      inputValue: '来源平台常用视图',
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
        type: query.type
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : platformColumnOptions.map((column) => column.value),
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
  await loadPlatforms();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.type = typeof filters.type === 'string' ? filters.type : '';
  query.pageSize = view.pageSize;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        platformColumnOptions.some((option) => option.value === column)
      )
    : platformColumnOptions.map((column) => column.value);
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

async function initializePage() {
  await loadTableViews(true);
  await loadPlatforms();
}

function resetForm() {
  form.name = '';
  form.code = '';
  form.type = 'other';
  form.feeRate = '0';
  form.feeFixed = '0';
  form.syncEnabled = false;
  form.deliveryEnabled = false;
  form.status = 'active';
  form.remark = '';
}

function openCreate() {
  editingPlatform.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(platform: SourcePlatform) {
  editingPlatform.value = platform;
  form.name = platform.name;
  form.code = platform.code;
  form.type = platform.type;
  form.feeRate = platform.feeRate;
  form.feeFixed = platform.feeFixed;
  form.syncEnabled = platform.syncEnabled;
  form.deliveryEnabled = platform.deliveryEnabled;
  form.status = platform.status;
  form.remark = platform.remark ?? '';
  dialogVisible.value = true;
}

async function savePlatform() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      code: form.code,
      type: form.type,
      feeRate: form.feeRate,
      feeFixed: form.feeFixed,
      syncEnabled: form.syncEnabled,
      deliveryEnabled: form.deliveryEnabled,
      status: form.status,
      remark: form.remark || null
    };

    if (editingPlatform.value) {
      await sourcePlatformsApi.update(editingPlatform.value.id, payload);
    } else {
      await sourcePlatformsApi.create(payload);
    }

    ElMessage.success('来源平台已保存');
    dialogVisible.value = false;
    await loadPlatforms();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存来源平台失败');
  } finally {
    saving.value = false;
  }
}

onMounted(initializePage);
</script>
