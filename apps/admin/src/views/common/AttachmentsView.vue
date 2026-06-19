<template>
  <PageScaffold
    title="附件管理"
    group="系统管理"
    phase="Phase 1"
    description="查看上传凭证、截图、售后材料和导入导出附件元数据。第一版先支持本地上传和列表查询。"
  >
    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:density="density"
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
        @refresh="loadAttachments"
        @primary="openUploadDialog"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-input
            v-model.trim="query.businessModule"
            class="table-toolbar__select"
            placeholder="业务模块"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-input
            v-model.trim="query.objectType"
            class="table-toolbar__select"
            placeholder="对象类型"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
          <el-input
            v-model.trim="query.purpose"
            class="table-toolbar__select"
            placeholder="用途"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="attachments"
        :size="tableSize"
        row-key="id"
        empty-text="暂无附件"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
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
          <template #default="{ row }">{{ row.purpose ?? '-' }}</template>
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
            <el-button text type="primary" @click="downloadAttachment(row)">下载</el-button>
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
          @current-change="loadAttachments"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="uploadDialogVisible" title="上传附件" width="620px">
      <el-form label-position="top">
        <el-form-item label="文件" required>
          <input ref="fileInputRef" type="file" @change="selectUploadFile" />
          <div class="upload-file-name">{{ selectedFile?.name ?? '未选择文件' }}</div>
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="业务模块">
            <el-input
              v-model.trim="uploadForm.businessModule"
              placeholder="apple / code / system"
            />
          </el-form-item>
          <el-form-item label="对象类型">
            <el-input v-model.trim="uploadForm.objectType" placeholder="renewal_task / order" />
          </el-form-item>
        </div>
        <el-form-item label="对象 ID">
          <el-input v-model.trim="uploadForm.objectId" placeholder="关联记录 UUID，可留空" />
        </el-form-item>
        <el-form-item label="用途">
          <el-input
            v-model.trim="uploadForm.purpose"
            placeholder="evidence / screenshot / import"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="uploadForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { attachmentsApi, userTableViewsApi } from '@/api/system';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { Attachment, TableDensity, UserTableView } from '@/types/system';

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

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (query.businessModule) {
    chips.push({ key: 'businessModule', label: '业务模块', value: query.businessModule });
  }
  if (query.objectType) {
    chips.push({ key: 'objectType', label: '对象类型', value: query.objectType });
  }
  if (query.purpose) {
    chips.push({ key: 'purpose', label: '用途', value: query.purpose });
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
  const moduleName = attachment.businessModule ?? '-';
  const objectType = attachment.objectType ?? '-';

  if (!attachment.objectId) {
    return `${moduleName} / ${objectType}`;
  }

  return `${moduleName} / ${objectType} / ${attachment.objectId.slice(0, 8)}`;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadAttachments() {
  loading.value = true;
  try {
    const data = await attachmentsApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      businessModule: query.businessModule || undefined,
      objectType: query.objectType || undefined,
      purpose: query.purpose || undefined,
      sortBy: mapSortProp(sortConfig.value.prop),
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    attachments.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载附件失败');
  } finally {
    loading.value = false;
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
  ElMessage.info('附件导出会进入数据中心导出任务，后续统一接入');
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
  density.value = view.density;
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
  loadAttachments();
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
    await loadAttachments();
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
  await loadAttachments();
}

onMounted(initializePage);
</script>
