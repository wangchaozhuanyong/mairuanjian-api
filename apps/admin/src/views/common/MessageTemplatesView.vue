<template>
  <PageScaffold
    title="发货模板"
    group="兑换码业务"
    phase="Phase 2"
    description="维护兑换码客户付款后收到的发货回复内容。模板变量使用 {{ variable }} 格式。"
  >
    <section class="content-panel common-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="发货模板列表"
          help="这些话术是给兑换码客户付款后发货回复用的，只服务兑换码发货，不和代充订单、通知提醒混在一起。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>模板 {{ total }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeTemplateCount }}</StatusChip>
          <StatusChip tone="orange">含变量 {{ variableTemplateCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="templateColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedTemplates.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增发货模板"
        placeholder="搜索模板名称、内容、备注"
        @search="handleSearch"
        @refresh="() => loadTemplates()"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      />

      <ListRequestError
        v-if="templatesLoadError && templates.length"
        title="发货模板刷新失败"
        :message="templatesLoadError"
        @retry="() => loadTemplates({ force: true })"
      />

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="templates"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <ListRequestError
            v-if="templatesLoadError"
            title="发货模板加载失败"
            :message="templatesLoadError"
            @retry="() => loadTemplates({ force: true })"
          />
          <div v-else class="apple-core-empty-state">
            <strong>暂无发货模板</strong>
            <span>可以新增模板，或清空筛选后重新查看模板列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增发货模板</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="模板"
          min-width="160"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('content')"
          prop="content"
          label="内容预览"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column v-if="isColumnVisible('variables')" label="变量" min-width="180">
          <template #default="{ row }">
            <StatusChip
              v-for="variable in row.variables"
              :key="variable"
              class="tag-gap"
              tone="blue"
            >
              {{ variable }}
            </StatusChip>
            <span v-if="!row.variables.length">-</span>
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
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton size="small" variant="danger" @click="removeTemplate(row)">
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="templates.length" class="mobile-record-list">
        <article v-for="template in templates" :key="template.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ template.name }}</strong>
              <span>兑换码发货话术</span>
            </div>
            <StatusTag :status="template.status" />
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>内容预览</span>
              <strong>{{ template.content }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(template.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip v-for="variable in template.variables" :key="variable" tone="blue">
              {{ variable }}
            </StatusChip>
            <StatusChip v-if="!template.variables.length" tone="neutral">无变量</StatusChip>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEdit(template)">编辑</AppButton>
            <AppButton size="small" variant="danger" @click="removeTemplate(template)">
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else-if="templatesLoadError" class="mobile-record-list" aria-label="发货模板加载失败">
        <ListRequestError
          title="发货模板加载失败"
          :message="templatesLoadError"
          @retry="() => loadTemplates({ force: true })"
        />
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无发货模板</strong>
          <span>可以新增模板，或清空筛选后重新查看模板列表。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增发货模板</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadTemplates()"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingTemplate ? '编辑发货模板' : '新增发货模板'"
      width="min(700px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item prop="name">
          <template #label>
            <FieldHelpLabel
              label="模板名称"
              purpose="发货模板的内部名称，员工选择模板时会看到它。"
              example="可以填兑换码自动发货模板、售后补发模板、手工说明模板。"
            />
          </template>
          <el-input v-model.trim="form.name" />
        </el-form-item>
        <el-form-item prop="content">
          <template #label>
            <FieldHelpLabel
              label="模板内容"
              purpose="实际生成给客户看的发货文字，可以放变量让系统替换。"
              example="例如：您的兑换码是 {{code}}，请尽快兑换。"
            />
          </template>
          <el-input v-model="form.content" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="变量"
              purpose="列出模板里会用到的占位符，系统生成内容时会替换成真实值。"
              example="常见变量有 code、faceValue、orderNo；没有变量可留空。"
            />
          </template>
          <el-select
            v-model="form.variables"
            class="full-input"
            multiple
            filterable
            allow-create
            default-first-option
          >
            <el-option
              v-for="variable in variableOptions"
              :key="variable"
              :label="variable"
              :value="variable"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个模板是否能在发货或售后流程中选择。"
              example="正在使用选启用；旧模板或未确认模板选停用。"
            />
          </template>
          <el-radio-group v-model="form.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录模板的使用场景或注意事项。"
              example="可以写只用于手工发货、只用于补发、含售后提示。"
            />
          </template>
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveTemplate">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { messageTemplatesApi, userTableViewsApi } from '@/api/system';
import type { MessageTemplateQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import ListRequestError from '@/components/ui/ListRequestError.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { MessageTemplate, PageResult, TableDensity, UserTableView } from '@/types/system';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { getLoadErrorMessage } from '@/utils/loadErrorMessage';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

const DELIVERY_TEMPLATE_TYPE = 'delivery' as const satisfies MessageTemplate['type'];
const DELIVERY_TEMPLATE_CHANNEL = 'customer_service' as const satisfies MessageTemplate['channel'];
const tableKey = 'delivery_templates';
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const templateColumnOptions = [
  { label: '模板', value: 'name', required: true },
  { label: '内容预览', value: 'content' },
  { label: '变量', value: 'variables' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingTemplate = ref<MessageTemplate | null>(null);
const formRef = ref<FormInstance>();
const templates = ref<MessageTemplate[]>([]);
const templatesLoadError = ref('');
const selectedTemplates = ref<MessageTemplate[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeTemplatesQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const form = reactive({
  name: '',
  type: DELIVERY_TEMPLATE_TYPE,
  channel: DELIVERY_TEMPLATE_CHANNEL,
  content: '',
  variables: [] as string[],
  status: 'active' as 'active' | 'disabled',
  remark: ''
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  content: [{ required: true, message: '请输入模板内容', trigger: 'blur' }]
};

const variableOptions = computed(() => [
  ...new Set(templates.value.flatMap((template) => template.variables))
]);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const activeTemplateCount = computed(
  () => templates.value.filter((template) => template.status === 'active').length
);
const variableTemplateCount = computed(
  () => templates.value.filter((template) => template.variables.length > 0).length
);
const filterChips = computed<Array<{ key: string; label: string; value: string }>>(() => []);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function buildTemplateParams(): MessageTemplateQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    type: DELIVERY_TEMPLATE_TYPE,
    channel: DELIVERY_TEMPLATE_CHANNEL,
    status: query.status || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyTemplateResult(data: PageResult<MessageTemplate>) {
  templates.value = data.items;
  total.value = data.total;
  templatesLoadError.value = '';
}

async function loadTemplates(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildTemplateParams();
  const key = createSmartQueryKey('message-templates', params);
  const cached = getSmartQueryData<PageResult<MessageTemplate>>(key);

  activeTemplatesQueryKey.value = key;

  if (cached) {
    applyTemplateResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => messageTemplatesApi.list(params),
      force: options.force ?? true
    });

    if (activeTemplatesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyTemplateResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      templatesLoadError.value = getLoadErrorMessage(error, '加载发货模板失败');
      ElMessage.error(templatesLoadError.value);
    }
  } finally {
    if (activeTemplatesQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadTemplates();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadTemplates();
}

function handleSelectionChange(rows: MessageTemplate[]) {
  selectedTemplates.value = rows;
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
}

function exportList() {
  const rows = selectedTemplates.value.length ? selectedTemplates.value : templates.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的发货模板');
    return;
  }

  const count = exportRowsToCsv(
    'delivery-templates',
    [
      { header: '模板名称', value: (row) => row.name },
      { header: '类型', value: (row) => row.type },
      { header: '渠道', value: (row) => row.channel },
      { header: '内容', value: (row) => row.content },
      { header: '变量', value: (row) => row.variables.join('、') },
      { header: '状态', value: (row) => (row.status === 'active' ? '启用' : '停用') },
      { header: '备注', value: (row) => row.remark ?? '' },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条发货模板`);
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存发货模板视图', {
      inputValue: '发货模板常用视图',
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
        : templateColumnOptions.map((column) => column.value),
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
  await loadTemplates();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isTemplateStatus(filters.status) ? filters.status : '';
  query.pageSize = view.pageSize;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        templateColumnOptions.some((option) => option.value === column)
      )
    : templateColumnOptions.map((column) => column.value);
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

function isTemplateStatus(value: unknown): value is MessageTemplate['status'] | '' {
  return value === '' || value === 'active' || value === 'disabled';
}

async function initializePage() {
  await loadTableViews(true);
  await loadTemplates({ force: false });
}

function resetForm() {
  form.name = '';
  form.type = DELIVERY_TEMPLATE_TYPE;
  form.channel = DELIVERY_TEMPLATE_CHANNEL;
  form.content = '';
  form.variables = [];
  form.status = 'active';
  form.remark = '';
}

function openCreate() {
  editingTemplate.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(template: MessageTemplate) {
  editingTemplate.value = template;
  form.name = template.name;
  form.type = DELIVERY_TEMPLATE_TYPE;
  form.channel = DELIVERY_TEMPLATE_CHANNEL;
  form.content = template.content;
  form.variables = [...template.variables];
  form.status = template.status;
  form.remark = template.remark ?? '';
  dialogVisible.value = true;
}

async function saveTemplate() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      type: DELIVERY_TEMPLATE_TYPE,
      channel: DELIVERY_TEMPLATE_CHANNEL,
      content: form.content,
      variables: form.variables,
      status: form.status,
      remark: form.remark || null
    };

    if (editingTemplate.value) {
      await messageTemplatesApi.update(editingTemplate.value.id, payload);
    } else {
      await messageTemplatesApi.create(payload);
    }

    ElMessage.success('发货模板已保存');
    dialogVisible.value = false;
    await loadTemplates({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存发货模板失败');
  } finally {
    saving.value = false;
  }
}

async function removeTemplate(template: MessageTemplate) {
  try {
    await ElMessageBox.confirm(
      `确认删除发货模板「${template.name}」吗？删除后自动发货和售后补发不能再选择这个模板，历史发货记录不受影响。`,
      '删除发货模板',
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
    await messageTemplatesApi.remove(template.id);
    ElMessage.success('发货模板已删除');
    selectedTemplates.value = selectedTemplates.value.filter((item) => item.id !== template.id);
    await loadTemplates({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除发货模板失败');
  }
}

onMounted(initializePage);

usePageRefresh(
  (options) =>
    loadTemplates({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '发货模板' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['message-templates'], () => {
  void loadTemplates({
    background: templates.value.length > 0,
    force: true
  });
});

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
