<template>
  <PageScaffold
    title="客户详情"
    group="客户与来源"
    phase="Phase 2"
    description="查看客户基础资料、来源平台和你有权限查看的关联业务。"
  >
    <template #actions>
      <StatusChip :tone="customer?.status === 'active' ? 'green' : 'neutral'" dot>
        {{ customer ? getCustomerStatusLabel(customer.status) : '待选择客户' }}
      </StatusChip>
      <AppButton @click="goBack">返回客户列表</AppButton>
      <AppButton :disabled="!customerId" :loading="loading" @click="() => loadDetail()"
        >刷新</AppButton
      >
    </template>

    <section v-if="!customerId" class="content-panel">
      <div class="apple-core-empty-state">
        <strong>请先选择客户</strong>
        <span>从客户管理列表进入详情页后，可以查看客户资料、订单、开通记录和续费任务。</span>
        <div class="apple-core-empty-state__actions">
          <AppButton variant="primary" @click="goBack">去选择客户</AppButton>
        </div>
      </div>
    </section>

    <section v-else-if="loadError" class="content-panel">
      <AppState type="error" title="加载失败" :description="loadError">
        <AppButton variant="primary" @click="() => loadDetail()">重新加载</AppButton>
        <AppButton @click="goBack">返回客户列表</AppButton>
      </AppState>
    </section>

    <section v-else-if="loading && !customer" class="content-panel">
      <el-skeleton :rows="8" animated />
    </section>

    <template v-else-if="customer">
      <section class="content-panel" aria-label="客户详情概览">
        <div class="detail-note-grid">
          <div class="detail-note-item">
            <span>客户状态</span>
            <strong>{{ getCustomerStatusLabel(customer.status) }}</strong>
            <span>客户基础资料状态</span>
          </div>
          <div v-if="canViewAppleOrders" class="detail-note-item">
            <span>Apple ID 订单</span>
            <strong>{{ orderTotal }}</strong>
            <span>最近订单统计</span>
          </div>
          <div v-if="canViewAppleActivations" class="detail-note-item">
            <span>开通记录</span>
            <strong>{{ activationTotal }}</strong>
            <span>当前客户关联业务</span>
          </div>
          <div v-if="canViewRenewalTasks" class="detail-note-item">
            <span>续费任务</span>
            <strong>{{ taskTotal }}</strong>
            <span>待办与历史任务</span>
          </div>
        </div>
      </section>

      <section class="content-panel">
        <div class="panel-title-row">
          <PanelTitleHelp
            :title="customer.name"
            :help="
              customer.maskedPhone
                ? `这里是客户基础资料，当前手机号是 ${customer.maskedPhone}。`
                : '这里是客户基础资料，这个客户还没有填写手机号。'
            "
          />
          <div class="inline-actions">
            <StatusChip tone="blue">{{ customer.sourcePlatform?.name ?? '无来源平台' }}</StatusChip>
            <StatusChip :tone="customer.status === 'active' ? 'green' : 'neutral'" dot>
              {{ getCustomerStatusLabel(customer.status) }}
            </StatusChip>
          </div>
        </div>

        <div class="drawer-detail-grid">
          <div>
            <span>客户名称</span>
            <strong>{{ customer.name }}</strong>
          </div>
          <div>
            <span>手机号</span>
            <strong>{{ customer.maskedPhone || '-' }}</strong>
          </div>
          <div>
            <span>微信</span>
            <strong>{{ customer.wechat || '-' }}</strong>
          </div>
          <div>
            <span>来源平台</span>
            <strong>{{ customer.sourcePlatform?.name ?? '-' }}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{{ formatDate(customer.updatedAt) }}</strong>
          </div>
        </div>

        <div class="drawer-section customer-detail-notes">
          <div class="drawer-section__title">补充资料</div>
          <div class="detail-note-grid">
            <div class="detail-note-item">
              <span>客户标签</span>
              <div class="detail-chip-row">
                <StatusChip v-for="tag in customer.tags" :key="tag" class="tag-gap" tone="neutral">
                  {{ tag }}
                </StatusChip>
                <strong v-if="!customer.tags.length">-</strong>
              </div>
            </div>
            <div class="detail-note-item detail-note-item--wide">
              <span>备注</span>
              <strong>{{ customer.remark || '-' }}</strong>
            </div>
          </div>
        </div>
      </section>

      <section v-if="canViewCustomerRelatedData" v-loading="relatedLoading" class="content-panel">
        <div class="panel-title-row">
          <PanelTitleHelp
            title="关联业务数据"
            help="这里只放最近几条业务记录，方便快速查看这个客户发生过什么。真正处理订单、开通和续费，还是去对应业务页面。"
          />
          <StatusChip tone="green" dot>业务记录</StatusChip>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane
            v-if="canViewAppleOrders"
            :label="`Apple ID 订单 ${orderTotal}`"
            name="orders"
          >
            <el-table class="desktop-data-table" :data="orders" row-key="id">
              <template #empty>
                <div class="apple-core-empty-state">
                  <strong>暂无 Apple ID 订单</strong>
                  <span>该客户最近没有 Apple ID 订单记录。</span>
                </div>
              </template>
              <el-table-column prop="orderNo" label="订单号" min-width="150" />
              <el-table-column label="业务" min-width="160">
                <template #default="{ row }">{{ row.service?.name ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="Apple ID" min-width="160">
                <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
              </el-table-column>
              <el-table-column prop="paidAmount" label="实收" width="100" />
              <el-table-column prop="profitAmount" label="利润" width="100" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <StatusChip :tone="getOrderStatusTone(row.status)" dot>
                    {{ getOrderStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
            <div
              v-if="orders.length"
              class="mobile-record-list"
              aria-label="客户 Apple ID 订单移动列表"
            >
              <article v-for="order in orders" :key="order.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ order.orderNo }}</strong>
                    <span>{{ order.service?.name ?? '-' }}</span>
                  </div>
                  <StatusChip :tone="getOrderStatusTone(order.status)" dot>
                    {{ getOrderStatusLabel(order.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>Apple ID</span>
                    <strong>{{ order.appleAccount?.appleIdMasked ?? '-' }}</strong>
                  </div>
                  <div>
                    <span>实收</span>
                    <strong>{{ order.paidAmount }}</strong>
                  </div>
                  <div>
                    <span>利润</span>
                    <strong>{{ order.profitAmount }}</strong>
                  </div>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>创建时间</span>
                    <strong>{{ formatDate(order.createdAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list">
              <div class="apple-core-empty-state">
                <strong>暂无 Apple ID 订单</strong>
                <span>该客户最近没有 Apple ID 订单记录。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane
            v-if="canViewAppleActivations"
            :label="`开通记录 ${activationTotal}`"
            name="activations"
          >
            <el-table class="desktop-data-table" :data="activations" row-key="id">
              <template #empty>
                <div class="apple-core-empty-state">
                  <strong>暂无开通记录</strong>
                  <span>该客户暂未关联 Apple ID 开通记录。</span>
                </div>
              </template>
              <el-table-column label="业务" min-width="160">
                <template #default="{ row }">{{ row.service?.name ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="Apple ID" min-width="160">
                <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="到期时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.expireTime) }}</template>
              </el-table-column>
              <el-table-column prop="profitAmount" label="利润" width="100" />
              <el-table-column label="续费决定" width="140">
                <template #default="{ row }">
                  {{ getRenewalDecisionLabel(row.renewalDecision) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <StatusChip :tone="getActivationStatusTone(row.status)" dot>
                    {{ getActivationStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
            </el-table>
            <div
              v-if="activations.length"
              class="mobile-record-list"
              aria-label="客户开通记录移动列表"
            >
              <article
                v-for="activation in activations"
                :key="activation.id"
                class="mobile-record-card"
              >
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ activation.service?.name ?? '-' }}</strong>
                    <span>{{ activation.appleAccount?.appleIdMasked ?? '-' }}</span>
                  </div>
                  <StatusChip :tone="getActivationStatusTone(activation.status)" dot>
                    {{ getActivationStatusLabel(activation.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>到期时间</span>
                    <strong>{{ formatDate(activation.expireTime) }}</strong>
                  </div>
                  <div>
                    <span>利润</span>
                    <strong>{{ activation.profitAmount }}</strong>
                  </div>
                  <div>
                    <span>续费决定</span>
                    <strong>{{ getRenewalDecisionLabel(activation.renewalDecision) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list">
              <div class="apple-core-empty-state">
                <strong>暂无开通记录</strong>
                <span>该客户暂未关联 Apple ID 开通记录。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane v-if="canViewRenewalTasks" :label="`续费任务 ${taskTotal}`" name="tasks">
            <el-table class="desktop-data-table" :data="tasks" row-key="id">
              <template #empty>
                <div class="apple-core-empty-state">
                  <strong>暂无续费任务</strong>
                  <span>该客户暂未生成续费任务。</span>
                </div>
              </template>
              <el-table-column prop="title" label="任务" min-width="220" show-overflow-tooltip />
              <el-table-column label="业务" min-width="150">
                <template #default="{ row }">{{ row.service?.name ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="优先级" width="100">
                <template #default="{ row }">
                  <StatusChip :tone="getPriorityTone(row.priority)" dot>
                    {{ getPriorityLabel(row.priority) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <StatusChip :tone="getTaskStatusTone(row.status)" dot>
                    {{ getTaskStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="截止时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.dueAt) }}</template>
              </el-table-column>
            </el-table>
            <div v-if="tasks.length" class="mobile-record-list" aria-label="客户续费任务移动列表">
              <article v-for="task in tasks" :key="task.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ task.title }}</strong>
                    <span>{{ task.service?.name ?? '-' }}</span>
                  </div>
                  <StatusChip :tone="getTaskStatusTone(task.status)" dot>
                    {{ getTaskStatusLabel(task.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>优先级</span>
                    <strong>{{ getPriorityLabel(task.priority) }}</strong>
                  </div>
                  <div>
                    <span>截止时间</span>
                    <strong>{{ formatDate(task.dueAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list">
              <div class="apple-core-empty-state">
                <strong>暂无续费任务</strong>
                <span>该客户暂未生成续费任务。</span>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  appleActivationsApi,
  appleOrdersApi,
  appleRenewalTasksApi,
  customersApi
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppState from '@/components/ui/AppState.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleOrder,
  Customer,
  PageResult,
  RenewalTask,
  ServiceActivation
} from '@/types/system';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, refreshSmartQuery } from '@/utils/smartQuery';

type CustomerDetailTabName = 'orders' | 'activations' | 'tasks';
type ChipTone = 'green' | 'orange' | 'red' | 'neutral' | 'blue' | 'purple';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const customerId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const CUSTOMER_DETAIL_SCOPES = [
  'customers',
  'apple-orders',
  'apple-activations',
  'apple-renewal-tasks'
];

const loading = ref(false);
const relatedLoading = ref(false);
const loadError = ref('');
const customer = ref<Customer | null>(null);
const orders = ref<AppleOrder[]>([]);
const activations = ref<ServiceActivation[]>([]);
const tasks = ref<RenewalTask[]>([]);
const orderTotal = ref(0);
const activationTotal = ref(0);
const taskTotal = ref(0);
const activeTab = ref<CustomerDetailTabName>('orders');
const canViewAppleOrders = computed(() => hasCustomerDetailPermission('apple.order.view'));
const canViewAppleActivations = computed(() =>
  hasCustomerDetailPermission('apple.activation.view')
);
const canViewRenewalTasks = computed(() => hasCustomerDetailPermission('apple.renewal_task.view'));
const visibleCustomerDetailTabs = computed<CustomerDetailTabName[]>(() => {
  const tabs: CustomerDetailTabName[] = [];

  if (canViewAppleOrders.value) {
    tabs.push('orders');
  }

  if (canViewAppleActivations.value) {
    tabs.push('activations');
  }

  if (canViewRenewalTasks.value) {
    tabs.push('tasks');
  }

  return tabs;
});
const canViewCustomerRelatedData = computed(() => visibleCustomerDetailTabs.value.length > 0);

const orderStatusOptions: Record<AppleOrder['status'], { label: string; tone: ChipTone }> = {
  pending: { label: '待处理', tone: 'orange' },
  active: { label: '已开通', tone: 'green' },
  completed: { label: '已完成', tone: 'green' },
  cancelled: { label: '已取消', tone: 'neutral' },
  abnormal: { label: '异常', tone: 'red' }
};

const activationStatusOptions: Record<
  ServiceActivation['status'],
  { label: string; tone: ChipTone }
> = {
  active: { label: '生效中', tone: 'green' },
  expired: { label: '已到期', tone: 'orange' },
  cancelled: { label: '已取消', tone: 'neutral' },
  abnormal: { label: '异常', tone: 'red' }
};

const taskStatusOptions: Record<RenewalTask['status'], { label: string; tone: ChipTone }> = {
  pending: { label: '待处理', tone: 'orange' },
  processing: { label: '处理中', tone: 'blue' },
  waiting_customer: { label: '等客户', tone: 'orange' },
  waiting_payment: { label: '等收款', tone: 'orange' },
  waiting_auto_renewal: { label: '等自动续费', tone: 'blue' },
  waiting_manual_verify: { label: '等人工验证', tone: 'orange' },
  completed: { label: '已完成', tone: 'green' },
  cancelled: { label: '已取消', tone: 'neutral' },
  failed: { label: '失败', tone: 'red' },
  abnormal: { label: '异常', tone: 'red' },
  postponed: { label: '已延期', tone: 'neutral' }
};

const priorityOptions: Record<RenewalTask['priority'], { label: string; tone: ChipTone }> = {
  low: { label: '低', tone: 'neutral' },
  medium: { label: '中', tone: 'blue' },
  high: { label: '高', tone: 'orange' },
  urgent: { label: '紧急', tone: 'red' }
};

const renewalDecisionLabels: Record<ServiceActivation['renewalDecision'], string> = {
  unconfirmed: '未确认',
  renew: '续费',
  no_renew: '不续费',
  change_plan: '改套餐'
};

function getCustomerStatusLabel(status: Customer['status']) {
  return status === 'active' ? '启用' : '停用';
}

function getOrderStatusLabel(status: AppleOrder['status']) {
  return orderStatusOptions[status]?.label ?? status;
}

function getOrderStatusTone(status: AppleOrder['status']) {
  return orderStatusOptions[status]?.tone ?? 'neutral';
}

function getActivationStatusLabel(status: ServiceActivation['status']) {
  return activationStatusOptions[status]?.label ?? status;
}

function getActivationStatusTone(status: ServiceActivation['status']) {
  return activationStatusOptions[status]?.tone ?? 'neutral';
}

function getTaskStatusLabel(status: RenewalTask['status']) {
  return taskStatusOptions[status]?.label ?? status;
}

function getTaskStatusTone(status: RenewalTask['status']) {
  return taskStatusOptions[status]?.tone ?? 'neutral';
}

function getPriorityLabel(priority: RenewalTask['priority']) {
  return priorityOptions[priority]?.label ?? priority;
}

function getPriorityTone(priority: RenewalTask['priority']) {
  return priorityOptions[priority]?.tone ?? 'neutral';
}

function getRenewalDecisionLabel(decision: ServiceActivation['renewalDecision']) {
  return renewalDecisionLabels[decision] ?? decision;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function goBack() {
  router.push('/customers');
}

async function loadDetail(options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}) {
  if (!customerId.value) {
    return;
  }

  if (!options.silent || !customer.value) {
    loading.value = true;
  }
  loadError.value = '';
  try {
    const result = await refreshSmartQuery({
      key: createSmartQueryKey('customer-detail', { id: customerId.value }),
      fetcher: () => customersApi.get(customerId.value),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    customer.value = result.data;
    await loadRelatedData(customerId.value, options);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载客户详情失败';
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

async function loadRelatedData(
  id: string,
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  const canLoadOrders = canViewAppleOrders.value;
  const canLoadActivations = canViewAppleActivations.value;
  const canLoadRenewalTasks = canViewRenewalTasks.value;

  if (!options.silent) {
    relatedLoading.value = true;
  }
  try {
    const result = await refreshSmartQuery({
      key: createSmartQueryKey('customer-related', {
        id,
        canLoadActivations,
        canLoadOrders,
        canLoadRenewalTasks
      }),
      fetcher: () =>
        Promise.all([
          canLoadOrders
            ? appleOrdersApi.list({ page: 1, pageSize: 8, customerId: id })
            : Promise.resolve(emptyPageResult<AppleOrder>()),
          canLoadActivations
            ? appleActivationsApi.list({ page: 1, pageSize: 8, customerId: id })
            : Promise.resolve(emptyPageResult<ServiceActivation>()),
          canLoadRenewalTasks
            ? appleRenewalTasksApi.list({ page: 1, pageSize: 8, customerId: id })
            : Promise.resolve(emptyPageResult<RenewalTask>())
        ]),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    const [orderData, activationData, taskData] = result.data;

    orders.value = orderData.items;
    activations.value = activationData.items;
    tasks.value = taskData.items;
    orderTotal.value = orderData.total;
    activationTotal.value = activationData.total;
    taskTotal.value = taskData.total;
    syncActiveCustomerDetailTab();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载客户关联数据失败');
  } finally {
    relatedLoading.value = false;
  }
}

function hasCustomerDetailPermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

function emptyPageResult<TItem>(): PageResult<TItem> {
  return {
    items: [],
    page: 1,
    pageSize: 8,
    total: 0
  };
}

function syncActiveCustomerDetailTab() {
  const firstVisibleTab = visibleCustomerDetailTabs.value[0];

  if (firstVisibleTab && !visibleCustomerDetailTabs.value.includes(activeTab.value)) {
    activeTab.value = firstVisibleTab;
  }
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(CUSTOMER_DETAIL_SCOPES, () => {
  void loadDetail({ silent: true, dedupeMs: 0 });
});

watch(visibleCustomerDetailTabs, syncActiveCustomerDetailTab, {
  immediate: true
});

watch(
  customerId,
  () => {
    void loadDetail({ force: false });
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});
</script>
