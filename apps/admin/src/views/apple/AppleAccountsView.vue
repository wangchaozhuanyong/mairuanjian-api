<template>
  <PageScaffold
    title="Apple ID 管理"
    group="Apple ID 业务"
    phase="Phase 3"
    description="管理 Apple ID 基础资料、余额、汇率成本、移动加权平均成本、状态和手动锁定。敏感字段加密保存，列表默认脱敏。"
  >
    <template #actions>
      <AppButton @click="openImport">批量导入</AppButton>
    </template>

    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <div>
          <h3>
            Apple ID 资产列表
            <FeatureHelp
              placement="right"
              text="这里放可以拿来开通业务的 Apple ID。先看余额够不够、状态正不正常，再决定要不要充值、锁定或查看资料。"
            />
          </h3>
          <p>支持模糊搜索、排序、分页、敏感字段脱敏、余额流水和充值/消费操作。</p>
        </div>
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 个ID</StatusChip>
          <StatusChip tone="green">可用 {{ normalAccountsCount }}</StatusChip>
          <StatusChip :tone="attentionAccountsCount > 0 ? 'orange' : 'green'">
            关注 {{ attentionAccountsCount }}
          </StatusChip>
          <StatusChip :tone="lockedCount > 0 ? 'red' : 'green'" dot>
            {{ lockedCount > 0 ? `锁定 ${lockedCount}` : '锁定正常' }}
          </StatusChip>
          <StatusChip tone="purple">资料 {{ secretReadyCount }}</StatusChip>
          <StatusChip tone="cyan">余额 {{ totalBalance }}</StatusChip>
          <StatusChip tone="orange">汇率 {{ exchangeRateCostSummary }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="accountColumnOptions"
        :status-options="accountStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedAccounts.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增 Apple ID"
        placeholder="搜索 Apple ID、地区、币种、备注"
        @search="applyFilters"
        @refresh="loadAccounts"
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
            v-model="query.region"
            class="table-toolbar__select"
            placeholder="地区"
            clearable
            @change="handleRegionFilterChange"
          >
            <el-option
              v-for="item in appleAccountRegionOptions"
              :key="item.code"
              :label="`${item.labelZh} ${item.labelEn}（${item.code}）`"
              :value="item.code"
            />
          </el-select>
          <el-select
            v-model="query.currency"
            class="table-toolbar__select"
            placeholder="币种"
            clearable
            @change="applyFilters"
          >
            <el-option
              v-for="item in appleAccountCurrencyOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
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
            <strong>暂无 Apple ID 账号</strong>
            <span>可以新增账号、批量导入，或清空筛选后重新查看当前账号库。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增 Apple ID</AppButton>
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
          min-width="230"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              地区/币种
              <FeatureHelp
                text="这个 ID 属于哪个地区，就用哪个币种记余额。选错会影响后面充值、消费和成本计算。"
              />
            </span>
          </template>
          <template #default="{ row }">{{
            formatRegionCurrency(row.region, row.currency)
          }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('currentBalance')"
          prop="currentBalance"
          label="余额"
          width="120"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              余额
              <FeatureHelp text="这个 Apple ID 现在还剩多少可以用的余额。" />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('balanceCostAmount')"
          prop="averageCost"
          label="汇率成本"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              汇率成本
              <FeatureHelp
                text="这里看的是 1 美元余额大约花了多少人民币。比如填 5，就是 1 美元按 5 元人民币成本算。"
              />
            </span>
          </template>
          <template #default="{ row }">
            {{ getAccountExchangeRateCost(row) }}
          </template>
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
                text="系统按充值和消费自动算出来的当前成本。简单说，就是现在每用掉 1 美元余额，大概算多少人民币成本。"
              />
            </span>
          </template>
          <template #default="{ row }">
            {{ getAccountExchangeRateCost(row) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="130"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              状态
              <FeatureHelp
                text="看这个 ID 现在能不能正常使用。异常、风控、密码错误这类状态要先处理。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('secrets')" label="敏感资料" min-width="180">
          <template #header>
            <span class="help-label">
              敏感资料
              <FeatureHelp
                text="这里不是直接显示密码，只告诉你这个 ID 有没有保存密码、密保、手机号这类资料。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <StatusChip v-if="row.hasPassword" class="tag-gap" tone="purple">密码</StatusChip>
            <StatusChip v-if="row.hasSecurityInfo" class="tag-gap" tone="orange">密保</StatusChip>
            <StatusChip v-if="row.hasPhone" class="tag-gap" tone="blue">手机</StatusChip>
            <StatusChip v-if="row.hasRecoveryEmail" class="tag-gap" tone="cyan">
              备用邮箱
            </StatusChip>
            <span
              v-if="
                !row.hasPassword && !row.hasSecurityInfo && !row.hasPhone && !row.hasRecoveryEmail
              "
              >-</span
            >
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
              <FeatureHelp
                text="锁定后，这个 ID 暂时不要被拿去开新业务，适合排查问题或预留给某个订单。"
              />
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
              <AppButton size="small" variant="soft" @click="openAccountActions(row)">
                操作
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="accounts.length" class="mobile-record-list apple-account-mobile-list">
        <article v-for="account in accounts" :key="account.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ account.appleIdMasked }}</strong>
              <span>{{ formatRegionCurrency(account.region, account.currency) }}</span>
            </div>
            <StatusChip :tone="getStatusTone(account.status)" dot>
              {{ getStatusLabel(account.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>余额</span>
              <strong>{{ account.currentBalance }}</strong>
            </div>
            <div>
              <span>汇率成本</span>
              <strong>{{ getAccountExchangeRateCost(account) }}</strong>
            </div>
            <div>
              <span>平均成本</span>
              <strong>{{ getAccountExchangeRateCost(account) }}</strong>
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
              <span>敏感资料</span>
              <div class="mobile-record-card__chips">
                <StatusChip v-if="account.hasPassword" tone="purple">密码</StatusChip>
                <StatusChip v-if="account.hasSecurityInfo" tone="orange">密保</StatusChip>
                <StatusChip v-if="account.hasPhone" tone="blue">手机</StatusChip>
                <StatusChip v-if="account.hasRecoveryEmail" tone="cyan">备用邮箱</StatusChip>
                <em
                  v-if="
                    !account.hasPassword &&
                    !account.hasSecurityInfo &&
                    !account.hasPhone &&
                    !account.hasRecoveryEmail
                  "
                >
                  未保存
                </em>
              </div>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(account.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="soft" @click="openAccountActions(account)">
              打开操作
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 账号空状态">
        <div class="apple-core-empty-state">
          <strong>暂无 Apple ID 账号</strong>
          <span>可以新增账号、批量导入，或清空筛选后重新查看当前账号库。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增 Apple ID</AppButton>
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
      v-model="accountActionsDrawerVisible"
      :title="`账号操作 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="把常用动作集中在这里，列表只负责看数据，具体处理都从右侧进入。"
      eyebrow="Apple ID"
      size="520px"
      :show-confirm="false"
    >
      <div v-if="selectedAccount" class="account-action-panel">
        <div class="account-action-summary">
          <div class="account-action-summary__head">
            <div>
              <span>当前账号</span>
              <strong>{{ selectedAccount.appleIdMasked }}</strong>
              <p>{{ formatRegionCurrency(selectedAccount.region, selectedAccount.currency) }}</p>
            </div>
            <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
              {{ getStatusLabel(selectedAccount.status) }}
            </StatusChip>
          </div>
          <div class="account-action-summary__metrics">
            <div>
              <span>余额</span>
              <strong>{{ selectedAccount.currentBalance }}</strong>
            </div>
            <div>
              <span>汇率</span>
              <strong>{{ getAccountExchangeRateCost(selectedAccount) }}</strong>
            </div>
            <div>
              <span>均价</span>
              <strong>{{ getAccountExchangeRateCost(selectedAccount) }}</strong>
            </div>
          </div>
        </div>

        <div class="account-action-section">
          <span class="account-action-section__title">查看与维护</span>
          <div class="account-action-grid">
            <button type="button" class="account-action-card" @click="openDetail(selectedAccount)">
              <strong>详情</strong>
              <span>先在右侧看账号概况，需要更多内容再打开详情页。</span>
            </button>
            <button type="button" class="account-action-card" @click="openEdit(selectedAccount)">
              <strong>编辑</strong>
              <span>修改地区、余额、锁定状态、备注和需要更新的敏感资料。</span>
            </button>
            <button
              type="button"
              class="account-action-card account-action-card--orange"
              @click="openAccountSecret(selectedAccount)"
            >
              <strong>敏感资料</strong>
              <span>查看完整 Apple ID、密码、密保、手机号等，查看会记录审计。</span>
            </button>
          </div>
        </div>

        <div class="account-action-section">
          <span class="account-action-section__title">处理与流水</span>
          <div class="account-action-grid">
            <button
              type="button"
              class="account-action-card"
              @click="openStatusCheck(selectedAccount)"
            >
              <strong>检测</strong>
              <span>记录一次人工检测结果，比如正常、需要验证或密码错误。</span>
            </button>
            <button
              type="button"
              class="account-action-card account-action-card--green"
              @click="openTopup(selectedAccount)"
            >
              <strong>充值</strong>
              <span>录入充值面值和汇率成本，系统会自动换算总成本并更新均价。</span>
            </button>
            <button
              type="button"
              class="account-action-card account-action-card--blue"
              @click="openConsumption(selectedAccount)"
            >
              <strong>消费</strong>
              <span>记录手工扣减余额，方便后面核算这次消耗的成本。</span>
            </button>
            <button type="button" class="account-action-card" @click="openRecords(selectedAccount)">
              <strong>流水</strong>
              <span>查看充值记录、消费记录和礼品卡尾号。</span>
            </button>
          </div>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="`ID 详情 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="这里先展示最常用的信息；需要完整详情时可以打开详情页继续看。"
      eyebrow="详情预览"
      size="620px"
      confirm-text="打开详情页"
      @confirm="openSelectedDetailPage"
    >
      <div v-if="selectedAccount" class="account-detail-drawer">
        <div class="drawer-detail-grid">
          <div>
            <span>当前余额</span>
            <strong>{{ selectedAccount.currentBalance }}</strong>
          </div>
          <div>
            <span>汇率成本</span>
            <strong>{{ getAccountExchangeRateCost(selectedAccount) }}</strong>
          </div>
          <div>
            <span>平均成本</span>
            <strong>{{ getAccountExchangeRateCost(selectedAccount) }}</strong>
          </div>
        </div>

        <div class="drawer-section">
          <div class="drawer-section__title">账号信息</div>
          <el-descriptions class="detail-descriptions" :column="1" border>
            <el-descriptions-item label="Apple ID">
              {{ selectedAccount.appleIdMasked }}
            </el-descriptions-item>
            <el-descriptions-item label="地区/币种">
              {{ formatRegionCurrency(selectedAccount.region, selectedAccount.currency) }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
                {{ getStatusLabel(selectedAccount.status) }}
              </StatusChip>
            </el-descriptions-item>
            <el-descriptions-item label="手动锁定">
              <StatusChip :tone="selectedAccount.isManuallyLocked ? 'red' : 'green'" dot>
                {{ selectedAccount.isManuallyLocked ? '已锁定' : '正常' }}
              </StatusChip>
            </el-descriptions-item>
            <el-descriptions-item v-if="selectedAccount.manualLockReason" label="锁定原因">
              {{ selectedAccount.manualLockReason }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ formatDate(selectedAccount.updatedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="备注">
              {{ selectedAccount.remark || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="drawer-section">
          <div class="drawer-section__title">已保存资料</div>
          <div class="account-secret-chip-row">
            <StatusChip v-if="selectedAccount.hasPassword" tone="purple">密码</StatusChip>
            <StatusChip v-if="selectedAccount.hasSecurityInfo" tone="orange">密保</StatusChip>
            <StatusChip v-if="selectedAccount.hasPhone" tone="blue">手机</StatusChip>
            <StatusChip v-if="selectedAccount.hasRecoveryEmail" tone="cyan">备用邮箱</StatusChip>
            <span
              v-if="
                !selectedAccount.hasPassword &&
                !selectedAccount.hasSecurityInfo &&
                !selectedAccount.hasPhone &&
                !selectedAccount.hasRecoveryEmail
              "
            >
              暂无敏感资料
            </span>
          </div>
        </div>

        <div class="account-detail-actions">
          <AppButton variant="soft" @click="openEdit(selectedAccount)">编辑账号</AppButton>
          <AppButton variant="ghost" @click="openRecords(selectedAccount)">查看流水</AppButton>
        </div>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="dialogVisible"
      :title="editingAccount ? '编辑 Apple ID' : '新增 Apple ID'"
      description="敏感资料会加密保存；编辑时留空表示不改原来的资料。"
      eyebrow="账号资料"
      size="720px"
      confirm-text="保存"
      :confirm-loading="saving"
      @confirm="saveAccount"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="apple-core-alert apple-core-alert--blue">
          <StatusChip tone="blue">加密</StatusChip>
          <div>
            <strong>敏感字段会加密保存</strong>
            <p>密码、密保、手机号、备用邮箱不会明文返回前端；编辑时留空表示不修改。</p>
          </div>
        </div>
        <el-form-item v-if="!editingAccount" label="Apple ID" prop="appleId">
          <el-input v-model.trim="form.appleId" placeholder="example@icloud.com" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="地区" prop="region">
            <el-select v-model="form.region" class="full-input" @change="handleFormRegionChange">
              <el-option
                v-for="item in appleAccountRegionOptions"
                :key="item.code"
                :label="`${item.labelZh} ${item.labelEn}（${item.code}）`"
                :value="item.code"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="币种" prop="currency">
            <el-input :model-value="selectedCurrencyLabel" disabled />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="当前余额" prop="currentBalance">
            <el-input v-model.trim="form.currentBalance" />
          </el-form-item>
          <el-form-item label="汇率成本" prop="balanceCostAmount">
            <el-input
              v-model.trim="form.balanceCostAmount"
              placeholder="例如 5.9，表示 1 美元成本 5.9 元人民币"
            />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="状态">
            <el-select v-model="form.status" class="full-input">
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="手动锁定">
            <el-switch v-model="form.isManuallyLocked" active-text="锁定" inactive-text="正常" />
          </el-form-item>
        </div>
        <el-form-item v-if="form.isManuallyLocked" label="锁定原因">
          <el-input v-model="form.manualLockReason" type="textarea" :rows="2" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item :label="editingAccount ? '密码（留空不修改）' : '密码'">
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>
          <el-form-item
            :label="editingAccount ? '绑定手机号（留空不修改）' : '绑定手机号'"
            prop="phone"
          >
            <el-input
              v-model.trim="form.phone"
              class="apple-phone-input"
              :placeholder="selectedRegionOption?.phoneExample ?? '请输入手机号'"
            >
              <template #prepend>{{ selectedRegionOption?.dialCode ?? '+86' }}</template>
            </el-input>
          </el-form-item>
        </div>
        <el-form-item :label="editingAccount ? '备用邮箱（留空不修改）' : '备用邮箱'">
          <el-input v-model.trim="form.recoveryEmail" />
        </el-form-item>
        <el-form-item :label="editingAccount ? '密保信息（留空不修改）' : '密保信息'">
          <el-input v-model="form.securityInfo" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
    </AppDrawer>

    <el-dialog
      v-model="importDialogVisible"
      title="批量导入 Apple ID"
      width="min(820px, calc(100vw - 24px))"
    >
      <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-position="top">
        <div class="apple-core-alert apple-core-alert--blue">
          <StatusChip tone="blue">导入校验</StatusChip>
          <div>
            <strong>导入字段会按现有规则校验和加密</strong>
            <p>密码、手机号、备用邮箱会加密保存；导入结果会逐行返回成功和失败原因。</p>
          </div>
        </div>
        <el-form-item label="导入内容" prop="accountsText">
          <el-input
            v-model="importForm.accountsText"
            type="textarea"
            :rows="10"
            placeholder="支持逗号或制表符分隔，可带表头。字段顺序：appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark。这里的 balanceCostAmount 是接口字段，仍然填余额的总人民币成本；如果只知道汇率成本，请用余额 × 汇率先算成总成本。"
          />
        </el-form-item>
      </el-form>

      <div
        v-if="importResult"
        class="result-alert"
        :class="
          importResult.failedCount
            ? 'apple-core-alert apple-core-alert--orange'
            : 'apple-core-alert apple-core-alert--green'
        "
      >
        <StatusChip :tone="importResult.failedCount ? 'orange' : 'green'">
          {{ importResult.failedCount ? '部分失败' : '导入完成' }}
        </StatusChip>
        <div>
          <strong>
            导入完成：成功 {{ importResult.successCount }} 条，失败
            {{ importResult.failedCount }} 条
          </strong>
          <p>失败行会在下方展示原因，修正后可以再次导入。</p>
        </div>
      </div>
      <el-table
        v-if="importResult?.errors.length"
        class="result-table desktop-data-table"
        :data="importResult.errors"
        max-height="220"
      >
        <el-table-column prop="rowNo" label="行号" width="90" />
        <el-table-column prop="appleId" label="Apple ID" width="180">
          <template #default="{ row }">{{ row.appleId ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="失败原因" />
      </el-table>
      <div
        v-if="importResult?.errors.length"
        class="mobile-record-list"
        aria-label="Apple ID 导入失败移动列表"
      >
        <article v-for="error in importResult.errors" :key="error.rowNo" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>第 {{ error.rowNo }} 行</strong>
              <span>{{ error.appleId ?? '未识别 Apple ID' }}</span>
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

    <AppDrawer
      v-model="topupDialogVisible"
      :title="`录入充值 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="记录充值面值和这次的汇率成本，保存时系统会自动换算成人民币总成本。"
      eyebrow="余额处理"
      size="620px"
      confirm-text="保存充值"
      :confirm-loading="savingBalanceRecord"
      @confirm="saveTopup"
    >
      <el-form ref="topupFormRef" :model="topupForm" :rules="topupRules" label-position="top">
        <div class="form-grid">
          <el-form-item label="充值面值" prop="faceValue">
            <el-input v-model.trim="topupForm.faceValue" />
          </el-form-item>
          <el-form-item label="汇率成本" prop="costAmount">
            <el-input
              v-model.trim="topupForm.costAmount"
              placeholder="例如 5.9，表示 1 美元成本 5.9 元人民币"
            />
          </el-form-item>
        </div>
        <el-form-item label="礼品卡代码 / 充值代码">
          <div class="gift-code-input-row">
            <el-input
              v-model.trim="topupForm.giftCardCode"
              type="password"
              show-password
              placeholder="完整代码加密保存，列表只显示后4位"
            />
            <AppButton variant="soft" @click="pasteGiftCardCode">一键粘贴</AppButton>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="topupForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
    </AppDrawer>

    <AppDrawer
      v-model="consumptionDialogVisible"
      :title="`录入消费 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="记录一次手工扣减，方便后面核对余额和成本。"
      eyebrow="余额处理"
      size="620px"
      confirm-text="保存消费"
      :confirm-loading="savingBalanceRecord"
      @confirm="saveConsumption"
    >
      <el-form
        ref="consumptionFormRef"
        :model="consumptionForm"
        :rules="consumptionRules"
        label-position="top"
      >
        <el-form-item label="消费金额" prop="amount">
          <el-input v-model.trim="consumptionForm.amount" />
        </el-form-item>
        <el-form-item label="消费原因">
          <el-input
            v-model.trim="consumptionForm.reason"
            placeholder="例如 手工开通 / 测试扣费 / 余额修正"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="consumptionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
    </AppDrawer>

    <AppDrawer
      v-model="statusCheckDialogVisible"
      :title="`录入状态检测 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="记录一次账号状态检查，比如正常、需要验证、密码错误或风险。"
      eyebrow="账号检测"
      size="620px"
      confirm-text="保存检测"
      :confirm-loading="savingStatusCheck"
      @confirm="saveStatusCheck"
    >
      <el-form
        ref="statusCheckFormRef"
        :model="statusCheckForm"
        :rules="statusCheckRules"
        label-position="top"
      >
        <div class="form-grid">
          <el-form-item label="检测结果" prop="resultStatus">
            <el-select v-model="statusCheckForm.resultStatus" class="full-input">
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="余额快照">
            <el-input v-model.trim="statusCheckForm.balanceSnapshot" placeholder="可选" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input
            v-model="statusCheckForm.remark"
            type="textarea"
            :rows="3"
            placeholder="例如 人工登录正常 / 需要短信验证 / 密码错误"
          />
        </el-form-item>
      </el-form>
    </AppDrawer>

    <AppDrawer
      v-model="recordsDrawerVisible"
      :title="`余额流水 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="集中查看充值和消费记录，需要完整充值代码时会单独记录审计。"
      eyebrow="余额流水"
      size="760px"
      confirm-text="刷新流水"
      @confirm="loadBalanceRecords"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>当前余额</span>
          <strong>{{ selectedAccount?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>汇率成本</span>
          <strong>{{ selectedAccount ? getAccountExchangeRateCost(selectedAccount) : '-' }}</strong>
        </div>
        <div>
          <span>平均成本</span>
          <strong>{{ selectedAccount ? getAccountExchangeRateCost(selectedAccount) : '-' }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">余额流水</div>
        <el-tabs class="system-tabs balance-record-tabs">
          <el-tab-pane label="充值记录">
            <el-table
              v-loading="recordsLoading"
              class="desktop-data-table"
              :data="topups"
              size="small"
              row-key="id"
            >
              <el-table-column prop="faceValue" label="面值" width="90" />
              <el-table-column label="汇率成本" width="100">
                <template #default="{ row }">{{ getTopupExchangeRateCost(row) }}</template>
              </el-table-column>
              <el-table-column label="人民币总成本" width="120">
                <template #default="{ row }">{{ getTopupTotalCostAmountFromRecord(row) }}</template>
              </el-table-column>
              <el-table-column prop="avgCostAfter" label="充值后均价" width="120" />
              <el-table-column label="礼品卡代码" width="190">
                <template #default="{ row }">
                  <div v-if="row.hasGiftCardCode" class="inline-actions">
                    <StatusChip tone="purple">尾号 {{ row.giftCardCodeTail ?? '-' }}</StatusChip>
                    <AppButton
                      v-if="canRevealGiftCardCode"
                      size="small"
                      variant="ghost"
                      @click="openGiftCodeDialog(row)"
                    >
                      查看完整
                    </AppButton>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="时间" min-width="160">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
            <div v-if="topups.length" class="mobile-record-list" aria-label="充值流水移动列表">
              <article v-for="topup in topups" :key="topup.id" class="mobile-record-card">
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>充值 {{ topup.faceValue }}</strong>
                    <span>{{ formatDate(topup.createdAt) }}</span>
                  </div>
                  <StatusChip v-if="topup.hasGiftCardCode" tone="purple">
                    尾号 {{ topup.giftCardCodeTail ?? '-' }}
                  </StatusChip>
                  <StatusChip v-else tone="neutral">无代码</StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>汇率成本</span>
                    <strong>{{ getTopupExchangeRateCost(topup) }}</strong>
                  </div>
                  <div>
                    <span>总成本</span>
                    <strong>{{ getTopupTotalCostAmountFromRecord(topup) }}</strong>
                  </div>
                  <div>
                    <span>充值后均价</span>
                    <strong>{{ topup.avgCostAfter }}</strong>
                  </div>
                </div>
                <div
                  v-if="topup.hasGiftCardCode && canRevealGiftCardCode"
                  class="mobile-record-card__actions"
                >
                  <AppButton size="small" variant="ghost" @click="openGiftCodeDialog(topup)">
                    查看完整代码
                  </AppButton>
                </div>
              </article>
            </div>
            <div v-else-if="!recordsLoading" class="mobile-record-list" aria-label="充值流水空状态">
              <div class="apple-core-empty-state">
                <strong>暂无充值流水</strong>
                <span>该 Apple ID 最近没有充值记录。</span>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="消费记录">
            <el-table
              v-loading="recordsLoading"
              class="desktop-data-table"
              :data="consumptions"
              size="small"
              row-key="id"
            >
              <el-table-column prop="amount" label="消费" width="90" />
              <el-table-column prop="costAmount" label="成本" width="90" />
              <el-table-column prop="avgUnitCost" label="消费均价" width="110" />
              <el-table-column prop="balanceAfter" label="消费后余额" width="120" />
              <el-table-column prop="createdAt" label="时间" min-width="160">
                <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
            <div
              v-if="consumptions.length"
              class="mobile-record-list"
              aria-label="消费流水移动列表"
            >
              <article
                v-for="consumption in consumptions"
                :key="consumption.id"
                class="mobile-record-card"
              >
                <div class="mobile-record-card__head">
                  <div class="mobile-record-card__title">
                    <strong>消费 {{ consumption.amount }}</strong>
                    <span>{{ formatDate(consumption.createdAt) }}</span>
                  </div>
                  <StatusChip tone="orange">扣减</StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>成本</span>
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
              </article>
            </div>
            <div v-else-if="!recordsLoading" class="mobile-record-list" aria-label="消费流水空状态">
              <div class="apple-core-empty-state">
                <strong>暂无消费流水</strong>
                <span>订单扣减余额后会显示消费成本记录。</span>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="accountSecretDialogVisible"
      title="查看 Apple ID 敏感资料"
      description="完整资料只在必要核对时查看，查看会写入审计日志。"
      eyebrow="敏感资料"
      size="560px"
      confirm-text="查看完整资料"
      confirm-variant="danger"
      :confirm-loading="revealingAccountSecret"
      @closed="resetAccountSecretDialog"
      @confirm="revealAccountSecret"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">审计</StatusChip>
        <div>
          <strong>敏感字段查看会写入审计日志</strong>
          <p>完整资料只用于必要的业务核对，不会出现在列表、导出和操作日志明文中。</p>
        </div>
      </div>
      <el-form
        ref="accountSecretFormRef"
        class="sensitive-form"
        :model="accountSecretForm"
        :rules="accountSecretRules"
        label-position="top"
      >
        <el-form-item label="Apple ID">
          <el-input :model-value="selectedAccount?.appleIdMasked ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="字段" prop="field">
          <el-select
            v-model="accountSecretForm.field"
            class="full-input"
            @change="accountSecretForm.value = ''"
          >
            <el-option
              v-for="item in accountSecretOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="查看原因" prop="reason">
          <el-input
            v-model.trim="accountSecretForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 售后登录核对 / 客户资料变更 / 安全验证"
          />
        </el-form-item>
        <el-form-item v-if="accountSecretForm.value" :label="accountSecretFieldLabel">
          <el-input v-model="accountSecretForm.value" type="textarea" :rows="3" readonly />
        </el-form-item>
      </el-form>
    </AppDrawer>

    <AppDrawer
      v-model="giftCodeDialogVisible"
      title="查看完整礼品卡代码"
      description="完整代码只用于核对充值记录，查看时会写入审计日志。"
      eyebrow="敏感资料"
      size="560px"
      confirm-text="查看完整代码"
      confirm-variant="danger"
      :confirm-loading="revealingGiftCode"
      @closed="resetGiftCodeDialog"
      @confirm="revealGiftCardCode"
    >
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">审计</StatusChip>
        <div>
          <strong>敏感字段查看会写入审计日志</strong>
          <p>完整代码只用于核对充值记录，不会出现在列表、导出和操作日志明文中。</p>
        </div>
      </div>
      <el-form
        ref="giftCodeFormRef"
        class="sensitive-form"
        :model="giftCodeForm"
        :rules="giftCodeRules"
        label-position="top"
      >
        <el-form-item label="充值记录">
          <el-input :model-value="giftCodeRecordLabel" disabled />
        </el-form-item>
        <el-form-item label="查看原因" prop="reason">
          <el-input
            v-model.trim="giftCodeForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 售后核对 / 财务对账 / 重复充值排查"
          />
        </el-form-item>
        <el-form-item v-if="giftCodeForm.code" label="完整礼品卡代码">
          <el-input v-model="giftCodeForm.code" type="textarea" :rows="3" readonly />
        </el-form-item>
      </el-form>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleAccountsApi, userTableViewsApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleAccount,
  AppleAccountImportResult,
  AppleAccountSecretField,
  AppleBalanceConsumption,
  AppleBalanceTopup,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  appleAccountCurrencyOptions,
  appleAccountRegionOptions,
  formatCurrencyLabel,
  formatRegionCurrency,
  getAppleAccountRegionOption,
  getCurrencyForRegion,
  normalizePhoneForRegion
} from '@/utils/appleAccountRegion';
import {
  createSmartQueryKey,
  getSmartQueryData,
  invalidateSmartQueries,
  refreshSmartQuery
} from '@/utils/smartQuery';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';

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
const tableKey = 'apple_accounts';
const accountStatusOptions = statusOptions.map((item) => ({
  label: item.label,
  value: item.value
}));
const accountColumnOptions = [
  { label: 'Apple ID', value: 'appleId', required: true },
  { label: '地区/币种', value: 'region' },
  { label: '余额', value: 'currentBalance' },
  { label: '汇率成本', value: 'balanceCostAmount' },
  { label: '平均成本', value: 'averageCost' },
  { label: '状态', value: 'status' },
  { label: '敏感资料', value: 'secrets' },
  { label: '锁定', value: 'isManuallyLocked' },
  { label: '更新时间', value: 'updatedAt' }
];
const lockedOptions = [
  { label: '已锁定', value: 'true' },
  { label: '未锁定', value: 'false' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const savingBalanceRecord = ref(false);
const savingStatusCheck = ref(false);
const revealingAccountSecret = ref(false);
const revealingGiftCode = ref(false);
const dialogVisible = ref(false);
const importDialogVisible = ref(false);
const topupDialogVisible = ref(false);
const consumptionDialogVisible = ref(false);
const statusCheckDialogVisible = ref(false);
const accountActionsDrawerVisible = ref(false);
const detailDrawerVisible = ref(false);
const recordsDrawerVisible = ref(false);
const accountSecretDialogVisible = ref(false);
const giftCodeDialogVisible = ref(false);
const recordsLoading = ref(false);
const editingAccount = ref<AppleAccount | null>(null);
const selectedAccount = ref<AppleAccount | null>(null);
const selectedTopup = ref<AppleBalanceTopup | null>(null);
const formRef = ref<FormInstance>();
const importFormRef = ref<FormInstance>();
const topupFormRef = ref<FormInstance>();
const consumptionFormRef = ref<FormInstance>();
const statusCheckFormRef = ref<FormInstance>();
const accountSecretFormRef = ref<FormInstance>();
const giftCodeFormRef = ref<FormInstance>();
const accounts = ref<AppleAccount[]>([]);
const topups = ref<AppleBalanceTopup[]>([]);
const consumptions = ref<AppleBalanceConsumption[]>([]);
const importResult = ref<AppleAccountImportResult | null>(null);
const selectedAccounts = ref<AppleAccount[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const total = ref(0);
const activeAccountsQueryKey = ref('');
const activatedOnce = ref(false);
const authStore = useAuthStore();
const router = useRouter();

type AppleAccountPage = Awaited<ReturnType<typeof appleAccountsApi.list>>;
type AppleAccountListParams = Parameters<typeof appleAccountsApi.list>[0];

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  region: '',
  currency: '',
  locked: '',
  sortBy: '',
  sortOrder: '' as '' | 'asc' | 'desc'
});

const form = reactive({
  appleId: '',
  region: 'CN',
  currency: 'CNY',
  currentBalance: '0',
  balanceCostAmount: '0',
  status: 'normal' as AppleAccount['status'],
  isManuallyLocked: false,
  manualLockReason: '',
  password: '',
  securityInfo: '',
  phone: '',
  recoveryEmail: '',
  remark: ''
});

const importForm = reactive({
  accountsText: ''
});

const topupForm = reactive({
  faceValue: '',
  costAmount: '',
  giftCardCode: '',
  remark: ''
});

const consumptionForm = reactive({
  amount: '',
  reason: '',
  remark: ''
});

const statusCheckForm = reactive({
  resultStatus: 'normal' as AppleAccount['status'],
  balanceSnapshot: '',
  remark: ''
});

const giftCodeForm = reactive({
  reason: '',
  code: ''
});

const accountSecretForm = reactive({
  field: 'appleId' as AppleAccountSecretField,
  reason: '',
  value: ''
});

const rules: FormRules<typeof form> = {
  appleId: [{ required: true, message: '请输入 Apple ID', trigger: 'blur' }],
  region: [{ required: true, message: '请选择地区', trigger: 'change' }],
  currency: [{ required: true, message: '请选择币种', trigger: 'change' }],
  currentBalance: [{ required: true, message: '请输入余额', trigger: 'blur' }],
  balanceCostAmount: [{ required: true, message: '请输入汇率成本', trigger: 'blur' }],
  phone: [
    {
      validator: (_rule, value: string, callback) => {
        if (!value) {
          callback();
          return;
        }

        const normalized = normalizePhoneForRegion(value, form.region);
        if (typeof normalized !== 'string' && !normalized.valid) {
          callback(new Error(normalized.message));
          return;
        }

        callback();
      },
      trigger: 'blur'
    }
  ]
};

const importRules: FormRules<typeof importForm> = {
  accountsText: [{ required: true, message: '请输入导入内容', trigger: 'blur' }]
};

const topupRules: FormRules<typeof topupForm> = {
  faceValue: [{ required: true, message: '请输入充值面值', trigger: 'blur' }],
  costAmount: [{ required: true, message: '请输入汇率成本', trigger: 'blur' }]
};

const consumptionRules: FormRules<typeof consumptionForm> = {
  amount: [{ required: true, message: '请输入消费金额', trigger: 'blur' }]
};

const statusCheckRules: FormRules<typeof statusCheckForm> = {
  resultStatus: [{ required: true, message: '请选择检测结果', trigger: 'change' }]
};

const giftCodeRules: FormRules<typeof giftCodeForm> = {
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const accountSecretRules: FormRules<typeof accountSecretForm> = {
  field: [{ required: true, message: '请选择字段', trigger: 'change' }],
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const totalBalance = computed(() =>
  sumDecimal(accounts.value.map((account) => account.currentBalance))
);
const totalCost = computed(() =>
  sumDecimal(accounts.value.map((account) => getAccountTotalCostAmount(account)))
);
const exchangeRateCostSummary = computed(() =>
  divideDecimalInputs(totalCost.value, totalBalance.value, 4)
);
const lockedCount = computed(
  () => accounts.value.filter((account) => account.isManuallyLocked).length
);
const normalAccountsCount = computed(
  () =>
    accounts.value.filter((account) => account.status === 'normal' && !account.isManuallyLocked)
      .length
);
const attentionAccountsCount = computed(
  () =>
    accounts.value.filter((account) => account.status !== 'normal' || account.isManuallyLocked)
      .length
);
const secretReadyCount = computed(
  () =>
    accounts.value.filter(
      (account) =>
        account.hasPassword ||
        account.hasSecurityInfo ||
        account.hasPhone ||
        account.hasRecoveryEmail
    ).length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const lockedLabel = lockedOptions.find((item) => item.value === query.locked)?.label;

  if (query.region) {
    chips.push({ key: 'region', label: '地区', value: query.region });
  }

  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }

  if (query.locked && lockedLabel) {
    chips.push({ key: 'locked', label: '手动锁定', value: lockedLabel });
  }

  return chips;
});
const canRevealGiftCardCode = computed(
  () =>
    authStore.user?.roles.includes('admin') ||
    authStore.user?.permissions.includes('apple.topup.gift_code.view_full')
);
const accountSecretOptions = computed(() =>
  selectedAccount.value ? getAccountSecretOptions(selectedAccount.value) : []
);
const accountSecretFieldLabel = computed(
  () =>
    accountSecretOptions.value.find((item) => item.value === accountSecretForm.field)?.label ??
    '完整资料'
);
const giftCodeRecordLabel = computed(() => {
  if (!selectedTopup.value) {
    return '-';
  }

  return `${formatDate(selectedTopup.value.createdAt)} / 面值 ${selectedTopup.value.faceValue} / 尾号 ${
    selectedTopup.value.giftCardCodeTail ?? '-'
  }`;
});
const selectedRegionOption = computed(() => getAppleAccountRegionOption(form.region));
const selectedCurrencyLabel = computed(() => formatCurrencyLabel(form.currency));

const accountSortFieldMap: Record<string, string> = {
  appleId: 'appleId',
  region: 'region',
  currentBalance: 'currentBalance',
  balanceCostAmount: 'averageCost',
  averageCost: 'averageCost',
  status: 'status',
  isManuallyLocked: 'isManuallyLocked',
  updatedAt: 'updatedAt'
};

function sumDecimal(values: string[]) {
  return values.reduce((sum, value) => sum + Number(value), 0).toFixed(2);
}

function parseDecimalInput(value?: string | null) {
  const numberValue = Number(String(value ?? '').trim());
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatDecimalInput(value: number, maximumFractionDigits = 8) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return Number(value.toFixed(maximumFractionDigits)).toString();
}

function multiplyDecimalInputs(left: string, right: string, maximumFractionDigits = 8) {
  return formatDecimalInput(
    parseDecimalInput(left) * parseDecimalInput(right),
    maximumFractionDigits
  );
}

function divideDecimalInputs(numerator: string, denominator: string, maximumFractionDigits = 8) {
  const denominatorValue = parseDecimalInput(denominator);

  if (denominatorValue <= 0) {
    return '0';
  }

  return formatDecimalInput(parseDecimalInput(numerator) / denominatorValue, maximumFractionDigits);
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

function getAccountExchangeRateCost(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return formatDecimalInput(parseDecimalInput(account.balanceCostAmount), 4);
  }

  return formatDecimalInput(parseDecimalInput(account.averageCost), 4);
}

function getAccountTotalCostAmount(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return multiplyDecimalInputs(account.currentBalance, account.balanceCostAmount, 4);
  }

  return account.balanceCostAmount;
}

function getAccountFormTotalCostAmount() {
  return multiplyDecimalInputs(form.currentBalance, form.balanceCostAmount, 4);
}

function getTopupTotalCostAmount() {
  return multiplyDecimalInputs(topupForm.faceValue, topupForm.costAmount, 4);
}

function isLikelyLegacyTopupRateCost(topup: AppleBalanceTopup) {
  const faceValue = parseDecimalInput(topup.faceValue);
  const storedCost = parseDecimalInput(topup.costAmount);
  const exchangeRateCost = faceValue > 0 ? storedCost / faceValue : 0;
  const currency = selectedAccount.value?.currency ?? '';

  return (
    currency !== 'CNY' &&
    faceValue > 1 &&
    storedCost >= 1 &&
    exchangeRateCost > 0 &&
    exchangeRateCost < 1
  );
}

function getTopupExchangeRateCost(topup: AppleBalanceTopup) {
  if (isLikelyLegacyTopupRateCost(topup)) {
    return formatDecimalInput(parseDecimalInput(topup.costAmount), 4);
  }

  return divideDecimalInputs(topup.costAmount, topup.faceValue, 4);
}

function getTopupTotalCostAmountFromRecord(topup: AppleBalanceTopup) {
  if (isLikelyLegacyTopupRateCost(topup)) {
    return multiplyDecimalInputs(topup.faceValue, topup.costAmount, 4);
  }

  return topup.costAmount;
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

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadAccounts(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildAccountListParams();
  const key = createSmartQueryKey('apple-accounts', params);
  const cached = getSmartQueryData<AppleAccountPage>(key);

  activeAccountsQueryKey.value = key;

  if (cached) {
    applyAccountListResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => appleAccountsApi.list(params),
      force: options.force ?? true
    });

    if (activeAccountsQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyAccountListResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 失败');
    }
  } finally {
    if (activeAccountsQueryKey.value === key) {
      loading.value = false;
    }
  }
}

function buildAccountListParams(): AppleAccountListParams {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    region: query.region || undefined,
    currency: query.currency || undefined,
    locked: query.locked || undefined,
    sortBy: query.sortBy || undefined,
    sortOrder: query.sortOrder || undefined
  };
}

function applyAccountListResult(data: AppleAccountPage) {
  accounts.value = data.items;
  total.value = data.total;
}

function applyFilters() {
  query.page = 1;
  loadAccounts();
}

function handleRegionFilterChange() {
  query.currency = query.region ? getCurrencyForRegion(query.region) : '';
  applyFilters();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.region = '';
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
  if (key === 'region') {
    query.region = '';
  }
  if (key === 'currency') {
    query.currency = '';
  }
  if (key === 'locked') {
    query.locked = '';
  }
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

function handleSelectionChange(rows: AppleAccount[]) {
  selectedAccounts.value = rows;
}

function exportList() {
  ElMessage.info('Apple ID 列表导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 列表视图', {
      inputValue: 'Apple ID 常用视图',
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
        region: query.region,
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
  query.region = typeof filters.region === 'string' ? filters.region : '';
  query.currency = typeof filters.currency === 'string' ? filters.currency : '';
  query.locked = typeof filters.locked === 'string' ? filters.locked : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
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

function resetForm() {
  form.appleId = '';
  form.region = 'CN';
  syncFormCurrency();
  form.currentBalance = '0';
  form.balanceCostAmount = '0';
  form.status = 'normal';
  form.isManuallyLocked = false;
  form.manualLockReason = '';
  form.password = '';
  form.securityInfo = '';
  form.phone = '';
  form.recoveryEmail = '';
  form.remark = '';
}

function syncFormCurrency() {
  form.currency = getCurrencyForRegion(form.region);
}

function handleFormRegionChange() {
  syncFormCurrency();
  if (form.phone) {
    formRef.value?.validateField('phone').catch(() => undefined);
  }
}

function openCreate() {
  editingAccount.value = null;
  resetForm();
  closeAccountActionSurfaces();
  dialogVisible.value = true;
}

function openImport() {
  importForm.accountsText = '';
  importResult.value = null;
  importDialogVisible.value = true;
}

function openEdit(account: AppleAccount) {
  selectedAccount.value = account;
  editingAccount.value = account;
  form.appleId = '';
  form.region = getAppleAccountRegionOption(account.region)?.code ?? 'CN';
  syncFormCurrency();
  form.currentBalance = account.currentBalance;
  form.balanceCostAmount = getAccountExchangeRateCost(account);
  form.status = account.status;
  form.isManuallyLocked = account.isManuallyLocked;
  form.manualLockReason = account.manualLockReason ?? '';
  form.password = '';
  form.securityInfo = '';
  form.phone = '';
  form.recoveryEmail = '';
  form.remark = account.remark ?? '';
  closeAccountActionSurfaces();
  dialogVisible.value = true;
}

function resetTopupForm() {
  topupForm.faceValue = '';
  topupForm.costAmount = '';
  topupForm.giftCardCode = '';
  topupForm.remark = '';
}

function resetConsumptionForm() {
  consumptionForm.amount = '';
  consumptionForm.reason = '';
  consumptionForm.remark = '';
}

function resetStatusCheckForm(account?: AppleAccount) {
  statusCheckForm.resultStatus = account?.status ?? 'normal';
  statusCheckForm.balanceSnapshot = account?.currentBalance ?? '';
  statusCheckForm.remark = '';
}

function resetGiftCodeDialog() {
  selectedTopup.value = null;
  giftCodeForm.reason = '';
  giftCodeForm.code = '';
}

function resetAccountSecretDialog() {
  accountSecretForm.field = 'appleId';
  accountSecretForm.reason = '';
  accountSecretForm.value = '';
}

function canRevealAccountSecret(permission: string) {
  return (
    authStore.user?.roles.includes('admin') || authStore.user?.permissions.includes(permission)
  );
}

function getAccountSecretOptions(account: AppleAccount) {
  const options: Array<{
    label: string;
    value: AppleAccountSecretField;
    permission: string;
    hasValue: boolean;
  }> = [
    {
      label: '完整 Apple ID',
      value: 'appleId',
      permission: 'apple.account.view_full',
      hasValue: true
    },
    {
      label: '密码',
      value: 'password',
      permission: 'apple.secret.view_password',
      hasValue: account.hasPassword
    },
    {
      label: '密保',
      value: 'securityInfo',
      permission: 'apple.secret.view_security',
      hasValue: account.hasSecurityInfo
    },
    {
      label: '绑定手机号',
      value: 'phone',
      permission: 'apple.secret.view_phone',
      hasValue: account.hasPhone
    },
    {
      label: '备用邮箱',
      value: 'recoveryEmail',
      permission: 'apple.secret.view_email',
      hasValue: account.hasRecoveryEmail
    }
  ];

  return options.filter((item) => item.hasValue && canRevealAccountSecret(item.permission));
}

function openAccountActions(account: AppleAccount) {
  selectedAccount.value = account;
  detailDrawerVisible.value = false;
  accountActionsDrawerVisible.value = true;
}

function closeAccountActionSurfaces() {
  accountActionsDrawerVisible.value = false;
  detailDrawerVisible.value = false;
}

function openTopup(account: AppleAccount) {
  selectedAccount.value = account;
  resetTopupForm();
  closeAccountActionSurfaces();
  topupDialogVisible.value = true;
}

function openConsumption(account: AppleAccount) {
  selectedAccount.value = account;
  resetConsumptionForm();
  closeAccountActionSurfaces();
  consumptionDialogVisible.value = true;
}

function openStatusCheck(account: AppleAccount) {
  selectedAccount.value = account;
  resetStatusCheckForm(account);
  closeAccountActionSurfaces();
  statusCheckDialogVisible.value = true;
}

function openAccountSecret(account: AppleAccount) {
  selectedAccount.value = account;
  resetAccountSecretDialog();
  const firstOption = getAccountSecretOptions(account)[0];

  if (!firstOption) {
    ElMessage.warning('当前账号没有可查看的敏感字段，或你没有对应权限');
    return;
  }

  accountSecretForm.field = firstOption.value;
  closeAccountActionSurfaces();
  accountSecretDialogVisible.value = true;
}

async function openRecords(account: AppleAccount) {
  selectedAccount.value = account;
  closeAccountActionSurfaces();
  recordsDrawerVisible.value = true;
  await loadBalanceRecords();
}

function openDetail(account: AppleAccount) {
  selectedAccount.value = account;
  accountActionsDrawerVisible.value = false;
  detailDrawerVisible.value = true;
}

function openSelectedDetailPage() {
  if (!selectedAccount.value) {
    return;
  }

  closeAccountActionSurfaces();
  router.push({
    path: '/apple/accounts/detail',
    query: {
      id: selectedAccount.value.id
    }
  });
}

function openGiftCodeDialog(topup: AppleBalanceTopup) {
  selectedTopup.value = topup;
  giftCodeForm.reason = '';
  giftCodeForm.code = '';
  giftCodeDialogVisible.value = true;
}

async function loadBalanceRecords() {
  if (!selectedAccount.value) {
    return;
  }

  recordsLoading.value = true;
  try {
    const [topupData, consumptionData] = await Promise.all([
      appleAccountsApi.listTopups(selectedAccount.value.id, { page: 1, pageSize: 20 }),
      appleAccountsApi.listConsumptions(selectedAccount.value.id, { page: 1, pageSize: 20 })
    ]);
    topups.value = topupData.items;
    consumptions.value = consumptionData.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载余额流水失败');
  } finally {
    recordsLoading.value = false;
  }
}

async function pasteGiftCardCode() {
  if (!navigator.clipboard?.readText) {
    ElMessage.warning('当前浏览器不支持一键读取剪贴板，请手动粘贴');
    return;
  }

  try {
    const clipboardText = (await navigator.clipboard.readText()).trim();

    if (!clipboardText) {
      ElMessage.warning('剪贴板里没有可粘贴的内容');
      return;
    }

    topupForm.giftCardCode = clipboardText;
    ElMessage.success('已粘贴充值代码');
  } catch {
    ElMessage.warning('浏览器没有允许读取剪贴板，请手动粘贴');
  }
}

async function saveAccount() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const normalizedPhone = normalizePhoneForRegion(form.phone, form.region);
  if (typeof normalizedPhone !== 'string' && !normalizedPhone.valid) {
    ElMessage.error(normalizedPhone.message);
    return;
  }

  const phoneToSave =
    typeof normalizedPhone !== 'string' && normalizedPhone.valid
      ? normalizedPhone.value
      : form.phone || undefined;

  saving.value = true;
  try {
    const payload = {
      region: form.region,
      currency: form.currency,
      currentBalance: form.currentBalance,
      balanceCostAmount: getAccountFormTotalCostAmount(),
      status: form.status,
      isManuallyLocked: form.isManuallyLocked,
      manualLockReason: form.manualLockReason || null,
      password: form.password || undefined,
      securityInfo: form.securityInfo || undefined,
      phone: phoneToSave,
      recoveryEmail: form.recoveryEmail || undefined,
      remark: form.remark || null
    };

    if (editingAccount.value) {
      await appleAccountsApi.update(editingAccount.value.id, payload);
    } else {
      await appleAccountsApi.create({
        ...payload,
        appleId: form.appleId
      });
    }

    ElMessage.success('Apple ID 已保存');
    dialogVisible.value = false;
    invalidateSmartQueries('apple-accounts');
    await loadAccounts();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 失败');
  } finally {
    saving.value = false;
  }
}

async function submitImport() {
  const valid = await importFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const accounts = importForm.accountsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!accounts.length) {
    ElMessage.warning('请输入至少一个 Apple ID');
    return;
  }

  importing.value = true;
  try {
    const result = await appleAccountsApi.importAccounts({ accounts });
    importResult.value = result;
    ElMessage.success(`成功导入 ${result.successCount} 个 Apple ID`);
    invalidateSmartQueries('apple-accounts');
    await loadAccounts();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入 Apple ID 失败');
  } finally {
    importing.value = false;
  }
}

async function refreshSelectedAccount() {
  invalidateSmartQueries('apple-accounts');
  await loadAccounts();
  if (!selectedAccount.value) {
    return;
  }

  selectedAccount.value =
    accounts.value.find((account) => account.id === selectedAccount.value?.id) ??
    selectedAccount.value;
}

async function normalizeSelectedAccountCostIfNeeded() {
  const account = selectedAccount.value;

  if (!account || !isLikelyLegacyRateCost(account)) {
    return;
  }

  const updatedAccount = await appleAccountsApi.update(account.id, {
    currentBalance: account.currentBalance,
    balanceCostAmount: getAccountTotalCostAmount(account)
  });

  selectedAccount.value = updatedAccount;
  invalidateSmartQueries('apple-accounts');
  await loadAccounts({ background: true, force: true });
}

async function saveTopup() {
  const valid = await topupFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  savingBalanceRecord.value = true;
  try {
    await normalizeSelectedAccountCostIfNeeded();

    if (!selectedAccount.value) {
      return;
    }

    await appleAccountsApi.createTopup(selectedAccount.value.id, {
      faceValue: topupForm.faceValue,
      costAmount: getTopupTotalCostAmount(),
      giftCardCode: topupForm.giftCardCode || null,
      remark: topupForm.remark || null
    });
    ElMessage.success('充值已保存');
    topupDialogVisible.value = false;
    await refreshSelectedAccount();
    await loadBalanceRecords();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存充值失败');
  } finally {
    savingBalanceRecord.value = false;
  }
}

async function saveConsumption() {
  const valid = await consumptionFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  savingBalanceRecord.value = true;
  try {
    await normalizeSelectedAccountCostIfNeeded();

    if (!selectedAccount.value) {
      return;
    }

    await appleAccountsApi.createConsumption(selectedAccount.value.id, {
      amount: consumptionForm.amount,
      reason: consumptionForm.reason || null,
      remark: consumptionForm.remark || null
    });
    ElMessage.success('消费已保存');
    consumptionDialogVisible.value = false;
    await refreshSelectedAccount();
    await loadBalanceRecords();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存消费失败');
  } finally {
    savingBalanceRecord.value = false;
  }
}

async function saveStatusCheck() {
  const valid = await statusCheckFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  savingStatusCheck.value = true;
  try {
    await appleAccountsApi.createStatusCheck(selectedAccount.value.id, {
      checkType: 'manual',
      resultStatus: statusCheckForm.resultStatus,
      balanceSnapshot: statusCheckForm.balanceSnapshot || null,
      remark: statusCheckForm.remark || null
    });
    ElMessage.success('状态检测已保存');
    statusCheckDialogVisible.value = false;
    await refreshSelectedAccount();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存状态检测失败');
  } finally {
    savingStatusCheck.value = false;
  }
}

async function revealGiftCardCode() {
  const valid = await giftCodeFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedTopup.value) {
    return;
  }

  revealingGiftCode.value = true;
  try {
    const data = await appleAccountsApi.revealGiftCardCode(selectedTopup.value.id, {
      reason: giftCodeForm.reason
    });
    giftCodeForm.code = data.giftCardCode;
    ElMessage.success('完整礼品卡代码已显示，审计日志已记录');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整礼品卡代码失败');
  } finally {
    revealingGiftCode.value = false;
  }
}

async function revealAccountSecret() {
  const valid = await accountSecretFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  revealingAccountSecret.value = true;
  try {
    const data = await appleAccountsApi.revealSecret(selectedAccount.value.id, {
      field: accountSecretForm.field,
      reason: accountSecretForm.reason
    });
    accountSecretForm.value = data.value;
    ElMessage.success('完整资料已显示，审计日志已记录');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整资料失败');
  } finally {
    revealingAccountSecret.value = false;
  }
}

async function loadPageData() {
  const tableViewsPromise = loadTableViews(true);
  const accountsPromise = loadAccounts({ force: false });
  const defaultViewApplied = await tableViewsPromise;

  await accountsPromise;

  if (defaultViewApplied) {
    await loadAccounts({
      background: accounts.value.length > 0,
      force: false
    });
  }
}

async function initializePage() {
  await loadPageData();
}

onMounted(initializePage);
onActivated(() => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }

  void loadAccounts({
    background: accounts.value.length > 0,
    force: false
  });
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-accounts'], () => {
  void loadAccounts({
    background: accounts.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
