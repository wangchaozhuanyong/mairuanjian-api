<template>
  <PageScaffold
    title="附件中心"
    group="数据与审计"
    phase="Phase 1"
    description="查看上传凭证、截图、售后材料和导入导出附件元数据。第一版先支持本地上传和列表查询。"
  >
    <section class="content-panel common-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="附件列表"
          help="这里统一看凭证、截图、售后材料，还有导入导出产生的附件记录。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>附件 {{ total }}</StatusChip>
          <StatusChip tone="green">图片 {{ imageAttachmentCount }}</StatusChip>
          <StatusChip tone="purple">已关联 {{ linkedAttachmentCount }}</StatusChip>
          <StatusChip tone="orange">当前页 {{ currentPageSize }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="attachmentColumnOptions"
        :filter-chips="filterChips"
        :saved-views="savedViews"
        :selected-count="selectedAttachments.length"
        :batch-actions="batchActions"
        :show-status="false"
        :show-date-shortcut="false"
        primary-label="上传附件"
        placeholder="搜索文件名、类型、归属、用途、备注"
        @search="handleSearch"
        @refresh="() => loadAttachments()"
        @primary="openUploadDialog"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.businessModule"
            class="table-toolbar__select"
            placeholder="业务模块"
            clearable
            filterable
            @change="handleSearch"
            @clear="handleSearch"
          >
            <el-option
              v-for="option in attachmentBusinessModuleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-input
            v-model.trim="query.objectType"
            class="table-toolbar__select"
            placeholder="对象类型"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-select
            v-model="query.purpose"
            class="table-toolbar__select"
            placeholder="用途"
            clearable
            filterable
            @change="handleSearch"
            @clear="handleSearch"
          >
            <el-option
              v-for="option in attachmentPurposeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="attachments"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无附件</strong>
            <span>可以上传附件，或清空筛选后重新查看附件列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openUploadDialog">上传附件</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('originalName')"
          prop="originalName"
          label="文件名"
          min-width="240"
          show-overflow-tooltip
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('mimeType')"
          prop="mimeType"
          label="类型"
          min-width="160"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('sizeBytes')"
          prop="sizeBytes"
          label="大小"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatSize(row.sizeBytes) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('association')"
          prop="businessModule"
          label="业务归属"
          min-width="190"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatAssociation(row) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('purpose')"
          prop="purpose"
          label="用途"
          min-width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatAttachmentPurpose(row.purpose) }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('createdBy')" label="上传人" min-width="140">
          <template #default="{ row }">{{
            row.createdBy?.displayName ?? row.createdBy?.username ?? '-'
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('createdAt')"
          prop="createdAt"
          label="上传时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <AppButton size="small" variant="ghost" @click="downloadAttachment(row)"
              >下载</AppButton
            >
          </template>
        </el-table-column>
      </el-table>

      <div v-if="attachments.length" class="mobile-record-list">
        <article v-for="attachment in attachments" :key="attachment.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ attachment.originalName }}</strong>
              <span>{{ formatAssociation(attachment) }}</span>
            </div>
            <StatusChip tone="blue" dot>{{ formatSize(attachment.sizeBytes) }}</StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>类型</span>
              <strong>{{ attachment.mimeType }}</strong>
            </div>
            <div>
              <span>用途</span>
              <strong>{{ formatAttachmentPurpose(attachment.purpose) }}</strong>
            </div>
            <div>
              <span>上传人</span>
              <strong>{{
                attachment.createdBy?.displayName ?? attachment.createdBy?.username ?? '-'
              }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>业务归属</span>
              <strong>{{ formatAssociation(attachment) }}</strong>
            </div>
            <div>
              <span>上传时间</span>
              <strong>{{ formatDate(attachment.createdAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="downloadAttachment(attachment)">
              下载
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无附件</strong>
          <span>可以上传附件，或清空筛选后重新查看附件列表。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openUploadDialog">上传附件</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @page-change="() => loadAttachments()"
        @page-size-change="handlePageSizeChange"
      />
    </section>

    <el-dialog
      v-model="uploadDialogVisible"
      title="上传附件"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="文件"
              purpose="选择要上传的附件，后续可关联到订单、任务、凭证或系统记录。"
              example="可以上传聊天截图、付款截图、自动化截图、导入文件。"
            />
          </template>
          <input ref="fileInputRef" type="file" @change="selectUploadFile" />
          <div class="upload-file-name">{{ selectedFile?.name ?? '未选择文件' }}</div>
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="业务模块"
                purpose="说明附件属于哪个业务区，方便后续筛选和权限管理。"
                example="Apple ID 相关选 Apple ID，兑换码相关选兑换码，系统凭证选系统配置。"
              />
            </template>
            <el-select
              v-model="uploadForm.businessModule"
              class="full-input"
              clearable
              filterable
              placeholder="请选择业务模块"
            >
              <el-option
                v-for="option in attachmentBusinessModuleOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="对象类型"
                purpose="说明附件关联的是哪类记录。"
                example="续费任务填 renewal_task，订单填 order，自动化任务填 automation_task。"
              />
            </template>
            <el-input v-model.trim="uploadForm.objectType" placeholder="renewal_task / order" />
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="对象 ID"
              purpose="填写要关联的具体记录 ID，便于从业务记录回查附件。"
              example="如果是某个续费任务的截图，就填该任务 UUID；普通资料可留空。"
            />
          </template>
          <el-input v-model.trim="uploadForm.objectId" placeholder="关联记录 UUID，可留空" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="用途"
              purpose="说明附件用途，方便列表筛选和后续审计。"
              example="付款证明选凭证，页面截图选截图，导入表格选导入文件。"
            />
          </template>
          <el-select
            v-model="uploadForm.purpose"
            class="full-input"
            clearable
            filterable
            placeholder="请选择用途"
          >
            <el-option
              v-for="option in attachmentPurposeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录附件的补充说明。"
              example="可以写来自哪位客户、对应哪次处理、是否需要复核。"
            />
          </template>
          <el-input v-model="uploadForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="uploadDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="uploading" @click="submitUpload">上传</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { Ref } from 'vue';
import { attachmentsApi, dataCenterApi, userTableViewsApi } from '@/api/system';
import type { AttachmentQuery, DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import {
  ATTACHMENT_BUSINESS_MODULE_DICTIONARY_GROUP,
  ATTACHMENT_PURPOSE_DICTIONARY_GROUP
} from '@/config/quickSettings';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  Attachment,
  DataDictionary,
  PageResult,
  TableDensity,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import {
  buildAttachmentBusinessModuleOptions,
  buildAttachmentPurposeOptions,
  getAttachmentBusinessModuleLabel,
  getAttachmentPurposeLabel
} from '@/utils/systemQuickOptions';
import { exportRowsToCsv } from '@/utils/exportCsv';

type LoadOptions = { background?: boolean; force?: boolean };

const tableKey = 'attachments';
const attachmentColumnOptions = [
  { label: '文件名', value: 'originalName', required: true },
  { label: '类型', value: 'mimeType' },
  { label: '大小', value: 'sizeBytes' },
  { label: '业务归属', value: 'association' },
  { label: '用途', value: 'purpose' },
  { label: '上传人', value: 'createdBy' },
  { label: '上传时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const uploading = ref(false);
const uploadDialogVisible = ref(false);
const fileInputRef = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const attachments = ref<Attachment[]>([]);
const selectedAttachments = ref<Attachment[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeAttachmentsQueryKey = ref('');
const attachmentBusinessModuleDictionaries = ref<DataDictionary[]>([]);
const attachmentPurposeDictionaries = ref<DataDictionary[]>([]);

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  businessModule: '',
  objectType: '',
  purpose: ''
});

const uploadForm = reactive({
  businessModule: '',
  objectType: '',
  objectId: '',
  purpose: '',
  remark: ''
});

const attachmentBusinessModuleOptions = computed(() =>
  buildAttachmentBusinessModuleOptions(attachmentBusinessModuleDictionaries.value)
);
const attachmentPurposeOptions = computed(() =>
  buildAttachmentPurposeOptions(attachmentPurposeDictionaries.value)
);

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const imageAttachmentCount = computed(
  () => attachments.value.filter((attachment) => attachment.mimeType.startsWith('image/')).length
);
const linkedAttachmentCount = computed(
  () =>
    attachments.value.filter((attachment) =>
      Boolean(attachment.businessModule || attachment.objectType || attachment.objectId)
    ).length
);
const currentPageSize = computed(() =>
  formatSize(
    String(
      attachments.value.reduce((sum, attachment) => {
        const size = Number(attachment.sizeBytes);
        return Number.isFinite(size) ? sum + size : sum;
      }, 0)
    )
  )
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (query.businessModule) {
    chips.push({
      key: 'businessModule',
      label: '业务模块',
      value: formatAttachmentBusinessModule(query.businessModule)
    });
  }
  if (query.objectType) {
    chips.push({ key: 'objectType', label: '对象类型', value: query.objectType });
  }
  if (query.purpose) {
    chips.push({ key: 'purpose', label: '用途', value: formatAttachmentPurpose(query.purpose) });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function formatSize(value: string) {
  const size = Number(value);
  if (!Number.isFinite(size)) {
    return '-';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatAssociation(attachment: Attachment) {
  const moduleName = formatAttachmentBusinessModule(attachment.businessModule);
  const objectType = attachment.objectType ?? '-';

  if (!attachment.objectId) {
    return `${moduleName} / ${objectType}`;
  }

  return `${moduleName} / ${objectType} / ${attachment.objectId.slice(0, 8)}`;
}

function formatAttachmentBusinessModule(value?: string | null) {
  return value
    ? getAttachmentBusinessModuleLabel(value, attachmentBusinessModuleDictionaries.value)
    : '-';
}

function formatAttachmentPurpose(value?: string | null) {
  return value ? getAttachmentPurposeLabel(value, attachmentPurposeDictionaries.value) : '-';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['attachments', 'data-dictionaries'],
  ({ scopes }) => {
    if (scopes.includes('data-dictionaries')) {
      void loadAttachmentOptions({ background: true, force: true });
    }

    if (scopes.includes('attachments')) {
      void loadAttachments({
        background: attachments.value.length > 0,
        force: true
      });
    }
  }
);

onBeforeUnmount(stopRealtimeRefresh);

function buildAttachmentParams(): AttachmentQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    businessModule: query.businessModule || undefined,
    objectType: query.objectType || undefined,
    purpose: query.purpose || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyAttachmentsResult(data: PageResult<Attachment>) {
  attachments.value = data.items;
  total.value = data.total;
  selectedAttachments.value = selectedAttachments.value.filter((selected) =>
    data.items.some((attachment) => attachment.id === selected.id)
  );
}

async function loadCachedPage<TItem>(config: {
  scope: string;
  params: unknown;
  activeKey: Ref<string>;
  setLoading: (loading: boolean) => void;
  apply: (result: PageResult<TItem>) => void;
  fetcher: () => Promise<PageResult<TItem>>;
  errorMessage: string;
  options?: LoadOptions;
}) {
  const options = config.options ?? {};
  const key = createSmartQueryKey(config.scope, config.params);
  const cached = getSmartQueryData<PageResult<TItem>>(key);

  config.activeKey.value = key;

  if (cached) {
    config.apply(cached);
  }

  config.setLoading(!cached && !options.background);

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: config.fetcher,
      force: options.force ?? true
    });

    if (config.activeKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      config.apply(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : config.errorMessage);
    }
  } finally {
    if (config.activeKey.value === key) {
      config.setLoading(false);
    }
  }
}

async function loadAttachments(options: LoadOptions = {}) {
  const params = buildAttachmentParams();
  await loadCachedPage<Attachment>({
    scope: 'attachments',
    params,
    activeKey: activeAttachmentsQueryKey,
    setLoading: (nextLoading) => {
      loading.value = nextLoading;
    },
    apply: applyAttachmentsResult,
    fetcher: () => attachmentsApi.list(params),
    errorMessage: '加载附件失败',
    options
  });
}

function buildAttachmentOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadAttachmentOptions(options: LoadOptions = {}) {
  try {
    const [businessModules, purposes] = await Promise.all([
      dataCenterApi.listDictionaries(
        buildAttachmentOptionParams(ATTACHMENT_BUSINESS_MODULE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildAttachmentOptionParams(ATTACHMENT_PURPOSE_DICTIONARY_GROUP)
      )
    ]);
    attachmentBusinessModuleDictionaries.value = businessModules.items;
    attachmentPurposeDictionaries.value = purposes.items;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载附件选项失败');
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadAttachments();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.businessModule = '';
  query.objectType = '';
  query.purpose = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'businessModule') {
    query.businessModule = '';
  }
  if (key === 'objectType') {
    query.objectType = '';
  }
  if (key === 'purpose') {
    query.purpose = '';
  }
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadAttachments();
}

function handleSelectionChange(rows: Attachment[]) {
  selectedAttachments.value = rows;
}

function exportList() {
  const rows = selectedAttachments.value.length ? selectedAttachments.value : attachments.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的附件记录');
    return;
  }

  const count = exportRowsToCsv(
    'attachments',
    [
      { header: '文件名', value: (row) => row.originalName },
      { header: '文件类型', value: (row) => row.mimeType },
      { header: '大小', value: (row) => row.sizeBytes },
      {
        header: '业务模块',
        value: (row) => formatAttachmentBusinessModule(row.businessModule)
      },
      {
        header: '用途',
        value: (row) => formatAttachmentPurpose(row.purpose)
      },
      { header: '对象类型', value: (row) => row.objectType ?? '' },
      { header: '对象ID', value: (row) => row.objectId ?? '' },
      { header: '上传人', value: (row) => row.createdBy?.displayName ?? '' },
      { header: '备注', value: (row) => row.remark ?? '' },
      { header: '上传时间', value: (row) => formatDate(row.createdAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条附件记录`);
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存附件视图', {
      inputValue: '附件常用视图',
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
        businessModule: query.businessModule,
        objectType: query.objectType,
        purpose: query.purpose
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : attachmentColumnOptions.map((column) => column.value),
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
  await loadAttachments();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.businessModule = typeof filters.businessModule === 'string' ? filters.businessModule : '';
  query.objectType = typeof filters.objectType === 'string' ? filters.objectType : '';
  query.purpose = typeof filters.purpose === 'string' ? filters.purpose : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        attachmentColumnOptions.some((option) => option.value === column)
      )
    : attachmentColumnOptions.map((column) => column.value);
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
  if (prop === 'originalName') return 'originalName';
  if (prop === 'mimeType') return 'mimeType';
  if (prop === 'sizeBytes') return 'sizeBytes';
  if (prop === 'businessModule') return 'businessModule';
  if (prop === 'purpose') return 'purpose';
  if (prop === 'createdAt') return 'createdAt';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function handlePageSizeChange() {
  query.page = 1;
  void loadAttachments();
}

function resetUploadForm() {
  selectedFile.value = null;
  uploadForm.businessModule = '';
  uploadForm.objectType = '';
  uploadForm.objectId = '';
  uploadForm.purpose = '';
  uploadForm.remark = '';
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

function openUploadDialog() {
  resetUploadForm();
  uploadDialogVisible.value = true;
}

function selectUploadFile(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
}

async function submitUpload() {
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的附件');
    return;
  }

  uploading.value = true;
  try {
    await attachmentsApi.upload(selectedFile.value, {
      businessModule: uploadForm.businessModule || undefined,
      objectType: uploadForm.objectType || undefined,
      objectId: uploadForm.objectId || undefined,
      purpose: uploadForm.purpose || undefined,
      remark: uploadForm.remark || undefined
    });
    ElMessage.success('附件已上传');
    uploadDialogVisible.value = false;
    await loadAttachments({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传附件失败');
  } finally {
    uploading.value = false;
  }
}

async function downloadAttachment(attachment: Attachment) {
  try {
    const response = await attachmentsApi.download(attachment.id);
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.originalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '下载附件失败');
  }
}

async function initializePage() {
  await loadTableViews(true);
  await loadAttachmentOptions({ force: false });
  await loadAttachments({ force: false });
}

onMounted(initializePage);
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
