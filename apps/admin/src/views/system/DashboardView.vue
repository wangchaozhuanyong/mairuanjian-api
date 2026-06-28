<template>
  <PageScaffold
    class="dashboard-page"
    title="首页仪表盘"
    group="工作台"
    phase="Phase 16"
    description="汇总今日订单、续费待办、兑换码库存和平台发货状态。"
  >
    <div class="metric-grid metric-grid--four">
      <MetricCard
        v-for="metric in dashboardMetrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :hint="metric.hint"
        :tag="metric.tag"
        :tag-tone="metric.tagTone"
      >
        <template v-if="metric.sparkline" #sparkline>
          <svg viewBox="0 0 100 40" aria-hidden="true" focusable="false">
            <polyline
              fill="none"
              stroke="#2563eb"
              stroke-linecap="round"
              stroke-width="5"
              :points="metric.sparkline"
            />
          </svg>
        </template>
      </MetricCard>
    </div>

    <div class="dashboard-layout">
      <AppCard title="今日关键任务" subtitle="续费、发货、库存风险按优先级排序。" tag="实时运营">
        <template #actions>
          <AppButton
            variant="soft"
            :loading="dashboardLoading"
            @click="() => loadDashboardOverview()"
          >
            刷新数据
          </AppButton>
          <AppButton
            v-if="canViewRenewalTasks"
            variant="primary"
            @click="goTo('/workspace/renewal')"
          >
            进入工作台
          </AppButton>
        </template>

        <div class="app-table-wrap dashboard-task-table-wrap">
          <table class="app-table dashboard-task-table">
            <colgroup>
              <col class="dashboard-task-table__priority-col" />
              <col class="dashboard-task-table__task-col" />
              <col class="dashboard-task-table__module-col" />
              <col class="dashboard-task-table__status-col" />
              <col class="dashboard-task-table__advice-col" />
              <col class="dashboard-task-table__action-col" />
            </colgroup>
            <thead>
              <tr>
                <th>优先级</th>
                <th>任务</th>
                <th>模块</th>
                <th>状态</th>
                <th>处理建议</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dashboardTasks" :key="row.key">
                <td class="dashboard-task-table__priority">
                  <StatusChip :tone="row.priorityTone">{{ row.priority }}</StatusChip>
                </td>
                <td class="dashboard-task-table__task">
                  <div class="dashboard-task-main">
                    <span class="mini-avatar">{{ row.mark }}</span>
                    <div class="dashboard-task-main__content">
                      <strong :title="row.title">{{ row.title }}</strong>
                      <p :title="row.description">{{ row.description }}</p>
                    </div>
                  </div>
                </td>
                <td class="dashboard-task-table__module">
                  <span :title="row.group">{{ row.group }}</span>
                </td>
                <td class="dashboard-task-table__status">
                  <StatusChip :tone="row.statusTone" dot>
                    {{ row.statusText }}
                  </StatusChip>
                </td>
                <td class="dashboard-task-table__advice">
                  <span :title="row.impact">{{ row.impact }}</span>
                </td>
                <td class="dashboard-task-table__action">
                  <AppButton variant="ghost" size="small" @click="goTo(row.route)">进入</AppButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dashboard-task-cards" aria-label="今日关键任务移动端列表">
          <button
            v-for="row in dashboardTasks"
            :key="`card-${row.key}`"
            class="dashboard-task-card"
            type="button"
            @click="goTo(row.route)"
          >
            <span class="mini-avatar">{{ row.mark }}</span>
            <span class="dashboard-task-card__main">
              <strong>{{ row.title }}</strong>
              <em>{{ row.description }}</em>
            </span>
            <StatusChip :tone="row.statusTone" dot>
              {{ row.statusText }}
            </StatusChip>
          </button>
        </div>
      </AppCard>

      <AppCard
        title="风险提醒"
        subtitle="系统自动识别续费、发货和库存风险。"
        tag="需关注"
        tag-tone="orange"
      >
        <div class="dashboard-notice-list">
          <div
            v-for="item in attentionStatus"
            :key="item.title"
            class="notice"
            :class="getNoticeTone(item.type)"
          >
            <span class="notice__mark">!</span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </div>
      </AppCard>
    </div>

    <div class="dashboard-secondary-grid">
      <AppCard
        title="业务状态分布"
        subtitle="按订单、任务、库存和发货概览当前压力。"
        tag="业务概览"
      >
        <div class="dashboard-bar-list">
          <div v-for="item in dashboardReadinessBars" :key="item.label" class="dashboard-bar-row">
            <span>{{ item.label }}</span>
            <div class="dashboard-bar-track">
              <span
                :class="`dashboard-bar-track__bar dashboard-bar-track__bar--${item.tone}`"
                :style="{ width: `${item.percent}%` }"
              />
            </div>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
        <div class="dashboard-progress-panel dashboard-progress-panel--compact">
          <div class="dashboard-progress-track">
            <span :style="{ width: `${dashboardOverviewRate}%` }" />
          </div>
          <p>{{ dashboardSummaryText }}</p>
        </div>
      </AppCard>

      <AppCard title="平台订单状态" subtitle="订单和发货处理进度。" tag="发货处理" tag-tone="green">
        <div class="dashboard-timeline-list">
          <div v-for="item in workflowStatus" :key="item.title" class="dashboard-workflow-item">
            <div class="dashboard-workflow-item__content">
              <strong :title="item.title">{{ item.title }}</strong>
              <p :title="item.description">{{ item.description }}</p>
            </div>
            <StatusChip class="dashboard-workflow-item__status" :tone="getWorkflowTone(item.type)">
              {{ item.status }}
            </StatusChip>
          </div>
        </div>
      </AppCard>

      <AppCard title="快速入口" subtitle="常用操作一键到达。" tag="常用操作" tag-tone="cyan">
        <div class="dashboard-quick-grid">
          <AppButton v-if="canViewAppleAccounts" variant="default" @click="goTo('/apple/accounts')">
            Apple ID
          </AppButton>
          <AppButton
            v-if="canCreateAppleOrder"
            variant="primary"
            @click="goTo('/apple/order-entry')"
          >
            录订单
          </AppButton>
          <AppButton
            v-if="canImportCodeInventory"
            variant="default"
            @click="goTo('/codes/inventory')"
          >
            导入兑换码
          </AppButton>
          <AppButton
            v-if="canViewRenewalTasks"
            variant="default"
            @click="goTo('/workspace/renewal')"
          >
            续费工作台
          </AppButton>
          <AppButton variant="default" @click="previewDrawerVisible = true">闭环状态</AppButton>
          <AppButton
            v-if="canViewDeliveryExceptions"
            variant="default"
            @click="goTo('/codes/delivery-exceptions')"
            >发货异常</AppButton
          >
        </div>
      </AppCard>
    </div>

    <AppDrawer v-model="previewDrawerVisible" title="首页仪表盘 · 当前状态" confirm-text="我知道了">
      <div class="apple-core-alert apple-core-alert--green">
        <StatusChip tone="green">运营优先</StatusChip>
        <div>
          <strong>当前按重要业务优先处理</strong>
          <p>
            首页汇总订单、续费、库存和发货状态；高风险操作会先让员工确认，避免误扣费、误发货或资料改错。
          </p>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">闭环状态</div>
        <div class="mini-list">
          <div class="mini-row">
            <span>Apple ID 代充业务</span>
            <StatusChip tone="green">可用</StatusChip>
          </div>
          <div class="mini-row">
            <span>兑换码自动发货</span>
            <StatusChip tone="green">可用</StatusChip>
          </div>
          <div class="mini-row">
            <span>高风险自动化</span>
            <StatusChip tone="orange">人工验证</StatusChip>
          </div>
          <div class="mini-row">
            <span>敏感信息查看</span>
            <StatusChip tone="green">受控查看</StatusChip>
          </div>
        </div>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  appleAccountsApi,
  appleOrdersApi,
  appleRenewalTasksApi,
  codeOrdersApi,
  redeemCodesApi
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import {
  getModulePermission,
  getStatusText,
  getStatusType,
  menuSections,
  type AppModuleItem,
  type ModuleStatus
} from '@/config/modules';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleAccount,
  AppleOrder,
  CodePlatformOrder,
  PageResult,
  RenewalTask
} from '@/types/system';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';

type StatusTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
type NoticeType = 'success' | 'warning' | 'info' | 'danger';

interface DashboardTaskRow {
  key: string;
  mark: string;
  title: string;
  description: string;
  group: string;
  route: string;
  impact: string;
  priority: string;
  priorityTone: StatusTone;
  statusText: string;
  statusTone: StatusTone;
}

interface DashboardNotice {
  title: string;
  description: string;
  type: NoticeType;
}

const DASHBOARD_REQUEST_COUNT = 7;
const LOW_STOCK_THRESHOLD = 20;
const DASHBOARD_REALTIME_SCOPES = ['dashboard-overview'];
const INTERNAL_MODULE_KEYS = new Set([
  'data-dictionaries',
  'ops-monitor',
  'automation-logs',
  'maintenance-mode'
]);

const router = useRouter();
const authStore = useAuthStore();
const previewDrawerVisible = ref(false);
const dashboardLoading = ref(false);
const dashboardLoadFailed = ref(false);
const dashboardDataReady = ref(false);
const dashboardLoadedPanels = ref(0);
const appleAccountDataReady = ref(false);
const renewalDataReady = ref(false);
const codeOrderDataReady = ref(false);
const inventoryDataReady = ref(false);
const appleAccounts = ref<AppleAccount[]>([]);
const appleAccountTotal = ref(0);
const appleOrders = ref<AppleOrder[]>([]);
const appleOrderTotal = ref(0);
const renewalTasks = ref<RenewalTask[]>([]);
const renewalTaskTotal = ref(0);
const codeOrders = ref<CodePlatformOrder[]>([]);
const codeOrderTotal = ref(0);
const availableCodeTotal = ref(0);
const lockedCodeTotal = ref(0);
const failedCodeTotal = ref(0);

