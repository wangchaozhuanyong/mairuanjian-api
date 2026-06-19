<template>
  <PageScaffold
    title="Apple ID 详情"
    group="Apple ID 业务"
    phase="Phase 3"
    description="聚合单个 Apple ID 的余额成本、充值消费、订单、开通记录、续费任务和操作计划。"
  >
    <template #actions>
      <el-tag :type="account ? getAccountStatusType(account.status) : 'info'" effect="light">
        {{ account ? getAccountStatusLabel(account.status) : '待选择账号' }}
      </el-tag>
      <el-button @click="goBack">返回列表</el-button>
      <el-button :disabled="!accountId" :loading="accountLoading" @click="loadDetail">
        刷新
      </el-button>
    </template>

    <section v-if="!accountId" class="content-panel">
      <el-empty description="请先从 Apple ID 管理列表进入详情页">
        <el-button type="primary" @click="goBack">去选择 Apple ID</el-button>
      </el-empty>
    </section>

    <section v-else-if="loadError" class="content-panel">
      <el-result icon="error" title="加载失败" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" @click="loadDetail">重新加载</el-button>
          <el-button @click="goBack">返回列表</el-button>
        </template>
      </el-result>
    </section>

    <section v-else-if="accountLoading && !account" class="content-panel">
      <el-skeleton :rows="8" animated />
    </section>

    <template v-else-if="account">
      <div class="metric-grid metric-grid--four">
        <MetricCard
          label="当前余额"
          :value="account.currentBalance"
          :hint="`${account.region} / ${account.currency}`"
          tone="green"
        />
        <MetricCard
          label="余额成本"
          :value="account.balanceCostAmount"
          hint="人民币成本余额"
          tone="orange"
        />
        <MetricCard
          label="移动平均成本"
          :value="account.averageCost"
          hint="后续消费按该均价扣减成本"
          tone="blue"
        />
        <MetricCard
          label="关联业务"
          :value="activationTotal"
          hint="当前账号下的开通记录"
          :tone="account.isManuallyLocked ? 'red' : 'purple'"
        />
      </div>

      <section class="content-panel">
        <div class="panel-title-row">
          <div>
            <h3>{{ account.appleIdMasked }}</h3>
            <p>尾号 {{ account.appleIdTail }} · {{ account.region }} · {{ account.currency }}</p>
          </div>
          <div class="inline-actions">
            <el-tag :type="getAccountStatusType(account.status)" effect="light">
              {{ getAccountStatusLabel(account.status) }}
            </el-tag>
            <el-tag :type="account.isManuallyLocked ? 'danger' : 'success'" effect="light">
              {{ account.isManuallyLocked ? '手动锁定' : '未锁定' }}
            </el-tag>
          </div>
        </div>

        <div class="drawer-detail-grid">
          <div>
            <span>Apple ID</span>
            <strong>{{ account.appleIdMasked }}</strong>
          </div>
          <div>
            <span>当前余额</span>
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
          <div>
            <span>锁定原因</span>
            <strong>{{ account.manualLockReason || '-' }}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{{ formatDate(account.updatedAt) }}</strong>
          </div>
        </div>

        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="敏感资料状态">
            <el-tag v-if="account.hasPassword" class="tag-gap" size="small">密码</el-tag>
            <el-tag v-if="account.hasSecurityInfo" class="tag-gap" size="small">密保</el-tag>
            <el-tag v-if="account.hasPhone" class="tag-gap" size="small">手机</el-tag>
            <el-tag v-if="account.hasRecoveryEmail" class="tag-gap" size="small"> 备用邮箱 </el-tag>
            <span
              v-if="
                !account.hasPassword &&
                !account.hasSecurityInfo &&
                !account.hasPhone &&
                !account.hasRecoveryEmail
              "
            >
              -
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ account.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section v-loading="relatedLoading" class="content-panel">
        <div class="panel-title-row">
          <div>
            <h3>关联业务数据</h3>
            <p>展示最近记录，完整处理仍在各业务模块完成。</p>
          </div>
          <el-tag type="success" effect="light">真实接口</el-tag>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane :label="`充值记录 ${topupTotal}`" name="topups">
            <el-table :data="topups" row-key="id">
              <el-table-column prop="faceValue" label="面值" width="100" />
              <el-table-column prop="costAmount" label="成本" width="100" />
              <el-table-column prop="balanceAfter" label="充值后余额" width="130" />
              <el-table-column prop="avgCostAfter" label="充值后均价" width="130" />
              <el-table-column label="礼品卡代码" width="150">
                <template #default="{ row }">
                  <el-tag v-if="row.hasGiftCardCode" size="small" effect="light">
                    尾号 {{ row.giftCardCodeTail ?? '-' }}
                  </el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="160">
                <template #default="{ row }">{{ row.remark || '-' }}</template>
              </el-table-column>
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`消费记录 ${consumptionTotal}`" name="consumptions">
            <el-table :data="consumptions" row-key="id">
              <el-table-column prop="amount" label="消费金额" width="110" />
              <el-table-column prop="costAmount" label="扣减成本" width="110" />
              <el-table-column prop="avgUnitCost" label="消费均价" width="120" />
              <el-table-column prop="balanceAfter" label="消费后余额" width="130" />
              <el-table-column label="原因" min-width="160">
                <template #default="{ row }">{{ row.reason || '-' }}</template>
              </el-table-column>
              <el-table-column label="关联对象" min-width="160">
                <template #default="{ row }">
                  {{ row.relatedObjectType || '-' }}
                  <div v-if="row.relatedObjectId" class="muted-block">
                    {{ row.relatedObjectId }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`余额修正 ${adjustmentTotal}`" name="adjustments">
            <el-table :data="adjustments" row-key="id">
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
              <el-table-column label="修正方式" width="130">
                <template #default="{ row }">
                  {{ getCostAdjustMethodLabel(row.costAdjustMethod) }}
                </template>
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
          </el-tab-pane>

          <el-tab-pane :label="`状态检测 ${statusCheckTotal}`" name="statusChecks">
            <el-table :data="statusChecks" row-key="id">
              <el-table-column label="检测类型" width="110">
                <template #default="{ row }">{{ getCheckTypeLabel(row.checkType) }}</template>
              </el-table-column>
              <el-table-column label="结果状态" width="120">
                <template #default="{ row }">
                  <el-tag
                    :type="getAccountStatusType(row.resultStatus)"
                    size="small"
                    effect="light"
                  >
                    {{ getAccountStatusLabel(row.resultStatus) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="余额快照" width="120">
                <template #default="{ row }">{{ row.balanceSnapshot ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="备注" min-width="200">
                <template #default="{ row }">{{ row.remark || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作人" width="120">
                <template #default="{ row }">{{ row.operator?.displayName ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`订单 ${orderTotal}`" name="orders">
            <el-table :data="orders" row-key="id">
              <el-table-column label="订单" min-width="170">
                <template #default="{ row }">
                  <strong>{{ row.orderNo }}</strong>
                  <div class="muted-block">{{ row.externalOrderNo || '无外部订单号' }}</div>
                </template>
              </el-table-column>
              <el-table-column label="客户/业务" min-width="180">
                <template #default="{ row }">
                  {{ row.customer.name }}
                  <div class="muted-block">{{ row.service.name }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="paidAmount" label="实收" width="100" />
              <el-table-column prop="appleCostRmb" label="成本" width="100" />
              <el-table-column prop="profitAmount" label="利润" width="100" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag :type="getOrderStatusType(row.status)" size="small" effect="light">
                    {{ getOrderStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="创建时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`开通记录 ${activationTotal}`" name="activations">
            <el-table :data="activations" row-key="id">
              <el-table-column label="客户/业务" min-width="190">
                <template #default="{ row }">
                  {{ row.customer.name }}
                  <div class="muted-block">{{ row.service.name }}</div>
                </template>
              </el-table-column>
              <el-table-column label="计划" min-width="160">
                <template #default="{ row }">
                  {{ row.currentPlan || '-' }}
                  <div class="muted-block">目标 {{ row.targetPlan || '-' }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="consumedValue" label="消耗" width="100" />
              <el-table-column prop="profitAmount" label="利润" width="100" />
              <el-table-column label="到期时间" min-width="170">
                <template #default="{ row }">
                  {{ formatDate(row.expireTime) }}
                  <div class="muted-block">剩余 {{ row.daysUntilExpire ?? '-' }} 天</div>
                </template>
              </el-table-column>
              <el-table-column label="续费决定" width="130">
                <template #default="{ row }">
                  {{ getRenewalDecisionLabel(row.renewalDecision) }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag :type="getActivationStatusType(row.status)" size="small" effect="light">
                    {{ getActivationStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`续费任务 ${renewalTaskTotal}`" name="renewalTasks">
            <el-table :data="renewalTasks" row-key="id">
              <el-table-column label="任务" min-width="220">
                <template #default="{ row }">
                  <strong>{{ row.title }}</strong>
                  <div class="muted-block">{{ row.requiredAction || '-' }}</div>
                </template>
              </el-table-column>
              <el-table-column label="客户/业务" min-width="180">
                <template #default="{ row }">
                  {{ row.customer.name }}
                  <div class="muted-block">{{ row.service.name }}</div>
                </template>
              </el-table-column>
              <el-table-column label="优先级" width="110">
                <template #default="{ row }">
                  <el-tag :type="getPriorityType(row.priority)" size="small" effect="light">
                    {{ getPriorityLabel(row.priority) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="客户决定" width="150">
                <template #default="{ row }">
                  {{ getCustomerDecisionLabel(row.customerDecision) }}
                </template>
              </el-table-column>
              <el-table-column label="截止时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.dueAt) }}</template>
              </el-table-column>
              <el-table-column label="状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="getTaskStatusType(row.status)" size="small" effect="light">
                    {{ getTaskStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`操作计划 ${actionPlanTotal}`" name="actionPlans">
            <el-table :data="actionPlans" row-key="id">
              <el-table-column label="计划日期" min-width="140">
                <template #default="{ row }">{{ formatDate(row.planDate, true) }}</template>
              </el-table-column>
              <el-table-column label="业务分布" min-width="190">
                <template #default="{ row }">
                  开通 {{ row.activeServiceCount }} · 续费 {{ row.renewServicesCount }} · 取消
                  {{ row.cancelServicesCount }}
                  <div class="muted-block">等客户 {{ row.pendingCustomerCount }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="requiredRenewalAmount" label="预计续费" width="120" />
              <el-table-column prop="suggestedTopupAmount" label="建议充值" width="120" />
              <el-table-column label="风险" width="110">
                <template #default="{ row }">
                  <el-tag
                    :type="row.hasWrongChargeRisk ? 'danger' : 'success'"
                    size="small"
                    effect="light"
                  >
                    {{ row.hasWrongChargeRisk ? '有风险' : '正常' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag :type="getPlanStatusType(row.status)" size="small" effect="light">
                    {{ getPlanStatusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  appleAccountsApi,
  appleActionPlansApi,
  appleActivationsApi,
  appleOrdersApi,
  appleRenewalTasksApi
} from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import type {
  AppleAccount,
  AppleAccountStatusCheck,
  AppleActionPlan,
  AppleBalanceAdjustment,
  AppleBalanceConsumption,
  AppleBalanceTopup,
  AppleOrder,
  RenewalTask,
  ServiceActivation
} from '@/types/system';

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary';

const route = useRoute();
const router = useRouter();
const account = ref<AppleAccount | null>(null);
const accountLoading = ref(false);
const relatedLoading = ref(false);
const loadError = ref('');
const activeTab = ref('topups');
const topups = ref<AppleBalanceTopup[]>([]);
const consumptions = ref<AppleBalanceConsumption[]>([]);
const adjustments = ref<AppleBalanceAdjustment[]>([]);
const statusChecks = ref<AppleAccountStatusCheck[]>([]);
const orders = ref<AppleOrder[]>([]);
const activations = ref<ServiceActivation[]>([]);
const renewalTasks = ref<RenewalTask[]>([]);
const actionPlans = ref<AppleActionPlan[]>([]);
const topupTotal = ref(0);
const consumptionTotal = ref(0);
const adjustmentTotal = ref(0);
const statusCheckTotal = ref(0);
const orderTotal = ref(0);
const activationTotal = ref(0);
const renewalTaskTotal = ref(0);
const actionPlanTotal = ref(0);

const accountId = computed(() => normalizeRouteId(route.query.id));

const accountStatusOptions: Record<
  AppleAccount['status'],
  {
    label: string;
    type: TagType;
  }
> = {
  normal: { label: '正常', type: 'success' },
  need_verify: { label: '需要验证', type: 'warning' },
  locked: { label: '已锁定', type: 'danger' },
  password_error: { label: '密码错误', type: 'danger' },
  risk: { label: '风险', type: 'warning' },
  unknown: { label: '未知', type: 'info' }
};

const orderStatusOptions: Record<
  AppleOrder['status'],
  {
    label: string;
    type: TagType;
  }
> = {
  pending: { label: '待处理', type: 'warning' },
  active: { label: '已开通', type: 'success' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
  abnormal: { label: '异常', type: 'danger' }
};

const activationStatusOptions: Record<
  ServiceActivation['status'],
  {
    label: string;
    type: TagType;
  }
> = {
  active: { label: '生效中', type: 'success' },
  expired: { label: '已到期', type: 'warning' },
  cancelled: { label: '已取消', type: 'info' },
  abnormal: { label: '异常', type: 'danger' }
};

const taskStatusOptions: Record<
  RenewalTask['status'],
  {
    label: string;
    type: TagType;
  }
> = {
  pending: { label: '待处理', type: 'warning' },
  processing: { label: '处理中', type: 'primary' },
  waiting_customer: { label: '等客户', type: 'warning' },
  waiting_payment: { label: '等收款', type: 'warning' },
  waiting_auto_renewal: { label: '等自动续费', type: 'primary' },
  waiting_manual_verify: { label: '等人工验证', type: 'warning' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
  failed: { label: '失败', type: 'danger' },
  abnormal: { label: '异常', type: 'danger' },
  postponed: { label: '已延期', type: 'info' }
};

const priorityOptions: Record<
  RenewalTask['priority'],
  {
    label: string;
    type: TagType;
  }
> = {
  low: { label: '低', type: 'info' },
  medium: { label: '中', type: 'primary' },
  high: { label: '高', type: 'warning' },
  urgent: { label: '紧急', type: 'danger' }
};

const planStatusOptions: Record<
  AppleActionPlan['status'],
  {
    label: string;
    type: TagType;
  }
> = {
  pending: { label: '待处理', type: 'warning' },
  processing: { label: '处理中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  abnormal: { label: '异常', type: 'danger' }
};

const renewalDecisionLabels: Record<ServiceActivation['renewalDecision'], string> = {
  unconfirmed: '未确认',
  renew: '续费',
  no_renew: '不续费',
  change_plan: '改套餐'
};

const customerDecisionLabels: Record<RenewalTask['customerDecision'], string> = {
  not_contacted: '未联系',
  contacted_waiting_reply: '已联系待回复',
  confirmed_renewal: '确认续费',
  confirmed_no_renewal: '确认不续费',
  change_plan: '改套餐',
  considering: '考虑中',
  paid: '已付款',
  unpaid: '未付款',
  cancelled: '已取消',
  renewed_success: '续费成功',
  abnormal: '异常'
};

const costAdjustMethodLabels: Record<AppleBalanceAdjustment['costAdjustMethod'], string> = {
  none: '只修余额',
  current_avg: '按当前均价',
  manual: '手动成本'
};

const checkTypeLabels: Record<AppleAccountStatusCheck['checkType'], string> = {
  manual: '人工检测',
  automation: '自动检测'
};

watch(
  accountId,
  () => {
    loadDetail();
  },
  {
    immediate: true
  }
);

function normalizeRouteId(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : '';
  }

  return value ? String(value) : '';
}

function resetRelatedData() {
  topups.value = [];
  consumptions.value = [];
  adjustments.value = [];
  statusChecks.value = [];
  orders.value = [];
  activations.value = [];
  renewalTasks.value = [];
  actionPlans.value = [];
  topupTotal.value = 0;
  consumptionTotal.value = 0;
  adjustmentTotal.value = 0;
  statusCheckTotal.value = 0;
  orderTotal.value = 0;
  activationTotal.value = 0;
  renewalTaskTotal.value = 0;
  actionPlanTotal.value = 0;
}

async function loadDetail() {
  loadError.value = '';
  resetRelatedData();

  if (!accountId.value) {
    account.value = null;
    return;
  }

  accountLoading.value = true;
  try {
    account.value = await appleAccountsApi.get(accountId.value);
    await loadRelatedData(accountId.value);
  } catch (error) {
    account.value = null;
    loadError.value = error instanceof Error ? error.message : '加载 Apple ID 详情失败';
    ElMessage.error(loadError.value);
  } finally {
    accountLoading.value = false;
  }
}

async function loadRelatedData(id: string) {
  relatedLoading.value = true;
  try {
    const [
      topupData,
      consumptionData,
      adjustmentData,
      statusCheckData,
      orderData,
      activationData,
      renewalTaskData,
      actionPlanData
    ] = await Promise.all([
      appleAccountsApi.listTopups(id, { page: 1, pageSize: 8 }),
      appleAccountsApi.listConsumptions(id, { page: 1, pageSize: 8 }),
      appleAccountsApi.listBalanceAdjustments(id, { page: 1, pageSize: 8 }),
      appleAccountsApi.listStatusChecks(id, { page: 1, pageSize: 8 }),
      appleOrdersApi.list({ page: 1, pageSize: 8, appleAccountId: id }),
      appleActivationsApi.list({ page: 1, pageSize: 8, appleAccountId: id }),
      appleRenewalTasksApi.list({ page: 1, pageSize: 8, appleAccountId: id }),
      appleActionPlansApi.list({ page: 1, pageSize: 8, appleAccountId: id })
    ]);

    topups.value = topupData.items;
    consumptions.value = consumptionData.items;
    adjustments.value = adjustmentData.items;
    statusChecks.value = statusCheckData.items;
    orders.value = orderData.items;
    activations.value = activationData.items;
    renewalTasks.value = renewalTaskData.items;
    actionPlans.value = actionPlanData.items;
    topupTotal.value = topupData.total;
    consumptionTotal.value = consumptionData.total;
    adjustmentTotal.value = adjustmentData.total;
    statusCheckTotal.value = statusCheckData.total;
    orderTotal.value = orderData.total;
    activationTotal.value = activationData.total;
    renewalTaskTotal.value = renewalTaskData.total;
    actionPlanTotal.value = actionPlanData.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载关联业务数据失败');
  } finally {
    relatedLoading.value = false;
  }
}

function goBack() {
  router.push('/apple/accounts');
}

function formatDate(value?: string | null, dateOnly = false) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return dateOnly ? date.toLocaleDateString('zh-CN') : date.toLocaleString('zh-CN');
}

function getAccountStatusLabel(status: AppleAccount['status']) {
  return accountStatusOptions[status]?.label ?? status;
}

function getAccountStatusType(status: AppleAccount['status']) {
  return accountStatusOptions[status]?.type ?? 'info';
}

function getOrderStatusLabel(status: AppleOrder['status']) {
  return orderStatusOptions[status]?.label ?? status;
}

function getOrderStatusType(status: AppleOrder['status']) {
  return orderStatusOptions[status]?.type ?? 'info';
}

function getActivationStatusLabel(status: ServiceActivation['status']) {
  return activationStatusOptions[status]?.label ?? status;
}

function getActivationStatusType(status: ServiceActivation['status']) {
  return activationStatusOptions[status]?.type ?? 'info';
}

function getTaskStatusLabel(status: RenewalTask['status']) {
  return taskStatusOptions[status]?.label ?? status;
}

function getTaskStatusType(status: RenewalTask['status']) {
  return taskStatusOptions[status]?.type ?? 'info';
}

function getPriorityLabel(priority: RenewalTask['priority']) {
  return priorityOptions[priority]?.label ?? priority;
}

function getPriorityType(priority: RenewalTask['priority']) {
  return priorityOptions[priority]?.type ?? 'info';
}

function getPlanStatusLabel(status: AppleActionPlan['status']) {
  return planStatusOptions[status]?.label ?? status;
}

function getPlanStatusType(status: AppleActionPlan['status']) {
  return planStatusOptions[status]?.type ?? 'info';
}

function getRenewalDecisionLabel(decision: ServiceActivation['renewalDecision']) {
  return renewalDecisionLabels[decision] ?? decision;
}

function getCustomerDecisionLabel(decision: RenewalTask['customerDecision']) {
  return customerDecisionLabels[decision] ?? decision;
}

function getCostAdjustMethodLabel(method: AppleBalanceAdjustment['costAdjustMethod']) {
  return costAdjustMethodLabels[method] ?? method;
}

function getCheckTypeLabel(checkType: AppleAccountStatusCheck['checkType']) {
  return checkTypeLabels[checkType] ?? checkType;
}
</script>
