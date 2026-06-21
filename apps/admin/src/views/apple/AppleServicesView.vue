<template>
  <PageScaffold
    title="Apple ID 业务设置"
    group="Apple ID 业务"
    phase="Phase 4"
    description="维护业务售价、官方消耗金额、币种、周期、允许地区和 Apple ID 锁定规则。"
  >
    <section class="content-panel apple-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="业务与锁定规则"
          help="这里维护代充业务的售价、官方消耗、周期、自动匹配和 Apple ID 锁定策略。它只管 Apple ID 代充，不和兑换码业务混用。"
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
          <StatusChip tone="cyan">映射 {{ mappingCountLabel }}</StatusChip>
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
          v-if="isColumnVisible('defaultPrice')"
          prop="defaultPrice"
          label="售价"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.defaultPrice }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('officialCostValue')"
          prop="officialCostValue"
          label="消耗"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.officialCostValue }} {{ row.currency }}</template>
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
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton variant="ghost" @click="openMappings(row)">平台映射</AppButton>
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
              <span>售价</span>
              <strong>{{ service.defaultPrice }}</strong>
            </div>
            <div>
              <span>官方消耗</span>
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
            <AppButton size="small" variant="ghost" @click="openMappings(service)">
              平台映射
            </AppButton>
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
                  {{ row.source?.name || '-' }} · {{ getReviewValue(row, 'region') }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="系统当前" min-width="170">
              <template #default="{ row }">
                {{ getReviewOldOfficialPrice(row) }}
                <div class="muted-block">{{ getReviewOldPeriod(row) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="官方最新" min-width="170">
              <template #default="{ row }">
                {{ getReviewNewOfficialPrice(row) }}
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
                <div class="muted-block">{{ row.sourceUrl || '未填写官方地址' }}</div>
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
                <div class="muted-block">{{ row.source?.name || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="地区/币种" width="130">
              <template #default="{ row }">{{ row.region }} / {{ row.currency }}</template>
            </el-table-column>
            <el-table-column label="官方价格" width="130">
              <template #default="{ row }">{{ row.officialPrice }}</template>
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
          <el-form-item prop="defaultPrice">
            <template #label>
              <FieldHelpLabel
                label="客户售价"
                purpose="这个业务默认卖给客户多少钱，录订单时会优先带出。"
                example="平时卖 20 元就填 20；单个订单有优惠时录单页再单独改。"
              />
            </template>
            <el-input v-model.trim="form.defaultPrice" />
          </el-form-item>
          <el-form-item prop="officialCostValue">
            <template #label>
              <FieldHelpLabel
                label="Apple 官方消耗金额"
                purpose="开通这个业务通常会扣掉多少 Apple ID 外币余额，用来匹配账号和计算成本。"
                example="官方扣 9.99 美元就填 9.99；官方扣 20 港币就填 20。"
              />
            </template>
            <el-input v-model.trim="form.officialCostValue" />
          </el-form-item>
          <el-form-item prop="currency">
            <template #label>
              <FieldHelpLabel
                label="币种"
                purpose="说明官方消耗金额使用哪种外币，系统会优先匹配同币种 Apple ID。"
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
        </div>

        <div class="apple-service-form-section">默认规则</div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="业务周期"
                purpose="定义默认开通多久，用来辅助生成订单到期时间。"
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
                purpose="告诉系统提交订单后怎么自动计算到期时间。"
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

    <AppDrawer
      v-model="mappingDrawerVisible"
      :title="`平台映射 · ${selectedService?.name ?? ''}`"
      confirm-text="新增映射"
      size="860px"
      @confirm="openCreateMapping"
    >
      <div class="drawer-section drawer-section--flush">
        <div class="drawer-section__title">
          <span>来源平台商品/SKU 映射</span>
          <AppButton @click="loadMappings">刷新</AppButton>
        </div>

        <p class="drawer-section__description">
          用于后续平台订单同步时识别 Apple ID 业务，不和兑换码平台映射混用。
        </p>

        <el-table
          v-loading="mappingLoading"
          class="desktop-data-table"
          :data="mappings"
          row-key="id"
        >
          <el-table-column label="平台/店铺" min-width="170">
            <template #default="{ row }">
              {{ row.sourcePlatform.name }}
              <div class="muted-block">{{ row.shopName || row.sourcePlatform.name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="商品/SKU" min-width="190">
            <template #default="{ row }">
              {{ row.platformItemId }}
              <div class="muted-block">SKU {{ row.platformSkuId || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="关键词" min-width="160">
            <template #default="{ row }">{{ row.skuKeyword || '-' }}</template>
          </el-table-column>
          <el-table-column label="售价/手续费" min-width="160">
            <template #default="{ row }">
              {{ row.platformPrice }}
              <div class="muted-block">
                {{ getFeeTypeLabel(row.platformFeeType) }} {{ row.platformFeeValue }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="自动订单" width="100">
            <template #default="{ row }">
              <StatusChip :tone="row.allowAutoOrder ? 'green' : 'neutral'" dot>
                {{ row.allowAutoOrder ? '允许' : '关闭' }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <StatusChip :tone="row.enabled ? 'green' : 'neutral'" dot>
                {{ row.enabled ? '启用' : '停用' }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <div class="table-action-group">
                <AppButton variant="ghost" @click="openEditMapping(row)">编辑</AppButton>
                <AppButton variant="danger" @click="removeMapping(row)">删除</AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="mappings.length" class="mobile-record-list" aria-label="Apple 平台映射移动列表">
          <article v-for="mapping in mappings" :key="mapping.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ mapping.sourcePlatform.name }}</strong>
                <span>{{ mapping.shopName || mapping.sourcePlatform.name }}</span>
              </div>
              <StatusChip :tone="mapping.enabled ? 'green' : 'neutral'" dot>
                {{ mapping.enabled ? '启用' : '停用' }}
              </StatusChip>
            </div>
            <div class="mobile-record-card__meta">
              <div>
                <span>商品/SKU</span>
                <strong
                  >{{ mapping.platformItemId }} · SKU {{ mapping.platformSkuId || '-' }}</strong
                >
              </div>
              <div>
                <span>关键词</span>
                <strong>{{ mapping.skuKeyword || '-' }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>售价</span>
                <strong>{{ mapping.platformPrice }}</strong>
              </div>
              <div>
                <span>手续费</span>
                <strong>
                  {{ getFeeTypeLabel(mapping.platformFeeType) }} {{ mapping.platformFeeValue }}
                </strong>
              </div>
              <div>
                <span>自动订单</span>
                <strong>{{ mapping.allowAutoOrder ? '允许' : '关闭' }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__actions">
              <AppButton size="small" variant="ghost" @click="openEditMapping(mapping)">
                编辑
              </AppButton>
              <AppButton size="small" variant="danger" @click="removeMapping(mapping)">
                删除
              </AppButton>
            </div>
          </article>
        </div>
        <div
          v-else-if="!mappingLoading"
          class="mobile-record-list"
          aria-label="Apple 平台映射空状态"
        >
          <div class="apple-core-empty-state">
            <strong>暂无平台映射</strong>
            <span>新增映射后，平台订单可自动识别 Apple ID 业务。</span>
          </div>
        </div>
      </div>
    </AppDrawer>

    <el-dialog
      v-model="mappingDialogVisible"
      :title="editingMapping ? '编辑平台映射' : '新增平台映射'"
      width="min(720px, calc(100vw - 24px))"
    >
      <el-form ref="mappingFormRef" :model="mappingForm" :rules="mappingRules" label-position="top">
        <div class="form-grid">
          <el-form-item prop="sourcePlatformId">
            <template #label>
              <FieldHelpLabel
                label="来源平台"
                purpose="这条映射属于哪个销售平台，用来识别平台订单对应哪项 Apple ID 业务。"
                example="淘宝商品映射选淘宝，闲鱼商品映射选闲鱼。"
              />
            </template>
            <el-select
              v-model="mappingForm.sourcePlatformId"
              class="full-input"
              filterable
              placeholder="选择来源平台"
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
                label="店铺/账号名称"
                purpose="记录平台店铺、账号或渠道名称，方便多个店铺时区分来源。"
                example="可以填主店、闲鱼 1 号店、淘宝企业店。"
              />
            </template>
            <el-input v-model.trim="mappingForm.shopName" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="platformItemId">
            <template #label>
              <FieldHelpLabel
                label="平台商品 ID"
                purpose="平台商品的唯一编号，系统用它把外部订单匹配到这个业务。"
                example="淘宝填 itemId，闲鱼填商品 ID；从订单详情或平台后台复制。"
              />
            </template>
            <el-input v-model.trim="mappingForm.platformItemId" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="平台 SKU ID"
                purpose="同一个商品下不同规格的编号，用来区分月卡、季卡、不同套餐。"
                example="商品只有一个规格可留空；多个规格就填平台给的 SKU ID。"
              />
            </template>
            <el-input v-model.trim="mappingForm.platformSkuId" placeholder="没有 SKU 可留空" />
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="SKU 关键词"
              purpose="当平台没有稳定 SKU ID 时，用规格文字关键词辅助匹配。"
              example="可以填 GPT Plus 月卡、Claude Pro、1 个月；多个关键词尽量用订单里会出现的词。"
            />
          </template>
          <el-input
            v-model.trim="mappingForm.skuKeyword"
            placeholder="例如 GPT Plus 月卡 / Claude Pro"
          />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="平台售价"
                purpose="记录这个平台商品的标价，用于对账和判断订单金额是否异常。"
                example="平台标价 25 元就填 25；如果经常活动价，可按常用售价填写。"
              />
            </template>
            <el-input v-model.trim="mappingForm.platformPrice" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="手续费类型"
                purpose="说明平台手续费怎么计算，后续录单会用于利润估算。"
                example="只按比例抽成选比例；每单固定扣钱选固定；两种都有选比例 + 固定。"
              />
            </template>
            <el-select v-model="mappingForm.platformFeeType" class="full-input">
              <el-option
                v-for="option in platformFeeTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="手续费值"
                purpose="填写平台手续费对应的比例或固定金额。"
                example="比例 1% 填 0.01；固定每单 0.5 元填 0.5；混合规则按系统约定填写。"
              />
            </template>
            <el-input v-model.trim="mappingForm.platformFeeValue" />
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="开关"
              purpose="控制这条平台映射是否启用，以及是否允许平台订单自动生成 Apple ID 订单。"
              example="确认商品映射准确后再勾允许自动生成；暂时不用就取消启用映射。"
            />
          </template>
          <el-checkbox v-model="mappingForm.allowAutoOrder">允许自动生成 Apple ID 订单</el-checkbox>
          <el-checkbox v-model="mappingForm.enabled">启用映射</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="mappingDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="savingMapping" @click="saveMapping">
          保存映射
        </AppButton>
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
          <el-form-item required label="地区">
            <el-input v-model.trim="officialSourceForm.region" placeholder="US" />
          </el-form-item>
          <el-form-item required label="币种">
            <el-input v-model.trim="officialSourceForm.currency" placeholder="USD" />
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
          <el-form-item label="分类">
            <el-input v-model.trim="officialCheckForm.category" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item required label="官方价格">
            <el-input v-model.trim="officialCheckForm.officialPrice" placeholder="例如 9.99" />
          </el-form-item>
          <el-form-item required label="币种">
            <el-input v-model.trim="officialCheckForm.currency" />
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
import AppDrawer from '@/components/ui/AppDrawer.vue';
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
  APPLE_SERVICE_PLATFORM_FEE_TYPE_DICTIONARY_GROUP,
  buildQuickSettingCode
} from '@/config/quickSettings';
import {
  notifyRealtimeScopesInvalidated,
  onRealtimeQueryInvalidated
} from '@/realtime/realtimeQueryEvents';
import type {
  AppleService,
  AppleServicePlatformMapping,
  AppleOfficialPriceSource,
  AppleOfficialPriceSnapshot,
  ApplePriceChangeReview,
  DataDictionary,
  SourcePlatform,
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
  buildAppleServicePlatformFeeTypeOptions,
  getAppleServiceLockRuleLabel as getConfiguredLockRuleLabel,
  getAppleServicePeriodTypeLabel,
  getAppleServicePlatformFeeTypeLabel as getConfiguredPlatformFeeTypeLabel
} from '@/utils/appleServiceOptions';
import { createSmartQueryKey, invalidateSmartQueries, refreshSmartQuery } from '@/utils/smartQuery';
import { loadSmartSourcePlatforms } from '@/utils/smartSystemQueries';

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
  { label: '售价', value: 'defaultPrice' },
  { label: '消耗', value: 'officialCostValue' },
  { label: '周期', value: 'period' },
  { label: '锁定规则', value: 'lockRule' },
  { label: '允许地区', value: 'allowedRegions' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const mappingLoading = ref(false);
const savingMapping = ref(false);
const officialPriceLoading = ref(false);
const savingOfficialSource = ref(false);
const checkingOfficialPrice = ref(false);
const officialSourceCheckId = ref('');
const dialogVisible = ref(false);
const mappingDrawerVisible = ref(false);
const mappingDialogVisible = ref(false);
const officialSourceDialogVisible = ref(false);
const officialCheckDialogVisible = ref(false);
const editingService = ref<AppleService | null>(null);
const selectedService = ref<AppleService | null>(null);
const editingMapping = ref<AppleServicePlatformMapping | null>(null);
const editingOfficialSource = ref<AppleOfficialPriceSource | null>(null);
const formRef = ref<FormInstance>();
const mappingFormRef = ref<FormInstance>();
const services = ref<AppleService[]>([]);
const selectedServices = ref<AppleService[]>([]);
const mappings = ref<AppleServicePlatformMapping[]>([]);
const officialPriceSources = ref<AppleOfficialPriceSource[]>([]);
const officialPriceReviews = ref<ApplePriceChangeReview[]>([]);
const officialPriceSnapshots = ref<AppleOfficialPriceSnapshot[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const appleRegionDictionaries = ref<DataDictionary[]>([]);
const serviceCategoryDictionaries = ref<DataDictionary[]>([]);
const periodTypeDictionaries = ref<DataDictionary[]>([]);
const expireCalcTypeDictionaries = ref<DataDictionary[]>([]);
const lockRuleDictionaries = ref<DataDictionary[]>([]);
const platformFeeTypeDictionaries = ref<DataDictionary[]>([]);
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
  officialCostValue: '0',
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

const mappingForm = reactive({
  sourcePlatformId: '',
  shopName: '',
  platformItemId: '',
  platformSkuId: '',
  skuKeyword: '',
  platformPrice: '0',
  platformFeeType: 'none' as AppleServicePlatformMapping['platformFeeType'],
  platformFeeValue: '0',
  allowAutoOrder: false,
  enabled: true
});

const officialSourceForm = reactive({
  name: '',
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
  defaultPrice: [{ required: true, message: '请输入默认售价', trigger: 'blur' }],
  officialCostValue: [{ required: true, message: '请输入官方消耗金额', trigger: 'blur' }],
  currency: [{ required: true, message: '请输入币种', trigger: 'blur' }]
};

const mappingRules: FormRules<typeof mappingForm> = {
  sourcePlatformId: [{ required: true, message: '请选择来源平台', trigger: 'change' }],
  platformItemId: [{ required: true, message: '请输入平台商品 ID', trigger: 'blur' }]
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
const platformFeeTypeOptions = computed(() =>
  buildAppleServicePlatformFeeTypeOptions(platformFeeTypeDictionaries.value)
);
const mappingCountLabel = computed(() =>
  selectedService.value ? String(mappings.value.length) : '-'
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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
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

function getFeeTypeLabel(type: AppleServicePlatformMapping['platformFeeType']) {
  return getConfiguredPlatformFeeTypeLabel(type, platformFeeTypeDictionaries.value);
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
    loadServices({ force: false }),
    loadOfficialPricePanel()
  ]);
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [APPLE_SERVICES_SCOPE, APPLE_OFFICIAL_PRICE_SCOPE, 'data-dictionaries'],
  () => {
    void loadServices({ silent: true, dedupeMs: 0 });
    void loadOfficialPricePanel();
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
    const [periodTypes, expireCalcTypes, lockRules, platformFeeTypes] = await Promise.all([
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildAppleServiceQuickOptionParams(APPLE_SERVICE_PLATFORM_FEE_TYPE_DICTIONARY_GROUP)
      )
    ]);
    periodTypeDictionaries.value = periodTypes.items;
    expireCalcTypeDictionaries.value = expireCalcTypes.items;
    lockRuleDictionaries.value = lockRules.items;
    platformFeeTypeDictionaries.value = platformFeeTypes.items;
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

async function loadSourcePlatforms() {
  try {
    const data = await loadSmartSourcePlatforms({
      page: 1,
      pageSize: 100,
      status: 'active'
    });
    sourcePlatforms.value = data.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载来源平台失败');
  }
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
  const value = getReviewRecordValue(review.oldValue, 'officialPrice');
  const currency = getReviewRecordValue(review.oldValue, 'currency');
  return value ? `${value} ${currency}` : '-';
}

function getReviewNewOfficialPrice(review: ApplePriceChangeReview) {
  const value = getReviewRecordValue(review.newValue, 'officialPrice');
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
  officialCheckForm.serviceName = '';
  officialCheckForm.category = '通用';
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
  officialCheckForm.officialPrice = service.officialCostValue;
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
      '确认后会同步 Apple ID 业务设置里的官方消耗、币种和周期，新套餐会先创建为暂停状态。',
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
  form.officialCostValue = '0';
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
  form.officialCostValue = service.officialCostValue;
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

async function openMappings(service: AppleService) {
  selectedService.value = service;
  mappingDrawerVisible.value = true;
  await Promise.all([loadSourcePlatforms(), loadMappings()]);
}

async function loadMappings() {
  if (!selectedService.value) {
    return;
  }

  mappingLoading.value = true;
  try {
    const data = await appleServicesApi.listPlatformMappings(selectedService.value.id);
    mappings.value = data.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载平台映射失败');
  } finally {
    mappingLoading.value = false;
  }
}

function resetMappingForm() {
  mappingForm.sourcePlatformId = sourcePlatforms.value[0]?.id ?? '';
  mappingForm.shopName = '';
  mappingForm.platformItemId = '';
  mappingForm.platformSkuId = '';
  mappingForm.skuKeyword = '';
  mappingForm.platformPrice = selectedService.value?.defaultPrice ?? '0';
  mappingForm.platformFeeType = platformFeeTypeOptions.value[0]?.value ?? 'none';
  mappingForm.platformFeeValue = '0';
  mappingForm.allowAutoOrder = false;
  mappingForm.enabled = true;
}

async function openCreateMapping() {
  if (!selectedService.value) {
    return;
  }

  if (!sourcePlatforms.value.length) {
    await loadSourcePlatforms();
  }

  editingMapping.value = null;
  resetMappingForm();
  mappingDialogVisible.value = true;
}

function openEditMapping(mapping: AppleServicePlatformMapping) {
  editingMapping.value = mapping;
  mappingForm.sourcePlatformId = mapping.sourcePlatformId;
  mappingForm.shopName = mapping.shopName ?? '';
  mappingForm.platformItemId = mapping.platformItemId;
  mappingForm.platformSkuId = mapping.platformSkuId;
  mappingForm.skuKeyword = mapping.skuKeyword ?? '';
  mappingForm.platformPrice = mapping.platformPrice;
  mappingForm.platformFeeType = mapping.platformFeeType;
  mappingForm.platformFeeValue = mapping.platformFeeValue;
  mappingForm.allowAutoOrder = mapping.allowAutoOrder;
  mappingForm.enabled = mapping.enabled;
  mappingDialogVisible.value = true;
}

async function saveService() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const category = normalizeCategoryValue(form.category);
    await ensureAppleServiceCategory(category);
    const payload = {
      name: form.name,
      category,
      defaultPrice: form.defaultPrice,
      officialCostValue: form.officialCostValue,
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

async function saveMapping() {
  const valid = await mappingFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedService.value) {
    return;
  }

  savingMapping.value = true;
  try {
    const payload = {
      sourcePlatformId: mappingForm.sourcePlatformId,
      shopName: mappingForm.shopName || null,
      platformItemId: mappingForm.platformItemId,
      platformSkuId: mappingForm.platformSkuId || null,
      skuKeyword: mappingForm.skuKeyword || null,
      platformPrice: mappingForm.platformPrice,
      platformFeeType: mappingForm.platformFeeType,
      platformFeeValue: mappingForm.platformFeeValue,
      allowAutoOrder: mappingForm.allowAutoOrder,
      enabled: mappingForm.enabled
    };

    if (editingMapping.value) {
      await appleServicesApi.updatePlatformMapping(editingMapping.value.id, payload);
    } else {
      await appleServicesApi.createPlatformMapping(selectedService.value.id, payload);
    }

    ElMessage.success('平台映射已保存');
    mappingDialogVisible.value = false;
    await loadMappings();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存平台映射失败');
  } finally {
    savingMapping.value = false;
  }
}

async function removeMapping(mapping: AppleServicePlatformMapping) {
  try {
    await ElMessageBox.confirm(
      `确认删除 ${mapping.sourcePlatform.name} / ${mapping.platformItemId} 的映射？`,
      '删除平台映射',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );
    await appleServicesApi.removePlatformMapping(mapping.id);
    ElMessage.success('平台映射已删除');
    await loadMappings();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除平台映射失败');
    }
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
}
</style>
