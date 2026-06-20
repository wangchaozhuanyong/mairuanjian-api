<template>
  <PageScaffold
    title="Apple ID 自动化任务"
    group="Apple ID 业务"
    phase="Phase 8"
    description="集中管理查询余额、检测状态、自动充值、取消订阅和账号资料变更等自动化任务，高风险任务进入人工验证兜底。"
  >
    <template #actions>
      <StatusChip tone="orange" dot>人工验证兜底</StatusChip>
    </template>

    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <div>
          <h3>自动化任务队列</h3>
          <p>管理余额查询、状态检测、充值、取消订阅和资料变更任务，失败或高风险任务转人工验证。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 个任务</StatusChip>
          <StatusChip tone="orange">队列中 {{ queuedCount }}</StatusChip>
          <StatusChip tone="purple">运行中 {{ runningCount }}</StatusChip>
          <StatusChip :tone="manualCount > 0 ? 'red' : 'green'" dot>
            {{ manualCount > 0 ? `需人工 ${manualCount}` : '无需人工' }}
          </StatusChip>
          <StatusChip :tone="failedCount > 0 ? 'red' : 'green'">
            失败复核 {{ failedCount }}
          </StatusChip>
          <StatusChip tone="green">成功 {{ successCount }}</StatusChip>
          <StatusChip :tone="automationFocusTasks.length ? 'orange' : 'green'">
            待处理 {{ automationFocusTasks.length }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="automationColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedTasks.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="创建自动化任务"
        placeholder="搜索 Apple ID、任务、错误、队列号"
        @search="handleSearch"
        @refresh="loadTasks"
        @primary="openCreateDialog"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.taskType"
            class="table-toolbar__select"
            clearable
            placeholder="任务类型"
            @change="handleSearch"
          >
            <el-option
              v-for="item in taskTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.priority"
            class="table-toolbar__select"
            clearable
            placeholder="优先级"
            @change="handleSearch"
          >
            <el-option
              v-for="item in priorityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.manualRequired"
            class="table-toolbar__select"
            clearable
            placeholder="人工验证"
            @change="handleSearch"
          >
            <el-option
              v-for="item in manualRequiredOptions"
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
        :data="tasks"
        :size="tableSize"
        row-key="id"
        empty-text="暂无自动化任务"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无自动化任务</strong>
            <span>可以创建自动化任务，或清空筛选后查看全部任务队列。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreateDialog">创建自动化任务</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('task')"
          prop="taskType"
          label="任务"
          min-width="210"
          sortable="custom"
        >
          <template #default="{ row }">
            <strong>{{ getTaskTypeLabel(row.taskType) }}</strong>
            <div class="muted-block">{{ row.queueJobId || '未分配队列号' }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="190">
          <template #default="{ row }">
            {{ row.appleAccount.appleIdMasked }}
            <div class="muted-block">
              {{ row.appleAccount.region }} / 余额 {{ row.appleAccount.currentBalance }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('priority')"
          prop="priority"
          label="优先级"
          width="90"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getPriorityTone(row.priority)" dot>
              {{ getPriorityLabel(row.priority) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('result')"
          prop="manualRequired"
          label="结果/异常"
          min-width="210"
          sortable="custom"
        >
          <template #default="{ row }">
            <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
            <span v-else-if="row.resultPayload">已有结果</span>
            <span v-else>-</span>
            <div v-if="row.manualRequired" class="muted-block">等待人工验证</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('time')"
          prop="createdAt"
          label="时间"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
            <div class="muted-block">完成 {{ formatDate(row.finishedAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton
                variant="success"
                :disabled="!canRun(row)"
                :loading="actionLoadingId === row.id"
                @click="runPlaceholder(row)"
              >
                执行
              </AppButton>
              <AppButton
                variant="ghost"
                :disabled="!canRetry(row)"
                :loading="actionLoadingId === row.id"
                @click="retryTask(row)"
              >
                重试
              </AppButton>
              <AppButton
                variant="soft"
                :disabled="isFinalStatus(row.status)"
                @click="markManual(row)"
              >
                转人工
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="mobile-record-list" aria-label="Apple ID 自动化任务移动列表">
        <article v-for="task in tasks" :key="task.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ getTaskTypeLabel(task.taskType) }}</strong>
              <span
                >{{ task.appleAccount.appleIdMasked }} ·
                {{ task.queueJobId || '未分配队列号' }}</span
              >
            </div>
            <StatusChip :tone="getPriorityTone(task.priority)">
              {{ getPriorityLabel(task.priority) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>状态</span>
              <strong>{{ getStatusLabel(task.status) }}</strong>
            </div>
            <div>
              <span>余额</span>
              <strong>{{ task.appleAccount.currentBalance }}</strong>
            </div>
            <div>
              <span>重试</span>
              <strong>{{ task.retryCount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>结果 / 异常</span>
              <strong>{{ task.errorMessage || (task.resultPayload ? '已有结果' : '-') }}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>{{ formatDate(task.createdAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip :tone="getStatusTone(task.status)" dot>
              {{ getStatusLabel(task.status) }}
            </StatusChip>
            <StatusChip v-if="task.manualRequired" tone="orange">人工验证</StatusChip>
            <StatusChip tone="blue">{{ task.appleAccount.region }}</StatusChip>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(task)">详情</AppButton>
            <AppButton
              size="small"
              variant="success"
              :disabled="!canRun(task)"
              :loading="actionLoadingId === task.id"
              @click="runPlaceholder(task)"
            >
              执行
            </AppButton>
            <AppButton
              size="small"
              variant="ghost"
              :disabled="!canRetry(task)"
              :loading="actionLoadingId === task.id"
              @click="retryTask(task)"
            >
              重试
            </AppButton>
            <AppButton
              size="small"
              variant="soft"
              :disabled="isFinalStatus(task.status)"
              @click="markManual(task)"
            >
              转人工
            </AppButton>
          </div>
        </article>

        <div v-if="!loading && tasks.length === 0" class="apple-core-empty-state">
          <strong>暂无自动化任务</strong>
          <span>可以创建自动化任务，或清空筛选后查看全部任务队列。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreateDialog">创建自动化任务</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadTasks"
      />
    </section>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="selectedTask ? `自动化任务 · ${getTaskTypeLabel(selectedTask.taskType)}` : '任务详情'"
      confirm-text="刷新详情"
      size="760px"
      @confirm="refreshDetail"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedTask?.appleAccount.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>任务类型</span>
          <strong>{{ selectedTask ? getTaskTypeLabel(selectedTask.taskType) : '-' }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ selectedTask ? getStatusLabel(selectedTask.status) : '-' }}</strong>
        </div>
        <div>
          <span>重试次数</span>
          <strong>{{ selectedTask?.retryCount ?? '-' }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">任务信息</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="队列号">
            {{ selectedTask?.queueJobId ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="异常代码">
            {{ selectedTask?.errorCode ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="异常说明">
            {{ selectedTask?.errorMessage ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ selectedTask?.createdBy?.displayName ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">处理动作</div>
        <div class="drawer-inline-actions drawer-inline-actions--inside">
          <AppButton
            variant="success"
            :disabled="!selectedTask || !canRun(selectedTask)"
            :loading="Boolean(selectedTask && actionLoadingId === selectedTask.id)"
            @click="selectedTask && runPlaceholder(selectedTask)"
          >
            执行任务
          </AppButton>
          <AppButton
            :disabled="!selectedTask || !canRetry(selectedTask)"
            :loading="Boolean(selectedTask && actionLoadingId === selectedTask.id)"
            @click="selectedTask && retryTask(selectedTask)"
          >
            重新入队
          </AppButton>
          <AppButton :disabled="!selectedTask" @click="writeSuccessResult">回写成功</AppButton>
          <AppButton variant="danger" :disabled="!selectedTask" @click="writeFailedResult">
            回写失败
          </AppButton>
          <AppButton
            variant="danger"
            :disabled="!selectedTask || isFinalStatus(selectedTask.status)"
            @click="selectedTask && cancelTask(selectedTask)"
          >
            取消任务
          </AppButton>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">结果数据</div>
        <pre class="json-preview">{{ formatJson(selectedTask?.resultPayload ?? null) }}</pre>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">任务日志</div>
        <el-table class="desktop-data-table" :data="selectedTask?.logs ?? []" row-key="id">
          <el-table-column label="级别" width="90">
            <template #default="{ row }">
              <StatusChip :tone="getLogTone(row.level)" dot>
                {{ row.level }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="日志" min-width="260">
            <template #default="{ row }">
              {{ row.message }}
              <div v-if="row.screenshotAttachment" class="muted-block">
                截图 {{ row.screenshotAttachment.originalName }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <div
          v-if="selectedTask?.logs?.length"
          class="mobile-record-list"
          aria-label="自动化任务日志移动列表"
        >
          <article v-for="log in selectedTask.logs" :key="log.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ log.message }}</strong>
                <span>{{ formatDate(log.createdAt) }}</span>
              </div>
              <StatusChip :tone="getLogTone(log.level)" dot>
                {{ log.level }}
              </StatusChip>
            </div>
            <div v-if="log.screenshotAttachment" class="mobile-record-card__meta">
              <div>
                <span>截图</span>
                <strong>{{ log.screenshotAttachment.originalName }}</strong>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="mobile-record-list" aria-label="自动化任务日志空状态">
          <div class="apple-core-empty-state">
            <strong>暂无任务日志</strong>
            <span>任务执行、重试或人工回写后会生成日志。</span>
          </div>
        </div>
      </div>
    </AppDrawer>

    <el-dialog
      v-model="createDialogVisible"
      title="创建自动化任务"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item label="任务类型" required>
          <el-select v-model="createForm.taskType" class="full-width">
            <el-option
              v-for="item in taskTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Apple ID" required>
          <el-select
            v-model="createForm.appleAccountId"
            class="full-width"
            filterable
            placeholder="选择 Apple ID"
          >
            <el-option
              v-for="account in appleAccounts"
              :key="account.id"
              :label="`${account.appleIdMasked} / ${account.region} / 余额 ${account.currentBalance}`"
              :value="account.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="createForm.priority" class="full-width">
            <el-option
              v-for="item in priorityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="输入参数 JSON">
          <el-input
            v-model="createForm.inputPayloadJson"
            type="textarea"
            :rows="5"
            placeholder='例如 {"expectedBalance":"100"}，不需要可留空'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="createDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createTask">创建任务</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  appleAutomationTasksApi,
  userTableViewsApi,
  type AppleAutomationTaskQuery
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppleAccount,
  AppleAutomationTask,
  AutomationTaskPriority,
  AutomationTaskStatus,
  AutomationTaskType,
  PageResult,
  TableDensity,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import { loadSmartAppleAccounts } from '@/utils/smartSystemQueries';

const tasks = ref<AppleAutomationTask[]>([]);
const appleAccounts = ref<AppleAccount[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const createDialogVisible = ref(false);
const detailDrawerVisible = ref(false);
const selectedTasks = ref<AppleAutomationTask[]>([]);
const selectedTask = ref<AppleAutomationTask | null>(null);
const actionLoadingId = ref('');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const tableKey = 'apple_automation_tasks';
const activeTasksQueryKey = ref('');

const query = reactive<AppleAutomationTaskQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  taskType: '',
  status: '',
  priority: '',
  appleAccountId: '',
  manualRequired: ''
});

const createForm = reactive<{
  taskType: AutomationTaskType;
  appleAccountId: string;
  priority: AutomationTaskPriority;
  inputPayloadJson: string;
}>({
  taskType: 'check_balance',
  appleAccountId: '',
  priority: 'medium',
  inputPayloadJson: ''
});

const taskTypeOptions: Array<{ label: string; value: AutomationTaskType }> = [
  { label: '检测状态', value: 'check_status' },
  { label: '查询余额', value: 'check_balance' },
  { label: '自动充值', value: 'topup' },
  { label: '取消订阅', value: 'cancel_subscription' },
  { label: '修改手机号', value: 'change_phone' },
  { label: '修改密保', value: 'change_security' },
  { label: '检查续费', value: 'check_renewal' }
];

const statusOptions: Array<{ label: string; value: AutomationTaskStatus }> = [
  { label: '待处理', value: 'pending' },
  { label: '队列中', value: 'queued' },
  { label: '运行中', value: 'running' },
  { label: '等待人工验证', value: 'waiting_manual_verify' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' },
  { label: '已取消', value: 'cancelled' },
  { label: '需复核', value: 'need_review' }
];

const priorityOptions: Array<{ label: string; value: AutomationTaskPriority }> = [
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
];

const manualRequiredOptions = [
  { label: '需要人工', value: 'true' },
  { label: '无需人工', value: 'false' }
];

const automationColumnOptions = [
  { label: '任务', value: 'task', required: true },
  { label: 'Apple ID', value: 'appleAccount' },
  { label: '优先级', value: 'priority' },
  { label: '状态', value: 'status' },
  { label: '结果/异常', value: 'result' },
  { label: '时间', value: 'time' }
];

const batchActions = [{ label: '批量导出', value: 'export' }];

const queuedCount = computed(
  () => tasks.value.filter((task) => task.status === 'pending' || task.status === 'queued').length
);
const manualCount = computed(() => tasks.value.filter((task) => task.manualRequired).length);
const successCount = computed(() => tasks.value.filter((task) => task.status === 'success').length);
const failedCount = computed(
  () =>
    tasks.value.filter((task) => task.status === 'failed' || task.status === 'need_review').length
);
const runningCount = computed(() => tasks.value.filter((task) => task.status === 'running').length);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const automationFocusTasks = computed(() =>
  tasks.value
    .filter(
      (task) =>
        task.manualRequired ||
        task.status === 'failed' ||
        task.status === 'need_review' ||
        task.status === 'waiting_manual_verify'
    )
    .slice()
    .sort((a, b) => getAutomationPriorityValue(a) - getAutomationPriorityValue(b))
    .slice(0, 4)
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const taskTypeLabel = taskTypeOptions.find((item) => item.value === query.taskType)?.label;
  const priorityLabel = priorityOptions.find((item) => item.value === query.priority)?.label;
  const manualRequiredLabel = manualRequiredOptions.find(
    (item) => item.value === query.manualRequired
  )?.label;

  if (query.taskType && taskTypeLabel) {
    chips.push({ key: 'taskType', label: '任务类型', value: taskTypeLabel });
  }
  if (query.priority && priorityLabel) {
    chips.push({ key: 'priority', label: '优先级', value: priorityLabel });
  }
  if (query.manualRequired && manualRequiredLabel) {
    chips.push({ key: 'manualRequired', label: '人工验证', value: manualRequiredLabel });
  }

  return chips;
});

onMounted(async () => {
  await Promise.all([initializePage(), loadAppleAccounts()]);
});

function buildTaskParams(): AppleAutomationTaskQuery {
  return {
    ...query,
    keyword: query.keyword || undefined,
    taskType: query.taskType || undefined,
    status: query.status || undefined,
    priority: query.priority || undefined,
    appleAccountId: query.appleAccountId || undefined,
    manualRequired: query.manualRequired || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyTaskResult(data: PageResult<AppleAutomationTask>) {
  tasks.value = data.items;
  total.value = data.total;
}

async function loadTasks(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildTaskParams();
  const key = createSmartQueryKey('apple-automation-tasks', params);
  const cached = getSmartQueryData<PageResult<AppleAutomationTask>>(key);

  activeTasksQueryKey.value = key;

  if (cached) {
    applyTaskResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => appleAutomationTasksApi.list(params),
      force: options.force ?? true
    });

    if (activeTasksQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyTaskResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载自动化任务失败');
    }
  } finally {
    if (activeTasksQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function initializePage() {
  await loadTableViews(true);
  await loadTasks({ force: false });
}

async function handleSearch() {
  query.page = 1;
  await loadTasks();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadTasks();
}

function handleSelectionChange(rows: AppleAutomationTask[]) {
  selectedTasks.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.taskType = '';
  query.status = '';
  query.priority = '';
  query.appleAccountId = '';
  query.manualRequired = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadTasks();
}

function removeFilter(key: string) {
  if (key === 'taskType') {
    query.taskType = '';
  }
  if (key === 'priority') {
    query.priority = '';
  }
  if (key === 'manualRequired') {
    query.manualRequired = '';
  }
}

function exportList() {
  ElMessage.info('Apple ID 自动化任务导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 自动化任务视图', {
      inputValue: 'Apple ID 自动化任务常用视图',
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
        taskType: query.taskType,
        status: query.status,
        priority: query.priority,
        appleAccountId: query.appleAccountId,
        manualRequired: query.manualRequired
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : automationColumnOptions.map((column) => column.value),
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
  await loadTasks();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.taskType = isTaskType(filters.taskType) ? filters.taskType : '';
  query.status = isTaskStatus(filters.status) ? filters.status : '';
  query.priority = isTaskPriority(filters.priority) ? filters.priority : '';
  query.appleAccountId = typeof filters.appleAccountId === 'string' ? filters.appleAccountId : '';
  query.manualRequired = typeof filters.manualRequired === 'string' ? filters.manualRequired : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        automationColumnOptions.some((option) => option.value === column)
      )
    : automationColumnOptions.map((column) => column.value);
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

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function isTaskType(value: unknown): value is AutomationTaskType {
  return taskTypeOptions.some((item) => item.value === value);
}

function isTaskStatus(value: unknown): value is AutomationTaskStatus {
  return statusOptions.some((item) => item.value === value);
}

function isTaskPriority(value: unknown): value is AutomationTaskPriority {
  return priorityOptions.some((item) => item.value === value);
}

async function loadAppleAccounts() {
  try {
    const result = await loadSmartAppleAccounts({
      page: 1,
      pageSize: 100,
      keyword: '',
      status: ''
    });
    appleAccounts.value = result.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 失败');
  }
}

function openCreateDialog() {
  createForm.taskType = 'check_balance';
  createForm.appleAccountId = appleAccounts.value[0]?.id ?? '';
  createForm.priority = 'medium';
  createForm.inputPayloadJson = '';
  createDialogVisible.value = true;
}

async function createTask() {
  if (!createForm.appleAccountId) {
    ElMessage.warning('请先选择 Apple ID');
    return;
  }

  const inputPayload = parseJsonPayload(createForm.inputPayloadJson);
  if (inputPayload === false) {
    return;
  }

  saving.value = true;
  try {
    const created = await appleAutomationTasksApi.create({
      taskType: createForm.taskType,
      appleAccountId: createForm.appleAccountId,
      priority: createForm.priority,
      inputPayload
    });
    ElMessage.success('自动化任务已创建');
    createDialogVisible.value = false;
    selectedTask.value = created;
    await loadTasks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建自动化任务失败');
  } finally {
    saving.value = false;
  }
}

async function openDetail(task: AppleAutomationTask) {
  try {
    selectedTask.value = await appleAutomationTasksApi.get(task.id);
    detailDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载任务详情失败');
  }
}

async function refreshDetail() {
  if (!selectedTask.value) return;
  try {
    selectedTask.value = await appleAutomationTasksApi.get(selectedTask.value.id);
    await loadTasks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新任务详情失败');
  }
}

async function runPlaceholder(task: AppleAutomationTask) {
  await runTaskAction(task.id, async () => {
    selectedTask.value = await appleAutomationTasksApi.runPlaceholder(task.id);
    ElMessage.success('任务已执行');
  });
}

async function retryTask(task: AppleAutomationTask) {
  await runTaskAction(task.id, async () => {
    selectedTask.value = await appleAutomationTasksApi.retry(task.id);
    ElMessage.success('任务已重新入队');
  });
}

async function cancelTask(task: AppleAutomationTask) {
  try {
    await ElMessageBox.confirm('取消后任务不会继续执行，确认取消吗？', '取消自动化任务', {
      type: 'warning',
      confirmButtonText: '确认取消',
      cancelButtonText: '返回'
    });
    await runTaskAction(task.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.cancel(task.id);
      ElMessage.success('任务已取消');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '取消任务失败');
    }
  }
}

async function markManual(task: AppleAutomationTask) {
  try {
    const { value } = await ElMessageBox.prompt('请输入转人工原因', '转人工验证', {
      inputType: 'textarea',
      confirmButtonText: '确认转人工',
      cancelButtonText: '取消'
    });
    await runTaskAction(task.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.markManual(task.id, {
        reason: value || '人工验证'
      });
      ElMessage.success('任务已转人工验证');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '转人工失败');
    }
  }
}

async function writeSuccessResult() {
  if (!selectedTask.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入结果 JSON', '回写成功结果', {
      inputType: 'textarea',
      inputValue: '{ "resultStatus": "normal" }',
      confirmButtonText: '回写成功',
      cancelButtonText: '取消'
    });
    const resultPayload = parseJsonPayload(value);
    if (resultPayload === false) return;
    await runTaskAction(selectedTask.value.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.writeResult(selectedTask.value!.id, {
        status: 'success',
        resultPayload
      });
      ElMessage.success('结果已回写');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '回写结果失败');
    }
  }
}

async function writeFailedResult() {
  if (!selectedTask.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入失败原因', '回写失败结果', {
      inputType: 'textarea',
      confirmButtonText: '回写失败',
      cancelButtonText: '取消'
    });
    await runTaskAction(selectedTask.value.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.writeResult(selectedTask.value!.id, {
        status: 'failed',
        errorCode: 'manual_writeback_failed',
        errorMessage: value || '人工回写失败'
      });
      ElMessage.success('失败结果已回写');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '回写失败结果失败');
    }
  }
}

async function runTaskAction(taskId: string, action: () => Promise<void>) {
  actionLoadingId.value = taskId;
  try {
    await action();
    await loadTasks();
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = await appleAutomationTasksApi.get(taskId);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '任务操作失败');
  } finally {
    actionLoadingId.value = '';
  }
}

function parseJsonPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    ElMessage.error('JSON 格式不正确');
    return false;
  }
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value) return '-';
  return JSON.stringify(value, null, 2);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getTaskTypeLabel(value: AutomationTaskType) {
  return taskTypeOptions.find((item) => item.value === value)?.label ?? value;
}

function getStatusLabel(value: AutomationTaskStatus) {
  return statusOptions.find((item) => item.value === value)?.label ?? value;
}

function getPriorityLabel(value: AutomationTaskPriority) {
  return priorityOptions.find((item) => item.value === value)?.label ?? value;
}

function getPriorityTone(value: AutomationTaskPriority) {
  if (value === 'urgent') return 'red';
  if (value === 'high') return 'orange';
  if (value === 'medium') return 'blue';
  return 'neutral';
}

function getStatusTone(value: AutomationTaskStatus) {
  if (value === 'success') return 'green';
  if (value === 'failed' || value === 'need_review') return 'red';
  if (value === 'waiting_manual_verify' || value === 'running') return 'orange';
  if (value === 'cancelled' || value === 'skipped') return 'neutral';
  return 'blue';
}

function getLogTone(value: string) {
  if (value === 'success') return 'green';
  if (value === 'error') return 'red';
  if (value === 'warning') return 'orange';
  return 'neutral';
}

function getAutomationPriorityValue(task: AppleAutomationTask) {
  if (task.status === 'failed' || task.status === 'need_review') return 0;
  if (task.manualRequired || task.status === 'waiting_manual_verify') return 1;
  if (task.priority === 'urgent') return 2;
  if (task.priority === 'high') return 3;
  return getTaskTimeValue(task);
}

function getTaskTimeValue(task: AppleAutomationTask) {
  const time = new Date(task.createdAt).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function canRun(task: AppleAutomationTask) {
  return ['pending', 'queued', 'failed', 'need_review'].includes(task.status);
}

function canRetry(task: AppleAutomationTask) {
  return ['failed', 'need_review', 'waiting_manual_verify', 'cancelled'].includes(task.status);
}

function isFinalStatus(value: AutomationTaskStatus) {
  return value === 'success' || value === 'cancelled' || value === 'skipped';
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-automation-tasks'], () => {
  void loadTasks({
    background: tasks.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
