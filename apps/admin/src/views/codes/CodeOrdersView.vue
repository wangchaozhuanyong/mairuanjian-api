<template>
  <PageScaffold
    title="兑换码订单"
    group="兑换码自动发货"
    phase="Phase 6"
    description="处理手工订单导入、平台映射识别、锁定未售兑换码和生成半自动发货内容。"
  >
    <section class="content-panel code-compact-list-panel">
      <div class="panel-title-row">
        <div>
          <h3>
            兑换码发货队列
            <FeatureHelp
              placement="right"
              text="这里处理买家下单后的发货。先匹配业务，再锁住兑换码，最后生成内容并确认发货。"
            />
          </h3>
          <p>处理平台识别、兑换码锁定、半自动发货和失败重试，防止重复发货和库存误消耗。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 单</StatusChip>
          <StatusChip :tone="pendingCount > 0 ? 'orange' : 'green'">
            待发货 {{ pendingCount }}
          </StatusChip>
          <StatusChip tone="green">已锁码 {{ lockedCount }}</StatusChip>
          <StatusChip tone="cyan">已发货 {{ deliveredCount }}</StatusChip>
          <StatusChip :tone="failedCount > 0 ? 'red' : 'green'" dot>
            {{ failedCount > 0 ? `失败 ${failedCount}` : '发货稳定' }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.deliveryStatus"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="orderColumnOptions"
        :status-options="deliveryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedOrders.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="手工导入订单"
        placeholder="搜索订单号、买家、商品、SKU、业务"
        @search="handleSearch"
        @refresh="() => reloadAll()"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.platformId"
            class="table-toolbar__select"
            clearable
            placeholder="平台"
            @change="handleSearch"
          >
            <el-option
              v-for="platform in platforms"
              :key="platform.id"
              :label="platform.name"
              :value="platform.id"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="orders"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无兑换码订单</strong>
            <span>可以手工导入订单，或清空筛选后重新查看发货队列。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">手工导入订单</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('order')"
          prop="externalOrderNo"
          label="订单"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.externalOrderNo }}
            <div class="muted-block">{{ row.platform.name }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('item')" label="商品/SKU" min-width="220">
          <template #header>
            <span class="help-label">
              商品/SKU
              <FeatureHelp text="买家在平台拍下的商品信息。系统会拿它去判断应该发哪种兑换码。" />
            </span>
          </template>
          <template #default="{ row }">
            {{ row.itemTitle || row.itemId }}
            <div class="muted-block">SKU {{ row.skuName || row.skuId || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="匹配业务" min-width="170">
          <template #header>
            <span class="help-label">
              匹配业务
              <FeatureHelp
                text="系统判断这单应该发哪种面值、哪类兑换码。没匹配上就不能放心自动发。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <span v-if="row.service">{{ row.service.name }}</span>
            <StatusChip v-else tone="orange" dot>未匹配</StatusChip>
            <div class="muted-block">面值 {{ row.faceValue || '-' }} × {{ row.quantity }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('amounts')"
          prop="paidAmount"
          label="金额"
          width="150"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              金额
              <FeatureHelp text="实收是买家付的钱；利润是扣掉兑换码成本和相关费用后剩下的钱。" />
            </span>
          </template>
          <template #default="{ row }">
            实收 {{ row.paidAmount }}
            <div class="muted-block">利润 {{ row.profitAmount }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('locked')" label="锁码" width="100">
          <template #header>
            <span class="help-label">
              锁码
              <FeatureHelp
                text="已经给这单预留了几张兑换码。锁住后，别的订单就不会再拿走这些码。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="row.lockedCodeCount ? 'green' : 'neutral'" dot>
              {{ row.lockedCodeCount }}/{{ row.quantity }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('deliveryStatus')"
          prop="deliveryStatus"
          label="发货状态"
          width="110"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              发货状态
              <FeatureHelp text="看这单现在是待发、已发、失败还是需要人工处理。" />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="getDeliveryStatusTone(row.deliveryStatus)" dot>
              {{ getDeliveryStatusLabel(row.deliveryStatus) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('createdAt')"
          prop="createdAt"
          label="创建时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton variant="soft" @click="matchCode(row)">匹配锁码</AppButton>
              <AppButton variant="ghost" @click="openGenerate(row)">生成发货</AppButton>
              <AppButton
                variant="success"
                :disabled="row.deliveryStatus === 'delivered'"
                @click="openDeliver(row)"
              >
                确认发货
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="orders.length" class="mobile-record-list">
        <article v-for="order in orders" :key="order.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ order.externalOrderNo }}</strong>
              <span>{{ order.platform.name }} · {{ order.itemTitle || order.itemId }}</span>
            </div>
            <StatusChip :tone="getDeliveryStatusTone(order.deliveryStatus)" dot>
              {{ getDeliveryStatusLabel(order.deliveryStatus) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>实收</span>
              <strong>{{ order.paidAmount }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ order.profitAmount }}</strong>
            </div>
            <div>
              <span>锁码</span>
              <strong>{{ order.lockedCodeCount }}/{{ order.quantity }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>匹配业务</span>
              <strong>{{ order.service?.name || '未匹配' }}</strong>
            </div>
            <div>
              <span>面值/数量</span>
              <strong>{{ order.faceValue || '-' }} × {{ order.quantity }}</strong>
            </div>
            <div>
              <span>创建时间</span>
              <strong>{{ formatDate(order.createdAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(order)">详情</AppButton>
            <AppButton size="small" variant="soft" @click="matchCode(order)">匹配锁码</AppButton>
            <AppButton size="small" variant="ghost" @click="openGenerate(order)">
              生成发货
            </AppButton>
            <AppButton
              size="small"
              variant="success"
              :disabled="order.deliveryStatus === 'delivered'"
              @click="openDeliver(order)"
            >
              确认发货
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无兑换码订单</strong>
          <span>可以手工导入订单，或清空筛选后重新查看发货队列。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">手工导入订单</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadOrders()"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      title="手工导入兑换码订单"
      width="min(760px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item label="平台" prop="platformId">
            <el-select v-model="form.platformId" class="full-input" filterable>
              <el-option
                v-for="platform in platforms"
                :key="platform.id"
                :label="platform.name"
                :value="platform.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="平台订单号" prop="externalOrderNo">
            <el-input v-model.trim="form.externalOrderNo" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="商品 ID" prop="itemId">
            <el-input v-model.trim="form.itemId" />
          </el-form-item>
          <el-form-item label="SKU ID">
            <el-input v-model.trim="form.skuId" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="商品标题">
            <el-input v-model.trim="form.itemTitle" />
          </el-form-item>
          <el-form-item label="SKU 名称">
            <el-input v-model.trim="form.skuName" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="兑换码业务">
            <el-select v-model="form.serviceId" class="full-input" clearable filterable>
              <el-option
                v-for="service in services"
                :key="service.id"
                :label="`${service.name} · ${service.faceValue}`"
                :value="service.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="面值">
            <el-input v-model.trim="form.faceValue" placeholder="留空使用映射或业务面值" />
          </el-form-item>
          <el-form-item label="数量">
            <el-input-number v-model="form.quantity" :min="1" class="full-input" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="实付金额">
            <el-input v-model.trim="form.paidAmount" />
          </el-form-item>
          <el-form-item label="平台手续费">
            <el-input v-model.trim="form.platformFee" />
          </el-form-item>
          <el-form-item label="买家脱敏">
            <el-input v-model.trim="form.buyerNameMasked" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveOrder">保存</AppButton>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="detailVisible"
      :title="`兑换码订单 · ${selectedOrder?.externalOrderNo ?? ''}`"
    >
      <div class="drawer-section">
        <div class="drawer-section__title">订单信息</div>
        <el-descriptions v-if="selectedOrder" class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="平台">{{
            selectedOrder.platform.name
          }}</el-descriptions-item>
          <el-descriptions-item label="商品">{{
            selectedOrder.itemTitle || selectedOrder.itemId
          }}</el-descriptions-item>
          <el-descriptions-item label="业务">{{
            selectedOrder.service?.name || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="面值/数量">
            {{ selectedOrder.faceValue || '-' }} × {{ selectedOrder.quantity }}
          </el-descriptions-item>
          <el-descriptions-item label="锁定兑换码">
            <StatusChip
              v-for="code in selectedOrder.lockedCodes"
              :key="code.id"
              class="tag-gap"
              tone="purple"
            >
              尾号 {{ code.codeTail }}
            </StatusChip>
            <span v-if="!selectedOrder.lockedCodes.length">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="成本/利润">
            {{ selectedOrder.costAmount }} / {{ selectedOrder.profitAmount }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">发货记录</div>
        <el-table class="desktop-data-table" :data="deliveryLogs" size="small">
          <el-table-column label="尾号" width="90">
            <template #default="{ row }">尾号 {{ row.code.codeTail }}</template>
          </el-table-column>
          <el-table-column label="方式" width="100">
            <template #default="{ row }">{{ getDeliveryMethodLabel(row.deliveryMethod) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <StatusChip :tone="row.deliveryStatus === 'success' ? 'green' : 'red'" dot>
                {{ row.deliveryStatus === 'success' ? '成功' : '失败' }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="利润" width="90" prop="profit" />
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="deliveryLogs.length" class="mobile-record-list" aria-label="发货记录移动列表">
          <article v-for="log in deliveryLogs" :key="log.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>尾号 {{ log.code.codeTail }}</strong>
                <span
                  >{{ getDeliveryMethodLabel(log.deliveryMethod) }} ·
                  {{ formatDate(log.createdAt) }}</span
                >
              </div>
              <StatusChip :tone="log.deliveryStatus === 'success' ? 'green' : 'red'" dot>
                {{ log.deliveryStatus === 'success' ? '成功' : '失败' }}
              </StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>利润</span>
                <strong>{{ log.profit }}</strong>
              </div>
              <div>
                <span>发货方式</span>
                <strong>{{ getDeliveryMethodLabel(log.deliveryMethod) }}</strong>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="mobile-record-list">
          <div class="apple-core-empty-state">
            <strong>暂无发货记录</strong>
            <span>生成或补发兑换码后会在这里显示发货明细。</span>
          </div>
        </div>
      </div>
    </AppDrawer>

    <el-dialog
      v-model="generateDialogVisible"
      title="生成发货内容"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form
        ref="generateFormRef"
        :model="generateForm"
        :rules="generateRules"
        label-position="top"
      >
        <el-form-item label="订单">
          <el-input :model-value="selectedOrder?.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="生成原因" prop="reason">
          <el-input
            v-model.trim="generateForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如：手工复制发货给客户"
          />
        </el-form-item>
        <el-form-item v-if="generateForm.content" label="发货内容">
          <el-input v-model="generateForm.content" type="textarea" :rows="7" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="generateDialogVisible = false">关闭</AppButton>
        <AppButton variant="primary" :loading="generating" @click="generateDelivery">
          生成
        </AppButton>
        <AppButton
          variant="success"
          :disabled="!generateForm.content"
          :loading="delivering"
          @click="confirmDeliveryFromGenerated"
        >
          确认发货
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="deliverDialogVisible"
      title="确认兑换码发货"
      width="min(640px, calc(100vw - 24px))"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">防重复</StatusChip>
        <div>
          <strong>确认后会把锁定兑换码标记为已发货</strong>
          <p>系统会写入发货日志；同一订单不能重复发货，提交前请核对发货内容。</p>
        </div>
      </div>
      <el-form ref="deliverFormRef" :model="deliverForm" :rules="deliverRules" label-position="top">
        <el-form-item label="订单">
          <el-input :model-value="selectedOrder?.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="发货方式">
          <el-select v-model="deliverForm.deliveryMethod" class="full-input">
            <el-option label="手工发货" value="manual" />
            <el-option label="电子凭证" value="eticket" />
            <el-option label="虚拟无需物流" value="dummy_send" />
            <el-option label="消息卡片" value="message_card" />
          </el-select>
        </el-form-item>
        <el-form-item label="发货内容快照" prop="deliveryContent">
          <el-input
            v-model="deliverForm.deliveryContent"
            type="textarea"
            :rows="7"
            placeholder="请先生成发货内容，或粘贴实际发给客户的内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="deliverDialogVisible = false">取消</AppButton>
        <AppButton variant="success" :loading="delivering" @click="confirmDelivery">
          确认发货
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { codeOrdersApi, codeServicesApi, userTableViewsApi } from '@/api/system';
import type { CodeOrderQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  CodeDeliveryLog,
  CodePlatformOrder,
  CodeService,
  PageResult,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import { loadSmartSourcePlatforms } from '@/utils/smartSystemQueries';

const tableKey = 'code_orders';
const deliveryStatusOptions = [
  { label: '待发货', value: 'pending' },
  { label: '已发货', value: 'delivered' },
  { label: '失败', value: 'failed' },
  { label: '人工处理', value: 'manual' }
];
const orderColumnOptions = [
  { label: '订单', value: 'order', required: true },
  { label: '商品/SKU', value: 'item' },
  { label: '匹配业务', value: 'service' },
  { label: '金额', value: 'amounts' },
  { label: '锁码', value: 'locked' },
  { label: '发货状态', value: 'deliveryStatus' },
  { label: '创建时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const generating = ref(false);
const delivering = ref(false);
const dialogVisible = ref(false);
const detailVisible = ref(false);
const generateDialogVisible = ref(false);
const deliverDialogVisible = ref(false);
const orders = ref<CodePlatformOrder[]>([]);
const deliveryLogs = ref<CodeDeliveryLog[]>([]);
const platforms = ref<SourcePlatform[]>([]);
const services = ref<CodeService[]>([]);
const selectedOrder = ref<CodePlatformOrder | null>(null);
const selectedOrders = ref<CodePlatformOrder[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const generatedOrderId = ref('');
const total = ref(0);
const formRef = ref<FormInstance>();
const generateFormRef = ref<FormInstance>();
const deliverFormRef = ref<FormInstance>();
const activeOrdersQueryKey = ref('');
const activeDependenciesQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  platformId: '',
  deliveryStatus: ''
});

const form = reactive({
  platformId: '',
  externalOrderNo: '',
  buyerId: '',
  buyerNameMasked: '',
  itemId: '',
  skuId: '',
  itemTitle: '',
  skuName: '',
  serviceId: '',
  faceValue: '',
  quantity: 1,
  paidAmount: '0',
  platformFee: '0'
});

const generateForm = reactive({
  reason: '',
  content: ''
});

const deliverForm = reactive({
  deliveryMethod: 'manual' as CodeDeliveryLog['deliveryMethod'],
  deliveryContent: ''
});

const rules: FormRules<typeof form> = {
  platformId: [{ required: true, message: '请选择平台', trigger: 'change' }],
  externalOrderNo: [{ required: true, message: '请输入平台订单号', trigger: 'blur' }],
  itemId: [{ required: true, message: '请输入商品 ID', trigger: 'blur' }]
};

const generateRules: FormRules<typeof generateForm> = {
  reason: [{ required: true, message: '请输入生成原因', trigger: 'blur' }]
};

const deliverRules: FormRules<typeof deliverForm> = {
  deliveryContent: [{ required: true, message: '请输入发货内容快照', trigger: 'blur' }]
};

const pendingCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'pending').length
);
const lockedCount = computed(
  () => orders.value.filter((order) => order.lockedCodeCount > 0).length
);
const failedCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'failed').length
);
const deliveredCount = computed(
  () => orders.value.filter((order) => order.deliveryStatus === 'delivered').length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const platformLabel = platforms.value.find((platform) => platform.id === query.platformId)?.name;
  if (query.platformId && platformLabel) {
    chips.push({ key: 'platformId', label: '平台', value: platformLabel });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getDeliveryStatusLabel(status: CodePlatformOrder['deliveryStatus']) {
  const labels: Record<CodePlatformOrder['deliveryStatus'], string> = {
    pending: '待发货',
    delivered: '已发货',
    failed: '失败',
    manual: '人工'
  };
  return labels[status];
}

function getDeliveryStatusTone(status: CodePlatformOrder['deliveryStatus']) {
  if (status === 'pending') {
    return 'orange';
  }
  if (status === 'delivered') {
    return 'green';
  }
  if (status === 'failed') {
    return 'red';
  }
  return 'neutral';
}

function getDeliveryMethodLabel(method: CodeDeliveryLog['deliveryMethod']) {
  const labels: Record<CodeDeliveryLog['deliveryMethod'], string> = {
    eticket: '电子凭证',
    dummy_send: '无需物流',
    message_card: '消息卡片',
    manual: '手工'
  };
  return labels[method];
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function applyDependenciesResult(data: {
  platforms: PageResult<SourcePlatform>;
  services: PageResult<CodeService>;
}) {
  platforms.value = data.platforms.items;
  services.value = data.services.items;
}

async function loadDependencies(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('code-order-dependencies');
  const cached = getSmartQueryData<{
    platforms: PageResult<SourcePlatform>;
    services: PageResult<CodeService>;
  }>(key);

  activeDependenciesQueryKey.value = key;

  if (cached) {
    applyDependenciesResult(cached);
  }

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: async () => {
        const [platformData, serviceData] = await Promise.all([
          loadSmartSourcePlatforms({
            page: 1,
            pageSize: 100,
            status: 'active'
          }, options),
          codeServicesApi.list({
            page: 1,
            pageSize: 100,
            status: 'enabled'
          })
        ]);

        return {
          platforms: platformData,
          services: serviceData
        };
      },
      force: options.force ?? true
    });

    if (activeDependenciesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyDependenciesResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单依赖失败');
    }
  }
}

function buildOrderParams(): CodeOrderQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    platformId: query.platformId || undefined,
    deliveryStatus: query.deliveryStatus || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyOrderResult(data: PageResult<CodePlatformOrder>) {
  orders.value = data.items;
  total.value = data.total;
}

async function loadOrders(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildOrderParams();
  const key = createSmartQueryKey('code-orders', params);
  const cached = getSmartQueryData<PageResult<CodePlatformOrder>>(key);

  activeOrdersQueryKey.value = key;

  if (cached) {
    applyOrderResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => codeOrdersApi.list(params),
      force: options.force ?? true
    });

    if (activeOrdersQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyOrderResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单失败');
    }
  } finally {
    if (activeOrdersQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadOrders();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadOrders();
}

function handleSelectionChange(rows: CodePlatformOrder[]) {
  selectedOrders.value = rows;
}

async function reloadAll(options: { background?: boolean; force?: boolean } = {}) {
  try {
    await Promise.all([
      loadDependencies(options),
      loadOrders(options),
      selectedOrder.value && detailVisible.value
        ? loadDeliveryLogs(selectedOrder.value.id)
        : Promise.resolve()
    ]);
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '刷新兑换码订单失败');
    }
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.platformId = '';
  query.deliveryStatus = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'platformId') {
    query.platformId = '';
  }
}

function exportList() {
  ElMessage.info('兑换码订单导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存兑换码订单视图', {
      inputValue: '兑换码订单常用视图',
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
        platformId: query.platformId,
        deliveryStatus: query.deliveryStatus
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : orderColumnOptions.map((column) => column.value),
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
  await loadOrders();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.platformId = typeof filters.platformId === 'string' ? filters.platformId : '';
  query.deliveryStatus = typeof filters.deliveryStatus === 'string' ? filters.deliveryStatus : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) => orderColumnOptions.some((option) => option.value === column))
    : orderColumnOptions.map((column) => column.value);
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

function mapSortProp(prop?: string) {
  if (prop === 'externalOrderNo') return 'externalOrderNo';
  if (prop === 'paidAmount') return 'paidAmount';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function openCreate() {
  form.platformId = platforms.value[0]?.id ?? '';
  form.externalOrderNo = '';
  form.buyerId = '';
  form.buyerNameMasked = '';
  form.itemId = '';
  form.skuId = '';
  form.itemTitle = '';
  form.skuName = '';
  form.serviceId = '';
  form.faceValue = '';
  form.quantity = 1;
  form.paidAmount = '0';
  form.platformFee = '0';
  dialogVisible.value = true;
}

async function openDetail(order: CodePlatformOrder) {
  selectedOrder.value = order;
  await loadDeliveryLogs(order.id);
  detailVisible.value = true;
}

async function loadDeliveryLogs(orderId: string) {
  try {
    const data = await codeOrdersApi.listOrderDeliveryLogs(orderId);
    deliveryLogs.value = data.items;
  } catch (error) {
    deliveryLogs.value = [];
    ElMessage.error(error instanceof Error ? error.message : '加载发货记录失败');
  }
}

async function saveOrder() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    await codeOrdersApi.createManual({
      platformId: form.platformId,
      externalOrderNo: form.externalOrderNo,
      buyerId: form.buyerId || null,
      buyerNameMasked: form.buyerNameMasked || null,
      itemId: form.itemId,
      skuId: form.skuId || null,
      itemTitle: form.itemTitle || null,
      skuName: form.skuName || null,
      serviceId: form.serviceId || null,
      faceValue: form.faceValue || null,
      quantity: form.quantity,
      paidAmount: form.paidAmount,
      platformFee: form.platformFee
    });
    ElMessage.success('手工订单已导入');
    dialogVisible.value = false;
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入手工订单失败');
  } finally {
    saving.value = false;
  }
}

async function matchCode(order: CodePlatformOrder) {
  try {
    await codeOrdersApi.matchCode(order.id);
    ElMessage.success('已匹配并锁定兑换码');
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '匹配锁码失败');
  }
}

function openGenerate(order: CodePlatformOrder) {
  selectedOrder.value = order;
  generatedOrderId.value = order.id;
  generateForm.reason = '';
  generateForm.content = '';
  generateDialogVisible.value = true;
}

function openDeliver(order: CodePlatformOrder) {
  selectedOrder.value = order;
  deliverForm.deliveryMethod = 'manual';
  deliverForm.deliveryContent =
    generatedOrderId.value === order.id && generateForm.content ? generateForm.content : '';
  deliverDialogVisible.value = true;
}

async function generateDelivery() {
  const valid = await generateFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedOrder.value) {
    return;
  }

  generating.value = true;
  try {
    const data = await codeOrdersApi.generateDeliveryContent(selectedOrder.value.id, {
      reason: generateForm.reason
    });
    generatedOrderId.value = selectedOrder.value.id;
    generateForm.content = data.deliveryContent;
    deliverForm.deliveryContent = data.deliveryContent;
    ElMessage.success('发货内容已生成并写入审计日志');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成发货内容失败');
  } finally {
    generating.value = false;
  }
}

async function confirmDeliveryFromGenerated() {
  if (!selectedOrder.value || !generateForm.content) {
    return;
  }

  deliverForm.deliveryMethod = 'manual';
  deliverForm.deliveryContent = generateForm.content;
  await confirmDelivery();
}

async function confirmDelivery() {
  const valid = deliverDialogVisible.value
    ? await deliverFormRef.value?.validate().catch(() => false)
    : Boolean(deliverForm.deliveryContent.trim());
  if (!valid || !selectedOrder.value) {
    ElMessage.warning('请先填写发货内容快照');
    return;
  }

  try {
    await ElMessageBox.confirm(
      '确认后该订单会变为已发货，锁定兑换码也会变为已发货，不能重复发货。',
      '确认发货',
      {
        confirmButtonText: '确认发货',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch {
    return;
  }

  delivering.value = true;
  try {
    const data = await codeOrdersApi.confirmDelivery(selectedOrder.value.id, {
      deliveryMethod: deliverForm.deliveryMethod,
      deliveryContent: deliverForm.deliveryContent
    });
    ElMessage.success('已确认发货并写入发货日志');
    selectedOrder.value = data;
    deliverDialogVisible.value = false;
    generateDialogVisible.value = false;
    await Promise.all([loadOrders(), loadDeliveryLogs(data.id)]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '确认发货失败');
  } finally {
    delivering.value = false;
  }
}

async function initializePage() {
  try {
    await Promise.all([loadDependencies({ force: false }), loadTableViews(true)]);
    await loadOrders({ force: false });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单失败');
  }
}

onMounted(initializePage);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['code-orders', 'code-services', 'code-order-dependencies'],
  () => {
    void reloadAll({
      background:
        orders.value.length > 0 || platforms.value.length > 0 || services.value.length > 0,
      force: true
    });
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.code-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.code-compact-list-panel .inline-actions {
  max-width: min(620px, 100%);
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (max-width: 840px) {
  .code-compact-list-panel .inline-actions {
    justify-content: flex-start;
  }
}
</style>
