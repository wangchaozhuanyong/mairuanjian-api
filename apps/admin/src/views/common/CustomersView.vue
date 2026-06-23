<template>
  <PageScaffold
    title="客户管理"
    group="客户与来源"
    phase="Phase 2"
    description="管理客户资料、来源平台、标签和基础联系方式。手机号列表默认脱敏展示。"
  >
    <section class="content-panel common-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="客户列表"
          :help="[
            '这里管客户基础资料。后面查订单、续费、售后时，都会回到这个客户档案。',
            '客户来源、标签和敏感联系方式查看入口也在这里统一管理。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>客户 {{ total }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeCustomerCount }}</StatusChip>
          <StatusChip tone="purple">已绑定来源 {{ sourcedCustomerCount }}</StatusChip>
          <StatusChip tone="orange">手机号 {{ phoneCustomerCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
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
        placeholder="搜索客户、微信、手机号尾号"
        @search="handleSearch"
        @refresh="() => loadData()"
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
        class="desktop-data-table"
        :data="customers"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无客户</strong>
            <span>可以新增客户，或清空筛选后重新查看客户列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增客户</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="客户"
          min-width="150"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('phone')"
          prop="phoneTail"
          label="手机号"
          min-width="170"
        >
          <template #header>
            <span class="help-label">
              手机号
              <FeatureHelp
                text="列表只显示脱敏手机号。要看完整号码，需要有权限，并且会记录查看原因。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <span class="table-inline-cell customer-phone-cell">
              <span class="table-inline-cell__text">{{ row.maskedPhone ?? '-' }}</span>
              <AppButton
                v-if="row.phoneTail && canRevealPhone"
                class="table-inline-action customer-phone-cell__action"
                size="small"
                variant="ghost"
                @click="openPhoneDialog(row)"
              >
                查看
              </AppButton>
            </span>
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
          <template #header>
            <span class="help-label">
              来源
              <FeatureHelp
                text="这个客户是从哪里来的，比如微信、官网、线下或手工录入，方便后面统计和找单。"
              />
            </span>
          </template>
          <template #default="{ row }">{{ row.sourcePlatform?.name ?? '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('tags')" label="标签" min-width="180">
          <template #header>
            <span class="help-label">
              标签
              <FeatureHelp
                text="给客户打简单标记，比如老客、重点客户、售后中，方便客服快速判断。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip v-for="tag in row.tags" :key="tag" class="tag-gap" tone="neutral">
              {{ tag }}
            </StatusChip>
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
          <template #header>
            <span class="help-label">
              状态
              <FeatureHelp text="启用表示正常使用；停用表示这个客户暂时不参与后续业务处理。" />
            </span>
          </template>
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
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton size="small" variant="danger" @click="removeCustomer(row)">
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="customers.length" class="mobile-record-list">
        <article v-for="customer in customers" :key="customer.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ customer.name }}</strong>
              <span>{{ customer.sourcePlatform?.name ?? '无来源' }}</span>
            </div>
            <StatusTag :status="customer.status" />
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>手机号</span>
              <strong>{{ customer.maskedPhone ?? '-' }}</strong>
            </div>
            <div>
              <span>微信</span>
              <strong>{{ customer.wechat ?? '-' }}</strong>
            </div>
            <div>
              <span>来源</span>
              <strong>{{ customer.sourcePlatform?.name ?? '-' }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip v-for="tag in customer.tags" :key="tag" tone="neutral">
              {{ tag }}
            </StatusChip>
            <StatusChip v-if="!customer.tags.length" tone="neutral">无标签</StatusChip>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(customer.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(customer)">详情</AppButton>
            <AppButton size="small" variant="ghost" @click="openEdit(customer)">编辑</AppButton>
            <AppButton size="small" variant="danger" @click="removeCustomer(customer)">
              删除
            </AppButton>
            <AppButton
              v-if="customer.phoneTail && canRevealPhone"
              size="small"
              variant="soft"
              @click="openPhoneDialog(customer)"
            >
              查看手机号
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无客户</strong>
          <span>可以新增客户，或清空筛选后重新查看客户列表。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增客户</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadCustomers()"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingCustomer ? '编辑客户' : '新增客户'"
      width="min(620px, calc(100vw - 24px))"
    >
      <CustomerProfileForm
        ref="formRef"
        :model-value="form"
        :rules="rules"
        :source-platforms="sourcePlatforms"
        :tag-options="tagOptions"
        :editing="Boolean(editingCustomer)"
        @update:model-value="assignCustomerProfileForm(form, $event)"
      />
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveCustomer">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="phoneDialogVisible"
      title="查看完整手机号"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form ref="phoneFormRef" :model="phoneForm" :rules="phoneRules" label-position="top">
        <div class="apple-core-alert apple-core-alert--orange">
          <StatusChip tone="orange">敏感</StatusChip>
          <div>
            <strong>查看完整手机号会写入敏感访问日志和审计日志</strong>
            <p>请填写明确业务原因，避免无授权查看客户敏感联系方式。</p>
          </div>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="客户"
              purpose="当前准备查看完整手机号的客户，用来确认没有点错。"
              example="查看前核对客户名称、微信或来源平台。"
            />
          </template>
          <el-input :model-value="selectedCustomer?.name ?? '-'" disabled />
        </el-form-item>
        <el-form-item prop="reason">
          <template #label>
            <FieldHelpLabel
              label="查看原因"
              purpose="说明为什么要查看完整手机号，系统会写入敏感访问日志。"
              example="可以填售后联系、订单核对、客户回访。"
            />
          </template>
          <el-input
            v-model.trim="phoneForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 售后联系 / 订单核对 / 客户回访"
          />
        </el-form-item>
        <el-form-item v-if="phoneForm.phone">
          <template #label>
            <FieldHelpLabel
              label="完整手机号"
              purpose="展示客户完整手机号，仅供本次必要业务处理使用。"
              example="联系或核对完成后，不要把完整手机号写进普通备注。"
            />
          </template>
          <el-input v-model="phoneForm.phone" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="phoneDialogVisible = false">关闭</AppButton>
        <AppButton variant="danger" :loading="revealingPhone" @click="revealPhone">
          查看完整手机号
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { customersApi, dataCenterApi, sourcePlatformsApi, userTableViewsApi } from '@/api/system';
import type { CustomerQuery, DataDictionaryQuery, SourcePlatformQuery } from '@/api/system';
import CustomerProfileForm from '@/components/business/CustomerProfileForm.vue';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { buildQuickSettingCode, CUSTOMER_TAG_DICTIONARY_GROUP } from '@/config/quickSettings';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type {
  Customer,
  DataDictionary,
  PageResult,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';
import type { CustomerProfileFormModel } from '@/types/customerProfileForm';
import {
  assignCustomerProfileForm,
  buildCustomerProfilePayload,
  createCustomerProfileFormModel,
  fillCustomerProfileForm,
  resetCustomerProfileForm
} from '@/utils/customerProfileForm';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';

const tableKey = 'customers';
const customerStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const customerColumnOptions = [
  { label: '客户', value: 'name', required: true },
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
const formRef = ref<InstanceType<typeof CustomerProfileForm>>();
const phoneFormRef = ref<FormInstance>();
const customers = ref<Customer[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const customerTagDictionaries = ref<DataDictionary[]>([]);
const selectedCustomers = ref<Customer[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const authStore = useAuthStore();
const router = useRouter();
const activeCustomersQueryKey = ref('');
const activeSourcePlatformsQueryKey = ref('');
const activeCustomerTagsQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  sourcePlatformId: ''
});

const form = reactive<CustomerProfileFormModel>(createCustomerProfileFormModel());

const phoneForm = reactive({
  reason: '',
  phone: ''
});

const rules: FormRules<CustomerProfileFormModel> = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
};

const phoneRules: FormRules<typeof phoneForm> = {
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const tagOptions = computed(() => [
  ...new Set([
    ...customerTagDictionaries.value
      .filter((tag) => tag.status === 'active')
      .map((tag) => tag.label),
    ...customers.value.flatMap((customer) => customer.tags)
  ])
]);

const canRevealPhone = computed(
  () =>
    authStore.user?.roles.includes('admin') ||
    authStore.user?.permissions.includes('customer.view_phone')
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const activeCustomerCount = computed(
  () => customers.value.filter((customer) => customer.status === 'active').length
);
const sourcedCustomerCount = computed(
  () => customers.value.filter((customer) => Boolean(customer.sourcePlatformId)).length
);
const phoneCustomerCount = computed(
  () => customers.value.filter((customer) => Boolean(customer.phoneTail)).length
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

function buildSourcePlatformParams(): SourcePlatformQuery {
  return {
    page: 1,
    pageSize: 100,
    status: 'active'
  };
}

function buildCustomerTagParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 200,
    group: CUSTOMER_TAG_DICTIONARY_GROUP,
    status: 'active',
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function applySourcePlatformResult(data: PageResult<SourcePlatform>) {
  sourcePlatforms.value = data.items;
}

function applyCustomerTagResult(data: PageResult<DataDictionary>) {
  customerTagDictionaries.value = data.items;
}

async function loadSourcePlatforms(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildSourcePlatformParams();
  const key = createSmartQueryKey('source-platforms', params);

  activeSourcePlatformsQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => sourcePlatformsApi.list(params, { signal }),
      apply: applySourcePlatformResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'source-platforms' : undefined,
      isCurrent: () => activeSourcePlatformsQueryKey.value === key,
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载来源平台失败');
    }
  }
}

async function loadCustomerTags(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildCustomerTagParams();
  const key = createSmartQueryKey('customer-tags', params);

  activeCustomerTagsQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => dataCenterApi.listDictionaries(params, { signal }),
      apply: applyCustomerTagResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'customer-tags' : undefined,
      isCurrent: () => activeCustomerTagsQueryKey.value === key,
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载客户标签失败');
    }
  }
}

function buildCustomerParams(): CustomerQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    sourcePlatformId: query.sourcePlatformId || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyCustomerResult(data: PageResult<Customer>) {
  customers.value = data.items;
  total.value = data.total;
}

async function loadCustomers(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildCustomerParams();
  const key = createSmartQueryKey('customers', params);

  activeCustomersQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => customersApi.list(params, { signal }),
      apply: applyCustomerResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'customers' : undefined,
      isCurrent: () => activeCustomersQueryKey.value === key,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载客户失败');
    }
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

async function loadData(options: { background?: boolean; force?: boolean } = {}) {
  await Promise.all([
    loadSourcePlatforms(options),
    loadCustomerTags(options),
    loadCustomers(options)
  ]);
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
  density.value = 'default';
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
  resetCustomerProfileForm(form);
}

function openCreate() {
  editingCustomer.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(customer: Customer) {
  editingCustomer.value = customer;
  fillCustomerProfileForm(form, customer);
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
    const payload = buildCustomerProfilePayload(form);
    await ensureCustomerTagsRegistered(payload.tags ?? []);

    if (editingCustomer.value) {
      await customersApi.update(editingCustomer.value.id, payload);
    } else {
      await customersApi.create(buildCustomerProfilePayload(form, { emptyPhone: 'null' }));
    }

    ElMessage.success('客户已保存');
    dialogVisible.value = false;
    await Promise.all([loadCustomerTags({ force: true }), loadCustomers({ force: true })]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存客户失败');
  } finally {
    saving.value = false;
  }
}

async function removeCustomer(customer: Customer) {
  try {
    await ElMessageBox.confirm(
      `确认删除客户「${customer.name}」吗？删除后客户不会再出现在客户列表和新建订单下拉里，历史订单记录保留原关联。`,
      '删除客户',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    );
  } catch {
    return;
  }

  try {
    await customersApi.remove(customer.id);
    ElMessage.success('客户已删除');
    selectedCustomers.value = selectedCustomers.value.filter((item) => item.id !== customer.id);
    await loadCustomers({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除客户失败');
  }
}

async function ensureCustomerTagsRegistered(tags: string[]) {
  const existingLabels = new Set(customerTagDictionaries.value.map((tag) => tag.label.trim()));
  const missingTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].filter(
    (tag) => !existingLabels.has(tag)
  );

  if (!missingTags.length) {
    return;
  }

  await Promise.all(
    missingTags.map((tag) =>
      dataCenterApi.createDictionary({
        group: CUSTOMER_TAG_DICTIONARY_GROUP,
        code: buildQuickSettingCode(tag, 'tag'),
        label: tag,
        value: tag,
        sortOrder: customerTagDictionaries.value.length + 1,
        status: 'active',
        remark: '从新增客户标签自动保存'
      })
    )
  );
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
    await Promise.all([
      loadSourcePlatforms({ force: false }),
      loadCustomerTags({ force: false }),
      loadTableViews(true),
      loadCustomers({ force: false })
    ]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载客户失败');
  }
}

onMounted(initializePage);

usePageRefresh(
  (options) =>
    loadData({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '客户列表' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['customers', 'source-platforms', 'data-dictionaries'],
  () => {
    void loadData({
      background:
        customers.value.length > 0 ||
        sourcePlatforms.value.length > 0 ||
        customerTagDictionaries.value.length > 0,
      force: true
    });
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.common-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.common-compact-list-panel .inline-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: min(680px, 100%);
}

@media (max-width: 840px) {
  .common-compact-list-panel .inline-actions {
    justify-content: flex-start;
    max-width: none;
  }
}
</style>
