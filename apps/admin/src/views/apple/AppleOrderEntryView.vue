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
      <el-form
        ref="formRef"
        class="v3-entry-form"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <div class="form-grid form-grid--three">
          <el-form-item prop="customerId" required>
            <template #label>
              <FieldHelpLabel
                label="客户"
                purpose="这笔订单属于哪个客户，后面查续费、利润、售后都会关联到他。"
                example="老客户可以搜客户名、微信或手机号尾号；找不到就点手动输入。"
              />
            </template>
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
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="来源平台"
                purpose="记录订单从哪里来，并按平台设置自动计算手续费。"
                example="闲鱼来的订单选闲鱼，淘宝来的订单选淘宝，私下收款可以留空或选对应自建平台。"
              />
            </template>
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

          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="平台订单号"
                purpose="保存外部平台的订单编号，方便以后对账、查售后和回看聊天记录。"
                example="淘宝填淘宝订单号，闲鱼填闲鱼订单号；没有平台单号可以先留空。"
              />
            </template>
            <el-input v-model.trim="form.externalOrderNo" />
          </el-form-item>
          <el-form-item prop="serviceId">
            <template #label>
              <FieldHelpLabel
                label="开通业务"
                purpose="选择客户这次要开的具体服务，系统会按业务配置带出售价、周期和 Apple 消耗金额。"
                example="客户买 gpt pro 1 个月，就选对应的 gpt pro 月费业务。"
              />
            </template>
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

          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="客户网站账号"
                purpose="记录客户在目标网站或 App 里的账号，方便开通、续费和售后定位。"
                example="ChatGPT 业务可以填客户登录邮箱；如果业务不需要客户账号可留空。"
              />
            </template>
            <el-input v-model.trim="form.serviceAccount" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="当前套餐"
                purpose="记录客户开通前或当前正在用的套餐，方便判断是新开、续费还是升级。"
                example="客户现在是 Free 就填 Free；已经是 Plus 月费就填 Plus 月费。"
              />
            </template>
            <el-input v-model.trim="form.currentPlan" />
          </el-form-item>

          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="开通时间"
                purpose="记录服务从什么时候开始算，用来生成开通记录和续费提醒。"
                example="现在马上开通就用默认当前时间；补录旧订单就改成实际开通时间。"
              />
            </template>
            <el-date-picker
              v-model="form.startTime"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
            />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="到期时间"
                purpose="记录服务什么时候结束，后续续费任务和到期提醒会看这个时间。"
                example="普通月费可留空让系统按业务周期计算；特殊天数订单就手动选择实际到期时间。"
              />
            </template>
            <el-date-picker
              v-model="form.expireTime"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
              placeholder="留空按业务周期计算"
            />
          </el-form-item>

          <el-form-item prop="paidAmount">
            <template #label>
              <FieldHelpLabel
                label="客户实收"
                purpose="客户这单实际付给你的金额，是计算订单利润的收入部分。"
                example="客户转了 20 元就填 20，不要填 Apple 官方扣的美元金额。"
              />
            </template>
            <el-input v-model.trim="form.paidAmount" @change="syncDerivedOrderAmounts" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="平台手续费"
                purpose="平台从这单里扣掉的钱，系统按来源平台的费率和固定费用自动算。"
                example="闲鱼设置了 1% 手续费，客户实收 20，系统会自动带出约 0.20。"
              />
            </template>
            <el-input v-model.trim="form.platformFee" disabled placeholder="按来源平台自动计算" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="退款/补发损耗"
                purpose="记录这单额外亏掉的钱，比如补发、退款差额或人工承担的损失。"
                example="没有损耗填 0；给客户补了 3 元成本就填 3。"
              />
            </template>
            <el-input v-model.trim="form.refundLoss" />
          </el-form-item>

          <el-form-item prop="appleCostValue">
            <template #label>
              <FieldHelpLabel
                label="Apple 消耗金额"
                purpose="这单预计会扣多少 Apple ID 外币余额，后端会用它乘以当前平均成本算成本。"
                example="业务官方消耗是 20 USD，这里自动带出 20。"
              />
            </template>
            <el-input
              v-model.trim="form.appleCostValue"
              disabled
              placeholder="按业务官方消耗自动带出"
            />
          </el-form-item>
          <el-form-item prop="appleAccountId">
            <template #label>
              <FieldHelpLabel
                label="已选 Apple ID"
                purpose="这单最终使用哪个 Apple ID 扣余额和生成开通记录。"
                example="自动匹配出可用账号后点选择，这里会显示已选账号和余额。"
              />
            </template>
            <el-input :model-value="selectedAccountLabel" disabled />
          </el-form-item>
        </div>

        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="写给自己或同事看的补充说明，不参与金额计算。"
              example="可以写客户特殊要求、聊天重点、人工处理原因。"
            />
          </template>
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
import { appleMatchingApi, appleOrdersApi, customersApi, dataCenterApi } from '@/api/system';
import type { DataDictionaryQuery, SaveCustomerPayload } from '@/api/system';
import CustomerProfileForm from '@/components/business/CustomerProfileForm.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { buildQuickSettingCode, CUSTOMER_TAG_DICTIONARY_GROUP } from '@/config/quickSettings';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { CustomerProfileFormModel } from '@/types/customerProfileForm';
import type {
  AppleService,
  AvailableAppleAccount,
  Customer,
  DataDictionary,
  PageResult,
  SourcePlatform
} from '@/types/system';
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
  'data-dictionaries',
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
const customerTagDictionaries = ref<DataDictionary[]>([]);
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
  ...new Set([
    ...customerTagDictionaries.value
      .filter((tag) => tag.status === 'active')
      .map((tag) => tag.label),
    ...customers.value.flatMap((customer) => customer.tags)
  ])
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

function buildCustomerTagParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 200,
    group: CUSTOMER_TAG_DICTIONARY_GROUP,
    status: 'active',
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function applyCustomerTagResult(data: PageResult<DataDictionary>) {
  customerTagDictionaries.value = data.items;
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
    ),
    dataCenterApi.listDictionaries(buildCustomerTagParams())
  ]);
}

function applyOrderEntryBaseData(data: Awaited<ReturnType<typeof loadOrderEntryBaseData>>) {
  const [customerData, platformData, serviceData, customerTagData] = data;
  customers.value = mergeCustomerItems(
    customerData.items,
    selectedCustomer.value ? [selectedCustomer.value] : []
  );
  sourcePlatforms.value = platformData.items;
  services.value = serviceData.items;
  applyCustomerTagResult(customerTagData);
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

  const customerPayload = newCustomerDraft.value;
  await ensureCustomerTagsRegistered(customerPayload.tags ?? []);
  const createdCustomer = await customersApi.create(customerPayload);
  customers.value = mergeCustomerItems([createdCustomer], customers.value);
  form.customerId = createdCustomer.id;
  newCustomerDraft.value = null;

  return createdCustomer.id;
}

async function ensureCustomerTagsRegistered(tags: string[]) {
  const existingLabels = new Set(customerTagDictionaries.value.map((tag) => tag.label.trim()));
  const missingTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].filter(
    (tag) => !existingLabels.has(tag)
  );

  if (!missingTags.length) {
    return;
  }

  const createdTags = await Promise.all(
    missingTags.map((tag, index) =>
      dataCenterApi.createDictionary({
        group: CUSTOMER_TAG_DICTIONARY_GROUP,
        code: buildQuickSettingCode(tag, 'tag'),
        label: tag,
        value: tag,
        sortOrder: customerTagDictionaries.value.length + index + 1,
        status: 'active',
        remark: '从订单录入新增客户时自动保存'
      })
    )
  );

  customerTagDictionaries.value = [...customerTagDictionaries.value, ...createdTags];
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
