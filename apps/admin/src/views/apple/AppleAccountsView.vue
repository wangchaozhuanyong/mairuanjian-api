<template>
  <PageScaffold
    title="Apple ID 管理"
    group="Apple ID 业务"
    phase="Phase 3"
    description="管理 Apple ID 基础资料、余额、平均成本、状态和手动锁定。敏感字段加密保存，列表默认脱敏。"
  >
    <template #actions>
      <AppButton @click="openImport">批量导入</AppButton>
    </template>

    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="Apple ID 资产列表"
          :help="[
            '这里放可以拿来开通业务的 Apple ID。先看余额够不够、状态正不正常，再决定要不要充值、锁定或查看资料。',
            '也可以搜索、排序、翻页，看余额流水和充值、消费记录。'
          ]"
        />
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
          <StatusChip tone="orange">均价 {{ averageCostSummary }}</StatusChip>
          <StatusChip tone="blue">寄存 {{ ownershipReport?.consigned.count ?? 0 }}</StatusChip>
          <StatusChip tone="purple">售出 {{ ownershipReport?.sold.count ?? 0 }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        :status-options="accountStatusOptions"
        :filter-chips="filterChips"
        :selected-count="selectedAccounts.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        :show-save-view="false"
        show-filter-chips
        primary-label="新增 Apple ID"
        placeholder="搜索 Apple ID、地区、币种、备注"
        @search="applyFilters"
        @refresh="loadAccounts"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
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
              v-for="item in appleRegionOptions"
              :key="item.code"
              :label="formatAppleAccountRegionOptionLabel(item)"
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
              v-for="item in appleCurrencyOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="query.sourceChannelId"
            class="table-toolbar__select"
            placeholder="来源渠道"
            clearable
            filterable
            @change="applyFilters"
          >
            <el-option
              v-for="item in sourceChannels"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
          <el-select
            v-model="query.ownershipType"
            class="table-toolbar__select"
            placeholder="ID类型"
            clearable
            @change="applyFilters"
          >
            <el-option
              v-for="item in ownershipOptions"
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
        <template #actions>
          <AppButton class="table-toolbar__op" variant="soft" @click="openImport">
            批量导入
          </AppButton>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="accounts"
        size="default"
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
        <el-table-column prop="appleId" label="Apple ID" min-width="190" sortable="custom">
          <template #default="{ row }">{{ row.appleIdMasked }}</template>
        </el-table-column>
        <el-table-column label="来源渠道" min-width="150">
          <template #default="{ row }">
            <StatusChip v-if="row.sourceChannel" tone="blue">
              {{ row.sourceChannel.name }}
            </StatusChip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="region" label="地区/币种" min-width="230" sortable="custom">
          <template #header>
            <span class="help-label">
              地区/币种
              <FeatureHelp
                text="这个 ID 属于哪个地区，就用哪个币种记余额。选错会影响后面充值、消费和成本计算。"
              />
            </span>
          </template>
          <template #default="{ row }">{{
            formatAccountRegionCurrency(row.region, row.currency)
          }}</template>
        </el-table-column>
        <el-table-column prop="currentBalance" label="余额" width="120" sortable="custom">
          <template #header>
            <span class="help-label">
              余额
              <FeatureHelp text="这个 Apple ID 现在还剩多少可以用的余额。" />
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="averageCost" label="平均成本" width="130" sortable="custom">
          <template #header>
            <span class="help-label">
              平均成本
              <FeatureHelp
                text="现在每 1 美元余额大概花了多少人民币成本。系统会按充值前的余额和成本，加上本次充值成本后自动算。"
              />
            </span>
          </template>
          <template #default="{ row }">
            {{ getAccountAverageCost(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="ownershipType" label="ID类型" width="120" sortable="custom">
          <template #default="{ row }">
            <StatusChip :tone="row.ownershipType === 'sold' ? 'purple' : 'blue'">
              {{ getOwnershipLabel(row.ownershipType) }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column label="ID成本/售价" min-width="150">
          <template #default="{ row }">
            {{ formatAccountSaleCost(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="130" sortable="custom">
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
        <el-table-column label="敏感资料" min-width="180">
          <template #header>
            <span class="help-label">
              敏感资料
              <FeatureHelp
                text="这里不是直接显示密码，只告诉你这个 ID 有没有保存密码、密保、手机号这类资料。"
              />
            </span>
          </template>
          <template #default="{ row }">
            <div class="apple-account-sensitive-cell">
              <el-tooltip
                v-if="getAccountSensitiveBadges(row).length"
                :content="getAccountSensitiveSummary(row)"
                placement="top"
              >
                <div class="apple-account-sensitive-tags">
                  <StatusChip
                    v-for="badge in getVisibleSensitiveBadges(row)"
                    :key="badge.label"
                    :tone="badge.tone"
                  >
                    {{ badge.label }}
                  </StatusChip>
                  <StatusChip v-if="getHiddenSensitiveCount(row) > 0" tone="neutral">
                    +{{ getHiddenSensitiveCount(row) }}
                  </StatusChip>
                </div>
              </el-tooltip>
              <span v-else>-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="isManuallyLocked" label="锁定" width="100" sortable="custom">
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
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="account-row-actions">
              <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
              <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <el-dropdown trigger="click" @command="handleAccountMoreCommand($event, row)">
                <AppButton size="small" variant="soft">更多</AppButton>
                <template #dropdown>
                  <el-dropdown-menu class="account-more-menu">
                    <el-dropdown-item command="secret">敏感资料</el-dropdown-item>
                    <el-dropdown-item command="status-check">检测</el-dropdown-item>
                    <el-dropdown-item command="topup">充值</el-dropdown-item>
                    <el-dropdown-item command="consumption">消费</el-dropdown-item>
                    <el-dropdown-item command="records">流水</el-dropdown-item>
                    <el-dropdown-item command="delete" divided class="account-more-menu__danger">
                      删除 ID
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="accounts.length" class="mobile-record-list apple-account-mobile-list">
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
              <span>余额</span>
              <strong>{{ account.currentBalance }}</strong>
            </div>
            <div>
              <span>平均成本</span>
              <strong>{{ getAccountAverageCost(account) }}</strong>
            </div>
            <div>
              <span>ID类型</span>
              <strong>{{ getOwnershipLabel(account.ownershipType) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>来源渠道</span>
              <strong>{{ account.sourceChannel?.name ?? '-' }}</strong>
            </div>
            <div>
              <span>锁定状态</span>
              <StatusChip :tone="account.isManuallyLocked ? 'red' : 'green'" dot>
                {{ account.isManuallyLocked ? '已锁定' : '正常' }}
              </StatusChip>
            </div>
            <div>
              <span>敏感资料</span>
              <div class="mobile-record-card__chips apple-account-sensitive-tags">
                <template v-if="getAccountSensitiveBadges(account).length">
                  <StatusChip
                    v-for="badge in getVisibleSensitiveBadges(account)"
                    :key="badge.label"
                    :tone="badge.tone"
                  >
                    {{ badge.label }}
                  </StatusChip>
                  <StatusChip v-if="getHiddenSensitiveCount(account) > 0" tone="neutral">
                    +{{ getHiddenSensitiveCount(account) }}
                  </StatusChip>
                </template>
                <em v-else>未保存</em>
              </div>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(account.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openDetail(account)">详情</AppButton>
            <AppButton size="small" variant="ghost" @click="openEdit(account)">编辑</AppButton>
            <el-dropdown trigger="click" @command="handleAccountMoreCommand($event, account)">
              <AppButton size="small" variant="soft">更多</AppButton>
              <template #dropdown>
                <el-dropdown-menu class="account-more-menu">
                  <el-dropdown-item command="secret">敏感资料</el-dropdown-item>
                  <el-dropdown-item command="status-check">检测</el-dropdown-item>
                  <el-dropdown-item command="topup">充值</el-dropdown-item>
                  <el-dropdown-item command="consumption">消费</el-dropdown-item>
                  <el-dropdown-item command="records">流水</el-dropdown-item>
                  <el-dropdown-item command="delete" divided class="account-more-menu__danger">
                    删除 ID
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 账号空状态">
        <div class="apple-core-empty-state">
          <strong>暂无 Apple ID 账号</strong>
          <span>可以新增账号、批量导入，或清空筛选后重新查看当前账号库。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="soft" @click="openImport">批量导入</AppButton>
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
      v-model="detailDrawerVisible"
      :title="`ID 详情 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="这里先展示最常用的信息；需要完整详情时可以打开详情页继续看。"
      eyebrow="详情预览"
      size="620px"
      confirm-text="打开详情页"
      @confirm="openSelectedDetailPage"
    >
      <div v-if="selectedAccount" class="account-detail-drawer">
        <AppleAccountDrawerSummary
          :apple-id="selectedAccount.appleIdMasked"
          :region-currency="
            formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
          "
          :balance="selectedAccount.currentBalance"
          :average-cost="getAccountAverageCost(selectedAccount)"
          :status-label="getStatusLabel(selectedAccount.status)"
          :status-tone="getStatusTone(selectedAccount.status)"
          :locked="selectedAccount.isManuallyLocked"
          :source-channel="selectedAccount.sourceChannel?.name"
        />

        <div class="drawer-section">
          <div class="drawer-section__title">账号信息</div>
          <el-descriptions class="detail-descriptions" :column="1" border>
            <el-descriptions-item label="Apple ID">
              {{ selectedAccount.appleIdMasked }}
            </el-descriptions-item>
            <el-descriptions-item label="地区/币种">
              {{ formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency) }}
            </el-descriptions-item>
            <el-descriptions-item label="来源渠道">
              {{ selectedAccount.sourceChannel?.name ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <StatusChip :tone="getStatusTone(selectedAccount.status)" dot>
                {{ getStatusLabel(selectedAccount.status) }}
              </StatusChip>
            </el-descriptions-item>
            <el-descriptions-item label="ID类型">
              <StatusChip :tone="selectedAccount.ownershipType === 'sold' ? 'purple' : 'blue'">
                {{ getOwnershipLabel(selectedAccount.ownershipType) }}
              </StatusChip>
            </el-descriptions-item>
            <el-descriptions-item label="ID成本/售价">
              {{ formatAccountSaleCost(selectedAccount) }}
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
      <AppleAccountDrawerSummary
        v-if="editingAccount && selectedAccount"
        label="正在编辑"
        :apple-id="selectedAccount.appleIdMasked"
        :region-currency="
          formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
        "
        :balance="selectedAccount.currentBalance"
        :average-cost="getAccountAverageCost(selectedAccount)"
        :status-label="getStatusLabel(selectedAccount.status)"
        :status-tone="getStatusTone(selectedAccount.status)"
        :locked="selectedAccount.isManuallyLocked"
        :source-channel="selectedAccount.sourceChannel?.name"
      />
      <el-form
        ref="formRef"
        class="account-drawer-form"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <div class="apple-core-alert apple-core-alert--blue">
          <StatusChip tone="blue">加密</StatusChip>
          <div>
            <strong>敏感字段会加密保存</strong>
            <p>密码、密保、手机号、备用邮箱不会明文返回前端；编辑时留空表示不修改。</p>
          </div>
        </div>
        <el-form-item v-if="!editingAccount" prop="appleId">
          <template #label>
            <FieldHelpLabel
              label="Apple ID"
              purpose="账号邮箱，是这条 Apple ID 资料的唯一识别信息，列表默认会脱敏展示。"
              example="填完整邮箱，例如 example@icloud.com。"
            />
          </template>
          <el-input v-model.trim="form.appleId" placeholder="example@icloud.com" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="来源渠道"
              purpose="记录这个 Apple ID 从哪个来源渠道获得，方便以后追踪采购来源和成本。"
              example="可以选供应商、闲鱼、淘宝或内部自建的来源渠道。"
            />
          </template>
          <el-select
            v-model="form.sourceChannelId"
            class="full-input"
            clearable
            filterable
            placeholder="请选择来源渠道"
          >
            <el-option
              v-for="item in sourceChannels"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item prop="region">
            <template #label>
              <FieldHelpLabel
                label="地区"
                purpose="Apple ID 所属地区，会影响可接业务、默认币种和手机号提示。"
                example="美区选 US，港区选 HK；不确定时先按账号实际 App Store 地区填写。"
              />
            </template>
            <el-select v-model="form.region" class="full-input" @change="handleFormRegionChange">
              <el-option
                v-for="item in appleRegionOptions"
                :key="item.code"
                :label="formatAppleAccountRegionOptionLabel(item)"
                :value="item.code"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="currency">
            <template #label>
              <FieldHelpLabel
                label="币种"
                purpose="这个 Apple ID 余额使用的外币币种，系统会按地区自动带出。"
                example="US 通常是 USD，HK 通常是 HKD；这里禁用是为了避免地区和币种不一致。"
              />
            </template>
            <el-input :model-value="selectedCurrencyLabel" disabled />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="currentBalance">
            <template #label>
              <FieldHelpLabel
                label="当前余额"
                purpose="账号当前还剩多少外币余额，用于自动匹配订单和余额对账。"
                example="账号还剩 122 USD 就填 122；不要填人民币成本。"
              />
            </template>
            <el-input v-model.trim="form.currentBalance" />
          </el-form-item>
          <el-form-item prop="balanceCostAmount">
            <template #label>
              <FieldHelpLabel
                label="平均成本"
                purpose="当前余额对应的人民币总成本，系统会用它计算移动加权平均成本。"
                example="余额 100 USD，每 1 USD 成本 5.90 元，这里填总成本 590。"
              />
            </template>
            <el-input
              v-model.trim="form.balanceCostAmount"
              placeholder="例如 5.90，表示每 1 美元余额成本 5.90 元人民币"
            />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="ownershipType">
            <template #label>
              <FieldHelpLabel
                label="ID类型"
                purpose="寄存表示 ID 留在你这边继续接单；售出表示这个 ID 会卖给客户并单独计入订单成本。"
                example="常规代开选寄存；把完整账号卖给客户选售出。"
              />
            </template>
            <el-select
              v-model="form.ownershipType"
              class="full-input"
              :disabled="editingAccount?.ownershipType === 'sold'"
            >
              <el-option
                v-for="item in ownershipOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="purchaseCost">
            <template #label>
              <FieldHelpLabel
                label="ID购入成本"
                purpose="这个 Apple ID 本身的人民币采购成本，售出订单会把它计入实际利润。"
                example="买这个 ID 花了 30 元，就填 30。"
              />
            </template>
            <el-input v-model.trim="form.purchaseCost" type="number" inputmode="decimal" min="0" />
          </el-form-item>
          <el-form-item prop="salePrice">
            <template #label>
              <FieldHelpLabel
                label="ID参考售价"
                purpose="卖给客户时的参考价格，用于售出报表统计，不替代订单客户实收。"
                example="准备按 50 元卖出，就填 50。"
              />
            </template>
            <el-input v-model.trim="form.salePrice" type="number" inputmode="decimal" min="0" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="标记账号当前是否可用，自动匹配会避开异常或风险账号。"
                example="正常可接单选正常；需要短信验证选需验证；密码错误就选密码错误。"
              />
            </template>
            <el-select v-model="form.status" class="full-input">
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="手动锁定"
                purpose="人工临时禁止这个 Apple ID 被订单自动匹配，避免处理中账号被再次使用。"
                example="账号在排查、客户投诉或准备专用时打开锁定。"
              />
            </template>
            <el-switch v-model="form.isManuallyLocked" active-text="锁定" inactive-text="正常" />
          </el-form-item>
        </div>
        <el-form-item v-if="form.isManuallyLocked">
          <template #label>
            <FieldHelpLabel
              label="锁定原因"
              purpose="说明为什么人工锁定，方便其他员工知道不能用这个账号。"
              example="可以写余额异常待核对、客户售后中、账号需要短信验证。"
            />
          </template>
          <el-input v-model="form.manualLockReason" type="textarea" :rows="2" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                :label="editingAccount ? '密码（留空不修改）' : '密码'"
                purpose="Apple ID 登录密码，会加密保存；编辑时留空表示不修改原密码。"
                example="新增账号填当前密码；只是改余额或状态时密码留空。"
              />
            </template>
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>
          <el-form-item prop="phone">
            <template #label>
              <FieldHelpLabel
                :label="editingAccount ? '绑定手机号（留空不修改）' : '绑定手机号'"
                purpose="Apple ID 绑定的手机号，会加密保存并默认脱敏展示。"
                example="选择区号后填手机号；编辑账号时不想改手机号就留空。"
              />
            </template>
            <el-input
              v-model.trim="form.phone"
              class="apple-phone-input"
              :placeholder="selectedRegionOption?.phoneExample || '默认 +86，可自由填写手机号'"
            >
              <template #prepend>
                <el-select
                  v-model="form.phoneDialCode"
                  class="apple-phone-dial-select"
                  filterable
                  allow-create
                >
                  <el-option
                    v-for="item in appleRegionOptions"
                    :key="`${item.code}-${item.dialCode}`"
                    :label="item.dialCode"
                    :value="item.dialCode"
                  />
                </el-select>
              </template>
            </el-input>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              :label="editingAccount ? '备用邮箱（留空不修改）' : '备用邮箱'"
              purpose="Apple ID 的备用邮箱或恢复邮箱，会加密保存，用于安全验证和找回。"
              example="有恢复邮箱就填完整邮箱；编辑时不修改就留空。"
            />
          </template>
          <el-input v-model.trim="form.recoveryEmail" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              :label="editingAccount ? '密保信息（留空不修改）' : '密保信息'"
              purpose="记录密保问题、答案或安全验证备注，会加密保存。"
              example="可以按一行一个问题答案填写；编辑时不修改就留空。"
            />
          </template>
          <el-input v-model="form.securityInfo" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录账号补充信息，不参与余额成本计算。"
              example="可以写供应商、购买时间、账号特殊限制或人工注意事项。"
            />
          </template>
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
    </AppDrawer>

    <AppDrawer
      v-model="importDialogVisible"
      title="批量导入 Apple ID"
      description="批量粘贴账号资料，系统会逐行校验并加密保存敏感字段。"
      eyebrow="批量导入"
      size="820px"
      confirm-text="开始导入"
      :confirm-loading="importing"
      @confirm="submitImport"
    >
      <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-position="top">
        <div class="apple-core-alert apple-core-alert--blue">
          <StatusChip tone="blue">导入校验</StatusChip>
          <div>
            <strong>导入字段会按现有规则校验和加密</strong>
            <p>密码、手机号、备用邮箱会加密保存；导入结果会逐行返回成功和失败原因。</p>
          </div>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="默认导入来源渠道"
              purpose="批量导入时给没有单独写来源渠道的账号统一设置来源渠道。"
              example="这一批都来自同一个供应商就选该供应商；每行已写来源渠道可留空。"
            />
          </template>
          <el-select
            v-model="importForm.sourceChannelId"
            class="full-input"
            clearable
            filterable
            placeholder="不选择则导入为未设置来源渠道"
          >
            <el-option
              v-for="item in sourceChannels"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="accountsText">
          <template #label>
            <FieldHelpLabel
              label="导入内容"
              purpose="批量粘贴 Apple ID 资料，系统会逐行校验并加密保存敏感字段。"
              example="可带表头，字段顺序按占位提示填写；一行一个 Apple ID。"
            />
          </template>
          <el-input
            v-model="importForm.accountsText"
            type="textarea"
            :rows="10"
            placeholder="支持逗号或制表符分隔，可带表头。字段顺序：appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark,sourceChannel。sourceChannel 可选，可填来源渠道名称或来源渠道ID；留空时使用上方默认导入来源渠道。balanceCostAmount 仍填余额的人民币总成本；如果只知道平均成本，请用余额 × 平均成本先算成总成本。"
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
    </AppDrawer>

    <AppDrawer
      v-model="topupDialogVisible"
      :title="`录入充值 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="记录充值面值和本次平均成本，保存时系统会自动换算成人民币总成本。"
      eyebrow="余额处理"
      size="620px"
      confirm-text="保存充值"
      :confirm-loading="savingBalanceRecord"
      @confirm="saveTopup"
    >
      <AppleAccountDrawerSummary
        v-if="selectedAccount"
        label="充值账号"
        :apple-id="selectedAccount.appleIdMasked"
        :region-currency="
          formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
        "
        :balance="selectedAccount.currentBalance"
        :average-cost="getAccountAverageCost(selectedAccount)"
        :status-label="getStatusLabel(selectedAccount.status)"
        :status-tone="getStatusTone(selectedAccount.status)"
        :locked="selectedAccount.isManuallyLocked"
        :source-channel="selectedAccount.sourceChannel?.name"
      />
      <div class="drawer-section drawer-section--flush">
        <div class="drawer-section__title">充值信息</div>
        <el-form
          ref="topupFormRef"
          class="account-drawer-form"
          :model="topupForm"
          :rules="topupRules"
          label-position="top"
        >
          <div class="form-grid">
            <el-form-item prop="faceValue">
              <template #label>
                <FieldHelpLabel
                  label="充值面值"
                  purpose="这次给 Apple ID 充值了多少外币余额。"
                  example="充值 100 USD 就填 100；不要填人民币成本。"
                />
              </template>
              <el-input v-model.trim="topupForm.faceValue" />
            </el-form-item>
            <el-form-item prop="costAmount">
              <template #label>
                <FieldHelpLabel
                  label="本次平均成本"
                  purpose="这次充值每 1 外币对应多少人民币成本，用来更新移动加权平均成本。"
                  example="每 1 USD 成本 5.90 元就填 5.90。"
                />
              </template>
              <el-input
                v-model.trim="topupForm.costAmount"
                placeholder="例如 5.90，表示这次每 1 美元成本 5.90 元人民币"
              />
            </el-form-item>
          </div>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="礼品卡代码 / 充值代码"
                purpose="记录本次充值使用的完整代码，会加密保存并默认只显示尾号。"
                example="从剪贴板粘贴完整礼品卡代码；没有代码或不需要记录可留空。"
              />
            </template>
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
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="备注"
                purpose="记录这次充值的来源、付款或人工说明。"
                example="可以写供应商、采购单号、付款批次或异常情况。"
              />
            </template>
            <el-input v-model="topupForm.remark" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
      </div>
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
      <AppleAccountDrawerSummary
        v-if="selectedAccount"
        label="消费账号"
        :apple-id="selectedAccount.appleIdMasked"
        :region-currency="
          formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
        "
        :balance="selectedAccount.currentBalance"
        :average-cost="getAccountAverageCost(selectedAccount)"
        :status-label="getStatusLabel(selectedAccount.status)"
        :status-tone="getStatusTone(selectedAccount.status)"
        :locked="selectedAccount.isManuallyLocked"
        :source-channel="selectedAccount.sourceChannel?.name"
      />
      <div class="drawer-section drawer-section--flush">
        <div class="drawer-section__title">消费信息</div>
        <el-form
          ref="consumptionFormRef"
          class="account-drawer-form"
          :model="consumptionForm"
          :rules="consumptionRules"
          label-position="top"
        >
          <el-form-item prop="amount">
            <template #label>
              <FieldHelpLabel
                label="消费金额"
                purpose="这次手工记录扣掉了多少 Apple ID 外币余额。"
                example="开通业务扣了 20 USD 就填 20。"
              />
            </template>
            <el-input v-model.trim="consumptionForm.amount" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="消费原因"
                purpose="说明这次余额为什么被扣，方便后续对账。"
                example="可以填手工开通、测试扣费、余额修正。"
              />
            </template>
            <el-input
              v-model.trim="consumptionForm.reason"
              placeholder="例如 手工开通 / 测试扣费 / 余额修正"
            />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="备注"
                purpose="记录这次消费的补充说明，不参与金额公式。"
                example="可以写对应客户、订单号或人工处理原因。"
              />
            </template>
            <el-input v-model="consumptionForm.remark" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
      </div>
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
      <AppleAccountDrawerSummary
        v-if="selectedAccount"
        label="检测账号"
        :apple-id="selectedAccount.appleIdMasked"
        :region-currency="
          formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
        "
        :balance="selectedAccount.currentBalance"
        :average-cost="getAccountAverageCost(selectedAccount)"
        :status-label="getStatusLabel(selectedAccount.status)"
        :status-tone="getStatusTone(selectedAccount.status)"
        :locked="selectedAccount.isManuallyLocked"
        :source-channel="selectedAccount.sourceChannel?.name"
      />
      <div class="drawer-section drawer-section--flush">
        <div class="drawer-section__title">检测结果</div>
        <el-form
          ref="statusCheckFormRef"
          class="account-drawer-form"
          :model="statusCheckForm"
          :rules="statusCheckRules"
          label-position="top"
        >
          <div class="form-grid">
            <el-form-item prop="resultStatus">
              <template #label>
                <FieldHelpLabel
                  label="检测结果"
                  purpose="记录这次账号状态检查的结论，后续自动匹配会参考账号状态。"
                  example="能正常登录选正常；需要短信选需验证；密码不对选密码错误。"
                />
              </template>
              <el-select v-model="statusCheckForm.resultStatus" class="full-input">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <FieldHelpLabel
                  label="余额快照"
                  purpose="检测时看到的余额，用来和系统余额做人工核对。"
                  example="登录看到 122 USD 就填 122；没查余额可留空。"
                />
              </template>
              <el-input v-model.trim="statusCheckForm.balanceSnapshot" placeholder="可选" />
            </el-form-item>
          </div>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="备注"
                purpose="记录这次检测过程中的补充信息。"
                example="可以写人工登录正常、需要短信验证、密码错误截图已上传。"
              />
            </template>
            <el-input
              v-model="statusCheckForm.remark"
              type="textarea"
              :rows="3"
              placeholder="例如 人工登录正常 / 需要短信验证 / 密码错误"
            />
          </el-form-item>
        </el-form>
      </div>
    </AppDrawer>

    <AppDrawer
      v-model="recordsDrawerVisible"
      :title="`余额流水 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="集中查看充值和消费记录，充值记录直接显示完整礼品卡代码。"
      eyebrow="余额流水"
      size="760px"
      confirm-text="刷新流水"
      @confirm="loadBalanceRecords"
    >
      <AppleAccountDrawerSummary
        v-if="selectedAccount"
        label="流水账号"
        :apple-id="selectedAccount.appleIdMasked"
        :region-currency="
          formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
        "
        :balance="selectedAccount.currentBalance"
        :average-cost="getAccountAverageCost(selectedAccount)"
        :status-label="getStatusLabel(selectedAccount.status)"
        :status-tone="getStatusTone(selectedAccount.status)"
        :locked="selectedAccount.isManuallyLocked"
        :source-channel="selectedAccount.sourceChannel?.name"
      />

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
              <el-table-column label="本次均价" width="100">
                <template #default="{ row }">{{ getTopupAverageCost(row) }}</template>
              </el-table-column>
              <el-table-column label="人民币总成本" width="120">
                <template #default="{ row }">{{ getTopupTotalCostAmountFromRecord(row) }}</template>
              </el-table-column>
              <el-table-column label="充值后均价" width="120">
                <template #default="{ row }">{{ formatAverageCost(row.avgCostAfter) }}</template>
              </el-table-column>
              <el-table-column label="礼品卡代码" min-width="240">
                <template #default="{ row }">
                  <span v-if="row.hasGiftCardCode" class="gift-card-code-text">
                    {{ row.giftCardCode ?? '-' }}
                  </span>
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
                  <StatusChip v-if="topup.hasGiftCardCode" tone="purple">有代码</StatusChip>
                  <StatusChip v-else tone="neutral">无代码</StatusChip>
                </div>
                <div class="mobile-record-card__stats">
                  <div>
                    <span>本次均价</span>
                    <strong>{{ getTopupAverageCost(topup) }}</strong>
                  </div>
                  <div>
                    <span>总成本</span>
                    <strong>{{ getTopupTotalCostAmountFromRecord(topup) }}</strong>
                  </div>
                  <div>
                    <span>充值后均价</span>
                    <strong>{{ formatAverageCost(topup.avgCostAfter) }}</strong>
                  </div>
                </div>
                <div v-if="topup.hasGiftCardCode" class="mobile-record-card__meta">
                  <div>
                    <span>礼品卡代码</span>
                    <strong class="gift-card-code-text">{{ topup.giftCardCode ?? '-' }}</strong>
                  </div>
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
              <el-table-column label="消费均价" width="110">
                <template #default="{ row }">{{ formatAverageCost(row.avgUnitCost) }}</template>
              </el-table-column>
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
                    <strong>{{ formatAverageCost(consumption.avgUnitCost) }}</strong>
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
      :title="`敏感资料 · ${selectedAccount?.appleIdMasked ?? ''}`"
      description="完整资料只在必要核对时查看，查看会写入审计日志。"
      eyebrow="敏感资料"
      size="560px"
      confirm-text="查看完整资料"
      confirm-variant="danger"
      :confirm-loading="revealingAccountSecret"
      @closed="resetAccountSecretDialog"
      @confirm="revealAccountSecret"
    >
      <AppleAccountDrawerSummary
        v-if="selectedAccount"
        label="查看账号"
        :apple-id="selectedAccount.appleIdMasked"
        :region-currency="
          formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)
        "
        :balance="selectedAccount.currentBalance"
        :average-cost="getAccountAverageCost(selectedAccount)"
        :status-label="getStatusLabel(selectedAccount.status)"
        :status-tone="getStatusTone(selectedAccount.status)"
        :locked="selectedAccount.isManuallyLocked"
        :source-channel="selectedAccount.sourceChannel?.name"
      />
      <div class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">审计</StatusChip>
        <div>
          <strong>敏感字段查看会写入审计日志</strong>
          <p>完整资料只用于必要的业务核对，不会出现在列表、导出和操作日志明文中。</p>
        </div>
      </div>
      <div class="drawer-section drawer-section--flush">
        <div class="drawer-section__title">查看字段</div>
        <el-form
          ref="accountSecretFormRef"
          class="account-drawer-form sensitive-form"
          :model="accountSecretForm"
          :rules="accountSecretRules"
          label-position="top"
        >
          <el-form-item prop="field">
            <template #label>
              <FieldHelpLabel
                label="字段"
                purpose="选择要查看哪一项敏感资料，每次查看都会单独写审计日志。"
                example="只需要登录就选密码；需要安全验证再选密保或手机号。"
              />
            </template>
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
          <el-form-item prop="reason">
            <template #label>
              <FieldHelpLabel
                label="查看原因"
                purpose="说明为什么要查看完整敏感资料，系统会写入审计日志。"
                example="可以填售后登录核对、客户资料变更、安全验证。"
              />
            </template>
            <el-input
              v-model.trim="accountSecretForm.reason"
              type="textarea"
              :rows="3"
              placeholder="例如 售后登录核对 / 客户资料变更 / 安全验证"
            />
          </el-form-item>
          <el-form-item v-if="accountSecretForm.value">
            <template #label>
              <FieldHelpLabel
                :label="accountSecretFieldLabel"
                purpose="展示解密后的敏感内容，仅供本次必要业务处理使用。"
                example="复制或查看后按实际业务处理，不要粘贴到公开备注或日志里。"
              />
            </template>
            <el-input v-model="accountSecretForm.value" type="textarea" :rows="3" readonly />
          </el-form-item>
        </el-form>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleAccountsApi, dataCenterApi, appleAccountSourceChannelsApi } from '@/api/system';
import type { DataDictionaryQuery } from '@/api/system';
import AppleAccountDrawerSummary from '@/components/business/AppleAccountDrawerSummary.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { APPLE_ACCOUNT_REGION_DICTIONARY_GROUP } from '@/config/quickSettings';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleAccount,
  AppleAccountImportResult,
  AppleAccountOwnershipReport,
  AppleAccountOwnershipType,
  AppleAccountSecretField,
  AppleBalanceConsumption,
  AppleBalanceTopup,
  DataDictionary,
  AppleAccountSourceChannel
} from '@/types/system';
import {
  buildAppleAccountCurrencyOptions,
  formatCurrencyLabel,
  formatAppleAccountRegionOptionLabel,
  formatRegionCurrency,
  getAppleAccountRegionOption,
  getCurrencyForRegion,
  mergeAppleAccountRegionOptions
} from '@/utils/appleAccountRegion';
import {
  createSmartQueryKey,
  invalidateSmartQueries,
  refreshSmartQueryResource
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
const accountStatusOptions = statusOptions.map((item) => ({
  label: item.label,
  value: item.value
}));
const lockedOptions = [
  { label: '已锁定', value: 'true' },
  { label: '未锁定', value: 'false' }
];
const ownershipOptions: Array<{ label: string; value: AppleAccountOwnershipType }> = [
  { label: '寄存', value: 'consigned' },
  { label: '售出', value: 'sold' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const savingBalanceRecord = ref(false);
const savingStatusCheck = ref(false);
const revealingAccountSecret = ref(false);
const dialogVisible = ref(false);
const importDialogVisible = ref(false);
const topupDialogVisible = ref(false);
const consumptionDialogVisible = ref(false);
const statusCheckDialogVisible = ref(false);
const detailDrawerVisible = ref(false);
const recordsDrawerVisible = ref(false);
const accountSecretDialogVisible = ref(false);
const recordsLoading = ref(false);
const editingAccount = ref<AppleAccount | null>(null);
const selectedAccount = ref<AppleAccount | null>(null);
const formRef = ref<FormInstance>();
const importFormRef = ref<FormInstance>();
const topupFormRef = ref<FormInstance>();
const consumptionFormRef = ref<FormInstance>();
const statusCheckFormRef = ref<FormInstance>();
const accountSecretFormRef = ref<FormInstance>();
const accounts = ref<AppleAccount[]>([]);
const sourceChannels = ref<AppleAccountSourceChannel[]>([]);
const appleRegionDictionaries = ref<DataDictionary[]>([]);
const topups = ref<AppleBalanceTopup[]>([]);
const consumptions = ref<AppleBalanceConsumption[]>([]);
const importResult = ref<AppleAccountImportResult | null>(null);
const ownershipReport = ref<AppleAccountOwnershipReport | null>(null);
const selectedAccounts = ref<AppleAccount[]>([]);
const total = ref(0);
const activeAccountsQueryKey = ref('');
const activatedOnce = ref(false);
const authStore = useAuthStore();
const router = useRouter();

type AppleAccountPage = Awaited<ReturnType<typeof appleAccountsApi.list>>;
type AppleAccountListParams = Parameters<typeof appleAccountsApi.list>[0];
type AccountMoreCommand =
  | 'secret'
  | 'status-check'
  | 'topup'
  | 'consumption'
  | 'records'
  | 'delete';
type SensitiveBadgeTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
type SensitiveBadge = {
  label: string;
  tone: SensitiveBadgeTone;
};

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  region: '',
  currency: '',
  ownershipType: '' as AppleAccountOwnershipType | '',
  sourceChannelId: '',
  locked: '',
  sortBy: '',
  sortOrder: '' as '' | 'asc' | 'desc'
});

const form = reactive({
  appleId: '',
  region: 'US',
  currency: 'USD',
  currentBalance: '0',
  balanceCostAmount: '0',
  ownershipType: 'consigned' as AppleAccountOwnershipType,
  purchaseCost: '0',
  salePrice: '0',
  sourceChannelId: '',
  status: 'normal' as AppleAccount['status'],
  isManuallyLocked: false,
  manualLockReason: '',
  password: '',
  securityInfo: '',
  phoneDialCode: '+86',
  phone: '',
  recoveryEmail: '',
  remark: ''
});

const importForm = reactive({
  sourceChannelId: '',
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
  balanceCostAmount: [{ required: true, message: '请输入平均成本', trigger: 'blur' }],
  ownershipType: [{ required: true, message: '请选择 ID 类型', trigger: 'change' }]
};

const importRules: FormRules<typeof importForm> = {
  accountsText: [{ required: true, message: '请输入导入内容', trigger: 'blur' }]
};

const topupRules: FormRules<typeof topupForm> = {
  faceValue: [{ required: true, message: '请输入充值面值', trigger: 'blur' }],
  costAmount: [{ required: true, message: '请输入本次平均成本', trigger: 'blur' }]
};

const consumptionRules: FormRules<typeof consumptionForm> = {
  amount: [{ required: true, message: '请输入消费金额', trigger: 'blur' }]
};

const statusCheckRules: FormRules<typeof statusCheckForm> = {
  resultStatus: [{ required: true, message: '请选择检测结果', trigger: 'change' }]
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
const averageCostSummary = computed(() =>
  formatAverageCost(divideDecimalInputs(totalCost.value, totalBalance.value))
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
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const lockedLabel = lockedOptions.find((item) => item.value === query.locked)?.label;
  const ownershipLabel = ownershipOptions.find((item) => item.value === query.ownershipType)?.label;

  if (query.region) {
    chips.push({ key: 'region', label: '地区', value: query.region });
  }

  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }

  if (query.ownershipType && ownershipLabel) {
    chips.push({ key: 'ownershipType', label: 'ID类型', value: ownershipLabel });
  }

  if (query.sourceChannelId) {
    chips.push({
      key: 'sourceChannelId',
      label: '来源渠道',
      value: getAppleAccountSourceChannelName(query.sourceChannelId)
    });
  }

  if (query.locked && lockedLabel) {
    chips.push({ key: 'locked', label: '手动锁定', value: lockedLabel });
  }

  return chips;
});
const accountSecretOptions = computed(() =>
  selectedAccount.value ? getAccountSecretOptions(selectedAccount.value) : []
);
const accountSecretFieldLabel = computed(
  () =>
    accountSecretOptions.value.find((item) => item.value === accountSecretForm.field)?.label ??
    '完整资料'
);
const appleRegionOptions = computed(() =>
  mergeAppleAccountRegionOptions(appleRegionDictionaries.value)
);
const appleCurrencyOptions = computed(() =>
  buildAppleAccountCurrencyOptions(appleRegionOptions.value)
);
const selectedRegionOption = computed(() =>
  getAppleAccountRegionOption(form.region, appleRegionOptions.value)
);
const selectedCurrencyLabel = computed(() =>
  formatCurrencyLabel(form.currency, appleRegionOptions.value)
);

const accountSortFieldMap: Record<string, string> = {
  appleId: 'appleId',
  region: 'region',
  currentBalance: 'currentBalance',
  balanceCostAmount: 'averageCost',
  averageCost: 'averageCost',
  ownershipType: 'ownershipType',
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

function formatAverageCost(value: string | null | undefined) {
  return parseDecimalInput(value).toFixed(2);
}

function formatAccountRegionCurrency(region: string, currency: string) {
  return formatRegionCurrency(region, currency, appleRegionOptions.value);
}

function getOwnershipLabel(value: AppleAccountOwnershipType) {
  return ownershipOptions.find((item) => item.value === value)?.label ?? value;
}

function formatAccountSaleCost(account: Pick<AppleAccount, 'ownershipType' | 'purchaseCost' | 'salePrice'>) {
  if (account.ownershipType !== 'sold') {
    return '-';
  }

  return `成本 ${parseDecimalInput(account.purchaseCost).toFixed(2)} / 售价 ${parseDecimalInput(
    account.salePrice
  ).toFixed(2)}`;
}

function getAccountAverageCost(account: AppleAccount) {
  if (isLikelyLegacyRateCost(account)) {
    return formatAverageCost(account.balanceCostAmount);
  }

  return formatAverageCost(account.averageCost);
}

function getAccountSensitiveBadges(account: AppleAccount): SensitiveBadge[] {
  const badges: SensitiveBadge[] = [];

  if (account.hasPassword) {
    badges.push({ label: '密码', tone: 'purple' });
  }

  if (account.hasSecurityInfo) {
    badges.push({ label: '密保', tone: 'orange' });
  }

  if (account.hasPhone) {
    badges.push({ label: '手机', tone: 'blue' });
  }

  if (account.hasRecoveryEmail) {
    badges.push({ label: '备用邮箱', tone: 'cyan' });
  }

  return badges;
}

function getVisibleSensitiveBadges(account: AppleAccount) {
  return getAccountSensitiveBadges(account).slice(0, 2);
}

function getHiddenSensitiveCount(account: AppleAccount) {
  return Math.max(getAccountSensitiveBadges(account).length - 2, 0);
}

function getAccountSensitiveSummary(account: AppleAccount) {
  const labels = getAccountSensitiveBadges(account).map((badge) => badge.label);

  return labels.length > 0 ? `已保存：${labels.join('、')}` : '未保存敏感资料';
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
  const averageCost = faceValue > 0 ? storedCost / faceValue : 0;
  const currency = selectedAccount.value?.currency ?? '';

  return (
    currency !== 'CNY' && faceValue > 1 && storedCost >= 1 && averageCost > 0 && averageCost < 1
  );
}

function getTopupAverageCost(topup: AppleBalanceTopup) {
  if (isLikelyLegacyTopupRateCost(topup)) {
    return formatAverageCost(topup.costAmount);
  }

  return formatAverageCost(divideDecimalInputs(topup.costAmount, topup.faceValue));
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

function getAppleAccountSourceChannelName(id: string) {
  return sourceChannels.value.find((item) => item.id === id)?.name ?? id;
}

async function loadAccounts(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildAccountListParams();
  const key = createSmartQueryKey('apple-accounts', params);

  activeAccountsQueryKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: () => appleAccountsApi.list(params),
      apply: applyAccountListResult,
      background: options.background,
      isCurrent: () => activeAccountsQueryKey.value === key,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 失败');
    }
  }
}

async function loadOwnershipReport() {
  try {
    ownershipReport.value = await appleAccountsApi.ownershipReport();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 ID 类型报表失败');
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
    ownershipType: query.ownershipType || undefined,
    sourceChannelId: query.sourceChannelId || undefined,
    locked: query.locked || undefined,
    sortBy: query.sortBy || undefined,
    sortOrder: query.sortOrder || undefined
  };
}

function applyAccountListResult(data: AppleAccountPage) {
  accounts.value = data.items;
  total.value = data.total;
  void loadOwnershipReport();
}

async function loadAppleAccountSourceChannels() {
  try {
    const data = await appleAccountSourceChannelsApi.list({
      page: 1,
      pageSize: 200
    });
    sourceChannels.value = data.items.filter((item) => item.status === 'active');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载来源渠道失败');
  }
}

function buildAppleRegionParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 200,
    group: APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
    status: 'active',
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadAppleRegions() {
  try {
    const data = await dataCenterApi.listDictionaries(buildAppleRegionParams());
    appleRegionDictionaries.value = data.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 地区失败');
  }
}

function applyFilters() {
  query.page = 1;
  loadAccounts();
}

function handleRegionFilterChange() {
  query.currency = query.region ? getCurrencyForRegion(query.region, appleRegionOptions.value) : '';
  applyFilters();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.region = '';
  query.currency = '';
  query.ownershipType = '';
  query.sourceChannelId = '';
  query.locked = '';
  query.sortBy = '';
  query.sortOrder = '';
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
  if (key === 'ownershipType') {
    query.ownershipType = '';
  }
  if (key === 'sourceChannelId') {
    query.sourceChannelId = '';
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

function resetForm() {
  form.appleId = '';
  form.region = 'US';
  syncFormCurrency();
  form.currentBalance = '0';
  form.balanceCostAmount = '0';
  form.ownershipType = 'consigned';
  form.purchaseCost = '0';
  form.salePrice = '0';
  form.sourceChannelId = '';
  form.status = 'normal';
  form.isManuallyLocked = false;
  form.manualLockReason = '';
  form.password = '';
  form.securityInfo = '';
  form.phoneDialCode = '+86';
  form.phone = '';
  form.recoveryEmail = '';
  form.remark = '';
}

function syncFormCurrency() {
  form.currency = getCurrencyForRegion(form.region, appleRegionOptions.value);
}

function handleFormRegionChange() {
  syncFormCurrency();
}

function handleAccountMoreCommand(command: unknown, account: AppleAccount) {
  if (typeof command !== 'string') {
    return;
  }

  const accountCommand = command as AccountMoreCommand;

  if (accountCommand === 'secret') {
    openAccountSecret(account);
    return;
  }

  if (accountCommand === 'status-check') {
    openStatusCheck(account);
    return;
  }

  if (accountCommand === 'topup') {
    openTopup(account);
    return;
  }

  if (accountCommand === 'consumption') {
    openConsumption(account);
    return;
  }

  if (accountCommand === 'records') {
    void openRecords(account);
    return;
  }

  if (accountCommand === 'delete') {
    void removeAccount(account);
  }
}

function openCreate() {
  editingAccount.value = null;
  resetForm();
  closeAccountActionSurfaces();
  dialogVisible.value = true;
}

function openImport() {
  importForm.sourceChannelId = '';
  importForm.accountsText = '';
  importResult.value = null;
  importDialogVisible.value = true;
}

function openEdit(account: AppleAccount) {
  selectedAccount.value = account;
  editingAccount.value = account;
  form.appleId = '';
  form.region = getAppleAccountRegionOption(account.region, appleRegionOptions.value)?.code ?? 'US';
  syncFormCurrency();
  form.currentBalance = account.currentBalance;
  form.balanceCostAmount = getAccountAverageCost(account);
  form.ownershipType = account.ownershipType;
  form.purchaseCost = account.purchaseCost;
  form.salePrice = account.salePrice;
  form.sourceChannelId = account.sourceChannelId ?? '';
  form.status = account.status;
  form.isManuallyLocked = account.isManuallyLocked;
  form.manualLockReason = account.manualLockReason ?? '';
  form.password = '';
  form.securityInfo = '';
  form.phoneDialCode = '+86';
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

function closeAccountActionSurfaces() {
  detailDrawerVisible.value = false;
  dialogVisible.value = false;
  topupDialogVisible.value = false;
  consumptionDialogVisible.value = false;
  statusCheckDialogVisible.value = false;
  recordsDrawerVisible.value = false;
  accountSecretDialogVisible.value = false;
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
  closeAccountActionSurfaces();
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

  const phoneToSave = buildPhoneToSave();

  saving.value = true;
  try {
    const payload = {
      region: form.region,
      currency: form.currency,
      currentBalance: form.currentBalance,
      balanceCostAmount: getAccountFormTotalCostAmount(),
      ownershipType: form.ownershipType,
      purchaseCost: form.purchaseCost || '0',
      salePrice: form.salePrice || '0',
      sourceChannelId: form.sourceChannelId || null,
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

function buildPhoneToSave() {
  const rawPhone = form.phone.trim();
  if (!rawPhone) {
    return undefined;
  }

  const compactPhone = rawPhone.replace(/[()\s.-]/g, '');
  if (compactPhone.startsWith('+')) {
    return compactPhone;
  }
  if (compactPhone.startsWith('00')) {
    return `+${compactPhone.slice(2)}`;
  }

  const dialCode = normalizeDialCode(form.phoneDialCode);
  return `${dialCode}${compactPhone.replace(/^\+/, '')}`;
}

function normalizeDialCode(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return '+86';
  }
  return normalized.startsWith('+') ? normalized : `+${normalized.replace(/^00/, '')}`;
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
    const result = await appleAccountsApi.importAccounts({
      accounts,
      sourceChannelId: importForm.sourceChannelId || null
    });
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

async function removeAccount(account: AppleAccount) {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${account.appleIdMasked} 吗？删除后该 ID 不会再出现在账号列表，也不会被自动匹配订单。`,
      '删除 Apple ID',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    );
  } catch {
    return;
  }

  try {
    await appleAccountsApi.remove(account.id);
    ElMessage.success('Apple ID 已删除');
    closeAccountActionSurfaces();
    selectedAccounts.value = selectedAccounts.value.filter((item) => item.id !== account.id);
    invalidateSmartQueries('apple-accounts');
    await loadAccounts();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除 Apple ID 失败');
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
  const sourceChannelsPromise = loadAppleAccountSourceChannels();
  const appleRegionsPromise = loadAppleRegions();
  const accountsPromise = loadAccounts({ force: false });

  await sourceChannelsPromise;
  await appleRegionsPromise;
  await accountsPromise;
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

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['apple-accounts', 'data-dictionaries'],
  () => {
    void loadAccounts({
      background: accounts.value.length > 0,
      force: true
    });
    void loadAppleRegions();
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.apple-account-sensitive-cell {
  display: flex;
  min-width: 0;
  align-items: center;
}

.apple-account-sensitive-tags {
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
}

.apple-account-sensitive-tags .status-chip {
  flex: 0 0 auto;
}
</style>
