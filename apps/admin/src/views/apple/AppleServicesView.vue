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
              v-for="category in activeServiceCategoryDictionaries"
              :key="category.id"
              :label="getCategoryLabel(category.label)"
              :value="getCategoryOptionValue(category)"
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
          v-for="category in activeServiceCategoryDictionaries"
          :key="category.id"
          size="small"
          :variant="query.category === getCategoryOptionValue(category) ? 'primary' : 'soft'"
          @click="selectCategory(getCategoryOptionValue(category))"
        >
          {{ getCategoryLabel(category.label) }}
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
          v-if="isColumnVisible('primaryRegion')"
          label="国家"
          min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="apple-service-country-cell">{{ getServiceCountryLabel(row) }}</span>
          </template>
        </el-table-column>
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
              {{ formatServiceRegionLabel(region) }}
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
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton variant="danger" @click="removeService(row)">删除</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="services.length" class="mobile-record-list" aria-label="Apple ID 业务移动列表">
        <article v-for="service in services" :key="service.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ service.name }}</strong>
              <span>
                {{ getServiceCountryLabel(service) }} · {{ getCategoryLabel(service.category) }} ·
                {{ service.currency }}
              </span>
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
                  {{ formatServiceRegionLabel(region) }}
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
            <AppButton size="small" variant="danger" @click="removeService(service)">
              删除
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

    <section ref="officialPricePanelRef" class="content-panel apple-official-price-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="官方价格巡检"
          help="这里用来定期检查官方价格和套餐有没有变。系统只会先生成待确认变化，不会自动改你的业务价格，确认后才同步。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>来源 {{ officialSourceTotal }}</StatusChip>
          <StatusChip :tone="pendingOfficialReviews.length ? 'orange' : 'green'" dot>
            待确认 {{ pendingOfficialReviews.length }}
          </StatusChip>
          <StatusChip tone="purple">快照 {{ officialSnapshotTotal }}</StatusChip>
          <AppButton variant="soft" @click="() => loadOfficialPricePanel()">刷新</AppButton>
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

      <div class="apple-official-provider-runner">
        <div class="apple-official-provider-runner__label">
          <strong>自动采集</strong>
          <el-select
            v-model="selectedOfficialAutoRegions"
            class="apple-official-region-select"
            collapse-tags
            collapse-tags-tooltip
            multiple
            placeholder="采集地区"
          >
            <el-option
              v-for="region in officialAutoRegionOptions"
              :key="region.value"
              :label="region.label"
              :value="region.value"
            />
          </el-select>
        </div>
        <div class="apple-official-provider-runner__actions">
          <AppButton
            variant="danger"
            :disabled="officialBatchIsActive"
            :loading="officialProviderCheckKey === 'all'"
            @click="handleOfficialProviderCheck('all')"
          >
            {{ officialBatchIsActive ? '采集中' : '开始采集' }}
          </AppButton>
          <AppButton
            v-for="provider in officialAutoProviderOptions"
            :key="provider.value"
            variant="soft"
            :disabled="officialBatchIsActive"
            :loading="officialProviderCheckKey === provider.value"
            @click="handleOfficialProviderCheck(provider.value)"
          >
            采集 {{ provider.shortLabel }}
          </AppButton>
        </div>
        <span class="apple-official-provider-runner__hint">
          会按所选地区创建或复用官方来源，采集结果只进入待确认，不会直接覆盖业务价格。
        </span>
      </div>

      <div v-if="officialPriceBatch" class="apple-official-batch-panel">
        <div class="apple-official-batch-panel__header">
          <div>
            <strong>最新采集批次：{{ getOfficialBatchTitle(officialPriceBatch) }}</strong>
            <span>
              {{ getOfficialBatchTimeline(officialPriceBatch) }} ·
              {{ officialPriceBatch.message || '等待采集进度' }}
            </span>
          </div>
          <div class="inline-actions">
            <StatusChip :tone="getOfficialBatchStatusTone(officialPriceBatch.status)" dot>
              {{ getOfficialBatchStatusLabel(officialPriceBatch.status) }}
            </StatusChip>
            <AppButton size="small" variant="soft" @click="loadLatestOfficialPriceBatch">
              刷新进度
            </AppButton>
          </div>
        </div>
        <el-progress
          :percentage="officialBatchProgressPercent"
          :status="officialBatchProgressStatus"
          :stroke-width="10"
        />
        <div class="apple-official-batch-panel__stats">
          <StatusChip tone="blue">总数 {{ officialPriceBatch.totalCount }}</StatusChip>
          <StatusChip tone="blue">已完成 {{ officialPriceBatch.completedCount }}</StatusChip>
          <StatusChip tone="green">成功 {{ officialPriceBatch.successCount }}</StatusChip>
          <StatusChip tone="red">失败 {{ officialPriceBatch.failedCount }}</StatusChip>
          <StatusChip tone="orange">
            人工确认 {{ officialPriceBatch.manualRequiredCount }}
          </StatusChip>
          <StatusChip tone="purple">待确认变化 {{ officialPriceBatch.reviewCount }}</StatusChip>
        </div>
        <div v-if="officialBatchProblemItems.length" class="apple-official-batch-panel__problems">
          <div class="apple-official-batch-problem apple-official-batch-problem--summary">
            <StatusChip tone="orange" class="apple-official-batch-problem__status">
              异常 {{ officialBatchProblemItems.length }}
            </StatusChip>
            <span>这是最新批次里的异常项；采集失败和人工确认都在当前批次结果里看原因。</span>
            <AppButton size="small" variant="soft" @click="showOfficialBatchResults">
              查看全部
            </AppButton>
          </div>
          <div
            v-for="item in officialBatchProblemItems.slice(0, 5)"
            :key="item.id"
            class="apple-official-batch-problem"
          >
            <StatusChip
              :tone="item.status === 'failed' ? 'red' : 'orange'"
              class="apple-official-batch-problem__status"
            >
              {{ item.status === 'failed' ? '采集失败' : '人工确认' }}
            </StatusChip>
            <span>
              {{ getProviderLabel(item.provider) }} · {{ getOfficialBatchItemRegionLabel(item) }} ·
              {{ item.errorMessage || item.message || '暂无失败原因' }}
            </span>
          </div>
        </div>
      </div>

      <el-tabs
        v-model="officialPriceTab"
        class="apple-official-price-tabs"
        @tab-change="preserveWorkspaceScrollAfterOfficialTabChange"
      >
        <el-tab-pane label="历史待确认变化" name="reviews">
          <div class="apple-official-tab-note">
            <strong>历史待确认变化</strong>
            <span>
              这里汇总所有还没处理的价格变化，可能来自旧批次；本次采集跑了哪些国家、哪些失败，请看“当前批次结果”。
            </span>
          </div>
          <el-table
            v-loading="officialPriceLoading"
            class="desktop-data-table official-review-table"
            :data="officialPriceReviews"
            row-key="id"
            empty-text="暂无价格变化"
          >
            <el-table-column label="变化" width="120">
              <template #default="{ row }">
                <StatusChip :tone="getOfficialReviewTone(row.changeType)" dot>
                  {{ getOfficialReviewTypeLabel(row.changeType) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="业务/套餐" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <strong class="official-review-main">{{
                  getOfficialReviewServiceName(row)
                }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="国家/地区" width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="official-review-country">{{ getOfficialReviewRegionLabel(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="系统当前" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="official-review-price">{{ getReviewOldOfficialPrice(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="官方最新" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="official-review-price">{{ getReviewNewOfficialPrice(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <StatusChip :tone="row.status === 'pending' ? 'orange' : 'green'" dot>
                  {{ getOfficialReviewStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group official-review-actions">
                  <el-popover
                    placement="left"
                    trigger="hover"
                    :width="380"
                    popper-class="official-review-detail-popover"
                  >
                    <template #reference>
                      <AppButton size="small" variant="soft">详情</AppButton>
                    </template>
                    <div class="official-review-detail">
                      <strong>{{ getOfficialReviewServiceName(row) }}</strong>
                      <dl class="official-review-detail-list">
                        <div>
                          <dt>来源</dt>
                          <dd>{{ getOfficialReviewSourceSummary(row) }}</dd>
                        </div>
                        <div>
                          <dt>国家/地区</dt>
                          <dd>{{ getOfficialReviewRegionLabel(row) }}</dd>
                        </div>
                        <div>
                          <dt>系统当前</dt>
                          <dd>{{ getOfficialReviewOldSummary(row) }}</dd>
                        </div>
                        <div>
                          <dt>官方最新</dt>
                          <dd>{{ getOfficialReviewNewSummary(row) }}</dd>
                        </div>
                        <div>
                          <dt>采集时间</dt>
                          <dd>{{ formatDate(row.snapshot?.collectedAt) }}</dd>
                        </div>
                      </dl>
                    </div>
                  </el-popover>
                  <AppButton
                    v-if="row.status === 'pending'"
                    size="small"
                    variant="primary"
                    :loading="officialReviewActionId === row.id"
                    @click="approveOfficialReview(row)"
                  >
                    确认
                  </AppButton>
                  <AppButton
                    v-if="row.status === 'pending'"
                    size="small"
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
          <PaginationBar
            v-model:page="officialReviewQuery.page"
            v-model:page-size="officialReviewQuery.pageSize"
            :total="officialReviewTotal"
            @change="() => loadOfficialPricePanel({ preserveOptionCache: true })"
          />
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
              <template #default="{ row }">{{
                formatOfficialRegionCurrency(row.region, row.currency)
              }}</template>
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
          <PaginationBar
            v-model:page="officialSourceQuery.page"
            v-model:page-size="officialSourceQuery.pageSize"
            :total="officialSourceTotal"
            @change="() => loadOfficialPricePanel({ preserveOptionCache: true })"
          />
        </el-tab-pane>

        <el-tab-pane label="当前批次结果" name="batch-items">
          <div class="apple-official-tab-note">
            <strong>当前批次结果</strong>
            <span>
              这里只展示最新采集批次的来源、地区、状态和原因，避免和历史待确认变化混在一起看。
            </span>
          </div>
          <el-table
            v-loading="officialPriceLoading"
            class="desktop-data-table official-batch-items-table"
            :data="paginatedOfficialBatchItems"
            row-key="id"
            empty-text="暂无采集批次结果"
          >
            <el-table-column label="来源" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <strong>{{ getProviderLabel(row.provider) }}</strong>
                <div class="muted-block">{{ row.sourceName || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="地区/币种" width="150">
              <template #default="{ row }">{{ getOfficialBatchItemRegionLabel(row) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="130">
              <template #default="{ row }">
                <StatusChip :tone="getOfficialBatchItemStatusTone(row.status)" dot>
                  {{ getOfficialBatchItemStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="产出" width="150">
              <template #default="{ row }">
                快照 {{ row.snapshotCount }} / 待确认 {{ row.reviewCount }}
              </template>
            </el-table-column>
            <el-table-column label="原因/说明" min-width="300" show-overflow-tooltip>
              <template #default="{ row }">
                {{ getOfficialBatchItemMessage(row) }}
              </template>
            </el-table-column>
            <el-table-column label="完成时间" min-width="170">
              <template #default="{ row }">
                {{ formatDate(row.finishedAt || row.updatedAt || row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="officialBatchItemQuery.page"
            v-model:page-size="officialBatchItemQuery.pageSize"
            :total="officialBatchItems.length"
          />
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
              <template #default="{ row }">{{
                formatOfficialRegionCurrency(row.region, row.currency)
              }}</template>
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
          <PaginationBar
            v-model:page="officialSnapshotQuery.page"
            v-model:page-size="officialSnapshotQuery.pageSize"
            :total="officialSnapshotTotal"
            @change="() => loadOfficialPricePanel({ preserveOptionCache: true })"
          />
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
          <el-form-item prop="primaryRegion">
            <template #label>
              <FieldHelpLabel
                label="国家/地区"
                purpose="选择这个业务对应的 Apple ID 地区，系统会按地区带出币种，并同步到允许地区里。"
                example="美国区选 US/USD，马来西亚区选 MY/MYR，港区选 HK/HKD。"
              />
            </template>
            <el-select
              v-model="form.primaryRegion"
              class="full-input"
              filterable
              placeholder="从采集地区选择"
              @change="handlePrimaryRegionChange"
            >
              <el-option
                v-for="region in formOfficialCountryOptions"
                :key="region.value"
                :label="region.label"
                :value="region.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="category">
            <template #label>
              <FieldHelpLabel
                label="业务分类"
                purpose="把业务分组，订单录入时会按分类展示；分类统一到选项设置里的 Apple ID 业务分类维护。"
                example="先到 Apple ID 业务分类启用 ChatGPT、Claude、Gemini，再在这里选择。"
              />
            </template>
            <el-select
              v-model="form.category"
              class="full-input"
              filterable
              placeholder="请选择分类"
              @change="handleCategoryChange"
            >
              <el-option
                v-for="category in formServiceCategoryOptions"
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
            <el-select
              v-model="form.name"
              class="full-input"
              filterable
              allow-create
              default-first-option
              placeholder="从官方采集套餐选择，或输入新名称"
              @change="handleServiceNameSelect"
            >
              <el-option
                v-for="option in officialServiceNameOptions"
                :key="option.key"
                :label="getOfficialServiceNameOptionLabel(option)"
                :value="option.serviceName"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="officialBasePrice">
            <template #label>
              <FieldHelpLabel
                label="官网官方价格"
                purpose="官网公开显示的套餐价格；选择官方采集套餐后会自动带出来，也可以手动输入。"
                example="官网 Plus 月费 20 美元就选 20 USD；不同国家套餐按对应币种选择。"
              />
            </template>
            <el-select
              v-model="form.officialBasePrice"
              class="full-input"
              filterable
              allow-create
              default-first-option
              placeholder="从官方采集价格选择，或输入金额"
              @change="handleOfficialBasePriceSelect"
            >
              <el-option
                v-for="option in officialPriceValueOptions"
                :key="option.key"
                :label="getOfficialPriceValueOptionLabel(option)"
                :value="option.officialPrice"
              />
            </el-select>
          </el-form-item>
        </div>
        <div class="form-grid">
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
                purpose="订单录入会按这个周期自动填到期时间，开通当天算第 1 天。"
                example="5 月 8 日开通 1 个月，到期日填 6 月 7 日；7 天业务到期日填第 7 天。"
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
                purpose="决定订单录入按月、按天，还是不自动计算到期时间；按月和按天都含开通当天。"
                example="自然月订阅选按月，固定天数商品选按天；系统会先加周期再减 1 天。"
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
              :label="`${source.name} · ${formatOfficialRegionCurrency(source.region, source.currency)}`"
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
          生成价格对比
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue';
import {
  appleOfficialPricesApi,
  appleServicesApi,
  dataCenterApi,
  userTableViewsApi
} from '@/api/system';
import type { AppleOfficialPriceProviderCatalogRegion, DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { useAuthenticatedPageLoader } from '@/composables/useAuthenticatedPageLoader';
import {
  APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
  APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
  APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP,
  APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP,
  APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP
} from '@/config/quickSettings';
import {
  notifyRealtimeScopesInvalidated,
  onRealtimeQueryInvalidated
} from '@/realtime/realtimeQueryEvents';
import type {
  AppleService,
  AppleBalancePriceRuleType,
  AppleOfficialPriceCheckBatch,
  AppleOfficialPriceSource,
  AppleOfficialPriceSnapshot,
  ApplePriceChangeReview,
  DataDictionary,
  PageResult,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  buildAppleAccountCurrencyOptions,
  formatAppleAccountRegionOptionLabel,
  formatAppleRegionCurrencyLabel as formatSharedAppleRegionCurrencyLabel,
  formatAppleRegionLabel as formatSharedAppleRegionLabel,
  formatAppleRegionListLabel as formatSharedAppleRegionListLabel,
  mergeAppleAccountRegionOptions
} from '@/utils/appleAccountRegion';
import {
  buildAppleServiceExpireCalcTypeOptions,
  buildAppleServiceLockRuleOptions,
  buildAppleServicePeriodTypeOptions,
  getAppleServiceLockRuleLabel as getConfiguredLockRuleLabel,
  getAppleServicePeriodTypeLabel
} from '@/utils/appleServiceOptions';
import { confirmAction } from '@/utils/confirmAction';
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
  { label: '国家', value: 'primaryRegion', required: true },
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
const batchActions = [
  { label: '一键开启选中', value: 'enable' },
  { label: '一键暂停选中', value: 'pause' },
  { label: '批量导出', value: 'export' }
];

interface OfficialCollectedServiceOption {
  category: string;
  collectedAt?: string | null;
  currency: string;
  key: string;
  officialPrice: string;
  periodType: AppleService['defaultPeriodType'];
  periodValue: number;
  planCode?: string | null;
  provider?: string | null;
  region: string;
  serviceName: string;
  sourceLabel: string;
}

const officialProviderOptions = [
  { label: 'ChatGPT / OpenAI', value: 'chatgpt' },
  { label: 'Gemini / Google', value: 'gemini' },
  { label: 'Claude / Anthropic', value: 'claude' },
  { label: '自定义', value: 'custom' }
];
const fallbackOfficialAutoProviderOptions = [
  { label: 'ChatGPT / OpenAI', shortLabel: 'ChatGPT', value: 'chatgpt' },
  { label: 'Gemini / Google', shortLabel: 'Gemini', value: 'gemini' },
  { label: 'Claude / Anthropic', shortLabel: 'Claude', value: 'claude' }
];
const fallbackOfficialAutoRegionOptions: AppleOfficialPriceProviderCatalogRegion[] = [
  { label: '美国 USD', value: 'US:USD', region: 'US', currency: 'USD' },
  { label: '马来西亚 MYR', value: 'MY:MYR', region: 'MY', currency: 'MYR' },
  { label: '新加坡 SGD', value: 'SG:SGD', region: 'SG', currency: 'SGD' },
  { label: '中国香港 HKD', value: 'HK:HKD', region: 'HK', currency: 'HKD' },
  { label: '中国台湾 TWD', value: 'TW:TWD', region: 'TW', currency: 'TWD' },
  { label: '日本 JPY', value: 'JP:JPY', region: 'JP', currency: 'JPY' },
  { label: '韩国 KRW', value: 'KR:KRW', region: 'KR', currency: 'KRW' },
  { label: '英国 GBP', value: 'GB:GBP', region: 'GB', currency: 'GBP' },
  { label: '欧元区 EUR', value: 'EU:EUR', region: 'EU', currency: 'EUR' },
  { label: '德国 EUR', value: 'DE:EUR', region: 'DE', currency: 'EUR' },
  { label: '法国 EUR', value: 'FR:EUR', region: 'FR', currency: 'EUR' },
  { label: '西班牙 EUR', value: 'ES:EUR', region: 'ES', currency: 'EUR' },
  { label: '意大利 EUR', value: 'IT:EUR', region: 'IT', currency: 'EUR' },
  { label: '荷兰 EUR', value: 'NL:EUR', region: 'NL', currency: 'EUR' },
  { label: '爱尔兰 EUR', value: 'IE:EUR', region: 'IE', currency: 'EUR' },
  { label: '比利时 EUR', value: 'BE:EUR', region: 'BE', currency: 'EUR' },
  { label: '奥地利 EUR', value: 'AT:EUR', region: 'AT', currency: 'EUR' },
  { label: '葡萄牙 EUR', value: 'PT:EUR', region: 'PT', currency: 'EUR' },
  { label: '芬兰 EUR', value: 'FI:EUR', region: 'FI', currency: 'EUR' },
  { label: '希腊 EUR', value: 'GR:EUR', region: 'GR', currency: 'EUR' },
  { label: '波兰 PLN', value: 'PL:PLN', region: 'PL', currency: 'PLN' },
  { label: '瑞典 SEK', value: 'SE:SEK', region: 'SE', currency: 'SEK' },
  { label: '挪威 NOK', value: 'NO:NOK', region: 'NO', currency: 'NOK' },
  { label: '丹麦 DKK', value: 'DK:DKK', region: 'DK', currency: 'DKK' },
  { label: '瑞士 CHF', value: 'CH:CHF', region: 'CH', currency: 'CHF' },
  { label: '捷克 CZK', value: 'CZ:CZK', region: 'CZ', currency: 'CZK' },
  { label: '罗马尼亚 RON', value: 'RO:RON', region: 'RO', currency: 'RON' },
  { label: '匈牙利 HUF', value: 'HU:HUF', region: 'HU', currency: 'HUF' },
  { label: '乌克兰 UAH', value: 'UA:UAH', region: 'UA', currency: 'UAH' },
  { label: '澳大利亚 AUD', value: 'AU:AUD', region: 'AU', currency: 'AUD' },
  { label: '新西兰 NZD', value: 'NZ:NZD', region: 'NZ', currency: 'NZD' },
  { label: '加拿大 CAD', value: 'CA:CAD', region: 'CA', currency: 'CAD' },
  { label: '泰国 THB', value: 'TH:THB', region: 'TH', currency: 'THB' },
  { label: '菲律宾 PHP', value: 'PH:PHP', region: 'PH', currency: 'PHP' },
  { label: '印度尼西亚 IDR', value: 'ID:IDR', region: 'ID', currency: 'IDR' },
  { label: '越南 VND', value: 'VN:VND', region: 'VN', currency: 'VND' },
  { label: '印度 INR', value: 'IN:INR', region: 'IN', currency: 'INR' },
  { label: '巴基斯坦 PKR', value: 'PK:PKR', region: 'PK', currency: 'PKR' },
  { label: '孟加拉国 BDT', value: 'BD:BDT', region: 'BD', currency: 'BDT' },
  { label: '土耳其 TRY', value: 'TR:TRY', region: 'TR', currency: 'TRY' },
  { label: '阿联酋 AED', value: 'AE:AED', region: 'AE', currency: 'AED' },
  { label: '沙特阿拉伯 SAR', value: 'SA:SAR', region: 'SA', currency: 'SAR' },
  { label: '以色列 ILS', value: 'IL:ILS', region: 'IL', currency: 'ILS' },
  { label: '巴西 BRL', value: 'BR:BRL', region: 'BR', currency: 'BRL' },
  { label: '墨西哥 MXN', value: 'MX:MXN', region: 'MX', currency: 'MXN' },
  { label: '阿根廷 ARS', value: 'AR:ARS', region: 'AR', currency: 'ARS' },
  { label: '智利 CLP', value: 'CL:CLP', region: 'CL', currency: 'CLP' },
  { label: '哥伦比亚 COP', value: 'CO:COP', region: 'CO', currency: 'COP' },
  { label: '秘鲁 PEN', value: 'PE:PEN', region: 'PE', currency: 'PEN' },
  { label: '尼日利亚 NGN', value: 'NG:NGN', region: 'NG', currency: 'NGN' },
  { label: '加纳 GHS', value: 'GH:GHS', region: 'GH', currency: 'GHS' },
  { label: '南非 ZAR', value: 'ZA:ZAR', region: 'ZA', currency: 'ZAR' },
  { label: '肯尼亚 KES', value: 'KE:KES', region: 'KE', currency: 'KES' },
  { label: '埃及 EGP', value: 'EG:EGP', region: 'EG', currency: 'EGP' },
  { label: '摩洛哥 MAD', value: 'MA:MAD', region: 'MA', currency: 'MAD' }
].map((region) => ({ ...region, sourceUrl: '' }));
const defaultOfficialAutoRegions = new Set(['US', 'MY', 'SG', 'HK']);
const balanceRuleOptions: Array<{ label: string; value: AppleBalancePriceRuleType }> = [
  { label: '继承全局规则', value: 'inherit' },
  { label: '按百分比', value: 'percent' },
  { label: '固定加价', value: 'fixed_add' },
  { label: '手动填写', value: 'manual' }
];

const loading = ref(false);
const saving = ref(false);
const officialPriceLoading = ref(false);
const officialPricePanelRef = ref<HTMLElement | null>(null);
const savingOfficialSource = ref(false);
const checkingOfficialPrice = ref(false);
const savingBalanceRule = ref(false);
const officialSourceCheckId = ref('');
const officialProviderCheckKey = ref('');
let officialPriceTabScrollRestoreTimer: ReturnType<typeof setTimeout> | undefined;
let servicesLoadRequestId = 0;
let officialPricePanelLoadRequestId = 0;
let visibleServicesLoadCount = 0;
let visibleOfficialPriceLoadCount = 0;
const dialogVisible = ref(false);
const officialSourceDialogVisible = ref(false);
const officialCheckDialogVisible = ref(false);
const editingService = ref<AppleService | null>(null);
const editingOfficialSource = ref<AppleOfficialPriceSource | null>(null);
const formRef = ref<FormInstance>();
const services = ref<AppleService[]>([]);
const selectedServices = ref<AppleService[]>([]);
const officialPriceSources = ref<AppleOfficialPriceSource[]>([]);
const officialPriceReviews = ref<ApplePriceChangeReview[]>([]);
const officialPriceSnapshots = ref<AppleOfficialPriceSnapshot[]>([]);
const officialPriceOptionReviews = ref<ApplePriceChangeReview[]>([]);
const officialPriceOptionSnapshots = ref<AppleOfficialPriceSnapshot[]>([]);
const officialPriceBatch = ref<AppleOfficialPriceCheckBatch | null>(null);
const officialProviderCatalogProviders = ref(fallbackOfficialAutoProviderOptions);
const officialProviderCatalogRegions = ref(fallbackOfficialAutoRegionOptions);
const officialSourceTotal = ref(0);
const officialReviewTotal = ref(0);
const officialSnapshotTotal = ref(0);
const appleRegionDictionaries = ref<DataDictionary[]>([]);
const serviceCategoryDictionaries = ref<DataDictionary[]>([]);
const periodTypeDictionaries = ref<DataDictionary[]>([]);
const expireCalcTypeDictionaries = ref<DataDictionary[]>([]);
const lockRuleDictionaries = ref<DataDictionary[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const serviceAdvancedPanels = ref<string[]>([]);
const officialPriceTab = ref('reviews');
const officialReviewActionId = ref('');
const selectedOfficialAutoRegions = ref<string[]>(
  fallbackOfficialAutoRegionOptions
    .filter((region) => defaultOfficialAutoRegions.has(region.region))
    .map((region) => region.value)
);
const officialBatchPollingTimer = ref<ReturnType<typeof setInterval> | null>(null);

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
const officialSourceQuery = reactive({
  page: 1,
  pageSize: 10
});
const officialReviewQuery = reactive({
  page: 1,
  pageSize: 10
});
const officialSnapshotQuery = reactive({
  page: 1,
  pageSize: 10
});
const officialBatchItemQuery = reactive({
  page: 1,
  pageSize: 10
});

const form = reactive({
  name: '',
  category: '通用',
  primaryRegion: 'US',
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
  requireServiceAccount: true,
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
  category: [{ required: true, message: '请选择业务分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入业务名称', trigger: 'blur' }],
  primaryRegion: [{ required: true, message: '请选择国家/地区', trigger: 'change' }],
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
const officialCollectedServiceOptions = computed(() => {
  const optionMap = new Map<string, OfficialCollectedServiceOption>();

  for (const snapshot of officialPriceOptionSnapshots.value) {
    addOfficialCollectedOption(optionMap, buildOfficialOptionFromSnapshot(snapshot));
  }

  for (const review of officialPriceOptionReviews.value) {
    addOfficialCollectedOption(optionMap, buildOfficialOptionFromReview(review));
  }

  return [...optionMap.values()].sort((left, right) => {
    const regionOrder = left.region.localeCompare(right.region);
    if (regionOrder) return regionOrder;
    const categoryOrder = getCategoryLabel(left.category).localeCompare(
      getCategoryLabel(right.category),
      'zh-CN'
    );
    if (categoryOrder) return categoryOrder;
    return left.serviceName.localeCompare(right.serviceName, 'zh-CN');
  });
});
const activeServiceCategoryDictionaries = computed(() =>
  serviceCategoryDictionaries.value
    .filter((category) => category.status === 'active')
    .slice()
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        getCategoryLabel(left.label).localeCompare(getCategoryLabel(right.label), 'zh-CN')
    )
);
const formServiceCategoryOptions = computed(() => {
  const categories = [
    ...activeServiceCategoryDictionaries.value.map((category) => getCategoryOptionValue(category)),
    query.category,
    form.category
  ]
    .map((category) => normalizeOptionalCategoryValue(category))
    .filter(Boolean);

  return [...new Set(categories)].sort((left, right) =>
    getCategoryLabel(left).localeCompare(getCategoryLabel(right), 'zh-CN')
  );
});
const appleRegionOptions = computed(() =>
  mergeAppleAccountRegionOptions(appleRegionDictionaries.value)
);
const appleCurrencyOptions = computed(() => {
  const options = buildAppleAccountCurrencyOptions(appleRegionOptions.value);
  const existing = new Set(options.map((option) => option.value));

  for (const item of [...officialCountryOptions.value, ...officialCollectedServiceOptions.value]) {
    if (!item.currency || existing.has(item.currency)) continue;
    existing.add(item.currency);
    options.push({
      label: item.currency,
      region: 'region' in item ? item.region : item.value,
      value: item.currency
    });
  }

  return options.sort((left, right) => left.value.localeCompare(right.value));
});
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
  officialPriceOptionReviews.value.filter((review) => review.status === 'pending')
);
const officialAutoProviderOptions = computed(() => officialProviderCatalogProviders.value);
const officialAutoRegionOptions = computed(() => officialProviderCatalogRegions.value);
const officialCountryOptions = computed(() => {
  const optionMap = new Map<string, { currency: string; label: string; value: string }>();

  for (const source of officialPriceSources.value) {
    const region = normalizeOfficialReviewCode(source.region);
    const currency = normalizeOfficialReviewCode(source.currency);
    if (!region || !currency) continue;
    optionMap.set(region, {
      currency,
      label: getOfficialRegionSelectLabel(region, currency),
      value: region
    });
  }

  for (const option of officialCollectedServiceOptions.value) {
    if (!option.region || !option.currency) continue;
    optionMap.set(option.region, {
      currency: option.currency,
      label: getOfficialRegionSelectLabel(option.region, option.currency),
      value: option.region
    });
  }

  for (const region of officialAutoRegionOptions.value) {
    if (optionMap.has(region.region)) continue;
    optionMap.set(region.region, {
      currency: region.currency,
      label: getOfficialRegionSelectLabel(region.region, region.currency),
      value: region.region
    });
  }

  return [...optionMap.values()].sort((left, right) => left.label.localeCompare(right.label));
});
const formOfficialCountryOptions = computed(() => {
  const options = [...officialCountryOptions.value];
  const primaryRegion = normalizeAppleRegionCode(form.primaryRegion, form.currency);

  if (primaryRegion && !options.some((option) => option.value === primaryRegion)) {
    const currency = getCurrencyForOfficialRegion(primaryRegion) || form.currency || '';
    options.unshift({
      currency,
      label: currency
        ? formatOfficialRegionCurrency(primaryRegion, currency)
        : formatCountryCodeLabel(primaryRegion),
      value: primaryRegion
    });
  }

  return options;
});
const filteredOfficialServiceOptions = computed(() => {
  const normalizedCategory = normalizeCategoryValue(form.category);
  const sameRegion = officialCollectedServiceOptions.value.filter(
    (option) => !form.primaryRegion || option.region === form.primaryRegion
  );
  const sameCategory = sameRegion.filter(
    (option) =>
      !normalizedCategory || normalizeCategoryValue(option.category) === normalizedCategory
  );

  return sameCategory.length ? sameCategory : sameRegion;
});
const officialServiceNameOptions = computed(() => {
  const seen = new Set<string>();
  const options: OfficialCollectedServiceOption[] = [];

  for (const option of filteredOfficialServiceOptions.value) {
    const key = option.serviceName.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }

  return options;
});
const officialPriceValueOptions = computed(() => {
  const selectedName = form.name.trim();
  const sameName = selectedName
    ? filteredOfficialServiceOptions.value.filter((option) => option.serviceName === selectedName)
    : filteredOfficialServiceOptions.value;
  const seen = new Set<string>();
  const options: OfficialCollectedServiceOption[] = [];

  for (const option of sameName) {
    const key = `${option.officialPrice}:${option.currency}`;
    if (!option.officialPrice || seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }

  return options;
});
const officialBatchIsActive = computed(
  () =>
    officialPriceBatch.value?.status === 'queued' || officialPriceBatch.value?.status === 'running'
);
const officialBatchProgressPercent = computed(() => {
  const batch = officialPriceBatch.value;
  if (!batch?.totalCount) return 0;
  return Math.min(100, Math.round((batch.completedCount / batch.totalCount) * 100));
});
const officialBatchProblemItems = computed(() =>
  (officialPriceBatch.value?.items ?? []).filter(
    (item) => item.status === 'failed' || item.status === 'waiting_manual_verify'
  )
);
const officialBatchItems = computed(() => officialPriceBatch.value?.items ?? []);
const paginatedOfficialBatchItems = computed(() => {
  const start = (officialBatchItemQuery.page - 1) * officialBatchItemQuery.pageSize;
  return officialBatchItems.value.slice(start, start + officialBatchItemQuery.pageSize);
});
const officialBatchProgressStatus = computed(() => {
  if (!officialPriceBatch.value) return undefined;
  if (officialPriceBatch.value.status === 'failed') return 'exception';
  if (
    officialPriceBatch.value.status === 'success' ||
    officialPriceBatch.value.status === 'waiting_manual_verify'
  ) {
    return 'success';
  }
  return undefined;
});
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

function addOfficialCollectedOption(
  optionMap: Map<string, OfficialCollectedServiceOption>,
  option: OfficialCollectedServiceOption | null
) {
  if (!option?.serviceName || !option.region || !option.currency || !option.officialPrice) {
    return;
  }

  const key = buildOfficialCollectedOptionKey(option);
  if (!optionMap.has(key)) {
    optionMap.set(key, option);
  }
}

function buildOfficialCollectedOptionKey(option: OfficialCollectedServiceOption) {
  return [
    option.region,
    option.currency,
    option.planCode || option.serviceName,
    option.officialPrice
  ].join('|');
}

function buildOfficialOptionFromSnapshot(
  snapshot: AppleOfficialPriceSnapshot
): OfficialCollectedServiceOption | null {
  const region = normalizeOfficialReviewCode(snapshot.region);
  const currency = normalizeOfficialReviewCode(snapshot.currency);
  const serviceName = snapshot.serviceName.trim();
  const category = normalizeCategoryValue(snapshot.category || snapshot.provider || '通用');
  const officialPrice = String(snapshot.officialPrice || '').trim();

  if (!region || !currency || !serviceName || !officialPrice) return null;

  return {
    category,
    collectedAt: snapshot.collectedAt,
    currency,
    key: `snapshot:${snapshot.id}`,
    officialPrice,
    periodType: snapshot.periodType,
    periodValue: normalizeOfficialPeriodValue(snapshot.periodValue),
    planCode: snapshot.planCode,
    provider: snapshot.provider,
    region,
    serviceName,
    sourceLabel: snapshot.source?.name || getProviderLabel(snapshot.provider)
  };
}

function buildOfficialOptionFromReview(
  review: ApplePriceChangeReview
): OfficialCollectedServiceOption | null {
  const region = getOfficialReviewRegionCode(review);
  const currency = getOfficialReviewCurrencyCode(review);
  const serviceName = getOfficialReviewServiceName(review);
  const officialPrice =
    getReviewRecordValue(review.newValue, 'officialBasePrice') ||
    getReviewRecordValue(review.newValue, 'officialPrice') ||
    review.snapshot?.officialPrice ||
    '';
  const category = normalizeCategoryValue(
    getReviewRecordValue(review.newValue, 'category') ||
      getOfficialReviewProviderValue(review) ||
      '通用'
  );

  if (!region || !currency || !serviceName || serviceName === '-' || !officialPrice) {
    return null;
  }

  return {
    category,
    collectedAt: review.snapshot?.collectedAt ?? review.createdAt,
    currency,
    key: `review:${review.id}`,
    officialPrice,
    periodType: normalizeOfficialPeriodType(getReviewRecordValue(review.newValue, 'periodType')),
    periodValue: normalizeOfficialPeriodValue(getReviewRecordValue(review.newValue, 'periodValue')),
    planCode: getReviewRecordValue(review.newValue, 'planCode') || review.snapshot?.planCode,
    provider: getOfficialReviewProviderValue(review),
    region,
    serviceName,
    sourceLabel: review.source?.name || getProviderLabel(getOfficialReviewProviderValue(review))
  };
}

function normalizeOfficialPeriodType(value?: string | null): AppleService['defaultPeriodType'] {
  const normalized = String(value || '');
  return isApplePeriodType(normalized) ? normalized : 'month';
}

function normalizeOfficialPeriodValue(value?: string | number | null) {
  const normalized = Number(value || 1);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
}

function getOfficialRegionSelectLabel(region: string, currency: string) {
  return formatOfficialRegionCurrency(region, currency);
}

function getServiceCountryLabel(service: Pick<AppleService, 'allowedRegions' | 'currency'>) {
  const region = getServicePrimaryRegion(service);

  if (!region) {
    return '未记录';
  }

  return formatCountryCodeLabel(region, service.currency);
}

function getServicePrimaryRegion(service: Pick<AppleService, 'allowedRegions' | 'currency'>) {
  const savedRegion = normalizeAppleRegionCode(service.allowedRegions[0], service.currency);

  if (savedRegion) {
    return savedRegion;
  }

  const currency = normalizeOfficialReviewCode(service.currency);

  return (
    officialCountryOptions.value.find((item) => item.currency === currency)?.value ||
    officialAutoRegionOptions.value.find((item) => item.currency === currency)?.region ||
    fallbackOfficialAutoRegionOptions.find((item) => item.currency === currency)?.region ||
    appleRegionOptions.value.find((item) => item.currency === currency)?.code ||
    ''
  );
}

function formatCountryCodeLabel(region: string, currency?: string | null) {
  const normalizedRegion = normalizeAppleRegionCode(region, currency);
  return formatSharedAppleRegionLabel(normalizedRegion, appleRegionOptions.value);
}

function formatServiceRegionLabel(region: string | null | undefined) {
  return formatSharedAppleRegionLabel(region, appleRegionOptions.value);
}

function formatOfficialRegionCurrency(
  region: string | null | undefined,
  currency: string | null | undefined
) {
  const normalizedRegion = normalizeAppleRegionCode(region, currency);
  return formatSharedAppleRegionCurrencyLabel(
    normalizedRegion || region,
    currency,
    appleRegionOptions.value
  );
}

function formatAllowedRegionList(regions: string[]) {
  return formatSharedAppleRegionListLabel(
    regions.map((region) => normalizeAppleRegionCode(region)),
    appleRegionOptions.value
  );
}

function getOfficialServiceNameOptionLabel(option: OfficialCollectedServiceOption) {
  return `${option.serviceName} · ${option.officialPrice} ${option.currency} · ${option.sourceLabel}`;
}

function getOfficialPriceValueOptionLabel(option: OfficialCollectedServiceOption) {
  return `${option.officialPrice} ${option.currency} · ${option.serviceName}`;
}

function getDefaultPrimaryRegion() {
  return (
    officialCountryOptions.value.find((option) => option.value === 'US')?.value ||
    officialCountryOptions.value[0]?.value ||
    appleRegionOptions.value[0]?.code ||
    'US'
  );
}

function handlePrimaryRegionChange() {
  form.primaryRegion = normalizeAppleRegionCode(form.primaryRegion, form.currency);
  const currency = getCurrencyForOfficialRegion(form.primaryRegion);
  if (currency) {
    form.currency = currency;
  }
  syncPrimaryRegionToAllowedRegions();

  const option = findOfficialCollectedOption({
    category: form.category,
    officialPrice: form.officialBasePrice,
    region: form.primaryRegion,
    serviceName: form.name
  });
  if (option) {
    applyOfficialServiceOption(option);
  }
}

function handleCategoryChange() {
  form.category = normalizeCategoryValue(form.category);
  const option = findOfficialCollectedOption({
    category: form.category,
    region: form.primaryRegion,
    serviceName: form.name
  });
  if (option) {
    applyOfficialServiceOption(option);
  }
}

function handleServiceNameSelect(value: string) {
  form.name = String(value || '').trim();
  const option = findOfficialCollectedOption({
    category: form.category,
    region: form.primaryRegion,
    serviceName: form.name
  });
  if (option) {
    applyOfficialServiceOption(option);
  }
}

function handleOfficialBasePriceSelect(value: string) {
  form.officialBasePrice = String(value || '').trim();
  const option = findOfficialCollectedOption({
    category: form.category,
    officialPrice: form.officialBasePrice,
    region: form.primaryRegion,
    serviceName: form.name
  });
  if (option) {
    applyOfficialServiceOption(option);
  }
}

function applyOfficialServiceOption(option: OfficialCollectedServiceOption) {
  form.primaryRegion = option.region;
  form.category = normalizeCategoryValue(option.category);
  form.name = option.serviceName;
  form.officialBasePrice = option.officialPrice;
  form.currency = option.currency;
  form.defaultPeriodType = option.periodType;
  form.defaultPeriodValue = option.periodValue;
  syncPrimaryRegionToAllowedRegions(option.region);
}

function findOfficialCollectedOption(criteria: {
  category?: string;
  officialPrice?: string;
  region?: string;
  serviceName?: string;
}) {
  let candidates = officialCollectedServiceOptions.value;
  const region = normalizeAppleRegionCode(criteria.region);
  const category = normalizeCategoryValue(criteria.category);
  const serviceName = String(criteria.serviceName || '').trim();
  const officialPrice = String(criteria.officialPrice || '').trim();

  if (region) {
    const sameRegion = candidates.filter((option) => option.region === region);
    if (sameRegion.length) candidates = sameRegion;
  }

  if (category) {
    const sameCategory = candidates.filter(
      (option) => normalizeCategoryValue(option.category) === category
    );
    if (sameCategory.length) candidates = sameCategory;
  }

  if (serviceName) {
    const sameName = candidates.filter((option) => option.serviceName === serviceName);
    if (!sameName.length) return null;
    candidates = sameName;
  }

  if (officialPrice) {
    const samePrice = candidates.filter((option) => option.officialPrice === officialPrice);
    if (samePrice.length) candidates = samePrice;
  }

  return candidates[0] ?? null;
}

function getCurrencyForOfficialRegion(region?: string | null) {
  const normalizedRegion = normalizeAppleRegionCode(region);
  if (!normalizedRegion) return '';

  return (
    officialCountryOptions.value.find((item) => item.value === normalizedRegion)?.currency ||
    officialAutoRegionOptions.value.find((item) => item.region === normalizedRegion)?.currency ||
    fallbackOfficialAutoRegionOptions.find((item) => item.region === normalizedRegion)?.currency ||
    appleRegionOptions.value.find((item) => item.code === normalizedRegion)?.currency ||
    ''
  );
}

function syncPrimaryRegionToAllowedRegions(region = form.primaryRegion) {
  const normalizedRegion = normalizeAppleRegionCode(region, form.currency);
  if (!normalizedRegion) return;

  const otherRegions = form.allowedRegions
    .map((item) => normalizeAppleRegionCode(item, form.currency))
    .filter((item) => item && item !== normalizedRegion);

  form.allowedRegions = [...new Set([normalizedRegion, ...otherRegions])];
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

function getGlobalBalanceRuleTypeLabel(ruleType: typeof globalBalanceRuleForm.ruleType) {
  return balanceRuleOptions.find((option) => option.value === ruleType)?.label ?? ruleType;
}

function getOfficialSourceRegionSummary(source: AppleOfficialPriceSource) {
  return formatOfficialRegionCurrency(source.region, source.currency);
}

function getOfficialBatchTitle(batch: AppleOfficialPriceCheckBatch) {
  return batch.provider === 'all'
    ? '官方价格批量采集'
    : `${getProviderLabel(batch.provider)} 官方价格采集`;
}

function getOfficialBatchTimeline(batch: AppleOfficialPriceCheckBatch) {
  const createdAt = formatDate(batch.createdAt);
  const startedAt = batch.startedAt ? `，开始 ${formatDate(batch.startedAt)}` : '';
  const finishedAt = batch.finishedAt ? `，完成 ${formatDate(batch.finishedAt)}` : '';
  return `创建 ${createdAt}${startedAt}${finishedAt}`;
}

function getOfficialBatchStatusLabel(status: AppleOfficialPriceCheckBatch['status']) {
  return (
    {
      queued: '排队中',
      running: '采集中',
      waiting_manual_verify: '待人工确认',
      success: '已完成',
      failed: '部分失败',
      skipped: '已跳过',
      cancelled: '已取消',
      pending: '待开始',
      need_review: '待复核'
    }[status] ?? status
  );
}

function getOfficialBatchStatusTone(status: AppleOfficialPriceCheckBatch['status']) {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'waiting_manual_verify') return 'orange';
  if (status === 'running' || status === 'queued') return 'blue';
  return 'neutral';
}

function getOfficialBatchItemStatusLabel(
  status: AppleOfficialPriceCheckBatch['items'][number]['status']
) {
  return (
    {
      queued: '排队中',
      running: '采集中',
      success: '成功',
      failed: '失败',
      waiting_manual_verify: '人工确认',
      completed: '已完成',
      cancelled: '已取消',
      pending: '待开始',
      need_review: '待复核',
      skipped: '已跳过'
    }[status] ?? status
  );
}

function getOfficialBatchItemStatusTone(
  status: AppleOfficialPriceCheckBatch['items'][number]['status']
) {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'waiting_manual_verify' || status === 'need_review') return 'orange';
  if (status === 'running' || status === 'queued' || status === 'pending') return 'blue';
  return 'neutral';
}

function getOfficialBatchItemRegionLabel(item: AppleOfficialPriceCheckBatch['items'][number]) {
  return formatOfficialRegionCurrency(item.region, item.currency);
}

function getOfficialBatchItemMessage(item: AppleOfficialPriceCheckBatch['items'][number]) {
  if (item.errorMessage) return item.errorMessage;
  if (item.message) return item.message;
  if (item.status === 'success') {
    return `已生成 ${item.snapshotCount} 条快照、${item.reviewCount} 条待确认变化`;
  }
  if (item.status === 'running') return '正在采集官网价格';
  if (item.status === 'queued' || item.status === 'pending') return '等待后台任务执行';
  return '暂无说明';
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

function normalizeOptionalCategoryValue(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return '';
  return normalizeCategoryValue(normalized);
}

function getCategoryOptionValue(category: DataDictionary) {
  return normalizeCategoryValue(category.value || category.label);
}

function getCategoryLabel(category?: string | null) {
  return normalizeCategoryValue(category) || '通用';
}

function isActiveAppleServiceCategoryValue(value?: string | null) {
  const normalizedCategory = normalizeOptionalCategoryValue(value);
  if (!normalizedCategory) return false;

  return activeServiceCategoryDictionaries.value.some(
    (category) => getCategoryOptionValue(category) === normalizedCategory
  );
}

function getDefaultCategory() {
  const queryCategory = normalizeOptionalCategoryValue(query.category);
  if (queryCategory && isActiveAppleServiceCategoryValue(queryCategory)) {
    return queryCategory;
  }

  const firstCategory = activeServiceCategoryDictionaries.value[0];
  return firstCategory ? getCategoryOptionValue(firstCategory) : '通用';
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

function getDefaultServiceColumns() {
  return serviceColumnOptions.map((column) => column.value);
}

function normalizeServiceVisibleColumns(columns: string[]) {
  const defaultColumns = getDefaultServiceColumns();

  if (!columns.length) {
    return defaultColumns;
  }

  const selectedColumns = new Set(columns.filter((column) => defaultColumns.includes(column)));

  for (const column of serviceColumnOptions) {
    if (column.required) {
      selectedColumns.add(column.value);
    }
  }

  return defaultColumns.filter((column) => selectedColumns.has(column));
}

async function loadServices(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  const requestId = ++servicesLoadRequestId;
  const endLoading = beginServicesLoading(!options.silent);

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
    const result = await refreshSmartQuery<PageResult<AppleService>>({
      key: createSmartQueryKey(APPLE_SERVICES_SCOPE, params),
      fetcher: ({ signal }) => appleServicesApi.list(params, { signal }),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });

    if (requestId !== servicesLoadRequestId) {
      return;
    }

    services.value = sortAppleServicesForDisplay(result.data.items);
    total.value = result.data.total;
  } catch (error) {
    if (requestId === servicesLoadRequestId && !options.silent) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 业务失败');
    }
  } finally {
    endLoading();
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

function sortAppleServicesForDisplay(items: AppleService[]) {
  if (sortConfig.value.prop && sortConfig.value.prop !== 'status') {
    return items;
  }

  const direction = sortConfig.value.order === 'descending' ? -1 : 1;

  return [...items].sort((left, right) => {
    const statusOrder = getStatusSortPriority(left.status) - getStatusSortPriority(right.status);
    return statusOrder ? statusOrder * direction : 0;
  });
}

function getStatusSortPriority(status: AppleService['status']) {
  if (status === 'enabled') return 0;
  if (status === 'paused') return 1;
  return 2;
}

async function handleBatchAction(action: string) {
  if (action === 'enable') {
    await updateSelectedServiceStatus('enabled');
    return;
  }
  if (action === 'pause') {
    await updateSelectedServiceStatus('paused');
    return;
  }
  if (action === 'export') {
    exportList();
  }
}

async function updateSelectedServiceStatus(status: AppleService['status']) {
  if (!selectedServices.value.length) {
    ElMessage.warning('请先选择要处理的业务');
    return;
  }

  const targetServices = selectedServices.value.filter((service) => service.status !== status);
  const actionLabel = status === 'enabled' ? '一键开启' : '一键暂停';
  const statusLabel = getStatusLabel(status);

  if (!targetServices.length) {
    ElMessage.info(`选中的业务已经都是${statusLabel}状态`);
    return;
  }

  const confirmed = await confirmAction({
    title: `确认${actionLabel}选中业务？`,
    actionName: actionLabel,
    description: `将 ${targetServices.length} 个选中业务改成${statusLabel}状态。`,
    expectedCount: targetServices.length,
    impact: [
      '只修改业务状态，不修改价格、周期、地区和历史订单。',
      '状态变更后订单录入会按新状态展示。'
    ],
    confirmButtonText: `确认${statusLabel}`
  });

  if (!confirmed) return;

  try {
    await Promise.all(
      targetServices.map((service) => appleServicesApi.update(service.id, { status }))
    );
    ElMessage.success(`已${statusLabel} ${targetServices.length} 个业务`);
    selectedServices.value = [];
    invalidateAppleServiceConsumers();
    await loadServices({ force: true, dedupeMs: 0 });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${actionLabel}失败`);
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
        ? normalizeServiceVisibleColumns(visibleColumns.value)
        : getDefaultServiceColumns(),
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
  visibleColumns.value = normalizeServiceVisibleColumns(view.columns);
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

function beginServicesLoading(visible: boolean) {
  if (!visible) return () => undefined;

  visibleServicesLoadCount += 1;
  loading.value = true;

  return () => {
    visibleServicesLoadCount = Math.max(visibleServicesLoadCount - 1, 0);
    if (visibleServicesLoadCount === 0) {
      loading.value = false;
    }
  };
}

function beginOfficialPriceLoading(visible: boolean) {
  if (!visible) return () => undefined;

  visibleOfficialPriceLoadCount += 1;
  officialPriceLoading.value = true;

  return () => {
    visibleOfficialPriceLoadCount = Math.max(visibleOfficialPriceLoadCount - 1, 0);
    if (visibleOfficialPriceLoadCount === 0) {
      officialPriceLoading.value = false;
    }
  };
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
    loadOfficialProviderCatalog(),
    loadServices({ force: false }),
    loadOfficialPricePanel()
  ]);
  await loadLatestOfficialPriceBatch();
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [APPLE_SERVICES_SCOPE, APPLE_OFFICIAL_PRICE_SCOPE, 'data-dictionaries'],
  () => {
    void loadServices({ silent: true, dedupeMs: 0 });
    void loadOfficialPricePanel({ silent: true });
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

async function assertAppleServiceCategoryActive(category: string) {
  const normalizedCategory = normalizeCategoryValue(category);
  const existing = serviceCategoryDictionaries.value.find(
    (item) =>
      normalizeCategoryValue(item.label) === normalizedCategory ||
      normalizeOptionalCategoryValue(item.value) === normalizedCategory
  );

  if (existing?.status === 'active') {
    return;
  }

  const data = await dataCenterApi.listDictionaries({
    page: 1,
    pageSize: 50,
    group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
    keyword: normalizedCategory
  });
  const alreadyExists = data.items.find(
    (item) =>
      normalizeCategoryValue(item.label) === normalizedCategory ||
      normalizeOptionalCategoryValue(item.value) === normalizedCategory
  );

  if (alreadyExists?.status === 'active') {
    return;
  }

  throw new Error(
    alreadyExists
      ? `业务分类“${normalizedCategory}”已停用，请先到 Apple ID 业务分类启用后再使用`
      : `业务分类“${normalizedCategory}”不存在，请先到 Apple ID 业务分类新增后再使用`
  );
}

function getCollectMethodLabel(method: AppleOfficialPriceSource['collectMethod']) {
  return { manual: '手动录入', webpage: '网页采集', api: 'API 采集' }[method] ?? method;
}

function getOfficialSourceCheckLabel(source?: AppleOfficialPriceSource) {
  if (!source) return '录入本次价格';
  return source.collectMethod === 'manual' ? '录入价格' : '采集该来源';
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

function getOfficialReviewServiceName(review: ApplePriceChangeReview) {
  return (
    review.appleService?.name ||
    review.snapshot?.serviceName ||
    getReviewRecordValue(review.newValue, 'serviceName') ||
    '-'
  );
}

function getOfficialReviewProviderValue(review: ApplePriceChangeReview) {
  return (
    review.source?.provider ||
    review.snapshot?.provider ||
    getReviewRecordValue(review.newValue, 'provider')
  );
}

function getOfficialReviewSourceSummary(review: ApplePriceChangeReview) {
  const provider = getProviderLabel(getOfficialReviewProviderValue(review));
  const source = review.source?.name || '-';
  return `${provider} · ${source}`;
}

function getOfficialReviewRegionCode(review: ApplePriceChangeReview) {
  return normalizeOfficialReviewCode(
    review.source?.region ||
      review.snapshot?.region ||
      getReviewRecordValue(review.newValue, 'region')
  );
}

function getOfficialReviewCurrencyCode(review: ApplePriceChangeReview) {
  return normalizeOfficialReviewCode(
    review.source?.currency ||
      review.snapshot?.currency ||
      getReviewRecordValue(review.newValue, 'currency')
  );
}

function getOfficialReviewRegionLabel(review: ApplePriceChangeReview) {
  const region = getOfficialReviewRegionCode(review);
  const currency = getOfficialReviewCurrencyCode(review);
  if (!region && !currency) return '-';

  return currency ? formatOfficialRegionCurrency(region, currency) : formatCountryCodeLabel(region);
}

function getOfficialReviewOldSummary(review: ApplePriceChangeReview) {
  return [
    `官网价 ${getReviewOldOfficialPrice(review)}`,
    `Apple余额价 ${getReviewOldAppleBalancePrice(review)}`,
    `周期 ${getReviewOldPeriod(review)}`
  ].join(' · ');
}

function getOfficialReviewNewSummary(review: ApplePriceChangeReview) {
  return [
    `官网价 ${getReviewNewOfficialPrice(review)}`,
    `Apple余额价 ${getReviewNewAppleBalancePrice(review)}`,
    `周期 ${getReviewNewPeriod(review)}`
  ].join(' · ');
}

function normalizeOfficialReviewCode(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  return normalized === '-' ? '' : normalized;
}

function normalizeAppleRegionCode(value?: string | null, currency?: string | null) {
  const raw = normalizeOfficialReviewCode(value);
  if (!raw) return '';

  const knownRegions = getKnownAppleRegionCodes();
  if (knownRegions.has(raw)) return raw;

  const normalizedCurrency = normalizeOfficialReviewCode(currency);
  const candidates = raw
    .replace(/[·/:|,，()（）[\]{}]+/g, ' ')
    .split(/\s+/)
    .map((item) => normalizeOfficialReviewCode(item))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate !== normalizedCurrency && knownRegions.has(candidate)) {
      return candidate;
    }
  }

  const regionMatches = raw.match(/\b[A-Z]{2}\b/g) ?? [];
  for (const candidate of regionMatches) {
    if (candidate !== normalizedCurrency && knownRegions.has(candidate)) {
      return candidate;
    }
  }

  const suffix = raw.slice(-2);
  return knownRegions.has(suffix) ? suffix : raw;
}

function getKnownAppleRegionCodes() {
  return new Set(
    [
      ...officialCountryOptions.value.map((item) => item.value),
      ...officialAutoRegionOptions.value.map((item) => item.region),
      ...fallbackOfficialAutoRegionOptions.map((item) => item.region),
      ...appleRegionOptions.value.map((item) => item.code)
    ]
      .map((item) => normalizeOfficialReviewCode(item))
      .filter(Boolean)
  );
}

function getReviewRecordValue(record: unknown, key: string) {
  if (!record || typeof record !== 'object') return '';
  const value = (record as Record<string, unknown>)[key];
  if (value === null || value === undefined) return '';
  return String(value);
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

  const confirmed = await confirmAction({
    title: '确认保存全局余额价规则？',
    actionName: '保存 Apple 余额价全局规则',
    description: '保存后会影响继承全局规则的 Apple ID 业务价格计算。',
    impact: [
      `规则类型：${getGlobalBalanceRuleTypeLabel(globalBalanceRuleForm.ruleType)}`,
      `规则数值：${globalBalanceRuleForm.ruleValue}`,
      '保存后会刷新 Apple ID 业务设置和下单依赖数据'
    ],
    riskNotes: '规则填写错误会影响后续报价和订单利润判断。',
    risk: 'strong',
    confirmButtonText: '确认保存规则',
    cancelButtonText: '返回修改'
  });
  if (!confirmed) return;

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

async function loadOfficialProviderCatalog() {
  try {
    const catalog = await appleOfficialPricesApi.listProviders();
    officialProviderCatalogProviders.value = catalog.providers.length
      ? catalog.providers.map((provider) => ({
          label: provider.label,
          shortLabel: provider.shortLabel,
          value: provider.value
        }))
      : fallbackOfficialAutoProviderOptions;
    officialProviderCatalogRegions.value = catalog.regions.length
      ? catalog.regions
      : fallbackOfficialAutoRegionOptions;
  } catch (error) {
    officialProviderCatalogProviders.value = fallbackOfficialAutoProviderOptions;
    officialProviderCatalogRegions.value = fallbackOfficialAutoRegionOptions;
    ElMessage.warning(
      error instanceof Error ? error.message : '加载自动采集地区失败，已使用默认地区'
    );
  }

  syncOfficialAutoRegionSelection(true);
}

function syncOfficialAutoRegionSelection(forceAll = false) {
  const availableValues = officialProviderCatalogRegions.value.map((region) => region.value);
  if (forceAll) {
    const defaultValues = officialProviderCatalogRegions.value
      .filter((region) => defaultOfficialAutoRegions.has(region.region))
      .map((region) => region.value);
    selectedOfficialAutoRegions.value = defaultValues.length ? defaultValues : availableValues;
    return;
  }

  const availableSet = new Set(availableValues);
  const currentSelected = selectedOfficialAutoRegions.value.filter((value) =>
    availableSet.has(value)
  );
  selectedOfficialAutoRegions.value = currentSelected.length ? currentSelected : availableValues;
}

async function loadOfficialPricePanel(
  options: { preserveOptionCache?: boolean; silent?: boolean } = {}
) {
  const requestId = ++officialPricePanelLoadRequestId;
  const endLoading = beginOfficialPriceLoading(!options.silent);

  try {
    const shouldRefreshOptionCache =
      !options.preserveOptionCache ||
      !officialPriceOptionReviews.value.length ||
      !officialPriceOptionSnapshots.value.length;
    const [sources, reviews, snapshots, optionReviews, optionSnapshots] = await Promise.all([
      appleOfficialPricesApi.listSources({
        page: officialSourceQuery.page,
        pageSize: officialSourceQuery.pageSize,
        status: ''
      }),
      appleOfficialPricesApi.listReviews({
        page: officialReviewQuery.page,
        pageSize: officialReviewQuery.pageSize,
        status: '',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }),
      appleOfficialPricesApi.listSnapshots({
        page: officialSnapshotQuery.page,
        pageSize: officialSnapshotQuery.pageSize,
        sortBy: 'collectedAt',
        sortOrder: 'desc'
      }),
      shouldRefreshOptionCache
        ? appleOfficialPricesApi.listReviews({
            page: 1,
            pageSize: 500,
            status: '',
            sortBy: 'createdAt',
            sortOrder: 'desc'
          })
        : Promise.resolve(null),
      shouldRefreshOptionCache
        ? appleOfficialPricesApi.listSnapshots({
            page: 1,
            pageSize: 500,
            sortBy: 'collectedAt',
            sortOrder: 'desc'
          })
        : Promise.resolve(null)
    ]);

    if (requestId !== officialPricePanelLoadRequestId) {
      return;
    }

    officialPriceSources.value = sources.items;
    officialPriceReviews.value = reviews.items;
    officialPriceSnapshots.value = snapshots.items;
    officialSourceTotal.value = sources.total;
    officialReviewTotal.value = reviews.total;
    officialSnapshotTotal.value = snapshots.total;
    if (optionReviews) {
      officialPriceOptionReviews.value = optionReviews.items;
    }
    if (optionSnapshots) {
      officialPriceOptionSnapshots.value = optionSnapshots.items;
    }
    if (!officialCheckForm.sourceId && sources.items.length) {
      officialCheckForm.sourceId = sources.items[0].id;
    }
  } catch (error) {
    if (requestId === officialPricePanelLoadRequestId && !options.silent) {
      ElMessage.error(error instanceof Error ? error.message : '加载官方价格巡检失败');
    }
  } finally {
    endLoading();
  }
}

async function loadLatestOfficialPriceBatch() {
  try {
    const previousStatus = officialPriceBatch.value?.status;
    const batch = await appleOfficialPricesApi.getLatestCheckBatch();
    officialPriceBatch.value = batch;
    normalizeOfficialBatchItemPage();

    if (batch && (batch.status === 'queued' || batch.status === 'running')) {
      startOfficialBatchPolling();
      return;
    }

    stopOfficialBatchPolling();
    if (
      batch &&
      previousStatus &&
      (previousStatus === 'queued' || previousStatus === 'running') &&
      batch.status !== previousStatus
    ) {
      await loadOfficialPricePanel({ silent: true });
    }
  } catch (error) {
    stopOfficialBatchPolling();
    ElMessage.error(error instanceof Error ? error.message : '加载采集进度失败');
  }
}

async function loadOfficialPriceBatch(batchId: string) {
  try {
    const previousStatus = officialPriceBatch.value?.status;
    const batch = await appleOfficialPricesApi.getCheckBatch(batchId);
    officialPriceBatch.value = batch;
    normalizeOfficialBatchItemPage();

    if (batch.status === 'queued' || batch.status === 'running') {
      startOfficialBatchPolling();
      return;
    }

    stopOfficialBatchPolling();
    if (previousStatus === 'queued' || previousStatus === 'running') {
      await loadOfficialPricePanel({ silent: true });
    }
  } catch (error) {
    stopOfficialBatchPolling();
    ElMessage.error(error instanceof Error ? error.message : '刷新采集进度失败');
  }
}

function startOfficialBatchPolling() {
  if (officialBatchPollingTimer.value) return;
  officialBatchPollingTimer.value = setInterval(() => {
    const batchId = officialPriceBatch.value?.id;
    if (batchId) {
      void loadOfficialPriceBatch(batchId);
    } else {
      void loadLatestOfficialPriceBatch();
    }
  }, 2500);
}

function stopOfficialBatchPolling() {
  if (!officialBatchPollingTimer.value) return;
  clearInterval(officialBatchPollingTimer.value);
  officialBatchPollingTimer.value = null;
}

function normalizeOfficialBatchItemPage() {
  const totalPages = Math.max(
    1,
    Math.ceil(officialBatchItems.value.length / officialBatchItemQuery.pageSize)
  );

  if (officialBatchItemQuery.page > totalPages) {
    officialBatchItemQuery.page = totalPages;
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
    const confirmed = await confirmAction({
      title: '确认删除官方来源？',
      actionName: '删除官方来源',
      description: `将删除官方来源「${source.name}」。`,
      impact: [
        `供应商：${getProviderLabel(source.provider)}`,
        `地区/币种：${getOfficialSourceRegionSummary(source)}`,
        '删除后该来源不再参与后续官方价格采集'
      ],
      riskNotes: '历史采集记录不会直接覆盖业务价格，但后续自动采集会少一个来源。',
      irreversible: true,
      risk: 'strong',
      confirmButtonText: '确认删除来源'
    });
    if (!confirmed) return;

    await appleOfficialPricesApi.removeSource(source.id);
    ElMessage.success('官方来源已删除');
    await loadOfficialPricePanel();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除官方来源失败');
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

  const confirmed = await confirmAction({
    title: '确认采集该官方来源？',
    actionName: '采集官方价格来源',
    description: '系统会访问该官方来源并生成待确认变化，不会直接覆盖业务价格。',
    impact: [
      `来源：${source.name}`,
      `供应商：${getProviderLabel(source.provider)}`,
      `地区/币种：${getOfficialSourceRegionSummary(source)}`
    ],
    expectedCount: '1 个官方来源',
    riskNotes: '官网可能访问失败、返回空结果或转人工确认。',
    risk: 'normal',
    confirmButtonText: '确认采集该来源',
    cancelButtonText: '取消采集'
  });
  if (!confirmed) return;

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

async function handleOfficialProviderCheck(provider: string) {
  if (officialBatchIsActive.value) {
    ElMessage.warning('已有官方价格采集批次正在执行，请先等待完成');
    return;
  }

  const regions = buildOfficialProviderRegionsPayload();
  const confirmed = await confirmOfficialProviderCheck(provider);
  if (!confirmed) return;

  officialProviderCheckKey.value = provider;
  try {
    const batch =
      provider === 'all'
        ? await appleOfficialPricesApi.startAllProvidersCheckBatch({
            trigger: 'manual',
            scanRemovedPlans: false,
            regions
          })
        : await appleOfficialPricesApi.startProviderCheckBatch(provider, {
            trigger: 'manual',
            scanRemovedPlans: false,
            regions
          });
    officialPriceBatch.value = batch;
    officialBatchItemQuery.page = 1;
    showOfficialBatchResults();
    startOfficialBatchPolling();
    if (batch.reused) {
      ElMessage.warning(batch.message || '已有相同供应商/地区的采集批次正在执行');
    } else {
      ElMessage.success(batch.message || '官方价格采集批次已创建');
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建官方价格采集批次失败');
  } finally {
    officialProviderCheckKey.value = '';
  }
}

function buildOfficialProviderRegionsPayload() {
  const selected = getSelectedOfficialAutoRegionOptions();
  return selected.length
    ? selected.map((region) => ({ region: region.region, currency: region.currency }))
    : undefined;
}

function getSelectedOfficialAutoRegionOptions() {
  return officialAutoRegionOptions.value.filter((region) =>
    selectedOfficialAutoRegions.value.includes(region.value)
  );
}

function getOfficialProviderConfirmLabel(provider: string) {
  if (provider === 'all') {
    return officialAutoProviderOptions.value.map((item) => item.shortLabel).join('、');
  }

  const matched = officialAutoProviderOptions.value.find((item) => item.value === provider);
  return matched?.shortLabel || matched?.label || provider;
}

function getOfficialProviderCount(provider: string) {
  return provider === 'all' ? officialAutoProviderOptions.value.length : 1;
}

function getOfficialProviderRegionCount() {
  const selected = getSelectedOfficialAutoRegionOptions();
  return selected.length || officialAutoRegionOptions.value.length;
}

function getOfficialProviderTaskCount(provider: string) {
  return getOfficialProviderCount(provider) * getOfficialProviderRegionCount();
}

function confirmOfficialProviderCheck(provider: string) {
  const providerCount = getOfficialProviderCount(provider);
  const regionCount = getOfficialProviderRegionCount();
  const taskCount = getOfficialProviderTaskCount(provider);
  const providerLabel = getOfficialProviderConfirmLabel(provider);
  const isBatch = provider === 'all' || taskCount > 1;

  return confirmAction({
    title: isBatch ? '确认开始批量采集？' : '确认开始采集？',
    actionName: isBatch ? '批量采集官方价格' : '采集官方价格',
    description: '系统会创建或复用官方来源，采集结果只进入待确认，不会直接覆盖业务价格。',
    impact: [
      `供应商：${providerLabel}`,
      `地区数量：${regionCount} 个`,
      '结果进入待确认变化，需要再次确认后才会同步业务价格'
    ],
    expectedCount: `${providerCount} 个供应商 × ${regionCount} 个地区，共 ${taskCount} 个任务`,
    riskNotes: '可能耗时较长，部分官网可能返回失败、403 或转人工确认。',
    risk: isBatch ? 'strong' : 'normal',
    confirmButtonText: isBatch ? '确认开始批量采集' : '确认开始采集',
    cancelButtonText: '取消采集'
  });
}

function showOfficialBatchResults() {
  officialPriceTab.value = 'batch-items';
  preserveWorkspaceScrollAfterOfficialTabChange();
}

function preserveWorkspaceScrollAfterOfficialTabChange() {
  const workspace = getOfficialPriceWorkspace();

  if (!workspace) {
    return;
  }

  const scrollTop = workspace.scrollTop;
  clearTimeout(officialPriceTabScrollRestoreTimer);

  void nextTick(() => {
    window.requestAnimationFrame(() => {
      restoreOfficialPriceWorkspaceScroll(scrollTop);
      officialPriceTabScrollRestoreTimer = setTimeout(() => {
        restoreOfficialPriceWorkspaceScroll(scrollTop);
      }, 120);
    });
  });
}

function restoreOfficialPriceWorkspaceScroll(scrollTop: number) {
  const workspace = getOfficialPriceWorkspace();

  if (!workspace) {
    return;
  }

  workspace.scrollTop = scrollTop;
}

function getOfficialPriceWorkspace() {
  return officialPricePanelRef.value?.closest<HTMLElement>('.workspace') ?? null;
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

  const selectedSource = officialPriceSources.value.find(
    (source) => source.id === officialCheckForm.sourceId
  );
  const confirmed = await confirmAction({
    title: '确认生成官方价格对比？',
    actionName: '生成官方价格对比',
    description: '系统会把本次录入价格生成待确认变化，不会直接覆盖业务价格。',
    impact: [
      `官方来源：${selectedSource?.name ?? '手动选择来源'}`,
      `套餐：${officialCheckForm.serviceName}`,
      `地区/币种：${formatOfficialRegionCurrency(officialCheckForm.region, officialCheckForm.currency)}`,
      officialCheckForm.scanRemovedPlans
        ? '会同时检查同币种业务里的疑似下架套餐'
        : '不会检查疑似下架套餐'
    ],
    expectedCount: '1 条手工官方价格',
    riskNotes: '录入错误会生成错误的待确认变化，仍需再次确认后才会同步业务价格。',
    risk: officialCheckForm.scanRemovedPlans ? 'strong' : 'normal',
    confirmButtonText: '确认生成价格对比',
    cancelButtonText: '返回修改'
  });
  if (!confirmed) return;

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
    const confirmed = await confirmAction({
      title: '确认同步官方价格变化？',
      actionName: '同步官方价格到业务设置',
      description:
        '确认后会同步 Apple ID 业务设置里的官网价、币种和周期，并按规则重算 Apple 余额价。',
      impact: [
        `业务/套餐：${getOfficialReviewServiceName(review)}`,
        `国家/地区：${getOfficialReviewRegionLabel(review)}`,
        `系统当前：${getOfficialReviewOldSummary(review)}`,
        `官方最新：${getOfficialReviewNewSummary(review)}`,
        '新套餐会先创建为暂停状态'
      ],
      riskNotes: '该操作会影响 Apple ID 业务价格和后续下单选择。',
      risk: 'strong',
      confirmButtonText: '确认同步价格',
      cancelButtonText: '返回'
    });
    if (!confirmed) return;

    officialReviewActionId.value = review.id;
    await appleOfficialPricesApi.approveReview(review.id);
    ElMessage.success('已同步到 Apple ID 业务设置');
    invalidateAppleServiceConsumers();
    await Promise.all([loadOfficialPricePanel(), loadServices({ force: true, dedupeMs: 0 })]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '确认官方价格变化失败');
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
  const defaultOfficialOption = officialCollectedServiceOptions.value.find((option) => {
    return isActiveAppleServiceCategoryValue(option.category);
  });
  const defaultPrimaryRegion = defaultOfficialOption?.region || getDefaultPrimaryRegion();
  form.name = '';
  form.category = defaultOfficialOption
    ? normalizeCategoryValue(defaultOfficialOption.category)
    : getDefaultCategory();
  form.primaryRegion = defaultPrimaryRegion;
  form.defaultPrice = '0';
  form.officialBasePrice = '0';
  form.officialCostValue = '0';
  form.appleBalancePriceRuleType = 'inherit';
  form.appleBalancePriceRuleValue = '';
  form.currency =
    defaultOfficialOption?.currency || getCurrencyForOfficialRegion(defaultPrimaryRegion) || 'USD';
  form.defaultPeriodType = periodTypeOptions.value[0]?.value ?? 'month';
  form.defaultPeriodValue = 1;
  form.expireCalcType = expireCalcTypeOptions.value[0]?.value ?? 'by_month';
  form.requireAppleId = true;
  form.requireServiceAccount = true;
  form.autoMatchAppleId = true;
  form.lockRule = lockRuleOptions.value[0]?.value ?? 'by_service';
  form.allowedRegions = defaultPrimaryRegion ? [defaultPrimaryRegion] : [];
  form.minBalanceRequired = '0';
  form.status = 'enabled';
  form.remark = '';
  serviceAdvancedPanels.value = [];
}

function openCreate() {
  editingService.value = null;
  resetForm();
  dialogVisible.value = true;
  void nextTick(() => formRef.value?.clearValidate());
}

function openEdit(service: AppleService) {
  editingService.value = service;
  const primaryRegion = getServicePrimaryRegion(service);
  const allowedRegions = [
    ...new Set(
      service.allowedRegions
        .map((item) => normalizeAppleRegionCode(item, service.currency))
        .filter(Boolean)
    )
  ];
  form.name = service.name;
  form.category = normalizeCategoryValue(service.category);
  form.primaryRegion = primaryRegion;
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
  form.allowedRegions = allowedRegions.length
    ? allowedRegions
    : primaryRegion
      ? [primaryRegion]
      : [];
  form.minBalanceRequired = service.minBalanceRequired;
  form.status = service.status;
  form.remark = service.remark ?? '';
  serviceAdvancedPanels.value = [];
  dialogVisible.value = true;
  void nextTick(() => formRef.value?.clearValidate());
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
    syncPrimaryRegionToAllowedRegions();
    await assertAppleServiceCategoryActive(category);
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

async function removeService(service: AppleService) {
  try {
    const confirmed = await confirmAction({
      title: '确认删除 Apple ID 业务？',
      actionName: '删除 Apple ID 业务',
      description: `将删除业务「${service.name}」。`,
      impact: [
        `分类：${getCategoryLabel(service.category)}`,
        `地区/币种：${service.allowedRegions.length ? `${formatAllowedRegionList(service.allowedRegions)} / ${service.currency}` : '不限'}`,
        '删除后新订单不能再选择该业务，自动匹配也不会再使用该业务'
      ],
      riskNotes: '历史订单、开通记录和报表不会被物理删除，但后续业务录入会少一个可选项。',
      irreversible: true,
      risk: 'strong',
      confirmButtonText: '确认删除业务'
    });
    if (!confirmed) return;

    await appleServicesApi.remove(service.id);
    ElMessage.success('Apple ID 业务已删除');
    selectedServices.value = selectedServices.value.filter((item) => item.id !== service.id);
    invalidateAppleServiceConsumers();
    await loadServices({ force: true, dedupeMs: 0 });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除 Apple ID 业务失败');
  }
}

useAuthenticatedPageLoader(initializePage);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
  stopOfficialBatchPolling();
  clearTimeout(officialPriceTabScrollRestoreTimer);
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

.apple-official-provider-runner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  flex-wrap: wrap;
}

.apple-official-provider-runner__label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.apple-official-region-select {
  width: min(420px, 58vw);
}

.apple-official-provider-runner__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.apple-official-provider-runner__hint {
  flex-basis: 100%;
  color: #64748b;
  font-size: 13px;
}

.apple-official-batch-panel {
  display: grid;
  gap: 10px;
  margin: 4px 0 14px;
  padding: 14px;
  border: 1px solid #dbe7f5;
  border-radius: 8px;
  background: #f8fbff;
}

.apple-official-batch-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.apple-official-batch-panel__header strong,
.apple-official-batch-panel__header span {
  display: block;
}

.apple-official-batch-panel__header span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.apple-official-batch-panel__stats,
.apple-official-batch-panel__problems {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.apple-official-batch-problem {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 13px;
}

.apple-official-batch-problem--summary {
  flex: 1 1 100%;
}

.apple-official-batch-problem--summary span {
  flex: 1 1 auto;
}

.apple-official-batch-problem__status {
  flex: 0 0 auto;
}

.apple-official-price-tabs {
  margin-top: 10px;
}

.apple-official-tab-note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid #dbe7f5;
  border-radius: 8px;
  background: #f8fbff;
  color: #475569;
  font-size: 13px;
}

.apple-official-tab-note strong {
  flex: 0 0 auto;
  color: #0f172a;
}

.apple-official-tab-note span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.apple-official-price-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.official-review-table :deep(.el-table__cell .cell) {
  white-space: nowrap;
}

.official-review-main,
.official-review-country,
.official-review-price {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.official-review-country {
  color: #334155;
  font-weight: 700;
}

.official-review-actions {
  flex-wrap: nowrap;
}

.official-review-detail {
  color: #0f172a;
  font-size: 13px;
}

.official-review-detail > strong {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
}

.official-review-detail-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.official-review-detail-list div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
}

.official-review-detail-list dt {
  color: #64748b;
  font-weight: 700;
}

.official-review-detail-list dd {
  margin: 0;
  color: #1e293b;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .apple-service-period-row {
    grid-template-columns: 1fr;
  }

  .apple-balance-rule-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .apple-official-provider-runner {
    align-items: stretch;
    flex-direction: column;
  }

  .apple-official-provider-runner__label {
    align-items: stretch;
    flex-direction: column;
  }

  .apple-official-provider-runner__actions {
    justify-content: flex-start;
  }

  .apple-official-batch-panel__header {
    flex-direction: column;
  }

  .apple-official-tab-note {
    align-items: flex-start;
    flex-direction: column;
  }

  .apple-balance-rule-bar__controls,
  .apple-rule-select,
  .apple-official-region-select,
  .apple-rule-input {
    width: 100%;
  }
}
</style>
