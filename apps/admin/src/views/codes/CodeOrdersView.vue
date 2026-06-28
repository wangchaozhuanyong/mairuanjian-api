<template>
  <PageScaffold
    title="兑换码订单"
    group="兑换码自动发货"
    phase="Phase 6"
    description="处理手工订单导入、平台映射识别、锁定未售兑换码和生成半自动发货内容。"
  >
    <section class="content-panel code-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="兑换码发货列表"
          :help="[
            '这里处理买家下单后的发货。先匹配业务，再锁住兑换码，最后生成内容并确认发货。',
            '系统会尽量防止重复发货和库存误消耗，失败的订单可以在这里重试或转人工。'
          ]"
        />
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
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="orderColumnOptions"
        :status-options="deliveryStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedOrders.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-primary="canCreateCodeOrder"
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

      <el-alert
        v-if="codeOrderImportNoticeVisible"
        class="code-operation-notice"
        type="warning"
        :title="codeOrderImportNoticeTitle"
        :closable="false"
        show-icon
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
            <strong>暂无兑换码订单</strong>
            <span>{{ codeOrdersEmptyStateText }}</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton v-if="canCreateCodeOrder" variant="primary" @click="openCreate">
                手工导入订单
              </AppButton>
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
              <AppButton v-if="canDeliverCodeOrders" variant="soft" @click="matchCode(row)">
                匹配锁码
              </AppButton>
              <AppButton v-if="canDeliverCodeOrders" variant="ghost" @click="openGenerate(row)">
                生成发货
              </AppButton>
              <AppButton
                v-if="canDeliverCodeOrders"
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
            <AppButton
              v-if="canDeliverCodeOrders"
              size="small"
              variant="soft"
              @click="matchCode(order)"
            >
              匹配锁码
            </AppButton>
            <AppButton
              v-if="canDeliverCodeOrders"
              size="small"
              variant="ghost"
              @click="openGenerate(order)"
            >
              生成发货
            </AppButton>
            <AppButton
              v-if="canDeliverCodeOrders"
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
          <span>{{ codeOrdersEmptyStateText }}</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton v-if="canCreateCodeOrder" variant="primary" @click="openCreate">
              手工导入订单
            </AppButton>
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
          <el-form-item prop="platformId">
            <template #label>
              <FieldHelpLabel
                label="平台"
                purpose="这笔兑换码订单来自哪个销售平台，系统会按平台和商品信息匹配业务。"
                example="直营网店订单选直营网店，微信订单选微信渠道。"
              />
            </template>
            <el-select v-model="form.platformId" class="full-input" filterable>
              <el-option
                v-for="platform in platforms"
                :key="platform.id"
                :label="platform.name"
                :value="platform.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="externalOrderNo">
            <template #label>
              <FieldHelpLabel
                label="平台订单号"
                purpose="外部平台的订单编号，用来对账、售后和防止重复导入。"
                example="复制外部订单详情里的订单号。"
              />
            </template>
            <el-input v-model.trim="form.externalOrderNo" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="itemId">
            <template #label>
              <FieldHelpLabel
                label="商品 ID"
                purpose="平台商品的编号，系统用它匹配兑换码业务和 SKU 映射。"
                example="从平台订单或商品后台复制 itemId。"
              />
            </template>
            <el-input v-model.trim="form.itemId" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="SKU ID"
                purpose="商品规格编号，用来区分同一商品下不同面值或套餐。"
                example="只有一个规格可留空；多规格商品就填平台 SKU ID。"
              />
            </template>
            <el-input v-model.trim="form.skuId" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="商品标题"
                purpose="买家拍下的商品名称，方便人工核对订单和映射是否正确。"
                example="可以填平台订单里显示的完整商品标题。"
              />
            </template>
            <el-input v-model.trim="form.itemTitle" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="SKU 名称"
                purpose="买家选择的规格文字，系统可用它辅助判断应该发哪种兑换码。"
                example="例如 20 USD、100 港币、月卡、季卡。"
              />
            </template>
            <el-input v-model.trim="form.skuName" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="兑换码业务"
                purpose="手工指定这单应该消耗哪类兑换码库存。"
                example="如果自动映射不确定，就手动选择 20 USD 兑换码业务。"
              />
            </template>
            <el-select v-model="form.serviceId" class="full-input" clearable filterable>
              <el-option
                v-for="service in services"
                :key="service.id"
                :label="`${service.name} · ${service.faceValue}`"
                :value="service.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="面值"
                purpose="订单需要发的兑换码面值，留空时系统会优先使用映射或业务面值。"
                example="客户买 20 USD 就填 20 USD；映射已准确时可以留空。"
              />
            </template>
            <el-input v-model.trim="form.faceValue" placeholder="留空使用映射或业务面值" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="数量"
                purpose="这单需要发几张兑换码，系统会按数量锁定库存。"
                example="买 1 张码填 1；买 3 张同面值码填 3。"
              />
            </template>
            <el-input-number v-model="form.quantity" :min="1" class="full-input" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="实付金额"
                purpose="买家这单实际付款金额，是计算兑换码订单利润的收入部分。"
                example="买家实付 20 元就填 20，不要填兑换码面值。"
              />
            </template>
            <el-input v-model.trim="form.paidAmount" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="平台手续费"
                purpose="平台从这单扣掉的手续费，会从利润里扣除。"
                example="平台扣 0.2 元就填 0.2；没有手续费填 0。"
              />
            </template>
            <el-input v-model.trim="form.platformFee" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="买家脱敏"
                purpose="记录买家的脱敏名称，方便售后定位但不暴露完整隐私。"
                example="可以填张***、微信尾号 1234、客户昵称前后缀。"
              />
            </template>
            <el-input v-model.trim="form.buyerNameMasked" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton v-if="canCreateCodeOrder" variant="primary" :loading="saving" @click="saveOrder">
          保存
        </AppButton>
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
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="订单"
              purpose="当前准备生成发货内容的订单，用来确认没有选错订单。"
              example="生成前核对平台订单号和买家商品信息。"
            />
          </template>
          <el-input :model-value="selectedOrder?.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item prop="reason">
          <template #label>
            <FieldHelpLabel
              label="生成原因"
              purpose="说明为什么要生成或查看发货内容，便于售后追踪。"
              example="可以填手工复制发货给客户、客户要求重发、售后核对。"
            />
          </template>
          <el-input
            v-model.trim="generateForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如：手工复制发货给客户"
          />
        </el-form-item>
        <el-form-item v-if="generateForm.content">
          <template #label>
            <FieldHelpLabel
              label="发货内容"
              purpose="系统根据锁定兑换码和模板生成的客户可见内容。"
              example="复制给客户前先确认订单号、码数量和面值都正确。"
            />
          </template>
          <el-input v-model="generateForm.content" type="textarea" :rows="7" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="generateDialogVisible = false">关闭</AppButton>
        <AppButton
          v-if="canDeliverCodeOrders"
          variant="primary"
          :loading="generating"
          @click="generateDelivery"
        >
          生成
        </AppButton>
        <AppButton
          v-if="canDeliverCodeOrders"
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
          <p>系统会保存发货记录；同一订单不能重复发货，提交前请核对发货内容。</p>
        </div>
      </div>
      <el-form ref="deliverFormRef" :model="deliverForm" :rules="deliverRules" label-position="top">
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="订单"
              purpose="当前准备确认发货的订单，确认后会保存发货记录并防重复发货。"
              example="提交前核对是不是客户刚才要发的那一单。"
            />
          </template>
          <el-input :model-value="selectedOrder?.externalOrderNo ?? '-'" disabled />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="发货方式"
              purpose="记录这次实际通过什么方式发给客户，便于之后售后追踪。"
              example="人工复制给客户选手工发货；通过电子凭证渠道发出选电子凭证。"
            />
          </template>
          <el-select v-model="deliverForm.deliveryMethod" class="full-input">
            <el-option
              v-for="method in deliveryMethodOptions"
              :key="method.value"
              :label="method.label"
              :value="method.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="deliveryContent">
          <template #label>
            <FieldHelpLabel
              label="发货内容快照"
              purpose="保存这次实际发给客户的内容，之后售后会查看它。"
              example="可以先生成内容再确认，也可以粘贴你实际发给客户的消息。"
            />
          </template>
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
        <AppButton
          v-if="canDeliverCodeOrders"
          variant="success"
          :loading="delivering"
          @click="confirmDelivery"
        >
          确认发货
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { codeOrdersApi, codeServicesApi, dataCenterApi, userTableViewsApi } from '@/api/system';
import type { CodeOrderQuery, DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { CODE_DELIVERY_METHOD_DICTIONARY_GROUP } from '@/config/quickSettings';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type {
  CodeDeliveryLog,
  CodePlatformOrder,
  CodeService,
  DataDictionary,
  PageResult,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  buildCodeDeliveryMethodOptions,
  getCodeDeliveryMethodLabel as getConfiguredCodeDeliveryMethodLabel
} from '@/utils/codeDeliveryMethods';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';
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

const route = useRoute();
const authStore = useAuthStore();
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
const deliveryMethodDictionaries = ref<DataDictionary[]>([]);
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
const activeDeliveryMethodsQueryKey = ref('');

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
const canCreateManualCodeOrder = computed(
  () => hasCodeOrderPermission('code.order.create') || hasCodeOrderPermission('code.order.deliver')
);
const canDeliverCodeOrders = computed(() => hasCodeOrderPermission('code.order.deliver'));
const canViewSourcePlatforms = computed(() => hasCodeOrderPermission('source_platform.view'));
const canViewCodeServices = computed(() => hasCodeOrderPermission('code.order.view'));
const canManageDictionaries = computed(() => hasCodeOrderPermission('data.dictionary.manage'));
const canViewDeliveryLogs = computed(() => hasCodeOrderPermission('code.delivery.view'));
const canCreateCodeOrder = computed(
  () => canCreateManualCodeOrder.value && canViewSourcePlatforms.value
);
const codeOrderImportNoticeVisible = computed(() => !canCreateCodeOrder.value);
const codeOrderImportNoticeTitle = computed(() => {
  if (!canCreateManualCodeOrder.value && !canViewSourcePlatforms.value) {
    return '当前账号只能查看兑换码订单，不能手工导入；还缺少手工导入权限和来源平台查看权限。';
  }

  if (!canCreateManualCodeOrder.value) {
    return '当前账号只有查看权限，不能手工导入订单。';
  }

  if (!canViewSourcePlatforms.value) {
    return '当前账号不能查看来源平台，暂时不能手工导入兑换码订单。';
  }

  return '';
});
const codeOrdersEmptyStateText = computed(() =>
  canCreateCodeOrder.value
    ? '可以手工导入订单，或清空筛选后重新查看发货列表。'
    : '当前筛选范围暂无订单；如需手工导入或发货，请先开通对应业务权限。'
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const deliveryMethodOptions = computed(() =>
  buildCodeDeliveryMethodOptions(deliveryMethodDictionaries.value)
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
  return getConfiguredCodeDeliveryMethodLabel(method, deliveryMethodDictionaries.value);
}

function getDefaultDeliveryMethod() {
  return deliveryMethodOptions.value[0]?.value ?? 'manual';
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
  activeDependenciesQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: async ({ signal }) => {
        const [platformData, serviceData] = await Promise.all([
          canViewSourcePlatforms.value
            ? loadSmartSourcePlatforms(
                {
                  page: 1,
                  pageSize: 100,
                  status: 'active'
                },
                { ...options, signal }
              )
            : Promise.resolve(emptyPageResult<SourcePlatform>(100)),
          canViewCodeServices.value
            ? codeServicesApi
                .listOrderOptions({ signal })
                .then((data) => pageResultFromItems(data.items, 100))
            : Promise.resolve(emptyPageResult<CodeService>(100))
        ]);

        return {
          platforms: platformData,
          services: serviceData
        };
      },
      apply: applyDependenciesResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'code-order-dependencies' : undefined,
      isCurrent: () => activeDependenciesQueryKey.value === key,
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单依赖失败');
    }
  }
}

function buildDeliveryMethodParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: CODE_DELIVERY_METHOD_DICTIONARY_GROUP,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function emptyPageResult<TItem>(pageSize: number): PageResult<TItem> {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize
  };
}

function pageResultFromItems<TItem>(items: TItem[], pageSize: number): PageResult<TItem> {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize
  };
}

function applyDeliveryMethodResult(data: PageResult<DataDictionary>) {
  deliveryMethodDictionaries.value = data.items;
}

async function loadDeliveryMethods(options: { background?: boolean; force?: boolean } = {}) {
  if (!canManageDictionaries.value) {
    deliveryMethodDictionaries.value = [];
    return;
  }

  const params = buildDeliveryMethodParams();
  const key = createSmartQueryKey('code-order-delivery-methods', params);
  activeDeliveryMethodsQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => dataCenterApi.listDictionaries(params, { signal }),
      apply: applyDeliveryMethodResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'code-order-delivery-methods' : undefined,
      isCurrent: () => activeDeliveryMethodsQueryKey.value === key,
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载发货方式失败');
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

  activeOrdersQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => codeOrdersApi.list(params, { signal }),
      apply: applyOrderResult,
      background: options.background,
      cancelPreviousMatching: options.force ? 'code-orders' : undefined,
      isCurrent: () => activeOrdersQueryKey.value === key,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单失败');
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
      loadDeliveryMethods(options),
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
  const rows = selectedOrders.value.length ? selectedOrders.value : orders.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的兑换码订单');
    return;
  }

  const count = exportRowsToCsv(
    'code-orders',
    [
      { header: '订单号', value: (row) => row.externalOrderNo },
      { header: '平台', value: (row) => row.platform.name },
      { header: '买家', value: (row) => row.buyerNameMasked ?? row.buyerId ?? '' },
      { header: '商品', value: (row) => row.itemTitle ?? row.itemId },
      { header: 'SKU', value: (row) => row.skuName ?? row.skuId },
      { header: '匹配业务', value: (row) => row.service?.name ?? '' },
      { header: '面值', value: (row) => row.faceValue ?? '' },
      { header: '数量', value: (row) => row.quantity },
      { header: '实收', value: (row) => row.paidAmount },
      { header: '手续费', value: (row) => row.platformFee },
      { header: '成本', value: (row) => row.costAmount },
      { header: '利润', value: (row) => row.profitAmount },
      { header: '订单状态', value: (row) => row.orderStatus },
      { header: '发货状态', value: (row) => getDeliveryStatusLabel(row.deliveryStatus) },
      { header: '退款状态', value: (row) => getRefundStatusLabel(row.refundStatus) },
      { header: '锁定码数', value: (row) => row.lockedCodeCount },
      { header: '已发码数', value: (row) => row.deliveredCodeCount },
      {
        header: '锁定码尾号',
        value: (row) => row.lockedCodes.map((code) => code.codeTail).join('、')
      },
      {
        header: '已发码尾号',
        value: (row) => row.deliveredCodes.map((code) => code.codeTail).join('、')
      },
      { header: '支付时间', value: (row) => formatDate(row.paidAt) },
      { header: '发货时间', value: (row) => formatDate(row.deliveredAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条兑换码订单`);
}

function getRefundStatusLabel(status: CodePlatformOrder['refundStatus']) {
  const labels: Record<CodePlatformOrder['refundStatus'], string> = {
    none: '无退款',
    refunding: '退款中',
    refunded: '已退款'
  };
  return labels[status];
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
  density.value = 'default';
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
  if (!canCreateCodeOrder.value) {
    ElMessage.warning('当前账号没有手工导入订单权限，或缺少来源平台查看权限');
    return;
  }

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
  if (canViewDeliveryLogs.value) {
    await loadDeliveryLogs(order.id);
  } else {
    deliveryLogs.value = [];
  }
  detailVisible.value = true;
}

async function loadDeliveryLogs(orderId: string) {
  if (!canViewDeliveryLogs.value) {
    deliveryLogs.value = [];
    return;
  }

  try {
    const data = await codeOrdersApi.listOrderDeliveryLogs(orderId);
    deliveryLogs.value = data.items;
  } catch (error) {
    deliveryLogs.value = [];
    ElMessage.error(error instanceof Error ? error.message : '加载发货记录失败');
  }
}

async function saveOrder() {
  if (!canCreateCodeOrder.value) {
    ElMessage.warning('当前账号没有手工导入订单权限，或缺少来源平台查看权限');
    return;
  }

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
  if (!canDeliverCodeOrders.value) {
    ElMessage.warning('当前账号没有匹配锁码权限');
    return;
  }

  try {
    await codeOrdersApi.matchCode(order.id);
    ElMessage.success('已匹配并锁定兑换码');
    await loadOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '匹配锁码失败');
  }
}

function openGenerate(order: CodePlatformOrder) {
  if (!canDeliverCodeOrders.value) {
    ElMessage.warning('当前账号没有生成发货内容权限');
    return;
  }

  selectedOrder.value = order;
  generatedOrderId.value = order.id;
  generateForm.reason = '';
  generateForm.content = '';
  generateDialogVisible.value = true;
}

function openDeliver(order: CodePlatformOrder) {
  if (!canDeliverCodeOrders.value) {
    ElMessage.warning('当前账号没有确认发货权限');
    return;
  }

  selectedOrder.value = order;
  deliverForm.deliveryMethod = getDefaultDeliveryMethod();
  deliverForm.deliveryContent =
    generatedOrderId.value === order.id && generateForm.content ? generateForm.content : '';
  deliverDialogVisible.value = true;
}

async function generateDelivery() {
  if (!canDeliverCodeOrders.value) {
    ElMessage.warning('当前账号没有生成发货内容权限');
    return;
  }

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
    ElMessage.success('发货内容已生成，查看记录已保存');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成发货内容失败');
  } finally {
    generating.value = false;
  }
}

async function confirmDeliveryFromGenerated() {
  if (!canDeliverCodeOrders.value) {
    ElMessage.warning('当前账号没有确认发货权限');
    return;
  }

  if (!selectedOrder.value || !generateForm.content) {
    return;
  }

  deliverForm.deliveryMethod = getDefaultDeliveryMethod();
  deliverForm.deliveryContent = generateForm.content;
  await confirmDelivery();
}

async function confirmDelivery() {
  if (!canDeliverCodeOrders.value) {
    ElMessage.warning('当前账号没有确认发货权限');
    return;
  }

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
    ElMessage.success('已确认发货并保存发货记录');
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

function hasCodeOrderPermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

function readRouteQueryString(value: unknown) {
  const normalized = Array.isArray(value) ? value[0] : value;
  return typeof normalized === 'string' ? normalized : undefined;
}

function hasRouteOrderFilters() {
  return ['keyword', 'platformId', 'deliveryStatus'].some((key) => route.query[key] !== undefined);
}

function isDeliveryStatusFilter(value?: string): value is CodePlatformOrder['deliveryStatus'] {
  return deliveryStatusOptions.some((option) => option.value === value);
}

function applyRouteOrderFilters() {
  if (!hasRouteOrderFilters()) {
    return false;
  }

  const deliveryStatus = readRouteQueryString(route.query.deliveryStatus);

  query.page = 1;
  query.keyword = readRouteQueryString(route.query.keyword) ?? '';
  query.platformId = readRouteQueryString(route.query.platformId) ?? '';
  query.deliveryStatus = isDeliveryStatusFilter(deliveryStatus) ? deliveryStatus : '';
  savedViewId.value = '';
  return true;
}

async function initializePage() {
  try {
    const routeFiltersApplied = applyRouteOrderFilters();

    await Promise.all([
      loadDependencies({ force: false }),
      loadDeliveryMethods({ force: false }),
      loadTableViews(!routeFiltersApplied)
    ]);
    if (routeFiltersApplied) {
      applyRouteOrderFilters();
    }
    await loadOrders({ force: false });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载兑换码订单失败');
  }
}

onMounted(initializePage);

watch(
  () => route.query,
  () => {
    if (applyRouteOrderFilters()) {
      void loadOrders({ force: true });
    }
  }
);

usePageRefresh(
  (options) =>
    reloadAll({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '兑换码订单列表' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['code-orders', 'code-services', 'code-order-dependencies', 'data-dictionaries'],
  () => {
    void reloadAll({
      background:
        orders.value.length > 0 ||
        platforms.value.length > 0 ||
        services.value.length > 0 ||
        deliveryMethodDictionaries.value.length > 0,
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

.code-operation-notice {
  margin: 12px 0 14px;
}

@media (max-width: 840px) {
  .code-compact-list-panel .inline-actions {
    justify-content: flex-start;
  }
}
</style>
