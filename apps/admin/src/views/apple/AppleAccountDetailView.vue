<template>
  <PageScaffold
    title="Apple ID 详情"
    group="Apple ID 业务"
    phase="Phase 3"
    description="聚合单个 Apple ID 的余额成本、充值消费、订单、开通记录、续费任务和操作计划。"
  >
    <template #actions>
      <StatusChip :tone="account ? getAccountStatusTone(account.status) : 'neutral'" dot>
        {{ account ? getAccountStatusLabel(account.status) : '待选择账号' }}
      </StatusChip>
      <AppButton @click="goBack">返回列表</AppButton>
      <AppButton :disabled="!accountId" :loading="accountLoading" @click="loadDetail">
        刷新
      </AppButton>
    </template>

    <AppCard
      v-if="!accountId"
      empty
      state-compact
      empty-title="请先选择 Apple ID"
      empty-description="从 Apple ID 管理列表进入详情页后，可以查看余额成本、敏感资料和关联业务。"
    >
      <template #state-actions>
        <AppButton variant="primary" @click="goBack">去选择 Apple ID</AppButton>
      </template>
    </AppCard>

    <AppCard v-else-if="loadError" :error="loadError" state-compact error-title="加载失败">
      <template #state-actions>
        <AppButton @click="goBack">返回列表</AppButton>
        <AppButton variant="primary" @click="loadDetail">重新加载</AppButton>
      </template>
    </AppCard>

    <AppCard
      v-else-if="accountLoading && !account"
      loading
      state-compact
      loading-title="正在加载 Apple ID 详情"
      loading-description="正在读取余额、成本、订单、开通记录和续费任务。"
    />

    <template v-else-if="account">
      <section class="content-panel apple-compact-list-panel">
        <div class="panel-title-row">
          <div>
            <h3>账号运营概览</h3>
            <p>余额、成本、关联业务和续费风险集中展示，敏感资料仍按权限审计查看。</p>
          </div>
          <div class="inline-actions">
            <StatusChip tone="green">余额 {{ account.currentBalance }}</StatusChip>
            <StatusChip tone="orange">成本 {{ account.balanceCostAmount }}</StatusChip>
            <StatusChip tone="blue">均价 {{ account.averageCost }}</StatusChip>
            <StatusChip :tone="account.isManuallyLocked ? 'red' : 'purple'">
              关联业务 {{ activationTotal }}
            </StatusChip>
            <StatusChip tone="cyan">充值 {{ topupTotal }}</StatusChip>
            <StatusChip tone="neutral">消费 {{ consumptionTotal }}</StatusChip>
            <StatusChip :tone="openWorkTotal ? 'orange' : 'green'"
              >待办 {{ openWorkTotal }}</StatusChip
            >
          </div>
        </div>

        <div class="apple-core-alert-stack">
          <div
            class="apple-core-alert"
            :class="account.isManuallyLocked ? 'apple-core-alert--red' : 'apple-core-alert--green'"
          >
            <StatusChip :tone="account.isManuallyLocked ? 'red' : 'green'">
              {{ account.isManuallyLocked ? '锁定' : '正常' }}
            </StatusChip>
            <div>
              <strong>锁定状态影响自动匹配</strong>
              <p>手动锁定账号需要先完成检测和备注核对，再进入订单录入匹配。</p>
            </div>
          </div>
          <div class="apple-core-alert apple-core-alert--purple">
            <StatusChip tone="purple">敏感</StatusChip>
            <div>
              <strong>敏感字段默认脱敏</strong>
              <p>密码、密保、手机号和备用邮箱只显示保存状态，完整内容需在账号管理查看。</p>
            </div>
          </div>
          <div class="apple-core-alert apple-core-alert--blue">
            <StatusChip tone="blue">闭环</StatusChip>
            <div>
              <strong>关联数据按业务模块处理</strong>
              <p>订单、开通、续费任务和操作计划仍回到各自模块完成处理。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="content-panel">
        <div class="panel-title-row">
          <div>
            <h3>{{ account.appleIdMasked }}</h3>
            <p>尾号 {{ account.appleIdTail }} · {{ account.region }} · {{ account.currency }}</p>
          </div>
          <div class="inline-actions">
            <StatusChip :tone="getAccountStatusTone(account.status)" dot>
              {{ getAccountStatusLabel(account.status) }}
            </StatusChip>
            <StatusChip :tone="account.isManuallyLocked ? 'red' : 'green'" dot>
              {{ account.isManuallyLocked ? '手动锁定' : '未锁定' }}
            </StatusChip>
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

        <div class="drawer-section">
          <div class="drawer-section__title">资料状态</div>
          <el-descriptions class="detail-descriptions" :column="1" border>
            <el-descriptions-item label="敏感资料状态">
              <StatusChip v-if="account.hasPassword" class="tag-gap" tone="purple">密码</StatusChip>
              <StatusChip v-if="account.hasSecurityInfo" class="tag-gap" tone="orange">
                密保
              </StatusChip>
              <StatusChip v-if="account.hasPhone" class="tag-gap" tone="blue">手机</StatusChip>
              <StatusChip v-if="account.hasRecoveryEmail" class="tag-gap" tone="cyan">
                备用邮箱
              </StatusChip>
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
        </div>
      </section>

      <section v-loading="relatedLoading" class="content-panel">
        <div class="panel-title-row">
          <div>
            <h3>关联业务数据</h3>
            <p>展示最近记录，完整处理仍在各业务模块完成。</p>
          </div>
          <StatusChip tone="green" dot>关联同步</StatusChip>
        </div>

        <el-tabs v-model="activeTab" class="system-tabs account-detail-tabs">
          <el-tab-pane :label="`充值记录 ${topupTotal}`" name="topups">
            <el-table class="desktop-data-table" :data="topups" row-key="id">
              <el-table-column prop="faceValue" label="面值" width="100" />
              <el-table-column prop="costAmount" label="成本" width="100" />
              <el-table-column prop="balanceAfter" label="充值后余额" width="130" />
              <el-table-column prop="avgCostAfter" label="充值后均价" width="130" />
              <el-table-column label="礼品卡代码" width="150">
                <template #default="{ row }">
                  <StatusChip v-if="row.hasGiftCardCode" tone="purple">
                    尾号 {{ row.giftCardCodeTail ?? '-' }}
                  </StatusChip>
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
            <div v-if="topups.length" class="mobile-record-list" aria-label="充值记录移动列表">
              <article v-for="topup in topups" :key="topup.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>充值 {{ topup.faceValue }}</strong>
                    <span>{{ topup.remark || '暂无备注' }}</span>
                  </div>
                  <StatusChip v-if="topup.hasGiftCardCode" tone="purple">
                    尾号 {{ topup.giftCardCodeTail ?? '-' }}
                  </StatusChip>
                  <StatusChip v-else tone="neutral">无代码</StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>成本</span>
                    <strong>{{ topup.costAmount }}</strong>
                  </div>
                  <div>
                    <span>充值后余额</span>
                    <strong>{{ topup.balanceAfter }}</strong>
                  </div>
                  <div>
                    <span>充值后均价</span>
                    <strong>{{ topup.avgCostAfter }}</strong>
                  </div>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>时间</span>
                    <strong>{{ formatDate(topup.createdAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="充值记录空状态">
              <div class="apple-core-empty-state">
                <strong>暂无充值记录</strong>
                <span>充值后会显示面值、成本、均价和礼品卡尾号。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`消费记录 ${consumptionTotal}`" name="consumptions">
            <el-table class="desktop-data-table" :data="consumptions" row-key="id">
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
            <div
              v-if="consumptions.length"
              class="mobile-record-list"
              aria-label="消费记录移动列表"
            >
              <article
                v-for="consumption in consumptions"
                :key="consumption.id"
                class="mobile-record-card"
              >
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>消费 {{ consumption.amount }}</strong>
                    <span>{{ consumption.reason || '暂无原因' }}</span>
                  </div>
                  <StatusChip tone="orange">扣减</StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>扣减成本</span>
                    <strong>{{ consumption.costAmount }}</strong>
                  </div>
                  <div>
                    <span>消费均价</span>
                    <strong>{{ consumption.avgUnitCost }}</strong>
                  </div>
                  <div>
                    <span>消费后余额</span>
                    <strong>{{ consumption.balanceAfter }}</strong>
                  </div>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>关联对象</span>
                    <strong>
                      {{ consumption.relatedObjectType || '-' }}
                      {{ consumption.relatedObjectId || '' }}
                    </strong>
                  </div>
                  <div>
                    <span>时间</span>
                    <strong>{{ formatDate(consumption.createdAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="消费记录空状态">
              <div class="apple-core-empty-state">
                <strong>暂无消费记录</strong>
                <span>订单消耗余额后会显示消费成本和关联对象。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`余额修正 ${adjustmentTotal}`" name="adjustments">
            <el-table class="desktop-data-table" :data="adjustments" row-key="id">
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
            <div v-if="adjustments.length" class="mobile-record-list" aria-label="余额修正移动列表">
              <article
                v-for="adjustment in adjustments"
                :key="adjustment.id"
                class="mobile-record-card"
              >
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ adjustment.oldBalance }} -> {{ adjustment.newBalance }}</strong>
                    <span>{{ adjustment.reason }}</span>
                  </div>
                  <StatusChip tone="blue">
                    {{ getCostAdjustMethodLabel(adjustment.costAdjustMethod) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>余额差额</span>
                    <strong>{{ adjustment.difference }}</strong>
                  </div>
                  <div>
                    <span>成本变化</span>
                    <strong>{{ adjustment.costRmbChange }}</strong>
                  </div>
                  <div>
                    <span>操作人</span>
                    <strong>{{ adjustment.operator?.displayName ?? '-' }}</strong>
                  </div>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>时间</span>
                    <strong>{{ formatDate(adjustment.createdAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="余额修正空状态">
              <div class="apple-core-empty-state">
                <strong>暂无余额修正</strong>
                <span>余额对账产生的修正记录会显示在这里。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`状态检测 ${statusCheckTotal}`" name="statusChecks">
            <el-table class="desktop-data-table" :data="statusChecks" row-key="id">
              <el-table-column label="检测类型" width="110">
                <template #default="{ row }">{{ getCheckTypeLabel(row.checkType) }}</template>
              </el-table-column>
              <el-table-column label="结果状态" width="120">
                <template #default="{ row }">
                  <StatusChip :tone="getAccountStatusTone(row.resultStatus)" dot>
                    {{ getAccountStatusLabel(row.resultStatus) }}
                  </StatusChip>
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
            <div
              v-if="statusChecks.length"
              class="mobile-record-list"
              aria-label="状态检测移动列表"
            >
              <article v-for="check in statusChecks" :key="check.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ getCheckTypeLabel(check.checkType) }}</strong>
                    <span>{{ check.remark || '暂无备注' }}</span>
                  </div>
                  <StatusChip :tone="getAccountStatusTone(check.resultStatus)" dot>
                    {{ getAccountStatusLabel(check.resultStatus) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>余额快照</span>
                    <strong>{{ check.balanceSnapshot ?? '-' }}</strong>
                  </div>
                  <div>
                    <span>操作人</span>
                    <strong>{{ check.operator?.displayName ?? '-' }}</strong>
                  </div>
                  <div>
                    <span>时间</span>
                    <strong>{{ formatDate(check.createdAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="状态检测空状态">
              <div class="apple-core-empty-state">
                <strong>暂无状态检测</strong>
                <span>人工或自动检测完成后会显示结果状态。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`订单 ${orderTotal}`" name="orders">
            <el-table class="desktop-data-table" :data="orders" row-key="id">
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
                  <StatusChip :tone="getOrderStatusTone(row.status)" dot>
                    {{ getOrderStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="创建时间" min-width="170">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
            <div v-if="orders.length" class="mobile-record-list" aria-label="Apple ID 订单移动列表">
              <article v-for="order in orders" :key="order.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ order.orderNo }}</strong>
                    <span>{{ order.externalOrderNo || '无外部订单号' }}</span>
                  </div>
                  <StatusChip :tone="getOrderStatusTone(order.status)" dot>
                    {{ getOrderStatusLabel(order.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>客户/业务</span>
                    <strong>{{ order.customer.name }} · {{ order.service.name }}</strong>
                  </div>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>实收</span>
                    <strong>{{ order.paidAmount }}</strong>
                  </div>
                  <div>
                    <span>成本</span>
                    <strong>{{ order.appleCostRmb }}</strong>
                  </div>
                  <div>
                    <span>利润</span>
                    <strong>{{ order.profitAmount }}</strong>
                  </div>
                  <div>
                    <span>创建时间</span>
                    <strong>{{ formatDate(order.createdAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="订单记录空状态">
              <div class="apple-core-empty-state">
                <strong>暂无订单</strong>
                <span>该 Apple ID 暂未匹配订单。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`开通记录 ${activationTotal}`" name="activations">
            <el-table class="desktop-data-table" :data="activations" row-key="id">
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
                  <StatusChip :tone="getActivationStatusTone(row.status)" dot>
                    {{ getActivationStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
            </el-table>
            <div
              v-if="activations.length"
              class="mobile-record-list"
              aria-label="Apple ID 开通记录移动列表"
            >
              <article
                v-for="activation in activations"
                :key="activation.id"
                class="mobile-record-card"
              >
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ activation.customer.name }}</strong>
                    <span>{{ activation.service.name }}</span>
                  </div>
                  <StatusChip :tone="getActivationStatusTone(activation.status)" dot>
                    {{ getActivationStatusLabel(activation.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>计划</span>
                    <strong>
                      {{ activation.currentPlan || '-' }} -> {{ activation.targetPlan || '-' }}
                    </strong>
                  </div>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>消耗</span>
                    <strong>{{ activation.consumedValue }}</strong>
                  </div>
                  <div>
                    <span>利润</span>
                    <strong>{{ activation.profitAmount }}</strong>
                  </div>
                  <div>
                    <span>到期时间</span>
                    <strong>{{ formatDate(activation.expireTime) }}</strong>
                  </div>
                  <div>
                    <span>续费决定</span>
                    <strong>{{ getRenewalDecisionLabel(activation.renewalDecision) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="开通记录空状态">
              <div class="apple-core-empty-state">
                <strong>暂无开通记录</strong>
                <span>该 Apple ID 暂未关联开通业务。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`续费任务 ${renewalTaskTotal}`" name="renewalTasks">
            <el-table class="desktop-data-table" :data="renewalTasks" row-key="id">
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
                  <StatusChip :tone="getPriorityTone(row.priority)" dot>
                    {{ getPriorityLabel(row.priority) }}
                  </StatusChip>
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
                  <StatusChip :tone="getTaskStatusTone(row.status)" dot>
                    {{ getTaskStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
            </el-table>
            <div
              v-if="renewalTasks.length"
              class="mobile-record-list"
              aria-label="Apple ID 续费任务移动列表"
            >
              <article v-for="task in renewalTasks" :key="task.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ task.title }}</strong>
                    <span>{{ task.requiredAction || '-' }}</span>
                  </div>
                  <StatusChip :tone="getTaskStatusTone(task.status)" dot>
                    {{ getTaskStatusLabel(task.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__meta">
                  <div>
                    <span>客户/业务</span>
                    <strong>{{ task.customer.name }} · {{ task.service.name }}</strong>
                  </div>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>优先级</span>
                    <strong>{{ getPriorityLabel(task.priority) }}</strong>
                  </div>
                  <div>
                    <span>客户决定</span>
                    <strong>{{ getCustomerDecisionLabel(task.customerDecision) }}</strong>
                  </div>
                  <div>
                    <span>截止时间</span>
                    <strong>{{ formatDate(task.dueAt) }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="续费任务空状态">
              <div class="apple-core-empty-state">
                <strong>暂无续费任务</strong>
                <span>关联业务到期前会生成续费任务。</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`操作计划 ${actionPlanTotal}`" name="actionPlans">
            <el-table class="desktop-data-table" :data="actionPlans" row-key="id">
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
                  <StatusChip :tone="row.hasWrongChargeRisk ? 'red' : 'green'" dot>
                    {{ row.hasWrongChargeRisk ? '有风险' : '正常' }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="110">
                <template #default="{ row }">
                  <StatusChip :tone="getPlanStatusTone(row.status)" dot>
                    {{ getPlanStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
            </el-table>
            <div
              v-if="actionPlans.length"
              class="mobile-record-list"
              aria-label="Apple ID 操作计划移动列表"
            >
              <article v-for="plan in actionPlans" :key="plan.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>{{ formatDate(plan.planDate, true) }}</strong>
                    <span>
                      开通 {{ plan.activeServiceCount }} · 续费 {{ plan.renewServicesCount }} · 取消
                      {{ plan.cancelServicesCount }}
                    </span>
                  </div>
                  <StatusChip :tone="getPlanStatusTone(plan.status)" dot>
                    {{ getPlanStatusLabel(plan.status) }}
                  </StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>预计续费</span>
                    <strong>{{ plan.requiredRenewalAmount }}</strong>
                  </div>
                  <div>
                    <span>建议充值</span>
                    <strong>{{ plan.suggestedTopupAmount }}</strong>
                  </div>
                  <div>
                    <span>等客户</span>
                    <strong>{{ plan.pendingCustomerCount }}</strong>
                  </div>
                  <div>
                    <span>风险</span>
                    <strong>{{ plan.hasWrongChargeRisk ? '有风险' : '正常' }}</strong>
                  </div>
                </div>
              </article>
            </div>
            <div v-else class="mobile-record-list" aria-label="操作计划空状态">
              <div class="apple-core-empty-state">
                <strong>暂无操作计划</strong>
                <span>续费计划生成后会显示预计续费和建议充值。</span>
              </div>
            </div>
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
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
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

type ChipTone = 'green' | 'orange' | 'red' | 'neutral' | 'blue' | 'purple';

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
const openWorkTotal = computed(() => renewalTaskTotal.value + actionPlanTotal.value);

const accountStatusOptions: Record<
  AppleAccount['status'],
  {
    label: string;
    tone: ChipTone;
  }
> = {
  normal: { label: '正常', tone: 'green' },
  need_verify: { label: '需要验证', tone: 'orange' },
  locked: { label: '已锁定', tone: 'red' },
  password_error: { label: '密码错误', tone: 'red' },
  risk: { label: '风险', tone: 'orange' },
  unknown: { label: '未知', tone: 'neutral' }
};

const orderStatusOptions: Record<
  AppleOrder['status'],
  {
    label: string;
    tone: ChipTone;
  }
> = {
  pending: { label: '待处理', tone: 'orange' },
  active: { label: '已开通', tone: 'green' },
  completed: { label: '已完成', tone: 'green' },
  cancelled: { label: '已取消', tone: 'neutral' },
  abnormal: { label: '异常', tone: 'red' }
};

const activationStatusOptions: Record<
  ServiceActivation['status'],
  {
    label: string;
    tone: ChipTone;
  }
> = {
  active: { label: '生效中', tone: 'green' },
  expired: { label: '已到期', tone: 'orange' },
  cancelled: { label: '已取消', tone: 'neutral' },
  abnormal: { label: '异常', tone: 'red' }
};

const taskStatusOptions: Record<
  RenewalTask['status'],
  {
    label: string;
    tone: ChipTone;
  }
> = {
  pending: { label: '待处理', tone: 'orange' },
  processing: { label: '处理中', tone: 'blue' },
  waiting_customer: { label: '等客户', tone: 'orange' },
  waiting_payment: { label: '等收款', tone: 'orange' },
  waiting_auto_renewal: { label: '等自动续费', tone: 'blue' },
  waiting_manual_verify: { label: '等人工验证', tone: 'orange' },
  completed: { label: '已完成', tone: 'green' },
  cancelled: { label: '已取消', tone: 'neutral' },
  failed: { label: '失败', tone: 'red' },
  abnormal: { label: '异常', tone: 'red' },
  postponed: { label: '已延期', tone: 'neutral' }
};

const priorityOptions: Record<
  RenewalTask['priority'],
  {
    label: string;
    tone: ChipTone;
  }
> = {
  low: { label: '低', tone: 'neutral' },
  medium: { label: '中', tone: 'blue' },
  high: { label: '高', tone: 'orange' },
  urgent: { label: '紧急', tone: 'red' }
};

const planStatusOptions: Record<
  AppleActionPlan['status'],
  {
    label: string;
    tone: ChipTone;
  }
> = {
  pending: { label: '待处理', tone: 'orange' },
  processing: { label: '处理中', tone: 'blue' },
  completed: { label: '已完成', tone: 'green' },
  abnormal: { label: '异常', tone: 'red' }
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
    loadError.value = getAccountDetailErrorMessage(error);
    ElMessage.error(loadError.value);
  } finally {
    accountLoading.value = false;
  }
}

function getAccountDetailErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (/internal server error|not found|404|不存在/i.test(message)) {
    return 'Apple ID 账号不存在或已被删除，请返回列表重新选择。';
  }

  return message || '加载 Apple ID 详情失败，请稍后重试。';
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

function getAccountStatusTone(status: AppleAccount['status']) {
  return accountStatusOptions[status]?.tone ?? 'neutral';
}

function getOrderStatusLabel(status: AppleOrder['status']) {
  return orderStatusOptions[status]?.label ?? status;
}

function getOrderStatusTone(status: AppleOrder['status']) {
  return orderStatusOptions[status]?.tone ?? 'neutral';
}

function getActivationStatusLabel(status: ServiceActivation['status']) {
  return activationStatusOptions[status]?.label ?? status;
}

function getActivationStatusTone(status: ServiceActivation['status']) {
  return activationStatusOptions[status]?.tone ?? 'neutral';
}

function getTaskStatusLabel(status: RenewalTask['status']) {
  return taskStatusOptions[status]?.label ?? status;
}

function getTaskStatusTone(status: RenewalTask['status']) {
  return taskStatusOptions[status]?.tone ?? 'neutral';
}

function getPriorityLabel(priority: RenewalTask['priority']) {
  return priorityOptions[priority]?.label ?? priority;
}

function getPriorityTone(priority: RenewalTask['priority']) {
  return priorityOptions[priority]?.tone ?? 'neutral';
}

function getPlanStatusLabel(status: AppleActionPlan['status']) {
  return planStatusOptions[status]?.label ?? status;
}

function getPlanStatusTone(status: AppleActionPlan['status']) {
  return planStatusOptions[status]?.tone ?? 'neutral';
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