const moduleRows = computed(() =>
  menuSections
    .filter((section) => !section.adminOnly)
    .flatMap((section) => section.items)
    .filter(
      (item) =>
        !INTERNAL_MODULE_KEYS.has(item.key) &&
        item.status === 'ready' &&
        canAccessDashboardModule(item)
    )
);
const canViewAppleAccounts = computed(() => hasPermission('apple.account.view'));
const canViewAppleOrders = computed(() => hasPermission('apple.order.view'));
const canCreateAppleOrder = computed(() => hasPermission('apple.order.create'));
const canViewCodeOrders = computed(() => hasPermission('code.order.view'));
const canViewCodeInventory = computed(() => hasPermission('code.inventory.view'));
const canImportCodes = computed(() => hasPermission('code.batch.import'));
const canImportCodeInventory = computed(() => canViewCodeInventory.value && canImportCodes.value);
const canViewRenewalTasks = computed(() => hasPermission('apple.renewal_task.view'));
const canViewDeliveryExceptions = computed(() => hasPermission('code.order.view'));
const readyCount = computed(
  () => moduleRows.value.filter((item) => item.status === 'ready').length
);
const readyRate = computed(() =>
  moduleRows.value.length ? Math.round((readyCount.value / moduleRows.value.length) * 100) : 0
);
const todayAppleOrderCount = computed(
  () => appleOrders.value.filter((order) => isToday(order.createdAt)).length
);
const todayCodeOrderCount = computed(
  () => codeOrders.value.filter((order) => isToday(order.createdAt)).length
);
const todayOrderCount = computed(() => todayAppleOrderCount.value + todayCodeOrderCount.value);
const openRenewalTaskCount = computed(
  () => renewalTasks.value.filter((task) => !isFinalRenewalStatus(task.status)).length
);
const urgentRenewalCount = computed(
  () =>
    renewalTasks.value.filter(
      (task) => !isFinalRenewalStatus(task.status) && task.priority === 'urgent'
    ).length
);
const topupRenewalCount = computed(
  () =>
    renewalTasks.value.filter(
      (task) =>
        !isFinalRenewalStatus(task.status) &&
        (task.taskType === 'topup_apple_balance' || task.status === 'waiting_payment')
    ).length
);
const deliveredCodeOrderCount = computed(
  () => codeOrders.value.filter((order) => order.deliveryStatus === 'delivered').length
);
const failedDeliveryCount = computed(
  () => codeOrders.value.filter((order) => order.deliveryStatus === 'failed').length
);
const manualDeliveryCount = computed(
  () => codeOrders.value.filter((order) => order.deliveryStatus === 'manual').length
);
const pendingDeliveryCount = computed(
  () => codeOrders.value.filter((order) => order.deliveryStatus === 'pending').length
);
const deliverySuccessRate = computed(() =>
  codeOrders.value.length ? (deliveredCodeOrderCount.value / codeOrders.value.length) * 100 : 0
);
const appleBalanceTotal = computed(() =>
  appleAccounts.value.reduce((total, account) => total + parseMoney(account.currentBalance), 0)
);
const appleBalanceCostTotal = computed(() =>
  appleAccounts.value.reduce((total, account) => total + getAppleAccountTotalCostAmount(account), 0)
);
const appleAverageCost = computed(() =>
  appleBalanceTotal.value > 0 ? appleBalanceCostTotal.value / appleBalanceTotal.value : 0
);
const inventoryLowStock = computed(
  () =>
    canViewCodeInventory.value &&
    inventoryDataReady.value &&
    availableCodeTotal.value <= LOW_STOCK_THRESHOLD
);
const dashboardOverviewRate = computed(() =>
  dashboardLoadedPanels.value
    ? Math.round((dashboardLoadedPanels.value / DASHBOARD_REQUEST_COUNT) * 100)
    : readyRate.value
);
const dashboardMetrics = computed(() => {
  const metrics = [];

  if (canViewAppleOrders.value || canViewCodeOrders.value) {
    const orderParts = [];

    if (canViewAppleOrders.value) {
      orderParts.push(`ID ${todayAppleOrderCount.value} 单`);
    }

    if (canViewCodeOrders.value) {
      orderParts.push(`兑换码 ${todayCodeOrderCount.value} 单`);
    }

    metrics.push({
      label: '今日订单',
      value: todayOrderCount.value,
      hint: orderParts.join(' · ') || '暂无订单数据',
      tag: dashboardLoading.value ? '更新中' : '实时',
      tagTone: 'green' as const,
      sparkline: '3,30 20,22 38,26 58,12 78,18 97,8'
    });
  }

  if (canViewRenewalTasks.value) {
    metrics.push({
      label: '待处理任务',
      value: openRenewalTaskCount.value,
      hint: `紧急 ${urgentRenewalCount.value} · 待充值 ${topupRenewalCount.value}`,
      tag: urgentRenewalCount.value ? `紧急 ${urgentRenewalCount.value}` : '续费',
      tagTone: urgentRenewalCount.value ? ('red' as const) : ('orange' as const)
    });
  }

  if (canViewAppleAccounts.value) {
    metrics.push({
      label: 'ID总余额',
      value: appleBalanceTotal.value ? formatNumber(appleBalanceTotal.value) : '-',
      hint: appleBalanceTotal.value
        ? `平均成本 ¥${formatDecimal(appleAverageCost.value)} / 1美元`
        : '暂无余额数据',
      tag: appleAccountDataReady.value ? '多币种' : '读取中',
      tagTone: 'blue' as const
    });
  }

  if (canViewCodeOrders.value) {
    metrics.push({
      label: '发货成功率',
      value:
        codeOrderDataReady.value && codeOrders.value.length
          ? formatPercent(deliverySuccessRate.value)
          : '-',
      hint:
        codeOrderDataReady.value && codeOrders.value.length
          ? `失败 ${failedDeliveryCount.value} 单 · 人工 ${manualDeliveryCount.value} 单`
          : '暂无发货订单',
      tag: failedDeliveryCount.value ? '需处理' : codeOrders.value.length ? '稳定' : '暂无订单',
      tagTone: failedDeliveryCount.value ? ('red' as const) : ('green' as const)
    });
  }

  if (!metrics.length) {
    metrics.push({
      label: '可用功能',
      value: readyCount.value,
      hint: '根据当前账号权限展示可用入口',
      tag: '权限内',
      tagTone: 'blue' as const
    });
  }

  return metrics;
});
const dashboardSummaryText = computed(() => {
  if (dashboardLoadFailed.value) {
    return `业务数据暂时未返回，当前先展示 ${readyCount.value} 个常用功能入口。`;
  }

  if (!dashboardDataReady.value) {
    return '正在汇总你有权限查看的订单、续费、库存和发货状态。';
  }

  const parts = [];

  if (canViewAppleAccounts.value) {
    parts.push(`ID ${appleAccountTotal.value} 个`);
  }

  if (canViewAppleOrders.value) {
    parts.push(`ID订单 ${appleOrderTotal.value} 单`);
  }

  if (canViewRenewalTasks.value) {
    parts.push(`续费任务 ${renewalTaskTotal.value} 条`);
  }

  if (canViewCodeOrders.value) {
    parts.push(`兑换码订单 ${codeOrderTotal.value} 单`);
  }

  if (canViewCodeInventory.value) {
    parts.push(`可售库存 ${availableCodeTotal.value} 个`);
  }

  return parts.length
    ? `已汇总${parts.join('、')}。`
    : `当前账号可使用 ${readyCount.value} 个功能入口。`;
});
const dashboardReadinessBars = computed(() => {
  const bars = [];

  if (canViewAppleAccounts.value) {
    bars.push({
      label: 'ID余额',
      value: appleBalanceTotal.value ? formatNumber(appleBalanceTotal.value) : '-',
      percent: getBusinessBarPercent(appleBalanceTotal.value),
      tone: 'blue'
    });
  }

  if (canViewRenewalTasks.value) {
    bars.push({
      label: '续费任务',
      value: `${renewalTaskTotal.value || openRenewalTaskCount.value} 条`,
      percent: getBusinessBarPercent(renewalTaskTotal.value || openRenewalTaskCount.value),
      tone: 'orange'
    });
  }

  if (canViewCodeInventory.value) {
    bars.push({
      label: '可售库存',
      value: inventoryDataReady.value ? `${availableCodeTotal.value} 个` : '-',
      percent: getBusinessBarPercent(availableCodeTotal.value),
      tone: inventoryLowStock.value ? 'red' : 'green'
    });
  }

  if (canViewCodeOrders.value) {
    bars.push({
      label: '平台订单',
      value: `${codeOrderTotal.value || codeOrders.value.length} 单`,
      percent: getBusinessBarPercent(codeOrderTotal.value || codeOrders.value.length),
      tone: 'purple'
    });
  }

  if (!bars.length) {
    bars.push({
      label: '可用功能',
      value: `${readyCount.value} 个`,
      percent: getBusinessBarPercent(readyCount.value),
      tone: 'blue'
    });
  }

  return bars;
});
const dashboardTasks = computed<DashboardTaskRow[]>(() => {
  const renewalRows = renewalTasks.value
    .filter((task) => !isFinalRenewalStatus(task.status))
    .slice(0, 4)
    .map((task) => ({
      key: `renewal-${task.id}`,
      mark: task.priority === 'urgent' ? '急' : '续',
      title: task.customer?.name || task.title,
      description: task.service?.name || task.title,
      group: task.appleAccount?.appleIdMasked || '未匹配 Apple ID',
      route: getRenewalRoute(task),
      impact: task.requiredAction || getRenewalTaskTypeText(task.taskType),
      priority: getRenewalPriorityText(task.priority),
      priorityTone: getRenewalPriorityTone(task.priority),
      statusText: getRenewalStatusText(task.status),
      statusTone: getRenewalStatusTone(task.status)
    }));
  const deliveryRows = codeOrders.value
    .filter((order) => order.deliveryStatus !== 'delivered')
    .slice(0, 3)
    .map((order) => ({
      key: `code-order-${order.id}`,
      mark: order.deliveryStatus === 'failed' ? '发' : '码',
      title: order.buyerNameMasked || order.externalOrderNo,
      description: order.service?.name || order.itemTitle || order.skuName || '兑换码订单',
      group: order.platform?.name || '平台订单',
      route: '/codes/orders',
      impact: getDeliveryImpactText(order),
      priority: order.deliveryStatus === 'failed' ? '高' : '中',
      priorityTone: order.deliveryStatus === 'failed' ? ('red' as const) : ('blue' as const),
      statusText: getDeliveryStatusText(order.deliveryStatus),
      statusTone: getDeliveryStatusTone(order.deliveryStatus)
    }));
  const rows = [...renewalRows, ...deliveryRows].slice(0, 6);

  if (rows.length) {
    return rows;
  }

  return moduleRows.value
    .slice()
    .sort((a, b) => getDashboardTaskWeight(a.status) - getDashboardTaskWeight(b.status))
    .slice(0, 6)
    .map((item) => ({
      key: `module-${item.key}`,
      mark: '模',
      title: item.title,
      description: item.description,
      group: item.group,
      route: item.route,
      impact: '可直接使用',
      priority: '中',
      priorityTone: 'blue' as const,
      statusText: getStatusText(item.status),
      statusTone: getModuleStatusTone(item.status)
    }));
});
const workflowStatus = computed<
  Array<{
    title: string;
    status: string;
    description: string;
    type: 'success' | 'warning' | 'info';
  }>
