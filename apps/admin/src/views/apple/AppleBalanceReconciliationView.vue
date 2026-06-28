<template>
  <PageScaffold
    title="Apple ID 余额对账"
    group="Apple ID 业务"
    phase="Phase 3"
    description="处理人工或自动查询发现的余额差异，支持只修余额、按当前均价修正和手动总成本修正。"
  >
    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="余额对账工作台"
          :help="[
            '这里不是给 ID 充值，而是实际查到的余额和系统里记的不一样时，用来把账改准。',
            '会一起核对系统余额、实际余额和人民币总成本，每次修正都会留下记录，方便以后追查。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>账号 {{ total }}</StatusChip>
          <StatusChip tone="green">余额 {{ totalBalance }}</StatusChip>
          <StatusChip tone="orange">总成本 {{ totalCost }}</StatusChip>
          <StatusChip tone="purple">均价 {{ averageCostPreview }}</StatusChip>
          <StatusChip tone="green">可对账 {{ reconcilableCount }}</StatusChip>
          <StatusChip :tone="lockedCount > 0 ? 'red' : 'green'" dot>
            {{ lockedCount > 0 ? `锁定 ${lockedCount}` : '锁定正常' }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="accountColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedAccounts.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-primary="false"
        placeholder="搜索 Apple ID、地区、币种、备注"
        @search="applyFilters"
        @refresh="loadAccounts"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-input
            v-model.trim="query.currency"
            class="table-toolbar__select"
            placeholder="币种"
            clearable
            @keyup.enter="applyFilters"
            @clear="applyFilters"
          />
          <el-select
            v-model="query.locked"
            class="table-toolbar__select"
            clearable
            placeholder="手动锁定"
            @change="applyFilters"
          >
            <el-option label="已锁定" value="true" />
            <el-option label="未锁定" value="false" />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="accounts"
        :size="tableSize"
        row-key="id"
        empty-text="暂无 Apple ID"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无需要对账的 Apple ID</strong>
            <span>可以清空筛选后查看账号，或回到 Apple ID 管理新增账号。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="router.push('/apple/accounts')">
                Apple ID 管理
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('appleId')"
          prop="appleId"
          label="Apple ID"
          min-width="190"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.appleIdMasked }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('region')"
          prop="region"
          label="地区/币种"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{
            formatAccountRegionCurrency(row.region, row.currency)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('currentBalance')"
          prop="currentBalance"
          label="系统余额"
          width="120"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              系统余额
              <FeatureHelp
                text="系统目前认为这个 Apple ID 还剩多少余额。和你人工查到的不一样时，再走修正。"
              />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('balanceCostAmount')"
          prop="balanceCostAmount"
          label="人民币总成本"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              人民币总成本
              <FeatureHelp
                text="系统认为这些剩余余额一共对应多少人民币成本。这里不是平均成本，是总金额。"
              />
            </span>
          </template>
          <template #default="{ row }">{{ getAccountTotalCostAmount(row) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('averageCost')"
          prop="averageCost"
          label="平均成本"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              平均成本
              <FeatureHelp
                text="每 1 美元 Apple 余额大概对应多少人民币成本。算订单利润会用到它。"
              />
            </span>
          </template>
          <template #default="{ row }">{{ getAccountAverageCost(row) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('isManuallyLocked')"
          prop="isManuallyLocked"
          label="锁定"
          width="100"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              锁定
              <FeatureHelp text="已锁定的 ID 一般在排查或预留中，修正前最好先确认原因。" />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="row.isManuallyLocked ? 'red' : 'green'" dot>
              {{ row.isManuallyLocked ? '已锁定' : '正常' }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('updatedAt')"
          prop="updatedAt"
          label="更新时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="96" fixed="right">
          <template #default="{ row }">
            <div class="account-operation-cell">
              <AppButton size="small" variant="soft" @click="openReconciliationActions(row)">
                操作
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="accounts.length" class="mobile-record-list" aria-label="余额对账账号移动列表">
        <article v-for="account in accounts" :key="account.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ account.appleIdMasked }}</strong>
              <span>{{ formatAccountRegionCurrency(account.region, account.currency) }}</span>
            </div>
            <StatusChip :tone="getStatusTone(account.status)" dot>
              {{ getStatusLabel(account.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>系统余额</span>
              <strong>{{ account.currentBalance }}</strong>
            </div>
            <div>
              <span>人民币总成本</span>
              <strong>{{ getAccountTotalCostAmount(account) }}</strong>
            </div>
            <div>
              <span>平均成本</span>
              <strong>{{ getAccountAverageCost(account) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>锁定状态</span>
              <StatusChip :tone="account.isManuallyLocked ? 'red' : 'green'" dot>
                {{ account.isManuallyLocked ? '已锁定' : '正常' }}
              </StatusChip>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(account.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="soft" @click="openReconciliationActions(account)">
              打开操作
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="余额对账空状态">
        <div class="apple-core-empty-state">
          <strong>暂无需要对账的 Apple ID</strong>
          <span>可以清空筛选后查看账号，或回到 Apple ID 管理新增账号。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="router.push('/apple/accounts')">
              Apple ID 管理
            </AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadAccounts"
      />
    </section>

    <AppDrawer
      v-model="actionDrawerVisible"
      title="余额对账操作"
      description="先确认账号和成本口径，再选择下一步处理。"
      eyebrow="余额对账"
      size="560px"
      :show-confirm="false"
    >
      <div v-if="selectedAccount" class="account-action-panel">
        <section class="account-action-hero" aria-label="当前对账账号">
          <div class="account-action-hero__top">
            <span class="account-action-eyebrow">当前账号</span>
            <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
              {{ getStatusLabel(selectedAccount.status) }}
            </StatusChip>
          </div>
          <strong class="account-action-hero__id">{{ selectedAccount.appleIdMasked }}</strong>
          <div class="account-action-tags">
            <span>{{
              formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
            }}</span>
            <span :class="{ 'account-action-tag--warning': selectedAccount.isManuallyLocked }">
              {{ selectedAccount.isManuallyLocked ? '手动锁定' : '可对账' }}
            </span>
          </div>
        </section>

        <section class="account-action-metrics" aria-label="余额和成本">
          <div class="account-action-metric account-action-metric--balance">
            <div>
              <span>系统余额</span>
              <strong>{{ selectedAccount.currentBalance }}</strong>
            </div>
            <em>{{ selectedAccount.currency }}</em>
          </div>
          <div class="account-action-metric">
            <div>
              <span>总成本</span>
              <strong>{{ getAccountTotalCostAmount(selectedAccount) }}</strong>
            </div>
            <em>CNY</em>
          </div>
          <div class="account-action-metric">
            <div>
              <span>均价</span>
              <strong>{{ getAccountAverageCost(selectedAccount) }}</strong>
            </div>
            <em>CNY / {{ selectedAccount.currency }}</em>
          </div>
        </section>

        <section class="account-action-section" aria-label="对账处理">
          <div class="account-action-section__head">
            <strong>对账处理</strong>
            <p>修正余额会更新账号余额和成本；查看记录只读，不会改账。</p>
          </div>

          <button
            v-if="canAdjustAppleBalance"
            type="button"
            class="account-action-primary"
            @click="openAdjustDialog(selectedAccount)"
          >
            <span class="account-action-icon account-action-icon--primary">
              <el-icon><EditPen /></el-icon>
            </span>
            <span>
              <strong>修正余额</strong>
              <small>按实际查到的余额改准系统记录，同时处理人民币总成本。</small>
            </span>
          </button>

          <div class="account-action-secondary-grid">
            <button
              type="button"
              class="account-action-card"
              @click="openAdjustmentRecords(selectedAccount)"
            >
              <span class="account-action-icon">
                <el-icon><Tickets /></el-icon>
              </span>
              <span>
                <strong>修正记录</strong>
                <small>查看每一次余额和成本变化，追溯操作来源。</small>
              </span>
            </button>
            <button type="button" class="account-action-card" @click="openDetail(selectedAccount)">
              <span class="account-action-icon">
                <el-icon><View /></el-icon>
              </span>
              <span>
                <strong>账号详情</strong>
                <small>先快速查看账号信息，需要完整内容再打开详情页。</small>
              </span>
            </button>
          </div>
        </section>

        <div class="account-action-note">
          <StatusChip tone="blue">提示</StatusChip>
          <p>建议先核对实际余额，再修正系统记录；需要追查历史时先看修正记录。</p>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="`账号详情 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="这里展示对账最常用的信息，需要完整业务历史时再打开详情页。"
      eyebrow="详情预览"
      size="620px"
      confirm-text="打开完整详情页"
      @confirm="openSelectedDetailPage"
    >
      <div v-if="selectedAccount" class="account-detail-drawer">
        <section class="account-detail-summary">
          <div class="account-detail-summary__main">
            <div class="account-detail-summary__top">
              <span class="account-action-eyebrow">对账账号</span>
              <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
                {{ getStatusLabel(selectedAccount.status) }}
              </StatusChip>
            </div>
            <strong>{{ selectedAccount.appleIdMasked }}</strong>
            <div class="account-action-tags">
              <span>{{
                formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
              }}</span>
              <span>{{ getOwnershipTypeLabel(selectedAccount.ownershipType) }}</span>
              <span :class="{ 'account-action-tag--warning': selectedAccount.isManuallyLocked }">
                {{ selectedAccount.isManuallyLocked ? '手动锁定' : '未锁定' }}
              </span>
            </div>
          </div>
          <div class="account-detail-summary__balance">
            <span>系统余额</span>
            <strong>{{ selectedAccount.currentBalance }}</strong>
            <small>{{ selectedAccount.currency }}</small>
          </div>
        </section>

        <section class="account-action-metrics" aria-label="账号资产指标">
          <div class="account-action-metric account-action-metric--balance">
            <div>
              <span>系统余额</span>
              <strong>{{ selectedAccount.currentBalance }}</strong>
            </div>
            <em>{{ selectedAccount.currency }}</em>
          </div>
          <div class="account-action-metric">
            <div>
              <span>人民币总成本</span>
              <strong>{{ getAccountTotalCostAmount(selectedAccount) }}</strong>
            </div>
            <em>CNY</em>
          </div>
          <div class="account-action-metric">
            <div>
              <span>平均成本</span>
              <strong>{{ getAccountAverageCost(selectedAccount) }}</strong>
            </div>
            <em>CNY / {{ selectedAccount.currency }}</em>
          </div>
        </section>

        <section class="account-detail-section">
          <div class="account-detail-section__head">
            <strong>账号资料</strong>
            <span>{{ formatDate(selectedAccount.updatedAt) }}</span>
          </div>
          <div class="account-detail-info-grid">
            <div>
              <span>地区/币种</span>
              <strong>{{
                formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
              }}</strong>
            </div>
            <div>
              <span>来源</span>
              <strong>{{ getAccountSourceText(selectedAccount) }}</strong>
            </div>
            <div>
              <span>账号类型</span>
              <strong>{{ getOwnershipTypeLabel(selectedAccount.ownershipType) }}</strong>
            </div>
            <div>
              <span>锁定原因</span>
              <strong>{{ selectedAccount.manualLockReason || '-' }}</strong>
            </div>
          </div>
          <div class="account-detail-profile">
            <span>资料完整度</span>
            <strong>{{ getAccountProfileSummary(selectedAccount) }}</strong>
            <div class="account-detail-profile__chips">
              <span :class="{ active: selectedAccount.hasPassword }">密码</span>
              <span :class="{ active: selectedAccount.hasSecurityInfo }">密保</span>
              <span :class="{ active: selectedAccount.hasPhone }">手机号</span>
              <span :class="{ active: selectedAccount.hasRecoveryEmail }">备用邮箱</span>
            </div>
          </div>
        </section>

        <section class="account-detail-section">
          <div class="account-detail-section__head">
            <strong>资产口径</strong>
            <span>移动平均成本</span>
          </div>
          <div class="account-detail-info-grid">
            <div>
              <span>ID 购入成本</span>
              <strong>{{ selectedAccount.purchaseCost }} CNY</strong>
            </div>
            <div>
              <span>ID 售卖价格</span>
              <strong>{{ selectedAccount.salePrice }} CNY</strong>
            </div>
            <div>
              <span>售出时间</span>
              <strong>{{ formatDate(selectedAccount.soldAt) }}</strong>
            </div>
            <div>
              <span>备注</span>
              <strong>{{ selectedAccount.remark || '-' }}</strong>
            </div>
          </div>
        </section>

        <section class="account-detail-quick-actions" aria-label="账号详情快捷操作">
          <button
            v-if="canAdjustAppleBalance"
            type="button"
            class="account-action-card"
            @click="openAdjustDialog(selectedAccount)"
          >
            <span class="account-action-icon">
              <el-icon><EditPen /></el-icon>
            </span>
            <span>
              <strong>修正余额</strong>
              <small>按实际余额更新系统余额和人民币成本。</small>
            </span>
          </button>
          <button
            type="button"
            class="account-action-card"
            @click="openAdjustmentRecords(selectedAccount)"
          >
            <span class="account-action-icon">
              <el-icon><Tickets /></el-icon>
            </span>
            <span>
              <strong>修正记录</strong>
              <small>查看历史修正和每次成本变化。</small>
            </span>
          </button>
        </section>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="adjustDialogVisible"
      :title="`修正余额 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="确认实际余额、成本处理方式和修正原因，保存后会留下操作记录。"
      eyebrow="余额修正"
      size="620px"
      confirm-text="保存修正"
      :confirm-loading="saving"
      :show-confirm="canAdjustAppleBalance"
      @confirm="saveAdjustment"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">记录</StatusChip>
        <div>
          <strong>余额修正会留下操作记录</strong>
          <p>
            该操作会更新 Apple ID
            当前余额、人民币总成本和移动平均成本，请只在人工或自动查询确认后使用。
          </p>
        </div>
      </div>

      <div class="drawer-detail-grid sensitive-form">
        <div>
          <span>原余额</span>
          <strong>{{ selectedAccount?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>原总成本</span>
          <strong>{{ selectedAccount ? getAccountTotalCostAmount(selectedAccount) : '-' }}</strong>
        </div>
        <div>
          <span>原均价</span>
          <strong>{{ selectedAccount ? getAccountAverageCost(selectedAccount) : '-' }}</strong>
        </div>
      </div>

      <el-form
        ref="formRef"
        class="sensitive-form"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <div class="form-grid">
          <el-form-item prop="newBalance">
            <template #label>
              <FieldHelpLabel
                label="新余额"
                purpose="人工核对后确认的 Apple ID 实际余额，用来修正系统余额。"
                example="登录看到余额 122 USD，就填 122。"
              />
            </template>
            <el-input v-model.trim="form.newBalance" placeholder="实际查询到的余额" />
          </el-form-item>
          <el-form-item prop="costAdjustMethod">
            <template #label>
              <FieldHelpLabel
                label="成本修正方式"
                purpose="决定余额修正时是否同步修正人民币成本，影响之后的利润计算。"
                example="只是余额展示错了选按当前平均成本修正；成本也核过了选手动输入新成本。"
              />
            </template>
            <el-select v-model="form.costAdjustMethod" class="full-input">
              <el-option label="只修余额，不修正成本" value="none" />
              <el-option label="按当前平均成本修正" value="current_avg" />
              <el-option label="手动输入新成本" value="manual" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item v-if="form.costAdjustMethod === 'manual'" prop="newCostRmb">
          <template #label>
            <FieldHelpLabel
              label="新人民币总成本"
              purpose="手动确认后的余额人民币总成本，系统会据此重新计算平均成本。"
              example="余额 100 USD，总成本 590 元就填 590。"
            />
          </template>
          <el-input v-model.trim="form.newCostRmb" placeholder="手动确认后的人民币总成本" />
        </el-form-item>
        <el-form-item prop="reason">
          <template #label>
            <FieldHelpLabel
              label="修正原因"
              purpose="说明为什么要改余额或成本，系统会保存到对账记录。"
              example="可以写自动查询余额与系统不一致、人工核对发现差异。"
            />
          </template>
          <el-input
            v-model.trim="form.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 自动查询余额与系统不一致 / 人工核对发现差异"
          />
        </el-form-item>
      </el-form>

      <div class="drawer-detail-grid">
        <div>
          <span>余额差额</span>
          <strong>{{ previewDifference }}</strong>
        </div>
        <div>
          <span>预计新成本</span>
          <strong>{{ previewNewCost }}</strong>
        </div>
        <div>
          <span>成本变化</span>
          <strong>{{ previewCostChange }}</strong>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="recordsDrawerVisible"
      :title="`余额修正记录 · ${selectedAccount?.appleIdMasked ?? ''}`"
      confirm-text="刷新记录"
      size="780px"
      @confirm="loadAdjustmentRecords"
    >
      <div class="drawer-section">
        <div class="drawer-section__title">修正记录</div>
        <el-table
          v-loading="recordsLoading"
          class="desktop-data-table"
          :data="adjustments"
          row-key="id"
        >
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
          <el-table-column label="方式" width="120">
            <template #default="{ row }">{{
              getCostAdjustMethodLabel(row.costAdjustMethod)
            }}</template>
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
        <div v-if="adjustments.length" class="mobile-record-list" aria-label="余额修正记录移动列表">
          <article v-for="record in adjustments" :key="record.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ record.oldBalance }} -> {{ record.newBalance }}</strong>
                <span>{{ getCostAdjustMethodLabel(record.costAdjustMethod) }}</span>
              </div>
              <StatusChip tone="blue">差额 {{ record.difference }}</StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>原总成本</span>
                <strong>{{ record.oldCostRmb }}</strong>
              </div>
              <div>
                <span>新总成本</span>
                <strong>{{ record.newCostRmb }}</strong>
              </div>
              <div>
                <span>成本变化</span>
                <strong>{{ record.costRmbChange }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__meta">
              <div>
                <span>修正原因</span>
                <strong>{{ record.reason }}</strong>
              </div>
              <div>
                <span>操作信息</span>
                <strong
                  >{{ record.operator?.displayName ?? '-' }} ·
                  {{ formatDate(record.createdAt) }}</strong
                >
              </div>
            </div>
          </article>
        </div>
        <div v-else-if="!recordsLoading" class="mobile-record-list" aria-label="余额修正记录空状态">
          <div class="apple-core-empty-state">
            <strong>暂无修正记录</strong>
            <span>该 Apple ID 暂时没有余额修正历史。</span>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="recordsQuery.page"
        v-model:page-size="recordsQuery.pageSize"
        :total="adjustmentTotal"
        @change="loadAdjustmentRecords"
      />
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { EditPen, Tickets, View } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleAccountsApi, userTableViewsApi, type AppleAccountQuery } from '@/api/system';
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
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleAccount,
  AppleBalanceAdjustment,
  TableDensity,
  UserTableView
} from '@/types/system';
import { formatAppleRegionCurrencyLabel } from '@/utils/appleAccountRegion';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { hasUserPermission } from '@/utils/permissions';
import { createSmartQueryKey, refreshSmartQuery } from '@/utils/smartQuery';

const router = useRouter();
const authStore = useAuthStore();
const tableKey = 'apple_balance_reconciliation';
const ACCOUNT_SCOPE = 'apple-accounts';
const accountColumnOptions = [
  { label: 'Apple ID', value: 'appleId', required: true },
  { label: '地区/币种', value: 'region' },
  { label: '系统余额', value: 'currentBalance' },
  { label: '人民币总成本', value: 'balanceCostAmount' },
  { label: '平均成本', value: 'averageCost' },
  { label: '状态', value: 'status' },
  { label: '锁定', value: 'isManuallyLocked' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];
const lockedOptions = [
  { label: '已锁定', value: 'true' },
  { label: '未锁定', value: 'false' }
];
const accountSortFieldMap: Record<string, string> = {
  appleId: 'appleId',
  region: 'region',
  currentBalance: 'currentBalance',
  balanceCostAmount: 'balanceCostAmount',
  averageCost: 'averageCost',
  status: 'status',
  isManuallyLocked: 'isManuallyLocked',
  updatedAt: 'updatedAt'
};

const loading = ref(false);
const saving = ref(false);
const recordsLoading = ref(false);
const actionDrawerVisible = ref(false);
const adjustDialogVisible = ref(false);
const recordsDrawerVisible = ref(false);
const detailDrawerVisible = ref(false);
const selectedAccount = ref<AppleAccount | null>(null);
const formRef = ref<FormInstance>();
const accounts = ref<AppleAccount[]>([]);
const adjustments = ref<AppleBalanceAdjustment[]>([]);
const selectedAccounts = ref<AppleAccount[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const total = ref(0);
const adjustmentTotal = ref(0);

const query = reactive<AppleAccountQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  currency: '',
  locked: '',
  sortBy: '',
  sortOrder: ''
});

const recordsQuery = reactive({
  page: 1,
  pageSize: 10
});

const form = reactive<{
  newBalance: string;
  costAdjustMethod: AppleBalanceAdjustment['costAdjustMethod'];
  newCostRmb: string;
  reason: string;
}>({
  newBalance: '',
  costAdjustMethod: 'current_avg',
  newCostRmb: '',
  reason: ''
});

const rules: FormRules<typeof form> = {
  newBalance: [{ required: true, message: '请输入新余额', trigger: 'blur' }],
  costAdjustMethod: [{ required: true, message: '请选择成本修正方式', trigger: 'change' }],
  reason: [{ required: true, message: '请输入修正原因', trigger: 'blur' }]
};

const statusOptions: Array<{
  label: string;
  value: AppleAccount['status'];
  type: 'success' | 'warning' | 'danger' | 'info';
}> = [
  { label: '正常', value: 'normal', type: 'success' },
  { label: '需要验证', value: 'need_verify', type: 'warning' },
  { label: '已锁定', value: 'locked', type: 'danger' },
  { label: '密码错误', value: 'password_error', type: 'danger' },
  { label: '风险', value: 'risk', type: 'warning' },
  { label: '未知', value: 'unknown', type: 'info' }
];

const costAdjustMethodLabels: Record<AppleBalanceAdjustment['costAdjustMethod'], string> = {
  none: '只修余额',
  current_avg: '按当前均价',
  manual: '手动总成本'
};

const totalBalance = computed(() =>
  accounts.value.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0).toFixed(2)
);
const totalCost = computed(() =>
  accounts.value.reduce((sum, account) => sum + getAccountTotalCostNumber(account), 0).toFixed(2)
);
const lockedCount = computed(
  () => accounts.value.filter((account) => account.isManuallyLocked).length
);
const reconcilableCount = computed(
  () =>
    accounts.value.filter((account) => account.status === 'normal' && !account.isManuallyLocked)
      .length
);
const canAdjustAppleBalance = computed(() => hasBalancePermission('apple.balance.adjust'));
const averageCostPreview = computed(() => {
  const balance = Number(totalBalance.value);
  const cost = Number(totalCost.value);

  if (!balance) {
    return '-';
  }

  return (cost / balance).toFixed(2);
});
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const lockedLabel = lockedOptions.find((item) => item.value === query.locked)?.label;

  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }

  if (query.locked && lockedLabel) {
    chips.push({ key: 'locked', label: '手动锁定', value: lockedLabel });
  }

  return chips;
});
const previewDifference = computed(() => {
  if (!selectedAccount.value || !form.newBalance) return '-';
  return (Number(form.newBalance) - Number(selectedAccount.value.currentBalance)).toFixed(4);
});
const previewNewCost = computed(() => {
  if (!selectedAccount.value || !form.newBalance) return '-';
  const oldCost = getAccountTotalCostNumber(selectedAccount.value);
  const oldBalance = Number(selectedAccount.value.currentBalance);
  const newBalance = Number(form.newBalance);
  const averageCost = getAccountAverageCostNumber(selectedAccount.value);

  if (Number.isNaN(newBalance)) return '-';
  if (form.costAdjustMethod === 'none') return oldCost.toFixed(4);
  if (form.costAdjustMethod === 'manual') return form.newCostRmb || '-';
  if (newBalance === 0) return '0.0000';

  return (oldCost + (newBalance - oldBalance) * averageCost).toFixed(4);
});
const previewCostChange = computed(() => {
  if (!selectedAccount.value || previewNewCost.value === '-') return '-';
  return (Number(previewNewCost.value) - getAccountTotalCostNumber(selectedAccount.value)).toFixed(
    4
  );
});

function parseDecimalInput(value?: string | number | null) {
  const numberValue = Number(String(value ?? '').trim());
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isLikelyLegacyRateCost(account: AppleAccount) {
  const balance = parseDecimalInput(account.currentBalance);
  const storedCost = parseDecimalInput(account.balanceCostAmount);
  const averageCost = parseDecimalInput(account.averageCost);

  return (
    account.currency !== 'CNY' &&
    balance > 1 &&
    storedCost >= 1 &&
    averageCost > 0 &&
    averageCost < 1
  );
}

function getAccountAverageCostNumber(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return parseDecimalInput(account.balanceCostAmount);
  }

  return parseDecimalInput(account.averageCost);
}

function getAccountAverageCost(account: AppleAccount) {
  return getAccountAverageCostNumber(account).toFixed(2);
}

function formatAccountRegionCurrency(
  region: string | null | undefined,
  currency: string | null | undefined
) {
  return formatAppleRegionCurrencyLabel(region, currency);
}

function getAccountTotalCostNumber(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return parseDecimalInput(account.currentBalance) * parseDecimalInput(account.balanceCostAmount);
  }

  return parseDecimalInput(account.balanceCostAmount);
}

function getAccountTotalCostAmount(account: AppleAccount) {
  return getAccountTotalCostNumber(account).toFixed(4);
}

function getOwnershipTypeLabel(value: AppleAccount['ownershipType']) {
  return value === 'sold' ? '售出' : '寄存';
}

function getAccountSourceText(account: AppleAccount) {
  return account.sourceChannel?.name ?? account.sourcePlatform?.name ?? '-';
}

function getAccountProfileSummary(account: AppleAccount) {
  const completed = [
    account.hasPassword,
    account.hasSecurityInfo,
    account.hasPhone,
    account.hasRecoveryEmail
  ].filter(Boolean).length;

  return `已保存 ${completed}/4 项`;
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated([ACCOUNT_SCOPE], () => {
  void loadAccounts({ silent: true, dedupeMs: 0 });
});

onMounted(initializePage);

usePageRefresh(
  (options) =>
    loadAccounts({
      silent: options.background,
      dedupeMs: options.force ? 0 : undefined,
      force: options.force ?? true
    }),
  { label: 'Apple ID 余额校准' }
);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});

async function loadAccounts(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  if (!options.silent || !accounts.value.length) {
    loading.value = true;
  }
  try {
    const params = {
      ...query,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      currency: query.currency || undefined,
      locked: query.locked || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    };
    const result = await refreshSmartQuery({
      key: createSmartQueryKey(ACCOUNT_SCOPE, params),
      fetcher: () => appleAccountsApi.list(params),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    accounts.value = result.data.items;
    total.value = result.data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 失败');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  query.page = 1;
  loadAccounts();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.currency = '';
  query.locked = '';
  query.sortBy = '';
  query.sortOrder = '';
  savedViewId.value = '';
}

function clearFiltersAndSearch() {
  clearFilters();
  loadAccounts();
}

function removeFilter(key: string) {
  if (key === 'currency') {
    query.currency = '';
  }
  if (key === 'locked') {
    query.locked = '';
  }
}

function handleSelectionChange(rows: AppleAccount[]) {
  selectedAccounts.value = rows;
}

function handleSortChange(event: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  query.page = 1;
  query.sortBy = event.prop ? accountSortFieldMap[event.prop] || '' : '';
  query.sortOrder =
    event.order === 'ascending' ? 'asc' : event.order === 'descending' ? 'desc' : '';

  if (!query.sortOrder) {
    query.sortBy = '';
  }

  loadAccounts();
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function exportList() {
  const rows = selectedAccounts.value.length ? selectedAccounts.value : accounts.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的余额对账数据');
    return;
  }

  const count = exportRowsToCsv(
    'apple-balance-reconciliation',
    [
      { header: 'Apple ID', value: (row) => row.appleIdMasked },
      {
        header: '地区/币种',
        value: (row) => formatAccountRegionCurrency(row.region, row.currency)
      },
      { header: '系统余额', value: (row) => row.currentBalance },
      { header: '人民币总成本', value: (row) => getAccountTotalCostAmount(row) },
      { header: '平均成本', value: (row) => row.averageCost },
      { header: 'ID 类型', value: (row) => getOwnershipTypeLabel(row.ownershipType) },
      { header: '来源', value: (row) => getAccountSourceText(row) },
      { header: '状态', value: (row) => getStatusLabel(row.status) },
      { header: '手动锁定', value: (row) => (row.isManuallyLocked ? '是' : '否') },
      { header: '锁定原因', value: (row) => row.manualLockReason ?? '' },
      { header: '备注', value: (row) => row.remark ?? '' },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条余额对账数据`);
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存余额对账视图', {
      inputValue: '余额对账常用视图',
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
        currency: query.currency,
        locked: query.locked
      },
      sortConfig: {
        prop: query.sortBy,
        order:
          query.sortOrder === 'asc' ? 'ascending' : query.sortOrder === 'desc' ? 'descending' : null
      },
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : accountColumnOptions.map((column) => column.value),
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
  await loadAccounts();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.currency = typeof filters.currency === 'string' ? filters.currency : '';
  query.locked = typeof filters.locked === 'string' ? filters.locked : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        accountColumnOptions.some((option) => option.value === column)
      )
    : accountColumnOptions.map((column) => column.value);
  applySortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function applySortConfig(value: Record<string, unknown>) {
  const prop = typeof value.prop === 'string' ? value.prop : '';
  const order = value.order === 'ascending' ? 'asc' : value.order === 'descending' ? 'desc' : '';

  query.sortBy = accountSortFieldMap[prop] ?? prop;
  query.sortOrder = order;
}

function closeActionSurfaces() {
  actionDrawerVisible.value = false;
  detailDrawerVisible.value = false;
}

function openReconciliationActions(account: AppleAccount) {
  selectedAccount.value = account;
  detailDrawerVisible.value = false;
  actionDrawerVisible.value = true;
}

function openAdjustDialog(account?: AppleAccount) {
  if (!canAdjustAppleBalance.value) {
    ElMessage.warning('当前账号没有余额修正权限');
    return;
  }

  if (account) {
    selectedAccount.value = account;
  }

  if (!selectedAccount.value) {
    return;
  }

  form.newBalance = selectedAccount.value.currentBalance;
  form.costAdjustMethod = 'current_avg';
  form.newCostRmb = getAccountTotalCostAmount(selectedAccount.value);
  form.reason = '';
  closeActionSurfaces();
  adjustDialogVisible.value = true;
}

async function saveAdjustment() {
  if (!canAdjustAppleBalance.value) {
    ElMessage.warning('当前账号没有余额修正权限');
    return;
  }

  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) return;

  if (form.costAdjustMethod === 'manual' && !form.newCostRmb) {
    ElMessage.error('手动成本修正需要填写新人民币总成本');
    return;
  }

  const shouldNormalizeLegacyCost =
    form.costAdjustMethod === 'current_avg' && isLikelyLegacyRateCost(selectedAccount.value);
  const newCostRmb = shouldNormalizeLegacyCost ? previewNewCost.value : form.newCostRmb;

  if (shouldNormalizeLegacyCost && newCostRmb === '-') {
    ElMessage.error('当前账号成本口径需要先修正，请填写新余额后再保存');
    return;
  }

  saving.value = true;
  try {
    await appleAccountsApi.createBalanceAdjustment(selectedAccount.value.id, {
      newBalance: form.newBalance,
      costAdjustMethod: shouldNormalizeLegacyCost ? 'manual' : form.costAdjustMethod,
      newCostRmb:
        form.costAdjustMethod === 'manual' || shouldNormalizeLegacyCost ? newCostRmb : null,
      reason: form.reason
    });
    ElMessage.success('余额修正已保存');
    adjustDialogVisible.value = false;
    await loadAccounts();
    await loadAdjustmentRecords();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存余额修正失败');
  } finally {
    saving.value = false;
  }
}

function hasBalancePermission(permission: string) {
  return hasUserPermission(authStore.user, permission);
}

async function openAdjustmentRecords(account?: AppleAccount) {
  if (account) {
    selectedAccount.value = account;
  }

  if (!selectedAccount.value) {
    return;
  }

  recordsQuery.page = 1;
  closeActionSurfaces();
  recordsDrawerVisible.value = true;
  await loadAdjustmentRecords();
}

async function loadAdjustmentRecords() {
  if (!selectedAccount.value) return;

  recordsLoading.value = true;
  try {
    const data = await appleAccountsApi.listBalanceAdjustments(selectedAccount.value.id, {
      page: recordsQuery.page,
      pageSize: recordsQuery.pageSize
    });
    adjustments.value = data.items;
    adjustmentTotal.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载余额修正记录失败');
  } finally {
    recordsLoading.value = false;
  }
}

function openDetail(account: AppleAccount) {
  selectedAccount.value = account;
  actionDrawerVisible.value = false;
  detailDrawerVisible.value = true;
}

function openSelectedDetailPage() {
  if (!selectedAccount.value) {
    return;
  }

  router.push({
    path: '/apple/accounts/detail',
    query: { id: selectedAccount.value.id }
  });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getStatusLabel(status: AppleAccount['status']) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

function getStatusTone(status: AppleAccount['status']) {
  const type = statusOptions.find((item) => item.value === status)?.type ?? 'info';

  if (type === 'success') return 'green';
  if (type === 'warning') return 'orange';
  if (type === 'danger') return 'red';
  return 'neutral';
}

function getCostAdjustMethodLabel(method: AppleBalanceAdjustment['costAdjustMethod']) {
  return costAdjustMethodLabels[method] ?? method;
}

async function initializePage() {
  await loadTableViews(true);
  await loadAccounts({ force: false });
}
</script>

<style scoped>
.account-action-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.account-action-hero {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(219, 232, 255, 0.95);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(234, 241, 255, 0.96), rgba(249, 251, 255, 0.98)), var(--v3-surface);
}

.account-action-hero__top,
.account-action-tags,
.account-action-note,
.account-action-metric,
.account-action-primary,
.account-action-card {
  min-width: 0;
}

.account-action-hero__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.account-action-eyebrow,
.account-action-metric span,
.account-action-section__head p,
.account-action-primary small,
.account-action-card small,
.account-action-note p {
  color: var(--v3-text-soft);
  font-size: 12px;
  line-height: 1.55;
}

.account-action-eyebrow {
  font-weight: 800;
}

.account-action-hero__id {
  overflow: hidden;
  color: var(--v3-text);
  font-size: 22px;
  font-weight: 900;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-action-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.account-action-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 9px;
  border: 1px solid var(--v3-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--v3-text-soft);
  font-size: 12px;
  font-weight: 800;
}

.account-action-tags .account-action-tag--warning {
  border-color: var(--v3-orange-border-soft);
  background: var(--v3-orange-soft);
  color: #92400e;
}

.account-action-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.account-action-metric {
  display: grid;
  align-content: space-between;
  gap: 12px;
  min-height: 108px;
  padding: 14px;
  border: 1px solid var(--v3-border);
  border-radius: 14px;
  background: var(--v3-surface);
  box-shadow: var(--v3-shadow-xs);
}

.account-action-metric--balance {
  border-color: rgba(37, 99, 235, 0.2);
  background: linear-gradient(180deg, #ffffff, #f7faff);
}

.account-action-metric strong {
  display: block;
  overflow: hidden;
  color: var(--v3-text);
  font-size: 20px;
  font-weight: 900;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.account-action-metric em {
  color: var(--v3-muted);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.25;
}

.account-action-section {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.account-action-section__head {
  display: grid;
  gap: 4px;
}

.account-action-section__head strong {
  color: var(--v3-text);
  font-size: 15px;
  font-weight: 900;
}

.account-action-section__head p,
.account-action-note p {
  margin: 0;
}

.account-action-primary,
.account-action-card {
  width: 100%;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 180ms var(--v3-ease),
    border-color 180ms var(--v3-ease),
    background 180ms var(--v3-ease),
    box-shadow 180ms var(--v3-ease);
}

.account-action-primary:focus-visible,
.account-action-card:focus-visible {
  outline: none;
  box-shadow: var(--v3-focus-ring);
}

.account-action-primary:active,
.account-action-card:active {
  transform: translateY(1px);
}

.account-action-primary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--v3-primary), var(--v3-primary-2));
  color: #ffffff;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.2);
}

.account-action-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 34px rgba(37, 99, 235, 0.24);
}

.account-action-primary strong,
.account-action-card strong {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.3;
}

.account-action-primary small,
.account-action-card small {
  display: block;
  font-size: 12px;
}

.account-action-primary small {
  color: rgba(255, 255, 255, 0.82);
}

.account-action-secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-action-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  min-height: 118px;
  padding: 14px;
  border: 1px solid var(--v3-border);
  border-radius: 14px;
  background: var(--v3-surface);
  color: var(--v3-text);
}

.account-action-card:hover {
  border-color: rgba(37, 99, 235, 0.22);
  background: var(--v3-surface-2);
  transform: translateY(-1px);
  box-shadow: var(--v3-shadow-sm);
}

.account-action-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 10px;
  background: var(--v3-primary-soft);
  color: var(--v3-primary);
  font-size: 18px;
}

.account-action-icon--primary {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.account-action-note {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 12px;
  border: 1px solid var(--v3-line);
  border-radius: 14px;
  background: var(--v3-surface-2);
}

@media (max-width: 640px) {
  .account-action-metrics,
  .account-action-secondary-grid {
    grid-template-columns: 1fr;
  }

  .account-action-metric {
    min-height: 84px;
  }

  .account-action-hero__id {
    white-space: normal;
    overflow-wrap: anywhere;
  }
}

.account-detail-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(130px, auto);
  gap: 14px;
  align-items: stretch;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(234, 241, 255, 0.98), rgba(248, 253, 255, 0.96)), var(--v3-surface);
}

.account-detail-summary__main,
.account-detail-summary__balance,
.account-detail-section,
.account-detail-profile,
.account-detail-quick-actions {
  min-width: 0;
}

.account-detail-summary__main {
  display: grid;
  gap: 10px;
  align-content: start;
}

.account-detail-summary__top,
.account-detail-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.account-detail-summary__main > strong {
  overflow: hidden;
  color: var(--v3-text);
  font-size: 24px;
  font-weight: 950;
  line-height: 1.16;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-detail-summary__balance {
  display: grid;
  justify-items: end;
  align-content: center;
  gap: 5px;
  text-align: right;
}

.account-detail-summary__balance span,
.account-detail-summary__balance small,
.account-detail-section__head span,
.account-detail-info-grid span,
.account-detail-profile > span {
  color: var(--v3-text-soft);
  font-size: 12px;
  line-height: 1.45;
}

.account-detail-summary__balance strong {
  color: var(--v3-text);
  font-size: 28px;
  font-weight: 950;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.account-detail-section {
  overflow: hidden;
  border: 1px solid var(--v3-border);
  border-radius: 16px;
  background: var(--v3-surface);
}

.account-detail-section__head {
  padding: 13px 14px;
  border-bottom: 1px solid var(--v3-line);
  background: #fbfcff;
}

.account-detail-section__head strong {
  color: var(--v3-text);
  font-size: 14px;
  font-weight: 900;
}

.account-detail-section__head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-detail-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.account-detail-info-grid > div {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 12px 14px;
  border-right: 1px solid var(--v3-line);
  border-bottom: 1px solid var(--v3-line);
}

.account-detail-info-grid > div:nth-child(2n) {
  border-right: 0;
}

.account-detail-info-grid > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.account-detail-info-grid strong {
  min-width: 0;
  color: var(--v3-text);
  font-size: 14px;
  font-weight: 850;
  line-height: 1.36;
  overflow-wrap: anywhere;
}

.account-detail-profile {
  display: grid;
  gap: 8px;
  padding: 12px 14px 14px;
  border-top: 1px solid var(--v3-line);
}

.account-detail-profile > strong {
  color: var(--v3-text);
  font-size: 14px;
  font-weight: 900;
}

.account-detail-profile__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.account-detail-profile__chips span {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 4px 8px;
  border: 1px solid var(--v3-border);
  border-radius: 8px;
  background: var(--v3-surface-2);
  color: var(--v3-muted);
  font-size: 12px;
  font-weight: 800;
}

.account-detail-profile__chips span.active {
  border-color: rgba(22, 163, 74, 0.18);
  background: var(--v3-green-soft);
  color: #15803d;
}

.account-detail-quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-detail-quick-actions .account-action-card {
  min-height: 96px;
}

@media (max-width: 640px) {
  .account-detail-summary,
  .account-detail-info-grid,
  .account-detail-quick-actions {
    grid-template-columns: 1fr;
  }

  .account-detail-summary__main > strong {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .account-detail-summary__balance {
    justify-items: start;
    text-align: left;
  }

  .account-detail-info-grid > div,
  .account-detail-info-grid > div:nth-child(2n),
  .account-detail-info-grid > div:nth-last-child(-n + 2) {
    border-right: 0;
    border-bottom: 1px solid var(--v3-line);
  }

  .account-detail-info-grid > div:last-child {
    border-bottom: 0;
  }
}
</style>
