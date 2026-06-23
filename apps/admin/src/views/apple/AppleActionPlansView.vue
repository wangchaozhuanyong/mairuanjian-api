<template>
  <PageScaffold
    title="Apple ID 操作计划"
    group="工作台"
    phase="Phase 5"
    description="按 Apple ID 聚合临期业务、续费、取消订阅、待客户确认和误扣费风险，形成当天操作清单。"
  >
    <div class="action-plan-overview">
      <div class="action-plan-notice" :class="{ 'action-plan-notice--safe': riskCount === 0 }">
        <StatusChip :tone="riskCount ? 'red' : 'green'" dot>
          {{ riskCount ? '误扣费风险' : '风险正常' }}
        </StatusChip>
        <div>
          <strong>
            {{
              riskCount
                ? `${riskCount} 个操作计划存在误扣费风险`
                : '当前筛选范围内没有误扣费风险计划'
            }}
          </strong>
          <p>余额足够但不续费业务未取消时，先处理取消订阅，再处理充值或等待自动扣费。</p>
        </div>
        <div class="action-plan-notice__stats">
          <span>计划 {{ total }}</span>
          <span>待处理 {{ openPlanCount }}</span>
          <span>建议充值 {{ suggestedTopupSum }}</span>
          <span>操作项 {{ itemCountSum }}</span>
        </div>
      </div>

      <div class="action-plan-card-list">
        <article v-for="plan in featuredPlans" :key="plan.id" class="action-plan-card">
          <div class="action-plan-card__top">
            <div>
              <strong class="mono">{{ plan.appleAccount.appleIdMasked }}</strong>
              <p>
                当前余额 {{ plan.currentBalance }} · 平均成本
                {{ formatAverageCost(plan.avgUnitCost) }} · 建议充值
                {{ plan.suggestedTopupAmount }}
              </p>
            </div>
            <div class="action-plan-card__chips">
              <StatusChip :tone="plan.hasWrongChargeRisk ? 'red' : 'green'" dot>
                {{ plan.hasWrongChargeRisk ? '误扣费风险' : '风险正常' }}
              </StatusChip>
              <StatusChip tone="orange">需取消 {{ plan.cancelServicesCount }}</StatusChip>
              <StatusChip tone="green">续费 {{ plan.renewServicesCount }}</StatusChip>
            </div>
            <AppButton
              :variant="plan.hasWrongChargeRisk ? 'primary' : 'soft'"
              @click="openDetail(plan)"
            >
              处理计划
            </AppButton>
          </div>

          <div class="action-plan-services">
            <div
              v-for="service in getPlanPreviewServices(plan)"
              :key="service.label"
              class="action-plan-service"
            >
              <h4>{{ service.title }}</h4>
              <p>{{ service.description }}</p>
              <StatusChip :tone="service.tone">{{ service.label }}</StatusChip>
            </div>
          </div>
        </article>

        <div v-if="!loading && featuredPlans.length === 0" class="apple-core-empty-state">
          <strong>暂无操作计划</strong>
          <span>可以重新生成未来 7 天 Apple ID 操作计划，或调整筛选条件。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" :loading="generating" @click="generatePlans">
              生成操作计划
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <section class="content-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="操作计划队列"
          help="这里把当天该做的事情按 Apple ID 汇总起来。先处理可能误扣费、需要人工确认或快到期的计划。"
        />
        <div class="inline-actions">
          <StatusChip :tone="riskCount ? 'red' : 'blue'" dot>
            {{ riskCount ? '存在风险' : '计划正常' }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="actionPlanColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedPlans.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :primary-loading="generating"
        primary-label="生成操作计划"
        placeholder="搜索 Apple ID、客户、业务、计划备注"
        @search="handleSearch"
        @refresh="loadPlans"
        @primary="generatePlans"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.hasWrongChargeRisk"
            class="table-toolbar__select"
            clearable
            placeholder="误扣费风险"
            @change="handleSearch"
          >
            <el-option
              v-for="item in riskOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="quickDate"
            class="table-toolbar__select"
            clearable
            placeholder="计划日期"
            @change="applyQuickDate"
          >
            <el-option
              v-for="item in quickDateOptions"
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
        :data="plans"
        :size="tableSize"
        row-key="id"
        empty-text="暂无操作计划"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无操作计划</strong>
            <span>可以重新生成未来 7 天 Apple ID 操作计划，或清空筛选后查看全部。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" :loading="generating" @click="generatePlans">
                生成操作计划
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="190">
          <template #default="{ row }">
            <strong>{{ row.appleAccount.appleIdMasked }}</strong>
            <div class="muted-block">
              {{ formatAccountRegionCurrency(row.appleAccount.region, row.appleAccount.currency) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('balance')"
          prop="currentBalance"
          label="余额/建议充值"
          min-width="160"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.currentBalance }} / {{ row.suggestedTopupAmount }}
            <div class="muted-block">预计续费 {{ row.requiredRenewalAmount }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('services')" label="业务分布" min-width="190">
          <template #default="{ row }">
            开通 {{ row.activeServiceCount }} · 续费 {{ row.renewServicesCount }} · 取消
            {{ row.cancelServicesCount }}
            <div class="muted-block">等客户 {{ row.pendingCustomerCount }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('risk')"
          prop="hasWrongChargeRisk"
          label="风险"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="row.hasWrongChargeRisk ? 'red' : 'green'" dot>
              {{ row.hasWrongChargeRisk ? '有风险' : '正常' }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('itemCount')"
          prop="itemCount"
          label="操作项"
          width="100"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.itemCount }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('planDate')"
          prop="planDate"
          label="计划日期"
          min-width="140"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.planDate, true) }}</template>
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
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton
                size="small"
                variant="success"
                :disabled="row.status === 'completed'"
                @click="completePlan(row)"
              >
                完成
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="mobile-record-list" aria-label="操作计划移动列表">
        <article v-for="plan in plans" :key="plan.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ plan.appleAccount.appleIdMasked }}</strong>
              <span>
                {{
                  formatAccountRegionCurrency(plan.appleAccount.region, plan.appleAccount.currency)
                }}
                ·
                {{ formatDate(plan.planDate, true) }}
              </span>
            </div>
            <StatusChip :tone="getStatusTone(plan.status)" dot>
              {{ getStatusLabel(plan.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>当前余额</span>
              <strong>{{ plan.currentBalance }}</strong>
            </div>
            <div>
              <span>建议充值</span>
              <strong>{{ plan.suggestedTopupAmount }}</strong>
            </div>
            <div>
              <span>操作项</span>
              <strong>{{ plan.itemCount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>业务分布</span>
              <strong>
                开通 {{ plan.activeServiceCount }} · 续费 {{ plan.renewServicesCount }} · 取消
                {{ plan.cancelServicesCount }}
              </strong>
            </div>
            <div>
              <span>预计续费</span>
              <strong>{{ plan.requiredRenewalAmount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip :tone="plan.hasWrongChargeRisk ? 'red' : 'green'" dot>
              {{ plan.hasWrongChargeRisk ? '误扣费风险' : '风险正常' }}
            </StatusChip>
            <StatusChip tone="orange">等客户 {{ plan.pendingCustomerCount }}</StatusChip>
            <StatusChip tone="blue">平均成本 {{ formatAverageCost(plan.avgUnitCost) }}</StatusChip>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(plan)">详情</AppButton>
            <AppButton
              size="small"
              variant="success"
              :disabled="plan.status === 'completed'"
              @click="completePlan(plan)"
            >
              完成
            </AppButton>
          </div>
        </article>

        <div v-if="!loading && plans.length === 0" class="apple-core-empty-state">
          <strong>暂无操作计划</strong>
          <span>可以重新生成未来 7 天 Apple ID 操作计划，或清空筛选后查看全部。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" :loading="generating" @click="generatePlans">
              生成操作计划
            </AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadPlans"
      />
    </section>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="
        selectedPlan ? `操作计划 · ${selectedPlan.appleAccount.appleIdMasked}` : '操作计划详情'
      "
      confirm-text="刷新详情"
      size="720px"
      @confirm="refreshDetail"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedPlan?.appleAccount.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>当前余额</span>
          <strong>{{ selectedPlan?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>建议充值</span>
          <strong>{{ selectedPlan?.suggestedTopupAmount ?? '-' }}</strong>
        </div>
        <div>
          <span>续费项</span>
          <strong>{{ selectedPlan?.renewServicesCount ?? '-' }}</strong>
        </div>
        <div>
          <span>取消项</span>
          <strong>{{ selectedPlan?.cancelServicesCount ?? '-' }}</strong>
        </div>
        <div>
          <span>风险</span>
          <strong>{{ selectedPlan?.hasWrongChargeRisk ? '有误扣费风险' : '正常' }}</strong>
        </div>
      </div>

      <div
        v-if="selectedPlan?.hasWrongChargeRisk"
        class="detail-alert apple-core-alert apple-core-alert--red"
      >
        <StatusChip tone="red">风险</StatusChip>
        <div>
          <strong>存在误扣费风险</strong>
          <p>
            该 Apple ID 中存在客户不续费但自动续费未明确关闭，或临期未确认且自动续费开启的业务。
          </p>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">计划信息</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="计划备注">
            {{ selectedPlan?.mainNote ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="计划日期">
            {{ formatDate(selectedPlan?.planDate, true) }}
          </el-descriptions-item>
          <el-descriptions-item label="平均成本">
            {{ formatAverageCost(selectedPlan?.avgUnitCost) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">操作项</div>
        <el-table class="desktop-data-table" :data="selectedPlan?.items ?? []" row-key="id">
          <el-table-column label="客户/业务" min-width="170">
            <template #default="{ row }">
              {{ row.customer.name }}
              <div class="muted-block">{{ row.service.name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="动作" width="120">
            <template #default="{ row }">
              <StatusChip :tone="getActionTone(row.actionType)">
                {{ getActionLabel(row.actionType) }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="到期/截止" min-width="170">
            <template #default="{ row }">
              {{ formatDate(row.expireTime) }}
              <div class="muted-block">取消截止 {{ formatDate(row.cancelDeadline) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="预计扣费" width="110">
            <template #default="{ row }">{{ row.expectedChargeAmount }}</template>
          </el-table-column>
          <el-table-column label="关联任务" min-width="150">
            <template #default="{ row }">
              {{ row.task?.title ?? '-' }}
              <div v-if="row.task" class="muted-block">{{ row.task.status }}</div>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="220">
            <template #default="{ row }">{{ row.note ?? '-' }}</template>
          </el-table-column>
        </el-table>
        <div
          v-if="selectedPlan?.items?.length"
          class="mobile-record-list"
          aria-label="操作计划详情移动列表"
        >
          <article v-for="item in selectedPlan.items" :key="item.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ item.customer.name }} · {{ item.service.name }}</strong>
                <span>{{ item.note ?? '暂无说明' }}</span>
              </div>
              <StatusChip :tone="getActionTone(item.actionType)">
                {{ getActionLabel(item.actionType) }}
              </StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>到期时间</span>
                <strong>{{ formatDate(item.expireTime) }}</strong>
              </div>
              <div>
                <span>取消截止</span>
                <strong>{{ formatDate(item.cancelDeadline) }}</strong>
              </div>
              <div>
                <span>预计扣费</span>
                <strong>{{ item.expectedChargeAmount }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__meta">
              <div>
                <span>关联任务</span>
                <strong>{{ item.task?.title ?? '-' }}</strong>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="mobile-record-list" aria-label="操作计划详情空状态">
          <div class="apple-core-empty-state">
            <strong>暂无操作项</strong>
            <span>该操作计划还没有生成具体客户业务动作。</span>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">计划处理</div>
        <div class="drawer-inline-actions drawer-inline-actions--inside">
          <AppButton
            variant="success"
            :disabled="!selectedPlan || selectedPlan.status === 'completed'"
            @click="completeSelectedPlan"
          >
            标记计划完成
          </AppButton>
        </div>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { appleActionPlansApi, userTableViewsApi, type AppleActionPlanQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppleActionPlan,
  AppleActionPlanItem,
  PageResult,
  TableDensity,
  UserTableView
} from '@/types/system';
import { formatAppleRegionCurrencyLabel } from '@/utils/appleAccountRegion';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

const plans = ref<AppleActionPlan[]>([]);
const total = ref(0);
const loading = ref(false);
const generating = ref(false);
const quickDate = ref('');
const selectedPlans = ref<AppleActionPlan[]>([]);
const selectedPlan = ref<AppleActionPlan | null>(null);
const detailDrawerVisible = ref(false);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const tableKey = 'apple_action_plans';
const activePlansQueryKey = ref('');
type ChipTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
interface PlanPreviewService {
  title: string;
  description: string;
  label: string;
  tone: ChipTone;
}

const query = reactive<AppleActionPlanQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  hasWrongChargeRisk: '',
  planDateFrom: '',
  planDateTo: ''
});

const statusOptions: Array<{ label: string; value: AppleActionPlan['status'] }> = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '异常', value: 'abnormal' }
];

const riskOptions = [
  { label: '有风险', value: 'true' },
  { label: '无风险', value: 'false' }
];

const quickDateOptions = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '近7天', value: 'last7' },
  { label: '本月', value: 'month' }
];

const actionPlanColumnOptions = [
  { label: 'Apple ID', value: 'appleAccount', required: true },
  { label: '余额/建议充值', value: 'balance' },
  { label: '业务分布', value: 'services' },
  { label: '风险', value: 'risk' },
  { label: '操作项', value: 'itemCount' },
  { label: '计划日期', value: 'planDate' },
  { label: '状态', value: 'status' }
];

const batchActions = [{ label: '批量导出', value: 'export' }];

const riskCount = computed(() => plans.value.filter((plan) => plan.hasWrongChargeRisk).length);
const suggestedTopupSum = computed(() =>
  plans.value.reduce((sum, plan) => sum + Number(plan.suggestedTopupAmount || 0), 0).toFixed(2)
);
const itemCountSum = computed(() =>
  plans.value.reduce((sum, plan) => sum + Number(plan.itemCount || 0), 0)
);
const openPlanCount = computed(
  () =>
    plans.value.filter((plan) => plan.status === 'pending' || plan.status === 'processing').length
);
const priorityPlans = computed(() =>
  [...plans.value]
    .filter((plan) => plan.status !== 'completed')
    .sort((left, right) => {
      const riskDiff = Number(right.hasWrongChargeRisk) - Number(left.hasWrongChargeRisk);
      if (riskDiff !== 0) return riskDiff;

      const itemDiff = Number(right.itemCount || 0) - Number(left.itemCount || 0);
      if (itemDiff !== 0) return itemDiff;

      return getPlanTimeValue(left.planDate) - getPlanTimeValue(right.planDate);
    })
    .slice(0, 3)
);
const featuredPlans = computed(() => {
  const plansToShow = priorityPlans.value.length ? priorityPlans.value : plans.value.slice(0, 2);
  return plansToShow.slice(0, 2);
});
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const riskLabel = riskOptions.find((item) => item.value === query.hasWrongChargeRisk)?.label;
  const quickDateLabel = quickDateOptions.find((item) => item.value === quickDate.value)?.label;

  if (query.hasWrongChargeRisk && riskLabel) {
    chips.push({ key: 'hasWrongChargeRisk', label: '误扣费风险', value: riskLabel });
  }
  if (quickDate.value && quickDateLabel) {
    chips.push({ key: 'quickDate', label: '计划日期', value: quickDateLabel });
  }

  return chips;
});

onMounted(initializePage);

function buildPlanParams(): AppleActionPlanQuery {
  return {
    ...query,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    hasWrongChargeRisk: query.hasWrongChargeRisk || undefined,
    planDateFrom: query.planDateFrom || undefined,
    planDateTo: query.planDateTo || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyPlanResult(data: PageResult<AppleActionPlan>) {
  plans.value = data.items;
  total.value = data.total;
}

async function loadPlans(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildPlanParams();
  const key = createSmartQueryKey('apple-action-plans', params);
  const cached = getSmartQueryData<PageResult<AppleActionPlan>>(key);

  activePlansQueryKey.value = key;

  if (cached) {
    applyPlanResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => appleActionPlansApi.list(params),
      force: options.force ?? true
    });

    if (activePlansQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyPlanResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载操作计划失败');
    }
  } finally {
    if (activePlansQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadPlans();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadPlans();
}

function handleSelectionChange(rows: AppleActionPlan[]) {
  selectedPlans.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.hasWrongChargeRisk = '';
  quickDate.value = '';
  clearPlanDateRange();
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadPlans();
}

function removeFilter(key: string) {
  if (key === 'hasWrongChargeRisk') {
    query.hasWrongChargeRisk = '';
  }
  if (key === 'quickDate') {
    quickDate.value = '';
    clearPlanDateRange();
  }
}

function exportList() {
  ElMessage.info('Apple ID 操作计划导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 操作计划视图', {
      inputValue: 'Apple ID 操作计划常用视图',
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
        hasWrongChargeRisk: query.hasWrongChargeRisk,
        quickDate: quickDate.value,
        planDateFrom: query.planDateFrom,
        planDateTo: query.planDateTo
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : actionPlanColumnOptions.map((column) => column.value),
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
  await loadPlans();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.hasWrongChargeRisk =
    typeof filters.hasWrongChargeRisk === 'string' ? filters.hasWrongChargeRisk : '';
  quickDate.value = typeof filters.quickDate === 'string' ? filters.quickDate : '';
  query.planDateFrom = typeof filters.planDateFrom === 'string' ? filters.planDateFrom : '';
  query.planDateTo = typeof filters.planDateTo === 'string' ? filters.planDateTo : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        actionPlanColumnOptions.some((option) => option.value === column)
      )
    : actionPlanColumnOptions.map((column) => column.value);
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

function getPlanTimeValue(value?: string | null) {
  return value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function generatePlans() {
  generating.value = true;
  try {
    const result = await appleActionPlansApi.generate({ daysAhead: 7 });
    ElMessage.success(
      `扫描 ${result.scannedActivations} 条开通记录，生成 ${result.accountCount} 个 Apple ID 计划，操作项 ${result.itemCount} 个`
    );
    await loadPlans();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成操作计划失败');
  } finally {
    generating.value = false;
  }
}

async function openDetail(plan: AppleActionPlan) {
  try {
    selectedPlan.value = await appleActionPlansApi.get(plan.id);
    detailDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载计划详情失败');
  }
}

async function refreshDetail() {
  if (!selectedPlan.value) return;
  await openDetail(selectedPlan.value);
}

async function completePlan(plan: AppleActionPlan) {
  selectedPlan.value = plan;
  await completeSelectedPlan();
}

async function completeSelectedPlan() {
  if (!selectedPlan.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入完成备注', '完成操作计划', {
      inputType: 'textarea',
      inputValue: selectedPlan.value.mainNote ?? '',
      confirmButtonText: '完成',
      cancelButtonText: '取消'
    });
    selectedPlan.value = await appleActionPlansApi.complete(selectedPlan.value.id, {
      mainNote: value || selectedPlan.value.mainNote || null
    });
    ElMessage.success('操作计划已完成');
    await loadPlans();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '完成操作计划失败');
    }
  }
}

async function applyQuickDate() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  query.page = 1;
  clearPlanDateRange();

  if (quickDate.value === 'today') {
    end.setDate(end.getDate() + 1);
    query.planDateFrom = start.toISOString();
    query.planDateTo = end.toISOString();
  } else if (quickDate.value === 'yesterday') {
    start.setDate(start.getDate() - 1);
    query.planDateFrom = start.toISOString();
    query.planDateTo = end.toISOString();
  } else if (quickDate.value === 'last7') {
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 1);
    query.planDateFrom = start.toISOString();
    query.planDateTo = end.toISOString();
  } else if (quickDate.value === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    query.planDateFrom = monthStart.toISOString();
    query.planDateTo = monthEnd.toISOString();
  }

  await loadPlans();
}

function clearPlanDateRange() {
  query.planDateFrom = '';
  query.planDateTo = '';
}

async function initializePage() {
  await loadTableViews(true);
  await loadPlans({ force: false });
}

function formatDate(value?: string | null, dateOnly = false) {
  if (!value) return '-';
  const options: Intl.DateTimeFormatOptions = dateOnly
    ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { hour12: false };
  return new Date(value).toLocaleString('zh-CN', options);
}

function formatAverageCost(value?: string | number | null) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return '-';
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '-';
}

function formatAccountRegionCurrency(
  region: string | null | undefined,
  currency: string | null | undefined
) {
  return formatAppleRegionCurrencyLabel(region, currency);
}

function getStatusLabel(value: AppleActionPlan['status']) {
  const labels: Record<AppleActionPlan['status'], string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    abnormal: '异常'
  };
  return labels[value];
}

function getStatusTone(value: AppleActionPlan['status']) {
  if (value === 'completed') return 'green';
  if (value === 'abnormal') return 'red';
  if (value === 'processing') return 'orange';
  return 'blue';
}

function getActionLabel(value: AppleActionPlanItem['actionType']) {
  const labels: Record<AppleActionPlanItem['actionType'], string> = {
    renew: '续费',
    cancel: '取消订阅',
    change_plan: '改套餐',
    wait_customer: '等客户'
  };
  return labels[value];
}

function getActionTone(value: AppleActionPlanItem['actionType']) {
  if (value === 'cancel') return 'red';
  if (value === 'renew') return 'green';
  if (value === 'change_plan') return 'orange';
  return 'blue';
}

function getPlanPreviewServices(plan: AppleActionPlan): PlanPreviewService[] {
  return [
    {
      title: '取消订阅',
      description: `客户确认不续费或存在误扣费风险的业务 ${plan.cancelServicesCount} 项。`,
      label: plan.cancelServicesCount ? `需取消 ${plan.cancelServicesCount}` : '无取消项',
      tone: plan.cancelServicesCount || plan.hasWrongChargeRisk ? 'red' : 'green'
    },
    {
      title: '等待续费',
      description: `余额满足条件后等待自动扣费，当前续费业务 ${plan.renewServicesCount} 项。`,
      label: plan.suggestedTopupAmount === '0' ? '余额充足' : `需充值 ${plan.suggestedTopupAmount}`,
      tone: plan.suggestedTopupAmount === '0' ? 'green' : 'orange'
    },
    {
      title: '客户确认',
      description: `仍需继续询问或等待客户确认的业务 ${plan.pendingCustomerCount} 项。`,
      label: plan.pendingCustomerCount ? `待确认 ${plan.pendingCustomerCount}` : '已确认',
      tone: plan.pendingCustomerCount ? 'orange' : 'blue'
    }
  ];
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-action-plans'], () => {
  void loadPlans({
    background: plans.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
