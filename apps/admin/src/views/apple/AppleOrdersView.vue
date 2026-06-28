<template>
  <PageScaffold
    title="订单管理"
    group="客户与来源"
    phase="Phase 4"
    description="查看 ID 订单、开通记录、余额消耗和利润。订单创建后会自动生成消费流水和开通记录。"
  >
    <template #actions>
      <AppButton
        v-if="canCreateOrders"
        variant="primary"
        @click="router.push('/apple/order-entry')"
      >
        新建订单
      </AppButton>
    </template>

    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="订单列表"
          :help="[
            '这里看每一单有没有开通、用了哪个 ID、客户付了多少、系统算出来赚了多少。',
            '订单、开通记录和余额消费会分开记账，不会和兑换码发货混在一起。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 单</StatusChip>
          <StatusChip :tone="pendingOrderCount > 0 ? 'orange' : 'green'">
            待处理 {{ pendingOrderCount }}
          </StatusChip>
          <StatusChip tone="green">生效 {{ activeOrderCount }}</StatusChip>
          <StatusChip :tone="abnormalOrderCount > 0 ? 'red' : 'green'" dot>
            {{ abnormalOrderCount > 0 ? `异常 ${abnormalOrderCount}` : '无异常' }}
          </StatusChip>
          <StatusChip tone="cyan">实收 {{ sumField('paidAmountRmb') }} CNY</StatusChip>
          <StatusChip tone="orange">成本 {{ sumField('appleCostRmb') }}</StatusChip>
          <StatusChip tone="blue">手续费 {{ sumField('platformFeeRmb') }}</StatusChip>
          <StatusChip tone="purple">损耗 {{ sumField('refundLossRmb') }}</StatusChip>
          <StatusChip :tone="Number(sumField('profitAmount')) >= 0 ? 'green' : 'red'">
            利润 {{ sumField('profitAmount') }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="orderColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :selected-count="selectedOrders.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-primary="canCreateOrders"
        primary-label="新建订单"
        placeholder="搜索订单号、客户、业务、平台订单号"
        @search="handleSearch"
        @refresh="loadOrders"
        @primary="router.push('/apple/order-entry')"
        @clear-filters="clearFilters"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      />

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
            <strong>暂无 Apple ID 订单</strong>
            <span>可以新建订单录入业务，或清空筛选后重新查看订单列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton
                v-if="canCreateOrders"
                variant="primary"
                @click="router.push('/apple/order-entry')"
              >
                新建订单
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('orderNo')"
          prop="orderNo"
          label="订单号"
          min-width="150"
          sortable="custom"
        />
        <el-table-column v-if="isColumnVisible('customer')" label="客户" min-width="130">
          <template #default="{ row }">{{ row.customer.name }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('customerPhone')" label="手机号" min-width="130">
          <template #default="{ row }">{{ formatCustomerPhone(row) }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('customerWechat')" label="微信" min-width="120">
          <template #default="{ row }">{{ row.customer.wechat || '-' }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('service')"
          label="业务"
          min-width="190"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ formatOrderService(row) }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('appleAccount')" label="Apple ID" min-width="170">
          <template #default="{ row }">{{ row.appleAccount?.appleIdMasked ?? '-' }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('paidAmountRmb')"
          prop="paidAmountRmb"
          label="实收"
          min-width="145"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              实收
              <FeatureHelp text="客户这单实际付给你的金额，利润统一按折合人民币计算。" />
            </span>
          </template>
          <template #default="{ row }">
            <div class="order-amount-cell">
              <strong>{{ formatPaidAmount(row) }}</strong>
              <span v-if="row.paidCurrency !== 'CNY'">折合 {{ row.paidAmountRmb }} CNY</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('appleCostRmb')"
          prop="appleCostRmb"
          label="成本"
          min-width="110"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              成本
              <FeatureHelp
                text="成本 = Apple 余额成本 + 售出 ID 成本。寄存 ID 不计算 ID 本身成本。"
              />
            </span>
          </template>
          <template #default="{ row }">{{ formatMoneyNumber(getOrderTotalCost(row)) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('platformFeeRmb')"
          prop="platformFeeRmb"
          label="平台手续费"
          min-width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              平台手续费
              <FeatureHelp text="平台按订单扣掉的手续费，已按订单实收币种折合成人民币。" />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('refundLossRmb')"
          prop="refundLossRmb"
          label="退款/补发损耗"
          min-width="150"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              退款/补发损耗
              <FeatureHelp text="这单额外亏掉的钱，例如退款差额、补发成本或人工承担的损失。" />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('profitAmount')"
          prop="profitAmount"
          label="利润"
          min-width="110"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              利润
              <FeatureHelp
                text="利润 = 实收 - Apple 余额成本 - 售出 ID 成本 - 平台手续费 - 退款/补发损耗。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="getProfitTone(formatOrderProfit(row))">
              {{ formatOrderProfit(row) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('consumed')"
          prop="appleCostValue"
          label="消耗"
          width="120"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              消耗
              <FeatureHelp text="这单用了多少 Apple 余额，比如用了 10 美元就会在这里显示出来。" />
            </span>
          </template>
          <template #default="{ row }"
            >{{ row.appleCostValue }} {{ row.service.currency }}</template
          >
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('expireTime')"
          prop="expireTime"
          label="到期时间"
          min-width="170"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              到期时间
              <FeatureHelp text="客户这次开通到什么时候结束。后面续费提醒会看这个时间。" />
            </span>
          </template>
          <template #default="{ row }">{{ formatDate(row.expireTime) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="100"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              状态
              <FeatureHelp text="看这单现在处在哪一步：待处理、生效中、完成、取消或异常。" />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
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
        <el-table-column label="操作" :width="canManageOrders ? 190 : 90" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton v-if="canUpdateOrders" size="small" variant="ghost" @click="openEdit(row)">
                编辑
              </AppButton>
              <AppButton
                v-if="canDeleteOrders"
                size="small"
                variant="danger"
                :loading="deletingOrderId === row.id"
                @click="removeOrder(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="orders.length" class="mobile-record-list" aria-label="Apple ID 订单移动列表">
        <article v-for="order in orders" :key="order.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ order.orderNo }}</strong>
              <span>{{ order.customer.name }} · {{ formatOrderService(order) }}</span>
            </div>
            <StatusChip :tone="getStatusTone(order.status)" dot>
              {{ getStatusLabel(order.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>实收</span>
              <strong>{{ formatPaidAmount(order) }}</strong>
              <span v-if="order.paidCurrency !== 'CNY'">折合 {{ order.paidAmountRmb }} CNY</span>
            </div>
            <div>
              <span>成本</span>
              <strong>{{ formatMoneyNumber(getOrderTotalCost(order)) }}</strong>
            </div>
            <div>
              <span>平台手续费</span>
              <strong>{{ order.platformFeeRmb }}</strong>
            </div>
            <div>
              <span>退款/补发损耗</span>
              <strong>{{ order.refundLossRmb }}</strong>
            </div>
            <div>
              <span>利润</span>
              <strong>{{ formatOrderProfit(order) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>手机号</span>
              <strong>{{ formatCustomerPhone(order) }}</strong>
            </div>
            <div>
              <span>微信</span>
              <strong>{{ order.customer.wechat || '-' }}</strong>
            </div>
            <div>
              <span>Apple ID</span>
              <strong>{{ order.appleAccount?.appleIdMasked ?? '-' }}</strong>
            </div>
            <div>
              <span>消耗</span>
              <strong>{{ order.appleCostValue }} {{ order.service.currency }}</strong>
            </div>
            <div>
              <span>到期时间</span>
              <strong>{{ formatDate(order.expireTime) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(order)">详情</AppButton>
            <AppButton v-if="canUpdateOrders" size="small" variant="ghost" @click="openEdit(order)">
              编辑
            </AppButton>
            <AppButton
              v-if="canDeleteOrders"
              size="small"
              variant="danger"
              :loading="deletingOrderId === order.id"
              @click="removeOrder(order)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 订单空状态">
        <div class="apple-core-empty-state">
          <strong>暂无 Apple ID 订单</strong>
          <span>可以新建订单录入业务，或清空筛选后重新查看订单列表。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton
              v-if="canCreateOrders"
              variant="primary"
              @click="router.push('/apple/order-entry')"
            >
              新建订单
            </AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadOrders"
      />
    </section>

    <el-dialog
      v-model="editDialogVisible"
      title="管理员编辑订单"
      width="min(760px, calc(100vw - 24px))"
    >
      <el-form
        ref="editFormRef"
        class="v3-entry-form"
        :model="editForm"
        :rules="editRules"
        label-position="top"
      >
        <div class="form-grid">
          <el-form-item label="平台订单号">
            <el-input v-model.trim="editForm.externalOrderNo" clearable />
          </el-form-item>
          <el-form-item label="客户网站账号">
            <el-input v-model.trim="editForm.serviceAccount" clearable />
          </el-form-item>
          <el-form-item label="当前套餐">
            <el-input v-model.trim="editForm.currentPlan" clearable />
          </el-form-item>
          <el-form-item label="开通套餐">
            <el-input v-model.trim="editForm.targetPlan" clearable />
          </el-form-item>
          <el-form-item label="开通时间">
            <el-date-picker
              v-model="editForm.startTime"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
              clearable
            />
          </el-form-item>
          <el-form-item label="到期时间">
            <el-date-picker
              v-model="editForm.expireTime"
              class="full-input"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
              clearable
            />
          </el-form-item>
          <el-form-item label="客户实收" prop="paidAmount">
            <el-input
              v-model.trim="editForm.paidAmount"
              type="number"
              inputmode="decimal"
              min="0"
              placeholder="0.00"
            />
          </el-form-item>
          <el-form-item label="实收币种" prop="paidCurrency">
            <el-select v-model="editForm.paidCurrency" class="full-input">
              <el-option label="人民币 CNY" value="CNY" />
              <el-option label="马币 MYR" value="MYR" />
              <el-option label="美元 USD" value="USD" />
              <el-option label="USDT" value="USDT" />
            </el-select>
          </el-form-item>
          <el-form-item label="折合人民币汇率" prop="paidExchangeRateToRmb">
            <el-input
              v-model.trim="editForm.paidExchangeRateToRmb"
              type="number"
              inputmode="decimal"
              min="0"
              :disabled="editForm.paidCurrency === 'CNY'"
              placeholder="1.00000000"
            />
          </el-form-item>
          <el-form-item label="平台手续费" prop="platformFee">
            <el-input
              v-model.trim="editForm.platformFee"
              type="number"
              inputmode="decimal"
              min="0"
              placeholder="0.00"
            />
          </el-form-item>
          <el-form-item label="退款/补发损耗" prop="refundLoss">
            <el-input
              v-model.trim="editForm.refundLoss"
              type="number"
              inputmode="decimal"
              min="0"
              placeholder="0.00"
            />
          </el-form-item>
          <el-form-item label="订单状态" prop="status">
            <el-select v-model="editForm.status" class="full-input">
              <el-option
                v-for="status in statusOptions"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model.trim="editForm.remark" type="textarea" :rows="3" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="editDialogVisible = false">取消</AppButton>
        <AppButton
          v-if="canUpdateOrders"
          variant="primary"
          :loading="savingEdit"
          @click="saveOrderEdit"
        >
          保存
        </AppButton>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="selectedOrder?.orderNo ?? '订单详情'"
      eyebrow="Apple ID 订单"
      :description="
        selectedOrder ? `${selectedOrder.customer.name} · ${formatOrderService(selectedOrder)}` : ''
      "
      size="640px"
    >
      <div v-if="selectedOrder" class="order-detail-layout">
        <section class="order-detail-hero">
          <div class="order-detail-hero__main">
            <StatusChip :tone="getStatusTone(selectedOrder.status)" dot>
              {{ getStatusLabel(selectedOrder.status) }}
            </StatusChip>
            <strong>{{ selectedOrder.customer.name }}</strong>
            <span>{{ formatOrderService(selectedOrder) }}</span>
            <div class="order-detail-hero__meta">
              <span>{{ selectedOrder.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' }}</span>
              <span>{{ selectedOrder.sourcePlatform?.name ?? '无来源平台' }}</span>
            </div>
          </div>
          <div class="order-detail-hero__amount">
            <span>客户实收</span>
            <strong>{{ formatPaidAmount(selectedOrder) }}</strong>
            <small>折合 {{ selectedOrder.paidAmountRmb }} CNY</small>
          </div>
        </section>

        <section class="order-detail-finance">
          <div
            class="order-detail-profit"
            :class="{
              'order-detail-profit--negative': Number(formatOrderProfit(selectedOrder)) < 0
            }"
          >
            <span>预计利润</span>
            <strong>{{ formatOrderProfit(selectedOrder) }}</strong>
            <small>利润率 {{ formatProfitRate(selectedOrder) }}</small>
          </div>
          <div class="order-detail-breakdown" aria-label="订单成本拆解">
            <div>
              <span>实收折合</span>
              <strong>{{ selectedOrder.paidAmountRmb }} CNY</strong>
            </div>
            <div>
              <span>实际成本</span>
              <strong>{{ formatMoneyNumber(getOrderTotalCost(selectedOrder)) }} CNY</strong>
            </div>
            <div>
              <span>Apple 余额成本</span>
              <strong>{{ selectedOrder.appleCostRmb }} CNY</strong>
            </div>
            <div>
              <span>平台手续费</span>
              <strong>{{ selectedOrder.platformFeeRmb }} CNY</strong>
            </div>
            <div>
              <span>退款/补发损耗</span>
              <strong>{{ selectedOrder.refundLossRmb }} CNY</strong>
            </div>
            <div v-if="getOrderAppleIdCost(selectedOrder) > 0">
              <span>ID 购入成本</span>
              <strong>{{ formatMoneyNumber(getOrderAppleIdCost(selectedOrder)) }} CNY</strong>
            </div>
          </div>
        </section>

        <section class="order-detail-section">
          <div class="order-detail-section__head">
            <strong>订单资料</strong>
            <span>{{ selectedOrder.service.category }}</span>
          </div>
          <div class="order-detail-info-grid">
            <div>
              <span>客户手机号</span>
              <strong>{{ formatCustomerPhone(selectedOrder) }}</strong>
            </div>
            <div>
              <span>客户微信</span>
              <strong>{{ selectedOrder.customer.wechat || '-' }}</strong>
            </div>
            <div>
              <span>开通国家</span>
              <strong>{{ formatOrderRegion(selectedOrder) }}</strong>
            </div>
            <div>
              <span>平台订单号</span>
              <strong>{{ selectedOrder.externalOrderNo ?? '-' }}</strong>
            </div>
            <div>
              <span>客户网站账号</span>
              <strong>{{ selectedOrder.serviceAccount ?? '-' }}</strong>
            </div>
            <div>
              <span>套餐</span>
              <strong>{{ formatPlanChange(selectedOrder) }}</strong>
            </div>
            <div>
              <span>Apple 消耗</span>
              <strong
                >{{ selectedOrder.appleCostValue }} {{ selectedOrder.service.currency }}</strong
              >
            </div>
            <div>
              <span>ID 处理方式</span>
              <strong>{{ formatOwnershipType(selectedOrder.appleAccountOwnershipType) }}</strong>
            </div>
            <div>
              <span>开通记录</span>
              <AppButton
                v-if="selectedOrder.activationId && canViewActivations"
                size="small"
                variant="soft"
                @click="router.push('/apple/activations')"
              >
                查看开通记录
              </AppButton>
              <strong v-else>-</strong>
            </div>
          </div>
        </section>

        <section class="order-detail-section">
          <div class="order-detail-section__head">
            <strong>开通周期</strong>
            <span>{{ formatDate(selectedOrder.createdAt) }}</span>
          </div>
          <div class="order-detail-timeline">
            <div>
              <span class="order-detail-timeline__dot" />
              <div>
                <span>开通时间</span>
                <strong>{{ formatDate(selectedOrder.startTime) }}</strong>
              </div>
            </div>
            <div>
              <span class="order-detail-timeline__dot" />
              <div>
                <span>到期时间</span>
                <strong>{{ formatDate(selectedOrder.expireTime) }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="order-detail-section">
          <div class="order-detail-section__head">
            <strong>备注</strong>
          </div>
          <p class="order-detail-note">{{ selectedOrder.remark || '暂无备注' }}</p>
        </section>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleOrdersApi, userTableViewsApi } from '@/api/system';
import type { AppleOrderQuery, UpdateAppleOrderPayload } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type { AppleOrder, PageResult, TableDensity, UserTableView } from '@/types/system';
import { formatAppleRegionLabel } from '@/utils/appleAccountRegion';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';

const router = useRouter();
const authStore = useAuthStore();
const tableKey = 'apple_orders';
const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '生效中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
  { label: '异常', value: 'abnormal' }
];
const orderColumnOptions = [
  { label: '订单号', value: 'orderNo', required: true },
  { label: '客户', value: 'customer' },
  { label: '手机号', value: 'customerPhone' },
  { label: '微信', value: 'customerWechat' },
  { label: '业务', value: 'service' },
  { label: 'Apple ID', value: 'appleAccount' },
  { label: '实收', value: 'paidAmountRmb' },
  { label: '成本', value: 'appleCostRmb' },
  { label: '平台手续费', value: 'platformFeeRmb' },
  { label: '退款/补发损耗', value: 'refundLossRmb' },
  { label: '利润', value: 'profitAmount' },
  { label: '消耗', value: 'consumed' },
  { label: '到期时间', value: 'expireTime' },
  { label: '状态', value: 'status' },
  { label: '创建时间', value: 'createdAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

interface EditOrderForm {
  externalOrderNo: string;
  serviceAccount: string;
  currentPlan: string;
  targetPlan: string;
  startTime: string;
  expireTime: string;
  paidAmount: string;
  paidCurrency: AppleOrder['paidCurrency'];
  paidExchangeRateToRmb: string;
  platformFee: string;
  refundLoss: string;
  status: AppleOrder['status'];
  remark: string;
}

const loading = ref(false);
const savingEdit = ref(false);
const detailDrawerVisible = ref(false);
const editDialogVisible = ref(false);
const orders = ref<AppleOrder[]>([]);
const selectedOrders = ref<AppleOrder[]>([]);
const selectedOrder = ref<AppleOrder | null>(null);
const editingOrder = ref<AppleOrder | null>(null);
const editFormRef = ref<FormInstance>();
const deletingOrderId = ref('');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeOrdersQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const editForm = reactive<EditOrderForm>({
  externalOrderNo: '',
  serviceAccount: '',
  currentPlan: '',
  targetPlan: '',
  startTime: '',
  expireTime: '',
  paidAmount: '0',
  paidCurrency: 'CNY',
  paidExchangeRateToRmb: '1',
  platformFee: '0',
  refundLoss: '0',
  status: 'active',
  remark: ''
});

const nonNegativeMoneyRule = {
  pattern: /^\d+(\.\d{1,8})?$/,
  message: '请输入不小于 0 的数字',
  trigger: 'blur'
};

const editRules: FormRules<EditOrderForm> = {
  paidAmount: [
    { required: true, message: '请输入客户实收', trigger: 'blur' },
    nonNegativeMoneyRule
  ],
  paidCurrency: [{ required: true, message: '请选择实收币种', trigger: 'change' }],
  paidExchangeRateToRmb: [
    {
      validator: (_rule, value, callback) => {
        if (editForm.paidCurrency === 'CNY') {
          callback();
          return;
        }
        if (!/^\d+(\.\d{1,8})?$/.test(String(value)) || Number(value) <= 0) {
          callback(new Error('请输入大于 0 的汇率'));
          return;
        }
        callback();
      },
      trigger: 'blur'
    }
  ],
  platformFee: [nonNegativeMoneyRule],
  refundLoss: [nonNegativeMoneyRule],
  status: [{ required: true, message: '请选择订单状态', trigger: 'change' }]
};

function hasOrderPermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

const canCreateOrders = computed(() => hasOrderPermission('apple.order.create'));
const canUpdateOrders = computed(() => hasOrderPermission('apple.order.update'));
const canDeleteOrders = computed(() => hasOrderPermission('apple.order.delete'));
const canViewActivations = computed(() => hasOrderPermission('apple.activation.view'));
const canManageOrders = computed(() => canUpdateOrders.value || canDeleteOrders.value);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const pendingOrderCount = computed(
  () => orders.value.filter((order) => order.status === 'pending').length
);
const activeOrderCount = computed(
  () => orders.value.filter((order) => order.status === 'active').length
);
const abnormalOrderCount = computed(
  () => orders.value.filter((order) => order.status === 'abnormal').length
);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function sumField(
  field: 'paidAmountRmb' | 'appleCostRmb' | 'platformFeeRmb' | 'refundLossRmb' | 'profitAmount'
) {
  return orders.value
    .reduce((sum, order) => {
      if (field === 'appleCostRmb') {
        return sum + getOrderTotalCost(order);
      }
      if (field === 'profitAmount') {
        return sum + Number(formatOrderProfit(order));
      }
      return sum + Number(order[field]);
    }, 0)
    .toFixed(2);
}

function formatPaidAmount(order: AppleOrder) {
  return `${order.paidAmount} ${order.paidCurrency}`;
}

function readAmount(value?: string | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoneyNumber(value: number) {
  return value.toFixed(2);
}

function getOrderAppleIdCost(order: AppleOrder) {
  if (order.appleAccountOwnershipType !== 'sold') {
    return 0;
  }

  const orderCost = readAmount(order.appleAccountPurchaseCost);
  if (orderCost > 0) {
    return orderCost;
  }

  return readAmount(order.appleAccount?.purchaseCost);
}

function getOrderTotalCost(order: AppleOrder) {
  return readAmount(order.appleCostRmb) + getOrderAppleIdCost(order);
}

function formatOrderProfit(order: AppleOrder) {
  const profit =
    readAmount(order.paidAmountRmb) -
    readAmount(order.platformFeeRmb) -
    readAmount(order.refundLossRmb) -
    getOrderTotalCost(order);
  return profit.toFixed(4);
}

function formatCustomerPhone(order: AppleOrder) {
  return (
    order.customer.maskedPhone ??
    (order.customer.phoneTail ? `尾号 ${order.customer.phoneTail}` : '-')
  );
}

function getOrderRegion(order: AppleOrder) {
  return order.appleAccount?.region || order.service.allowedRegions?.[0] || '';
}

function formatOrderRegion(order: AppleOrder) {
  return formatAppleRegionLabel(getOrderRegion(order));
}

function formatOrderService(order: AppleOrder) {
  const region = formatOrderRegion(order);
  return region === '-' ? order.service.name : `${region} · ${order.service.name}`;
}

function getStatusLabel(status: AppleOrder['status']) {
  return {
    pending: '待处理',
    active: '生效中',
    completed: '已完成',
    cancelled: '已取消',
    abnormal: '异常'
  }[status];
}

function getStatusTone(status: AppleOrder['status']) {
  if (status === 'active' || status === 'completed') return 'green';
  if (status === 'pending') return 'orange';
  if (status === 'abnormal') return 'red';
  return 'neutral';
}

function getProfitTone(value: string) {
  return Number(value) >= 0 ? 'green' : 'red';
}

function formatProfitRate(order: AppleOrder) {
  const paidAmountRmb = Number(order.paidAmountRmb);
  if (!paidAmountRmb) return '-';
  return `${((Number(formatOrderProfit(order)) / paidAmountRmb) * 100).toFixed(2)}%`;
}

function formatPlanChange(order: AppleOrder) {
  if (order.currentPlan && order.targetPlan) {
    return `${order.currentPlan} 至 ${order.targetPlan}`;
  }
  return order.targetPlan ?? order.currentPlan ?? '-';
}

function formatOwnershipType(value: AppleOrder['appleAccountOwnershipType']) {
  return value === 'sold' ? '售出' : '寄存';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function buildOrderParams(): AppleOrderQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    sortBy: mapSortProp(sortConfig.value.prop),
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyOrderResult(data: PageResult<AppleOrder>) {
  orders.value = data.items;
  total.value = data.total;
}

async function loadOrders(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildOrderParams();
  const key = createSmartQueryKey('apple-orders', params);

  activeOrdersQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => appleOrdersApi.list(params, { signal }),
      apply: applyOrderResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'apple-orders' : undefined,
      isCurrent: () => activeOrdersQueryKey.value === key,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 订单失败');
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

function handleSelectionChange(rows: AppleOrder[]) {
  selectedOrders.value = rows;
}

function openDetail(order: AppleOrder) {
  selectedOrder.value = order;
  detailDrawerVisible.value = true;
}

function openEdit(order: AppleOrder) {
  if (!canUpdateOrders.value) {
    ElMessage.error('当前账号没有编辑订单权限');
    return;
  }

  editingOrder.value = order;
  resetEditForm(order);
  editDialogVisible.value = true;
}

function resetEditForm(order: AppleOrder) {
  editForm.externalOrderNo = order.externalOrderNo ?? '';
  editForm.serviceAccount = order.serviceAccount ?? '';
  editForm.currentPlan = order.currentPlan ?? '';
  editForm.targetPlan = order.targetPlan ?? '';
  editForm.startTime = order.startTime ?? '';
  editForm.expireTime = order.expireTime ?? '';
  editForm.paidAmount = order.paidAmount;
  editForm.paidCurrency = order.paidCurrency;
  editForm.paidExchangeRateToRmb = order.paidCurrency === 'CNY' ? '1' : order.paidExchangeRateToRmb;
  editForm.platformFee = order.platformFee;
  editForm.refundLoss = order.refundLoss;
  editForm.status = order.status;
  editForm.remark = order.remark ?? '';
}

function emptyToNull(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function buildUpdatePayload(): UpdateAppleOrderPayload {
  return {
    externalOrderNo: emptyToNull(editForm.externalOrderNo),
    serviceAccount: emptyToNull(editForm.serviceAccount),
    currentPlan: emptyToNull(editForm.currentPlan),
    targetPlan: emptyToNull(editForm.targetPlan),
    startTime: editForm.startTime || null,
    expireTime: editForm.expireTime || null,
    paidAmount: editForm.paidAmount,
    paidCurrency: editForm.paidCurrency,
    paidExchangeRateToRmb: editForm.paidCurrency === 'CNY' ? '1' : editForm.paidExchangeRateToRmb,
    platformFee: editForm.platformFee || '0',
    refundLoss: editForm.refundLoss || '0',
    status: editForm.status,
    remark: emptyToNull(editForm.remark)
  };
}

async function saveOrderEdit() {
  if (!editingOrder.value) return;

  if (!canUpdateOrders.value) {
    ElMessage.error('当前账号没有编辑订单权限');
    return;
  }

  try {
    await editFormRef.value?.validate();
    savingEdit.value = true;
    const updated = await appleOrdersApi.update(editingOrder.value.id, buildUpdatePayload());
    ElMessage.success('订单已更新');
    editDialogVisible.value = false;
    if (selectedOrder.value?.id === updated.id) {
      selectedOrder.value = updated;
    }
    await loadOrders({ background: true, force: true });
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '更新订单失败');
  } finally {
    savingEdit.value = false;
  }
}

async function removeOrder(order: AppleOrder) {
  if (!canDeleteOrders.value) {
    ElMessage.error('当前账号没有删除订单权限');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确认删除订单 ${order.orderNo}？删除后订单会从列表、报表和导出里隐藏，不会自动回滚 Apple ID 余额流水。`,
      '删除订单',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger'
      }
    );
    deletingOrderId.value = order.id;
    await appleOrdersApi.remove(order.id);
    if (selectedOrder.value?.id === order.id) {
      selectedOrder.value = null;
      detailDrawerVisible.value = false;
    }
    ElMessage.success('订单已删除');
    await loadOrders({ force: true });
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '删除订单失败');
  } finally {
    deletingOrderId.value = '';
  }
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadOrders();
}

function exportList() {
  const rows = selectedOrders.value.length ? selectedOrders.value : orders.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的订单数据');
    return;
  }

  const count = exportRowsToCsv(
    'apple-orders',
    [
      { header: '订单号', value: (row) => row.orderNo },
      { header: '客户', value: (row) => row.customer.name },
      { header: '手机号', value: (row) => formatCustomerPhone(row) },
      { header: '微信', value: (row) => row.customer.wechat ?? '' },
      { header: '来源平台', value: (row) => row.sourcePlatform?.name ?? '' },
      { header: '平台订单号', value: (row) => row.externalOrderNo ?? '' },
      { header: '业务', value: (row) => formatOrderService(row) },
      { header: 'Apple ID', value: (row) => row.appleAccount?.appleIdMasked ?? '' },
      { header: 'ID 类型', value: (row) => formatOwnershipType(row.appleAccountOwnershipType) },
      { header: '套餐', value: (row) => formatPlanChange(row) },
      { header: '实收', value: (row) => formatPaidAmount(row) },
      { header: '实收人民币', value: (row) => row.paidAmountRmb },
      { header: 'Apple 余额成本', value: (row) => row.appleCostRmb },
      { header: '总成本', value: (row) => formatMoneyNumber(getOrderTotalCost(row)) },
      { header: '平台手续费', value: (row) => row.platformFeeRmb },
      { header: '退款/补发损耗', value: (row) => row.refundLossRmb },
      { header: '利润', value: (row) => formatOrderProfit(row) },
      { header: '利润率', value: (row) => formatProfitRate(row) },
      { header: '状态', value: (row) => getStatusLabel(row.status) },
      { header: '开始时间', value: (row) => formatDate(row.startTime) },
      { header: '到期时间', value: (row) => formatDate(row.expireTime) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条 Apple ID 订单`);
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 订单视图', {
      inputValue: 'Apple ID 订单常用视图',
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
        status: query.status
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
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = normalizeVisibleColumns(view.columns);
  sortConfig.value = parseSortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function normalizeVisibleColumns(columns: string[]) {
  const defaultColumns = orderColumnOptions.map((column) => column.value);

  if (!columns.length) {
    return defaultColumns;
  }

  const expandedColumns = columns.flatMap((column) =>
    column === 'amounts'
      ? ['paidAmountRmb', 'appleCostRmb', 'platformFeeRmb', 'refundLossRmb', 'profitAmount']
      : [column]
  );
  const allowedColumns = new Set(defaultColumns);
  const nextColumns = expandedColumns.filter((column) => allowedColumns.has(column));

  if (!nextColumns.length) {
    return defaultColumns;
  }

  const customerIndex = nextColumns.indexOf('customer');
  if (customerIndex >= 0) {
    const contactColumns = ['customerPhone', 'customerWechat'];
    let insertOffset = 1;

    for (const column of contactColumns) {
      if (!nextColumns.includes(column)) {
        nextColumns.splice(customerIndex + insertOffset, 0, column);
        insertOffset += 1;
      }
    }
  }

  return nextColumns;
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
  if (prop === 'paidAmount' || prop === 'paidAmountRmb') return 'paidAmountRmb';
  if (prop === 'appleCostValue') return 'appleCostValue';
  return prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

async function initializePage() {
  await loadTableViews(true);
  await loadOrders({ force: false });
}

onMounted(initializePage);

usePageRefresh(
  (options) =>
    loadOrders({
      background: options.background,
      force: options.force ?? true
    }),
  { label: 'Apple ID 订单列表' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-orders'], () => {
  void loadOrders({
    background: orders.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