>(() => {
  const rows: Array<{
    title: string;
    status: string;
    description: string;
    type: 'success' | 'warning' | 'info';
  }> = [];

  if (canViewRenewalTasks.value) {
    rows.push({
      title: 'ID 续费待办',
      status: renewalDataReady.value ? (openRenewalTaskCount.value ? '待处理' : '正常') : '读取中',
      description: renewalDataReady.value
        ? `待处理 ${openRenewalTaskCount.value} 条，紧急 ${urgentRenewalCount.value} 条。`
        : '正在读取续费待办。',
      type: !renewalDataReady.value ? 'info' : openRenewalTaskCount.value ? 'warning' : 'success'
    });
  }

  if (canViewCodeOrders.value) {
    rows.push({
      title: '兑换码订单发货',
      status: codeOrderDataReady.value ? (failedDeliveryCount.value ? '需处理' : '正常') : '读取中',
      description: codeOrderDataReady.value
        ? `最近订单 ${codeOrders.value.length} 单，失败 ${failedDeliveryCount.value} 单，待发货 ${pendingDeliveryCount.value} 单。`
        : '正在读取兑换码发货状态。',
      type: !codeOrderDataReady.value ? 'info' : failedDeliveryCount.value ? 'warning' : 'success'
    });
  }

  if (canViewCodeInventory.value) {
    rows.push({
      title: '兑换码库存预警',
      status: inventoryDataReady.value ? (inventoryLowStock.value ? '低库存' : '充足') : '读取中',
      description: inventoryDataReady.value
        ? `可售 ${availableCodeTotal.value} 个，锁定 ${lockedCodeTotal.value} 个，异常 ${failedCodeTotal.value} 个。`
        : '正在读取兑换码库存。',
      type: !inventoryDataReady.value ? 'info' : inventoryLowStock.value ? 'warning' : 'success'
    });
  }

  if (canViewAppleAccounts.value || canViewRenewalTasks.value) {
    rows.push({
      title: 'ID 安全操作',
      status: '人工确认',
      description: '充值、取消订阅、资料变更等高风险操作需要员工确认后处理。',
      type: 'warning'
    });
  }

  rows.push({
    title: '客户资料保护',
    status: '受控查看',
    description: '手机号、完整兑换码和账号资料只在必要业务核对时查看。',
    type: 'info'
  });

  return rows;
});
const attentionStatus = computed<DashboardNotice[]>(() => {
  const notices: DashboardNotice[] = [];

  if (canViewRenewalTasks.value && renewalDataReady.value && urgentRenewalCount.value) {
    notices.push({
      title: `${urgentRenewalCount.value} 条紧急续费任务`,
      description: '优先处理不续费取消、待充值和等待扣费确认，避免误扣费或服务中断。',
      type: 'danger'
    });
  }

  if (canViewCodeOrders.value && codeOrderDataReady.value && failedDeliveryCount.value) {
    notices.push({
      title: `${failedDeliveryCount.value} 单自动发货失败`,
      description: '失败订单需要人工补发，建议先核对平台订单和兑换码锁定状态。',
      type: 'warning'
    });
  }

  if (canViewCodeInventory.value && inventoryLowStock.value) {
    notices.push({
      title: '兑换码库存低于阈值',
      description: `当前可售 ${availableCodeTotal.value} 个，低于预警线 ${LOW_STOCK_THRESHOLD}。`,
      type: 'info'
    });
  }

  if (dashboardLoadFailed.value) {
    notices.push({
      title: '首页业务数据暂时未返回',
      description: '当前页面先展示可用功能入口，刷新后会重新拉取订单、库存和续费数据。',
      type: 'warning'
    });
  }

  const baselineNotices: DashboardNotice[] = [];

  if (canViewAppleAccounts.value || canViewRenewalTasks.value) {
    baselineNotices.push({
      title: '高风险操作需人工复核',
      description: '取消订阅、余额充值和资料变更出现高风险或执行失败时，需要员工确认处理。',
      type: 'warning'
    });
  }

  if (canViewCodeOrders.value || canViewCodeInventory.value) {
    baselineNotices.push({
      title: '发货渠道状态需要持续观察',
      description: '发货、通知和附件上传需要保持可用，异常时按页面提示处理。',
      type: 'info'
    });
  }

  baselineNotices.push({
    title: '关键待办无紧急阻塞',
    description: '未发现紧急续费、低库存或发货失败时，可以继续按日常订单节奏处理。',
    type: 'info'
  });

  for (const notice of baselineNotices) {
    if (notices.length >= 3) {
      break;
    }

    notices.push(notice);
  }

  return notices.slice(0, 3);
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(DASHBOARD_REALTIME_SCOPES, () => {
  void loadDashboardOverview({ silent: true, dedupeMs: 0 });
});

onMounted(() => {
  void loadDashboardOverview({ force: false });
});

usePageRefresh(
  (options) =>
    loadDashboardOverview({
      silent: options.background,
      dedupeMs: options.force ? 0 : undefined,
      force: options.force ?? true
    }),
  { label: '工作台' }
);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});

