<template>
  <PageScaffold
    :title="pageCopy.title"
    group="工作台"
    phase="Phase 5"
    :description="pageCopy.description"
  >
    <div class="renewal-kanban" aria-label="续费任务看板">
      <section v-for="lane in renewalLanes" :key="lane.key" class="renewal-lane">
        <header class="renewal-lane__head">
          <div>
            <strong>{{ lane.title }}</strong>
            <p>{{ lane.description }}</p>
          </div>
          <StatusChip :tone="lane.tone">{{ lane.tasks.length }}</StatusChip>
        </header>

        <div class="renewal-lane__body">
          <button
            v-for="task in lane.tasks"
            :key="task.id"
            class="renewal-task-card"
            type="button"
            @click="openDetail(task)"
          >
            <span class="renewal-task-card__head">
              <strong>{{ task.customer.name }} · {{ task.service.name }}</strong>
              <StatusChip :tone="getPriorityTone(task.priority)">
                {{ getPriorityLabel(task.priority) }}
              </StatusChip>
            </span>
            <p>{{ task.requiredAction || getTaskTypeLabel(task.taskType) }}</p>
            <span class="renewal-task-card__meta">
              <StatusChip :tone="getStatusTone(task.status)" dot>
                {{ getStatusLabel(task.status) }}
              </StatusChip>
              <em>{{ task.dueAt ? getDueText(task.dueAt) : '未设置截止' }}</em>
            </span>
          </button>

          <div v-if="lane.tasks.length === 0" class="renewal-lane-empty">
            <strong>暂无任务</strong>
            <span>当前筛选条件下没有匹配项。</span>
          </div>
        </div>
      </section>
    </div>

    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <div>
          <h3>{{ pageCopy.panelTitle }}</h3>
          <p>{{ pageCopy.panelDescription }}</p>
        </div>
        <div class="inline-actions">
          <StatusChip :tone="pageCopy.tone" dot>{{ pageCopy.badge }}</StatusChip>
          <StatusChip tone="blue">待办 {{ pendingCount }}</StatusChip>
          <StatusChip :tone="urgentCount > 0 ? 'red' : 'green'">
            {{ urgentCount > 0 ? `紧急 ${urgentCount}` : '暂无紧急' }}
          </StatusChip>
          <StatusChip tone="orange">高优先级 {{ highPriorityCount }}</StatusChip>
          <StatusChip tone="red">取消 {{ cancelTaskCount }}</StatusChip>
          <StatusChip tone="orange">充值 {{ topupTaskCount }}</StatusChip>
          <StatusChip tone="green">自动续费 {{ autoRenewTaskCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="renewalColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedTasks.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        show-overwrite-view
        :primary-loading="generating"
        primary-label="生成到期任务"
        placeholder="搜索任务、客户、业务、订单、Apple ID"
        @search="handleSearch"
        @refresh="reloadTable"
        @primary="generateDueTasks"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @overwrite-view="overwriteTableView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-if="!fixedTaskType"
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
            v-model="query.customerDecision"
            class="table-toolbar__select"
            clearable
            placeholder="客户决定"
            @change="handleSearch"
          >
            <el-option
              v-for="item in customerDecisionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <div class="quick-date renewal-due-shortcuts" role="group" aria-label="截止时间快捷筛选">
            <button
              type="button"
              :class="{ active: quickDate === '' }"
              @click="selectQuickDate('')"
            >
              全部
            </button>
            <button
              v-for="item in quickDateOptions"
              :key="item.value"
              type="button"
              :class="{ active: quickDate === item.value }"
              @click="selectQuickDate(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="tasks"
        :size="tableSize"
        row-key="id"
        empty-text="暂无续费任务"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无续费任务</strong>
            <span>可以生成到期任务，或调整筛选条件后重新查看。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" :loading="generating" @click="generateDueTasks">
                生成到期任务
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('task')"
          prop="title"
          label="任务"
          min-width="240"
          sortable="custom"
        >
          <template #default="{ row }">
            <strong>{{ row.title }}</strong>
            <div class="muted-block">
              {{ getTaskTypeLabel(row.taskType) }} · {{ row.order.orderNo }}
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('customer')" label="客户/业务" min-width="180">
          <template #default="{ row }">
            {{ row.customer.name }}
            <div class="muted-block">{{ row.service.name }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('appleAccount')"
          prop="currentBalance"
          label="Apple ID"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.appleAccount?.appleIdMasked ?? '-' }}
            <div class="muted-block">
              余额 {{ row.currentBalance }} / 扣费 {{ row.expectedChargeAmount }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('suggestedTopupAmount')"
          prop="suggestedTopupAmount"
          label="建议充值"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.suggestedTopupAmount }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('dueAt')"
          prop="dueAt"
          label="截止时间"
          min-width="165"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatDate(row.dueAt) }}
            <StatusChip v-if="row.dueAt" class="tag-gap" :tone="getDueTone(row.dueAt)">
              {{ getDueText(row.dueAt) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('customerDecision')"
          prop="customerDecision"
          label="客户决定"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getCustomerDecisionTone(row.customerDecision)">
              {{ getCustomerDecisionLabel(row.customerDecision) }}
            </StatusChip>
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
            <StatusChip :tone="getPriorityTone(row.priority)">
              {{ getPriorityLabel(row.priority) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton
                size="small"
                variant="success"
                :disabled="isFinalStatus(row.status)"
                @click="completeTask(row)"
              >
                完成
              </AppButton>
              <AppButton
                size="small"
                variant="soft"
                :disabled="isFinalStatus(row.status)"
                @click="postponeTask(row)"
              >
                延期
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="mobile-record-list" aria-label="续费任务移动列表">
        <article v-for="task in tasks" :key="task.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ task.customer.name }} · {{ task.service.name }}</strong>
              <span>{{ getTaskTypeLabel(task.taskType) }} · {{ task.order.orderNo }}</span>
            </div>
            <StatusChip :tone="getPriorityTone(task.priority)">
              {{ getPriorityLabel(task.priority) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>Apple ID</span>
              <strong>{{ task.appleAccount?.appleIdMasked ?? '-' }}</strong>
            </div>
            <div>
              <span>建议充值</span>
              <strong>{{ task.suggestedTopupAmount }}</strong>
            </div>
            <div>
              <span>截止时间</span>
              <strong>{{ task.dueAt ? getDueText(task.dueAt) : '未设置' }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>余额 / 预计扣费</span>
              <strong>{{ task.currentBalance }} / {{ task.expectedChargeAmount }}</strong>
            </div>
            <div>
              <span>客户决定</span>
              <strong>{{ getCustomerDecisionLabel(task.customerDecision) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip :tone="getStatusTone(task.status)" dot>
              {{ getStatusLabel(task.status) }}
            </StatusChip>
            <StatusChip v-if="task.dueAt" :tone="getDueTone(task.dueAt)">
              {{ formatDate(task.dueAt) }}
            </StatusChip>
            <StatusChip :tone="getCustomerDecisionTone(task.customerDecision)">
              {{ getCustomerDecisionLabel(task.customerDecision) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(task)">详情</AppButton>
            <AppButton
              size="small"
              variant="success"
              :disabled="isFinalStatus(task.status)"
              @click="completeTask(task)"
            >
              完成
            </AppButton>
            <AppButton
              size="small"
              variant="soft"
              :disabled="isFinalStatus(task.status)"
              @click="postponeTask(task)"
            >
              延期
            </AppButton>
          </div>
        </article>

        <div v-if="!loading && tasks.length === 0" class="apple-core-empty-state">
          <strong>暂无续费任务</strong>
          <span>可以生成到期任务，或调整筛选条件后重新查看。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" :loading="generating" @click="generateDueTasks">
              生成到期任务
            </AppButton>
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
      :title="selectedTask ? `续费任务 · ${selectedTask.order.orderNo}` : '续费任务详情'"
      confirm-text="保存处理"
      :confirm-loading="evidenceUploading"
      size="640px"
      @confirm="saveTask"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>客户</span>
          <strong>{{ selectedTask?.customer.name ?? '-' }}</strong>
        </div>
        <div>
          <span>业务</span>
          <strong>{{ selectedTask?.service.name ?? '-' }}</strong>
        </div>
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedTask?.appleAccount?.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>到期</span>
          <strong>{{ formatDate(selectedTask?.activation.expireTime) }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">任务明细</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="任务类型">
            {{ selectedTask ? getTaskTypeLabel(selectedTask.taskType) : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="需要动作">
            {{ selectedTask?.requiredAction ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="余额/扣费/建议充值">
            {{ selectedTask?.currentBalance ?? '-' }} /
            {{ selectedTask?.expectedChargeAmount ?? '-' }} /
            {{ selectedTask?.suggestedTopupAmount ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="套餐">
            {{ selectedTask?.currentPlan ?? '-' }} -> {{ selectedTask?.targetPlan ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">处理信息</div>
        <el-form label-position="top">
          <div class="form-grid">
            <el-form-item label="状态">
              <el-select v-model="form.status" class="full-width">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="form.priority" class="full-width">
                <el-option
                  v-for="item in priorityOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="客户决定">
              <el-select v-model="form.customerDecision" class="full-width">
                <el-option
                  v-for="item in customerDecisionOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="任务备注">
            <el-input
              v-model="form.note"
              type="textarea"
              :rows="3"
              placeholder="记录联系过程、客户反馈、风险说明"
            />
          </el-form-item>
          <el-form-item label="处理结果">
            <el-input
              v-model="form.resultNote"
              type="textarea"
              :rows="3"
              placeholder="完成、取消或延期时记录处理结果"
            />
          </el-form-item>
          <el-form-item label="处理凭证">
            <div class="evidence-box">
              <div v-if="selectedTask?.evidenceAttachment" class="evidence-current">
                <div>
                  <strong>{{ selectedTask.evidenceAttachment.originalName }}</strong>
                  <div class="muted-block">
                    {{ selectedTask.evidenceAttachment.mimeType }} ·
                    {{ formatSize(selectedTask.evidenceAttachment.sizeBytes) }} ·
                    {{ formatDate(selectedTask.evidenceAttachment.createdAt) }}
                  </div>
                </div>
                <AppButton
                  variant="ghost"
                  :disabled="evidenceUploading"
                  @click="downloadEvidenceAttachment"
                >
                  下载
                </AppButton>
              </div>
              <input
                ref="evidenceFileInputRef"
                type="file"
                :disabled="evidenceUploading"
                @change="selectEvidenceFile"
              />
              <div v-if="evidenceFile" class="muted-block">待上传：{{ evidenceFile.name }}</div>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">快捷处理</div>
        <div class="drawer-inline-actions drawer-inline-actions--inside">
          <AppButton
            variant="success"
            :loading="evidenceUploading"
            :disabled="!selectedTask || isFinalStatus(selectedTask.status)"
            @click="completeSelectedTask"
          >
            标记完成
          </AppButton>
          <AppButton
            variant="soft"
            :disabled="evidenceUploading || !selectedTask || isFinalStatus(selectedTask.status)"
            @click="postponeSelectedTask"
          >
            延期1天
          </AppButton>
          <AppButton
            variant="danger"
            :disabled="evidenceUploading || !selectedTask || isFinalStatus(selectedTask.status)"
            @click="cancelSelectedTask"
          >
            取消任务
          </AppButton>
        </div>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  appleRenewalTasksApi,
  attachmentsApi,
  userTableViewsApi,
  type RenewalTaskQuery,
  type SaveUserTableViewPayload
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { RenewalTask, TableDensity, UserTableView } from '@/types/system';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';

const route = useRoute();
const tasks = ref<RenewalTask[]>([]);
const total = ref(0);
const loading = ref(false);
const generating = ref(false);
const evidenceUploading = ref(false);
const quickDate = ref('');
const detailDrawerVisible = ref(false);
const selectedTask = ref<RenewalTask | null>(null);
const selectedTasks = ref<RenewalTask[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const evidenceFile = ref<File | null>(null);
const evidenceFileInputRef = ref<HTMLInputElement>();
const activatedOnce = ref(false);
const activeTasksQueryKey = ref('');
type ChipTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
type RenewalTaskPage = Awaited<ReturnType<typeof appleRenewalTasksApi.list>>;

interface RenewalLane {
  key: string;
  title: string;
  description: string;
  tone: ChipTone;
  tasks: RenewalTask[];
}

const renewalColumnOptions = [
  { label: '任务', value: 'task', required: true },
  { label: '客户/业务', value: 'customer' },
  { label: 'Apple ID', value: 'appleAccount' },
  { label: '建议充值', value: 'suggestedTopupAmount' },
  { label: '截止时间', value: 'dueAt' },
  { label: '客户决定', value: 'customerDecision' },
  { label: '优先级', value: 'priority' },
  { label: '状态', value: 'status' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const query = reactive<RenewalTaskQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  taskType: '',
  priority: '',
  customerDecision: '',
  dueFrom: '',
  dueTo: ''
});

const form = reactive({
  status: 'pending' as RenewalTask['status'],
  priority: 'medium' as RenewalTask['priority'],
  customerDecision: 'not_contacted' as RenewalTask['customerDecision'],
  note: '',
  resultNote: '',
  evidenceAttachmentId: ''
});

const fixedTaskType = computed<RenewalTask['taskType'] | ''>(() => {
  const moduleKey = String(route.meta.moduleKey ?? '');
  if (moduleKey === 'renewal-cancel') return 'cancel_subscription';
  if (moduleKey === 'renewal-topup') return 'topup_apple_balance';
  if (moduleKey === 'renewal-waiting-auto') return 'wait_auto_renewal';
  return '';
});
const tableKey = computed(() =>
  fixedTaskType.value ? `apple_renewal_tasks_${fixedTaskType.value}` : 'apple_renewal_tasks'
);

const pageCopy = computed<{
  title: string;
  description: string;
  panelTitle: string;
  panelDescription: string;
  badge: string;
  tone: ChipTone;
}>(() => {
  if (fixedTaskType.value === 'cancel_subscription') {
    return {
      title: '待取消订阅',
      description: '集中处理客户确认不续费、需要取消自动订阅的 Apple ID 任务。',
      panelTitle: '待取消订阅任务',
      panelDescription: '优先处理客户确认不续费但订阅仍未关闭的任务，降低误扣费风险。',
      badge: '取消订阅',
      tone: 'red'
    };
  }

  if (fixedTaskType.value === 'topup_apple_balance') {
    return {
      title: '待充值续费',
      description: '集中处理余额不足、需要先充值才能续费的 Apple ID 任务。',
      panelTitle: '待充值续费任务',
      panelDescription: '按截止时间、建议充值和优先级处理余额不足的续费任务。',
      badge: '充值续费',
      tone: 'orange'
    };
  }

  if (fixedTaskType.value === 'wait_auto_renewal') {
    return {
      title: '等待自动续费',
      description: '集中跟踪余额已足够、等待 Apple 自动扣费并检查结果的任务。',
      panelTitle: '等待自动续费任务',
      panelDescription: '跟踪余额已满足扣费条件的业务，自动续费后再回填结果。',
      badge: '自动续费',
      tone: 'green'
    };
  }

  return {
    title: '续费工作台',
    description: '集中处理到期联系、客户确认、收款、取消订阅、充值续费和自动续费任务。',
    panelTitle: '续费任务队列',
    panelDescription: '把客户确认、收款、取消订阅、充值和自动续费任务集中在一个队列里处理。',
    badge: '工作台',
    tone: 'blue'
  };
});

const statusOptions: Array<{ label: string; value: RenewalTask['status'] }> = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '等待客户', value: 'waiting_customer' },
  { label: '等待收款', value: 'waiting_payment' },
  { label: '等待自动续费', value: 'waiting_auto_renewal' },
  { label: '等待人工验证', value: 'waiting_manual_verify' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
  { label: '失败', value: 'failed' },
  { label: '异常', value: 'abnormal' },
  { label: '已延期', value: 'postponed' }
];

const taskTypeOptions: Array<{ label: string; value: RenewalTask['taskType'] }> = [
  { label: '联系客户', value: 'contact_customer' },
  { label: '催客户回复', value: 'remind_customer_reply' },
  { label: '收款确认', value: 'confirm_payment' },
  { label: '检查余额', value: 'check_balance' },
  { label: '待充值续费', value: 'topup_apple_balance' },
  { label: '取消订阅', value: 'cancel_subscription' },
  { label: '修改套餐', value: 'change_plan' },
  { label: '等待自动续费', value: 'wait_auto_renewal' },
  { label: '检查续费结果', value: 'check_renewal_result' },
  { label: '处理异常', value: 'handle_abnormal' }
];

const priorityOptions: Array<{ label: string; value: RenewalTask['priority'] }> = [
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
];

const customerDecisionOptions: Array<{ label: string; value: RenewalTask['customerDecision'] }> = [
  { label: '未询问', value: 'not_contacted' },
  { label: '已询问待回复', value: 'contacted_waiting_reply' },
  { label: '客户确认续费', value: 'confirmed_renewal' },
  { label: '客户确认不续费', value: 'confirmed_no_renewal' },
  { label: '客户要改套餐', value: 'change_plan' },
  { label: '客户犹豫中', value: 'considering' },
  { label: '已收款', value: 'paid' },
  { label: '未收款', value: 'unpaid' },
  { label: '已取消', value: 'cancelled' },
  { label: '已续费成功', value: 'renewed_success' },
  { label: '异常处理', value: 'abnormal' }
];

const quickDateOptions = [
  { label: '今天', value: 'today' },
  { label: '已逾期', value: 'overdue' },
  { label: '近3天', value: 'next3' },
  { label: '近7天', value: 'next7' }
];

const pendingCount = computed(
  () => tasks.value.filter((task) => !isFinalStatus(task.status)).length
);
const urgentCount = computed(() => tasks.value.filter((task) => task.priority === 'urgent').length);
const highPriorityCount = computed(
  () => tasks.value.filter((task) => task.priority === 'high').length
);
const cancelTaskCount = computed(
  () =>
    tasks.value.filter(
      (task) =>
        task.taskType === 'cancel_subscription' || task.customerDecision === 'confirmed_no_renewal'
    ).length
);
const topupTaskCount = computed(
  () =>
    tasks.value.filter(
      (task) => task.taskType === 'topup_apple_balance' || Number(task.suggestedTopupAmount) > 0
    ).length
);
const autoRenewTaskCount = computed(
  () =>
    tasks.value.filter(
      (task) => task.taskType === 'wait_auto_renewal' || task.status === 'waiting_auto_renewal'
    ).length
);
const renewalBoardTasks = computed(() =>
  [...tasks.value]
    .filter((task) => !isFinalStatus(task.status))
    .sort((left, right) => {
      const priorityDiff = getPriorityRank(right.priority) - getPriorityRank(left.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return getTimeValue(left.dueAt) - getTimeValue(right.dueAt);
    })
);
const renewalLanes = computed<RenewalLane[]>(() => getRenewalLanes());
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const taskTypeLabel = taskTypeOptions.find((item) => item.value === query.taskType)?.label;
  const priorityLabel = priorityOptions.find((item) => item.value === query.priority)?.label;
  const customerDecisionLabel = customerDecisionOptions.find(
    (item) => item.value === query.customerDecision
  )?.label;
  const quickDateLabel = quickDateOptions.find((item) => item.value === quickDate.value)?.label;

  if (!fixedTaskType.value && query.taskType && taskTypeLabel) {
    chips.push({ key: 'taskType', label: '任务类型', value: taskTypeLabel });
  }
  if (query.priority && priorityLabel) {
    chips.push({ key: 'priority', label: '优先级', value: priorityLabel });
  }
  if (query.customerDecision && customerDecisionLabel) {
    chips.push({ key: 'customerDecision', label: '客户决定', value: customerDecisionLabel });
  }
  if (quickDate.value && quickDateLabel) {
    chips.push({ key: 'quickDate', label: '截止时间', value: quickDateLabel });
  }

  return chips;
});

watch(
  () => route.meta.moduleKey,
  async () => {
    query.page = 1;
    query.taskType = '';
    quickDate.value = '';
    clearDueRange();
    await loadPageData();
  }
);

onMounted(initializePage);
onActivated(() => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }

  void loadTasks({
    background: tasks.value.length > 0,
    force: false
  });
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-renewal-tasks'], () => {
  void loadTasks({
    background: tasks.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);

async function initializePage() {
  try {
    await loadPageData();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载续费任务失败');
  }
}

async function loadPageData() {
  const tableViewsPromise = loadTableViews(true);
  const tasksPromise = loadTasks({ force: false });
  const [defaultViewApplied] = await Promise.all([tableViewsPromise, tasksPromise]);

  if (defaultViewApplied) {
    await loadTasks({
      background: tasks.value.length > 0,
      force: false
    });
  }
}

async function loadTasks(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildTaskListParams();
  const queryKey = createSmartQueryKey('apple-renewal-tasks', {
    tableKey: tableKey.value,
    params
  });

  activeTasksQueryKey.value = queryKey;

  try {
    await refreshSmartQueryResource({
      key: queryKey,
      fetcher: () => appleRenewalTasksApi.list(params),
      apply: applyTaskListResult,
      background: options.background,
      isCurrent: () => activeTasksQueryKey.value === queryKey,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载续费任务失败');
    }
  }
}

function buildTaskListParams(): RenewalTaskQuery {
  return {
    ...query,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    taskType: fixedTaskType.value || query.taskType || undefined,
    priority: query.priority || undefined,
    customerDecision: query.customerDecision || undefined,
    dueFrom: query.dueFrom || undefined,
    dueTo: query.dueTo || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyTaskListResult(result: RenewalTaskPage) {
  tasks.value = result.items;
  total.value = result.total;
}

async function handleSearch() {
  query.page = 1;
  await loadTasks();
}

async function reloadTable() {
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

function handleSelectionChange(rows: RenewalTask[]) {
  selectedTasks.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.taskType = '';
  query.priority = '';
  query.customerDecision = '';
  quickDate.value = '';
  clearDueRange();
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
  if (key === 'customerDecision') {
    query.customerDecision = '';
  }
  if (key === 'quickDate') {
    quickDate.value = '';
    clearDueRange();
  }
}

function selectQuickDate(value: string) {
  quickDate.value = value;
  applyQuickDate();
}

function exportList() {
  ElMessage.info('续费任务导出会进入数据中心导出任务，后续统一接入');
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
      tableKey: tableKey.value
    });
    savedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyView(defaultView);
        return true;
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }

  return false;
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入视图名称',
      `保存${pageCopy.value.title}视图`,
      {
        inputValue: `${pageCopy.value.title}常用视图`,
        inputPattern: /^.{1,60}$/,
        inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
        confirmButtonText: '保存',
        cancelButtonText: '取消'
      }
    );
    const created = await userTableViewsApi.create(
      buildTableViewPayload(value.trim(), savedViews.value.length === 0)
    );
    await loadTableViews();
    savedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function overwriteTableView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;

  try {
    await ElMessageBox.confirm(
      `将用当前筛选、排序、列显示、密度和分页大小覆盖“${view.viewName}”。确认继续？`,
      '覆盖保存视图',
      {
        type: 'warning',
        confirmButtonText: '覆盖',
        cancelButtonText: '取消'
      }
    );

    const updated = await userTableViewsApi.update(
      view.id,
      buildTableViewPayload(view.viewName, view.isDefault)
    );
    await loadTableViews();
    savedViewId.value = updated.id;
    ElMessage.success('当前视图已覆盖保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '覆盖保存视图失败');
  }
}

async function applySavedView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyView(view);
  ElMessage.success('已应用保存视图');
  await loadTasks();
}

function buildTableViewPayload(viewName: string, isDefault: boolean): SaveUserTableViewPayload {
  return {
    tableKey: tableKey.value,
    viewName,
    filters: {
      keyword: query.keyword,
      status: query.status,
      taskType: query.taskType,
      priority: query.priority,
      customerDecision: query.customerDecision,
      quickDate: quickDate.value,
      dueFrom: query.dueFrom,
      dueTo: query.dueTo
    },
    sortConfig: sortConfig.value,
    columns: visibleColumns.value.length
      ? visibleColumns.value
      : renewalColumnOptions.map((column) => column.value),
    density: density.value,
    pageSize: query.pageSize,
    isDefault
  };
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.taskType = typeof filters.taskType === 'string' ? filters.taskType : '';
  query.priority = typeof filters.priority === 'string' ? filters.priority : '';
  query.customerDecision =
    typeof filters.customerDecision === 'string' ? filters.customerDecision : '';
  quickDate.value = typeof filters.quickDate === 'string' ? filters.quickDate : '';
  query.dueFrom = typeof filters.dueFrom === 'string' ? filters.dueFrom : '';
  query.dueTo = typeof filters.dueTo === 'string' ? filters.dueTo : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        renewalColumnOptions.some((option) => option.value === column)
      )
    : renewalColumnOptions.map((column) => column.value);
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
  if (prop === 'title') return 'title';
  if (prop === 'currentBalance') return 'currentBalance';
  if (prop === 'suggestedTopupAmount') return 'suggestedTopupAmount';
  if (prop === 'dueAt') return 'dueAt';
  if (prop === 'customerDecision') return 'customerDecision';
  if (prop === 'priority') return 'priority';
  if (prop === 'status') return 'status';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function generateDueTasks() {
  generating.value = true;
  try {
    const result = await appleRenewalTasksApi.generateDueTasks({ daysAhead: 3 });
    ElMessage.success(
      `扫描 ${result.scannedActivations} 条开通记录，新增 ${result.createdCount} 条，更新 ${result.updatedCount} 条`
    );
    await loadTasks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成续费任务失败');
  } finally {
    generating.value = false;
  }
}

async function openDetail(task: RenewalTask) {
  try {
    selectedTask.value = await appleRenewalTasksApi.get(task.id);
    resetForm(selectedTask.value);
    detailDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载任务详情失败');
  }
}

async function saveTask() {
  if (!selectedTask.value) return;
  try {
    const evidenceAttachmentId = await ensureEvidenceAttachmentId();
    selectedTask.value = await appleRenewalTasksApi.update(selectedTask.value.id, {
      status: form.status,
      priority: form.priority,
      customerDecision: form.customerDecision,
      note: form.note || null,
      resultNote: form.resultNote || null,
      evidenceAttachmentId
    });
    resetForm(selectedTask.value);
    ElMessage.success('续费任务已保存');
    await loadTasks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存续费任务失败');
  }
}

async function completeTask(task: RenewalTask) {
  await openDetail(task);
  await completeSelectedTask();
}

async function completeSelectedTask() {
  if (!selectedTask.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入处理结果', '标记完成', {
      inputType: 'textarea',
      inputValue: form.resultNote,
      confirmButtonText: '完成',
      cancelButtonText: '取消'
    });
    const evidenceAttachmentId = await ensureEvidenceAttachmentId();
    selectedTask.value = await appleRenewalTasksApi.complete(selectedTask.value.id, {
      resultNote: value || form.resultNote || null,
      customerDecision: form.customerDecision,
      evidenceAttachmentId
    });
    resetForm(selectedTask.value);
    ElMessage.success('任务已完成');
    await loadTasks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '完成任务失败');
    }
  }
}

async function postponeTask(task: RenewalTask) {
  selectedTask.value = task;
  await postponeSelectedTask();
}

async function postponeSelectedTask() {
  if (!selectedTask.value) return;
  const dueAt = addDaysIso(selectedTask.value.dueAt ?? new Date().toISOString(), 1);
  try {
    selectedTask.value = await appleRenewalTasksApi.postpone(selectedTask.value.id, {
      dueAt,
      remindAt: dueAt,
      note: form.note || selectedTask.value.note || null
    });
    resetForm(selectedTask.value);
    ElMessage.success('任务已延期1天');
    await loadTasks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '延期任务失败');
  }
}

async function cancelSelectedTask() {
  if (!selectedTask.value) return;
  try {
    await ElMessageBox.confirm('取消后该任务不会再作为待办展示，确认取消吗？', '取消续费任务', {
      type: 'warning',
      confirmButtonText: '确认取消',
      cancelButtonText: '返回'
    });
    selectedTask.value = await appleRenewalTasksApi.cancel(selectedTask.value.id, {
      resultNote: form.resultNote || null
    });
    resetForm(selectedTask.value);
    ElMessage.success('任务已取消');
    await loadTasks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '取消任务失败');
    }
  }
}

function resetForm(task: RenewalTask) {
  form.status = task.status;
  form.priority = task.priority;
  form.customerDecision = task.customerDecision;
  form.note = task.note ?? '';
  form.resultNote = task.resultNote ?? '';
  form.evidenceAttachmentId = task.evidenceAttachmentId ?? '';
  evidenceFile.value = null;
  if (evidenceFileInputRef.value) {
    evidenceFileInputRef.value.value = '';
  }
}

function selectEvidenceFile(event: Event) {
  const input = event.target as HTMLInputElement;
  evidenceFile.value = input.files?.[0] ?? null;
}

async function ensureEvidenceAttachmentId() {
  if (!selectedTask.value || !evidenceFile.value) {
    return form.evidenceAttachmentId || undefined;
  }

  evidenceUploading.value = true;
  try {
    const attachment = await attachmentsApi.upload(evidenceFile.value, {
      businessModule: 'apple',
      objectType: 'renewal_task',
      objectId: selectedTask.value.id,
      purpose: 'evidence',
      remark: `续费任务凭证：${selectedTask.value.title}`
    });
    form.evidenceAttachmentId = attachment.id;
    evidenceFile.value = null;
    if (evidenceFileInputRef.value) {
      evidenceFileInputRef.value.value = '';
    }
    return attachment.id;
  } finally {
    evidenceUploading.value = false;
  }
}

async function downloadEvidenceAttachment() {
  if (!selectedTask.value?.evidenceAttachment) {
    return;
  }

  try {
    const attachment = selectedTask.value.evidenceAttachment;
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
    ElMessage.error(error instanceof Error ? error.message : '下载凭证失败');
  }
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

function applyQuickDate() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  clearDueRange();

  if (quickDate.value === 'today') {
    end.setDate(end.getDate() + 1);
    query.dueFrom = start.toISOString();
    query.dueTo = end.toISOString();
  } else if (quickDate.value === 'overdue') {
    query.dueTo = now.toISOString();
  } else if (quickDate.value === 'next3') {
    end.setDate(end.getDate() + 3);
    query.dueFrom = now.toISOString();
    query.dueTo = end.toISOString();
  } else if (quickDate.value === 'next7') {
    end.setDate(end.getDate() + 7);
    query.dueFrom = now.toISOString();
    query.dueTo = end.toISOString();
  }

  handleSearch();
}

function clearDueRange() {
  query.dueFrom = '';
  query.dueTo = '';
}

function addDaysIso(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getRenewalLanes(): RenewalLane[] {
  if (fixedTaskType.value === 'cancel_subscription') {
    return [
      {
        key: 'urgent-cancel',
        title: '紧急取消',
        description: '高优先级或紧急的不续费业务',
        tone: 'red',
        tasks: pickLaneTasks((task) => task.priority === 'urgent' || task.priority === 'high')
      },
      {
        key: 'due-cancel',
        title: '今日截止',
        description: '今天或已逾期的取消订阅任务',
        tone: 'orange',
        tasks: pickLaneTasks((task) => isDueWithin(task, 0))
      },
      {
        key: 'manual-cancel',
        title: '人工验证',
        description: '需要登录、截图或人工确认',
        tone: 'purple',
        tasks: pickLaneTasks(
          (task) => task.status === 'waiting_manual_verify' || task.status === 'processing'
        )
      },
      {
        key: 'open-cancel',
        title: '待完成',
        description: '仍在队列中的取消动作',
        tone: 'blue',
        tasks: pickLaneTasks(() => true)
      }
    ];
  }

  if (fixedTaskType.value === 'topup_apple_balance') {
    return [
      {
        key: 'urgent-topup',
        title: '紧急充值',
        description: '临近扣费且余额不足的任务',
        tone: 'red',
        tasks: pickLaneTasks((task) => task.priority === 'urgent' || isDueWithin(task, 0))
      },
      {
        key: 'suggested-topup',
        title: '建议充值',
        description: '系统已计算建议充值金额',
        tone: 'orange',
        tasks: pickLaneTasks((task) => Number(task.suggestedTopupAmount || 0) > 0)
      },
      {
        key: 'balance-check',
        title: '核对余额',
        description: '充值前后需要确认余额一致',
        tone: 'purple',
        tasks: pickLaneTasks(
          (task) => task.taskType === 'check_balance' || task.status === 'waiting_manual_verify'
        )
      },
      {
        key: 'topup-open',
        title: '待处理',
        description: '仍未完成的充值续费任务',
        tone: 'blue',
        tasks: pickLaneTasks(() => true)
      }
    ];
  }

  if (fixedTaskType.value === 'wait_auto_renewal') {
    return [
      {
        key: 'today-renewal',
        title: '今日扣费',
        description: '今天预计自动续费的业务',
        tone: 'orange',
        tasks: pickLaneTasks((task) => isDueWithin(task, 0))
      },
      {
        key: 'waiting-renewal',
        title: '等待扣费',
        description: '余额充足，等待 Apple 自动扣费',
        tone: 'green',
        tasks: pickLaneTasks((task) => task.status === 'waiting_auto_renewal')
      },
      {
        key: 'verify-renewal',
        title: '人工验证',
        description: '扣费失败或结果异常需要人工确认',
        tone: 'purple',
        tasks: pickLaneTasks(
          (task) =>
            task.status === 'waiting_manual_verify' ||
            task.status === 'abnormal' ||
            task.status === 'failed'
        )
      },
      {
        key: 'renewal-open',
        title: '待回填',
        description: '续费结果未最终回填的任务',
        tone: 'blue',
        tasks: pickLaneTasks(() => true)
      }
    ];
  }

  return [
    {
      key: 'contact',
      title: '待联系',
      description: '询问客户、催回复、确认是否续费',
      tone: 'blue',
      tasks: pickLaneTasks(
        (task) =>
          task.taskType === 'contact_customer' ||
          task.taskType === 'remind_customer_reply' ||
          task.customerDecision === 'not_contacted' ||
          task.customerDecision === 'contacted_waiting_reply'
      )
    },
    {
      key: 'cancel',
      title: '待取消',
      description: '客户不续费，先取消订阅防误扣费',
      tone: 'red',
      tasks: pickLaneTasks(
        (task) =>
          task.taskType === 'cancel_subscription' ||
          task.customerDecision === 'confirmed_no_renewal'
      )
    },
    {
      key: 'topup',
      title: '待充值',
      description: '余额不足，需要录入 Apple ID 充值',
      tone: 'orange',
      tasks: pickLaneTasks(
        (task) =>
          task.taskType === 'topup_apple_balance' ||
          task.taskType === 'check_balance' ||
          Number(task.suggestedTopupAmount || 0) > 0
      )
    },
    {
      key: 'auto-renewal',
      title: '等待扣费',
      description: '余额已满足，等待自动续费结果',
      tone: 'green',
      tasks: pickLaneTasks(
        (task) => task.taskType === 'wait_auto_renewal' || task.status === 'waiting_auto_renewal'
      )
    }
  ];
}

function pickLaneTasks(predicate: (task: RenewalTask) => boolean) {
  return renewalBoardTasks.value.filter(predicate).slice(0, 3);
}

function isDueWithin(task: RenewalTask, maxDays: number) {
  return Boolean(task.dueAt && getDueDiffDays(task.dueAt) <= maxDays);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getTaskTypeLabel(value: RenewalTask['taskType']) {
  return taskTypeOptions.find((item) => item.value === value)?.label ?? value;
}

function getCustomerDecisionLabel(value: RenewalTask['customerDecision']) {
  return customerDecisionOptions.find((item) => item.value === value)?.label ?? value;
}

function getStatusLabel(value: RenewalTask['status']) {
  return statusOptions.find((item) => item.value === value)?.label ?? value;
}

function getPriorityLabel(value: RenewalTask['priority']) {
  const labels: Record<RenewalTask['priority'], string> = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急'
  };
  return labels[value];
}

function getPriorityRank(value: RenewalTask['priority']) {
  const ranks: Record<RenewalTask['priority'], number> = {
    low: 1,
    medium: 2,
    high: 3,
    urgent: 4
  };
  return ranks[value];
}

function getTimeValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function getPriorityTone(value: RenewalTask['priority']) {
  if (value === 'urgent') return 'red';
  if (value === 'high') return 'orange';
  if (value === 'medium') return 'blue';
  return 'neutral';
}

function getStatusTone(value: RenewalTask['status']) {
  if (value === 'completed') return 'green';
  if (value === 'cancelled') return 'neutral';
  if (value === 'failed' || value === 'abnormal') return 'red';
  if (
    value === 'waiting_auto_renewal' ||
    value === 'waiting_payment' ||
    value === 'waiting_manual_verify'
  ) {
    return 'orange';
  }
  if (value === 'processing') return 'purple';
  return 'blue';
}

function getDueTone(value: string) {
  const diffDays = getDueDiffDays(value);
  if (diffDays < 0) return 'red';
  if (diffDays <= 1) return 'orange';
  return 'neutral';
}

function getCustomerDecisionTone(value: RenewalTask['customerDecision']) {
  if (value === 'confirmed_renewal' || value === 'paid' || value === 'renewed_success') {
    return 'green';
  }
  if (value === 'confirmed_no_renewal' || value === 'cancelled') {
    return 'red';
  }
  if (value === 'unpaid' || value === 'abnormal') {
    return 'orange';
  }
  if (value === 'change_plan' || value === 'considering') {
    return 'purple';
  }
  return 'blue';
}

function getDueText(value: string) {
  const diffDays = getDueDiffDays(value);
  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return '今天';
  return `${diffDays} 天后`;
}

function getDueDiffDays(value: string) {
  const now = new Date();
  const due = new Date(value);
  return Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
}

function isFinalStatus(value: RenewalTask['status']) {
  return value === 'completed' || value === 'cancelled';
}
</script>
