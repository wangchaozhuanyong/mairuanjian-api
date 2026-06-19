<template>
  <PageScaffold
    title="客户详情"
    group="系统管理"
    phase="Phase 2"
    description="聚合客户基础资料、来源平台、Apple ID 订单、开通记录和续费任务。"
  >
    <template #actions>
      <el-tag :type="customer?.status === 'active' ? 'success' : 'info'" effect="light">
        {{ customer ? getCustomerStatusLabel(customer.status) : '待选择客户' }}
      </el-tag>
      <el-button @click="goBack">返回客户列表</el-button>
      <el-button :disabled="!customerId" :loading="loading" @click="loadDetail">刷新</el-button>
    </template>

    <section v-if="!customerId" class="content-panel">
      <el-empty description="请先从客户管理列表进入详情页">
        <el-button type="primary" @click="goBack">去选择客户</el-button>
      </el-empty>
    </section>

    <section v-else-if="loadError" class="content-panel">
      <el-result icon="error" title="加载失败" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" @click="loadDetail">重新加载</el-button>
          <el-button @click="goBack">返回客户列表</el-button>
        </template>
      </el-result>
    </section>

    <section v-else-if="loading && !customer" class="content-panel">
      <el-skeleton :rows="8" animated />
    </section>

    <template v-else-if="customer">
      <div class="metric-grid metric-grid--four">
        <MetricCard label="Apple ID 订单" :value="orderTotal" hint="最近订单统计" tone="blue" />
        <MetricCard
          label="开通记录"
          :value="activationTotal"
          hint="当前客户关联业务"
          tone="green"
        />
        <MetricCard label="续费任务" :value="taskTotal" hint="待办与历史任务" tone="orange" />
        <MetricCard
          label="客户状态"
          :value="getCustomerStatusLabel(customer.status)"
          hint="客户基础资料状态"
          :tone="customer.status === 'active' ? 'purple' : 'red'"
        />
      </div>

      <section class="content-panel">
        <div class="panel-title-row">
          <div>
            <h3>{{ customer.name }}</h3>
            <p>
              {{ customer.contactName || '未填写联系人' }} ·
              {{ customer.maskedPhone || '未填写手机号' }}
            </p>
          </div>
          <div class="inline-actions">
            <el-tag type="info" effect="light">{{
              customer.sourcePlatform?.name ?? '无来源平台'
            }}</el-tag>
            <el-tag :type="customer.status === 'active' ? 'success' : 'info'" effect="light">
              {{ getCustomerStatusLabel(customer.status) }}
            </el-tag>
          </div>
        </div>

        <div class="drawer-detail-grid">
          <div>
            <span>客户名称</span>
            <strong>{{ customer.name }}</strong>
          </div>
          <div>
            <span>联系人</span>
            <strong>{{ customer.contactName || '-' }}</strong>
          </div>
          <div>
            <span>手机号</span>
            <strong>{{ customer.maskedPhone || '-' }}</strong>
          </div>
          <div>
            <span>微信</span>
            <strong>{{ customer.wechat || '-' }}</strong>
          </div>
          <div>
            <span>来源平台</span>
            <strong>{{ customer.sourcePlatform?.name ?? '-' }}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{{ formatDate(customer.updatedAt) }}</strong>
          </div>
        </div>

        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="标签">
            <el-tag v-for="tag in customer.tags" :key="tag" class="tag-gap" size="small">
              {{ tag }}
            </el-tag>
            <span v-if="!customer.tags.length">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ customer.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </section>

      <section v-loading="relatedLoading" class="content-panel">
        <div class="panel-title-row">
          <div>
            <h3>关联业务数据</h3>
            <p>展示最近记录，完整处理仍在对应业务模块完成。</p>
          </div>
          <el-tag type="success" effect="light">真实接口</el-tag>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane :label="`Apple ID 订单 ${orderTotal}`" name="orders">
            <el-table :data="orders" row-key="id" empty-text="暂无 Apple ID 订单">
              <el-table-column prop="orderNo" label="订单号" min-width="150" />
              <el-table-column label="业务" min-width="160">
                <template #default="{ row }">{{ row.service?.name ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="Apple ID" min-width="160">
                <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
              </el-table-column>
              <el-table-column prop="paidAmount" label="实收" width="100" />
              <el-table-column prop="profitAmount" label="利润" width="100" />
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag size="small" effect="light">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`开通记录 ${activationTotal}`" name="activations">
            <el-table :data="activations" row-key="id" empty-text="暂无开通记录">
              <el-table-column label="业务" min-width="160">
                <template #default="{ row }">{{ row.service?.name ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="Apple ID" min-width="160">
                <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="到期时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.expireTime) }}</template>
              </el-table-column>
              <el-table-column prop="profitAmount" label="利润" width="100" />
              <el-table-column label="续费决定" width="140">
                <template #default="{ row }">{{ row.renewalDecision }}</template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <el-tag size="small" effect="light">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane :label="`续费任务 ${taskTotal}`" name="tasks">
            <el-table :data="tasks" row-key="id" empty-text="暂无续费任务">
              <el-table-column prop="title" label="任务" min-width="220" show-overflow-tooltip />
              <el-table-column label="业务" min-width="150">
                <template #default="{ row }">{{ row.service?.name ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="优先级" width="100">
                <template #default="{ row }">
                  <el-tag size="small" effect="light">{{ row.priority }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <el-tag size="small" effect="light">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="截止时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.dueAt) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="兑换码订单" name="code-orders">
            <el-empty description="兑换码订单按客户聚合接口待接入" />
          </el-tab-pane>

          <el-tab-pane label="客服工单" name="tickets">
            <el-empty description="客服工单模块为后期增强模块" />
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  appleActivationsApi,
  appleOrdersApi,
  appleRenewalTasksApi,
  customersApi
} from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import type { AppleOrder, Customer, RenewalTask, ServiceActivation } from '@/types/system';

const route = useRoute();
const router = useRouter();
const customerId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));

const loading = ref(false);
const relatedLoading = ref(false);
const loadError = ref('');
const customer = ref<Customer | null>(null);
const orders = ref<AppleOrder[]>([]);
const activations = ref<ServiceActivation[]>([]);
const tasks = ref<RenewalTask[]>([]);
const orderTotal = ref(0);
const activationTotal = ref(0);
const taskTotal = ref(0);
const activeTab = ref('orders');

function getCustomerStatusLabel(status: Customer['status']) {
  return status === 'active' ? '启用' : '停用';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function goBack() {
  router.push('/system/customers');
}

async function loadDetail() {
  if (!customerId.value) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  try {
    customer.value = await customersApi.get(customerId.value);
    await loadRelatedData(customerId.value);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载客户详情失败';
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
}

async function loadRelatedData(id: string) {
  relatedLoading.value = true;
  try {
    const [orderData, activationData, taskData] = await Promise.all([
      appleOrdersApi.list({ page: 1, pageSize: 8, customerId: id }),
      appleActivationsApi.list({ page: 1, pageSize: 8, customerId: id }),
      appleRenewalTasksApi.list({ page: 1, pageSize: 8, customerId: id })
    ]);

    orders.value = orderData.items;
    activations.value = activationData.items;
    tasks.value = taskData.items;
    orderTotal.value = orderData.total;
    activationTotal.value = activationData.total;
    taskTotal.value = taskData.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载客户关联数据失败');
  } finally {
    relatedLoading.value = false;
  }
}

onMounted(loadDetail);
</script>
