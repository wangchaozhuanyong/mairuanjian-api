<template>
  <PageScaffold
    title="Apple ID 订单录入"
    group="Apple ID 业务"
    phase="Phase 4"
    description="录入客户订单，按业务规则自动匹配 Apple ID，提交后自动生成开通记录、扣减余额并计算利润。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
      <el-button @click="loadInitialData">刷新基础数据</el-button>
      <el-button type="primary" :loading="saving" @click="submitOrder">提交订单</el-button>
    </template>

    <div class="split-page">
      <section class="content-panel">
        <div class="section-title">
          <h3>订单信息</h3>
          <span>先选业务，再选择匹配结果里的 Apple ID。</span>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <div class="form-grid">
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
          </div>

          <div class="form-grid">
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
          </div>

          <div class="form-grid">
            <el-form-item label="客户网站账号">
              <el-input v-model.trim="form.serviceAccount" />
            </el-form-item>
            <el-form-item label="当前套餐">
              <el-input v-model.trim="form.currentPlan" />
            </el-form-item>
            <el-form-item label="目标套餐">
              <el-input v-model.trim="form.targetPlan" />
            </el-form-item>
          </div>

          <div class="form-grid">
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
          </div>

          <div class="form-grid">
            <el-form-item label="客户实收" prop="paidAmount">
              <el-input v-model.trim="form.paidAmount" />
            </el-form-item>
            <el-form-item label="平台手续费">
              <el-input v-model.trim="form.platformFee" placeholder="留空按来源平台费率计算" />
            </el-form-item>
            <el-form-item label="退款/补发损耗">
              <el-input v-model.trim="form.refundLoss" />
            </el-form-item>
          </div>

          <div class="form-grid">
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
        </el-form>
      </section>

      <section class="content-panel">
        <div class="section-title">
          <h3>Apple ID 自动匹配</h3>
          <span>可用账号会按余额优先展示；不可用账号给出原因。</span>
        </div>

        <div class="toolbar">
          <el-input
            v-model="matchKeyword"
            class="toolbar-search"
            placeholder="搜索 Apple ID、地区、币种、备注"
            clearable
            @keyup.enter="loadAvailableAccounts"
          />
          <el-button @click="loadAvailableAccounts">匹配</el-button>
        </div>

        <el-table
          v-loading="matchingLoading"
          :data="availableAccounts"
          row-key="appleAccountId"
          size="small"
        >
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
              <el-tag :type="getAvailabilityType(row.availability)" size="small" effect="light">
                {{ getAvailabilityLabel(row.availability) }}
              </el-tag>
              <span class="muted-inline">{{ row.reason ?? '' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button
                text
                type="primary"
                :disabled="row.availability !== 'available'"
                @click="selectAccount(row)"
              >
                选择
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  appleMatchingApi,
  appleOrdersApi,
  appleServicesApi,
  customersApi,
  sourcePlatformsApi
} from '@/api/system';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import type { AppleService, AvailableAppleAccount, Customer, SourcePlatform } from '@/types/system';

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

async function loadInitialData() {
  loading.value = true;
  try {
    const [customerData, platformData, serviceData] = await Promise.all([
      customersApi.list({ page: 1, pageSize: 100, status: 'active' }),
      sourcePlatformsApi.list({ page: 1, pageSize: 100, status: 'active' }),
      appleServicesApi.list({ page: 1, pageSize: 100, status: 'enabled' })
    ]);
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

function getAvailabilityType(value: AvailableAppleAccount['availability']) {
  return value === 'available' ? 'success' : value === 'need_confirm' ? 'warning' : 'danger';
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

onMounted(loadInitialData);
</script>
