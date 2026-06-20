<template>
  <PageScaffold
    title="Apple ID 订单录入"
    group="Apple ID 业务"
    phase="Phase 4"
    description="录入客户订单，按业务规则自动匹配 Apple ID，提交后自动生成开通记录、扣减余额并计算利润。"
  >
    <template #actions>
      <AppButton @click="() => loadInitialData()">刷新基础数据</AppButton>
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
          <el-form-item label="客户" prop="customerId">
            <el-select v-model="form.customerId" class="full-input" filterable>
              <el-option
                v-for="customer in customers"
                :key="customer.id"
                :label="customer.name"
                :value="customer.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="来源平台">
            <el-select v-model="form.sourcePlatformId" class="full-input" clearable filterable>
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
              @change="handleServiceChange"
            >
              <el-option
                v-for="service in services"
                :key="service.id"
                :label="`${service.name} · ${service.officialCostValue} ${service.currency}`"
                :value="service.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="客户网站账号">
            <el-input v-model.trim="form.serviceAccount" />
          </el-form-item>
          <el-form-item label="当前套餐">
            <el-input v-model.trim="form.currentPlan" />
          </el-form-item>
          <el-form-item label="目标套餐">
            <el-input v-model.trim="form.targetPlan" />
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
            <el-input v-model.trim="form.paidAmount" />
          </el-form-item>
          <el-form-item label="平台手续费">
            <el-input v-model.trim="form.platformFee" placeholder="留空按来源平台费率计算" />
          </el-form-item>
          <el-form-item label="退款/补发损耗">
            <el-input v-model.trim="form.refundLoss" />
          </el-form-item>

          <el-form-item label="Apple 消耗金额" prop="appleCostValue">
            <el-input v-model.trim="form.appleCostValue" @change="loadAvailableAccounts" />
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
                  : '点击匹配后从可用账号中选择，系统会保留不可用原因供核对。'
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
            @keyup.enter="loadAvailableAccounts"
          />
          <AppButton @click="loadAvailableAccounts">匹配</AppButton>
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
              <span>请先选择 Apple ID 业务，确认消耗金额后点击匹配。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="loadAvailableAccounts">重新匹配</AppButton>
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
          <el-table-column prop="avgUnitCost" label="均价" width="100" />
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
                <strong>{{ account.avgUnitCost }}</strong>
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
            <span>请先选择 Apple ID 业务，确认消耗金额后点击匹配。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="loadAvailableAccounts">重新匹配</AppButton>
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
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { appleMatchingApi, appleOrdersApi, appleServicesApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { AppleService, AvailableAppleAccount, Customer, SourcePlatform } from '@/types/system';
import { createSmartQueryKey, refreshSmartQuery } from '@/utils/smartQuery';
import { loadSmartCustomers, loadSmartSourcePlatforms } from '@/utils/smartSystemQueries';

const ORDER_ENTRY_BASE_SCOPE = 'order-entry-base';
const ORDER_ENTRY_REALTIME_SCOPES = ['customers', 'source-platforms', 'apple-services'];
const loading = ref(false);
const saving = ref(false);
const matchingLoading = ref(false);
const formRef = ref<FormInstance>();
const customers = ref<Customer[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const services = ref<AppleService[]>([]);
const availableAccounts = ref<AvailableAppleAccount[]>([]);
const selectedAccount = ref<AvailableAppleAccount | null>(null);
const matchKeyword = ref('');

const form = reactive({
  customerId: '',
  sourcePlatformId: '',
  externalOrderNo: '',
  serviceId: '',
  appleAccountId: '',
  serviceAccount: '',
  currentPlan: '',
  targetPlan: '',
  startTime: '',
  expireTime: '',
  paidAmount: '',
  platformFee: '',
  refundLoss: '0',
  appleCostValue: '',
  remark: ''
});

const rules: FormRules<typeof form> = {
  customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
  serviceId: [{ required: true, message: '请选择业务', trigger: 'change' }],
  paidAmount: [{ required: true, message: '请输入客户实收', trigger: 'blur' }],
  appleCostValue: [{ required: true, message: '请输入 Apple 消耗金额', trigger: 'blur' }],
  appleAccountId: [{ required: true, message: '请选择可用 Apple ID', trigger: 'change' }]
};

const selectedService = computed(
  () => services.value.find((service) => service.id === form.serviceId) ?? null
);
const selectedAccountLabel = computed(() =>
  selectedAccount.value
    ? `${selectedAccount.value.accountMasked} / ${selectedAccount.value.balance} ${selectedAccount.value.currency}`
    : '未选择'
);
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
    description: form.customerId ? '客户已选择' : '选择客户和来源平台',
    status: form.customerId ? ('done' as const) : ('active' as const)
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
      form.customerId &&
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

async function loadInitialData(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  if (!options.silent || !customers.value.length) {
    loading.value = true;
  }
  try {
    const result = await refreshSmartQuery({
      key: createSmartQueryKey(ORDER_ENTRY_BASE_SCOPE),
      fetcher: () =>
        Promise.all([
          loadSmartCustomers(
            { page: 1, pageSize: 100, status: 'active' },
            { force: options.force ?? true, dedupeMs: options.dedupeMs }
          ),
          loadSmartSourcePlatforms(
            { page: 1, pageSize: 100, status: 'active' },
            { force: options.force ?? true, dedupeMs: options.dedupeMs }
          ),
          appleServicesApi.list({ page: 1, pageSize: 100, status: 'enabled' })
        ]),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    const [customerData, platformData, serviceData] = result.data;
    customers.value = customerData.items;
    sourcePlatforms.value = platformData.items;
    services.value = serviceData.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载订单基础数据失败');
  } finally {
    loading.value = false;
  }
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
  form.targetPlan = form.targetPlan || service.name;
  await loadAvailableAccounts();
}

async function loadAvailableAccounts() {
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
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const order = await appleOrdersApi.create({
      customerId: form.customerId,
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

function resetOrderForm() {
  form.customerId = '';
  form.sourcePlatformId = '';
  form.externalOrderNo = '';
  form.serviceId = '';
  form.appleAccountId = '';
  form.serviceAccount = '';
  form.currentPlan = '';
  form.targetPlan = '';
  form.startTime = '';
  form.expireTime = '';
  form.paidAmount = '';
  form.platformFee = '';
  form.refundLoss = '0';
  form.appleCostValue = '';
  form.remark = '';
  selectedAccount.value = null;
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(ORDER_ENTRY_REALTIME_SCOPES, () => {
  void loadInitialData({ silent: true, dedupeMs: 0 });
});

onMounted(() => loadInitialData({ force: false }));

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});
</script>
