<template>
  <PageScaffold
    title="Apple ID 余额对账"
    group="Apple ID 业务"
    phase="Phase 3"
    description="处理人工或自动查询发现的余额差异，支持只修余额、按当前均价修正和手动总成本修正。"
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
          <p>核对系统余额、实际余额和人民币总成本，所有修正记录单独留痕并进入审计链路。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>账号 {{ total }}</StatusChip>
          <StatusChip tone="green">余额 {{ totalBalance }}</StatusChip>
          <StatusChip tone="orange">总成本 {{ totalCost }}</StatusChip>
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
          label="人民币总成本"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              人民币总成本
              <FeatureHelp
                text="系统认为这些剩余余额一共对应多少人民币成本。这里不是填汇率，是总金额。"
              />
            </span>
          </template>
          <template #default="{ row }">{{ getAccountTotalCostAmount(row) }}</template>
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
              <FeatureHelp
                text="每 1 美元 Apple 余额大概对应多少人民币成本。算订单利润会用到它。"
              />
            </span>
          </template>
          <template #default="{ row }">{{ getAccountExchangeRateCostAmount(row) }}</template>
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
        <el-table-column label="操作" width="96" fixed="right">
          <template #default="{ row }">
            <div class="account-operation-cell">
              <AppButton size="small" variant="soft" @click="openReconciliationActions(row)">
                操作
              </AppButton>
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
              <span>人民币总成本</span>
              <strong>{{ getAccountTotalCostAmount(account) }}</strong>
            </div>
            <div>
              <span>平均成本</span>
              <strong>{{ getAccountExchangeRateCostAmount(account) }}</strong>
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
            <AppButton size="small" variant="soft" @click="openReconciliationActions(account)">
              打开操作
            </AppButton>
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

    <AppDrawer
      v-model="actionDrawerVisible"
      :title="`余额对账操作 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="先看账号当前余额和成本，再选择要修正、查记录或查看详情。"
      eyebrow="余额对账"
      size="520px"
      :show-confirm="false"
    >
      <div v-if="selectedAccount" class="account-action-panel">
        <div class="account-action-summary">
          <div class="account-action-summary__head">
            <div>
              <span>当前账号</span>
              <strong>{{ selectedAccount.appleIdMasked }}</strong>
              <p>{{ selectedAccount.region }} / {{ selectedAccount.currency }}</p>
            </div>
            <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
              {{ getStatusLabel(selectedAccount.status) }}
            </StatusChip>
          </div>

          <div class="account-action-summary__metrics">
            <div>
              <span>系统余额</span>
              <strong>{{ selectedAccount.currentBalance }}</strong>
            </div>
            <div>
              <span>总成本</span>
              <strong>{{ getAccountTotalCostAmount(selectedAccount) }}</strong>
            </div>
            <div>
              <span>均价</span>
              <strong>{{ getAccountExchangeRateCostAmount(selectedAccount) }}</strong>
            </div>
          </div>
        </div>

        <div class="account-action-section">
          <span class="account-action-section__title">对账处理</span>
          <div class="account-action-grid">
            <button
              type="button"
              class="account-action-card account-action-card--orange"
              @click="openAdjustDialog(selectedAccount)"
            >
              <strong>修正余额</strong>
              <span>按实际查到的余额改准系统记录，同时处理人民币总成本。</span>
            </button>
            <button
              type="button"
              class="account-action-card"
              @click="openAdjustmentRecords(selectedAccount)"
            >
              <strong>修正记录</strong>
              <span>查看每一次余额和成本变化，方便追溯谁改了什么。</span>
            </button>
            <button type="button" class="account-action-card" @click="openDetail(selectedAccount)">
              <strong>详情</strong>
              <span>先在右侧快速看账号信息，需要完整内容再打开详情页。</span>
            </button>
          </div>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="`账号详情 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="这里展示对账最常用的信息，需要完整业务历史时再打开详情页。"
      eyebrow="详情预览"
      size="620px"
      confirm-text="打开完整详情页"
      @confirm="openSelectedDetailPage"
    >
      <div v-if="selectedAccount" class="account-detail-drawer">
        <div class="drawer-detail-grid">
          <div>
            <span>Apple ID</span>
            <strong>{{ selectedAccount.appleIdMasked }}</strong>
          </div>
          <div>
            <span>系统余额</span>
            <strong>{{ selectedAccount.currentBalance }}</strong>
          </div>
          <div>
            <span>人民币总成本</span>
            <strong>{{ getAccountTotalCostAmount(selectedAccount) }}</strong>
          </div>
          <div>
            <span>平均成本</span>
            <strong>{{ getAccountExchangeRateCostAmount(selectedAccount) }}</strong>
          </div>
          <div>
            <span>锁定状态</span>
            <strong>{{ selectedAccount.isManuallyLocked ? '已锁定' : '正常' }}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{{ formatDate(selectedAccount.updatedAt) }}</strong>
          </div>
        </div>

        <div class="drawer-section">
          <div class="drawer-section__title">账号信息</div>
          <el-descriptions class="detail-descriptions" :column="1" border>
            <el-descriptions-item label="地区/币种">
              {{ selectedAccount.region }} / {{ selectedAccount.currency }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
                {{ getStatusLabel(selectedAccount.status) }}
              </StatusChip>
            </el-descriptions-item>
            <el-descriptions-item label="备注">
              {{ selectedAccount.remark || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="account-detail-actions">
          <AppButton variant="soft" @click="openAdjustDialog(selectedAccount)">修正余额</AppButton>
          <AppButton variant="ghost" @click="openAdjustmentRecords(selectedAccount)">
            修正记录
          </AppButton>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="adjustDialogVisible"
      :title="`修正余额 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="确认实际余额、成本处理方式和修正原因，保存后会写入审计记录。"
      eyebrow="余额修正"
      size="620px"
      confirm-text="保存修正"
      :confirm-loading="saving"
      @confirm="saveAdjustment"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">审计</StatusChip>
        <div>
          <strong>余额修正会写入审计日志</strong>
          <p>
            该操作会更新 Apple ID
            当前余额、人民币总成本和移动平均成本，请只在人工或自动查询确认后使用。
          </p>
        </div>
      </div>

      <div class="drawer-detail-grid sensitive-form">
        <div>
          <span>原余额</span>
          <strong>{{ selectedAccount?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>原总成本</span>
          <strong>{{ selectedAccount ? getAccountTotalCostAmount(selectedAccount) : '-' }}</strong>
        </div>
        <div>
          <span>原均价</span>
          <strong>{{
            selectedAccount ? getAccountExchangeRateCostAmount(selectedAccount) : '-'
          }}</strong>
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
          label="新人民币总成本"
          prop="newCostRmb"
        >
          <el-input v-model.trim="form.newCostRmb" placeholder="手动确认后的人民币总成本" />
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
    </AppDrawer>

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
                <span>原总成本</span>
                <strong>{{ record.oldCostRmb }}</strong>
              </div>
              <div>
                <span>新总成本</span>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleAccountsApi, userTableViewsApi, type AppleAccountQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppleAccount,
  AppleBalanceAdjustment,
  TableDensity,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, refreshSmartQuery } from '@/utils/smartQuery';

const router = useRouter();
const tableKey = 'apple_balance_reconciliation';
const ACCOUNT_SCOPE = 'apple-accounts';
const accountColumnOptions = [
  { label: 'Apple ID', value: 'appleId', required: true },
  { label: '地区/币种', value: 'region' },
  { label: '系统余额', value: 'currentBalance' },
  { label: '人民币总成本', value: 'balanceCostAmount' },
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
const actionDrawerVisible = ref(false);
const adjustDialogVisible = ref(false);
const recordsDrawerVisible = ref(false);
const detailDrawerVisible = ref(false);
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
  manual: '手动总成本'
};

const totalBalance = computed(() =>
  accounts.value.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0).toFixed(2)
);
const totalCost = computed(() =>
  accounts.value.reduce((sum, account) => sum + getAccountTotalCostNumber(account), 0).toFixed(2)
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
  const oldCost = getAccountTotalCostNumber(selectedAccount.value);
  const oldBalance = Number(selectedAccount.value.currentBalance);
  const newBalance = Number(form.newBalance);
  const averageCost = getAccountExchangeRateCostNumber(selectedAccount.value);

  if (Number.isNaN(newBalance)) return '-';
  if (form.costAdjustMethod === 'none') return oldCost.toFixed(4);
  if (form.costAdjustMethod === 'manual') return form.newCostRmb || '-';
  if (newBalance === 0) return '0.0000';

  return (oldCost + (newBalance - oldBalance) * averageCost).toFixed(4);
});
const previewCostChange = computed(() => {
  if (!selectedAccount.value || previewNewCost.value === '-') return '-';
  return (Number(previewNewCost.value) - getAccountTotalCostNumber(selectedAccount.value)).toFixed(
    4
  );
});

function parseDecimalInput(value?: string | number | null) {
  const numberValue = Number(String(value ?? '').trim());
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isLikelyLegacyRateCost(account: AppleAccount) {
  const balance = parseDecimalInput(account.currentBalance);
  const storedCost = parseDecimalInput(account.balanceCostAmount);
  const averageCost = parseDecimalInput(account.averageCost);

  return (
    account.currency !== 'CNY' &&
    balance > 1 &&
    storedCost >= 1 &&
    averageCost > 0 &&
    averageCost < 1
  );
}

function getAccountExchangeRateCostNumber(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return parseDecimalInput(account.balanceCostAmount);
  }

  return parseDecimalInput(account.averageCost);
}

function getAccountExchangeRateCostAmount(account: AppleAccount) {
  return getAccountExchangeRateCostNumber(account).toFixed(4);
}

function getAccountTotalCostNumber(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return parseDecimalInput(account.currentBalance) * parseDecimalInput(account.balanceCostAmount);
  }

  return parseDecimalInput(account.balanceCostAmount);
}

function getAccountTotalCostAmount(account: AppleAccount) {
  return getAccountTotalCostNumber(account).toFixed(4);
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated([ACCOUNT_SCOPE], () => {
  void loadAccounts({ silent: true, dedupeMs: 0 });
});

onMounted(initializePage);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});

