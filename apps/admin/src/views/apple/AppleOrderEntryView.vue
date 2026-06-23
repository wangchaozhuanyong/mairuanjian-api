<template>
  <PageScaffold
    title="Apple ID 订单录入"
    group="Apple ID 业务"
    phase="Phase 4"
    description="录入客户订单，按业务规则自动匹配 Apple ID，提交后自动生成开通记录、扣减余额并计算利润。"
  >
    <template #actions>
      <AppButton @click="() => loadInitialData({ force: true, dedupeMs: 0 })">
        刷新基础数据
      </AppButton>
      <AppButton variant="primary" :loading="saving" @click="submitOrder">提交订单</AppButton>
    </template>

    <AppCard
      title="订单信息"
      subtitle="先录入客户、业务和金额，再从自动匹配结果里选择 Apple ID。"
      :tag="selectedAccount ? '已选择 Apple ID' : '等待匹配'"
      :tag-tone="selectedAccount ? 'green' : 'orange'"
    >
      <el-alert
        v-if="customerNoticeVisible"
        class="order-entry-form-alert"
        title="请选择已有客户，或手动输入新客户资料后再提交订单。"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-form
        ref="formRef"
        class="v3-entry-form"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <div class="order-entry-layout">
          <section class="order-entry-pane order-entry-pane--manual">
            <div class="order-entry-pane__header">
              <div>
                <span>需要填写</span>
                <strong>录入信息</strong>
              </div>
              <StatusChip tone="blue">左侧填写</StatusChip>
            </div>

            <div class="order-entry-section">
              <span class="order-entry-section__title">客户与来源</span>
              <div class="order-entry-field-grid">
                <el-form-item class="order-entry-field--wide" required>
                  <template #label>
                    <FieldHelpLabel
                      label="客户"
                      purpose="这笔订单属于哪个客户，后面查续费、利润、售后都会关联到他。"
                      example="老客户可以搜客户名、微信或手机号尾号；找不到就点手动输入。"
                    />
                  </template>
                  <div class="order-entry-customer-picker">
                    <el-select
                      v-model="form.customerId"
                      class="full-input"
                      clearable
                      filterable
                      remote
                      reserve-keyword
                      :disabled="Boolean(newCustomerDraft)"
                      :loading="customerSearching"
                      :remote-method="searchCustomers"
                      placeholder="搜索客户名称、微信、手机号尾号"
                      @change="handleCustomerChange"
                      @visible-change="handleCustomerSelectVisibleChange"
                    >
                      <el-option
                        v-for="customer in customers"
                        :key="customer.id"
                        :label="getCustomerOptionLabel(customer)"
                        :value="customer.id"
                      >
                        <div class="order-entry-customer-option">
                          <strong>{{ customer.name }}</strong>
                          <span>{{ getCustomerMeta(customer) }}</span>
                        </div>
                      </el-option>
                      <template #empty>
                        <div class="order-entry-select-empty">
                          <span>{{
                            customerSearching ? '正在搜索客户...' : '未找到客户，可手动输入资料。'
                          }}</span>
                          <AppButton
                            size="small"
                            variant="soft"
                            @click.stop="openNewCustomerDialog"
                          >
                            手动输入
                          </AppButton>
                        </div>
                      </template>
                    </el-select>
                    <AppButton
                      class="order-entry-customer-picker__create"
                      size="small"
                      variant="soft"
                      @click="openNewCustomerDialog"
                    >
                      手动输入
                    </AppButton>
                  </div>
                  <div v-if="newCustomerDraft" class="order-entry-customer-draft">
                    <StatusChip tone="blue">待新增</StatusChip>
                    <span>{{ newCustomerDraftSummary }}</span>
                    <AppButton size="small" variant="ghost" @click="clearNewCustomerDraft">
                      移除
                    </AppButton>
                  </div>
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <FieldHelpLabel
                      label="来源平台"
                      purpose="记录订单从哪里来，并按平台设置自动计算手续费。"
                      example="微信来的订单选微信，官网来的订单选官网，私下收款可以留空或选对应自建平台。"
                    />
                  </template>
                  <el-select
                    v-model="form.sourcePlatformId"
                    class="full-input"
                    clearable
                    filterable
                    @change="handleSourcePlatformChange"
                  >
                    <el-option
                      v-for="platform in sourcePlatforms"
                      :key="platform.id"
                      :label="platform.name"
                      :value="platform.id"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <FieldHelpLabel
                      label="平台订单号"
                      purpose="保存外部平台的订单编号，方便以后对账、查售后和回看聊天记录。"
                      example="官网订单填官网单号，微信订单填转账备注；没有平台单号可以先留空。"
                    />
                  </template>
                  <el-input v-model.trim="form.externalOrderNo" />
                </el-form-item>
              </div>
            </div>

            <div class="order-entry-section">
              <span class="order-entry-section__title">业务选择</span>
              <div class="order-entry-field-grid">
                <el-form-item prop="serviceRegion">
                  <template #label>
                    <FieldHelpLabel
                      label="国家"
                      purpose="先确定 Apple ID 地区，后面的分类和业务只展示这个国家可开的项目。"
                      example="美区业务先选 US，美国区账号才会进入匹配。"
                    />
                  </template>
                  <el-select
                    v-model="form.serviceRegion"
                    class="full-input"
                    clearable
                    filterable
                    placeholder="请选择国家 / 地区"
                    @change="handleServiceRegionChange"
                  >
                    <el-option
                      v-for="item in serviceRegionOptions"
                      :key="item.code"
                      :label="item.label"
                      :value="item.code"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item prop="serviceCategory">
                  <template #label>
                    <FieldHelpLabel
                      label="分类"
                      purpose="按业务分类缩小范围，避免订单录入时在一长串业务里找。"
                      example="先选 AI 订阅，再选具体的 Plus 月费或年费。"
                    />
                  </template>
                  <el-select
                    v-model="form.serviceCategory"
                    class="full-input"
                    clearable
                    filterable
                    placeholder="请选择分类"
                    :disabled="!form.serviceRegion"
                    @change="handleServiceCategoryChange"
                  >
                    <el-option
                      v-for="category in serviceCategoryOptions"
                      :key="category"
                      :label="category"
                      :value="category"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item class="order-entry-field--wide" prop="serviceId">
                  <template #label>
                    <FieldHelpLabel
                      label="开通业务"
                      purpose="选择客户这次要开的具体服务，系统会按业务配置带出售价、周期和 Apple 消耗金额。"
                      example="客户买 gpt pro 1 个月，就选对应的 gpt pro 月费业务。"
                    />
                  </template>
                  <el-select
                    v-model="form.serviceId"
                    class="full-input"
                    filterable
                    :loading="loading"
                    :disabled="!form.serviceRegion || !form.serviceCategory"
                    placeholder="请选择业务"
                    @change="handleServiceChange"
                  >
                    <el-option
                      v-for="service in filteredServices"
                      :key="service.id"
                      :label="`${service.name} · ${service.officialCostValue} ${service.currency}`"
                      :value="service.id"
                    />
                    <template #empty>
                      <div class="order-entry-select-empty">
                        <span>
                          {{
                            loading
                              ? '正在加载业务...'
                              : '没有可选业务，请确认 ID 业务设置里已启用后再刷新。'
                          }}
                        </span>
                        <AppButton
                          v-if="!loading"
                          size="small"
                          variant="soft"
                          @click.stop="loadInitialData({ force: true, dedupeMs: 0 })"
                        >
                          刷新业务
                        </AppButton>
                      </div>
                    </template>
                  </el-select>
                </el-form-item>
              </div>
            </div>

            <div class="order-entry-section">
              <span class="order-entry-section__title">账号与收款</span>
              <div class="order-entry-field-grid">
                <el-form-item class="order-entry-field--wide">
                  <template #label>
                    <FieldHelpLabel
                      label="客户网站账号"
                      purpose="记录客户在目标网站或 App 里的账号，方便开通、续费和售后定位。"
                      example="ChatGPT 业务可以填客户登录邮箱；如果业务不需要客户账号可留空。"
                    />
                  </template>
                  <el-input v-model.trim="form.serviceAccount" @blur="loadOrderEntryContext" />
                </el-form-item>

                <el-form-item class="order-entry-field--wide" prop="paidAmount">
                  <template #label>
                    <FieldHelpLabel
                      label="客户实收"
                      purpose="客户这单实际付给你的金额，是计算订单利润的收入部分。"
                      example="客户转了 20 元就填 20；如果收的是美元、马币或 USDT，就选择对应币种并填写汇率。"
                    />
                  </template>
                  <div class="order-entry-money-input">
                    <el-input
                      v-model.trim="form.paidAmount"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      placeholder="0.00"
                      @change="syncDerivedOrderAmounts"
                    />
                    <el-select
                      v-model="form.paidCurrency"
                      class="order-entry-money-input__currency"
                      @change="handlePaidCurrencyChange"
                    >
                      <el-option
                        v-for="option in paidCurrencyOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value"
                      />
                    </el-select>
                  </div>
                  <div class="order-entry-money-meta">
                    <div class="order-entry-money-hint">
                      {{ paidAmountRmbHint }}
                    </div>
                    <div class="order-entry-margin-calculator">
                      <span class="order-entry-margin-calculator__label">毛利率</span>
                      <el-input
                        v-model.trim="form.targetGrossMargin"
                        class="order-entry-margin-calculator__input"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        max="99"
                        placeholder="0"
                      >
                        <template #suffix>
                          <span class="order-entry-margin-calculator__suffix">%</span>
                        </template>
                      </el-input>
                      <AppButton
                        class="order-entry-margin-calculator__action"
                        size="small"
                        variant="soft"
                        @click="fillPaidAmountByMargin"
                      >
                        反算实收
                      </AppButton>
                      <span class="order-entry-margin-calculator__hint">
                        {{ suggestedPaidAmountHint }}
                      </span>
                    </div>
                  </div>
                </el-form-item>

                <el-form-item v-if="form.paidCurrency !== 'CNY'" prop="paidExchangeRateToRmb">
                  <template #label>
                    <FieldHelpLabel
                      label="折算人民币汇率"
                      purpose="把客户实收币种折成人民币，利润统一按人民币计算。"
                      example="收 20 USD，1 USD = 7.20 元，就填 7.20。"
                    />
                  </template>
                  <el-input
                    v-model.trim="form.paidExchangeRateToRmb"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    placeholder="例如 7.20"
                    @change="syncDerivedOrderAmounts"
                  />
                </el-form-item>
              </div>
            </div>

            <div class="order-entry-section">
              <span class="order-entry-section__title">成本补充</span>
              <div class="order-entry-field-grid">
                <el-form-item>
                  <template #label>
                    <FieldHelpLabel
                      label="退款/补发损耗"
                      purpose="记录这单额外亏掉的钱，比如补发、退款差额或人工承担的损失。"
                      example="没有损耗填 0；给客户补了 3 元成本就填 3。"
                    />
                  </template>
                  <el-input
                    v-model.trim="form.refundLoss"
                    type="number"
                    inputmode="decimal"
                    min="0"
                  />
                  <div class="order-entry-money-hint">
                    折合人民币 {{ formatMoney(refundLossRmbValue) }}
                  </div>
                </el-form-item>

                <el-form-item prop="appleAccountOwnershipType">
                  <template #label>
                    <FieldHelpLabel
                      label="ID 处理方式"
                      purpose="寄存只扣 Apple 余额成本；售出会把 Apple ID 本身成本一起计入订单利润。"
                      example="ID 留在你这边继续用选寄存；ID 卖给客户以后不再复用选售出。"
                    />
                  </template>
                  <el-select
                    v-model="form.appleAccountOwnershipType"
                    class="full-input"
                    @change="handleAppleAccountOwnershipTypeChange"
                  >
                    <el-option label="寄存" value="consigned" />
                    <el-option label="售出" value="sold" />
                  </el-select>
                </el-form-item>

                <el-form-item class="order-entry-field--wide">
                  <template #label>
                    <FieldHelpLabel
                      label="备注"
                      purpose="写给自己或同事看的补充说明，不参与金额计算。"
                      example="可以写客户特殊要求、聊天重点、人工处理原因。"
                    />
                  </template>
                  <el-input v-model="form.remark" type="textarea" :rows="3" />
                </el-form-item>
              </div>
            </div>
          </section>

          <aside class="order-entry-pane order-entry-pane--system">
            <div class="order-entry-pane__header">
              <div>
                <span>不需要填写</span>
                <strong>系统信息</strong>
              </div>
              <StatusChip tone="green">自动带出</StatusChip>
            </div>

            <div class="order-entry-system-stack">
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="当前套餐"
                    purpose="记录客户开通前或当前正在用的套餐，方便判断是新开、续费还是升级。"
                    example="客户现在是 Free 就填 Free；已经是 Plus 月费就填 Plus 月费。"
                  />
                </template>
                <el-input v-model.trim="form.currentPlan" />
                <div v-if="orderContextLoading || orderContext" class="order-entry-history-card">
                  <StatusChip :tone="orderContext ? 'blue' : 'neutral'">
                    {{ orderContext ? '上次记录' : '查询中' }}
                  </StatusChip>
                  <span v-if="orderContext">
                    {{ getOrderContextSummary() }}
                  </span>
                  <span v-else>正在读取客户上次套餐和收费记录...</span>
                </div>
              </el-form-item>

              <div class="order-entry-side-grid">
                <el-form-item>
                  <template #label>
                    <FieldHelpLabel
                      label="开通时间"
                      purpose="记录服务从什么时候开始算，用来生成开通记录和续费提醒。"
                      example="现在马上开通就用默认当前时间；补录旧订单就改成实际开通时间。"
                    />
                  </template>
                  <el-date-picker
                    v-model="form.startTime"
                    class="full-input"
                    type="datetime"
                    value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                    @change="syncExpireTimeFromService"
                  />
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <FieldHelpLabel
                      label="到期时间"
                      purpose="记录服务什么时候结束，后续续费任务和到期提醒会看这个时间。"
                      example="系统按含开通当天计算：5 月 8 日开通 1 个月，默认填 6 月 7 日。特殊订单可以手动改。"
                    />
                  </template>
                  <el-date-picker
                    v-model="form.expireTime"
                    class="full-input"
                    type="datetime"
                    value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
                    placeholder="按业务周期自动计算"
                  />
                </el-form-item>
              </div>

              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="平台手续费"
                    purpose="平台从这单里扣掉的钱，系统按来源平台的费率和固定费用自动算。"
                    example="某渠道设置了 1% 手续费，客户实收 20，系统会自动带出约 0.20。"
                  />
                </template>
                <el-input
                  v-model.trim="form.platformFee"
                  disabled
                  placeholder="按来源平台自动计算"
                />
                <div class="order-entry-money-hint">
                  折合人民币 {{ formatMoney(platformFeeRmbValue) }}
                </div>
              </el-form-item>

              <el-form-item prop="appleCostValue">
                <template #label>
                  <FieldHelpLabel
                    label="Apple 消耗金额"
                    purpose="这单预计会扣多少 Apple ID 外币余额，后端会用它乘以当前平均成本算成本。"
                    example="业务官方消耗是 20 USD，这里自动带出 20。"
                  />
                </template>
                <el-input
                  v-model.trim="form.appleCostValue"
                  disabled
                  placeholder="按业务官方消耗自动带出"
                />
              </el-form-item>

              <el-form-item prop="appleAccountId">
                <template #label>
                  <FieldHelpLabel
                    label="已选 Apple ID"
                    purpose="这单最终使用哪个 Apple ID 扣余额和生成开通记录。"
                    example="自动匹配出可用账号后点选择，这里会显示已选账号和余额。"
                  />
                </template>
                <el-input :model-value="selectedAccountLabel" disabled />
                <div
                  v-if="selectedAccount && form.appleAccountOwnershipType === 'sold'"
                  class="order-entry-money-hint"
                >
                  ID 成本 {{ formatMoney(selectedAccountPurchaseCost) }}，参考售价
                  {{ formatMoney(selectedAccountSalePrice) }}
                </div>
              </el-form-item>
            </div>
          </aside>
        </div>

        <div class="v3-entry-form__actions">
          <AppButton :disabled="saving" @click="resetOrderForm">重置录入</AppButton>
          <AppButton variant="primary" :loading="saving" @click="submitOrder"> 提交订单 </AppButton>
        </div>
      </el-form>
    </AppCard>

    <div class="order-entry-board-grid">
      <AppCard
        title="Apple ID 自动匹配"
        subtitle="可用账号会按余额优先展示；不可用账号给出原因。"
        :tag="availableMatchCount ? `可用 ${availableMatchCount}` : '待匹配'"
        :tag-tone="availableMatchCount ? 'green' : 'blue'"
      >
        <div
          class="order-selected-account"
          :class="selectedAccount ? 'order-selected-account--selected' : ''"
        >
          <StatusChip :tone="selectedAccount ? 'green' : 'blue'" dot>
            {{ selectedAccount ? '已选择' : '待选择' }}
          </StatusChip>
          <div>
            <strong>{{
              selectedAccount ? selectedAccount.accountMasked : '尚未选择 Apple ID'
            }}</strong>
            <p>
              {{
                selectedAccount
                  ? `${formatAccountRegionCurrency(selectedAccount.region, selectedAccount.currency)} · 余额 ${selectedAccount.balance}`
                  : '选择业务后会自动匹配可用 Apple ID，也可以手动重新匹配。'
              }}
            </p>
          </div>
        </div>

        <div class="toolbar">
          <el-input
            v-model="matchKeyword"
            class="toolbar-search"
            placeholder="搜索 Apple ID、地区、币种、备注"
            clearable
            @keyup.enter="loadAvailableAccounts({ autoSelect: true })"
          />
          <AppButton @click="() => loadAvailableAccounts({ autoSelect: true })">重新匹配</AppButton>
        </div>

        <el-table
          v-loading="matchingLoading"
          class="desktop-data-table"
          :data="availableAccounts"
          row-key="appleAccountId"
          size="small"
        >
          <template #empty>
            <div class="apple-core-empty-state">
              <strong>暂无匹配结果</strong>
              <span>请先选择业务，系统会按官方消耗金额自动匹配。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="loadAvailableAccounts({ autoSelect: true })">
                  重新匹配
                </AppButton>
              </div>
            </div>
          </template>
          <el-table-column label="Apple ID" min-width="160">
            <template #default="{ row }">{{ row.accountMasked }}</template>
          </el-table-column>
          <el-table-column label="地区/币种" width="110">
            <template #default="{ row }">{{
              formatAccountRegionCurrency(row.region, row.currency)
            }}</template>
          </el-table-column>
          <el-table-column prop="balance" label="余额" width="90" />
          <el-table-column label="均价" width="100">
            <template #default="{ row }">{{ formatAverageCost(row.avgUnitCost) }}</template>
          </el-table-column>
          <el-table-column label="ID类型" width="100">
            <template #default="{ row }">
              <StatusChip :tone="row.ownershipType === 'sold' ? 'orange' : 'blue'">
                {{ getOwnershipLabel(row.ownershipType) }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="ID成本" width="110">
            <template #default="{ row }">
              {{ row.ownershipType === 'sold' ? formatMoney(readAmount(row.purchaseCost)) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="150">
            <template #default="{ row }">
              <StatusChip :tone="getAvailabilityTone(row.availability)" dot>
                {{ getAvailabilityLabel(row.availability) }}
              </StatusChip>
              <span class="muted-inline">{{ row.reason ?? '' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <div class="table-action-group table-action-group--wrap">
                <AppButton
                  size="small"
                  variant="ghost"
                  :disabled="row.availability !== 'available'"
                  @click="selectAccount(row)"
                >
                  选择
                </AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div
          v-if="availableAccounts.length"
          class="mobile-record-list"
          aria-label="Apple ID 自动匹配移动列表"
        >
          <article
            v-for="account in availableAccounts"
            :key="account.appleAccountId"
            class="mobile-record-card"
          >
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ account.accountMasked }}</strong>
                <span>{{ formatAccountRegionCurrency(account.region, account.currency) }}</span>
              </div>
              <StatusChip :tone="getAvailabilityTone(account.availability)" dot>
                {{ getAvailabilityLabel(account.availability) }}
              </StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>余额</span>
                <strong>{{ account.balance }}</strong>
              </div>
              <div>
                <span>均价</span>
                <strong>{{ formatAverageCost(account.avgUnitCost) }}</strong>
              </div>
              <div>
                <span>ID类型</span>
                <strong>{{ getOwnershipLabel(account.ownershipType) }}</strong>
              </div>
              <div>
                <span>状态原因</span>
                <strong>{{ account.reason || '-' }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__actions">
              <AppButton
                size="small"
                variant="ghost"
                :disabled="account.availability !== 'available'"
                @click="selectAccount(account)"
              >
                选择
              </AppButton>
            </div>
          </article>
        </div>
        <div
          v-else-if="!matchingLoading"
          class="mobile-record-list"
          aria-label="Apple ID 自动匹配空状态"
        >
          <div class="apple-core-empty-state">
            <strong>暂无匹配结果</strong>
            <span>请先选择业务，系统会按官方消耗金额自动匹配。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="loadAvailableAccounts({ autoSelect: true })">
                重新匹配
              </AppButton>
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard
        title="订单成本预估"
        subtitle="提交前核对实收、余额成本、手续费和损耗。"
        :tag="selectedAccount ? '已选账号' : '待匹配'"
        :tag-tone="selectedAccount ? 'green' : 'orange'"
      >
        <div class="order-cost-panel">
          <div v-for="item in orderCostBars" :key="item.label" class="order-cost-row">
            <span>{{ item.label }}</span>
            <div class="order-cost-track">
              <span
                :class="`order-cost-track__bar order-cost-track__bar--${item.tone}`"
                :style="{ width: `${item.percent}%` }"
              />
            </div>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="apple-core-alert-stack">
          <div class="apple-core-alert apple-core-alert--blue">
            <StatusChip tone="blue">余额</StatusChip>
            <div>
              <strong>预计 Apple 余额成本 {{ estimatedAppleCostRmb }}</strong>
              <p>按已选 Apple ID 当前平均成本估算，实际以订单提交后的后端计算为准。</p>
            </div>
          </div>
          <div class="apple-core-alert apple-core-alert--green">
            <StatusChip tone="green">利润</StatusChip>
            <div>
              <strong>预计利润 {{ estimatedProfit }}，毛利率 {{ estimatedProfitRate }}</strong>
              <p>客户实收减 Apple 余额成本、售出 ID 成本、平台手续费和退款/补发损耗。</p>
            </div>
          </div>
          <div
            class="apple-core-alert"
            :class="
              unavailableMatchCount > 0 ? 'apple-core-alert--orange' : 'apple-core-alert--purple'
            "
          >
            <StatusChip :tone="unavailableMatchCount > 0 ? 'orange' : 'purple'">
              {{ unavailableMatchCount > 0 ? '需确认' : '匹配' }}
            </StatusChip>
            <div>
              <strong>不可用匹配 {{ unavailableMatchCount }}</strong>
              <p>余额不足、锁定、地区或状态不符的账号不会直接进入订单。</p>
            </div>
          </div>
        </div>
      </AppCard>
    </div>

    <el-dialog
      v-model="newCustomerDialogVisible"
      title="新增客户资料"
      width="min(620px, calc(100vw - 24px))"
    >
      <CustomerProfileForm
        ref="newCustomerFormRef"
        :model-value="newCustomerForm"
        :rules="newCustomerRules"
        :source-platforms="sourcePlatforms"
        :tag-options="customerTagOptions"
        @update:model-value="assignCustomerProfileForm(newCustomerForm, $event)"
      />
      <template #footer>
        <AppButton @click="newCustomerDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" @click="saveNewCustomerDraft">加入订单</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { appleMatchingApi, appleOrdersApi, customersApi, dataCenterApi } from '@/api/system';
import type { DataDictionaryQuery, SaveCustomerPayload } from '@/api/system';
import CustomerProfileForm from '@/components/business/CustomerProfileForm.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import {
  APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
  APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
  buildQuickSettingCode,
  CUSTOMER_TAG_DICTIONARY_GROUP
} from '@/config/quickSettings';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { CustomerProfileFormModel } from '@/types/customerProfileForm';
import type {
  AppleAccountOwnershipType,
  AppleOrderEntryContext,
  AppleService,
  AvailableAppleAccount,
  Customer,
  DataDictionary,
  PageResult,
  PaidCurrency,
  SourcePlatform
} from '@/types/system';
import {
  assignCustomerProfileForm,
  buildCustomerProfilePayload,
  createCustomerProfileFormModel,
  resetCustomerProfileForm
} from '@/utils/customerProfileForm';
import {
  formatAppleRegionCurrencyLabel,
  formatAppleRegionLabel,
  formatAppleAccountRegionOptionLabel,
  mergeAppleAccountRegionOptions
} from '@/utils/appleAccountRegion';
import { createSmartQueryKey, refreshSmartQueryResource } from '@/utils/smartQuery';
import {
  loadSmartAppleServices,
  loadSmartCustomers,
  loadSmartSourcePlatforms
} from '@/utils/smartSystemQueries';

const ORDER_ENTRY_BASE_SCOPE = 'order-entry-base';
const ORDER_ENTRY_REALTIME_SCOPES = [
  'customers',
  'source-platforms',
  'data-dictionaries',
  'apple-services',
  ORDER_ENTRY_BASE_SCOPE
];
const loading = ref(false);
const saving = ref(false);
const matchingLoading = ref(false);
const customerSearching = ref(false);
const orderContextLoading = ref(false);
const formRef = ref<FormInstance>();
const newCustomerFormRef = ref<InstanceType<typeof CustomerProfileForm>>();
const customers = ref<Customer[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const customerTagDictionaries = ref<DataDictionary[]>([]);
const appleRegionDictionaries = ref<DataDictionary[]>([]);
const appleServiceCategoryDictionaries = ref<DataDictionary[]>([]);
const services = ref<AppleService[]>([]);
const availableAccounts = ref<AvailableAppleAccount[]>([]);
const selectedAccount = ref<AvailableAppleAccount | null>(null);
const orderContext = ref<AppleOrderEntryContext['latestOrder'] | null>(null);
const newCustomerDialogVisible = ref(false);
const newCustomerDraft = ref<SaveCustomerPayload | null>(null);
const customerNoticeVisible = ref(false);
const matchKeyword = ref('');
const customerSearchKeyword = ref('');
let customerSearchRequestId = 0;
let orderContextRequestId = 0;

const paidCurrencyOptions: Array<{ label: string; value: PaidCurrency }> = [
  { label: '人民币 CNY', value: 'CNY' },
  { label: '马币 MYR', value: 'MYR' },
  { label: '美元 USD', value: 'USD' },
  { label: 'USDT', value: 'USDT' }
];

const form = reactive({
  customerId: '',
  sourcePlatformId: '',
  externalOrderNo: '',
  serviceRegion: '',
  serviceCategory: '',
  serviceId: '',
  appleAccountId: '',
  appleAccountOwnershipType: 'consigned' as AppleAccountOwnershipType,
  serviceAccount: '',
  currentPlan: '',
  targetPlan: '',
  startTime: getCurrentDateTimeValue(),
  expireTime: '',
  paidAmount: '',
  paidCurrency: 'CNY' as PaidCurrency,
  paidExchangeRateToRmb: '1',
  targetGrossMargin: '',
  platformFee: '0.00',
  refundLoss: '0',
  appleCostValue: '',
  remark: ''
});

const newCustomerForm = reactive<CustomerProfileFormModel>(createCustomerProfileFormModel());

const rules: FormRules<typeof form> = {
  serviceRegion: [{ required: true, message: '请选择国家', trigger: 'change' }],
  serviceCategory: [{ required: true, message: '请选择分类', trigger: 'change' }],
  serviceId: [{ required: true, message: '请选择业务', trigger: 'change' }],
  paidAmount: [{ required: true, message: '请输入客户实收', trigger: 'blur' }],
  paidExchangeRateToRmb: [
    {
      validator: (_rule, value, callback) => {
        if (form.paidCurrency === 'CNY') {
          callback();
          return;
        }

        if (!value || readAmount(value) <= 0) {
          callback(new Error('请输入大于 0 的折算汇率'));
          return;
        }

        callback();
      },
      trigger: 'blur'
    }
  ],
  appleCostValue: [{ required: true, message: '请输入 Apple 消耗金额', trigger: 'blur' }],
  appleAccountOwnershipType: [{ required: true, message: '请选择 ID 处理方式', trigger: 'change' }],
  appleAccountId: [{ required: true, message: '请选择可用 Apple ID', trigger: 'change' }]
};

const newCustomerRules: FormRules<CustomerProfileFormModel> = {
  name: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
};

const selectedService = computed(
  () => services.value.find((service) => service.id === form.serviceId) ?? null
);
const selectedSourcePlatform = computed(
  () => sourcePlatforms.value.find((platform) => platform.id === form.sourcePlatformId) ?? null
);
const selectedCustomer = computed(
  () => customers.value.find((customer) => customer.id === form.customerId) ?? null
);
const hasOrderCustomer = computed(() => Boolean(form.customerId || newCustomerDraft.value));
const appleRegionOptions = computed(() =>
  mergeAppleAccountRegionOptions(appleRegionDictionaries.value)
);
const serviceRegionOptions = computed(() => {
  const serviceRegionCodes = new Set(
    services.value.flatMap((service) => service.allowedRegions ?? [])
  );
  const baseOptions = serviceRegionCodes.size
    ? appleRegionOptions.value.filter((item) => serviceRegionCodes.has(item.code))
    : appleRegionOptions.value;
  const missingCodes = [...serviceRegionCodes].filter(
    (code) => !baseOptions.some((item) => item.code === code)
  );

  return [
    ...baseOptions.map((item) => ({
      code: item.code,
      label: formatAppleAccountRegionOptionLabel(item)
    })),
    ...missingCodes.map((code) => ({
      code,
      label: formatAppleRegionLabel(code)
    }))
  ];
});
const regionMatchedServices = computed(() =>
  services.value.filter(
    (service) =>
      !form.serviceRegion ||
      !service.allowedRegions.length ||
      service.allowedRegions.includes(form.serviceRegion)
  )
);
const activeServiceCategoryValues = computed(
  () =>
    new Set(
      appleServiceCategoryDictionaries.value
        .filter((category) => category.status === 'active')
        .map((category) => getServiceCategoryLabel(category.value || category.label))
    )
);
const serviceCategoryOptions = computed(() => [
  ...new Set(
    regionMatchedServices.value
      .map((service) => getServiceCategoryLabel(service.category))
      .filter((category) => activeServiceCategoryValues.value.has(category))
  )
]);
const filteredServices = computed(() =>
  regionMatchedServices.value.filter(
    (service) =>
      activeServiceCategoryValues.value.has(getServiceCategoryLabel(service.category)) &&
      getServiceCategoryLabel(service.category) === form.serviceCategory
  )
);
const selectedServiceRegionLabel = computed(
  () => serviceRegionOptions.value.find((item) => item.code === form.serviceRegion)?.label ?? ''
);
const selectedAccountLabel = computed(() =>
  selectedAccount.value
    ? [
        selectedAccount.value.accountMasked,
        `${selectedAccount.value.balance} ${selectedAccount.value.currency}`,
        getOwnershipLabel(selectedAccount.value.ownershipType)
      ].join(' / ')
    : '未选择'
);
const customerTagOptions = computed(() => [
  ...new Set([
    ...customerTagDictionaries.value
      .filter((tag) => tag.status === 'active')
      .map((tag) => tag.label),
    ...customers.value.flatMap((customer) => customer.tags)
  ])
]);
const newCustomerDraftSummary = computed(() => {
  const customer = newCustomerDraft.value;
  if (!customer) {
    return '';
  }

  return formatCustomerProfileSummary(
    customer.name,
    customer.phone ? '已填手机号' : '',
    customer.wechat
  );
});
const availableMatchCount = computed(
  () => availableAccounts.value.filter((account) => account.availability === 'available').length
);
const unavailableMatchCount = computed(
  () => availableAccounts.value.filter((account) => account.availability !== 'available').length
);
const estimatedAppleCostValue = computed(() => {
  if (!selectedAccount.value || !form.appleCostValue) {
    return null;
  }

  const value = readAmount(form.appleCostValue) * readAmount(selectedAccount.value.avgUnitCost);
  return Number.isFinite(value) ? value : null;
});
const estimatedAppleCostRmb = computed(() => {
  if (estimatedAppleCostValue.value === null) {
    return '-';
  }

  return formatMoney(estimatedAppleCostValue.value);
});
const selectedAccountPurchaseCost = computed(() => {
  if (form.appleAccountOwnershipType !== 'sold' || !selectedAccount.value) {
    return 0;
  }

  return readAmount(selectedAccount.value.purchaseCost);
});
const selectedAccountSalePrice = computed(() => {
  if (form.appleAccountOwnershipType !== 'sold' || !selectedAccount.value) {
    return 0;
  }

  return readAmount(selectedAccount.value.salePrice);
});
const estimatedTotalCost = computed(
  () =>
    (estimatedAppleCostValue.value ?? 0) +
    selectedAccountPurchaseCost.value +
    platformFeeRmbValue.value +
    refundLossRmbValue.value
);
const estimatedProfit = computed(() => {
  if (!form.paidAmount || estimatedAppleCostValue.value === null) {
    return '-';
  }

  const value = paidAmountRmbValue.value - estimatedTotalCost.value;

  return formatMoney(value);
});
const estimatedProfitRate = computed(() => {
  if (!paidAmountRmbValue.value || estimatedProfit.value === '-') {
    return '-';
  }

  return `${((readAmount(estimatedProfit.value) / paidAmountRmbValue.value) * 100).toFixed(2)}%`;
});
const paidExchangeRateValue = computed(() =>
  form.paidCurrency === 'CNY' ? 1 : readAmount(form.paidExchangeRateToRmb)
);
const paidAmountRmbValue = computed(() => convertPaidAmountToRmb(form.paidAmount));
const platformFeeRmbValue = computed(() => convertPaidAmountToRmb(form.platformFee));
const refundLossRmbValue = computed(() => convertPaidAmountToRmb(form.refundLoss));
const paidAmountRmbHint = computed(() => {
  if (form.paidCurrency === 'CNY') {
    return `人民币实收 ${formatMoney(paidAmountRmbValue.value)}`;
  }

  return `折合人民币 ${formatMoney(paidAmountRmbValue.value)}`;
});
const suggestedPaidAmountRmb = computed(() => {
  const margin = readAmount(form.targetGrossMargin);

  if (estimatedTotalCost.value <= 0 || margin <= 0 || margin >= 100) {
    return null;
  }

  return estimatedTotalCost.value / (1 - margin / 100);
});
const suggestedPaidAmountHint = computed(() =>
  suggestedPaidAmountRmb.value === null
    ? '选择 ID 后可按目标毛利率反算'
    : `建议实收 ${formatMoney(suggestedPaidAmountRmb.value)} CNY`
);
const orderCostBars = computed(() => {
  const paidAmount = paidAmountRmbValue.value;
  const appleCost = estimatedAppleCostValue.value ?? 0;
  const idCost = selectedAccountPurchaseCost.value;
  const platformFee = platformFeeRmbValue.value;
  const refundLoss = refundLossRmbValue.value;
  const base = Math.max(paidAmount, appleCost + idCost + platformFee + refundLoss, 1);

  return [
    {
      label: '实收',
      value: `${formatMoney(paidAmount)} CNY`,
      percent: getCostPercent(paidAmount, base),
      tone: 'blue'
    },
    {
      label: '余额成本',
      value: estimatedAppleCostValue.value === null ? '-' : `${formatMoney(appleCost)} CNY`,
      percent: getCostPercent(appleCost, base),
      tone: 'green'
    },
    {
      label: 'ID成本',
      value: idCost > 0 ? `${formatMoney(idCost)} CNY` : '-',
      percent: getCostPercent(idCost, base),
      tone: 'purple'
    },
    {
      label: '手续费',
      value: `${formatMoney(platformFee)} CNY`,
      percent: getCostPercent(platformFee, base),
      tone: 'orange'
    },
    {
      label: '损耗',
      value: `${formatMoney(refundLoss)} CNY`,
      percent: getCostPercent(refundLoss, base),
      tone: 'red'
    }
  ];
});

function readAmount(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function convertPaidAmountToRmb(value: string | number | null | undefined) {
  const result = readAmount(value) * paidExchangeRateValue.value;
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

function getCostPercent(value: number, base: number) {
  if (value <= 0) {
    return 4;
  }

  return Math.min(100, Math.max(6, Math.round((value / base) * 100)));
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '-';
}

function formatAverageCost(value: string | number | null | undefined) {
  return readAmount(value).toFixed(2);
}

function formatAccountRegionCurrency(
  region: string | null | undefined,
  currency: string | null | undefined
) {
  return formatAppleRegionCurrencyLabel(region, currency);
}

function getOwnershipLabel(value: AppleAccountOwnershipType) {
  return value === 'sold' ? '售出' : '寄存';
}

function buildCustomerTagParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 200,
    group: CUSTOMER_TAG_DICTIONARY_GROUP,
    status: 'active',
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
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

function buildAppleServiceCategoryParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 200,
    group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
    status: 'active',
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function applyCustomerTagResult(data: PageResult<DataDictionary>) {
  customerTagDictionaries.value = data.items;
}

function applyAppleRegionResult(data: PageResult<DataDictionary>) {
  appleRegionDictionaries.value = data.items;
}

function applyAppleServiceCategoryResult(data: PageResult<DataDictionary>) {
  appleServiceCategoryDictionaries.value = data.items;
}

function getServiceCategoryLabel(category?: string | null) {
  const normalized = category?.trim();
  if (!normalized || normalized === 'default') {
    return '通用';
  }
  return normalized;
}

function calculatePlatformFee() {
  const platform = selectedSourcePlatform.value;
  if (!platform || !form.paidAmount) {
    return '0.00';
  }

  const paidAmount = readAmount(form.paidAmount);
  const feeRate = readAmount(platform.feeRate);
  const feeFixed = readAmount(platform.feeFixed);

  return formatMoney(paidAmount * feeRate + feeFixed);
}

function syncDerivedOrderAmounts() {
  form.platformFee = calculatePlatformFee();
}

function handlePaidCurrencyChange() {
  if (form.paidCurrency === 'CNY') {
    form.paidExchangeRateToRmb = '1';
  } else if (!form.paidExchangeRateToRmb || form.paidExchangeRateToRmb === '1') {
    form.paidExchangeRateToRmb = '';
  }

  syncDerivedOrderAmounts();
}

function fillPaidAmountByMargin() {
  if (suggestedPaidAmountRmb.value === null) {
    ElMessage.warning('请先选择 Apple ID，并填写 0-99 之间的目标毛利率');
    return;
  }

  const exchangeRate = paidExchangeRateValue.value || 1;
  form.paidAmount =
    form.paidCurrency === 'CNY'
      ? formatMoney(suggestedPaidAmountRmb.value)
      : formatMoney(suggestedPaidAmountRmb.value / exchangeRate);
  syncDerivedOrderAmounts();
}

function syncExpireTimeFromService() {
  form.expireTime = calculateServiceExpireTime(selectedService.value, form.startTime);
}

function calculateServiceExpireTime(service: AppleService | null, startValue: string) {
  if (!service || service.expireCalcType === 'manual' || service.defaultPeriodType === 'manual') {
    return '';
  }

  const startTime = startValue ? new Date(startValue) : new Date();
  if (Number.isNaN(startTime.getTime())) {
    return '';
  }

  const expireTime = new Date(startTime);
  if (service.expireCalcType === 'by_day' || service.defaultPeriodType === 'day') {
    expireTime.setDate(expireTime.getDate() + service.defaultPeriodValue);
  } else {
    addCalendarMonths(expireTime, service.defaultPeriodValue);
  }
  expireTime.setDate(expireTime.getDate() - 1);

  return formatDateTimeValue(expireTime);
}

function addCalendarMonths(date: Date, months: number) {
  const originalDay = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + months);

  const lastDayOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDayOfTargetMonth));
}

function formatDateTimeValue(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
  const offsetRestMinutes = String(absoluteOffset % 60).padStart(2, '0');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const millisecond = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${sign}${offsetHours}:${offsetRestMinutes}`;
}

function getCurrentDateTimeValue() {
  return formatDateTimeValue(new Date());
}

async function loadInitialData(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  try {
    await refreshSmartQueryResource({
      key: createSmartQueryKey(ORDER_ENTRY_BASE_SCOPE),
      fetcher: ({ signal }) => loadOrderEntryBaseData({ ...options, signal }),
      apply: applyOrderEntryBaseData,
      background: Boolean(options.silent && customers.value.length),
      cancelPreviousMatching: options.force ? ORDER_ENTRY_BASE_SCOPE : undefined,
      setLoading: (value) => {
        loading.value = value;
      },
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载订单基础数据失败');
  }
}

async function loadOrderEntryBaseData(
  options: { dedupeMs?: number; force?: boolean; signal?: AbortSignal } = {}
) {
  return Promise.all([
    loadSmartCustomers(
      { page: 1, pageSize: 100, status: 'active' },
      { force: options.force ?? true, dedupeMs: options.dedupeMs, signal: options.signal }
    ),
    loadSmartSourcePlatforms(
      { page: 1, pageSize: 100, status: 'active' },
      { force: options.force ?? true, dedupeMs: options.dedupeMs, signal: options.signal }
    ),
    loadSmartAppleServices(
      { page: 1, pageSize: 100, status: 'enabled' },
      { force: options.force ?? true, dedupeMs: options.dedupeMs, signal: options.signal }
    ),
    dataCenterApi.listDictionaries(buildCustomerTagParams(), { signal: options.signal }),
    dataCenterApi.listDictionaries(buildAppleRegionParams(), { signal: options.signal }),
    dataCenterApi.listDictionaries(buildAppleServiceCategoryParams(), { signal: options.signal })
  ]);
}

function applyOrderEntryBaseData(data: Awaited<ReturnType<typeof loadOrderEntryBaseData>>) {
  const [
    customerData,
    platformData,
    serviceData,
    customerTagData,
    appleRegionData,
    appleServiceCategoryData
  ] = data;
  customers.value = mergeCustomerItems(
    customerData.items,
    selectedCustomer.value ? [selectedCustomer.value] : []
  );
  sourcePlatforms.value = platformData.items;
  services.value = serviceData.items;
  applyCustomerTagResult(customerTagData);
  applyAppleRegionResult(appleRegionData);
  applyAppleServiceCategoryResult(appleServiceCategoryData);
}

function mergeCustomerItems(items: Customer[], pinnedItems: Customer[] = []) {
  const customerMap = new Map<string, Customer>();
  for (const customer of pinnedItems) {
    customerMap.set(customer.id, customer);
  }
  for (const customer of items) {
    customerMap.set(customer.id, customer);
  }
  return Array.from(customerMap.values());
}

async function searchCustomers(keyword: string) {
  const requestId = ++customerSearchRequestId;
  customerSearchKeyword.value = keyword;
  customerSearching.value = true;

  try {
    const data = await loadSmartCustomers(
      {
        page: 1,
        pageSize: 30,
        keyword: keyword.trim() || undefined,
        status: 'active'
      },
      { force: true, dedupeMs: 300 }
    );

    if (requestId !== customerSearchRequestId) {
      return;
    }

    customers.value = mergeCustomerItems(
      data.items,
      selectedCustomer.value ? [selectedCustomer.value] : []
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '搜索客户失败');
  } finally {
    if (requestId === customerSearchRequestId) {
      customerSearching.value = false;
    }
  }
}

function handleCustomerSelectVisibleChange(visible: boolean) {
  if (visible) {
    void searchCustomers(customerSearchKeyword.value);
  }
}

function handleCustomerChange(customerId: string) {
  if (!customerId) {
    orderContext.value = null;
    return;
  }

  customerNoticeVisible.value = false;
  newCustomerDraft.value = null;
  const customer = customers.value.find((item) => item.id === customerId);
  if (!form.sourcePlatformId && customer?.sourcePlatformId) {
    form.sourcePlatformId = customer.sourcePlatformId;
    syncDerivedOrderAmounts();
  }

  void loadOrderEntryContext();
}

function getCustomerMeta(customer: Customer) {
  return [getCustomerPhoneLabel(customer), customer.wechat ?? ''].filter(Boolean).join(' / ');
}

function getCustomerOptionLabel(customer: Customer) {
  return formatCustomerProfileSummary(
    customer.name,
    getCustomerPhoneLabel(customer),
    customer.wechat
  );
}

function getCustomerPhoneLabel(customer: Customer) {
  return customer.maskedPhone ?? (customer.phoneTail ? `尾号 ${customer.phoneTail}` : '');
}

function formatCustomerProfileSummary(name: string, phone?: string | null, wechat?: string | null) {
  return [name, phone, wechat]
    .map((item) => item?.trim())
    .filter(Boolean)
    .join(' / ');
}

function handleSourcePlatformChange() {
  syncDerivedOrderAmounts();
}

async function loadOrderEntryContext() {
  const requestId = ++orderContextRequestId;

  if (!form.customerId || !form.serviceId) {
    orderContext.value = null;
    if (selectedService.value && !form.currentPlan) {
      form.currentPlan = selectedService.value.name;
    }
    return;
  }

  orderContextLoading.value = true;
  try {
    const data = await appleOrdersApi.entryContext({
      customerId: form.customerId,
      serviceId: form.serviceId,
      serviceAccount: form.serviceAccount || undefined
    });

    if (requestId !== orderContextRequestId) {
      return;
    }

    orderContext.value = data.latestOrder;
    if (data.latestOrder) {
      form.currentPlan =
        data.latestOrder.targetPlan ||
        data.latestOrder.currentPlan ||
        selectedService.value?.name ||
        '';
    } else if (selectedService.value) {
      form.currentPlan = selectedService.value.name;
    }
  } catch (error) {
    if (requestId === orderContextRequestId) {
      orderContext.value = null;
      ElMessage.error(error instanceof Error ? error.message : '读取客户历史套餐失败');
    }
  } finally {
    if (requestId === orderContextRequestId) {
      orderContextLoading.value = false;
    }
  }
}

function getOrderContextSummary() {
  if (!orderContext.value) {
    return '';
  }

  const plan = orderContext.value.targetPlan || orderContext.value.currentPlan || '未记录套餐';
  const expireLabel = formatExpireDelta(orderContext.value.daysUntilExpire ?? null);
  const cost =
    readAmount(orderContext.value.appleCostRmb) +
    readAmount(orderContext.value.appleAccountPurchaseCost);
  const profitRate = orderContext.value.profitRate ? `${orderContext.value.profitRate}%` : '-';

  return `${selectedServiceRegionLabel.value || form.serviceRegion} / ${plan} / ${expireLabel} / 上次实收 ${formatMoney(
    readAmount(orderContext.value.paidAmountRmb)
  )} CNY / 成本 ${formatMoney(cost)} CNY / 利润率 ${profitRate}`;
}

function formatExpireDelta(days: number | null) {
  if (days === null) {
    return '未记录到期';
  }

  if (days >= 0) {
    return `还有 ${days} 天到期`;
  }

  return `已过期 ${Math.abs(days)} 天`;
}

function clearSelectedAccount() {
  selectedAccount.value = null;
  form.appleAccountId = '';
  availableAccounts.value = [];
}

function clearSelectedService() {
  form.serviceId = '';
  form.appleCostValue = '';
  form.targetPlan = '';
  form.currentPlan = '';
  form.expireTime = '';
  orderContext.value = null;
  clearSelectedAccount();
}

function handleServiceRegionChange() {
  form.serviceCategory = '';
  clearSelectedService();
}

function handleServiceCategoryChange() {
  clearSelectedService();
}

async function handleAppleAccountOwnershipTypeChange() {
  clearSelectedAccount();
  if (form.serviceId) {
    await loadAvailableAccounts({ autoSelect: selectedService.value?.autoMatchAppleId });
  }
}

async function handleServiceChange() {
  const service = selectedService.value;
  clearSelectedAccount();

  if (!service) {
    form.expireTime = '';
    return;
  }

  form.paidAmount = service.defaultPrice;
  form.appleCostValue = service.officialCostValue;
  form.targetPlan = service.name;
  form.currentPlan = service.name;
  syncExpireTimeFromService();
  syncDerivedOrderAmounts();
  await loadOrderEntryContext();
  await loadAvailableAccounts({ autoSelect: service.autoMatchAppleId });
}

function openNewCustomerDialog() {
  if (newCustomerDraft.value) {
    fillNewCustomerFormFromPayload(newCustomerDraft.value);
  } else {
    resetCustomerProfileForm(newCustomerForm);
    newCustomerForm.sourcePlatformId = form.sourcePlatformId;
  }

  newCustomerDialogVisible.value = true;
}

function fillNewCustomerFormFromPayload(payload: SaveCustomerPayload) {
  newCustomerForm.name = payload.name;
  newCustomerForm.phone = payload.phone ?? '';
  newCustomerForm.wechat = payload.wechat ?? '';
  newCustomerForm.sourcePlatformId = payload.sourcePlatformId ?? '';
  newCustomerForm.tags = [...(payload.tags ?? [])];
  newCustomerForm.remark = payload.remark ?? '';
  newCustomerForm.status = payload.status ?? 'active';
}

async function saveNewCustomerDraft() {
  const valid = await newCustomerFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  newCustomerDraft.value = buildCustomerProfilePayload(newCustomerForm, { emptyPhone: 'null' });
  form.customerId = '';
  customerNoticeVisible.value = false;

  if (!form.sourcePlatformId && newCustomerDraft.value.sourcePlatformId) {
    form.sourcePlatformId = newCustomerDraft.value.sourcePlatformId;
  }

  formRef.value?.clearValidate('customerId');
  newCustomerDialogVisible.value = false;
  ElMessage.success('客户资料已加入订单，提交订单时会同步到客户管理');
}

function clearNewCustomerDraft() {
  newCustomerDraft.value = null;
  resetCustomerProfileForm(newCustomerForm);
}

async function loadAvailableAccounts(options: { autoSelect?: boolean } = {}) {
  if (!form.serviceId) {
    return;
  }

  matchingLoading.value = true;
  try {
    const data = await appleMatchingApi.listAvailableAccounts({
      serviceId: form.serviceId,
      amountRequired: form.appleCostValue || undefined,
      currency: selectedService.value?.currency,
      keyword: matchKeyword.value || undefined,
      ownershipType: form.appleAccountOwnershipType,
      showUnavailable: 'true'
    });
    availableAccounts.value = data.items;
    if (options.autoSelect) {
      const firstAvailableAccount =
        data.items.find((account) => account.availability === 'available') ?? null;
      if (firstAvailableAccount) {
        selectAccount(firstAvailableAccount);
      } else {
        selectedAccount.value = null;
        form.appleAccountId = '';
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '自动匹配失败');
  } finally {
    matchingLoading.value = false;
  }
}

function selectAccount(account: AvailableAppleAccount) {
  selectedAccount.value = account;
  form.appleAccountId = account.appleAccountId;
}

function getAvailabilityLabel(value: AvailableAppleAccount['availability']) {
  return {
    available: '可用',
    unavailable: '不可用',
    need_confirm: '需确认'
  }[value];
}

function getAvailabilityTone(value: AvailableAppleAccount['availability']) {
  if (value === 'available') return 'green';
  if (value === 'need_confirm') return 'orange';
  return 'red';
}

async function submitOrder() {
  if (!hasOrderCustomer.value) {
    customerNoticeVisible.value = true;
    return;
  }

  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const customerId = await resolveOrderCustomerId();
    const order = await appleOrdersApi.create({
      customerId,
      sourcePlatformId: form.sourcePlatformId || null,
      externalOrderNo: form.externalOrderNo || null,
      serviceId: form.serviceId,
      appleAccountId: form.appleAccountId || null,
      serviceAccount: form.serviceAccount || null,
      currentPlan: form.currentPlan || null,
      targetPlan: form.targetPlan || null,
      startTime: form.startTime || null,
      expireTime: form.expireTime || null,
      paidAmount: form.paidAmount,
      paidCurrency: form.paidCurrency,
      paidExchangeRateToRmb: form.paidExchangeRateToRmb || '1',
      platformFee: form.platformFee || undefined,
      refundLoss: form.refundLoss || '0',
      appleCostValue: form.appleCostValue,
      appleAccountOwnershipType: form.appleAccountOwnershipType,
      remark: form.remark || null
    });
    ElMessage.success(`订单已创建：${order.orderNo}`);
    resetOrderForm();
    availableAccounts.value = [];
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '提交订单失败');
  } finally {
    saving.value = false;
  }
}

async function resolveOrderCustomerId() {
  if (form.customerId) {
    return form.customerId;
  }

  if (!newCustomerDraft.value) {
    throw new Error('请先选择客户或新增客户资料');
  }

  const customerPayload = newCustomerDraft.value;
  await ensureCustomerTagsRegistered(customerPayload.tags ?? []);
  const createdCustomer = await customersApi.create(customerPayload);
  customers.value = mergeCustomerItems([createdCustomer], customers.value);
  form.customerId = createdCustomer.id;
  newCustomerDraft.value = null;

  return createdCustomer.id;
}

async function ensureCustomerTagsRegistered(tags: string[]) {
  const existingLabels = new Set(customerTagDictionaries.value.map((tag) => tag.label.trim()));
  const missingTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].filter(
    (tag) => !existingLabels.has(tag)
  );

  if (!missingTags.length) {
    return;
  }

  const createdTags = await Promise.all(
    missingTags.map((tag, index) =>
      dataCenterApi.createDictionary({
        group: CUSTOMER_TAG_DICTIONARY_GROUP,
        code: buildQuickSettingCode(tag, 'tag'),
        label: tag,
        value: tag,
        sortOrder: customerTagDictionaries.value.length + index + 1,
        status: 'active',
        remark: '从订单录入新增客户时自动保存'
      })
    )
  );

  customerTagDictionaries.value = [...customerTagDictionaries.value, ...createdTags];
}

function resetOrderForm() {
  form.customerId = '';
  form.sourcePlatformId = '';
  form.externalOrderNo = '';
  form.serviceRegion = '';
  form.serviceCategory = '';
  form.serviceId = '';
  form.appleAccountId = '';
  form.appleAccountOwnershipType = 'consigned';
  form.serviceAccount = '';
  form.currentPlan = '';
  form.targetPlan = '';
  form.startTime = getCurrentDateTimeValue();
  form.expireTime = '';
  form.paidAmount = '';
  form.paidCurrency = 'CNY';
  form.paidExchangeRateToRmb = '1';
  form.targetGrossMargin = '';
  form.platformFee = '0.00';
  form.refundLoss = '0';
  form.appleCostValue = '';
  form.remark = '';
  selectedAccount.value = null;
  orderContext.value = null;
  newCustomerDraft.value = null;
  customerNoticeVisible.value = false;
  resetCustomerProfileForm(newCustomerForm);
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(ORDER_ENTRY_REALTIME_SCOPES, () => {
  void loadInitialData({ silent: true, dedupeMs: 0 });
});

onMounted(() => loadInitialData({ force: true, dedupeMs: 0 }));

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});
</script>

<style scoped>
.order-entry-form-alert {
  margin-bottom: 14px;
  border-radius: 8px;
}

.order-entry-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.75fr);
  align-items: start;
  gap: 18px;
}

.order-entry-pane {
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}

.order-entry-pane--manual {
  padding: 16px;
}

.order-entry-pane--system {
  position: sticky;
  top: 84px;
  padding: 14px;
  background: #f8fafc;
}

.order-entry-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.order-entry-pane__header div {
  display: grid;
  gap: 2px;
}

.order-entry-pane__header span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.3;
}

.order-entry-pane__header strong {
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
}

.order-entry-section {
  padding: 14px 0 16px;
  border-top: 1px solid #edf2f7;
}

.order-entry-section:first-of-type {
  padding-top: 0;
  border-top: 0;
}

.order-entry-section__title {
  display: block;
  margin-bottom: 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.order-entry-field-grid,
.order-entry-side-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.order-entry-field-grid :deep(.el-form-item),
.order-entry-side-grid :deep(.el-form-item),
.order-entry-system-stack :deep(.el-form-item) {
  margin-bottom: 0;
}

.order-entry-field--wide {
  grid-column: 1 / -1;
}

.order-entry-system-stack {
  display: grid;
  gap: 14px;
}

.order-entry-select-empty {
  display: flex;
  min-width: 260px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.order-entry-customer-picker {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.order-entry-customer-picker__create {
  white-space: nowrap;
}

.order-entry-customer-option {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-entry-customer-option strong,
.order-entry-customer-option span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-entry-customer-option span {
  color: #64748b;
  font-size: 12px;
}

.order-entry-customer-draft {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
}

.order-entry-customer-draft span {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-entry-money-input {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 8px;
}

.order-entry-money-input__currency {
  width: 132px;
}

.order-entry-money-hint {
  min-height: 18px;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.order-entry-history-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fbff;
  color: #475569;
  font-size: 12px;
  line-height: 1.4;
}

.order-entry-history-card span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-entry-margin-calculator {
  display: grid;
  grid-template-columns: auto 112px auto minmax(120px, auto);
  align-items: center;
  gap: 8px;
  justify-content: end;
  min-width: 0;
}

.order-entry-money-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.order-entry-margin-calculator__label,
.order-entry-margin-calculator__hint {
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-entry-margin-calculator__input {
  width: 112px;
}

.order-entry-margin-calculator__suffix {
  color: #64748b;
  font-size: 12px;
}

.order-entry-margin-calculator__action {
  min-width: 84px;
}

:deep(.order-cost-track__bar--purple) {
  background: #8b5cf6;
}

@media (max-width: 720px) {
  .order-entry-layout,
  .order-entry-field-grid,
  .order-entry-side-grid {
    grid-template-columns: 1fr;
  }

  .order-entry-pane {
    border-radius: 10px;
  }

  .order-entry-pane--manual,
  .order-entry-pane--system {
    padding: 12px;
  }

  .order-entry-pane--system {
    position: static;
  }

  .order-entry-pane__header {
    align-items: flex-start;
  }

  .order-entry-field--wide {
    grid-column: auto;
  }

  .order-entry-customer-picker,
  .order-entry-money-input,
  .order-entry-money-meta,
  .order-entry-margin-calculator {
    grid-template-columns: 1fr;
    justify-content: stretch;
  }

  .order-entry-customer-picker__create,
  .order-entry-money-input__currency,
  .order-entry-margin-calculator__input,
  .order-entry-margin-calculator__action {
    width: 100%;
  }

  .order-entry-history-card {
    align-items: flex-start;
  }

  .order-entry-history-card span:last-child,
  .order-entry-margin-calculator__hint {
    white-space: normal;
  }
}
</style>
