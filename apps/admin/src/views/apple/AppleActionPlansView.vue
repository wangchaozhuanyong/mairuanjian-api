<template>
  <PageScaffold
    title="到期客户处理台"
    group="工作台"
    phase="Phase 5"
    description="按订单开通记录筛选临近到期客户，集中处理 Apple ID 充值、续费和停止续费。"
  >
    <div class="action-plan-overview">
      <div class="action-plan-notice" :class="{ 'action-plan-notice--safe': urgentCount === 0 }">
        <StatusChip :tone="urgentCount ? 'orange' : 'green'" dot>
          {{ selectedExpiresLabel }}
        </StatusChip>
        <div>
          <strong>当前筛选 {{ total }} 条到期记录</strong>
          <p>
            今日/已过期 {{ urgentCount }} 条 · 余额不足 {{ balanceShortageCount }} 条 · 已提交
            {{ submittedCount }} 条
          </p>
        </div>
        <div class="action-plan-notice__stats">
          <span>当前页 {{ customers.length }}</span>
          <span>待提交 {{ pendingSubmitCount }}</span>
          <span>售出 {{ soldCount }}</span>
          <span>寄存 {{ consignedCount }}</span>
        </div>
      </div>
    </div>

    <section class="content-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="到期客户"
          help="这里按订单开通记录显示临近到期客户，充值只更新 Apple ID 余额，提交后会写入续费工作台。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>默认 3 天内含已到期</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        :column-options="columnOptions"
        :status-options="activationStatusOptions"
        :filter-chips="filterChips"
        :selected-count="selectedRows.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-save-view="false"
        :show-primary="false"
        show-filter-chips
        placeholder="搜索客户、电话尾号、微信、网站账号、订单号、Apple ID、业务"
        @search="handleSearch"
        @refresh="loadCustomers"
        @clear-filters="clearFiltersAndSearch"
        @remove-filter="removeFilter"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="expiresPreset"
            class="table-toolbar__select"
            placeholder="到期时间"
            @change="handleExpiresPresetChange"
          >
            <el-option
              v-for="item in expiresPresetOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-date-picker
            v-if="expiresPreset === 'custom'"
            v-model="expireDateRange"
            class="table-toolbar__date-range"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始到期"
            end-placeholder="结束到期"
            @change="handleSearch"
          />
          <el-select
            v-model="query.ownershipType"
            class="table-toolbar__select"
            clearable
            placeholder="售出/寄存"
            @change="handleSearch"
          >
            <el-option
              v-for="item in ownershipOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.appleAccountStatus"
            class="table-toolbar__select"
            clearable
            placeholder="ID 状态"
            @change="handleSearch"
          >
            <el-option
              v-for="item in accountStatusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.renewalSubmitted"
            class="table-toolbar__select"
            clearable
            placeholder="续费任务"
            @change="handleSearch"
          >
            <el-option label="已提交" value="true" />
            <el-option label="未提交" value="false" />
          </el-select>
        </template>
      </TableToolbar>

      <ListRequestError
        v-if="customersLoadError && customers.length"
        title="到期客户刷新失败"
        :message="customersLoadError"
        @retry="() => loadCustomers({ force: true })"
      />

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="customers"
        :size="tableSize"
        row-key="id"
        empty-text="暂无到期客户"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <ListRequestError
            v-if="customersLoadError"
            title="到期客户加载失败"
            :message="customersLoadError"
            @retry="() => loadCustomers({ force: true })"
          />
          <div v-else class="apple-core-empty-state">
            <strong>暂无到期客户</strong>
            <span>可以切换到期时间或清空筛选后重新查看。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="refreshCustomers">刷新</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column v-if="isColumnVisible('customer')" label="客户" min-width="210">
          <template #default="{ row }">
            <strong>{{ row.customer.name }}</strong>
            <div class="muted-block">
              电话 {{ row.customer.phoneMasked || '-' }} · 微信 {{ row.customer.wechat || '-' }}
            </div>
            <div class="muted-block">网站账号 {{ row.serviceAccount || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="开通业务" min-width="260">
          <template #default="{ row }">
            <strong>{{ row.currentPackageSummary }}</strong>
            <div class="muted-block">
              {{ row.service.category }} · 订单 {{ row.orderNo }}
              <span v-if="row.externalOrderNo"> / {{ row.externalOrderNo }}</span>
            </div>
            <div class="muted-block">{{ row.sourcePlatform?.name || '未记录来源平台' }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('appleId')" label="使用 ID" min-width="210">
          <template #default="{ row }">
            <strong>{{ row.appleAccount?.appleIdMasked || '-' }}</strong>
            <div class="muted-block">
              {{ row.appleAccount?.region || row.serviceRegion || '-' }} /
              {{ row.appleAccount?.currency || row.currency }}
            </div>
            <div class="table-action-group table-action-group--wrap">
              <StatusChip :tone="getAccountStatusTone(row.appleAccount?.status)" dot>
                {{ getAccountStatusLabel(row.appleAccount?.status) }}
              </StatusChip>
              <StatusChip :tone="row.appleAccountOwnershipType === 'sold' ? 'purple' : 'cyan'">
                {{ getOwnershipLabel(row.appleAccountOwnershipType) }}
              </StatusChip>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expire')"
          prop="expireTime"
          label="到期时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getExpireTone(row.daysUntilExpire)" dot>
              {{ formatExpireDelta(row.daysUntilExpire) }}
            </StatusChip>
            <div class="muted-block">{{ formatDate(row.expireTime, true) }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('lastPrice')"
          prop="paidAmountRmb"
          label="上一次开通价格"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">
            <strong>{{ row.lastPaidAmount }} {{ row.lastPaidCurrency }}</strong>
            <div class="muted-block">折合 {{ row.lastPaidAmountRmb }} CNY</div>
            <div class="muted-block">
              消耗 {{ row.consumedValue }} {{ row.currency }} · 余额
              {{ row.appleAccount?.currentBalance || '-' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('renewal')" label="续费任务" min-width="180">
          <template #default="{ row }">
            <StatusChip :tone="row.renewalSubmitted ? 'green' : 'orange'" dot>
              {{ row.renewalSubmitted ? '已提交' : '未提交' }}
            </StatusChip>
            <div class="muted-block">{{ row.renewalTask?.title || row.renewalNote || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="canTopupAppleBalance || canUpdateActionPlans"
          label="操作"
          width="210"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton
                v-if="canTopupAppleBalance"
                size="small"
                variant="soft"
                :disabled="!row.appleAccount"
                @click="openTopupDialog(row)"
              >
                充值
              </AppButton>
              <AppButton
                v-if="canUpdateActionPlans"
                size="small"
                variant="primary"
                @click="openSubmitDialog(row)"
              >
                提交续费工作台
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="customers.length" class="mobile-record-list">
        <article v-for="row in customers" :key="row.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ row.customer.name }}</strong>
              <span>{{ row.currentPackageSummary }}</span>
            </div>
            <StatusChip :tone="getExpireTone(row.daysUntilExpire)" dot>
              {{ formatExpireDelta(row.daysUntilExpire) }}
            </StatusChip>
          </div>
          <div class="mobile-record-card__meta">
            <div>
              <span>电话/微信</span>
              <strong
                >{{ row.customer.phoneMasked || '-' }} / {{ row.customer.wechat || '-' }}</strong
              >
            </div>
            <div>
              <span>网站账号</span>
              <strong>{{ row.serviceAccount || '-' }}</strong>
            </div>
            <div>
              <span>使用 ID</span>
              <strong>{{ row.appleAccount?.appleIdMasked || '-' }}</strong>
            </div>
            <div>
              <span>上次价格</span>
              <strong>{{ row.lastPaidAmount }} {{ row.lastPaidCurrency }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton
              v-if="canTopupAppleBalance"
              size="small"
              variant="soft"
              :disabled="!row.appleAccount"
              @click="openTopupDialog(row)"
            >
              充值
            </AppButton>
            <AppButton
              v-if="canUpdateActionPlans"
              size="small"
              variant="primary"
              @click="openSubmitDialog(row)"
            >
              提交续费工作台
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else-if="customersLoadError" class="mobile-record-list" aria-label="到期客户加载失败">
        <ListRequestError
          title="到期客户加载失败"
          :message="customersLoadError"
          @retry="() => loadCustomers({ force: true })"
        />
      </div>

      <div v-else class="mobile-record-list" aria-label="到期客户空状态">
        <div class="apple-core-empty-state">
          <strong>暂无到期客户</strong>
          <span>可以切换到期时间或清空筛选后重新查看。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="refreshCustomers">刷新</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadCustomers"
      />
    </section>

    <el-dialog v-model="topupDialogVisible" title="Apple ID 充值" width="520px" destroy-on-close>
      <el-form ref="topupFormRef" :model="topupForm" :rules="topupRules" label-position="top">
        <el-form-item label="Apple ID">
          <el-input :model-value="selectedRow?.appleAccount?.appleIdMasked || '-'" disabled />
        </el-form-item>
        <el-form-item label="充值面值" prop="faceValue">
          <el-input v-model="topupForm.faceValue" placeholder="例如 20" />
        </el-form-item>
        <el-form-item label="人民币成本单价" prop="unitCost">
          <el-input v-model="topupForm.unitCost" placeholder="例如 7.25" />
        </el-form-item>
        <div class="drawer-detail-grid">
          <div>
            <span>总人民币成本</span>
            <strong>{{ topupTotalCost }} CNY</strong>
          </div>
          <div>
            <span>充值后预估余额</span>
            <strong>{{ estimatedBalanceAfterTopup }}</strong>
          </div>
        </div>
        <el-form-item label="礼品卡/凭证" prop="giftCardCode">
          <el-input v-model="topupForm.giftCardCode" placeholder="可选" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="topupForm.remark" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="topupDialogVisible = false">取消</AppButton>
        <AppButton
          v-if="canTopupAppleBalance"
          variant="primary"
          :loading="savingTopup"
          @click="saveTopup"
        >
          保存充值
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog v-model="submitDialogVisible" title="提交续费工作台" width="620px" destroy-on-close>
      <el-form ref="submitFormRef" :model="submitForm" :rules="submitRules" label-position="top">
        <div class="drawer-detail-grid">
          <div>
            <span>客户</span>
            <strong>{{ selectedRow?.customer.name || '-' }}</strong>
          </div>
          <div>
            <span>当前套餐</span>
            <strong>{{ selectedRow?.currentPackageSummary || '-' }}</strong>
          </div>
          <div>
            <span>到期时间</span>
            <strong>{{ formatDate(selectedRow?.expireTime, true) }}</strong>
          </div>
          <div>
            <span>当前余额</span>
            <strong>{{ selectedRow?.appleAccount?.currentBalance || '-' }}</strong>
          </div>
        </div>

        <el-form-item label="处理方式" prop="decision">
          <el-radio-group v-model="submitForm.decision">
            <el-radio-button label="renew">续费</el-radio-button>
            <el-radio-button label="stop">停止</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="submitForm.decision === 'renew'">
          <el-form-item label="国家/地区" prop="targetRegion">
            <el-select
              v-model="submitForm.targetRegion"
              filterable
              placeholder="选择国家/地区"
              @change="handleSubmitRegionChange"
            >
              <el-option
                v-for="item in targetRegionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="分类" prop="targetCategory">
            <el-select
              v-model="submitForm.targetCategory"
              filterable
              placeholder="选择分类"
              @change="handleSubmitCategoryChange"
            >
              <el-option
                v-for="item in targetCategoryOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="业务" prop="targetServicePriceId">
            <el-select
              v-model="submitForm.targetServicePriceId"
              filterable
              :loading="servicePricesLoading"
              :disabled="!canLoadTargetServicePrices && !targetServiceOptions.length"
              placeholder="选择续费业务"
            >
              <el-option
                v-for="item in targetServiceOptions"
                :key="item.id"
                :label="formatServicePriceOption(item)"
                :value="item.id"
              />
              <template #empty>
                <span class="select-empty-text">{{ serviceOptionEmptyText }}</span>
              </template>
            </el-select>
          </el-form-item>
          <div class="drawer-detail-grid">
            <div>
              <span>目标套餐</span>
              <strong>{{ selectedTargetPriceSummary }}</strong>
            </div>
            <div>
              <span>建议充值</span>
              <strong>{{ selectedTargetSuggestedTopup }}</strong>
            </div>
          </div>
        </template>

        <el-form-item label="备注" prop="note">
          <el-input
            v-model="submitForm.note"
            type="textarea"
            :rows="3"
            placeholder="可填写客户沟通结果、收款说明或停止原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="submitDialogVisible = false">取消</AppButton>
        <AppButton
          v-if="canUpdateActionPlans"
          variant="primary"
          :loading="submitting"
          @click="submitToRenewalWorkbench"
        >
          提交
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  appleAccountsApi,
  appleActionPlansApi,
  appleServicesApi,
  type AppleExpiringCustomerQuery
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import ListRequestError from '@/components/ui/ListRequestError.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleAccount,
  AppleAccountOwnershipType,
  AppleExpiringCustomer,
  PageResult,
  TableDensity
} from '@/types/system';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { getLoadErrorMessage } from '@/utils/loadErrorMessage';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, refreshSmartQuery } from '@/utils/smartQuery';

type ChipTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';

interface SubmitForm {
  decision: 'renew' | 'stop';
  targetRegion: string;
  targetCategory: string;
  targetServicePriceId: string;
  note: string;
}

type ActionPlanServicePriceOption = Pick<
  NonNullable<AppleExpiringCustomer['servicePrice']>,
  'id' | 'serviceId' | 'serviceName' | 'category' | 'region' | 'currency' | 'appleBalancePrice'
> & {
  service?: Pick<AppleExpiringCustomer['service'], 'id' | 'name' | 'category' | 'currency'>;
};

const customers = ref<AppleExpiringCustomer[]>([]);
const customersLoadError = ref('');
const total = ref(0);
const loading = ref(false);
const servicePricesLoading = ref(false);
const submitting = ref(false);
const savingTopup = ref(false);
const selectedRows = ref<AppleExpiringCustomer[]>([]);
const selectedRow = ref<AppleExpiringCustomer | null>(null);
const visibleColumns = ref<string[]>([]);
const density = ref<TableDensity>('default');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const activeQueryKey = ref('');
const expiresPreset = ref('3');
const expireDateRange = ref<[string, string] | []>([]);
const servicePrices = ref<ActionPlanServicePriceOption[]>([]);
const topupDialogVisible = ref(false);
const submitDialogVisible = ref(false);
const topupFormRef = ref<FormInstance>();
const submitFormRef = ref<FormInstance>();
let stopRealtimeListener: (() => void) | undefined;
let keywordSearchTimer: number | undefined;

const query = reactive<AppleExpiringCustomerQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  expiresInDays: '3',
  ownershipType: '',
  appleAccountStatus: '',
  renewalSubmitted: ''
});

const topupForm = reactive({
  faceValue: '',
  unitCost: '',
  giftCardCode: '',
  remark: ''
});

const submitForm = reactive<SubmitForm>({
  decision: 'renew',
  targetRegion: '',
  targetCategory: '',
  targetServicePriceId: '',
  note: ''
});

const positiveAmountRule = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (readAmount(value) > 0) {
    callback();
    return;
  }
  callback(new Error('请输入大于 0 的金额'));
};

const topupRules: FormRules = {
  faceValue: [{ validator: positiveAmountRule, trigger: 'blur' }],
  unitCost: [{ validator: positiveAmountRule, trigger: 'blur' }]
};

const submitRules: FormRules = {
  decision: [{ required: true, message: '请选择处理方式', trigger: 'change' }],
  targetServicePriceId: [
    {
      validator: (_rule, value: string, callback) => {
        if (submitForm.decision === 'renew' && !value && !selectedRow.value?.service?.id) {
          callback(new Error('请选择续费业务'));
          return;
        }
        callback();
      },
      trigger: 'change'
    }
  ]
};

const activationStatusOptions = [
  { label: '开通中', value: 'active' },
  { label: '已到期', value: 'expired' },
  { label: '已取消', value: 'cancelled' },
  { label: '异常', value: 'abnormal' }
];

const expiresPresetOptions = [
  { label: '已到期/今天', value: '0' },
  { label: '已到期/1天内', value: '1' },
  { label: '已到期/3天内', value: '3' },
  { label: '已到期/7天内', value: '7' },
  { label: '已到期/15天内', value: '15' },
  { label: '自定义', value: 'custom' }
];

const ownershipOptions: Array<{ label: string; value: AppleAccountOwnershipType }> = [
  { label: '寄存', value: 'consigned' },
  { label: '售出', value: 'sold' }
];

const accountStatusOptions: Array<{ label: string; value: AppleAccount['status'] }> = [
  { label: '正常', value: 'normal' },
  { label: '需验证', value: 'need_verify' },
  { label: '锁定', value: 'locked' },
  { label: '密码错误', value: 'password_error' },
  { label: '风险', value: 'risk' },
  { label: '未知', value: 'unknown' }
];

const columnOptions = [
  { label: '客户', value: 'customer', required: true },
  { label: '开通业务', value: 'service', required: true },
  { label: '使用 ID', value: 'appleId' },
  { label: '到期时间', value: 'expire' },
  { label: '上一次开通价格', value: 'lastPrice' },
  { label: '续费任务', value: 'renewal' }
];

const batchActions = [{ label: '批量导出', value: 'export' }];

const authStore = useAuthStore();
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const selectedExpiresLabel = computed(
  () => expiresPresetOptions.find((item) => item.value === expiresPreset.value)?.label ?? '到期筛选'
);
const urgentCount = computed(
  () => customers.value.filter((item) => (item.daysUntilExpire ?? 999) <= 0).length
);
const balanceShortageCount = computed(
  () => customers.value.filter((item) => getSuggestedTopupForRow(item) > 0).length
);
const submittedCount = computed(
  () => customers.value.filter((item) => item.renewalSubmitted).length
);
const pendingSubmitCount = computed(
  () => customers.value.filter((item) => !item.renewalSubmitted).length
);
const soldCount = computed(
  () => customers.value.filter((item) => item.appleAccountOwnershipType === 'sold').length
);
const consignedCount = computed(
  () => customers.value.filter((item) => item.appleAccountOwnershipType === 'consigned').length
);
const canTopupAppleBalance = computed(() => hasActionPlanPermission('apple.balance.topup'));
const canUpdateActionPlans = computed(() => hasActionPlanPermission('apple.action_plan.update'));
const canManageAppleServices = computed(() => hasActionPlanPermission('apple.service.manage'));
const canCreateAppleOrder = computed(() => hasActionPlanPermission('apple.order.create'));
const canLoadTargetServicePrices = computed(
  () => canManageAppleServices.value || canCreateAppleOrder.value || canUpdateActionPlans.value
);
const serviceOptionEmptyText = computed(() =>
  canLoadTargetServicePrices.value
    ? '暂无可选续费业务，请先确认业务套餐已启用。'
    : '当前账号不能读取业务套餐，将按当前开通业务提交续费。'
);

const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const expiresLabel = selectedExpiresLabel.value;
  const ownershipLabel = ownershipOptions.find((item) => item.value === query.ownershipType)?.label;
  const accountStatusLabel = accountStatusOptions.find(
    (item) => item.value === query.appleAccountStatus
  )?.label;

  if (expiresPreset.value) chips.push({ key: 'expires', label: '到期时间', value: expiresLabel });
  if (ownershipLabel)
    chips.push({ key: 'ownershipType', label: '售出/寄存', value: ownershipLabel });
  if (accountStatusLabel)
    chips.push({ key: 'appleAccountStatus', label: 'ID 状态', value: accountStatusLabel });
  if (query.renewalSubmitted) {
    chips.push({
      key: 'renewalSubmitted',
      label: '续费任务',
      value: query.renewalSubmitted === 'true' ? '已提交' : '未提交'
    });
  }

  return chips;
});

const targetRegionOptions = computed(() =>
  uniqueOptions(
    servicePrices.value,
    (item) => item.region,
    (value) => value
  )
);
const targetCategoryOptions = computed(() =>
  uniqueOptions(
    servicePrices.value.filter(
      (item) => !submitForm.targetRegion || item.region === submitForm.targetRegion
    ),
    (item) => item.category,
    (value) => value
  )
);
const targetServiceOptions = computed(() =>
  servicePrices.value.filter(
    (item) =>
      (!submitForm.targetRegion || item.region === submitForm.targetRegion) &&
      (!submitForm.targetCategory || item.category === submitForm.targetCategory)
  )
);
const selectedTargetPrice = computed(
  () => servicePrices.value.find((item) => item.id === submitForm.targetServicePriceId) ?? null
);
const selectedTargetPriceSummary = computed(() =>
  selectedTargetPrice.value ? formatServicePriceOption(selectedTargetPrice.value) : '-'
);
const selectedTargetSuggestedTopup = computed(() => {
  if (!selectedTargetPrice.value || !selectedRow.value?.appleAccount) {
    return '-';
  }
  const amount = Math.max(
    0,
    readAmount(selectedTargetPrice.value.appleBalancePrice) -
      readAmount(selectedRow.value.appleAccount.currentBalance)
  );
  return `${formatNumber(amount)} ${selectedTargetPrice.value.currency}`;
});
const topupTotalCost = computed(() =>
  formatNumber(readAmount(topupForm.faceValue) * readAmount(topupForm.unitCost))
);
const estimatedBalanceAfterTopup = computed(() => {
  const current = readAmount(selectedRow.value?.appleAccount?.currentBalance);
  const faceValue = readAmount(topupForm.faceValue);
  const currency = selectedRow.value?.appleAccount?.currency || selectedRow.value?.currency || '';
  return `${formatNumber(current + faceValue)} ${currency}`.trim();
});

onMounted(() => {
  loadCustomers();
  if (canLoadTargetServicePrices.value) {
    loadServicePrices();
  }
  stopRealtimeListener = onRealtimeQueryInvalidated(
    ['apple-action-plans', 'apple-renewal-tasks', 'apple-accounts'],
    () => loadCustomers({ background: true, force: true })
  );
});

usePageRefresh(
  (options) =>
    refreshActionPlansPage({
      background: options.background,
      force: options.force ?? true
    }),
  { label: 'Apple ID 操作计划' }
);

async function refreshActionPlansPage(options: { background?: boolean; force?: boolean } = {}) {
  await loadCustomers(options);

  if (canLoadTargetServicePrices.value) {
    await loadServicePrices();
  }
}

onBeforeUnmount(() => {
  stopRealtimeListener?.();
  if (keywordSearchTimer) {
    window.clearTimeout(keywordSearchTimer);
  }
});

watch(
  () => query.keyword,
  () => {
    if (keywordSearchTimer) {
      window.clearTimeout(keywordSearchTimer);
    }

    keywordSearchTimer = window.setTimeout(() => {
      query.page = 1;
      loadCustomers({ force: true });
    }, 350);
  }
);

function buildListParams(): AppleExpiringCustomerQuery {
  const [expireFrom, expireTo] = expireDateRange.value;
  return {
    ...query,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    expiresInDays: expiresPreset.value === 'custom' ? undefined : expiresPreset.value,
    expireFrom: expiresPreset.value === 'custom' ? buildStartDate(expireFrom) : undefined,
    expireTo: expiresPreset.value === 'custom' ? buildEndDate(expireTo) : undefined,
    ownershipType: query.ownershipType || undefined,
    appleAccountStatus: query.appleAccountStatus || undefined,
    renewalSubmitted: query.renewalSubmitted || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

async function loadCustomers(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildListParams();
  const key = createSmartQueryKey('apple-action-plans:expiring-customers', params);
  activeQueryKey.value = key;
  loading.value = !options.background;

  try {
    const result = await refreshSmartQuery<PageResult<AppleExpiringCustomer>>({
      key,
      fetcher: () => appleActionPlansApi.listExpiringCustomers(params),
      force: options.force ?? true
    });

    if (activeQueryKey.value !== key) {
      return;
    }

    applyCustomerResult(result.data);
    customersLoadError.value = '';
  } catch (error) {
    if (!options.background) {
      customersLoadError.value = getLoadErrorMessage(error, '加载到期客户失败');
      ElMessage.error(customersLoadError.value);
    }
  } finally {
    if (activeQueryKey.value === key) {
      loading.value = false;
    }
  }
}

function applyCustomerResult(result: PageResult<AppleExpiringCustomer>) {
  customers.value = result.items;
  total.value = result.total;
}

async function loadServicePrices() {
  if (!canLoadTargetServicePrices.value) {
    servicePrices.value = [];
    return;
  }

  servicePricesLoading.value = true;
  try {
    const result = await loadActionPlanServicePrices();
    servicePrices.value = result.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载业务选项失败');
  } finally {
    servicePricesLoading.value = false;
  }
}

function loadActionPlanServicePrices() {
  if (canManageAppleServices.value) {
    return appleServicesApi.listRegionPrices({
      page: 1,
      pageSize: 500,
      status: 'active'
    });
  }

  if (canCreateAppleOrder.value) {
    return appleServicesApi.listOrderOptions();
  }

  return appleServicesApi.listActionPlanOptions();
}

async function handleSearch() {
  query.page = 1;
  await loadCustomers();
}

async function refreshCustomers() {
  await loadCustomers();
}

async function handleExpiresPresetChange() {
  query.page = 1;
  if (expiresPreset.value !== 'custom') {
    expireDateRange.value = [];
  }
  await loadCustomers();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadCustomers();
}

function handleSelectionChange(rows: AppleExpiringCustomer[]) {
  selectedRows.value = rows;
}

async function clearFiltersAndSearch() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.ownershipType = '';
  query.appleAccountStatus = '';
  query.renewalSubmitted = '';
  expiresPreset.value = '3';
  expireDateRange.value = [];
  sortConfig.value = {};
  await loadCustomers();
}

function removeFilter(key: string) {
  if (key === 'expires') {
    expiresPreset.value = '3';
    expireDateRange.value = [];
  }
  if (key === 'ownershipType') query.ownershipType = '';
  if (key === 'appleAccountStatus') query.appleAccountStatus = '';
  if (key === 'renewalSubmitted') query.renewalSubmitted = '';
  handleSearch();
}

function handleBatchAction(action: string) {
  if (action === 'export') {
    exportList();
  }
}

function exportList() {
  const rows = selectedRows.value.length ? selectedRows.value : customers.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的到期客户数据');
    return;
  }

  const count = exportRowsToCsv(
    'apple-expiring-customers',
    [
      { header: '客户', value: (row) => row.customer.name },
      {
        header: '手机号',
        value: (row) => row.customer.phoneMasked ?? row.customer.phoneTail ?? ''
      },
      { header: '微信', value: (row) => row.customer.wechat ?? '' },
      { header: '订单号', value: (row) => row.orderNo },
      { header: '平台订单号', value: (row) => row.externalOrderNo ?? '' },
      { header: '来源平台', value: (row) => row.sourcePlatform?.name ?? '' },
      { header: '业务', value: (row) => row.service.name },
      { header: '当前套餐', value: (row) => row.currentPlan ?? '' },
      { header: '目标套餐', value: (row) => row.targetPlan ?? '' },
      { header: 'Apple ID', value: (row) => row.appleAccount?.appleIdMasked ?? '' },
      {
        header: 'ID 类型',
        value: (row) =>
          getOwnershipLabel(row.appleAccount?.ownershipType ?? row.appleAccountOwnershipType)
      },
      {
        header: 'ID 状态',
        value: (row) => getAccountStatusLabel(row.appleAccount?.status ?? null)
      },
      { header: '开通状态', value: (row) => getActivationStatusLabel(row.status) },
      { header: '到期时间', value: (row) => formatDate(row.expireTime) },
      { header: '距到期', value: (row) => formatExpireDelta(row.daysUntilExpire) },
      { header: '当前余额', value: (row) => row.appleAccount?.currentBalance ?? '' },
      { header: '上次实收', value: (row) => `${row.lastPaidAmount} ${row.lastPaidCurrency}` },
      { header: '上次实收人民币', value: (row) => row.lastPaidAmountRmb },
      { header: '预计扣款', value: (row) => row.consumedValue },
      {
        header: '续费任务',
        value: (row) => (row.renewalSubmitted ? (row.renewalTask?.title ?? '已提交') : '未提交')
      },
      { header: '创建时间', value: (row) => formatDate(row.createdAt, true) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条到期客户数据`);
}

function openTopupDialog(row: AppleExpiringCustomer) {
  if (!canTopupAppleBalance.value) {
    ElMessage.warning('当前账号没有充值权限');
    return;
  }

  if (!row.appleAccount) {
    ElMessage.warning('这条开通记录没有绑定 Apple ID');
    return;
  }
  selectedRow.value = row;
  topupForm.faceValue =
    getSuggestedTopupForRow(row) > 0 ? formatNumber(getSuggestedTopupForRow(row)) : '';
  topupForm.unitCost = '';
  topupForm.giftCardCode = '';
  topupForm.remark = `到期客户充值：${row.customer.name} / ${row.currentPackageSummary}`;
  topupDialogVisible.value = true;
}

async function saveTopup() {
  if (!canTopupAppleBalance.value) {
    ElMessage.warning('当前账号没有充值权限');
    return;
  }

  const valid = await topupFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedRow.value?.appleAccount) {
    return;
  }

  savingTopup.value = true;
  try {
    await appleAccountsApi.createTopup(selectedRow.value.appleAccount.id, {
      faceValue: topupForm.faceValue,
      costAmount: topupTotalCost.value,
      giftCardCode: topupForm.giftCardCode || null,
      remark: topupForm.remark || null
    });
    ElMessage.success('充值已保存');
    topupDialogVisible.value = false;
    await loadCustomers({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存充值失败');
  } finally {
    savingTopup.value = false;
  }
}

async function openSubmitDialog(row: AppleExpiringCustomer) {
  if (!canUpdateActionPlans.value) {
    ElMessage.warning('当前账号没有提交续费任务权限');
    return;
  }

  selectedRow.value = row;
  submitForm.decision = 'renew';
  submitForm.note = '';

  if (!servicePrices.value.length && canLoadTargetServicePrices.value) {
    await loadServicePrices();
  }
  ensureRowServicePriceOption(row);

  submitForm.targetRegion =
    row.servicePrice?.region || row.serviceRegion || row.appleAccount?.region || '';
  submitForm.targetCategory = row.servicePrice?.category || row.service.category || '';
  submitForm.targetServicePriceId =
    row.servicePrice?.id ||
    findFirstTargetServicePrice(row)?.id ||
    targetServiceOptions.value[0]?.id ||
    '';
  submitDialogVisible.value = true;
}

function handleSubmitRegionChange() {
  if (!targetCategoryOptions.value.some((item) => item.value === submitForm.targetCategory)) {
    submitForm.targetCategory = targetCategoryOptions.value[0]?.value || '';
  }
  syncTargetServicePrice();
}

function handleSubmitCategoryChange() {
  syncTargetServicePrice();
}

function syncTargetServicePrice() {
  if (!targetServiceOptions.value.some((item) => item.id === submitForm.targetServicePriceId)) {
    submitForm.targetServicePriceId = targetServiceOptions.value[0]?.id || '';
  }
}

async function submitToRenewalWorkbench() {
  if (!canUpdateActionPlans.value) {
    ElMessage.warning('当前账号没有提交续费任务权限');
    return;
  }

  const valid = await submitFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedRow.value) {
    return;
  }

  if (submitForm.decision === 'stop') {
    try {
      await ElMessageBox.confirm(
        '确认提交停止续费任务？提交后会取消同一开通记录未完成的续费类任务。',
        '确认停止续费',
        {
          type: 'warning',
          confirmButtonText: '提交',
          cancelButtonText: '取消'
        }
      );
    } catch (error) {
      if (error === 'cancel' || error === 'close') return;
      throw error;
    }
  }

  const targetPrice = selectedTargetPrice.value;
  submitting.value = true;
  try {
    await appleActionPlansApi.submitExpiringCustomer(selectedRow.value.activationId, {
      decision: submitForm.decision,
      targetRegion: submitForm.decision === 'renew' ? submitForm.targetRegion || null : null,
      targetCategory: submitForm.decision === 'renew' ? submitForm.targetCategory || null : null,
      targetServiceId:
        submitForm.decision === 'renew'
          ? targetPrice?.serviceId || selectedRow.value.service.id || null
          : null,
      targetServicePriceId:
        submitForm.decision === 'renew' ? submitForm.targetServicePriceId : null,
      note: submitForm.note || null
    });
    ElMessage.success(submitForm.decision === 'renew' ? '续费任务已提交' : '停止续费任务已提交');
    submitDialogVisible.value = false;
    await loadCustomers({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交续费工作台失败');
  } finally {
    submitting.value = false;
  }
}

function hasActionPlanPermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

function findFirstTargetServicePrice(row: AppleExpiringCustomer) {
  return servicePrices.value.find(
    (item) =>
      (!row.serviceRegion || item.region === row.serviceRegion) &&
      item.category === row.service.category &&
      item.serviceId === row.service.id
  );
}

function ensureRowServicePriceOption(row: AppleExpiringCustomer) {
  const price = buildRowServicePriceOption(row);
  if (!price || servicePrices.value.some((item) => item.id === price.id)) {
    return;
  }

  servicePrices.value = [price, ...servicePrices.value];
}

function buildRowServicePriceOption(
  row: AppleExpiringCustomer
): ActionPlanServicePriceOption | null {
  if (!row.servicePrice) {
    return null;
  }

  return {
    id: row.servicePrice.id,
    serviceId: row.servicePrice.serviceId,
    serviceName: row.servicePrice.serviceName || row.service.name,
    category: row.servicePrice.category || row.service.category,
    region: row.servicePrice.region,
    currency: row.servicePrice.currency || row.service.currency,
    appleBalancePrice: row.servicePrice.appleBalancePrice || row.consumedValue,
    service: {
      id: row.service.id,
      name: row.service.name,
      category: row.service.category,
      currency: row.service.currency
    }
  };
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function getSuggestedTopupForRow(row: AppleExpiringCustomer) {
  if (!row.appleAccount) {
    return 0;
  }
  const expected = readAmount(row.servicePrice?.appleBalancePrice || row.consumedValue);
  return Math.max(0, expected - readAmount(row.appleAccount.currentBalance));
}

function formatServicePriceOption(price: ActionPlanServicePriceOption) {
  return `${price.serviceName || price.service?.name || '业务'} / ${price.region} / ${price.appleBalancePrice} ${
    price.currency
  }`;
}

function getOwnershipLabel(value?: AppleAccountOwnershipType | null) {
  if (value === 'sold') return '售出';
  if (value === 'consigned') return '寄存';
  return '未知';
}

function getAccountStatusLabel(value?: AppleAccount['status'] | null) {
  return accountStatusOptions.find((item) => item.value === value)?.label ?? '未知';
}

function getActivationStatusLabel(value?: AppleExpiringCustomer['status']) {
  return activationStatusOptions.find((item) => item.value === value)?.label ?? value ?? '未知';
}

function getAccountStatusTone(value?: AppleAccount['status'] | null): ChipTone {
  if (value === 'normal') return 'green';
  if (value === 'need_verify' || value === 'unknown') return 'orange';
  if (value === 'locked' || value === 'password_error' || value === 'risk') return 'red';
  return 'neutral';
}

function getExpireTone(days?: number | null): ChipTone {
  if (days === null || days === undefined) return 'neutral';
  if (days <= 0) return 'red';
  if (days <= 3) return 'orange';
  return 'blue';
}

function formatExpireDelta(days?: number | null) {
  if (days === null || days === undefined) return '未记录到期';
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天到期';
  return `还有 ${days} 天`;
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return withTime ? date.toLocaleString('zh-CN') : date.toLocaleDateString('zh-CN');
}

function readAmount(value?: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toFixed(2);
}

function uniqueOptions<TItem>(
  items: TItem[],
  getValue: (item: TItem) => string | null | undefined,
  getLabel: (value: string) => string
) {
  return [...new Set(items.map(getValue).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ label: getLabel(value), value }));
}

function buildStartDate(value?: string) {
  return value ? `${value}T00:00:00` : undefined;
}

function buildEndDate(value?: string) {
  return value ? `${value}T23:59:59` : undefined;
}

function mapSortProp(prop?: string) {
  if (prop === 'paidAmountRmb') return 'paidAmountRmb';
  if (prop === 'expireTime') return 'expireTime';
  return undefined;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}
</script>