async function goTo(route: string) {
  await router.push(route);
}

function hasPermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

function canAccessDashboardModule(item: AppModuleItem) {
  const permission = getModulePermission(item);
  if (Array.isArray(permission)) {
    return permission.every((itemPermission) => hasPermission(itemPermission));
  }

  return !permission || hasPermission(permission);
}

async function loadDashboardOverview(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  dashboardLoadFailed.value = false;

  try {
    await refreshSmartQueryResource({
      key: createSmartQueryKey('dashboard-overview'),
      fetcher: ({ signal }) => loadDashboardOverviewData(signal),
      apply: applyDashboardOverview,
      background: Boolean(options.silent && dashboardDataReady.value),
      cancelPreviousMatching: options.force ? 'dashboard-overview' : undefined,
      setLoading: (value) => {
        dashboardLoading.value = value;
      },
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
  } catch {
    dashboardLoadFailed.value = !dashboardDataReady.value;
  }
}

function applyDashboardOverview(results: Awaited<ReturnType<typeof loadDashboardOverviewData>>) {
  const [
    accountResult,
    appleOrderResult,
    renewalResult,
    codeOrderResult,
    unsoldResult,
    lockedResult,
    failedResult
  ] = results;

  dashboardLoadedPanels.value = results.filter((result) => result.status === 'fulfilled').length;
  dashboardDataReady.value = dashboardLoadedPanels.value > 0;
  dashboardLoadFailed.value = dashboardLoadedPanels.value === 0;

  if (accountResult.status === 'fulfilled') {
    appleAccountDataReady.value = true;
    appleAccounts.value = accountResult.value.items;
    appleAccountTotal.value = accountResult.value.total;
  }

  if (appleOrderResult.status === 'fulfilled') {
    appleOrders.value = appleOrderResult.value.items;
    appleOrderTotal.value = appleOrderResult.value.total;
  }

  if (renewalResult.status === 'fulfilled') {
    renewalDataReady.value = true;
    renewalTasks.value = renewalResult.value.items;
    renewalTaskTotal.value = renewalResult.value.total;
  }

  if (codeOrderResult.status === 'fulfilled') {
    codeOrderDataReady.value = true;
    codeOrders.value = codeOrderResult.value.items;
    codeOrderTotal.value = codeOrderResult.value.total;
  }

  if (unsoldResult.status === 'fulfilled') {
    inventoryDataReady.value = true;
    availableCodeTotal.value = unsoldResult.value.total;
  }

  if (lockedResult.status === 'fulfilled') {
    lockedCodeTotal.value = lockedResult.value.total;
  }

  if (failedResult.status === 'fulfilled') {
    failedCodeTotal.value = failedResult.value.total;
  }
}

async function loadDashboardOverviewData(signal?: AbortSignal) {
  const results = await Promise.allSettled([
    canViewAppleAccounts.value
      ? appleAccountsApi.list(
          { page: 1, pageSize: 100, sortBy: 'updatedAt', sortOrder: 'desc' },
          { signal }
        )
      : Promise.resolve(emptyPageResult<AppleAccount>(100)),
    canViewAppleOrders.value
      ? appleOrdersApi.list(
          { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' },
          { signal }
        )
      : Promise.resolve(emptyPageResult<AppleOrder>(20)),
    canViewRenewalTasks.value
      ? appleRenewalTasksApi.list(
          { page: 1, pageSize: 20, sortBy: 'dueAt', sortOrder: 'asc' },
          { signal }
        )
      : Promise.resolve(emptyPageResult<RenewalTask>(20)),
    canViewCodeOrders.value
      ? codeOrdersApi.list(
          { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' },
          { signal }
        )
      : Promise.resolve(emptyPageResult<CodePlatformOrder>(20)),
    canViewCodeInventory.value
      ? redeemCodesApi.listInventory({ page: 1, pageSize: 1, status: 'unsold' }, { signal })
      : Promise.resolve(emptyPageResult(1)),
    canViewCodeInventory.value
      ? redeemCodesApi.listInventory({ page: 1, pageSize: 1, status: 'locked' }, { signal })
      : Promise.resolve(emptyPageResult(1)),
    canViewCodeInventory.value
      ? redeemCodesApi.listInventory(
          { page: 1, pageSize: 1, status: 'delivery_failed' },
          { signal }
        )
      : Promise.resolve(emptyPageResult(1))
  ]);

  if (signal?.aborted) {
    throw new DOMException('Dashboard request cancelled', 'AbortError');
  }

  return results;
}

function emptyPageResult<TItem>(pageSize: number): PageResult<TItem> {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize
  };
}

function getModuleStatusTone(status: ModuleStatus): StatusTone {
  const type = getStatusType(status);

  if (type === 'success') {
    return 'green';
  }

  if (type === 'warning') {
    return 'orange';
  }

  if (type === 'info') {
    return 'neutral';
  }

  return 'blue';
}

function getWorkflowTone(type: 'success' | 'warning' | 'info'): StatusTone {
  if (type === 'success') {
    return 'green';
  }

  if (type === 'warning') {
    return 'orange';
  }

  return 'blue';
}

function getNoticeTone(type: NoticeType) {
  if (type === 'danger') {
    return 'danger';
  }

  if (type === 'warning') {
    return 'warning';
  }

  if (type === 'info') {
    return 'info';
  }

  return 'info';
}

function getDashboardTaskWeight(status: ModuleStatus) {
  if (status === 'ready') {
    return 2;
  }

  if (status === 'planned') {
    return 3;
  }

  return 1;
}

function getBusinessBarPercent(value: number) {
  const maxValue = Math.max(
    appleBalanceTotal.value,
    renewalTaskTotal.value || openRenewalTaskCount.value,
    availableCodeTotal.value,
    codeOrderTotal.value || codeOrders.value.length,
    1
  );

  if (value <= 0) {
    return 4;
  }

  return Math.min(100, Math.max(8, Math.round((value / maxValue) * 100)));
}

function isToday(value?: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isFinalRenewalStatus(status: RenewalTask['status']) {
  return status === 'completed' || status === 'cancelled';
}

function parseMoney(value?: string | number | null) {
  if (value === null || value === undefined) {
    return 0;
  }

  const amount = Number.parseFloat(String(value));

  return Number.isFinite(amount) ? amount : 0;
}

function isLikelyLegacyRateCost(account: AppleAccount) {
  const balance = parseMoney(account.currentBalance);
  const storedCost = parseMoney(account.balanceCostAmount);
  const averageCost = parseMoney(account.averageCost);

  return (
    account.currency !== 'CNY' &&
    balance > 1 &&
    storedCost >= 1 &&
    averageCost > 0 &&
    averageCost < 1
  );
}

function getAppleAccountTotalCostAmount(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return parseMoney(account.currentBalance) * parseMoney(account.balanceCostAmount);
  }

  return parseMoney(account.balanceCostAmount);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function getRenewalRoute(task: RenewalTask) {
  if (task.taskType === 'cancel_subscription') {
    return '/workspace/renewal/cancel-subscriptions';
  }

  if (task.taskType === 'topup_apple_balance' || task.status === 'waiting_payment') {
    return '/workspace/renewal/topups';
  }

  if (task.taskType === 'wait_auto_renewal' || task.status === 'waiting_auto_renewal') {
    return '/workspace/renewal/waiting-auto-renewal';
  }

  return '/workspace/renewal';
}

function getRenewalPriorityText(priority: RenewalTask['priority']) {
  const map: Record<RenewalTask['priority'], string> = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急'
  };

  return map[priority];
}

function getRenewalPriorityTone(priority: RenewalTask['priority']): StatusTone {
  if (priority === 'urgent') {
    return 'red';
  }

  if (priority === 'high') {
    return 'orange';
  }

  if (priority === 'medium') {
    return 'blue';
  }

  return 'neutral';
}

function getRenewalStatusText(status: RenewalTask['status']) {
  const map: Record<RenewalTask['status'], string> = {
    pending: '待处理',
    processing: '处理中',
    waiting_customer: '等客户',
    waiting_payment: '待收款',
    waiting_auto_renewal: '等扣费',
    waiting_manual_verify: '待验证',
    completed: '已完成',
    cancelled: '已取消',
    failed: '失败',
    abnormal: '异常',
    postponed: '已延后'
  };

  return map[status];
}

function getRenewalStatusTone(status: RenewalTask['status']): StatusTone {
  if (status === 'failed' || status === 'abnormal') {
    return 'red';
  }

  if (status === 'waiting_payment' || status === 'waiting_manual_verify' || status === 'pending') {
    return 'orange';
  }

  if (status === 'completed') {
    return 'green';
  }

  if (status === 'waiting_auto_renewal' || status === 'processing') {
    return 'blue';
  }

  return 'neutral';
}

function getRenewalTaskTypeText(taskType: RenewalTask['taskType']) {
  const map: Record<RenewalTask['taskType'], string> = {
    contact_customer: '联系客户确认续费',
    remind_customer_reply: '提醒客户回复',
    confirm_payment: '确认客户收款',
    topup_apple_balance: 'Apple ID 余额待充值',
    check_balance: '检查 Apple ID 余额',
    cancel_subscription: '客户不续费，需取消订阅',
    change_plan: '套餐变更待处理',
    wait_auto_renewal: '等待自动续费扣费',
    check_renewal_result: '检查续费结果',
    notify_customer: '通知客户处理结果',
    handle_abnormal: '异常状态待人工处理',
    after_sale: '售后任务待处理'
  };

  return map[taskType];
}

function getDeliveryStatusText(status: CodePlatformOrder['deliveryStatus']) {
  const map: Record<CodePlatformOrder['deliveryStatus'], string> = {
    pending: '待发货',
    delivered: '已发货',
    failed: '发货失败',
    manual: '人工处理'
  };

  return map[status];
}

function getDeliveryStatusTone(status: CodePlatformOrder['deliveryStatus']): StatusTone {
  if (status === 'failed') {
    return 'red';
  }

  if (status === 'manual') {
    return 'orange';
  }

  if (status === 'delivered') {
    return 'green';
  }

  return 'blue';
}

function getDeliveryImpactText(order: CodePlatformOrder) {
  if (order.deliveryStatus === 'failed') {
    return '自动发货失败，需人工补发';
  }

  if (order.deliveryStatus === 'manual') {
    return '已转人工发货';
  }

  return `待匹配 ${order.quantity} 个兑换码`;
}
</script>
