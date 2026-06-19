<template>
  <PageScaffold
    title="客户管理"
    group="系统管理"
    phase="Phase 2"
    description="管理客户资料、来源平台、标签和基础联系方式。手机号列表默认脱敏展示。"
  >
    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="customerColumnOptions"
        :status-options="customerStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedCustomers.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增客户"
        placeholder="搜索客户、联系人、微信、手机号尾号"
        @search="handleSearch"
        @refresh="loadData"
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
            v-model="query.sourcePlatformId"
            class="table-toolbar__select"
            clearable
            placeholder="来源平台"
            @change="handleSearch"
          >
            <el-option
              v-for="platform in sourcePlatforms"
              :key="platform.id"
              :label="platform.name"
              :value="platform.id"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="customers"
        :size="tableSize"
        row-key="id"
        empty-text="暂无客户"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="客户"
          min-width="150"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('contactName')"
          prop="contactName"
          label="联系人"
          min-width="120"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.contactName ?? '-' }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('phone')"
          prop="phoneTail"
          label="手机号"
          min-width="130"
        >
          <template #default="{ row }">
            <span>{{ row.maskedPhone ?? '-' }}</span>
            <el-button
              v-if="row.phoneTail && canRevealPhone"
              class="inline-action"
              text
              type="primary"
              @click="openPhoneDialog(row)"
            >
              查看
            </el-button>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('wechat')"
          prop="wechat"
          label="微信"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.wechat ?? '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('source')" label="来源" min-width="140">
          <template #default="{ row }">{{ row.sourcePlatform?.name ?? '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('tags')" label="标签" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="tag in row.tags" :key="tag" class="tag-gap" size="small">{{
              tag
            }}</el-tag>
            <span v-if="!row.tags.length">-</span>
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
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
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
          @current-change="loadCustomers"
          @size-change="loadCustomers"
        />
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingCustomer ? '编辑客户' : '新增客户'"
      width="620px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model.trim="form.name" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model.trim="form.contactName" />
        </el-form-item>
        <el-form-item :label="editingCustomer ? '手机号（留空不修改）' : '手机号'">
          <el-input v-model.trim="form.phone" placeholder="保存后列表脱敏展示" />
        </el-form-item>
        <el-form-item label="微信">
          <el-input v-model.trim="form.wechat" />
        </el-form-item>
        <el-form-item label="来源平台">
          <el-select v-model="form.sourcePlatformId" class="full-input" clearable>
            <el-option
              v-for="platform in sourcePlatforms"
              :key="platform.id"
              :label="platform.name"
              :value="platform.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            class="full-input"
            multiple
            filterable
            allow-create
            default-first-option
          >
            <el-option v-for="tag in tagOptions" :key="tag" :label="tag" :value="tag" />
          </el-select>
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
        <el-button type="primary" :loading="saving" @click="saveCustomer">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="phoneDialogVisible" title="查看完整手机号" width="520px">
      <el-form ref="phoneFormRef" :model="phoneForm" :rules="phoneRules" label-position="top">
        <el-alert
          title="查看完整手机号会写入敏感访问日志和审计日志"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-form-item label="客户">
          <el-input :model-value="selectedCustomer?.name ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="查看原因" prop="reason">
          <el-input
            v-model.trim="phoneForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 售后联系 / 订单核对 / 客户回访"
          />
        </el-form-item>
        <el-form-item v-if="phoneForm.phone" label="完整手机号">
          <el-input v-model="phoneForm.phone" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="phoneDialogVisible = false">关闭</el-button>
        <el-button type="warning" :loading="revealingPhone" @click="revealPhone">
          查看完整手机号
        </el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { customersApi, sourcePlatformsApi, userTableViewsApi } from '@/api/system';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { useAuthStore } from '@/stores/auth';
import type { Customer, SourcePlatform, TableDensity, UserTableView } from '@/types/system';