async function loadAccounts(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  if (!options.silent || !accounts.value.length) {
    loading.value = true;
  }
  try {
    const params = {
      ...query,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      currency: query.currency || undefined,
      locked: query.locked || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    };
    const result = await refreshSmartQuery({
      key: createSmartQueryKey(ACCOUNT_SCOPE, params),
      fetcher: () => appleAccountsApi.list(params),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    accounts.value = result.data.items;
    total.value = result.data.total;
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

function closeActionSurfaces() {
  actionDrawerVisible.value = false;
  detailDrawerVisible.value = false;
}

function openReconciliationActions(account: AppleAccount) {
  selectedAccount.value = account;
  detailDrawerVisible.value = false;
  actionDrawerVisible.value = true;
}

function openAdjustDialog(account?: AppleAccount) {
  if (account) {
    selectedAccount.value = account;
  }

  if (!selectedAccount.value) {
    return;
  }

  form.newBalance = selectedAccount.value.currentBalance;
  form.costAdjustMethod = 'current_avg';
  form.newCostRmb = getAccountTotalCostAmount(selectedAccount.value);
  form.reason = '';
  closeActionSurfaces();
  adjustDialogVisible.value = true;
}

async function saveAdjustment() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) return;

  if (form.costAdjustMethod === 'manual' && !form.newCostRmb) {
    ElMessage.error('手动成本修正需要填写新人民币总成本');
    return;
  }

  const shouldNormalizeLegacyCost =
    form.costAdjustMethod === 'current_avg' && isLikelyLegacyRateCost(selectedAccount.value);
  const newCostRmb = shouldNormalizeLegacyCost ? previewNewCost.value : form.newCostRmb;

  if (shouldNormalizeLegacyCost && newCostRmb === '-') {
    ElMessage.error('当前账号成本口径需要先修正，请填写新余额后再保存');
    return;
  }

  saving.value = true;
  try {
    await appleAccountsApi.createBalanceAdjustment(selectedAccount.value.id, {
      newBalance: form.newBalance,
      costAdjustMethod: shouldNormalizeLegacyCost ? 'manual' : form.costAdjustMethod,
      newCostRmb:
        form.costAdjustMethod === 'manual' || shouldNormalizeLegacyCost ? newCostRmb : null,
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

async function openAdjustmentRecords(account?: AppleAccount) {
  if (account) {
    selectedAccount.value = account;
  }

  if (!selectedAccount.value) {
    return;
  }

  recordsQuery.page = 1;
  closeActionSurfaces();
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
  selectedAccount.value = account;
  actionDrawerVisible.value = false;
  detailDrawerVisible.value = true;
}

function openSelectedDetailPage() {
  if (!selectedAccount.value) {
    return;
  }

  router.push({
    path: '/apple/accounts/detail',
    query: { id: selectedAccount.value.id }
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
  await loadAccounts({ force: false });
}
</script>
