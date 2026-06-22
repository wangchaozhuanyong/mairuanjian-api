<template>
  <PageScaffold
    title="Apple ID 业务设置"
    group="Apple ID 业务"
    phase="Phase 4"
    description="维护官网官方价格、Apple 余额开通价规则、币种、周期、允许地区和 Apple ID 锁定规则。"
  >
    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="业务与锁定规则"
          help="这里维护代充业务的官网价、Apple 余额开通价、周期、自动匹配和 Apple ID 锁定策略。客户实际卖价在订单录入时填写。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 个业务</StatusChip>
          <StatusChip tone="green">启用 {{ enabledCount }}</StatusChip>
          <StatusChip tone="orange">自动匹配 {{ autoMatchCount }}</StatusChip>
          <StatusChip :tone="globalLockCount > 0 ? 'red' : 'green'" dot>
            {{ globalLockCount > 0 ? `全局锁定 ${globalLockCount}` : '锁定规则正常' }}
          </StatusChip>
          <StatusChip :tone="inactiveServiceCount > 0 ? 'orange' : 'green'">
            暂停/停用 {{ inactiveServiceCount }}
          </StatusChip>
          <StatusChip tone="purple">按业务锁定 {{ byServiceLockCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="serviceColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedServices.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增业务"
        placeholder="搜索业务名称、分类、币种、备注"
        @search="handleSearch"
        @refresh="loadServices"
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
            v-model="query.category"
            class="table-toolbar__select"
            placeholder="分类"
            clearable
            filterable
            @change="handleSearch"
          >
            <el-option
              v-for="category in serviceCategoryOptions"
              :key="category"
              :label="getCategoryLabel(category)"
              :value="category"
            />
          </el-select>
          <el-input
            v-model.trim="query.currency"
            class="table-toolbar__select"
            placeholder="币种"
            clearable
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </template>
      </TableToolbar>

      <div class="apple-service-category-bar" aria-label="业务分类">
        <AppButton
          size="small"
          :variant="query.category ? 'soft' : 'primary'"
          @click="selectCategory('')"
        >
          全部分类
        </AppButton>
        <AppButton
          v-for="category in serviceCategoryOptions"
          :key="category"
          size="small"
          :variant="query.category === category ? 'primary' : 'soft'"
          @click="selectCategory(category)"
        >
          {{ getCategoryLabel(category) }}
        </AppButton>
      </div>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="services"
        :size="tableSize"
        row-key="id"
        empty-text="暂无 Apple ID 业务"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 Apple ID 业务</strong>
            <span>可以新建业务，或清空筛选后查看已有的业务配置。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增业务</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="业务"
          min-width="160"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('category')"
          prop="category"
          label="分类"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ getCategoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('officialBasePrice')"
          prop="officialBasePrice"
          label="官网价"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.officialBasePrice }} {{ row.currency }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('officialCostValue')"
          prop="officialCostValue"
          label="Apple余额价"
          width="150"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ row.officialCostValue }} {{ row.currency }}
            <div class="muted-block">{{ getBalanceRuleLabel(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('period')"
          prop="defaultPeriodValue"
          label="周期"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">
            {{ getPeriodLabel(row.defaultPeriodType, row.defaultPeriodValue) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('lockRule')"
          prop="lockRule"
          label="锁定规则"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ getLockRuleLabel(row.lockRule) }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('allowedRegions')" label="允许地区" min-width="160">
          <template #default="{ row }">
            <StatusChip
              v-for="region in row.allowedRegions"
              :key="region"
              class="tag-gap"
              tone="cyan"
            >
              {{ region }}
            </StatusChip>
            <span v-if="!row.allowedRegions.length">不限</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="90"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
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
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openEdit(row)">编辑</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="services.length" class="mobile-record-list" aria-label="Apple ID 业务移动列表">
        <article v-for="service in services" :key="service.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ service.name }}</strong>
              <span>{{ getCategoryLabel(service.category) }} · {{ service.currency }}</span>
            </div>
            <StatusChip :tone="getStatusTone(service.status)" dot>
              {{ getStatusLabel(service.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>官网价</span>
              <strong>{{ service.officialBasePrice }} {{ service.currency }}</strong>
            </div>
            <div>
              <span>Apple余额价</span>
              <strong>{{ service.officialCostValue }} {{ service.currency }}</strong>
            </div>
            <div>
              <span>周期</span>
              <strong>
                {{ getPeriodLabel(service.defaultPeriodType, service.defaultPeriodValue) }}
              </strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>锁定规则</span>
              <strong>{{ getLockRuleLabel(service.lockRule) }}</strong>
            </div>
            <div>
              <span>允许地区</span>
              <div class="mobile-record-card__chips">
                <StatusChip v-for="region in service.allowedRegions" :key="region" tone="cyan">
                  {{ region }}
                </StatusChip>
                <em v-if="!service.allowedRegions.length">不限</em>
              </div>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(service.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEdit(service)">编辑</AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list" aria-label="Apple ID 业务空状态">
        <div class="apple-core-empty-state">
          <strong>暂无 Apple ID 业务</strong>
          <span>可以新建业务，或清空筛选后查看已有的业务配置。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFiltersAndSearch">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增业务</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="loadServices"
      />
    </section>

    <section class="content-panel apple-official-price-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="官方价格巡检"
          help="这里用来定期检查官方价格和套餐有没有变。系统只会先生成待确认变化，不会自动改你的业务价格，确认后才同步。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>来源 {{ officialPriceSources.length }}</StatusChip>
          <StatusChip :tone="pendingOfficialReviews.length ? 'orange' : 'green'" dot>
            待确认 {{ pendingOfficialReviews.length }}
          </StatusChip>
          <StatusChip tone="purple">快照 {{ officialPriceSnapshots.length }}</StatusChip>
          <AppButton variant="soft" @click="loadOfficialPricePanel">刷新</AppButton>
          <AppButton variant="primary" @click="openCreateOfficialSource">新增来源</AppButton>
        </div>
      </div>

      <div class="apple-balance-rule-bar">
        <div>
          <strong>Apple 余额开通价全局规则</strong>
          <span>未单独设置的业务，会按这条规则从官网价自动算出 Apple 余额价。</span>
        </div>
        <div class="apple-balance-rule-bar__controls">
          <el-select v-model="globalBalanceRuleForm.ruleType" class="apple-rule-select">
            <el-option label="按百分比" value="percent" />
            <el-option label="固定加价" value="fixed_add" />
          </el-select>
          <el-input
            v-model.trim="globalBalanceRuleForm.ruleValue"
            class="apple-rule-input"
            :placeholder="globalBalanceRuleForm.ruleType === 'percent' ? '例如 1.25' : '例如 2'"
          />
          <AppButton variant="primary" :loading="savingBalanceRule" @click="saveGlobalBalanceRule">
            保存规则
          </AppButton>
        </div>
      </div>

      <el-tabs v-model="officialPriceTab" class="apple-official-price-tabs">
        <el-tab-pane label="待确认变化" name="reviews">
          <el-table
            v-loading="officialPriceLoading"
            class="desktop-data-table"
            :data="officialPriceReviews"
            row-key="id"
            empty-text="暂无价格变化"
          >
            <el-table-column label="变化" min-width="140">
              <template #default="{ row }">
                <StatusChip :tone="getOfficialReviewTone(row.changeType)" dot>
                  {{ getOfficialReviewTypeLabel(row.changeType) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="业务/套餐" min-width="220">
              <template #default="{ row }">
                <strong>{{ row.appleService?.name || getReviewValue(row, 'serviceName') }}</strong>
                <div class="muted-block">
                  {{ getProviderLabel(row.source?.provider || getReviewValue(row, 'provider')) }} ·
                  {{ row.source?.name || '-' }} · {{ getReviewValue(row, 'region') }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="系统当前" min-width="170">
              <template #default="{ row }">
                {{ getReviewOldOfficialPrice(row) }}
                <div class="muted-block">Apple余额价 {{ getReviewOldAppleBalancePrice(row) }}</div>
                <div class="muted-block">{{ getReviewOldPeriod(row) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="官方最新" min-width="170">
              <template #default="{ row }">
                {{ getReviewNewOfficialPrice(row) }}
                <div class="muted-block">Apple余额价 {{ getReviewNewAppleBalancePrice(row) }}</div>
                <div class="muted-block">{{ getReviewNewPeriod(row) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <StatusChip :tone="row.status === 'pending' ? 'orange' : 'green'" dot>
                  {{ getOfficialReviewStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton
                    v-if="row.status === 'pending'"
                    variant="primary"
                    :loading="officialReviewActionId === row.id"
                    @click="approveOfficialReview(row)"
                  >
                    确认
                  </AppButton>
                  <AppButton
                    v-if="row.status === 'pending'"
                    variant="ghost"
                    :loading="officialReviewActionId === row.id"
                    @click="ignoreOfficialReview(row)"
                  >
                    忽略
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="官方来源" name="sources">
          <div class="apple-official-price-actions">
            <AppButton variant="primary" @click="openCreateOfficialSource">新增来源</AppButton>
            <AppButton
              variant="soft"
              :disabled="!officialPriceSources.length"
              :loading="officialSourceCheckId === officialPriceSources[0]?.id"
              @click="handleOfficialSourceCheck(officialPriceSources[0])"
            >
              {{ getOfficialSourceCheckLabel(officialPriceSources[0]) }}
            </AppButton>
          </div>
          <el-table
            v-loading="officialPriceLoading"
            class="desktop-data-table"
            :data="officialPriceSources"
            row-key="id"
            empty-text="暂无官方来源"
          >
            <el-table-column label="来源" min-width="220">
              <template #default="{ row }">
                <strong>{{ row.name }}</strong>
                <div class="muted-block">
                  {{ getProviderLabel(row.provider) }} · {{ row.sourceUrl || '未填写官方地址' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="地区/币种" min-width="120">
              <template #default="{ row }">{{ row.region }} / {{ row.currency }}</template>
            </el-table-column>
            <el-table-column label="采集方式" width="120">
              <template #default="{ row }">{{ getCollectMethodLabel(row.collectMethod) }}</template>
            </el-table-column>
            <el-table-column label="检查间隔" width="110">
              <template #default="{ row }">{{ row.checkIntervalHours }} 小时</template>
            </el-table-column>
            <el-table-column label="最近检查" min-width="160">
              <template #default="{ row }">{{ formatDate(row.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton
                    variant="primary"
                    :loading="officialSourceCheckId === row.id"
                    @click="handleOfficialSourceCheck(row)"
                  >
                    {{ getOfficialSourceCheckLabel(row) }}
                  </AppButton>
                  <AppButton variant="ghost" @click="openEditOfficialSource(row)">编辑</AppButton>
                  <AppButton variant="danger" @click="removeOfficialSource(row)">删除</AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="采集记录" name="snapshots">
          <el-table
            v-loading="officialPriceLoading"
            class="desktop-data-table"
            :data="officialPriceSnapshots"
            row-key="id"
            empty-text="暂无采集记录"
          >
            <el-table-column label="套餐" min-width="220">
              <template #default="{ row }">
                <strong>{{ row.serviceName }}</strong>
                <div class="muted-block">
                  {{ getProviderLabel(row.provider) }} · {{ row.source?.name || '-' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="地区/币种" width="130">
              <template #default="{ row }">{{ row.region }} / {{ row.currency }}</template>
            </el-table-column>
            <el-table-column label="官网价" width="130">
              <template #default="{ row }">{{ row.officialPrice }}</template>
            </el-table-column>
            <el-table-column label="Apple余额价" width="140">
              <template #default="{ row }">{{ row.appleBalancePrice || '-' }}</template>
            </el-table-column>
            <el-table-column label="周期" width="120">
              <template #default="{ row }">{{
                getPeriodLabel(row.periodType, row.periodValue)
              }}</template>
            </el-table-column>
            <el-table-column label="采集时间" min-width="170">
              <template #default="{ row }">{{ formatDate(row.collectedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingService ? '编辑业务' : '新增业务'"
      width="min(760px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="apple-service-form-section">基础业务</div>
        <div class="form-grid">
          <el-form-item prop="category">
            <template #label>
              <FieldHelpLabel
                label="业务分类"
                purpose="把业务分组，订单录入时会按分类展示，方便员工快速找到业务。"
                example="可以填 AI 会员、流媒体、工具订阅；同类业务尽量用同一个分类名。"
              />
            </template>
            <el-select
              v-model="form.category"
              class="full-input"
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入分类"
            >
              <el-option
                v-for="category in serviceCategoryOptions"
                :key="category"
                :label="getCategoryLabel(category)"
                :value="category"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="name">
            <template #label>
              <FieldHelpLabel
                label="业务名称"
                purpose="客户实际购买的具体服务名称，订单、开通记录和报表都会显示它。"
                example="例如 ChatGPT Plus 月费、Claude Pro 月费、YouTube Premium 月卡。"
              />
            </template>
            <el-input v-model.trim="form.name" placeholder="例如 ChatGPT Plus 月费" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="officialBasePrice">
            <template #label>
              <FieldHelpLabel
                label="官网官方价格"
                purpose="官网公开显示的套餐价格，官方价格巡检确认后会自动更新这里。"
                example="官网 Plus 月费 20 美元就填 20；不同国家套餐按对应币种填写。"
              />
            </template>
            <el-input v-model.trim="form.officialBasePrice" />
          </el-form-item>
          <el-form-item prop="currency">
            <template #label>
              <FieldHelpLabel
                label="币种"
                purpose="说明官网价格和 Apple 余额开通价使用哪种币种，系统会优先匹配同币种 Apple ID。"
                example="美国区业务填 USD，港区业务填 HKD，日区业务填 JPY。"
              />
            </template>
            <el-select
              v-model="form.currency"
              class="full-input"
              filterable
              placeholder="从快捷设置选择币种"
            >
              <el-option
                v-for="currency in appleCurrencyOptions"
                :key="currency.value"
                :label="currency.label"
                :value="currency.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="Apple余额价规则"
                purpose="不用采集 Apple 余额开通价时，按这里从官网价自动算出实际扣 Apple ID 余额的金额。"
                example="继承全局规则；单项按 1.25 倍；或固定加 2 美元；特殊套餐也可以手动填。"
              />
            </template>
            <el-select v-model="form.appleBalancePriceRuleType" class="full-input">
              <el-option
                v-for="option in balanceRuleOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isBalanceRuleValueVisible" prop="appleBalancePriceRuleValue">
            <template #label>
              <FieldHelpLabel
                :label="form.appleBalancePriceRuleType === 'percent' ? '百分比倍数' : '固定加价'"
                purpose="单独覆盖全局规则，只影响这个业务。"
                example="百分比填 1.25 表示官网价的 125%；固定加价填 2 表示官网价加 2。"
              />
            </template>
            <el-input v-model.trim="form.appleBalancePriceRuleValue" />
          </el-form-item>
          <el-form-item prop="officialCostValue">
            <template #label>
              <FieldHelpLabel
                label="Apple余额消耗金额"
                purpose="订单匹配 Apple ID 和利润计算会使用这个金额。非手动规则时由系统按官网价自动算出。"
                example="规则算出来是 25 USD，订单就按消耗 25 USD 去匹配和估成本。"
              />
            </template>
            <el-input
              v-if="form.appleBalancePriceRuleType === 'manual'"
              v-model.trim="form.officialCostValue"
            />
            <el-input v-else :model-value="computedFormAppleBalancePrice" disabled />
          </el-form-item>
        </div>

        <div class="apple-service-form-section">默认规则</div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="业务周期"
                purpose="订单录入会按这个周期自动填到期时间。"
                example="月费业务选按月并填 1；7 天试用就选按天并填 7。"
              />
            </template>
            <div class="apple-service-period-row">
              <el-select v-model="form.defaultPeriodType" class="full-input">
                <el-option
                  v-for="option in periodTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <el-input-number v-model="form.defaultPeriodValue" :min="1" class="full-input" />
            </div>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="到期计算"
                purpose="决定订单录入按月、按天，还是不自动计算到期时间。"
                example="自然月订阅选按月，固定天数商品选按天，特殊订单选手工。"
              />
            </template>
            <el-select v-model="form.expireCalcType" class="full-input">
              <el-option
                v-for="option in expireCalcTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="控制这个业务是否能继续接单和出现在订单录入里。"
                example="正常卖选启用；临时缺号选暂停；以后不卖了选停用。"
              />
            </template>
            <el-select v-model="form.status" class="full-input">
              <el-option label="启用" value="enabled" />
              <el-option label="暂停" value="paused" />
              <el-option label="停用" value="disabled" />
            </el-select>
          </el-form-item>
        </div>

        <el-collapse v-model="serviceAdvancedPanels" class="apple-service-advanced">
          <el-collapse-item title="高级匹配规则" name="advanced">
            <div class="form-grid">
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="锁定规则"
                    purpose="订单选中 Apple ID 后，决定这个账号暂时被占用的范围，防止重复使用。"
                    example="多数业务选按业务锁定；容易互相冲突的业务选全局锁定。"
                  />
                </template>
                <el-select v-model="form.lockRule" class="full-input">
                  <el-option
                    v-for="option in lockRuleOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="最低余额要求"
                    purpose="自动匹配 Apple ID 时要求账号至少剩多少余额，避免余额刚好不够。"
                    example="业务消耗 20，可填 20 或 21；想留一点余量就填更高。"
                  />
                </template>
                <el-input v-model.trim="form.minBalanceRequired" />
              </el-form-item>
            </div>
            <el-form-item>
              <template #label>
                <FieldHelpLabel
                  label="允许地区"
                  purpose="限制哪些地区的 Apple ID 可以接这个业务，避免地区不匹配导致开通失败。"
                  example="只支持美区就填 US；港区和美区都能开就选 HK、US；不限制就留空。"
                />
              </template>
              <el-select
                v-model="form.allowedRegions"
                class="full-input"
                multiple
                filterable
                placeholder="留空表示不限地区"
              >
                <el-option
                  v-for="region in appleRegionOptions"
                  :key="region.code"
                  :label="formatAppleAccountRegionOptionLabel(region)"
                  :value="region.code"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <FieldHelpLabel
                  label="自动处理"
                  purpose="决定订单录入时哪些步骤由系统帮你做，哪些信息必须填写。"
                  example="Apple 余额代开通常勾需要 Apple ID 和自动匹配；需要登录客户网站的业务勾客户网站账号。"
                />
              </template>
              <el-checkbox v-model="form.requireAppleId">需要 Apple ID</el-checkbox>
              <el-checkbox v-model="form.requireServiceAccount">需要客户网站账号</el-checkbox>
              <el-checkbox v-model="form.autoMatchAppleId">自动匹配 Apple ID</el-checkbox>
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="写给员工看的业务补充说明，不参与自动匹配和金额计算。"
              example="可以写开通注意点、特殊地区要求、容易失败的情况。"
            />
          </template>
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveService">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="officialSourceDialogVisible"
      :title="editingOfficialSource ? '编辑官方来源' : '新增官方来源'"
      width="min(640px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required label="来源名称">
          <el-input v-model.trim="officialSourceForm.name" placeholder="例如 Apple 美国价格页" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item required label="业务平台">
            <el-select v-model="officialSourceForm.provider" class="full-input" filterable>
              <el-option
                v-for="option in officialProviderOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item required label="地区">
            <el-input v-model.trim="officialSourceForm.region" placeholder="US" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item required label="币种">
            <el-input v-model.trim="officialSourceForm.currency" placeholder="USD" />
          </el-form-item>
          <el-form-item label="价格类型">
            <el-select v-model="officialSourceForm.priceSourceType" class="full-input">
              <el-option label="官网公开价" value="official_web" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="官方地址">
          <el-input v-model.trim="officialSourceForm.sourceUrl" placeholder="https://..." />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="采集方式">
            <el-select v-model="officialSourceForm.collectMethod" class="full-input">
              <el-option label="手动录入" value="manual" />
              <el-option label="网页采集" value="webpage" />
              <el-option label="API 采集" value="api" />
            </el-select>
          </el-form-item>
          <el-form-item label="检查间隔">
            <el-input-number
              v-model="officialSourceForm.checkIntervalHours"
              :min="1"
              :max="720"
              class="full-input"
            />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="officialSourceForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="officialSourceDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="savingOfficialSource" @click="saveOfficialSource">
          保存来源
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="officialCheckDialogVisible"
      title="录入本次官方价格"
      width="min(680px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required label="官方来源">
          <el-select v-model="officialCheckForm.sourceId" class="full-input" filterable>
            <el-option
              v-for="source in officialPriceSources"
              :key="source.id"
              :label="`${source.name} · ${source.region}/${source.currency}`"
              :value="source.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="匹配现有业务">
          <el-select
            v-model="officialCheckForm.appleServiceId"
            class="full-input"
            clearable
            filterable
            placeholder="可不选，不选时按套餐名判断新套餐"
            @change="syncOfficialCheckService"
          >
            <el-option
              v-for="service in services"
              :key="service.id"
              :label="`${service.name} · ${service.currency}`"
              :value="service.id"
            />
          </el-select>
        </el-form-item>
        <div class="form-grid">
          <el-form-item required label="官方套餐名">
            <el-input v-model.trim="officialCheckForm.serviceName" />
          </el-form-item>
          <el-form-item label="套餐编码">
            <el-input v-model.trim="officialCheckForm.planCode" placeholder="可留空" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="分类">
            <el-input v-model.trim="officialCheckForm.category" />
          </el-form-item>
          <el-form-item required label="币种">
            <el-input v-model.trim="officialCheckForm.currency" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item required label="官网官方价格">
            <el-input v-model.trim="officialCheckForm.officialPrice" placeholder="例如 9.99" />
          </el-form-item>
          <el-form-item required label="地区">
            <el-input v-model.trim="officialCheckForm.region" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="周期类型">
            <el-select v-model="officialCheckForm.periodType" class="full-input">
              <el-option
                v-for="option in periodTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="周期值">
            <el-input-number v-model="officialCheckForm.periodValue" :min="1" class="full-input" />
          </el-form-item>
        </div>
        <el-checkbox v-model="officialCheckForm.scanRemovedPlans">
          顺便检查同币种业务里有没有疑似下架套餐
        </el-checkbox>
      </el-form>
      <template #footer>
        <AppButton @click="officialCheckDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="checkingOfficialPrice" @click="checkOfficialPrice">
          生成对比
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  appleOfficialPricesApi,
  appleServicesApi,
  dataCenterApi,
  userTableViewsApi
} from '@/api/system';
import type { DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import {
  APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
  APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
  APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP,
  APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP,
  APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP,
  buildQuickSettingCode
} from '@/config/quickSettings';
import {
  notifyRealtimeScopesInvalidated,
  onRealtimeQueryInvalidated
} from '@/realtime/realtimeQueryEvents';
import type {
  AppleService,
  AppleBalancePriceRuleType,
  AppleOfficialPriceSource,
  AppleOfficialPriceSnapshot,
  ApplePriceChangeReview,
  DataDictionary,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  buildAppleAccountCurrencyOptions,
  formatAppleAccountRegionOptionLabel,
  mergeAppleAccountRegionOptions
} from '@/utils/appleAccountRegion';
import {
  buildAppleServiceExpireCalcTypeOptions,
  buildAppleServiceLockRuleOptions,
  buildAppleServicePeriodTypeOptions,
  getAppleServiceLockRuleLabel as getConfiguredLockRuleLabel,
  getAppleServicePeriodTypeLabel
} from '@/utils/appleServiceOptions';
import { createSmartQueryKey, invalidateSmartQueries, refreshSmartQuery } from '@/utils/smartQuery';

const tableKey = 'apple_services';
const APPLE_SERVICES_SCOPE = 'apple-services';
const APPLE_OFFICIAL_PRICE_SCOPE = 'apple-official-prices';
const ORDER_ENTRY_BASE_SCOPE = 'order-entry-base';
const APPLE_SERVICE_DEPENDENT_SCOPES = [APPLE_SERVICES_SCOPE, ORDER_ENTRY_BASE_SCOPE];
const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '暂停', value: 'paused' },
  { label: '停用', value: 'disabled' }
];
const serviceColumnOptions = [
  { label: '业务', value: 'name', required: true },
  { label: '分类', value: 'category' },
  { label: '官网价', value: 'officialBasePrice' },
  { label: 'Apple余额价', value: 'officialCostValue' },
  { label: '周期', value: 'period' },
  { label: '锁定规则', value: 'lockRule' },
  { label: '允许地区', value: 'allowedRegions' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];
const officialProviderOptions = [
  { label: 'ChatGPT / OpenAI', value: 'chatgpt' },
  { label: 'Gemini / Google', value: 'gemini' },
  { label: 'Claude / Anthropic', value: 'claude' },
  { label: '自定义', value: 'custom' }
];
const balanceRuleOptions: Array<{ label: string; value: AppleBalancePriceRuleType }> = [
  { label: '继承全局规则', value: 'inherit' },
  { label: '按百分比', value: 'percent' },
  { label: '固定加价', value: 'fixed_add' },
  { label: '手动填写', value: 'manual' }
];

const loading = ref(false);
const saving = ref(false);
const officialPriceLoading = ref(false);
const savingOfficialSource = ref(false);
const checkingOfficialPrice = ref(false);
const savingBalanceRule = ref(false);
const officialSourceCheckId = ref('');
const dialogVisible = ref(false);
const officialSourceDialogVisible = ref(false);
const officialCheckDialogVisible = ref(false);
const editingService = ref<AppleService | null>(null);
const selectedService = ref<AppleService | null>(null);
const editingOfficialSource = ref<AppleOfficialPriceSource | null>(null);
const formRef = ref<FormInstance>();
const services = ref<AppleService[]>([]);
const selectedServices = ref<AppleService[]>([]);
const officialPriceSources = ref<AppleOfficialPriceSource[]>([]);
const officialPriceReviews = ref<ApplePriceChangeReview[]>([]);
const officialPriceSnapshots = ref<AppleOfficialPriceSnapshot[]>([]);
const appleRegionDictionaries = ref<DataDictionary[]>([]);
const serviceCategoryDictionaries = ref<DataDictionary[]>([]);
const periodTypeDictionaries = ref<DataDictionary[]>([]);
const expireCalcTypeDictionaries = ref<DataDictionary[]>([]);
const lockRuleDictionaries = ref<DataDictionary[]>([]);
const knownServiceCategories = ref<string[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const serviceAdvancedPanels = ref<string[]>([]);
const officialPriceTab = ref('reviews');
const officialReviewActionId = ref('');

const globalBalanceRuleForm = reactive({
  ruleType: 'percent' as Extract<AppleBalancePriceRuleType, 'percent' | 'fixed_add'>,
  ruleValue: '1'
});

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  category: '',
  currency: ''
});

const form = reactive({
  name: '',
  category: '通用',
  defaultPrice: '0',
  officialBasePrice: '0',
  officialCostValue: '0',
  appleBalancePriceRuleType: 'inherit' as AppleBalancePriceRuleType,
  appleBalancePriceRuleValue: '',
  currency: 'USD',
  defaultPeriodType: 'month' as AppleService['defaultPeriodType'],
  defaultPeriodValue: 1,
  expireCalcType: 'by_month' as AppleService['expireCalcType'],
  requireAppleId: true,
  requireServiceAccount: false,
  autoMatchAppleId: true,
  lockRule: 'by_service' as AppleService['lockRule'],
  allowedRegions: [] as string[],
  minBalanceRequired: '0',
  status: 'enabled' as AppleService['status'],
  remark: ''
});

const officialSourceForm = reactive({
  name: '',
  provider: 'chatgpt',
  priceSourceType: 'official_web',
  region: 'US',
  currency: 'USD',
  sourceUrl: '',
  collectMethod: 'manual' as AppleOfficialPriceSource['collectMethod'],
  checkIntervalHours: 24,
  status: 'enabled' as AppleOfficialPriceSource['status'],
  remark: ''
});

const officialCheckForm = reactive({
  sourceId: '',
  appleServiceId: '',
  planCode: '',
  serviceName: '',
  category: '通用',
  region: 'US',
  currency: 'USD',
  officialPrice: '0',
  periodType: 'month' as AppleService['defaultPeriodType'],
  periodValue: 1,
  scanRemovedPlans: false
});

const rules: FormRules<typeof form> = {
  category: [{ required: true, message: '请选择或输入业务分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入业务名称', trigger: 'blur' }],
  officialBasePrice: [{ required: true, message: '请输入官网官方价格', trigger: 'blur' }],
  currency: [{ required: true, message: '请输入币种', trigger: 'blur' }]
};

const enabledCount = computed(
  () => services.value.filter((service) => service.status === 'enabled').length
);
const autoMatchCount = computed(
  () => services.value.filter((service) => service.autoMatchAppleId).length
);
const globalLockCount = computed(
  () => services.value.filter((service) => service.lockRule === 'global').length
);
const inactiveServiceCount = computed(
  () => services.value.filter((service) => service.status !== 'enabled').length
);
const byServiceLockCount = computed(
  () => services.value.filter((service) => service.lockRule === 'by_service').length
);
const serviceCategoryOptions = computed(() => {
  const categories = [
    ...serviceCategoryDictionaries.value.map((category) => category.label),
    ...knownServiceCategories.value,
    ...services.value.map((service) => service.category),
    query.category,
    form.category
  ]
    .map((category) => normalizeCategoryValue(category))
    .filter(Boolean);

  return [...new Set(categories)].sort((left, right) =>
    getCategoryLabel(left).localeCompare(getCategoryLabel(right), 'zh-CN')
  );
});
const appleRegionOptions = computed(() =>
  mergeAppleAccountRegionOptions(appleRegionDictionaries.value)
);
const appleCurrencyOptions = computed(() =>
  buildAppleAccountCurrencyOptions(appleRegionOptions.value)
);
const periodTypeOptions = computed(() =>
  buildAppleServicePeriodTypeOptions(periodTypeDictionaries.value)
);
const expireCalcTypeOptions = computed(() =>
  buildAppleServiceExpireCalcTypeOptions(expireCalcTypeDictionaries.value)
);
const lockRuleOptions = computed(() =>
  buildAppleServiceLockRuleOptions(lockRuleDictionaries.value)
);
const pendingOfficialReviews = computed(() =>
  officialPriceReviews.value.filter((review) => review.status === 'pending')
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (query.category) {
    chips.push({ key: 'category', label: '分类', value: getCategoryLabel(query.category) });
  }
  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }
  return chips;
});
const isBalanceRuleValueVisible = computed(
  () =>
    form.appleBalancePriceRuleType === 'percent' || form.appleBalancePriceRuleType === 'fixed_add'
);
const computedFormAppleBalancePrice = computed(() => {
  if (form.appleBalancePriceRuleType === 'manual') {
    return form.officialCostValue || '0';
  }

  return calculateAppleBalancePrice(
    form.officialBasePrice,
    form.appleBalancePriceRuleType,
    form.appleBalancePriceRuleValue
  );
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function formatDecimalText(value: number) {
  if (!Number.isFinite(value)) return '0';
  return value
    .toFixed(4)
    .replace(/\.?0+$/, '')
    .replace(/\.$/, '');
}

function parseDecimalText(value?: string | null) {
  const normalized = Number(String(value || '0').trim());
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

function calculateAppleBalancePrice(
  basePrice: string,
  ruleType: AppleBalancePriceRuleType,
  ruleValue?: string | null
) {
  const base = parseDecimalText(basePrice);
  const effectiveRuleType = ruleType === 'inherit' ? globalBalanceRuleForm.ruleType : ruleType;
  const effectiveRuleValue =
    ruleType === 'inherit' ? globalBalanceRuleForm.ruleValue : ruleValue || '0';

  if (effectiveRuleType === 'manual') {
    return formatDecimalText(base);
  }

  if (effectiveRuleType === 'fixed_add') {
    return formatDecimalText(base + parseDecimalText(effectiveRuleValue));
  }

  return formatDecimalText(base * parseDecimalText(effectiveRuleValue || '1'));
}

function getProviderLabel(provider?: string | null) {
  return (
    officialProviderOptions.find((option) => option.value === provider)?.label ||
    provider ||
    '自定义'
  );
}

function getBalanceRuleLabel(service: AppleService) {
  if (service.appleBalancePriceRuleType === 'manual') return '手动填写';
  if (service.appleBalancePriceRuleType === 'inherit') {
    return globalBalanceRuleForm.ruleType === 'percent'
      ? `继承全局 ${globalBalanceRuleForm.ruleValue} 倍`
      : `继承全局 +${globalBalanceRuleForm.ruleValue}`;
  }
  if (service.appleBalancePriceRuleType === 'fixed_add') {
    return `官网价 +${service.appleBalancePriceRuleValue || '0'}`;
  }
  return `官网价 x ${service.appleBalancePriceRuleValue || '1'}`;
}

function getStatusLabel(status: AppleService['status']) {
  return { enabled: '启用', paused: '暂停', disabled: '停用' }[status] ?? status;
}

function getStatusTone(status: AppleService['status']) {
  return status === 'enabled' ? 'green' : status === 'paused' ? 'orange' : 'neutral';
}

function getLockRuleLabel(rule: AppleService['lockRule']) {
  return getConfiguredLockRuleLabel(rule, lockRuleDictionaries.value);
}

function getPeriodLabel(type: AppleService['defaultPeriodType'], value: number) {
  if (type === 'manual') {
    return getAppleServicePeriodTypeLabel(type, periodTypeDictionaries.value);
  }

  return `${value}${type === 'month' ? '个月' : '天'}`;
}

function normalizeCategoryValue(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized === 'default') {
    return '通用';
  }
  return normalized;
}

function getCategoryLabel(category?: string | null) {
  return normalizeCategoryValue(category) || '通用';
}

function getDefaultCategory() {
  return query.category || serviceCategoryOptions.value[0] || '通用';
}

function syncKnownServiceCategories(items: AppleService[]) {
  const categories = [
    ...knownServiceCategories.value,
    ...items.map((service) => normalizeCategoryValue(service.category))
  ].filter(Boolean);
  knownServiceCategories.value = [...new Set(categories)];
}

function invalidateAppleServiceConsumers() {
  for (const scope of APPLE_SERVICE_DEPENDENT_SCOPES) {
    invalidateSmartQueries(scope);
  }
  notifyRealtimeScopesInvalidated(APPLE_SERVICE_DEPENDENT_SCOPES);
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadServices(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  if (!options.silent || !services.value.length) {
    loading.value = true;
  }
  try {
    const params = {
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      category: query.category || undefined,
      currency: query.currency || undefined,
      sortBy: sortConfig.value.prop,
      sortOrder: mapSortOrder(sortConfig.value.order)
    };
    const result = await refreshSmartQuery({
      key: createSmartQueryKey(APPLE_SERVICES_SCOPE, params),
      fetcher: () => appleServicesApi.list(params),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    services.value = result.data.items;
    syncKnownServiceCategories(result.data.items);
    total.value = result.data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 业务失败');
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadServices();
}

async function selectCategory(category: string) {
  query.category = category;
  query.page = 1;
  await loadServices({ force: true, dedupeMs: 0 });
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadServices();
}

function handleSelectionChange(rows: AppleService[]) {
  selectedServices.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.category = '';
  query.currency = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

async function clearFiltersAndSearch() {
  clearFilters();
  await loadServices();
}

function removeFilter(key: string) {
  if (key === 'category') {
    query.category = '';
  }
  if (key === 'currency') {
    query.currency = '';
  }
}

function exportList() {
  ElMessage.info('Apple ID 业务设置导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 业务视图', {
      inputValue: 'Apple ID 业务常用视图',
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
        category: query.category,
        currency: query.currency
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : serviceColumnOptions.map((column) => column.value),
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
  await loadServices();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isServiceStatus(filters.status) ? filters.status : '';
  query.category = typeof filters.category === 'string' ? filters.category : '';
  query.currency = typeof filters.currency === 'string' ? filters.currency : '';
  query.pageSize = view.pageSize;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        serviceColumnOptions.some((option) => option.value === column)
      )
    : serviceColumnOptions.map((column) => column.value);
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

function mapSortOrder(order?: 'ascending' | 'descending' | null): 'asc' | 'desc' | undefined {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isServiceStatus(value: unknown): value is AppleService['status'] | '' {
  return value === '' || value === 'enabled' || value === 'paused' || value === 'disabled';
}

async function initializePage() {
  await Promise.all([
    loadTableViews(true),
    loadAppleServiceCategories(),
    loadAppleRegions(),
    loadAppleServiceQuickOptions(),
    loadGlobalBalanceRule(),
    loadServices({ force: false }),
    loadOfficialPricePanel()
  ]);
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [APPLE_SERVICES_SCOPE, APPLE_OFFICIAL_PRICE_SCOPE, 'data-dictionaries'],
  () => {
    void loadServices({ silent: true, dedupeMs: 0 });
    void loadOfficialPricePanel();
    void loadGlobalBalanceRule();
    void loadAppleServiceCategories();
    void loadAppleRegions();
    void loadAppleServiceQuickOptions();
  }
);

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

async function loadAppleServiceCategories() {
  try {
    const data = await dataCenterApi.listDictionaries(buildAppleServiceCategoryParams());
    serviceCategoryDictionaries.value = data.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 业务分类失败');
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

function buildAppleServiceQuickOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadAppleServiceQuickOptions() {
  try {
    const [periodTypes, expireCalcTypes, lockRules] = await Promise.all([
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP)
      )
    ]);
    periodTypeDictionaries.value = periodTypes.items;
    expireCalcTypeDictionaries.value = expireCalcTypes.items;
    lockRuleDictionaries.value = lockRules.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 业务选项失败');
  }
}

async function ensureAppleServiceCategory(category: string) {
  const normalizedCategory = normalizeCategoryValue(category);
  const existing = serviceCategoryDictionaries.value.some(
    (item) => normalizeCategoryValue(item.label) === normalizedCategory
  );

  if (existing) {
    return;
  }

  const data = await dataCenterApi.listDictionaries({
    page: 1,
    pageSize: 50,
    group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
    keyword: normalizedCategory
  });
  const alreadyExists = data.items.some(
    (item) => normalizeCategoryValue(item.label) === normalizedCategory
  );

  if (alreadyExists) {
    return;
  }

  await dataCenterApi.createDictionary({
    group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
    code: buildQuickSettingCode(normalizedCategory, 'apple-service-category'),
    label: normalizedCategory,
    value: normalizedCategory,
    sortOrder: serviceCategoryDictionaries.value.length,
    status: 'active',
    remark: '在 Apple ID 业务设置里手动输入后自动加入快捷设置'
  });
  await loadAppleServiceCategories();
}

function getCollectMethodLabel(method: AppleOfficialPriceSource['collectMethod']) {
  return { manual: '手动录入', webpage: '网页采集', api: 'API 采集' }[method] ?? method;
}

function getOfficialSourceCheckLabel(source?: AppleOfficialPriceSource) {
  if (!source) return '录入本次价格';
  return source.collectMethod === 'manual' ? '录入价格' : '立即采集';
}

function getOfficialReviewTypeLabel(type: ApplePriceChangeReview['changeType']) {
  return (
    {
      price_changed: '价格变化',
      new_plan: '新套餐',
      removed_plan: '疑似下架',
      period_changed: '周期变化',
      currency_changed: '币种变化'
    }[type] ?? type
  );
}

function getOfficialReviewStatusLabel(status: ApplePriceChangeReview['status']) {
  return { pending: '待确认', approved: '已确认', ignored: '已忽略' }[status] ?? status;
}

function getOfficialReviewTone(type: ApplePriceChangeReview['changeType']) {
  if (type === 'new_plan') return 'purple';
  if (type === 'removed_plan') return 'red';
  if (type === 'price_changed') return 'orange';
  return 'blue';
}

function getReviewRecordValue(record: unknown, key: string) {
  if (!record || typeof record !== 'object') return '';
  const value = (record as Record<string, unknown>)[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

function getReviewValue(review: ApplePriceChangeReview, key: string) {
  return getReviewRecordValue(review.newValue, key) || '-';
}

function getReviewOldOfficialPrice(review: ApplePriceChangeReview) {
  const value =
    getReviewRecordValue(review.oldValue, 'officialBasePrice') ||
    getReviewRecordValue(review.oldValue, 'officialPrice');
  const currency = getReviewRecordValue(review.oldValue, 'currency');
  return value ? `${value} ${currency}` : '-';
}

function getReviewNewOfficialPrice(review: ApplePriceChangeReview) {
  const value =
    getReviewRecordValue(review.newValue, 'officialBasePrice') ||
    getReviewRecordValue(review.newValue, 'officialPrice');
  const currency = getReviewRecordValue(review.newValue, 'currency');
  return value ? `${value} ${currency}` : '-';
}

function getReviewOldAppleBalancePrice(review: ApplePriceChangeReview) {
  const value = getReviewRecordValue(review.oldValue, 'appleBalancePrice');
  const currency = getReviewRecordValue(review.oldValue, 'currency');
  return value ? `${value} ${currency}` : '-';
}

function getReviewNewAppleBalancePrice(review: ApplePriceChangeReview) {
  const value = getReviewRecordValue(review.newValue, 'appleBalancePrice');
  const currency = getReviewRecordValue(review.newValue, 'currency');
  return value ? `${value} ${currency}` : '-';
}

function getReviewOldPeriod(review: ApplePriceChangeReview) {
  return formatOfficialPeriod(
    getReviewRecordValue(review.oldValue, 'periodType'),
    getReviewRecordValue(review.oldValue, 'periodValue')
  );
}

function getReviewNewPeriod(review: ApplePriceChangeReview) {
  return formatOfficialPeriod(
    getReviewRecordValue(review.newValue, 'periodType'),
    getReviewRecordValue(review.newValue, 'periodValue')
  );
}

function formatOfficialPeriod(type: string, value: string) {
  if (!isApplePeriodType(type)) return '-';
  const periodValue = Number(value || 1);
  return getPeriodLabel(type, Number.isFinite(periodValue) ? periodValue : 1);
}

function isApplePeriodType(value: string): value is AppleService['defaultPeriodType'] {
  return value === 'month' || value === 'day' || value === 'manual';
}

async function loadGlobalBalanceRule() {
  try {
    const rule = await appleServicesApi.getBalancePriceRule();
    globalBalanceRuleForm.ruleType = rule.ruleType;
    globalBalanceRuleForm.ruleValue = rule.ruleValue;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple 余额价规则失败');
  }
}

async function saveGlobalBalanceRule() {
  if (!/^\d+(\.\d{1,8})?$/.test(globalBalanceRuleForm.ruleValue.trim())) {
    ElMessage.warning('请填写正确的规则数值');
    return;
  }

  savingBalanceRule.value = true;
  try {
    const rule = await appleServicesApi.updateBalancePriceRule({
      ruleType: globalBalanceRuleForm.ruleType,
      ruleValue: globalBalanceRuleForm.ruleValue
    });
    globalBalanceRuleForm.ruleType = rule.ruleType;
    globalBalanceRuleForm.ruleValue = rule.ruleValue;
    ElMessage.success('Apple 余额价全局规则已保存');
    invalidateAppleServiceConsumers();
    await loadServices({ force: true, dedupeMs: 0 });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple 余额价规则失败');
  } finally {
    savingBalanceRule.value = false;
  }
}

async function loadOfficialPricePanel() {
  officialPriceLoading.value = true;
  try {
    const [sources, reviews, snapshots] = await Promise.all([
      appleOfficialPricesApi.listSources({
        page: 1,
        pageSize: 100,
        status: ''
      }),
      appleOfficialPricesApi.listReviews({
        page: 1,
        pageSize: 100,
        status: '',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }),
      appleOfficialPricesApi.listSnapshots({
        page: 1,
        pageSize: 100,
        sortBy: 'collectedAt',
        sortOrder: 'desc'
      })
    ]);
    officialPriceSources.value = sources.items;
    officialPriceReviews.value = reviews.items;
    officialPriceSnapshots.value = snapshots.items;
    if (!officialCheckForm.sourceId && sources.items.length) {
      officialCheckForm.sourceId = sources.items[0].id;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载官方价格巡检失败');
  } finally {
    officialPriceLoading.value = false;
  }
}

function resetOfficialSourceForm() {
  officialSourceForm.name = '';
  officialSourceForm.provider = 'chatgpt';
  officialSourceForm.priceSourceType = 'official_web';
  officialSourceForm.region = 'US';
  officialSourceForm.currency = 'USD';
  officialSourceForm.sourceUrl = '';
  officialSourceForm.collectMethod = 'manual';
  officialSourceForm.checkIntervalHours = 24;
  officialSourceForm.status = 'enabled';
  officialSourceForm.remark = '';
}

function openCreateOfficialSource() {
  editingOfficialSource.value = null;
  resetOfficialSourceForm();
  officialSourceDialogVisible.value = true;
}

function openEditOfficialSource(source: AppleOfficialPriceSource) {
  editingOfficialSource.value = source;
  officialSourceForm.name = source.name;
  officialSourceForm.provider = source.provider || 'custom';
  officialSourceForm.priceSourceType = source.priceSourceType || 'official_web';
  officialSourceForm.region = source.region;
  officialSourceForm.currency = source.currency;
  officialSourceForm.sourceUrl = source.sourceUrl ?? '';
  officialSourceForm.collectMethod = source.collectMethod;
  officialSourceForm.checkIntervalHours = source.checkIntervalHours;
  officialSourceForm.status = source.status;
  officialSourceForm.remark = source.remark ?? '';
  officialSourceDialogVisible.value = true;
}

async function saveOfficialSource() {
  if (!officialSourceForm.name.trim()) {
    ElMessage.warning('请填写来源名称');
    return;
  }
  if (!officialSourceForm.region.trim() || !officialSourceForm.currency.trim()) {
    ElMessage.warning('请填写地区和币种');
    return;
  }

  savingOfficialSource.value = true;
  try {
    const payload = {
      name: officialSourceForm.name,
      provider: officialSourceForm.provider,
      priceSourceType: officialSourceForm.priceSourceType,
      region: officialSourceForm.region,
      currency: officialSourceForm.currency,
      sourceUrl: officialSourceForm.sourceUrl || null,
      collectMethod: officialSourceForm.collectMethod,
      checkIntervalHours: officialSourceForm.checkIntervalHours,
      status: officialSourceForm.status,
      remark: officialSourceForm.remark || null
    };

    if (editingOfficialSource.value) {
      await appleOfficialPricesApi.updateSource(editingOfficialSource.value.id, payload);
    } else {
      await appleOfficialPricesApi.createSource(payload);
    }

    ElMessage.success('官方价格来源已保存');
    officialSourceDialogVisible.value = false;
    await loadOfficialPricePanel();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存官方价格来源失败');
  } finally {
    savingOfficialSource.value = false;
  }
}

async function removeOfficialSource(source: AppleOfficialPriceSource) {
  try {
    await ElMessageBox.confirm(`确认删除官方来源「${source.name}」？`, '删除官方来源', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
    await appleOfficialPricesApi.removeSource(source.id);
    ElMessage.success('官方来源已删除');
    await loadOfficialPricePanel();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除官方来源失败');
    }
  }
}

function openOfficialCheckDialog(source?: AppleOfficialPriceSource) {
  const selectedSource = source ?? officialPriceSources.value[0];
  officialCheckForm.sourceId = selectedSource?.id ?? '';
  officialCheckForm.appleServiceId = '';
  officialCheckForm.planCode = '';
  officialCheckForm.serviceName = '';
  officialCheckForm.category = selectedSource?.provider ?? '通用';
  officialCheckForm.region = selectedSource?.region ?? 'US';
  officialCheckForm.currency = selectedSource?.currency ?? 'USD';
  officialCheckForm.officialPrice = '0';
  officialCheckForm.periodType = periodTypeOptions.value[0]?.value ?? 'month';
  officialCheckForm.periodValue = 1;
  officialCheckForm.scanRemovedPlans = false;
  officialCheckDialogVisible.value = true;
}

async function handleOfficialSourceCheck(source?: AppleOfficialPriceSource) {
  if (!source) return;
  if (source.collectMethod === 'manual') {
    openOfficialCheckDialog(source);
    return;
  }

  officialSourceCheckId.value = source.id;
  try {
    const result = await appleOfficialPricesApi.checkSource(source.id, {
      trigger: 'manual',
      scanRemovedPlans: false
    });
    if (result.status === 'manual_required') {
      ElMessage.warning(result.message || '没有采集到可用价格，已转人工确认');
      officialPriceTab.value = 'sources';
    } else {
      ElMessage.success(result.message || '官方价格已采集');
      officialPriceTab.value = result.reviewCount > 0 ? 'reviews' : 'snapshots';
    }
    await loadOfficialPricePanel();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '采集官方价格失败');
  } finally {
    officialSourceCheckId.value = '';
  }
}

function syncOfficialCheckService() {
  const service = services.value.find((item) => item.id === officialCheckForm.appleServiceId);
  if (!service) return;
  officialCheckForm.serviceName = service.name;
  officialCheckForm.category = service.category;
  officialCheckForm.currency = service.currency;
  officialCheckForm.officialPrice = service.officialBasePrice;
  officialCheckForm.periodType = service.defaultPeriodType;
  officialCheckForm.periodValue = service.defaultPeriodValue;
}

async function checkOfficialPrice() {
  if (!officialCheckForm.sourceId) {
    ElMessage.warning('请先选择官方来源');
    return;
  }
  if (!officialCheckForm.serviceName.trim()) {
    ElMessage.warning('请填写官方套餐名');
    return;
  }
  if (!officialCheckForm.officialPrice.trim()) {
    ElMessage.warning('请填写官方价格');
    return;
  }

  checkingOfficialPrice.value = true;
  try {
    const result = await appleOfficialPricesApi.checkSource(officialCheckForm.sourceId, {
      trigger: 'manual',
      scanRemovedPlans: officialCheckForm.scanRemovedPlans,
      items: [
        {
          appleServiceId: officialCheckForm.appleServiceId || null,
          planCode: officialCheckForm.planCode || null,
          serviceName: officialCheckForm.serviceName,
          category: officialCheckForm.category || '通用',
          region: officialCheckForm.region,
          currency: officialCheckForm.currency,
          officialPrice: officialCheckForm.officialPrice,
          periodType: officialCheckForm.periodType,
          periodValue: officialCheckForm.periodValue
        }
      ]
    });
    ElMessage.success(result.message || '官方价格对比已生成');
    officialCheckDialogVisible.value = false;
    officialPriceTab.value = result.reviewCount > 0 ? 'reviews' : 'snapshots';
    await loadOfficialPricePanel();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成官方价格对比失败');
  } finally {
    checkingOfficialPrice.value = false;
  }
}

async function approveOfficialReview(review: ApplePriceChangeReview) {
  try {
    await ElMessageBox.confirm(
      '确认后会同步 Apple ID 业务设置里的官网价、币种和周期，并按规则重算 Apple 余额价。新套餐会先创建为暂停状态。',
      '确认官方价格变化',
      {
        type: 'warning',
        confirmButtonText: '确认同步',
        cancelButtonText: '返回'
      }
    );
    officialReviewActionId.value = review.id;
    await appleOfficialPricesApi.approveReview(review.id);
    ElMessage.success('已同步到 Apple ID 业务设置');
    invalidateAppleServiceConsumers();
    await Promise.all([loadOfficialPricePanel(), loadServices({ force: true, dedupeMs: 0 })]);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '确认官方价格变化失败');
    }
  } finally {
    officialReviewActionId.value = '';
  }
}

async function ignoreOfficialReview(review: ApplePriceChangeReview) {
  try {
    const { value } = await ElMessageBox.prompt('请输入忽略原因，可留空', '忽略官方价格变化', {
      inputType: 'textarea',
      confirmButtonText: '忽略',
      cancelButtonText: '返回'
    });
    officialReviewActionId.value = review.id;
    await appleOfficialPricesApi.ignoreReview(review.id, value || null);
    ElMessage.success('已忽略这条变化');
    await loadOfficialPricePanel();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '忽略官方价格变化失败');
    }
  } finally {
    officialReviewActionId.value = '';
  }
}

function resetForm() {
  form.name = '';
  form.category = getDefaultCategory();
  form.defaultPrice = '0';
  form.officialBasePrice = '0';
  form.officialCostValue = '0';
  form.appleBalancePriceRuleType = 'inherit';
  form.appleBalancePriceRuleValue = '';
  form.currency = 'USD';
  form.defaultPeriodType = periodTypeOptions.value[0]?.value ?? 'month';
  form.defaultPeriodValue = 1;
  form.expireCalcType = expireCalcTypeOptions.value[0]?.value ?? 'by_month';
  form.requireAppleId = true;
  form.requireServiceAccount = false;
  form.autoMatchAppleId = true;
  form.lockRule = lockRuleOptions.value[0]?.value ?? 'by_service';
  form.allowedRegions = [];
  form.minBalanceRequired = '0';
  form.status = 'enabled';
  form.remark = '';
  serviceAdvancedPanels.value = [];
}

function openCreate() {
  editingService.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(service: AppleService) {
  editingService.value = service;
  form.name = service.name;
  form.category = normalizeCategoryValue(service.category);
  form.defaultPrice = service.defaultPrice;
  form.officialBasePrice = service.officialBasePrice;
  form.officialCostValue = service.officialCostValue;
  form.appleBalancePriceRuleType = service.appleBalancePriceRuleType;
  form.appleBalancePriceRuleValue = service.appleBalancePriceRuleValue ?? '';
  form.currency = service.currency;
  form.defaultPeriodType = service.defaultPeriodType;
  form.defaultPeriodValue = service.defaultPeriodValue;
  form.expireCalcType = service.expireCalcType;
  form.requireAppleId = service.requireAppleId;
  form.requireServiceAccount = service.requireServiceAccount;
  form.autoMatchAppleId = service.autoMatchAppleId;
  form.lockRule = service.lockRule;
  form.allowedRegions = [...service.allowedRegions];
  form.minBalanceRequired = service.minBalanceRequired;
  form.status = service.status;
  form.remark = service.remark ?? '';
  serviceAdvancedPanels.value = [];
  dialogVisible.value = true;
}

async function saveService() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  if (isBalanceRuleValueVisible.value && !form.appleBalancePriceRuleValue.trim()) {
    ElMessage.warning('请填写 Apple余额价规则数值');
    return;
  }
  if (form.appleBalancePriceRuleType === 'manual' && !form.officialCostValue.trim()) {
    ElMessage.warning('请填写 Apple余额消耗金额');
    return;
  }

  saving.value = true;
  try {
    const category = normalizeCategoryValue(form.category);
    await ensureAppleServiceCategory(category);
    const payload = {
      name: form.name,
      category,
      defaultPrice: '0',
      officialBasePrice: form.officialBasePrice,
      officialCostValue:
        form.appleBalancePriceRuleType === 'manual'
          ? form.officialCostValue
          : computedFormAppleBalancePrice.value,
      appleBalancePriceRuleType: form.appleBalancePriceRuleType,
      appleBalancePriceRuleValue: isBalanceRuleValueVisible.value
        ? form.appleBalancePriceRuleValue
        : null,
      currency: form.currency,
      defaultPeriodType: form.defaultPeriodType,
      defaultPeriodValue: form.defaultPeriodValue,
      expireCalcType: form.expireCalcType,
      requireAppleId: form.requireAppleId,
      requireServiceAccount: form.requireServiceAccount,
      autoMatchAppleId: form.autoMatchAppleId,
      lockRule: form.lockRule,
      allowedRegions: form.allowedRegions,
      minBalanceRequired: form.minBalanceRequired,
      status: form.status,
      remark: form.remark || null
    };

    if (editingService.value) {
      await appleServicesApi.update(editingService.value.id, payload);
    } else {
      await appleServicesApi.create(payload);
    }

    ElMessage.success('Apple ID 业务已保存');
    invalidateAppleServiceConsumers();
    dialogVisible.value = false;
    await loadServices({ force: true, dedupeMs: 0 });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 业务失败');
  } finally {
    saving.value = false;
  }
}

onMounted(initializePage);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});
</script>

<style scoped>
.apple-service-category-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0 16px;
}

.apple-service-form-section {
  margin: 4px 0 14px;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
}

.apple-service-period-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px;
  gap: 8px;
}

.apple-service-advanced {
  margin: 4px 0 16px;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}

.apple-official-price-panel {
  margin-top: 16px;
}

.apple-balance-rule-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0 6px;
}

.apple-balance-rule-bar strong,
.apple-balance-rule-bar span {
  display: block;
}

.apple-balance-rule-bar span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.apple-balance-rule-bar__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.apple-rule-select {
  width: 132px;
}

.apple-rule-input {
  width: 140px;
}

.apple-official-price-tabs {
  margin-top: 10px;
}

.apple-official-price-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

@media (max-width: 720px) {
  .apple-service-period-row {
    grid-template-columns: 1fr;
  }

  .apple-balance-rule-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .apple-balance-rule-bar__controls,
  .apple-rule-select,
  .apple-rule-input {
    width: 100%;
  }
}
</style>
