<template>
  <PageScaffold
    title="Apple ID 订单录入"
    group="Apple ID 业务"
    phase="Phase 4"
    description="录入客户订单，按业务规则自动匹配 Apple ID，提交后自动生成开通记录、扣减余额并计算利润。"
  >
    <template #actions>
      <AppButton @click="() => loadInitialData({ force: true, dedupeMs: 0 })">
        刷新基础数据
      </AppButton>
      <AppButton variant="primary" :loading="saving" @click="submitOrder">提交订单</AppButton>
    </template>

    <AppCard
      title="订单信息"
      subtitle="先录入客户、业务和金额，再从自动匹配结果里选择 Apple ID。"
      :tag="selectedAccount ? '已选择 Apple ID' : '等待匹配'"
      :tag-tone="selectedAccount ? 'green' : 'orange'"
    >
      <div class="order-entry-stepper" aria-label="订单录入步骤">
        <template v-for="(step, index) in orderEntrySteps" :key="step.key">
          <div class="order-entry-step" :class="`order-entry-step--${step.status}`">
            <span class="order-entry-step__circle">{{ index + 1 }}</span>
            <span class="order-entry-step__copy">
              <strong>{{ step.label }}</strong>
              <em>{{ step.description }}</em>
            </span>
          </div>
          <span
            v-if="index < orderEntrySteps.length - 1"
            class="order-entry-step__divider"
            aria-hidden="true"
          />
        </template>
      </div>

      <el-form
        ref="formRef"
        class="v3-entry-form"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <div class="form-grid form-grid--three">
          <el-form-item label="客户" prop="customerId" required>
            <div class="order-entry-customer-picker">
              <el-select
                v-model="form.customerId"
                class="full-input"
                clearable
                filterable
                remote
                reserve-keyword
                :disabled="Boolean(newCustomerDraft)"
                :loading="customerSearching"
                :remote-method="searchCustomers"
                placeholder="搜索客户名称、微信、手机号尾号"
                @change="handleCustomerChange"
                @visible-change="handleCustomerSelectVisibleChange"
              >
                <el-option
                  v-for="customer in customers"
                  :key="customer.id"
                  :label="getCustomerOptionLabel(customer)"
                  :value="customer.id"
                >
                  <div class="order-entry-customer-option">
                    <strong>{{ customer.name }}</strong>
                    <span>{{ getCustomerMeta(customer) }}</span>
                  </div>
                </el-option>
                <template #empty>
                  <div class="order-entry-select-empty">
                    <span>{{
                      customerSearching ? '正在搜索客户...' : '未找到客户，可手动输入资料。'
                    }}</span>
                    <AppButton size="small" variant="soft" @click.stop="openNewCustomerDialog">
                      手动输入
                    </AppButton>
                  </div>
                </template>
              </el-select>
              <AppButton
                class="order-entry-customer-picker__create"
                size="small"
                variant="soft"
                @click="openNewCustomerDialog"
              >
                手动输入
              </AppButton>
            </div>
            <div v-if="newCustomerDraft" class="order-entry-customer-draft">
              <StatusChip tone="blue">待新增</StatusChip>
              <span>{{ newCustomerDraftSummary }}</span>
              <AppButton size="small" variant="ghost" @click="clearNewCustomerDraft">
                移除
              </AppButton>
            </div>
          </el-form-item>
          <el-form-item label="来源平台">
            <el-select
              v-model="form.sourcePlatformId"
              class="full-input"
              clearable
              filterable
              @change="handleSourcePlatformChange"
            >
              <el-option
                v-for="platform in sourcePlatforms"
                :key="platform.id"
                :label="platform.name"
                :value="platform.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="平台订单号">
            <el-input v-model.trim="form.externalOrderNo" />
          </el-form-item>
          <el-form-item label="开通业务" prop="serviceId">
            <el-select
              v-model="form.serviceId"
              class="full-input"
              filterable
              :loading="loading"
              @change="handleServiceChange"
            >
              <el-option-group
                v-for="group in serviceGroups"
                :key="group.category"
                :label="group.category"
              >
                <el-option
                  v-for="service in group.items"
                  :key="service.id"
                  :label="`${service.name} · ${service.officialCostValue} ${service.currency}`"
                  :value="service.id"
                />
              </el-option-group>
              <template #empty>
                <div class="order-entry-select-empty">
                  <span>
                    {{
                      loading
                        ? '正在加载业务...'
                        : '没有可选业务，请确认 ID 业务设置里已启用后再刷新。'
                    }}
                  </span>
                  <AppButton
                    v-if="!loading"
                    size="small"
                    variant="soft"
                    @click.stop="loadInitialData({ force: true, dedupeMs: 0 })"
                  >
                    刷新业务
                  </AppButton>
                </div>
              </template>
            </el-select>
          </el-form-item>

          <el-form-item label="客户网站账号">
            <el-input v-model.trim="form.serviceAccount" />
          </el-form-item>
          <el-form-item label="当前套餐">
            <el-input v-model.trim="form.currentPlan" />
          </el-form-item>

          <el-form-item label="开通时间">
            <el-date-picker
              v-model="form.startTime"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            />
          </el-form-item>
          <el-form-item label="到期时间">
            <el-date-picker
              v-model="form.expireTime"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
              placeholder="留空按业务周期计算"
            />
          </el-form-item>

          <el-form-item label="客户实收" prop="paidAmount">
            <el-input v-model.trim="form.paidAmount" @change="syncDerivedOrderAmounts" />
          </el-form-item>
          <el-form-item label="平台手续费">
            <el-input v-model.trim="form.platformFee" disabled placeholder="按来源平台自动计算" />
          </el-form-item>
          <el-form-item label="退款/补发损耗">
            <el-input v-model.trim="form.refundLoss" />
          </el-form-item>

          <el-form-item label="Apple 消耗金额" prop="appleCostValue">
            <el-input
              v-model.trim="form.appleCostValue"
              disabled
              placeholder="按业务官方消耗自动带出"
            />
          </el-form-item>
          <el-form-item label="已选 Apple ID" prop="appleAccountId">
            <el-input :model-value="selectedAccountLabel" disabled />
          </el-form-item>
        </div>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>

        <div class="v3-entry-form__actions">
          <AppButton :disabled="saving" @click="resetOrderForm">重置录入</AppButton>
          <AppButton variant="primary" :loading="saving" @click="submitOrder"> 提交订单 </AppButton>
        </div>
      </el-form>
    </AppCard>

    <div class="order-entry-board-grid">
      <AppCard
        title="Apple ID 自动匹配"
        subtitle="可用账号会按余额优先展示；不可用账号给出原因。"
        :tag="availableMatchCount ? `可用 ${availableMatchCount}` : '待匹配'"
        :tag-tone="availableMatchCount ? 'green' : 'blue'"
      >
        <div
          class="order-selected-account"
          :class="selectedAccount ? 'order-selected-account--selected' : ''"
        >
          <StatusChip :tone="selectedAccount ? 'green' : 'blue'" dot>
            {{ selectedAccount ? '已选择' : '待选择' }}
          </StatusChip>
          <div>
            <strong>{{
              selectedAccount ? selectedAccount.accountMasked : '尚未选择 Apple ID'
            }}</strong>
            <p>
              {{
                selectedAccount
                  ? `${selectedAccount.region} / ${selectedAccount.currency} · 余额 ${selectedAccount.balance}`
                  : '选择业务后会自动匹配可用 Apple ID，也可以手动重新匹配。'
              }}
            </p>
          </div>
        </div>

        <div class="toolbar">
          <el-input
            v-model="matchKeyword"
            class="toolbar-search"
            placeholder="搜索 Apple ID、地区、币种、备注"
            clearable
            @keyup.enter="loadAvailableAccounts({ autoSelect: true })"
          />
          <AppButton @click="() => loadAvailableAccounts({ autoSelect: true })">重新匹配</AppButton>
        </div>

        <el-table
          v-loading="matchingLoading"
          class="desktop-data-table"
          :data="availableAccounts"
          row-key="appleAccountId"
          size="small"
        >
          <template #empty>
            <div class="apple-core-empty-state">
              <strong>暂无匹配结果</strong>
              <span>请先选择业务，系统会按官方消耗金额自动匹配。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="loadAvailableAccounts({ autoSelect: true })">
                  重新匹配
                </AppButton>
              </div>
            </div>
          </template>
          <el-table-column label="Apple ID" min-width="160">
            <template #default="{ row }">{{ row.accountMasked }}</template>
          </el-table-column>
          <el-table-column label="地区/币种" width="110">
            <template #default="{ row }">{{ row.region }} / {{ row.currency }}</template>
          </el-table-column>
          <el-table-column prop="balance" label="余额" width="90" />
          <el-table-column label="均价" width="100">
            <template #default="{ row }">{{ formatAverageCost(row.avgUnitCost) }}</template>
          </el-table-column>
          <el-table-column label="状态" min-width="150">
            <template #default="{ row }">
              <StatusChip :tone="getAvailabilityTone(row.availability)" dot>
                {{ getAvailabilityLabel(row.availability) }}
              </StatusChip>
              <span class="muted-inline">{{ row.reason ?? '' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <div class="table-action-group table-action-group--wrap">
                <AppButton
                  size="small"
                  variant="ghost"
                  :disabled="row.availability !== 'available'"
                  @click="selectAccount(row)"
                >
                  选择
                </AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div
          v-if="availableAccounts.length"
          class="mobile-record-list"
          aria-label="Apple ID 自动匹配移动列表"
        >
          <article
            v-for="account in availableAccounts"
            :key="account.appleAccountId"
            class="mobile-record-card"
          >
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ account.accountMasked }}</strong>
                <span>{{ account.region }} / {{ account.currency }}</span>
              </div>
              <StatusChip :tone="getAvailabilityTone(account.availability)" dot>
                {{ getAvailabilityLabel(account.availability) }}
              </StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>余额</span>
                <strong>{{ account.balance }}</strong>
              </div>
              <div>
                <span>均价</span>
                <strong>{{ formatAverageCost(account.avgUnitCost) }}</strong>
              </div>
              <div>
                <span>状态原因</span>
                <strong>{{ account.reason || '-' }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__actions">
              <AppButton
                size="small"
                variant="ghost"
                :disabled="account.availability !== 'available'"
                @click="selectAccount(account)"
              >
                选择
              </AppButton>
            </div>
          </article>
        </div>
        <div
          v-else-if="!matchingLoading"
          class="mobile-record-list"
          aria-label="Apple ID 自动匹配空状态"
        >
          <div class="apple-core-empty-state">
            <strong>暂无匹配结果</strong>
            <span>请先选择业务，系统会按官方消耗金额自动匹配。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="loadAvailableAccounts({ autoSelect: true })">
                重新匹配
              </AppButton>
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard
        title="订单成本预估"
        subtitle="提交前核对实收、余额成本、手续费和损耗。"
        :tag="selectedAccount ? '已选账号' : '待匹配'"
        :tag-tone="selectedAccount ? 'green' : 'orange'"
      >
        <div class="order-cost-panel">
          <div v-for="item in orderCostBars" :key="item.label" class="order-cost-row">
            <span>{{ item.label }}</span>
            <div class="order-cost-track">
              <span
                :class="`order-cost-track__bar order-cost-track__bar--${item.tone}`"
                :style="{ width: `${item.percent}%` }"
              />
            </div>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="apple-core-alert-stack">
          <div class="apple-core-alert apple-core-alert--blue">
            <StatusChip tone="blue">余额</StatusChip>
            <div>
              <strong>预计 Apple 余额成本 {{ estimatedAppleCostRmb }}</strong>
              <p>按已选 Apple ID 当前平均成本估算，实际以订单提交后的后端计算为准。</p>
            </div>
          </div>
          <div class="apple-core-alert apple-core-alert--green">
            <StatusChip tone="green">利润</StatusChip>
            <div>
              <strong>预计利润 {{ estimatedProfit }}</strong>
              <p>客户实收减 Apple 余额成本、平台手续费和退款/补发损耗。</p>
            </div>
          </div>
          <div
            class="apple-core-alert"
            :class="
              unavailableMatchCount > 0 ? 'apple-core-alert--orange' : 'apple-core-alert--purple'
            "
          >
            <StatusChip :tone="unavailableMatchCount > 0 ? 'orange' : 'purple'">
              {{ unavailableMatchCount > 0 ? '需确认' : '匹配' }}
            </StatusChip>
            <div>
              <strong>不可用匹配 {{ unavailableMatchCount }}</strong>
              <p>余额不足、锁定、地区或状态不符的账号不会直接进入订单。</p>
            </div>
          </div>
        </div>
      </AppCard>
    </div>

    <el-dialog
      v-model="newCustomerDialogVisible"
      title="新增客户资料"
      width="min(620px, calc(100vw - 24px))"
    >
      <CustomerProfileForm
        ref="newCustomerFormRef"
        :model-value="newCustomerForm"
        :rules="newCustomerRules"
        :source-platforms="sourcePlatforms"
        :tag-options="customerTagOptions"
        @update:model-value="assignCustomerProfileForm(newCustomerForm, $event)"
      />
      <template #footer>
        <AppButton @click="newCustomerDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" @click="saveNewCustomerDraft">加入订单</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { appleMatchingApi, appleOrdersApi, customersApi } from '@/api/system';
import type { SaveCustomerPayload } from '@/api/system';
import CustomerProfileForm from '@/components/business/CustomerProfileForm.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { CustomerProfileFormModel } from '@/types/customerProfileForm';
import type { AppleService, AvailableAppleAccount, Customer, SourcePlatform } from '@/types/system';
import {
  assignCustomerProfileForm,
  buildCustomerProfilePayload,
  createCustomerProfileFormModel,
  resetCustomerProfileForm
} from '@/utils/customerProfileForm';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';
import {
  loadSmartAppleServices,
  loadSmartCustomers,
  loadSmartSourcePlatforms
} from '@/utils/smartSystemQueries';

const ORDER_ENTRY_BASE_SCOPE = 'order-entry-base';
const ORDER_ENTRY_REALTIME_SCOPES = [
  'customers',
  'source-platforms',
  'apple-services',
  ORDER_ENTRY_BASE_SCOPE
];
const loading = ref(false);
const saving = ref(false);
const matchingLoading = ref(false);
const customerSearching = ref(false);
const formRef = ref<FormInstance>();
const newCustomerFormRef = ref<InstanceType<typeof CustomerProfileForm>>();
const customers = ref<Customer[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const services = ref<AppleService[]>([]);
const availableAccounts = ref<AvailableAppleAccount[]>([]);
const selectedAccount = ref<AvailableAppleAccount | null>(null);
const newCustomerDialogVisible = ref(false);
const newCustomerDraft = ref<SaveCustomerPayload | null>(null);
const matchKeyword = ref('');
const customerSearchKeyword = ref('');
let customerSearchRequestId = 0;

const form = reactive({
  customerId: '',
  sourcePlatformId: '',
  externalOrderNo: '',
  serviceId: '',
  appleAccountId: '',
  serviceAccount: '',
  currentPlan: '',
  targetPlan: '',
  startTime: getCurrentDateTimeValue(),
  expireTime: '',
  paidAmount: '',
  platformFee: '0.00',
  refundLoss: '0',
  appleCostValue: '',
  remark: ''
});

const newCustomerForm = reactive<CustomerProfileFormModel>(createCustomerProfileFormModel());

const rules: FormRules<typeof form> = {
  serviceId: [{ required: true, message: '请选择业务', trigger: 'change' }],
  paidAmount: [{ required: true, message: '请输入客户实收', trigger: 'blur' }],
  appleCostValue: [{ required: true, message: '请输入 Apple 消耗金额', trigger: 'blur' }],
  appleAccountId: [{ required: true, message: '请选择可用 Apple ID', trigger: 'change' }]
};

const newCustomerRules: FormRules<CustomerProfileFormModel> = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
};

const selectedService = computed(
  () => services.value.find((service) => service.id === form.serviceId) ?? null
);
const selectedSourcePlatform = computed(
  () => sourcePlatforms.value.find((platform) => platform.id === form.sourcePlatformId) ?? null
);
const selectedCustomer = computed(
  () => customers.value.find((customer) => customer.id === form.customerId) ?? null
);
const hasOrderCustomer = computed(() => Boolean(form.customerId || newCustomerDraft.value));
const serviceGroups = computed(() => {
  const groupedServices = new Map<string, AppleService[]>();

  for (const service of services.value) {
    const category = getServiceCategoryLabel(service.category);
    groupedServices.set(category, [...(groupedServices.get(category) ?? []), service]);
  }

  return Array.from(groupedServices.entries()).map(([category, items]) => ({
    category,
    items
  }));
});
const selectedAccountLabel = computed(() =>
  selectedAccount.value
    ? `${selectedAccount.value.accountMasked} / ${selectedAccount.value.balance} ${selectedAccount.value.currency}`
    : '未选择'
);
const customerTagOptions = computed(() => [
  ...new Set(customers.value.flatMap((customer) => customer.tags))
]);
const newCustomerDraftSummary = computed(() => {
  const customer = newCustomerDraft.value;
  if (!customer) {
    return '';
  }

  const meta = [
    customer.wechat ? `微信 ${customer.wechat}` : '',
    customer.phone ? '已填手机号' : '',
    sourcePlatforms.value.find((platform) => platform.id === customer.sourcePlatformId)?.name ?? ''
  ].filter(Boolean);

  return meta.length ? `${customer.name} · ${meta.join(' · ')}` : customer.name;
});
const availableMatchCount = computed(
  () => availableAccounts.value.filter((account) => account.availability === 'available').length
);
const unavailableMatchCount = computed(
  () => availableAccounts.value.filter((account) => account.availability !== 'available').length
);
const orderEntrySteps = computed(() => [
  {
    key: 'customer',
    label: '客户',
    description: form.customerId
      ? '客户已选择'
      : newCustomerDraft.value
        ? '客户资料待随订单新增'
        : '选择客户和来源平台',
    status: hasOrderCustomer.value ? ('done' as const) : ('active' as const)
  },
  {
    key: 'service',
    label: '业务与 Apple ID',
    description: selectedService.value
      ? `${selectedService.value.name} · ${selectedService.value.currency}`
      : '选择业务后自动匹配账号',
    status:
      form.serviceId && form.appleAccountId
        ? ('done' as const)
        : form.serviceId
          ? ('active' as const)
          : ('pending' as const)
  },
  {
    key: 'amount',
    label: '金额核对',
    description:
      form.paidAmount && form.appleCostValue ? '实收和消耗已填写' : '填写实收、手续费和 Apple 消耗',
    status: form.paidAmount && form.appleCostValue ? ('done' as const) : ('pending' as const)
  },
  {
    key: 'submit',
    label: '确认提交',
    description: form.appleAccountId ? '可提交生成订单闭环' : '等待选择可用 Apple ID',
    status:
      hasOrderCustomer.value &&
      form.serviceId &&
      form.appleAccountId &&
      form.paidAmount &&
      form.appleCostValue
        ? ('active' as const)
        : ('pending' as const)
  }
]);
const estimatedAppleCostValue = computed(() => {
  if (!selectedAccount.value || !form.appleCostValue) {
    return null;
  }

  const value = readAmount(form.appleCostValue) * readAmount(selectedAccount.value.avgUnitCost);
  return Number.isFinite(value) ? value : null;
});
const estimatedAppleCostRmb = computed(() => {
  if (estimatedAppleCostValue.value === null) {
    return '-';
  }

  return formatMoney(estimatedAppleCostValue.value);
});
const estimatedProfit = computed(() => {
  if (!form.paidAmount || estimatedAppleCostValue.value === null) {
    return '-';
  }

  const value =
    readAmount(form.paidAmount) -
    estimatedAppleCostValue.value -
    readAmount(form.platformFee) -
    readAmount(form.refundLoss);

  return formatMoney(value);
});
const orderCostBars = computed(() => {
  const paidAmount = readAmount(form.paidAmount);
  const appleCost = estimatedAppleCostValue.value ?? 0;
  const platformFee = readAmount(form.platformFee);
  const refundLoss = readAmount(form.refundLoss);
  const base = Math.max(paidAmount, appleCost + platformFee + refundLoss, 1);

  return [
    {
      label: '实收',
      value: formatMoney(paidAmount),
      percent: getCostPercent(paidAmount, base),
      tone: 'blue'
    },
    {
      label: '余额成本',
      value: estimatedAppleCostValue.value === null ? '-' : formatMoney(appleCost),
      percent: getCostPercent(appleCost, base),
      tone: 'green'
    },
    {
      label: '手续费',
      value: formatMoney(platformFee),
      percent: getCostPercent(platformFee, base),
      tone: 'orange'
    },
    {
      label: '损耗',
      value: formatMoney(refundLoss),
      percent: getCostPercent(refundLoss, base),
      tone: 'red'
    }
  ];
});

function readAmount(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getCostPercent(value: number, base: number) {
  if (value <= 0) {
    return 4;
  }

  return Math.min(100, Math.max(6, Math.round((value / base) * 100)));
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function formatAverageCost(value: string | number | null | undefined) {
  return readAmount(value).toFixed(2);
}

function getServiceCategoryLabel(category?: string | null) {
  const normalized = category?.trim();
  if (!normalized || normalized === 'default') {
    return '通用';
  }
  return normalized;
}

function calculatePlatformFee() {
  const platform = selectedSourcePlatform.value;
  if (!platform || !form.paidAmount) {
    return '0.00';
  }

  const paidAmount = readAmount(form.paidAmount);
  const feeRate = readAmount(platform.feeRate);
  const feeFixed = readAmount(platform.feeFixed);

  return formatMoney(paidAmount * feeRate + feeFixed);
}

function syncDerivedOrderAmounts() {
  form.platformFee = calculatePlatformFee();
}

function getCurrentDateTimeValue() {
  const date = new Date();
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
  const offsetRestMinutes = String(absoluteOffset % 60).padStart(2, '0');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const millisecond = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${sign}${offsetHours}:${offsetRestMinutes}`;
}

async function loadInitialData(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  try {
    await refreshSmartQueryResource({
      key: createSmartQueryKey(ORDER_ENTRY_BASE_SCOPE),
      fetcher: () => loadOrderEntryBaseData(options),
      apply: applyOrderEntryBaseData,
      background: Boolean(options.silent && customers.value.length),
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载订单基础数据失败');
  }
}

async function loadOrderEntryBaseData(options: { dedupeMs?: number; force?: boolean } = {}) {
  return Promise.all([
    loadSmartCustomers(
      { page: 1, pageSize: 100, status: 'active' },
      { force: options.force ?? true, dedupeMs: options.dedupeMs }
    ),
    loadSmartSourcePlatforms(
      { page: 1, pageSize: 100, status: 'active' },
      { force: options.force ?? true, dedupeMs: options.dedupeMs }
    ),
    loadSmartAppleServices(
      { page: 1, pageSize: 100, status: 'enabled' },
      { force: options.force ?? true, dedupeMs: options.dedupeMs }
    )
  ]);
}

function applyOrderEntryBaseData(data: Awaited<ReturnType<typeof loadOrderEntryBaseData>>) {
  const [customerData, platformData, serviceData] = data;
  customers.value = mergeCustomerItems(
    customerData.items,
    selectedCustomer.value ? [selectedCustomer.value] : []
  );
  sourcePlatforms.value = platformData.items;
  services.value = serviceData.items;
}

function mergeCustomerItems(items: Customer[], pinnedItems: Customer[] = []) {
  const customerMap = new Map<string, Customer>();
  for (const customer of pinnedItems) {
    customerMap.set(customer.id, customer);
  }
  for (const customer of items) {
    customerMap.set(customer.id, customer);
  }
  return Array.from(customerMap.values());
}

async function searchCustomers(keyword: string) {
  const requestId = ++customerSearchRequestId;
  customerSearchKeyword.value = keyword;
  customerSearching.value = true;

  try {
    const data = await loadSmartCustomers(
      {
        page: 1,
        pageSize: 30,
        keyword: keyword.trim() || undefined,
        status: 'active'
      },
      { force: true, dedupeMs: 300 }
    );

    if (requestId !== customerSearchRequestId) {
      return;
    }

    customers.value = mergeCustomerItems(
      data.items,
      selectedCustomer.value ? [selectedCustomer.value] : []
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '搜索客户失败');
  } finally {
    if (requestId === customerSearchRequestId) {
      customerSearching.value = false;
    }
  }
}

function handleCustomerSelectVisibleChange(visible: boolean) {
  if (visible) {
    void searchCustomers(customerSearchKeyword.value);
  }
}

function handleCustomerChange(customerId: string) {
  if (!customerId) {
    return;
  }

  newCustomerDraft.value = null;
  const customer = customers.value.find((item) => item.id === customerId);
  if (!form.sourcePlatformId && customer?.sourcePlatformId) {
    form.sourcePlatformId = customer.sourcePlatformId;
    syncDerivedOrderAmounts();
  }
}

function getCustomerMeta(customer: Customer) {
  return [
    customer.sourcePlatform?.name ?? '',
    customer.wechat ? `微信 ${customer.wechat}` : '',
    customer.maskedPhone ?? (customer.phoneTail ? `尾号 ${customer.phoneTail}` : '')
  ]
    .filter(Boolean)
    .join(' · ');
}

function getCustomerOptionLabel(customer: Customer) {
  const meta = getCustomerMeta(customer);
  return meta ? `${customer.name} · ${meta}` : customer.name;
}

function handleSourcePlatformChange() {
  syncDerivedOrderAmounts();
}

async function handleServiceChange() {
  const service = selectedService.value;
  selectedAccount.value = null;
  form.appleAccountId = '';
  availableAccounts.value = [];

  if (!service) {
    return;
  }

  form.paidAmount = service.defaultPrice;
  form.appleCostValue = service.officialCostValue;
  form.targetPlan = service.name;
  syncDerivedOrderAmounts();
  await loadAvailableAccounts({ autoSelect: service.autoMatchAppleId });
}

function openNewCustomerDialog() {
  if (newCustomerDraft.value) {
    fillNewCustomerFormFromPayload(newCustomerDraft.value);
  } else {
    resetCustomerProfileForm(newCustomerForm);
    newCustomerForm.sourcePlatformId = form.sourcePlatformId;
  }

  newCustomerDialogVisible.value = true;
}

function fillNewCustomerFormFromPayload(payload: SaveCustomerPayload) {
  newCustomerForm.name = payload.name;
  newCustomerForm.phone = payload.phone ?? '';
  newCustomerForm.wechat = payload.wechat ?? '';
  newCustomerForm.sourcePlatformId = payload.sourcePlatformId ?? '';
  newCustomerForm.tags = [...(payload.tags ?? [])];
  newCustomerForm.remark = payload.remark ?? '';
  newCustomerForm.status = payload.status ?? 'active';
}

async function saveNewCustomerDraft() {
  const valid = await newCustomerFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  newCustomerDraft.value = buildCustomerProfilePayload(newCustomerForm, { emptyPhone: 'null' });
  form.customerId = '';

  if (!form.sourcePlatformId && newCustomerDraft.value.sourcePlatformId) {
    form.sourcePlatformId = newCustomerDraft.value.sourcePlatformId;
  }

  formRef.value?.clearValidate('customerId');
  newCustomerDialogVisible.value = false;
  ElMessage.success('客户资料已加入订单，提交订单时会同步到客户管理');
}

function clearNewCustomerDraft() {
  newCustomerDraft.value = null;
  resetCustomerProfileForm(newCustomerForm);
}

async function loadAvailableAccounts(options: { autoSelect?: boolean } = {}) {
  if (!form.serviceId) {
    return;
  }

  matchingLoading.value = true;
  try {
    const data = await appleMatchingApi.listAvailableAccounts({
      serviceId: form.serviceId,
      amountRequired: form.appleCostValue || undefined,
      currency: selectedService.value?.currency,
      keyword: matchKeyword.value || undefined,
      showUnavailable: 'true'
    });
    availableAccounts.value = data.items;
    if (options.autoSelect) {
      const firstAvailableAccount =
        data.items.find((account) => account.availability === 'available') ?? null;
      if (firstAvailableAccount) {
        selectAccount(firstAvailableAccount);
      } else {
        selectedAccount.value = null;
        form.appleAccountId = '';
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '自动匹配失败');
  } finally {
    matchingLoading.value = false;
  }
}

function selectAccount(account: AvailableAppleAccount) {
  selectedAccount.value = account;
  form.appleAccountId = account.appleAccountId;
}

function getAvailabilityLabel(value: AvailableAppleAccount['availability']) {
  return {
    available: '可用',
    unavailable: '不可用',
    need_confirm: '需确认'
  }[value];
}

function getAvailabilityTone(value: AvailableAppleAccount['availability']) {
  if (value === 'available') return 'green';
  if (value === 'need_confirm') return 'orange';
  return 'red';
}

async function submitOrder() {
  if (!hasOrderCustomer.value) {
    ElMessage.warning('请选择客户，或手动输入客户资料后再提交订单');
    return;
  }

  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const customerId = await resolveOrderCustomerId();
    const order = await appleOrdersApi.create({
      customerId,
      sourcePlatformId: form.sourcePlatformId || null,
      externalOrderNo: form.externalOrderNo || null,
      serviceId: form.serviceId,
      appleAccountId: form.appleAccountId || null,
      serviceAccount: form.serviceAccount || null,
      currentPlan: form.currentPlan || null,
      targetPlan: form.targetPlan || null,
      startTime: form.startTime || null,
      expireTime: form.expireTime || null,
      paidAmount: form.paidAmount,
      platformFee: form.platformFee || undefined,
      refundLoss: form.refundLoss || '0',
      appleCostValue: form.appleCostValue,
      remark: form.remark || null
    });
    ElMessage.success(`订单已创建：${order.orderNo}`);
    resetOrderForm();
    availableAccounts.value = [];
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交订单失败');
  } finally {
    saving.value = false;
  }
}

async function resolveOrderCustomerId() {
  if (form.customerId) {
    return form.customerId;
  }

  if (!newCustomerDraft.value) {
    throw new Error('请先选择客户或新增客户资料');
  }

  const createdCustomer = await customersApi.create(newCustomerDraft.value);
  customers.value = mergeCustomerItems([createdCustomer], customers.value);
  form.customerId = createdCustomer.id;
  newCustomerDraft.value = null;

  return createdCustomer.id;
}

function resetOrderForm() {
  form.customerId = '';
  form.sourcePlatformId = '';
  form.externalOrderNo = '';
  form.serviceId = '';
  form.appleAccountId = '';
  form.serviceAccount = '';
  form.currentPlan = '';
  form.targetPlan = '';
  form.startTime = getCurrentDateTimeValue();
  form.expireTime = '';
  form.paidAmount = '';
  form.platformFee = '0.00';
  form.refundLoss = '0';
  form.appleCostValue = '';
  form.remark = '';
  selectedAccount.value = null;
  newCustomerDraft.value = null;
  resetCustomerProfileForm(newCustomerForm);
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(ORDER_ENTRY_REALTIME_SCOPES, () => {
  void loadInitialData({ silent: true, dedupeMs: 0 });
});

onMounted(() => loadInitialData({ force: true, dedupeMs: 0 }));

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});
</script>

<style scoped>
.order-entry-select-empty {
  display: flex;
  min-width: 260px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.order-entry-customer-picker {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.order-entry-customer-picker__create {
  white-space: nowrap;
}

.order-entry-customer-option {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-entry-customer-option strong,
.order-entry-customer-option span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-entry-customer-option span {
  color: #64748b;
  font-size: 12px;
}

.order-entry-customer-draft {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
}

.order-entry-customer-draft span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .order-entry-customer-picker {
    grid-template-columns: 1fr;
  }

  .order-entry-customer-picker__create {
    width: 100%;
  }
}
</style>
