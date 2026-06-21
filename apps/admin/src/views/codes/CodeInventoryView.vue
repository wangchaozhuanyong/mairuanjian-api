<template>
  <PageScaffold
    title="兑换码库存"
    group="兑换码自动发货"
    phase="Phase 6"
    description="管理兑换码批次、尾号、面值、成本和库存状态。完整兑换码已加密保存，列表只显示尾号。"
  >
    <section class="content-panel code-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="兑换码库存池"
          :help="[
            '这里放所有导入进来的兑换码。平时只看尾号和状态，完整码需要有权限并填写查看原因。',
            '可以按批次、业务、面值、成本和发货状态管理库存。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 条库存</StatusChip>
          <StatusChip tone="green">未售 {{ unsoldCount }}</StatusChip>
          <StatusChip :tone="lockedCount > 0 ? 'orange' : 'green'" dot>
            {{ lockedCount > 0 ? `锁定 ${lockedCount}` : '无锁定' }}
          </StatusChip>
          <StatusChip tone="purple">已发货 {{ deliveredCount }}</StatusChip>
          <StatusChip :tone="failedInventoryCount > 0 ? 'red' : 'green'">
            {{ failedInventoryCount > 0 ? `失败 ${failedInventoryCount}` : '库存正常' }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="inventoryColumnOptions"
        :status-options="inventoryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedCodes.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="批量导入兑换码"
        placeholder="搜索尾号、批次、业务、备注"
        @search="handleSearch"
        @refresh="reloadAll"
        @primary="openImport"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.serviceId"
            class="table-toolbar__select"
            clearable
            placeholder="业务"
            @change="handleSearch"
          >
            <el-option
              v-for="service in services"
              :key="service.id"
              :label="`${service.name} · ${service.faceValue}`"
              :value="service.id"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="inventory"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无兑换码库存</strong>
            <span>可以批量导入兑换码，或清空筛选后重新查看库存池。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="openImport">批量导入兑换码</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('codeTail')"
          prop="codeTail"
          label="兑换码尾号"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              兑换码尾号
              <FeatureHelp
                text="只显示最后几位，方便你核对是哪张码，同时避免完整兑换码被误复制或泄露。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip tone="purple">尾号 {{ row.codeTail }}</StatusChip>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('service')" label="业务" min-width="180">
          <template #default="{ row }">
            {{ row.service.name }}
            <div class="muted-block">面值 {{ row.faceValue }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('cost')"
          prop="cost"
          label="成本"
          width="110"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              成本
              <FeatureHelp text="这张兑换码买进来花了多少钱。后面算订单利润会扣掉它。" />
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('batch')" label="批次" min-width="170">
          <template #default="{ row }">
            {{ row.batch.batchNo }}
            <div class="muted-block">{{ formatDate(row.batch.createdAt) }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="110"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              状态
              <FeatureHelp
                text="未售表示还能用；锁定表示已经预留给订单；已发货表示已经给买家；失败要人工处理。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('delivery')" label="发货信息" min-width="170">
          <template #header>
            <span class="help-label">
              发货信息
              <FeatureHelp text="显示这张码被哪个订单锁住或已经发给哪个订单，方便追查库存去向。" />
            </span>
          </template>
          <template #default="{ row }">
            <span v-if="row.deliveredOrderId">订单 {{ row.deliveredOrderId }}</span>
            <span v-else-if="row.lockedOrderId">锁定 {{ row.lockedOrderId }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expireAt')"
          prop="expireAt"
          label="有效期"
          min-width="150"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.expireAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('createdAt')"
          prop="createdAt"
          label="入库时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton v-if="canRevealCode" variant="soft" @click="openRevealDialog(row)">
                查看完整码
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="inventory.length" class="mobile-record-list">
        <article v-for="code in inventory" :key="code.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>尾号 {{ code.codeTail }}</strong>
              <span>{{ code.service.name }} · 面值 {{ code.faceValue }}</span>
            </div>
            <StatusChip :tone="getStatusTone(code.status)" dot>
              {{ getStatusLabel(code.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>成本</span>
              <strong>{{ code.cost }}</strong>
            </div>
            <div>
              <span>批次</span>
              <strong>{{ code.batch.batchNo }}</strong>
            </div>
            <div>
              <span>有效期</span>
              <strong>{{ formatDate(code.expireAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>发货信息</span>
              <strong>
                {{
                  code.deliveredOrderId
                    ? `订单 ${code.deliveredOrderId}`
                    : code.lockedOrderId
                      ? `锁定 ${code.lockedOrderId}`
                      : '-'
                }}
              </strong>
            </div>
            <div>
              <span>入库时间</span>
              <strong>{{ formatDate(code.createdAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(code)">详情</AppButton>
            <AppButton
              v-if="canRevealCode"
              size="small"
              variant="soft"
              @click="openRevealDialog(code)"
            >
              查看完整码
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无兑换码库存</strong>
          <span>可以批量导入兑换码，或清空筛选后重新查看库存池。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="openImport">批量导入兑换码</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadInventory"
      />
    </section>

    <el-dialog
      v-model="importDialogVisible"
      title="批量导入兑换码"
      width="min(760px, calc(100vw - 24px))"
    >
      <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-position="top">
        <div class="form-grid">
          <el-form-item prop="serviceId">
            <template #label>
              <FieldHelpLabel
                label="兑换码业务"
                purpose="告诉系统这一批码属于哪种业务和面值，后续订单会按它匹配库存。"
                example="导入 20 USD 礼品卡，就选择对应的 20 USD 兑换码业务。"
              />
            </template>
            <el-select v-model="importForm.serviceId" class="full-input" filterable>
              <el-option
                v-for="service in services"
                :key="service.id"
                :label="`${service.name} · 面值 ${service.faceValue}`"
                :value="service.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="批次号"
                purpose="给这一批导入的兑换码做批次标记，方便以后追踪来源和成本。"
                example="可以填 20260621-US20；不填系统会自动生成。"
              />
            </template>
            <el-input v-model.trim="importForm.batchNo" placeholder="留空自动生成" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="默认成本"
                purpose="这一批每张码的采购成本，用来计算兑换码订单利润。"
                example="这批每张买入 16 元就填 16；留空会用业务设置里的默认成本。"
              />
            </template>
            <el-input v-model.trim="importForm.defaultCost" placeholder="留空使用业务默认成本" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="统一有效期"
                purpose="这一批兑换码共同的过期时间，临期和过期管理会用到。"
                example="供应商说明 2026-12-31 过期就选择这个时间；没有有效期可留空。"
              />
            </template>
            <el-date-picker
              v-model="importForm.expireAt"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
              placeholder="可选"
            />
          </el-form-item>
        </div>
        <el-form-item prop="codesText">
          <template #label>
            <FieldHelpLabel
              label="兑换码内容"
              purpose="粘贴要入库的完整兑换码，系统会加密保存，列表默认只显示尾号。"
              example="一行放一个完整兑换码；不要把多个码写在同一行。"
            />
          </template>
          <el-input
            v-model="importForm.codesText"
            type="textarea"
            :rows="10"
            placeholder="一行一个兑换码。完整内容会加密保存，列表只显示后 4 位。"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这一批码的来源、采购说明或人工注意事项。"
              example="可以写供应商、采购单号、付款批次或特殊售后说明。"
            />
          </template>
          <el-input v-model="importForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <div
        v-if="importResult"
        class="apple-core-alert result-alert"
        :class="importResult.failedCount ? 'apple-core-alert--orange' : 'apple-core-alert--green'"
      >
        <StatusChip :tone="importResult.failedCount ? 'orange' : 'green'">
          {{ importResult.failedCount ? '部分失败' : '导入完成' }}
        </StatusChip>
        <div>
          <strong>
            成功 {{ importResult.successCount }} 条，失败 {{ importResult.failedCount }} 条
          </strong>
          <p>完整兑换码已加密保存，列表只显示后 4 位；失败明细请在下方核对。</p>
        </div>
      </div>
      <el-table
        v-if="importResult?.errors.length"
        class="result-table desktop-data-table"
        :data="importResult.errors"
        max-height="220"
      >
        <el-table-column prop="rowNo" label="行号" width="90" />
        <el-table-column prop="codeTail" label="尾号" width="110" />
        <el-table-column prop="reason" label="失败原因" />
      </el-table>
      <div
        v-if="importResult?.errors.length"
        class="mobile-record-list"
        aria-label="兑换码导入失败移动列表"
      >
        <article v-for="error in importResult.errors" :key="error.rowNo" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>第 {{ error.rowNo }} 行</strong>
              <span>尾号 {{ error.codeTail ?? '-' }}</span>
            </div>
            <StatusChip tone="red">失败</StatusChip>
          </div>
          <div class="mobile-record-card__meta">
            <div>
              <span>失败原因</span>
              <strong>{{ error.reason }}</strong>
            </div>
          </div>
        </article>
      </div>

      <template #footer>
        <AppButton @click="importDialogVisible = false">关闭</AppButton>
        <AppButton variant="primary" :loading="importing" @click="submitImport">
          开始导入
        </AppButton>
      </template>
    </el-dialog>

    <AppDrawer v-model="detailVisible" :title="`兑换码库存 · 尾号 ${selectedCode?.codeTail ?? ''}`">
      <div class="drawer-section">
        <div class="drawer-section__title">库存信息</div>
        <el-descriptions v-if="selectedCode" class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="业务">{{ selectedCode.service.name }}</el-descriptions-item>
          <el-descriptions-item label="批次">{{ selectedCode.batch.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="面值">{{ selectedCode.faceValue }}</el-descriptions-item>
          <el-descriptions-item label="成本">{{ selectedCode.cost }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <StatusChip :tone="getStatusTone(selectedCode.status)" dot>
              {{ getStatusLabel(selectedCode.status) }}
            </StatusChip>
          </el-descriptions-item>
          <el-descriptions-item label="有效期">
            {{ formatDate(selectedCode.expireAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">{{ selectedCode.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </AppDrawer>

    <el-dialog
      v-model="revealDialogVisible"
      title="查看完整兑换码"
      width="min(560px, calc(100vw - 24px))"
      @closed="resetRevealDialog"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">敏感</StatusChip>
        <div>
          <strong>完整兑换码属于敏感信息</strong>
          <p>查看前必须填写原因，系统会写入敏感字段访问审计日志。</p>
        </div>
      </div>
      <el-form
        ref="revealFormRef"
        class="reveal-form"
        :model="revealForm"
        :rules="revealRules"
        label-position="top"
      >
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="库存记录"
              purpose="当前准备查看完整内容的兑换码库存记录，用于确认没有点错。"
              example="查看前核对业务、面值和尾号是否就是客户需要核对的那张码。"
            />
          </template>
          <el-input :model-value="revealRecordLabel" disabled />
        </el-form-item>
        <el-form-item prop="reason">
          <template #label>
            <FieldHelpLabel
              label="查看原因"
              purpose="说明为什么要查看完整兑换码，系统会写入敏感查看审计日志。"
              example="可以填售后核对、人工发货给客户、客户反馈无法兑换。"
            />
          </template>
          <el-input
            v-model.trim="revealForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如：售后核对、人工发货给客户"
          />
        </el-form-item>
        <el-form-item v-if="revealForm.code">
          <template #label>
            <FieldHelpLabel
              label="完整兑换码"
              purpose="展示解密后的完整兑换码，只在有权限并填写原因后显示。"
              example="复制给客户前先核对订单和发货记录，避免发错码。"
            />
          </template>
          <el-input v-model="revealForm.code" type="textarea" :rows="3" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="revealDialogVisible = false">关闭</AppButton>
        <AppButton variant="soft" :loading="revealing" @click="revealCode">查看完整码</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { redeemCodesApi, userTableViewsApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { useAuthStore } from '@/stores/auth';
import type {
  CodeService,
  RedeemCodeImportResult,
  RedeemCodeInventoryItem,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  createSmartQueryKey,
  invalidateSmartQueries,
  refreshSmartQueryResource
} from '@/utils/smartQuery';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { loadSmartCodeServices } from '@/utils/smartSystemQueries';

const tableKey = 'code_inventory';
const inventoryStatusOptions = [
  { label: '未售', value: 'unsold' },
  { label: '锁定中', value: 'locked' },
  { label: '已发货', value: 'delivered' },
  { label: '发货失败', value: 'delivery_failed' },
  { label: '售后中', value: 'after_sale' },
  { label: '已补发', value: 'reissued' },
  { label: '已作废', value: 'voided' },
  { label: '已退款', value: 'refunded' }
];
const inventoryColumnOptions = [
  { label: '兑换码尾号', value: 'codeTail', required: true },
  { label: '业务', value: 'service' },
  { label: '成本', value: 'cost' },
  { label: '批次', value: 'batch' },
  { label: '状态', value: 'status' },
  { label: '发货信息', value: 'delivery' },
  { label: '有效期', value: 'expireAt' },
  { label: '入库时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const authStore = useAuthStore();
const loading = ref(false);
const importing = ref(false);
const revealing = ref(false);
const importDialogVisible = ref(false);
const detailVisible = ref(false);
const revealDialogVisible = ref(false);
const services = ref<CodeService[]>([]);
const inventory = ref<RedeemCodeInventoryItem[]>([]);
const selectedCode = ref<RedeemCodeInventoryItem | null>(null);
const selectedRevealCode = ref<RedeemCodeInventoryItem | null>(null);
const selectedCodes = ref<RedeemCodeInventoryItem[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeInventoryQueryKey = ref('');
const activatedOnce = ref(false);
const importResult = ref<RedeemCodeImportResult | null>(null);
const importFormRef = ref<FormInstance>();
const revealFormRef = ref<FormInstance>();

type CodeInventoryPage = Awaited<ReturnType<typeof redeemCodesApi.listInventory>>;
type CodeInventoryListParams = Parameters<typeof redeemCodesApi.listInventory>[0];

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  serviceId: ''
});

const importForm = reactive({
  serviceId: '',
  batchNo: '',
  defaultCost: '',
  expireAt: '',
  remark: '',
  codesText: ''
});

const revealForm = reactive({
  reason: '',
  code: ''
});

const importRules: FormRules<typeof importForm> = {
  serviceId: [{ required: true, message: '请选择兑换码业务', trigger: 'change' }],
  codesText: [{ required: true, message: '请输入兑换码内容', trigger: 'blur' }]
};

const revealRules: FormRules<typeof revealForm> = {
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const unsoldCount = computed(
  () => inventory.value.filter((item) => item.status === 'unsold').length
);
const lockedCount = computed(
  () => inventory.value.filter((item) => item.status === 'locked').length
);
const deliveredCount = computed(
  () => inventory.value.filter((item) => item.status === 'delivered').length
);
const failedInventoryCount = computed(
  () => inventory.value.filter((item) => item.status === 'delivery_failed').length
);
const canRevealCode = computed(
  () =>
    authStore.user?.roles.includes('admin') ||
    authStore.user?.permissions.includes('code.inventory.view_full')
);
const revealRecordLabel = computed(() => {
  if (!selectedRevealCode.value) {
    return '-';
  }

  return `${selectedRevealCode.value.service.name} · 尾号 ${selectedRevealCode.value.codeTail}`;
});
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const serviceLabel = services.value.find((service) => service.id === query.serviceId)?.name;
  if (query.serviceId && serviceLabel) {
    chips.push({ key: 'serviceId', label: '业务', value: serviceLabel });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getStatusLabel(status: RedeemCodeInventoryItem['status']) {
  const labels: Record<RedeemCodeInventoryItem['status'], string> = {
    unsold: '未售',
    locked: '锁定中',
    delivered: '已发货',
    delivery_failed: '发货失败',
    after_sale: '售后中',
    reissued: '已补发',
    voided: '已作废',
    refunded: '已退款'
  };
  return labels[status];
}

function getStatusTone(status: RedeemCodeInventoryItem['status']) {
  if (status === 'unsold') {
    return 'green';
  }
  if (status === 'locked') {
    return 'orange';
  }
  if (status === 'delivered' || status === 'reissued') {
    return 'blue';
  }
  if (status === 'delivery_failed') {
    return 'red';
  }
  return 'neutral';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadServices() {
  const data = await loadSmartCodeServices({ page: 1, pageSize: 100, status: 'enabled' });
  services.value = data.items;
}

async function loadInventory(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildInventoryListParams();
  const key = createSmartQueryKey('code-inventory', params);

  activeInventoryQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: () => redeemCodesApi.listInventory(params),
      apply: applyInventoryListResult,
      background: options.background,
      isCurrent: () => activeInventoryQueryKey.value === key,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码库存失败');
    }
  }
}

function buildInventoryListParams(): CodeInventoryListParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    serviceId: query.serviceId || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyInventoryListResult(data: CodeInventoryPage) {
  inventory.value = data.items;
  total.value = data.total;
}

async function handleSearch() {
  query.page = 1;
  await loadInventory();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadInventory();
}

function handleSelectionChange(rows: RedeemCodeInventoryItem[]) {
  selectedCodes.value = rows;
}

async function reloadAll(options: { background?: boolean; force?: boolean } = {}) {
  try {
    await Promise.all([
      loadServices(),
      loadInventory({
        background: options.background,
        force: options.force ?? true
      })
    ]);
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '刷新兑换码库存失败');
    }
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.serviceId = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadInventory();
}

function removeFilter(key: string) {
  if (key === 'serviceId') {
    query.serviceId = '';
  }
}

function exportList() {
  ElMessage.info('兑换码库存导出会进入数据中心导出任务，后续统一接入');
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
        return true;
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }

  return false;
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存兑换码库存视图', {
      inputValue: '兑换码库存常用视图',
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
        serviceId: query.serviceId
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : inventoryColumnOptions.map((column) => column.value),
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
  await loadInventory();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.serviceId = typeof filters.serviceId === 'string' ? filters.serviceId : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        inventoryColumnOptions.some((option) => option.value === column)
      )
    : inventoryColumnOptions.map((column) => column.value);
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
  if (prop === 'codeTail') return 'codeTail';
  if (prop === 'cost') return 'cost';
  if (prop === 'status') return 'status';
  if (prop === 'expireAt') return 'expireAt';
  if (prop === 'createdAt') return 'createdAt';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function openImport() {
  importForm.serviceId = services.value[0]?.id ?? '';
  importForm.batchNo = '';
  importForm.defaultCost = '';
  importForm.expireAt = '';
  importForm.remark = '';
  importForm.codesText = '';
  importResult.value = null;
  importDialogVisible.value = true;
}

function openDetail(code: RedeemCodeInventoryItem) {
  selectedCode.value = code;
  detailVisible.value = true;
}

function openRevealDialog(code: RedeemCodeInventoryItem) {
  selectedRevealCode.value = code;
  revealForm.reason = '';
  revealForm.code = '';
  revealDialogVisible.value = true;
}

function resetRevealDialog() {
  selectedRevealCode.value = null;
  revealForm.reason = '';
  revealForm.code = '';
}

async function submitImport() {
  const valid = await importFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const codes = importForm.codesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!codes.length) {
    ElMessage.warning('请输入至少一个兑换码');
    return;
  }

  importing.value = true;
  try {
    const result = await redeemCodesApi.importBatch({
      serviceId: importForm.serviceId,
      batchNo: importForm.batchNo || null,
      defaultCost: importForm.defaultCost || null,
      expireAt: importForm.expireAt || null,
      remark: importForm.remark || null,
      codes
    });
    importResult.value = result;
    ElMessage.success(`成功导入 ${result.successCount} 条兑换码`);
    invalidateSmartQueries('code-inventory');
    await loadInventory();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入兑换码失败');
  } finally {
    importing.value = false;
  }
}

async function revealCode() {
  const valid = await revealFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedRevealCode.value) {
    return;
  }

  revealing.value = true;
  try {
    const data = await redeemCodesApi.reveal(selectedRevealCode.value.id, {
      reason: revealForm.reason
    });
    revealForm.code = data.redeemCode;
    ElMessage.success('完整兑换码已显示并写入审计日志');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整兑换码失败');
  } finally {
    revealing.value = false;
  }
}

async function loadPageData() {
  const servicesPromise = loadServices();
  const tableViewsPromise = loadTableViews(true);
  const inventoryPromise = loadInventory({ force: false });
  const defaultViewApplied = await tableViewsPromise;

  await Promise.all([servicesPromise, inventoryPromise]);

  if (defaultViewApplied) {
    await loadInventory({
      background: inventory.value.length > 0,
      force: false
    });
  }
}

async function initializePage() {
  try {
    await loadPageData();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码库存失败');
  }
}

onMounted(initializePage);

usePageRefresh(
  (options) =>
    reloadAll({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '兑换码库存' }
);

onActivated(() => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }

  void loadInventory({
    background: inventory.value.length > 0,
    force: false
  });
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['code-inventory'], () => {
  void loadInventory({
    background: inventory.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.result-alert {
  margin-top: 12px;
}

.result-table {
  margin-top: 12px;
}

.reveal-form {
  margin-top: 16px;
}

.code-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.code-compact-list-panel .inline-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: min(620px, 100%);
}

@media (max-width: 840px) {
  .code-compact-list-panel .inline-actions {
    justify-content: flex-start;
    max-width: none;
  }
}
</style>