const tableKey = 'customers';
const customerStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const customerColumnOptions = [
  { label: '客户', value: 'name', required: true },
  { label: '联系人', value: 'contactName' },
  { label: '手机号', value: 'phone' },
  { label: '微信', value: 'wechat' },
  { label: '来源', value: 'source' },
  { label: '标签', value: 'tags' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const revealingPhone = ref(false);
const dialogVisible = ref(false);
const phoneDialogVisible = ref(false);
const editingCustomer = ref<Customer | null>(null);
const selectedCustomer = ref<Customer | null>(null);
const formRef = ref<FormInstance>();
const phoneFormRef = ref<FormInstance>();
const customers = ref<Customer[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const selectedCustomers = ref<Customer[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const authStore = useAuthStore();
const router = useRouter();

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  sourcePlatformId: ''
});

const form = reactive({
  name: '',
  contactName: '',
  phone: '',
  wechat: '',
  sourcePlatformId: '',
  tags: [] as string[],
  remark: '',
  status: 'active' as 'active' | 'disabled'
});

const phoneForm = reactive({
  reason: '',
  phone: ''
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
};

const phoneRules: FormRules<typeof phoneForm> = {
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const tagOptions = computed(() => [
  ...new Set(customers.value.flatMap((customer) => customer.tags))
]);

const canRevealPhone = computed(
  () =>
    authStore.user?.roles.includes('admin') ||
    authStore.user?.permissions.includes('customer.view_phone')
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const sourceLabel = sourcePlatforms.value.find(
    (platform) => platform.id === query.sourcePlatformId
  )?.name;
  if (query.sourcePlatformId && sourceLabel) {
    chips.push({ key: 'sourcePlatformId', label: '来源', value: sourceLabel });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadSourcePlatforms() {
  const data = await sourcePlatformsApi.list({
    page: 1,
    pageSize: 100,
    status: 'active'
  });
  sourcePlatforms.value = data.items;
}

async function loadCustomers() {
  loading.value = true;
  try {
    const data = await customersApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      sourcePlatformId: query.sourcePlatformId || undefined,
      sortBy: mapSortProp(sortConfig.value.prop),
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    customers.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载客户失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadCustomers();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadCustomers();
}

function handleSelectionChange(rows: Customer[]) {
  selectedCustomers.value = rows;
}

async function loadData() {
  await Promise.all([loadSourcePlatforms(), loadCustomers()]);
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.sourcePlatformId = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'sourcePlatformId') {
    query.sourcePlatformId = '';
  }
}

function exportList() {
  ElMessage.info('客户导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存客户视图', {
      inputValue: '客户常用视图',
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
        sourcePlatformId: query.sourcePlatformId
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : customerColumnOptions.map((column) => column.value),
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
  await loadCustomers();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.sourcePlatformId =
    typeof filters.sourcePlatformId === 'string' ? filters.sourcePlatformId : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        customerColumnOptions.some((option) => option.value === column)
      )
    : customerColumnOptions.map((column) => column.value);
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
  if (prop === 'name') return 'name';
  if (prop === 'contactName') return 'contactName';
  if (prop === 'phoneTail') return 'phoneTail';
  if (prop === 'wechat') return 'wechat';
  if (prop === 'status') return 'status';
  if (prop === 'updatedAt') return 'updatedAt';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function resetForm() {
  form.name = '';
  form.contactName = '';
  form.phone = '';
  form.wechat = '';
  form.sourcePlatformId = '';
  form.tags = [];
  form.remark = '';
  form.status = 'active';
}

function openCreate() {
  editingCustomer.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(customer: Customer) {
  editingCustomer.value = customer;
  form.name = customer.name;
  form.contactName = customer.contactName ?? '';
  form.phone = '';
  form.wechat = customer.wechat ?? '';
  form.sourcePlatformId = customer.sourcePlatformId ?? '';
  form.tags = [...customer.tags];
  form.remark = customer.remark ?? '';
  form.status = customer.status;
  dialogVisible.value = true;
}

function openDetail(customer: Customer) {
  router.push({
    path: '/system/customers/detail',
    query: {
      id: customer.id
    }
  });
}

function openPhoneDialog(customer: Customer) {
  selectedCustomer.value = customer;
  phoneForm.reason = '';
  phoneForm.phone = '';
  phoneDialogVisible.value = true;
}

async function saveCustomer() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      contactName: form.contactName || null,
      phone: form.phone || undefined,
      wechat: form.wechat || null,
      sourcePlatformId: form.sourcePlatformId || null,
      tags: form.tags,
      remark: form.remark || null,
      status: form.status
    };

    if (editingCustomer.value) {
      await customersApi.update(editingCustomer.value.id, payload);
    } else {
      await customersApi.create({
        ...payload,
        phone: form.phone || null
      });
    }

    ElMessage.success('客户已保存');
    dialogVisible.value = false;
    await loadCustomers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存客户失败');
  } finally {
    saving.value = false;
  }
}

async function revealPhone() {
  const valid = await phoneFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedCustomer.value) {
    return;
  }

  revealingPhone.value = true;
  try {
    const data = await customersApi.revealPhone(selectedCustomer.value.id, {
      reason: phoneForm.reason
    });
    phoneForm.phone = data.phone;
    ElMessage.success('完整手机号已显示，审计日志已记录');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整手机号失败');
  } finally {
    revealingPhone.value = false;
  }
}

async function initializePage() {
  try {
    await loadSourcePlatforms();
    await loadTableViews(true);
    await loadCustomers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载客户失败');
  }
}

onMounted(initializePage);
</script>
