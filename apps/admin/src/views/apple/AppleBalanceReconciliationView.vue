<template>
  <PageScaffold
    title="Apple ID 余额对账"
    group="Apple ID 业务"
    phase="Phase 3"
    description="处理人工或自动查询发现的余额差异，支持只修余额、按当前均价修正和手动成本修正。"
  >
    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <div>
          <h3>
            余额对账工作台
            <FeatureHelp
              placement="right"
              text="这里不是给 ID 充值，而是当你实际查到的余额和系统里记的不一样时，用来把账改准。"
            />
          </h3>
          <p>核对系统余额、实际余额和人民币成本，所有修正记录单独留痕并进入审计链路。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>账号 {{ total }}</StatusChip>
          <StatusChip tone="green">余额 {{ totalBalance }}</StatusChip>
          <StatusChip tone="orange">成本 {{ totalCost }}</StatusChip>
          <StatusChip tone="purple">均价 {{ averageCostPreview }}</StatusChip>
          <StatusChip tone="green">可对账 {{ reconcilableCount }}</StatusChip>
          <StatusChip :tone="lockedCount > 0 ? 'red' : 'green'" dot>
            {{ lockedCount > 0 ? `锁定 ${lockedCount}` : '锁定正常' }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="accountColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedAccounts.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-primary="false"
        placeholder="搜索 Apple ID、地区、币种、备注"
        @search="applyFilters"
        @refresh="loadAccounts"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-input
            v-model.trim="query.currency"
            class="table-toolbar__select"
            placeholder="币种"
            clearable
            @keyup.enter="applyFilters"
            @clear="applyFilters"
          />
          <el-select
            v-model="query.locked"
            class="table-toolbar__select"
            clearable
            placeholder="手动锁定"
            @change="applyFilters"
          >
            <el-option label="已锁定" value="true" />
            <el-option label="未锁定" value="false" />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="accounts"
        :size="tableSize"
        row-key="id"
        empty-text="暂无 Apple ID"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无需要对账的 Apple ID</strong>
            <span>可以清空筛选后查看账号，或回到 Apple ID 管理新增账号。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="router.push('/apple/accounts')">
                Apple ID 管理
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('appleId')"
          prop="appleId"
          label="Apple ID"
          min-width="190"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.appleIdMasked }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('region')"
          prop="region"
          label="地区/币种"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.region }} / {{ row.currency }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('currentBalance')"
          prop="currentBalance"
          label="系统余额"
          width="120"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              系统余额
              <FeatureHelp
                text="系统目前认为这个 Apple ID 还剩多少余额。和你人工查到的不一样时，再走修正。"
              />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('balanceCostAmount')"
          prop="balanceCostAmount"
          label="余额成本"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              余额成本
              <FeatureHelp
                text="系统认为这些剩余余额对应的人民币成本。修正余额时要注意别把成本也改乱。"
              />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('averageCost')"
          prop="averageCost"
          label="平均成本"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              平均成本
              <FeatureHelp text="每 1 元 Apple 余额大概对应多少人民币成本。算订单利润会用到它。" />
            </span>
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
        <el-table-column
          v-if="isColumnVisible('isManuallyLocked')"
          prop="isManuallyLocked"
          label="锁定"
          width="100"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              锁定
              <FeatureHelp text="已锁定的 ID 一般在排查或预留中，修正前最好先确认原因。" />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="row.isManuallyLocked ? 'red' : 'green'" dot>
              {{ row.isManuallyLocked ? '已锁定' : '正常' }}
            </StatusChip>
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
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton size="small" variant="soft" @click="openAdjustDialog(row)">
                修正余额
              </AppButton>
              <AppButton size="small" variant="ghost" @click="openAdjustmentRecords(row)">
                修正记录
              </AppButton>
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="accounts.length" class="mobile-record-list" aria-label="余额对账账号移动列表">
        <article v-for="account in accounts" :key="account.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ account.appleIdMasked }}</strong>
              <span>{{ account.region }} / {{ account.currency }}</span>
            </div>
            <StatusChip :tone="getStatusTone(account.status)" dot>
              {{ getStatusLabel(account.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>系统余额</span>
              <strong>{{ account.currentBalance }}</strong>
            </div>
            <div>
              <span>余额成本</span>
              <strong>{{ account.balanceCostAmount }}</strong>
            </div>
            <div>
              <span>平均成本</span>
              <strong>{{ account.averageCost }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>锁定状态</span>
              <StatusChip :tone="account.isManuallyLocked ? 'red' : 'green'" dot>
                {{ account.isManuallyLocked ? '已锁定' : '正常' }}
              </StatusChip>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(account.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="soft" @click="openAdjustDialog(account)">
              修正余额
            </AppButton>
            <AppButton size="small" variant="ghost" @click="openAdjustmentRecords(account)">
              修正记录
            </AppButton>
            <AppButton size="small" variant="ghost" @click="openDetail(account)">详情</AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="余额对账空状态">
        <div class="apple-core-empty-state">
          <strong>暂无需要对账的 Apple ID</strong>
          <span>可以清空筛选后查看账号，或回到 Apple ID 管理新增账号。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="router.push('/apple/accounts')">
              Apple ID 管理
            </AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadAccounts"
      />
    </section>

    <el-dialog
      v-model="adjustDialogVisible"
      :title="`修正余额 · ${selectedAccount?.appleIdMasked ?? ''}`"
      width="min(720px, calc(100vw - 24px))"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">审计</StatusChip>
        <div>
          <strong>余额修正会写入审计日志</strong>
          <p>
            该操作会更新 Apple ID 当前余额、余额成本和移动平均成本，请只在人工或自动查询确认后使用。
          </p>
        </div>
      </div>

      <div class="drawer-detail-grid sensitive-form">
        <div>
          <span>原余额</span>
          <strong>{{ selectedAccount?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>原成本</span>
          <strong>{{ selectedAccount?.balanceCostAmount ?? '-' }}</strong>
        </div>
        <div>
          <span>原均价</span>
          <strong>{{ selectedAccount?.averageCost ?? '-' }}</strong>
        </div>
      </div>

      <el-form
        ref="formRef"
        class="sensitive-form"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <div class="form-grid">
          <el-form-item label="新余额" prop="newBalance">
            <el-input v-model.trim="form.newBalance" placeholder="实际查询到的余额" />
          </el-form-item>
          <el-form-item label="成本修正方式" prop="costAdjustMethod">
            <el-select v-model="form.costAdjustMethod" class="full-input">
              <el-option label="只修余额，不修正成本" value="none" />
              <el-option label="按当前平均成本修正" value="current_avg" />
              <el-option label="手动输入新成本" value="manual" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item
          v-if="form.costAdjustMethod === 'manual'"
          label="新余额成本"
          prop="newCostRmb"
        >
          <el-input v-model.trim="form.newCostRmb" placeholder="手动确认后的人民币成本" />
        </el-form-item>
        <el-form-item label="修正原因" prop="reason">
          <el-input
            v-model.trim="form.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 自动查询余额与系统不一致 / 人工核对发现差异"
          />
        </el-form-item>
      </el-form>

      <div class="drawer-detail-grid">
        <div>
          <span>余额差额</span>
          <strong>{{ previewDifference }}</strong>
        </div>
        <div>
          <span>预计新成本</span>
          <strong>{{ previewNewCost }}</strong>
        </div>
        <div>
          <span>成本变化</span>
          <strong>{{ previewCostChange }}</strong>
        </div>
      </div>

      <template #footer>
        <AppButton @click="adjustDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveAdjustment">
          保存修正
        </AppButton>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="recordsDrawerVisible"
      :title="`余额修正记录 · ${selectedAccount?.appleIdMasked ?? ''}`"
      confirm-text="刷新记录"
      size="780px"
      @confirm="loadAdjustmentRecords"
    >
      <div class="drawer-section">
        <div class="drawer-section__title">修正记录</div>
        <el-table
          v-loading="recordsLoading"
          class="desktop-data-table"
          :data="adjustments"
          row-key="id"
        >
          <el-table-column label="余额变化" min-width="170">
            <template #default="{ row }">
              {{ row.oldBalance }} -> {{ row.newBalance }}
              <div class="muted-block">差额 {{ row.difference }}</div>
            </template>
          </el-table-column>
          <el-table-column label="成本变化" min-width="170">
            <template #default="{ row }">
              {{ row.oldCostRmb }} -> {{ row.newCostRmb }}
              <div class="muted-block">变化 {{ row.costRmbChange }}</div>
            </template>
          </el-table-column>
          <el-table-column label="方式" width="120">
            <template #default="{ row }">{{
              getCostAdjustMethodLabel(row.costAdjustMethod)
            }}</template>
          </el-table-column>
          <el-table-column label="原因" min-width="200">
            <template #default="{ row }">{{ row.reason }}</template>
          </el-table-column>
          <el-table-column label="操作人" width="120">
            <template #default="{ row }">{{ row.operator?.displayName ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="时间" min-width="170">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="adjustments.length" class="mobile-record-list" aria-label="余额修正记录移动列表">
          <article v-for="record in adjustments" :key="record.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ record.oldBalance }} -> {{ record.newBalance }}</strong>
                <span>{{ getCostAdjustMethodLabel(record.costAdjustMethod) }}</span>
              </div>
              <StatusChip tone="blue">差额 {{ record.difference }}</StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>原成本</span>
                <strong>{{ record.oldCostRmb }}</strong>
              </div>
              <div>
                <span>新成本</span>
                <strong>{{ record.newCostRmb }}</strong>
              </div>
              <div>
                <span>成本变化</span>
                <strong>{{ record.costRmbChange }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__meta">
              <div>
                <span>修正原因</span>
                <strong>{{ record.reason }}</strong>
              </div>
              <div>
                <span>操作信息</span>
                <strong
                  >{{ record.operator?.displayName ?? '-' }} ·
                  {{ formatDate(record.createdAt) }}</strong
                >
              </div>
            </div>
          </article>
        </div>
        <div v-else-if="!recordsLoading" class="mobile-record-list" aria-label="余额修正记录空状态">
          <div class="apple-core-empty-state">
            <strong>暂无修正记录</strong>
            <span>该 Apple ID 暂时没有余额修正历史。</span>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="recordsQuery.page"
        v-model:page-size="recordsQuery.pageSize"
        :total="adjustmentTotal"
        @change="loadAdjustmentRecords"
      />
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleAccountsApi, userTableViewsApi, type AppleAccountQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  AppleAccount,
  AppleBalanceAdjustment,
  TableDensity,
  UserTableView
} from '@/types/system';

const router = useRouter();
const tableKey = 'apple_balance_reconciliation';
const accountColumnOptions = [
  { label: 'Apple ID', value: 'appleId', required: true },
  { label: '地区/币种', value: 'region' },
  { label: '系统余额', value: 'currentBalance' },
  { label: '余额成本', value: 'balanceCostAmount' },
  { label: '平均成本', value: 'averageCost' },
  { label: '状态', value: 'status' },
  { label: '锁定', value: 'isManuallyLocked' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];
const lockedOptions = [
  { label: '已锁定', value: 'true' },
  { label: '未锁定', value: 'false' }
];
const accountSortFieldMap: Record<string, string> = {
  appleId: 'appleId',
  region: 'region',
  currentBalance: 'currentBalance',
  balanceCostAmount: 'balanceCostAmount',
  averageCost: 'averageCost',
  status: 'status',
  isManuallyLocked: 'isManuallyLocked',
  updatedAt: 'updatedAt'
};

const loading = ref(false);
const saving = ref(false);
const recordsLoading = ref(false);
const adjustDialogVisible = ref(false);
const recordsDrawerVisible = ref(false);
const selectedAccount = ref<AppleAccount | null>(null);
const formRef = ref<FormInstance>();
const accounts = ref<AppleAccount[]>([]);
const adjustments = ref<AppleBalanceAdjustment[]>([]);
const selectedAccounts = ref<AppleAccount[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const total = ref(0);
const adjustmentTotal = ref(0);

const query = reactive<AppleAccountQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  currency: '',
  locked: '',
  sortBy: '',
  sortOrder: ''
});

const recordsQuery = reactive({
  page: 1,
  pageSize: 10
});

const form = reactive<{
  newBalance: string;
  costAdjustMethod: AppleBalanceAdjustment['costAdjustMethod'];
  newCostRmb: string;
  reason: string;
}>({
  newBalance: '',
  costAdjustMethod: 'current_avg',
  newCostRmb: '',
  reason: ''
});

const rules: FormRules<typeof form> = {
  newBalance: [{ required: true, message: '请输入新余额', trigger: 'blur' }],
  costAdjustMethod: [{ required: true, message: '请选择成本修正方式', trigger: 'change' }],
  reason: [{ required: true, message: '请输入修正原因', trigger: 'blur' }]
};

const statusOptions: Array<{
  label: string;
  value: AppleAccount['status'];
  type: 'success' | 'warning' | 'danger' | 'info';
}> = [
  { label: '正常', value: 'normal', type: 'success' },
  { label: '需要验证', value: 'need_verify', type: 'warning' },
  { label: '已锁定', value: 'locked', type: 'danger' },
  { label: '密码错误', value: 'password_error', type: 'danger' },
  { label: '风险', value: 'risk', type: 'warning' },
  { label: '未知', value: 'unknown', type: 'info' }
];

const costAdjustMethodLabels: Record<AppleBalanceAdjustment['costAdjustMethod'], string> = {
  none: '只修余额',
  current_avg: '按当前均价',
  manual: '手动成本'
};

const totalBalance = computed(() =>
  accounts.value.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0).toFixed(2)
);
const totalCost = computed(() =>
  accounts.value
    .reduce((sum, account) => sum + Number(account.balanceCostAmount || 0), 0)
    .toFixed(2)
);
const lockedCount = computed(
  () => accounts.value.filter((account) => account.isManuallyLocked).length
);
const reconcilableCount = computed(
  () =>
    accounts.value.filter((account) => account.status === 'normal' && !account.isManuallyLocked)
      .length
);
const averageCostPreview = computed(() => {
  const balance = Number(totalBalance.value);
  const cost = Number(totalCost.value);

  if (!balance) {
    return '-';
  }

  return (cost / balance).toFixed(4);
});
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const lockedLabel = lockedOptions.find((item) => item.value === query.locked)?.label;

  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }

  if (query.locked && lockedLabel) {
    chips.push({ key: 'locked', label: '手动锁定', value: lockedLabel });
  }

  return chips;
});
const previewDifference = computed(() => {
  if (!selectedAccount.value || !form.newBalance) return '-';
  return (Number(form.newBalance) - Number(selectedAccount.value.currentBalance)).toFixed(4);
});
const previewNewCost = computed(() => {
  if (!selectedAccount.value || !form.newBalance) return '-';
  const oldCost = Number(selectedAccount.value.balanceCostAmount);
  const oldBalance = Number(selectedAccount.value.currentBalance);
  const newBalance = Number(form.newBalance);
  const averageCost = Number(selectedAccount.value.averageCost);

  if (Number.isNaN(newBalance)) return '-';
  if (form.costAdjustMethod === 'none') return oldCost.toFixed(4);
  if (form.costAdjustMethod === 'manual') return form.newCostRmb || '-';
  if (newBalance === 0) return '0.0000';

  return (oldCost + (newBalance - oldBalance) * averageCost).toFixed(4);
});
const previewCostChange = computed(() => {
  if (!selectedAccount.value || previewNewCost.value === '-') return '-';
  return (Number(previewNewCost.value) - Number(selectedAccount.value.balanceCostAmount)).toFixed(
    4
  );
});

onMounted(initializePage);

async function loadAccounts() {
  loading.value = true;
  try {
    const data = await appleAccountsApi.list({
      ...query,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      currency: query.currency || undefined,
      locked: query.locked || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    accounts.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 失败');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  query.page = 1;
  loadAccounts();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.currency = '';
  query.locked = '';
  query.sortBy = '';
  query.sortOrder = '';
  savedViewId.value = '';
}

function clearFiltersAndSearch() {
  clearFilters();
  loadAccounts();
}

function removeFilter(key: string) {
  if (key === 'currency') {
    query.currency = '';
  }
  if (key === 'locked') {
    query.locked = '';
  }
}

function handleSelectionChange(rows: AppleAccount[]) {
  selectedAccounts.value = rows;
}

function handleSortChange(event: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  query.page = 1;
  query.sortBy = event.prop ? accountSortFieldMap[event.prop] || '' : '';
  query.sortOrder =
    event.order === 'ascending' ? 'asc' : event.order === 'descending' ? 'desc' : '';

  if (!query.sortOrder) {
    query.sortBy = '';
  }

  loadAccounts();
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function exportList() {
  ElMessage.info('Apple ID 余额对账导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存余额对账视图', {
      inputValue: '余额对账常用视图',
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
        currency: query.currency,
        locked: query.locked
      },
      sortConfig: {
        prop: query.sortBy,
        order:
          query.sortOrder === 'asc' ? 'ascending' : query.sortOrder === 'desc' ? 'descending' : null
      },
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : accountColumnOptions.map((column) => column.value),
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
  await loadAccounts();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.currency = typeof filters.currency === 'string' ? filters.currency : '';
  query.locked = typeof filters.locked === 'string' ? filters.locked : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        accountColumnOptions.some((option) => option.value === column)
      )
    : accountColumnOptions.map((column) => column.value);
  applySortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function applySortConfig(value: Record<string, unknown>) {
  const prop = typeof value.prop === 'string' ? value.prop : '';
  const order = value.order === 'ascending' ? 'asc' : value.order === 'descending' ? 'desc' : '';

  query.sortBy = accountSortFieldMap[prop] ?? prop;
  query.sortOrder = order;
}

function openAdjustDialog(account: AppleAccount) {
  selectedAccount.value = account;
  form.newBalance = account.currentBalance;
  form.costAdjustMethod = 'current_avg';
  form.newCostRmb = account.balanceCostAmount;
  form.reason = '';
  adjustDialogVisible.value = true;
}

async function saveAdjustment() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) return;

  if (form.costAdjustMethod === 'manual' && !form.newCostRmb) {
    ElMessage.error('手动成本修正需要填写新余额成本');
    return;
  }

  saving.value = true;
  try {
    await appleAccountsApi.createBalanceAdjustment(selectedAccount.value.id, {
      newBalance: form.newBalance,
      costAdjustMethod: form.costAdjustMethod,
      newCostRmb: form.costAdjustMethod === 'manual' ? form.newCostRmb : null,
      reason: form.reason
    });
    ElMessage.success('余额修正已保存');
    adjustDialogVisible.value = false;
    await loadAccounts();
    await loadAdjustmentRecords();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存余额修正失败');
  } finally {
    saving.value = false;
  }
}

async function openAdjustmentRecords(account: AppleAccount) {
  selectedAccount.value = account;
  recordsQuery.page = 1;
  recordsDrawerVisible.value = true;
  await loadAdjustmentRecords();
}

async function loadAdjustmentRecords() {
  if (!selectedAccount.value) return;

  recordsLoading.value = true;
  try {
    const data = await appleAccountsApi.listBalanceAdjustments(selectedAccount.value.id, {
      page: recordsQuery.page,
      pageSize: recordsQuery.pageSize
    });
    adjustments.value = data.items;
    adjustmentTotal.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载余额修正记录失败');
  } finally {
    recordsLoading.value = false;
  }
}

function openDetail(account: AppleAccount) {
  router.push({
    path: '/apple/accounts/detail',
    query: { id: account.id }
  });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getStatusLabel(status: AppleAccount['status']) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

function getStatusTone(status: AppleAccount['status']) {
  const type = statusOptions.find((item) => item.value === status)?.type ?? 'info';

  if (type === 'success') return 'green';
  if (type === 'warning') return 'orange';
  if (type === 'danger') return 'red';
  return 'neutral';
}

function getCostAdjustMethodLabel(method: AppleBalanceAdjustment['costAdjustMethod']) {
  return costAdjustMethodLabels[method] ?? method;
}

async function initializePage() {
  await loadTableViews(true);
  await loadAccounts();
}
</script>
