<template>
  <PageScaffold
    title="消息模板"
    group="系统管理"
    phase="Phase 2"
    description="维护续费询问、发货、售后、通知等模板。模板变量使用 {{ variable }} 格式。"
  >
    <section class="content-panel common-compact-list-panel">
      <div class="panel-title-row">
        <div>
          <h3>消息模板列表</h3>
          <p>集中维护续费、发货、售后和通知话术，变量按模板配置展示。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>模板 {{ total }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeTemplateCount }}</StatusChip>
          <StatusChip tone="purple">Telegram {{ telegramTemplateCount }}</StatusChip>
          <StatusChip tone="orange">含变量 {{ variableTemplateCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="templateColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedTemplates.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增消息模板"
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
              v-for="item in templateTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.channel"
            class="table-toolbar__select"
            clearable
            placeholder="渠道"
            @change="handleSearch"
          >
            <el-option
              v-for="item in templateChannels"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>
      </TableToolbar>

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
          <div class="apple-core-empty-state">
            <strong>暂无消息模板</strong>
            <span>可以新增模板，或清空筛选后重新查看模板列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增消息模板</AppButton>
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
          v-if="isColumnVisible('type')"
          prop="type"
          label="类型"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">{{ getTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('channel')"
          prop="channel"
          label="渠道"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ getChannelLabel(row.channel) }}</template>
        </el-table-column>
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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="templates.length" class="mobile-record-list">
        <article v-for="template in templates" :key="template.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ template.name }}</strong>
              <span
                >{{ getTypeLabel(template.type) }} · {{ getChannelLabel(template.channel) }}</span
              >
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
              <span>类型</span>
              <strong>{{ getTypeLabel(template.type) }}</strong>
            </div>
            <div>
              <span>渠道</span>
              <strong>{{ getChannelLabel(template.channel) }}</strong>
            </div>
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
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无消息模板</strong>
          <span>可以新增模板，或清空筛选后重新查看模板列表。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增消息模板</AppButton>
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
      :title="editingTemplate ? '编辑消息模板' : '新增消息模板'"
      width="min(700px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model.trim="form.name" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" class="full-input">
            <el-option
              v-for="item in templateTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="form.channel" class="full-input">
            <el-option
              v-for="item in templateChannels"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模板内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item label="变量">
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
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { MessageTemplate, PageResult, TableDensity, UserTableView } from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

const templateTypes: Array<{ label: string; value: MessageTemplate['type'] }> = [
  { label: '续费', value: 'renewal' },
  { label: '发货', value: 'delivery' },
  { label: '售后', value: 'after_sale' },
  { label: '通知', value: 'notification' },
  { label: '自定义', value: 'custom' }
];

const templateChannels: Array<{ label: string; value: MessageTemplate['channel'] }> = [
  { label: '站内', value: 'internal' },
  { label: 'Telegram', value: 'telegram' },
  { label: '客服话术', value: 'customer_service' }
];

const tableKey = 'message_templates';
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const templateColumnOptions = [
  { label: '模板', value: 'name', required: true },
  { label: '类型', value: 'type' },
  { label: '渠道', value: 'channel' },
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
  type: '',
  channel: '',
  status: ''
});

const form = reactive({
  name: '',
  type: 'custom' as MessageTemplate['type'],
  channel: 'internal' as MessageTemplate['channel'],
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
const telegramTemplateCount = computed(
  () => templates.value.filter((template) => template.channel === 'telegram').length
);
const variableTemplateCount = computed(
  () => templates.value.filter((template) => template.variables.length > 0).length
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const typeLabel = templateTypes.find((item) => item.value === query.type)?.label;
  const channelLabel = templateChannels.find((item) => item.value === query.channel)?.label;

  if (query.type && typeLabel) {
    chips.push({ key: 'type', label: '类型', value: typeLabel });
  }
  if (query.channel && channelLabel) {
    chips.push({ key: 'channel', label: '渠道', value: channelLabel });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getTypeLabel(type: MessageTemplate['type']) {
  return templateTypes.find((item) => item.value === type)?.label ?? type;
}

function getChannelLabel(channel: MessageTemplate['channel']) {
  return templateChannels.find((item) => item.value === channel)?.label ?? channel;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function buildTemplateParams(): MessageTemplateQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    type: query.type || undefined,
    channel: query.channel || undefined,
    status: query.status || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyTemplateResult(data: PageResult<MessageTemplate>) {
  templates.value = data.items;
  total.value = data.total;
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
      ElMessage.error(error instanceof Error ? error.message : '加载消息模板失败');
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
  query.type = '';
  query.channel = '';
  query.status = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'type') {
    query.type = '';
  }
  if (key === 'channel') {
    query.channel = '';
  }
}

function exportList() {
  ElMessage.info('消息模板导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存消息模板视图', {
      inputValue: '消息模板常用视图',
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
        type: query.type,
        channel: query.channel,
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
  query.type = isTemplateType(filters.type) ? filters.type : '';
  query.channel = isTemplateChannel(filters.channel) ? filters.channel : '';
  query.status = isTemplateStatus(filters.status) ? filters.status : '';
  query.pageSize = view.pageSize;
  density.value = view.density;
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

function isTemplateType(value: unknown): value is MessageTemplate['type'] | '' {
  return (
    value === '' ||
    value === 'renewal' ||
    value === 'delivery' ||
    value === 'after_sale' ||
    value === 'notification' ||
    value === 'custom'
  );
}

function isTemplateChannel(value: unknown): value is MessageTemplate['channel'] | '' {
  return (
    value === '' || value === 'internal' || value === 'telegram' || value === 'customer_service'
  );
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
  form.type = 'custom';
  form.channel = 'internal';
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
  form.type = template.type;
  form.channel = template.channel;
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
      type: form.type,
      channel: form.channel,
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

    ElMessage.success('消息模板已保存');
    dialogVisible.value = false;
    await loadTemplates({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存消息模板失败');
  } finally {
    saving.value = false;
  }
}

onMounted(initializePage);

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
