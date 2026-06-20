<template>
  <PageScaffold
    title="Apple ID 开通记录"
    group="Apple ID 业务"
    phase="Phase 4"
    description="查看每笔 Apple ID 业务开通后的服务记录、到期时间、成本利润和续费状态。"
  >
    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="开通记录台账"
          help="这里核对每个已开通业务对应的订单、客户、Apple ID、到期时间和续费决定，后面生成续费任务会用到这些信息。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 条</StatusChip>
          <StatusChip tone="green">开通中 {{ activeCount }}</StatusChip>
          <StatusChip :tone="expiringSoonCount > 0 ? 'orange' : 'green'" dot>
            {{ expiringSoonCount > 0 ? `7天内到期 ${expiringSoonCount}` : '近期稳定' }}
          </StatusChip>
          <StatusChip :tone="unconfirmedRenewalCount > 0 ? 'orange' : 'green'">
            未确认 {{ unconfirmedRenewalCount }}
          </StatusChip>
          <StatusChip :tone="noRenewCount > 0 ? 'red' : 'green'">
            不续费 {{ noRenewCount }}
          </StatusChip>
          <StatusChip tone="purple">换套餐 {{ changePlanCount }}</StatusChip>
          <StatusChip tone="cyan">利润 {{ sumProfit }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="activationColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedActivations.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-primary="false"
        placeholder="搜索订单号、客户、业务、Apple ID、平台订单号"
        @search="handleSearch"
        @refresh="loadActivations"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.renewalDecision"
            class="table-toolbar__select"
            clearable
            placeholder="续费决定"
            @change="handleSearch"
          >
            <el-option
              v-for="item in renewalDecisionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <div class="quick-date apple-core-quick-date" role="group" aria-label="到期时间快捷筛选">
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
        :data="activations"
        :size="tableSize"
        row-key="id"
        empty-text="暂无开通记录"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 Apple ID 开通记录</strong>
            <span>开通记录会由 Apple ID 订单生成，也可以清空筛选后查看完整台账。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column v-if="isColumnVisible('order')" label="订单/客户" min-width="190">
          <template #default="{ row }">
            <strong>{{ row.order.orderNo }}</strong>
            <div class="muted-block">{{ row.customer.name }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务" min-width="150">
          <template #default="{ row }">{{ row.service.name }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="170">
          <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('plan')" label="套餐" min-width="150">
          <template #default="{ row }">
            {{ row.currentPlan ?? '-' }} -> {{ row.targetPlan ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('amounts')"
          prop="profitAmount"
          label="消耗/成本/利润"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.consumedValue }} {{ row.currency }} / {{ row.costRmb }} /
            {{ row.profitAmount }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expireTime')"
          prop="expireTime"
          label="到期"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ formatDate(row.expireTime) }}
            <StatusChip
              v-if="row.daysUntilExpire !== null && row.daysUntilExpire !== undefined"
              class="tag-gap"
              :tone="getExpireTone(row.daysUntilExpire)"
              dot
            >
              {{ getExpireText(row.daysUntilExpire) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('renewalDecision')"
          prop="renewalDecision"
          label="续费"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getRenewalDecisionTone(row.renewalDecision)" dot>
              {{ getRenewalDecisionLabel(row.renewalDecision) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="100"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('createdAt')"
          prop="createdAt"
          label="创建时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openDetail(row)">详情</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div
        v-if="activations.length"
        class="mobile-record-list"
        aria-label="Apple ID 开通记录移动列表"
      >
        <article v-for="activation in activations" :key="activation.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ activation.order.orderNo }}</strong>
              <span>{{ activation.customer.name }} · {{ activation.service.name }}</span>
            </div>
            <StatusChip :tone="getStatusTone(activation.status)" dot>
              {{ getStatusLabel(activation.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>消耗</span>
              <strong>{{ activation.consumedValue }} {{ activation.currency }}</strong>
            </div>
            <div>
              <span>成本</span>
              <strong>{{ activation.costRmb }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ activation.profitAmount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>Apple ID</span>
              <strong>{{ activation.appleAccount?.appleIdMasked ?? '-' }}</strong>
            </div>
            <div>
              <span>续费决定</span>
              <StatusChip :tone="getRenewalDecisionTone(activation.renewalDecision)" dot>
                {{ getRenewalDecisionLabel(activation.renewalDecision) }}
              </StatusChip>
            </div>
            <div>
              <span>到期时间</span>
              <strong>{{ formatDate(activation.expireTime) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(activation)">
              详情
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 开通记录空状态">
        <div class="apple-core-empty-state">
          <strong>暂无 Apple ID 开通记录</strong>
          <span>开通记录会由 Apple ID 订单生成，也可以清空筛选后查看完整台账。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadActivations"
      />
    </section>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="
        selectedActivation ? `开通记录 · ${selectedActivation.order.orderNo}` : '开通记录详情'
      "
      confirm-text="刷新详情"
      @confirm="refreshDetail"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>客户</span>
          <strong>{{ selectedActivation?.customer.name ?? '-' }}</strong>
        </div>
        <div>
          <span>业务</span>
          <strong>{{ selectedActivation?.service.name ?? '-' }}</strong>
        </div>
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedActivation?.appleAccount?.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>消耗</span>
          <strong>
            {{ selectedActivation?.consumedValue ?? '-' }}
            {{ selectedActivation?.currency ?? '' }}
          </strong>
        </div>
        <div>
          <span>成本</span>
          <strong>{{ selectedActivation?.costRmb ?? '-' }}</strong>
        </div>
        <div>
          <span>利润</span>
          <strong>{{ selectedActivation?.profitAmount ?? '-' }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">开通信息</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="开通记录 ID">
            {{ selectedActivation?.id ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="订单号">
            {{ selectedActivation?.order.orderNo ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="来源平台">
            {{ selectedActivation?.sourcePlatform?.name ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="平台订单号">
            {{ selectedActivation?.externalOrderNo ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="套餐">
            {{ selectedActivation?.currentPlan ?? '-' }} ->
            {{ selectedActivation?.targetPlan ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="开通/到期">
            {{ formatDate(selectedActivation?.startTime) }} ->
            {{ formatDate(selectedActivation?.expireTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="消费时平均成本">
            {{ formatAverageCost(selectedActivation?.avgUnitCost) }}
          </el-descriptions-item>
          <el-descriptions-item label="实收/手续费/损耗">
            {{ selectedActivation?.paidAmount ?? '-' }} /
            {{ selectedActivation?.platformFee ?? '-' }} /
            {{ selectedActivation?.refundLoss ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="自动续费">
            {{ getAutoRenewStatusLabel(selectedActivation?.autoRenewStatus) }}
          </el-descriptions-item>
          <el-descriptions-item label="续费决定">
            {{ getRenewalDecisionLabel(selectedActivation?.renewalDecision) }}
          </el-descriptions-item>
          <el-descriptions-item label="续费备注">
            {{ selectedActivation?.renewalNote ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { appleActivationsApi, userTableViewsApi } from '@/api/system';
import type { ServiceActivationQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { PageResult, ServiceActivation, TableDensity, UserTableView } from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

const loading = ref(false);
const detailDrawerVisible = ref(false);
const activations = ref<ServiceActivation[]>([]);
const selectedActivations = ref<ServiceActivation[]>([]);
const selectedActivation = ref<ServiceActivation | null>(null);
const total = ref(0);
const quickDate = ref('');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const tableKey = 'apple_activations';
const activeActivationsQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  renewalDecision: '',
  expireFrom: '',
  expireTo: ''
});

const statusOptions: Array<{ label: string; value: ServiceActivation['status'] }> = [
  { label: '开通中', value: 'active' },
  { label: '已到期', value: 'expired' },
  { label: '已取消', value: 'cancelled' },
  { label: '异常', value: 'abnormal' }
];

const renewalDecisionOptions: Array<{
  label: string;
  value: ServiceActivation['renewalDecision'];
}> = [
  { label: '未确认', value: 'unconfirmed' },
  { label: '续费', value: 'renew' },
  { label: '不续费', value: 'no_renew' },
  { label: '换套餐', value: 'change_plan' }
];

const quickDateOptions = [
  { label: '近7天到期', value: 'next7' },
  { label: '近30天到期', value: 'next30' },
  { label: '已过期', value: 'expired' }
];

const activationColumnOptions = [
  { label: '订单/客户', value: 'order', required: true },
  { label: '业务', value: 'service' },
  { label: 'Apple ID', value: 'appleAccount' },
  { label: '套餐', value: 'plan' },
  { label: '消耗/成本/利润', value: 'amounts' },
  { label: '到期', value: 'expireTime' },
  { label: '续费', value: 'renewalDecision' },
  { label: '状态', value: 'status' },
  { label: '创建时间', value: 'createdAt' }
];

const batchActions = [{ label: '批量导出', value: 'export' }];

const activeCount = computed(
  () => activations.value.filter((activation) => activation.status === 'active').length
);
const expiringSoonCount = computed(
  () =>
    activations.value.filter(
      (activation) =>
        activation.daysUntilExpire !== null &&
        activation.daysUntilExpire !== undefined &&
        activation.daysUntilExpire >= 0 &&
        activation.daysUntilExpire <= 7
    ).length
);
const unconfirmedRenewalCount = computed(
  () =>
    activations.value.filter((activation) => activation.renewalDecision === 'unconfirmed').length
);
const noRenewCount = computed(
  () => activations.value.filter((activation) => activation.renewalDecision === 'no_renew').length
);
const changePlanCount = computed(
  () =>
    activations.value.filter((activation) => activation.renewalDecision === 'change_plan').length
);
const sumProfit = computed(() =>
  activations.value.reduce((sum, activation) => sum + Number(activation.profitAmount), 0).toFixed(2)
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const renewalDecisionLabel = renewalDecisionOptions.find(
    (item) => item.value === query.renewalDecision
  )?.label;
  const quickDateLabel = quickDateOptions.find((item) => item.value === quickDate.value)?.label;

  if (query.renewalDecision && renewalDecisionLabel) {
    chips.push({ key: 'renewalDecision', label: '续费决定', value: renewalDecisionLabel });
  }
  if (quickDate.value && quickDateLabel) {
    chips.push({ key: 'quickDate', label: '到期时间', value: quickDateLabel });
  }

  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function formatAverageCost(value?: string | number | null) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return '-';
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '-';
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function applyQuickDate() {
  const now = new Date();
  query.expireFrom = '';
  query.expireTo = '';
  query.page = 1;

  if (quickDate.value === 'next7') {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    query.expireFrom = formatDateOnly(now);
    query.expireTo = formatDateOnly(next);
  }

  if (quickDate.value === 'next30') {
    const next = new Date(now);
    next.setDate(next.getDate() + 30);
    query.expireFrom = formatDateOnly(now);
    query.expireTo = formatDateOnly(next);
  }

  if (quickDate.value === 'expired') {
    query.expireTo = formatDateOnly(now);
  }

  await loadActivations();
}

function selectQuickDate(value: string) {
  quickDate.value = value;
  applyQuickDate();
}

function getStatusLabel(status?: ServiceActivation['status']) {
  if (!status) {
    return '-';
  }

  return {
    active: '开通中',
    expired: '已到期',
    cancelled: '已取消',
    abnormal: '异常'
  }[status];
}

function getStatusTone(status: ServiceActivation['status']) {
  return status === 'active'
    ? 'green'
    : status === 'expired'
      ? 'orange'
      : status === 'abnormal'
        ? 'red'
        : 'neutral';
}

function getRenewalDecisionLabel(value?: ServiceActivation['renewalDecision']) {
  if (!value) {
    return '-';
  }

  return {
    unconfirmed: '未确认',
    renew: '续费',
    no_renew: '不续费',
    change_plan: '换套餐'
  }[value];
}

function getRenewalDecisionTone(value?: ServiceActivation['renewalDecision']) {
  if (value === 'renew') {
    return 'green';
  }

  if (value === 'no_renew') {
    return 'orange';
  }

  if (value === 'change_plan') {
    return 'blue';
  }

  return 'neutral';
}

function getAutoRenewStatusLabel(value?: ServiceActivation['autoRenewStatus']) {
  if (!value) {
    return '-';
  }

  return {
    enabled: '已开启',
    disabled: '已关闭',
    unknown: '未知'
  }[value];
}

function getExpireText(days: number) {
  if (days < 0) {
    return `已过期 ${Math.abs(days)} 天`;
  }

  if (days === 0) {
    return '今天到期';
  }

  return `${days} 天后`;
}

function getExpireTone(days: number) {
  if (days < 0) {
    return 'red';
  }

  return days <= 7 ? 'orange' : 'neutral';
}

function buildActivationParams(): ServiceActivationQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    renewalDecision: query.renewalDecision || undefined,
    expireFrom: query.expireFrom || undefined,
    expireTo: query.expireTo || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyActivationResult(data: PageResult<ServiceActivation>) {
  activations.value = data.items;
  total.value = data.total;
}

async function loadActivations(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildActivationParams();
  const key = createSmartQueryKey('apple-activations', params);
  const cached = getSmartQueryData<PageResult<ServiceActivation>>(key);

  activeActivationsQueryKey.value = key;

  if (cached) {
    applyActivationResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => appleActivationsApi.list(params),
      force: options.force ?? true
    });

    if (activeActivationsQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyActivationResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载开通记录失败');
    }
  } finally {
    if (activeActivationsQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadActivations();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadActivations();
}

function handleSelectionChange(rows: ServiceActivation[]) {
  selectedActivations.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.renewalDecision = '';
  quickDate.value = '';
  query.expireFrom = '';
  query.expireTo = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadActivations();
}

function removeFilter(key: string) {
  if (key === 'renewalDecision') {
    query.renewalDecision = '';
  }
  if (key === 'quickDate') {
    quickDate.value = '';
    query.expireFrom = '';
    query.expireTo = '';
  }
}

function exportList() {
  ElMessage.info('Apple ID 开通记录导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 开通记录视图', {
      inputValue: 'Apple ID 开通记录常用视图',
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
        renewalDecision: query.renewalDecision,
        quickDate: quickDate.value,
        expireFrom: query.expireFrom,
        expireTo: query.expireTo
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : activationColumnOptions.map((column) => column.value),
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
  await loadActivations();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.renewalDecision =
    typeof filters.renewalDecision === 'string' ? filters.renewalDecision : '';
  quickDate.value = typeof filters.quickDate === 'string' ? filters.quickDate : '';
  query.expireFrom = typeof filters.expireFrom === 'string' ? filters.expireFrom : '';
  query.expireTo = typeof filters.expireTo === 'string' ? filters.expireTo : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        activationColumnOptions.some((option) => option.value === column)
      )
    : activationColumnOptions.map((column) => column.value);
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

async function openDetail(activation: ServiceActivation) {
  selectedActivation.value = activation;
  detailDrawerVisible.value = true;
}

async function refreshDetail() {
  if (!selectedActivation.value) {
    return;
  }

  try {
    selectedActivation.value = await appleActivationsApi.get(selectedActivation.value.id);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新开通记录详情失败');
  }
}

async function initializePage() {
  await loadTableViews(true);
  await loadActivations({ force: false });
}

onMounted(initializePage);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-activations'], () => {
  void loadActivations({
    background: activations.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
