<template>
  <PageScaffold
    title="ID 自动化工作台"
    group="Apple ID 业务"
    phase="Phase 8"
    description="按要做的事开始操作：批量查状态、批量查余额、巡检价格套餐；任务队列只保留为执行记录和排查入口。"
  >
    <template #actions>
      <StatusChip :tone="manualCount > 0 ? 'orange' : 'green'" dot>
        {{ manualCount > 0 ? `待人工 ${manualCount}` : '暂无人工待处理' }}
      </StatusChip>
    </template>

    <section class="content-panel automation-workbench-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="要做什么"
          help="先选一个要做的动作，再选 Apple ID 或国家地区，点开始后直接看结果表。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>任务 {{ displayTaskTotal }}</StatusChip>
          <StatusChip tone="orange">队列 {{ queuedCount }}</StatusChip>
          <StatusChip tone="purple">运行 {{ runningCount }}</StatusChip>
          <StatusChip :tone="failedCount > 0 ? 'red' : 'green'">
            失败 {{ failedCount }}
          </StatusChip>
        </div>
      </div>

      <div v-loading="workbenchStatusLoading" class="automation-readiness-grid">
        <section class="automation-readiness-card">
          <div>
            <strong>状态查询</strong>
            <span>{{ workbenchStatus?.statusCheck.message ?? '正在读取状态查询能力' }}</span>
          </div>
          <StatusChip :tone="getCapabilityTone(workbenchStatus?.statusCheck)" dot>
            {{ getStatusCheckAbilityLabel() }}
          </StatusChip>
          <div class="automation-readiness-card__meta">
            <span
              >节点
              {{ formatRegionList(workbenchStatus?.statusCheck.availableGatewayCountries) }}</span
            >
            <span>{{ getCapabilityWorkloadLabel(workbenchStatus?.statusCheck) }}</span>
          </div>
          <div class="automation-readiness-card__actions">
            <AppButton size="small" variant="soft" @click="openGatewaySubscriptionDialog">
              {{ needsGatewaySubscription ? '粘贴节点订阅' : '更新节点订阅' }}
            </AppButton>
          </div>
        </section>
        <section class="automation-readiness-card">
          <div>
            <strong>余额查询</strong>
            <span>{{ workbenchStatus?.balanceCheck.message ?? '正在读取余额查询能力' }}</span>
          </div>
          <StatusChip :tone="getCapabilityTone(workbenchStatus?.balanceCheck)" dot>
            {{ getCapabilityModeLabel(workbenchStatus?.balanceCheck.mode) }}
          </StatusChip>
          <div class="automation-readiness-card__meta">
            <span>{{ getCapabilityWorkloadLabel(workbenchStatus?.balanceCheck) }}</span>
          </div>
        </section>
        <section class="automation-readiness-card">
          <div>
            <strong>价格巡检</strong>
            <span>{{ workbenchStatus?.officialPriceCheck.message ?? '正在读取价格巡检能力' }}</span>
          </div>
          <StatusChip :tone="getCapabilityTone(workbenchStatus?.officialPriceCheck)" dot>
            {{ getCapabilityModeLabel(workbenchStatus?.officialPriceCheck.mode) }}
          </StatusChip>
          <div class="automation-readiness-card__meta">
            <span>{{ getCapabilityWorkloadLabel(workbenchStatus?.officialPriceCheck) }}</span>
          </div>
        </section>
      </div>

      <el-tabs v-model="activeTab" class="automation-tabs">
        <el-tab-pane label="开始操作" name="start">
          <div class="automation-action-grid">
            <section class="automation-action-card">
              <div class="automation-action-card__head">
                <div>
                  <strong>批量查 ID 是否正常</strong>
                  <span>选择账号后开始检查，结果会显示正常、需验证、锁定或风险。</span>
                </div>
                <StatusChip tone="blue">状态</StatusChip>
              </div>
              <el-form label-position="top">
                <el-form-item label="Apple ID">
                  <el-select
                    v-model="statusCheckForm.appleAccountIds"
                    class="full-width"
                    collapse-tags
                    collapse-tags-tooltip
                    filterable
                    multiple
                    placeholder="选择要检查的 Apple ID"
                    remote
                    remote-show-suffix
                    :loading="accountOptionsLoading"
                    :remote-method="searchAppleAccountOptions"
                    @visible-change="handleAppleAccountOptionsVisible"
                  >
                    <el-option
                      v-for="account in appleAccountOptions"
                      :key="account.id"
                      :label="formatAccountOption(account)"
                      :value="account.id"
                    />
                  </el-select>
                </el-form-item>
                <div class="automation-form-row">
                  <el-form-item label="出口国家">
                    <el-select v-model="statusCheckForm.gatewayRegion" class="full-width">
                      <el-option
                        v-for="item in gatewayRegionOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="优先级">
                    <el-select v-model="statusCheckForm.priority" class="full-width">
                      <el-option
                        v-for="item in priorityOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </el-form-item>
                </div>
                <el-form-item label="备注">
                  <el-input
                    v-model.trim="statusCheckForm.note"
                    maxlength="120"
                    placeholder="例如 周一巡检 / 客户催处理"
                    show-word-limit
                  />
                </el-form-item>
              </el-form>
              <AppButton
                class="automation-action-card__button"
                variant="primary"
                :loading="runningAction === 'status'"
                @click="startStatusCheck"
              >
                开始查询状态
              </AppButton>
            </section>

            <section class="automation-action-card">
              <div class="automation-action-card__head">
                <div>
                  <strong>批量查 ID 余额</strong>
                  <span>第一期先返回系统当前余额快照；真实官网读取接入后会显示官网来源。</span>
                </div>
                <StatusChip tone="green">余额</StatusChip>
              </div>
              <el-form label-position="top">
                <el-form-item label="Apple ID">
                  <el-select
                    v-model="balanceCheckForm.appleAccountIds"
                    class="full-width"
                    collapse-tags
                    collapse-tags-tooltip
                    filterable
                    multiple
                    placeholder="选择要查询余额的 Apple ID"
                    remote
                    remote-show-suffix
                    :loading="accountOptionsLoading"
                    :remote-method="searchAppleAccountOptions"
                    @visible-change="handleAppleAccountOptionsVisible"
                  >
                    <el-option
                      v-for="account in appleAccountOptions"
                      :key="account.id"
                      :label="formatAccountOption(account)"
                      :value="account.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="优先级">
                  <el-select v-model="balanceCheckForm.priority" class="full-width">
                    <el-option
                      v-for="item in priorityOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="备注">
                  <el-input
                    v-model.trim="balanceCheckForm.note"
                    maxlength="120"
                    placeholder="例如 续费前对账 / 客户投诉核对"
                    show-word-limit
                  />
                </el-form-item>
              </el-form>
              <AppButton
                class="automation-action-card__button"
                variant="primary"
                :loading="runningAction === 'balance'"
                @click="startBalanceCheck"
              >
                开始查询余额
              </AppButton>
            </section>

            <section class="automation-action-card">
              <div class="automation-action-card__head">
                <div>
                  <strong>巡检官方价格和套餐</strong>
                  <span>跑完后显示有变动、没变动、新套餐和失败项；确认后才同步业务价格。</span>
                </div>
                <StatusChip tone="purple">价格</StatusChip>
              </div>
              <el-form label-position="top">
                <el-form-item label="供应商">
                  <el-select v-model="officialCheckForm.provider" class="full-width">
                    <el-option label="全部供应商" value="all" />
                    <el-option
                      v-for="provider in officialProviderOptions"
                      :key="provider.value"
                      :label="provider.label"
                      :value="provider.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="国家 / 地区">
                  <el-select
                    v-model="officialCheckForm.regions"
                    class="full-width"
                    collapse-tags
                    collapse-tags-tooltip
                    multiple
                    placeholder="不选则按全部地区巡检"
                  >
                    <el-option
                      v-for="region in officialRegionOptions"
                      :key="region.value"
                      :label="region.label"
                      :value="region.value"
                    />
                  </el-select>
                </el-form-item>
              </el-form>
              <AppButton
                class="automation-action-card__button"
                variant="primary"
                :loading="runningAction === 'official'"
                @click="startOfficialPriceCheck"
              >
                开始价格巡检
              </AppButton>
            </section>
          </div>

          <div class="automation-secondary-actions">
            <div>
              <strong>其他自动化动作</strong>
              <span
                >这些动作需要真实 Worker
                或人工兜底，先创建清楚的待处理任务，不假装已经自动完成。</span
              >
            </div>
            <div class="inline-actions">
              <AppButton variant="soft" @click="openAdvancedTask('topup')">自动充值</AppButton>
              <AppButton variant="soft" @click="openAdvancedTask('cancel_subscription')">
                取消订阅
              </AppButton>
              <AppButton variant="soft" @click="openAdvancedTask('change_phone')">
                修改手机号
              </AppButton>
              <AppButton variant="soft" @click="openAdvancedTask('change_security')">
                修改密保
              </AppButton>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="结果表" name="results">
          <div v-if="taskBatchResults" class="automation-result-block">
            <div class="automation-result-block__head">
              <div>
                <strong>{{ getBatchTitle(taskBatchResults.batch.batchType) }}</strong>
                <span>
                  共 {{ taskBatchResults.batch.totalCount }} 个，成功
                  {{ taskBatchResults.batch.successCount }}，需人工
                  {{ taskBatchResults.batch.manualRequiredCount }}，失败
                  {{ taskBatchResults.batch.failedCount }}
                </span>
              </div>
              <StatusChip :tone="getStatusTone(taskBatchResults.batch.status)" dot>
                {{ getStatusLabel(taskBatchResults.batch.status) }}
              </StatusChip>
            </div>
            <el-table
              v-loading="
                runningAction === 'status' || runningAction === 'balance' || taskBatchPolling
              "
              class="desktop-data-table"
              :data="taskBatchResults.items"
              row-key="taskId"
              empty-text="暂无查询结果"
            >
              <el-table-column label="Apple ID" min-width="190">
                <template #default="{ row }">
                  <strong>{{ row.appleAccount?.appleIdMasked ?? '-' }}</strong>
                  <div class="muted-block">
                    {{ formatAccountRegion(row.appleAccount?.region) }} /
                    {{ row.currency || row.appleAccount?.currency || '-' }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="查询结果" min-width="150">
                <template #default="{ row }">
                  <StatusChip :tone="getStatusTone(row.status)" dot>
                    {{ getBatchRowResultLabel(row) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="系统余额" width="120">
                <template #default="{ row }">{{ row.systemBalance ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="查询余额" width="120">
                <template #default="{ row }">{{ row.checkedBalance ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="来源" width="130">
                <template #default="{ row }">{{ getResultSourceLabel(row.resultSource) }}</template>
              </el-table-column>
              <el-table-column label="建议" min-width="170">
                <template #default="{ row }">{{
                  row.errorMessage || row.suggestedAction
                }}</template>
              </el-table-column>
              <el-table-column label="完成时间" min-width="170">
                <template #default="{ row }">{{
                  formatDate(row.finishedAt || row.createdAt)
                }}</template>
              </el-table-column>
            </el-table>
          </div>

          <div v-if="officialCheckResults" class="automation-result-block">
            <div class="automation-result-block__head">
              <div>
                <strong>官方价格巡检结果</strong>
                <span>
                  没变 {{ officialCheckResults.summary.unchangedCount }}，变动
                  {{ officialCheckResults.summary.changedCount }}，新套餐
                  {{ officialCheckResults.summary.newPlanCount }}，下架
                  {{ officialCheckResults.summary.removedPlanCount }}
                </span>
              </div>
              <StatusChip :tone="getStatusTone(officialCheckResults.batch.status)" dot>
                {{ getStatusLabel(officialCheckResults.batch.status) }}
              </StatusChip>
            </div>
            <el-table
              v-loading="runningAction === 'official'"
              class="desktop-data-table"
              :data="officialCheckResults.items"
              row-key="id"
              empty-text="暂无价格巡检结果"
            >
              <el-table-column label="套餐" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <strong>{{ row.serviceName }}</strong>
                  <div class="muted-block">
                    {{ getProviderLabel(row.provider) }} · {{ row.category }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="国家/币种" width="130">
                <template #default="{ row }">
                  {{ formatAccountRegion(row.region) }} / {{ row.currency }}
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <StatusChip :tone="getOfficialResultTone(row.status)" dot>
                    {{ getOfficialResultLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="系统当前" width="130">
                <template #default="{ row }">{{ row.oldOfficialPrice ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="官方最新" width="130">
                <template #default="{ row }">{{ row.newOfficialPrice ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="Apple余额价" width="140">
                <template #default="{ row }">{{ row.newAppleBalancePrice ?? '-' }}</template>
              </el-table-column>
              <el-table-column label="说明" min-width="190" show-overflow-tooltip>
                <template #default="{ row }">{{ row.message || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="170" fixed="right">
                <template #default="{ row }">
                  <div class="table-action-group">
                    <AppButton
                      v-if="row.reviewId && row.reviewStatus === 'pending'"
                      size="small"
                      variant="primary"
                      :loading="officialReviewActionId === row.reviewId"
                      @click="approveOfficialResult(row)"
                    >
                      确认
                    </AppButton>
                    <AppButton
                      v-if="row.reviewId && row.reviewStatus === 'pending'"
                      size="small"
                      variant="ghost"
                      :loading="officialReviewActionId === row.reviewId"
                      @click="ignoreOfficialResult(row)"
                    >
                      忽略
                    </AppButton>
                    <span v-if="!row.reviewId || row.reviewStatus !== 'pending'">-</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div v-if="!taskBatchResults && !officialCheckResults" class="apple-core-empty-state">
            <strong>还没有本次结果</strong>
            <span>从“开始操作”里选择一个动作，完成后会在这里看到数据表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="primary" @click="activeTab = 'start'">去开始操作</AppButton>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="人工处理" name="manual">
          <div class="automation-result-block">
            <div class="automation-result-block__head">
              <div>
                <strong>需要人工处理的任务</strong>
                <span>只放失败、待复核、等待人工验证的任务，避免淹没在全部记录里。</span>
              </div>
              <StatusChip :tone="manualTasks.length ? 'orange' : 'green'">
                {{ manualTasks.length ? `待处理 ${manualTasks.length}` : '已清空' }}
              </StatusChip>
            </div>
            <el-table
              v-loading="loading"
              class="desktop-data-table"
              :data="manualTasks"
              row-key="id"
              empty-text="暂无人工待处理任务"
            >
              <el-table-column label="任务" min-width="150">
                <template #default="{ row }">
                  <strong>{{ getTaskTypeLabel(row.taskType) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="Apple ID" min-width="180">
                <template #default="{ row }">
                  {{ row.appleAccount.appleIdMasked }}
                  <div class="muted-block">{{ formatAccountRegion(row.appleAccount.region) }}</div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130">
                <template #default="{ row }">
                  <StatusChip :tone="getStatusTone(row.status)" dot>
                    {{ getStatusLabel(row.status) }}
                  </StatusChip>
                </template>
              </el-table-column>
              <el-table-column label="原因" min-width="260" show-overflow-tooltip>
                <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
              </el-table-column>
              <el-table-column label="操作" width="230" fixed="right">
                <template #default="{ row }">
                  <div class="table-action-group table-action-group--wrap">
                    <AppButton size="small" variant="ghost" @click="openDetail(row)"
                      >详情</AppButton
                    >
                    <AppButton
                      size="small"
                      :disabled="!canRetry(row)"
                      :loading="actionLoadingId === row.id"
                      @click="retryTask(row)"
                    >
                      重试
                    </AppButton>
                    <AppButton size="small" variant="primary" @click="openDetail(row)">
                      回写
                    </AppButton>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="执行记录" name="history">
          <div class="automation-history-toolbar">
            <el-input
              v-model.trim="query.keyword"
              class="automation-history-toolbar__search"
              clearable
              placeholder="搜索 Apple ID、任务、错误说明"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-select
              v-model="query.taskType"
              class="automation-history-toolbar__select"
              clearable
              placeholder="任务类型"
              @change="handleSearch"
            >
              <el-option
                v-for="item in taskTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="query.status"
              class="automation-history-toolbar__select"
              clearable
              placeholder="状态"
              @change="handleSearch"
            >
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <AppButton variant="soft" @click="() => loadTasks()">刷新</AppButton>
            <AppButton variant="ghost" @click="exportList">导出</AppButton>
          </div>

          <el-table
            v-loading="loading"
            class="desktop-data-table"
            :data="tasks"
            row-key="id"
            empty-text="暂无执行记录"
            @sort-change="handleSortChange"
          >
            <el-table-column label="任务" min-width="150" sortable="custom" prop="taskType">
              <template #default="{ row }">
                <strong>{{ getTaskTypeLabel(row.taskType) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                {{ row.appleAccount.appleIdMasked }}
                <div class="muted-block">
                  {{ formatAccountRegion(row.appleAccount.region) }} / 余额
                  {{ row.appleAccount.currentBalance }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="130" sortable="custom" prop="status">
              <template #default="{ row }">
                <StatusChip :tone="getStatusTone(row.status)" dot>
                  {{ getStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="结果/异常" min-width="260" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.errorMessage || (row.resultPayload ? '已有结果' : '-') }}
                <div v-if="row.manualRequired" class="muted-block">等待人工验证</div>
              </template>
            </el-table-column>
            <el-table-column label="时间" min-width="170" sortable="custom" prop="createdAt">
              <template #default="{ row }">
                {{ formatDate(row.createdAt) }}
                <div class="muted-block">完成 {{ formatDate(row.finishedAt) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="250" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
                  <AppButton
                    size="small"
                    variant="success"
                    :disabled="!canRun(row)"
                    :loading="actionLoadingId === row.id"
                    @click="runPlaceholder(row)"
                  >
                    执行
                  </AppButton>
                  <AppButton
                    size="small"
                    :disabled="!canRetry(row)"
                    :loading="actionLoadingId === row.id"
                    @click="retryTask(row)"
                  >
                    重试
                  </AppButton>
                  <AppButton
                    size="small"
                    variant="soft"
                    :disabled="isFinalStatus(row.status)"
                    @click="markManual(row)"
                  >
                    转人工
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <PaginationBar
            v-model:page="query.page"
            v-model:page-size="query.pageSize"
            :total="total"
            @change="loadTasks"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <AppDrawer
      v-model="detailDrawerVisible"
      :title="selectedTask ? `任务详情 · ${getTaskTypeLabel(selectedTask.taskType)}` : '任务详情'"
      confirm-text="刷新详情"
      size="760px"
      @confirm="refreshDetail"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>Apple ID</span>
          <strong>{{ selectedTask?.appleAccount.appleIdMasked ?? '-' }}</strong>
        </div>
        <div>
          <span>任务类型</span>
          <strong>{{ selectedTask ? getTaskTypeLabel(selectedTask.taskType) : '-' }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ selectedTask ? getStatusLabel(selectedTask.status) : '-' }}</strong>
        </div>
        <div>
          <span>重试次数</span>
          <strong>{{ selectedTask?.retryCount ?? '-' }}</strong>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">处理动作</div>
        <div class="drawer-inline-actions drawer-inline-actions--inside">
          <AppButton
            variant="success"
            :disabled="!selectedTask || !canRun(selectedTask)"
            :loading="Boolean(selectedTask && actionLoadingId === selectedTask.id)"
            @click="selectedTask && runPlaceholder(selectedTask)"
          >
            执行任务
          </AppButton>
          <AppButton
            :disabled="!selectedTask || !canRetry(selectedTask)"
            :loading="Boolean(selectedTask && actionLoadingId === selectedTask.id)"
            @click="selectedTask && retryTask(selectedTask)"
          >
            重新入队
          </AppButton>
          <AppButton :disabled="!selectedTask" @click="writeSuccessResult">回写成功</AppButton>
          <AppButton variant="danger" :disabled="!selectedTask" @click="writeFailedResult">
            回写失败
          </AppButton>
          <AppButton
            variant="danger"
            :disabled="!selectedTask || isFinalStatus(selectedTask.status)"
            @click="selectedTask && cancelTask(selectedTask)"
          >
            取消任务
          </AppButton>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">异常说明</div>
        <el-descriptions class="detail-descriptions" :column="1" border>
          <el-descriptions-item label="说明">
            {{ selectedTask?.errorMessage ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ selectedTask?.createdBy?.displayName ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="drawer-section">
        <div class="drawer-section__title">任务日志</div>
        <el-table class="desktop-data-table" :data="selectedTask?.logs ?? []" row-key="id">
          <el-table-column label="级别" width="90">
            <template #default="{ row }">
              <StatusChip :tone="getLogTone(row.level)" dot>
                {{ row.level }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="日志" min-width="260">
            <template #default="{ row }">
              {{ row.message }}
              <div v-if="row.screenshotAttachment" class="muted-block">
                截图 {{ row.screenshotAttachment.originalName }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <div
        v-if="selectedTaskTechnicalRows.length || selectedTask?.resultPayload"
        class="drawer-section"
      >
        <div class="drawer-section__title">技术信息</div>
        <el-collapse class="technical-info-collapse">
          <el-collapse-item title="展开查看内部排查信息" name="technical">
            <el-descriptions
              v-if="selectedTaskTechnicalRows.length"
              class="detail-descriptions"
              :column="1"
              border
            >
              <el-descriptions-item
                v-for="item in selectedTaskTechnicalRows"
                :key="item.key"
                :label="item.label"
              >
                {{ item.value }}
              </el-descriptions-item>
            </el-descriptions>
            <div v-if="selectedTask?.resultPayload" class="technical-json-block">
              <div class="drawer-section__description">原始结果数据</div>
              <pre class="json-preview">{{ formatJson(selectedTask.resultPayload) }}</pre>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </AppDrawer>

    <el-dialog
      v-model="gatewaySubscriptionDialogVisible"
      title="Apple 出口节点订阅"
      width="min(600px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required label="订阅 URL">
          <el-input
            v-model="gatewaySubscriptionForm.url"
            type="password"
            show-password
            placeholder="https://example.com/sub?token=..."
            @keyup.enter="saveGatewaySubscription"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="gatewaySubscriptionDialogVisible = false">取消</AppButton>
        <AppButton
          variant="primary"
          :loading="gatewaySubscriptionSaving"
          @click="saveGatewaySubscription"
        >
          保存并同步
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="advancedDialogVisible"
      :title="`创建${getTaskTypeLabel(advancedForm.taskType)}任务`"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required label="Apple ID">
          <el-select
            v-model="advancedForm.appleAccountId"
            class="full-width"
            filterable
            placeholder="选择 Apple ID"
            remote
            remote-show-suffix
            :loading="accountOptionsLoading"
            :remote-method="searchAppleAccountOptions"
            @visible-change="handleAppleAccountOptionsVisible"
          >
            <el-option
              v-for="account in appleAccountOptions"
              :key="account.id"
              :label="formatAccountOption(account)"
              :value="account.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="advancedForm.priority" class="full-width">
            <el-option
              v-for="item in priorityOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-alert
          title="该动作需要真实自动化 Worker 或人工兜底；创建后会进入人工处理/执行记录，不会伪装成已自动完成。"
          type="warning"
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <AppButton @click="advancedDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="savingAdvanced" @click="createAdvancedTask">
          创建任务
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { getApiErrorMessage } from '@/api/client';
import {
  appleAccountsApi,
  appleAutomationTasksApi,
  appleOfficialPricesApi,
  opsApi,
  type AppleAutomationTaskQuery,
  type AppleOfficialPriceProviderCatalogProvider
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useAuthenticatedPageLoader } from '@/composables/useAuthenticatedPageLoader';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppleAccountOption,
  AppleAutomationTask,
  AppleAutomationTaskBatchResults,
  AppleAutomationWorkbenchCapability,
  AppleAutomationWorkbenchStatus,
  AppleOfficialPriceCheckBatchResultRow,
  AppleOfficialPriceCheckBatchResults,
  AutomationTaskPriority,
  AutomationTaskStatus,
  AutomationTaskType,
  PageResult
} from '@/types/system';
import { appleAccountRegionOptions, formatAppleRegionLabel } from '@/utils/appleAccountRegion';
import { buildTechnicalFieldRows } from '@/utils/internalTechnicalFields';
import {
  createSmartQueryKey,
  getSmartQueryData,
  invalidateSmartQueries,
  refreshSmartQuery
} from '@/utils/smartQuery';

const ACCOUNT_OPTIONS_PAGE_SIZE = 20;
const ACCOUNT_OPTIONS_DEBOUNCE_MS = 300;
const fallbackOfficialRegionOptions: AppleOfficialPriceProviderCatalogProvider['regions'] = [
  { label: '美国 USD', value: 'US:USD', region: 'US', currency: 'USD', sourceUrl: '' },
  { label: '马来西亚 MYR', value: 'MY:MYR', region: 'MY', currency: 'MYR', sourceUrl: '' },
  { label: '新加坡 SGD', value: 'SG:SGD', region: 'SG', currency: 'SGD', sourceUrl: '' },
  { label: '中国香港 HKD', value: 'HK:HKD', region: 'HK', currency: 'HKD', sourceUrl: '' },
  { label: '日本 JPY', value: 'JP:JPY', region: 'JP', currency: 'JPY', sourceUrl: '' },
  { label: '英国 GBP', value: 'GB:GBP', region: 'GB', currency: 'GBP', sourceUrl: '' }
];
const fallbackOfficialProviderOptions: AppleOfficialPriceProviderCatalogProvider[] = [
  {
    label: 'ChatGPT / OpenAI',
    shortLabel: 'ChatGPT',
    value: 'chatgpt',
    sourceUrl: 'https://openai.com/chatgpt/pricing/',
    regions: fallbackOfficialRegionOptions
  },
  {
    label: 'Gemini / Google',
    shortLabel: 'Gemini',
    value: 'gemini',
    sourceUrl: 'https://gemini.google/advanced/',
    regions: fallbackOfficialRegionOptions
  },
  {
    label: 'Claude / Anthropic',
    shortLabel: 'Claude',
    value: 'claude',
    sourceUrl: 'https://www.anthropic.com/pricing',
    regions: fallbackOfficialRegionOptions
  }
];

const tasks = ref<AppleAutomationTask[]>([]);
const tasksLoaded = ref(false);
const appleAccountOptions = ref<AppleAccountOption[]>([]);
const accountOptionsLoading = ref(false);
const accountOptionsLoaded = ref(false);
const total = ref(0);
const loading = ref(false);
const activeTab = ref<'start' | 'results' | 'manual' | 'history'>('start');
const runningAction = ref<'status' | 'balance' | 'official' | ''>('');
const taskBatchResults = ref<AppleAutomationTaskBatchResults | null>(null);
const taskBatchPolling = ref(false);
const officialCheckResults = ref<AppleOfficialPriceCheckBatchResults | null>(null);
const workbenchStatus = ref<AppleAutomationWorkbenchStatus | null>(null);
const workbenchStatusLoading = ref(false);
const officialProviderOptions = ref<AppleOfficialPriceProviderCatalogProvider[]>(
  fallbackOfficialProviderOptions
);
const officialReviewActionId = ref('');
const detailDrawerVisible = ref(false);
const selectedTask = ref<AppleAutomationTask | null>(null);
const actionLoadingId = ref('');
const advancedDialogVisible = ref(false);
const savingAdvanced = ref(false);
const gatewaySubscriptionDialogVisible = ref(false);
const gatewaySubscriptionSaving = ref(false);
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const activeTasksQueryKey = ref('');
let taskBatchPollTimer: ReturnType<typeof setTimeout> | null = null;
let officialPollTimer: ReturnType<typeof setTimeout> | null = null;
let accountOptionsSearchTimer: ReturnType<typeof setTimeout> | null = null;

const query = reactive<AppleAutomationTaskQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  taskType: '',
  status: '',
  priority: '',
  appleAccountId: '',
  manualRequired: ''
});

const statusCheckForm = reactive<{
  appleAccountIds: string[];
  priority: AutomationTaskPriority;
  gatewayRegion: string;
  note: string;
}>({
  appleAccountIds: [],
  priority: 'medium',
  gatewayRegion: 'US',
  note: ''
});

const balanceCheckForm = reactive<{
  appleAccountIds: string[];
  priority: AutomationTaskPriority;
  note: string;
}>({
  appleAccountIds: [],
  priority: 'medium',
  note: ''
});

const officialCheckForm = reactive<{
  provider: string;
  regions: string[];
}>({
  provider: 'all',
  regions: []
});

const advancedForm = reactive<{
  taskType: AutomationTaskType;
  appleAccountId: string;
  priority: AutomationTaskPriority;
}>({
  taskType: 'topup',
  appleAccountId: '',
  priority: 'medium'
});

const gatewaySubscriptionForm = reactive({
  url: ''
});

const taskTypeOptions: Array<{ label: string; value: AutomationTaskType }> = [
  { label: '检测状态', value: 'check_status' },
  { label: '查询余额', value: 'check_balance' },
  { label: '自动充值', value: 'topup' },
  { label: '取消订阅', value: 'cancel_subscription' },
  { label: '修改手机号', value: 'change_phone' },
  { label: '修改密保', value: 'change_security' },
  { label: '检查续费', value: 'check_renewal' },
  { label: '官方价格巡检', value: 'official_price_check' }
];

const statusOptions: Array<{ label: string; value: AutomationTaskStatus }> = [
  { label: '待处理', value: 'pending' },
  { label: '队列中', value: 'queued' },
  { label: '运行中', value: 'running' },
  { label: '等待人工验证', value: 'waiting_manual_verify' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' },
  { label: '已取消', value: 'cancelled' },
  { label: '需复核', value: 'need_review' }
];

const priorityOptions: Array<{ label: string; value: AutomationTaskPriority }> = [
  { label: '紧急', value: 'urgent' },
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' }
];

const gatewayRegionOptions = appleAccountRegionOptions.map((item) => ({
  label: formatAppleRegionLabel(item.code),
  value: item.code
}));

const officialRegionOptions = computed(() => {
  const regions = officialProviderOptions.value.flatMap((provider) =>
    Array.isArray(provider.regions) ? provider.regions : []
  );
  const unique = new Map(regions.map((region) => [region.value, region]));
  return Array.from(unique.values()).map((region) => ({
    label: `${region.label} / ${region.currency}`,
    value: region.value,
    region: region.region,
    currency: region.currency
  }));
});

const listQueuedCount = computed(
  () => tasks.value.filter((task) => task.status === 'pending' || task.status === 'queued').length
);
const listManualCount = computed(() => tasks.value.filter((task) => task.manualRequired).length);
const listFailedCount = computed(
  () =>
    tasks.value.filter((task) => task.status === 'failed' || task.status === 'need_review').length
);
const listRunningCount = computed(
  () => tasks.value.filter((task) => task.status === 'running').length
);
const workbenchCapabilities = computed(() =>
  [
    workbenchStatus.value?.statusCheck,
    workbenchStatus.value?.balanceCheck,
    workbenchStatus.value?.officialPriceCheck
  ].filter((item): item is AppleAutomationWorkbenchCapability => Boolean(item))
);
const workbenchQueuedCount = computed(() =>
  workbenchCapabilities.value.reduce((sum, item) => sum + item.queuedCount, 0)
);
const workbenchRunningCount = computed(() =>
  workbenchCapabilities.value.reduce((sum, item) => sum + item.runningCount, 0)
);
const workbenchManualCount = computed(() =>
  workbenchCapabilities.value.reduce((sum, item) => sum + item.manualRequiredCount, 0)
);
const workbenchFailedCount = computed(() =>
  workbenchCapabilities.value.reduce((sum, item) => sum + item.failedCount, 0)
);
const queuedCount = computed(() =>
  tasksLoaded.value ? listQueuedCount.value : workbenchQueuedCount.value
);
const manualCount = computed(() =>
  tasksLoaded.value ? listManualCount.value : workbenchManualCount.value
);
const failedCount = computed(() =>
  tasksLoaded.value ? listFailedCount.value : workbenchFailedCount.value
);
const runningCount = computed(() =>
  tasksLoaded.value ? listRunningCount.value : workbenchRunningCount.value
);
const displayTaskTotal = computed(() =>
  tasksLoaded.value
    ? total.value
    : queuedCount.value + runningCount.value + manualCount.value + failedCount.value
);
const manualTasks = computed(() =>
  tasks.value.filter(
    (task) =>
      task.manualRequired ||
      task.status === 'failed' ||
      task.status === 'need_review' ||
      task.status === 'waiting_manual_verify'
  )
);
const selectedTaskTechnicalRows = computed(() =>
  selectedTask.value
    ? buildTechnicalFieldRows({
        taskId: selectedTask.value.id,
        queueJobId: selectedTask.value.queueJobId,
        errorCode: selectedTask.value.errorCode
      })
    : []
);
const needsGatewaySubscription = computed(() => {
  const capability = workbenchStatus.value?.statusCheck;
  return Boolean(capability && !capability.gatewayConfigured);
});
useAuthenticatedPageLoader(async () => {
  void loadOfficialProviders({ background: true });
  await loadWorkbenchStatus();
});

watch(activeTab, (tab) => {
  if (tab === 'manual' || tab === 'history') {
    void loadTasks({ force: false });
  }
});

function buildTaskParams(): AppleAutomationTaskQuery {
  return {
    ...query,
    keyword: query.keyword || undefined,
    taskType: query.taskType || undefined,
    status: query.status || undefined,
    priority: query.priority || undefined,
    appleAccountId: query.appleAccountId || undefined,
    manualRequired: query.manualRequired || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyTaskResult(data: PageResult<AppleAutomationTask>) {
  tasks.value = Array.isArray(data.items) ? data.items : [];
  total.value = Number.isFinite(Number(data.total)) ? data.total : tasks.value.length;
  tasksLoaded.value = true;
}

async function loadTasks(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildTaskParams();
  const key = createSmartQueryKey('apple-automation-tasks', params);
  const cached = getSmartQueryData<PageResult<AppleAutomationTask>>(key);

  activeTasksQueryKey.value = key;

  if (cached) {
    applyTaskResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery<PageResult<AppleAutomationTask>>({
      key,
      fetcher: ({ signal }) => appleAutomationTasksApi.list(params, { signal }),
      force: options.force ?? true,
      trackActivity: !options.background
    });

    if (activeTasksQueryKey.value !== key) return;
    if (result.changed || !cached) {
      applyTaskResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载自动化任务失败');
    }
  } finally {
    if (activeTasksQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function loadAppleAccountOptions(
  keyword = '',
  options: { force?: boolean; background?: boolean } = {}
) {
  const params = {
    page: 1,
    pageSize: ACCOUNT_OPTIONS_PAGE_SIZE,
    keyword,
    status: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as const
  };
  const key = createSmartQueryKey('apple-account-options', params);
  const cached = getSmartQueryData<PageResult<AppleAccountOption>>(key);

  if (cached) {
    mergeAppleAccountOptions(cached.items);
  }

  accountOptionsLoading.value = !cached && !options.background;
  try {
    const result = await refreshSmartQuery<PageResult<AppleAccountOption>>({
      key,
      fetcher: ({ signal }) => appleAccountsApi.options(params, { signal }),
      force: options.force ?? false,
      staleMs: 60_000,
      trackActivity: false
    });
    mergeAppleAccountOptions(result.data.items);
    accountOptionsLoaded.value = true;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 选项失败');
    }
  } finally {
    accountOptionsLoading.value = false;
  }
}

function mergeAppleAccountOptions(options: AppleAccountOption[]) {
  const selectedIds = new Set(
    [
      ...statusCheckForm.appleAccountIds,
      ...balanceCheckForm.appleAccountIds,
      advancedForm.appleAccountId
    ].filter(Boolean)
  );
  const selectedOptions = appleAccountOptions.value.filter((account) =>
    selectedIds.has(account.id)
  );
  const merged = new Map<string, AppleAccountOption>();

  for (const account of [...selectedOptions, ...options]) {
    merged.set(account.id, account);
  }

  appleAccountOptions.value = Array.from(merged.values());
}

function searchAppleAccountOptions(keyword: string) {
  if (accountOptionsSearchTimer) {
    clearTimeout(accountOptionsSearchTimer);
  }

  accountOptionsSearchTimer = setTimeout(() => {
    accountOptionsSearchTimer = null;
    void loadAppleAccountOptions(keyword.trim(), { force: true });
  }, ACCOUNT_OPTIONS_DEBOUNCE_MS);
}

function handleAppleAccountOptionsVisible(visible: boolean) {
  if (visible && !accountOptionsLoaded.value) {
    void loadAppleAccountOptions('', { force: false });
  }
}

async function loadOfficialProviders(options: { background?: boolean } = {}) {
  try {
    const catalog = await appleOfficialPricesApi.listProviders();
    const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
    officialProviderOptions.value = providers.length
      ? mergeOfficialProviderOptions(providers)
      : fallbackOfficialProviderOptions;
  } catch (error) {
    officialProviderOptions.value = fallbackOfficialProviderOptions;
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载官方价格供应商失败');
    }
  }
}

function mergeOfficialProviderOptions(
  providers: AppleOfficialPriceProviderCatalogProvider[]
): AppleOfficialPriceProviderCatalogProvider[] {
  const merged = new Map<string, AppleOfficialPriceProviderCatalogProvider>();

  for (const provider of fallbackOfficialProviderOptions) {
    merged.set(provider.value, provider);
  }

  for (const provider of providers) {
    const fallback = merged.get(provider.value);
    const regions =
      Array.isArray(provider.regions) && provider.regions.length
        ? provider.regions
        : (fallback?.regions ?? fallbackOfficialRegionOptions);
    merged.set(provider.value, {
      ...fallback,
      ...provider,
      regions
    });
  }

  return Array.from(merged.values());
}

async function loadWorkbenchStatus(options: { background?: boolean } = {}) {
  workbenchStatusLoading.value = !options.background;
  try {
    workbenchStatus.value = await appleAutomationTasksApi.workbenchStatus();
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载自动化能力状态失败');
    }
  } finally {
    workbenchStatusLoading.value = false;
  }
}

async function handleSearch() {
  query.page = 1;
  await loadTasks();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadTasks();
}

async function startStatusCheck() {
  if (!statusCheckForm.appleAccountIds.length) {
    ElMessage.warning('请先选择要检查的 Apple ID');
    return;
  }

  runningAction.value = 'status';
  try {
    taskBatchResults.value = await appleAutomationTasksApi.createStatusCheckBatch({
      appleAccountIds: statusCheckForm.appleAccountIds,
      priority: statusCheckForm.priority,
      gatewayRegion: statusCheckForm.gatewayRegion,
      note: statusCheckForm.note.trim() || null
    });
    activeTab.value = 'results';
    query.taskType = 'check_status';
    query.page = 1;
    startTaskBatchPolling(taskBatchResults.value.batch.id);
    void loadTasks({ background: true, force: true });
    void loadWorkbenchStatus({ background: true });
    ElMessage.success('批量状态查询已创建，结果表会自动刷新');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量状态查询失败');
  } finally {
    runningAction.value = '';
  }
}

async function startBalanceCheck() {
  if (!balanceCheckForm.appleAccountIds.length) {
    ElMessage.warning('请先选择要查询余额的 Apple ID');
    return;
  }

  clearTaskBatchPollTimer();
  runningAction.value = 'balance';
  try {
    taskBatchResults.value = await appleAutomationTasksApi.createBalanceCheckBatch({
      appleAccountIds: balanceCheckForm.appleAccountIds,
      priority: balanceCheckForm.priority,
      note: balanceCheckForm.note.trim() || null
    });
    activeTab.value = 'results';
    query.taskType = 'check_balance';
    query.page = 1;
    void loadTasks({ background: true, force: true });
    void loadWorkbenchStatus({ background: true });
    ElMessage.success('批量余额查询已完成');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '批量余额查询失败');
  } finally {
    runningAction.value = '';
  }
}

async function startOfficialPriceCheck() {
  runningAction.value = 'official';
  clearOfficialPollTimer();

  try {
    const payload = {
      trigger: 'manual' as const,
      scanRemovedPlans: false,
      regions: buildOfficialRegionsPayload()
    };
    const batch =
      officialCheckForm.provider === 'all'
        ? await appleOfficialPricesApi.startAllProvidersCheckBatch(payload)
        : await appleOfficialPricesApi.startProviderCheckBatch(officialCheckForm.provider, payload);
    activeTab.value = 'results';
    await pollOfficialBatchResults(batch.id);
    ElMessage.success(batch.message || '官方价格巡检已开始');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '官方价格巡检失败');
    runningAction.value = '';
  }
}

function openGatewaySubscriptionDialog() {
  gatewaySubscriptionForm.url = '';
  gatewaySubscriptionDialogVisible.value = true;
}

async function saveGatewaySubscription() {
  const subscriptionUrl = gatewaySubscriptionForm.url.trim();
  if (!subscriptionUrl) {
    ElMessage.warning('请先粘贴节点订阅 URL');
    return;
  }

  gatewaySubscriptionSaving.value = true;
  try {
    await opsApi.saveAppleWebGatewaySubscription({ subscriptionUrl });
    invalidateSmartQueries('ops-apple-web-gateways');

    const gatewayStatus = await opsApi.syncAppleWebGateways();
    invalidateSmartQueries('ops-apple-web-gateways');
    invalidateSmartQueries('ops-platform-sync');
    await loadWorkbenchStatus({ background: true });

    const usNodeCount = gatewayStatus.nodes.filter(
      (node) => node.countryCode === 'US' && node.status !== 'unavailable'
    ).length;

    gatewaySubscriptionDialogVisible.value = false;
    gatewaySubscriptionForm.url = '';

    if (usNodeCount > 0) {
      ElMessage.success(`节点订阅已同步，识别到 ${usNodeCount} 个 US 节点`);
      return;
    }

    ElMessage.warning('订阅已同步，但没有识别到可用 US 节点');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  } finally {
    gatewaySubscriptionSaving.value = false;
  }
}

function buildOfficialRegionsPayload() {
  const selected = officialRegionOptions.value.filter((region) =>
    officialCheckForm.regions.includes(region.value)
  );
  return selected.length
    ? selected.map((region) => ({ region: region.region, currency: region.currency }))
    : undefined;
}

function startTaskBatchPolling(batchId: string) {
  clearTaskBatchPollTimer();
  void pollTaskBatchResults(batchId);
}

async function pollTaskBatchResults(batchId: string) {
  taskBatchPolling.value = true;
  try {
    const result = await appleAutomationTasksApi.getBatchResults(batchId);
    taskBatchResults.value = result;
    await loadWorkbenchStatus({ background: true });

    if (isPollingBatchStatus(result.batch.status)) {
      taskBatchPollTimer = setTimeout(() => {
        taskBatchPollTimer = null;
        void pollTaskBatchResults(batchId);
      }, 2000);
      return;
    }

    await loadTasks({ background: true, force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新批量查询结果失败');
  } finally {
    if (!taskBatchPollTimer) {
      taskBatchPolling.value = false;
    }
  }
}

function isPollingBatchStatus(status: AutomationTaskStatus) {
  return status === 'pending' || status === 'queued' || status === 'running';
}

function clearTaskBatchPollTimer() {
  if (taskBatchPollTimer) {
    clearTimeout(taskBatchPollTimer);
    taskBatchPollTimer = null;
  }
}

async function pollOfficialBatchResults(batchId: string) {
  officialCheckResults.value = await appleOfficialPricesApi.getCheckBatchResults(batchId);
  void loadWorkbenchStatus({ background: true });
  const status = officialCheckResults.value.batch.status;
  if (status === 'queued' || status === 'running' || status === 'pending') {
    officialPollTimer = setTimeout(() => {
      void pollOfficialBatchResults(batchId);
    }, 1500);
    return;
  }
  runningAction.value = '';
}

function clearOfficialPollTimer() {
  if (officialPollTimer) {
    clearTimeout(officialPollTimer);
    officialPollTimer = null;
  }
}

function openAdvancedTask(taskType: AutomationTaskType) {
  advancedForm.taskType = taskType;
  advancedForm.priority = taskType === 'topup' ? 'high' : 'medium';
  void loadAppleAccountOptions('', { force: false });
  advancedDialogVisible.value = true;
}

async function createAdvancedTask() {
  if (!advancedForm.appleAccountId) {
    ElMessage.warning('请先选择 Apple ID');
    return;
  }

  savingAdvanced.value = true;
  try {
    const created = await appleAutomationTasksApi.create({
      taskType: advancedForm.taskType,
      appleAccountId: advancedForm.appleAccountId,
      priority: advancedForm.priority,
      inputPayload: {
        source: 'automation_workbench',
        requiresRealWorkerOrManualFallback: true
      }
    });
    selectedTask.value = created;
    advancedDialogVisible.value = false;
    activeTab.value = 'manual';
    await loadTasks({ force: true });
    void loadWorkbenchStatus({ background: true });
    ElMessage.success('任务已创建，已进入执行记录/人工处理');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建任务失败');
  } finally {
    savingAdvanced.value = false;
  }
}

async function approveOfficialResult(row: AppleOfficialPriceCheckBatchResultRow) {
  if (!row.reviewId) return;
  try {
    const confirmed = await ElMessageBox.confirm(
      '确认后会同步 Apple ID 业务设置里的官方价格和 Apple 余额价，确认继续吗？',
      '确认同步价格',
      {
        type: 'warning',
        confirmButtonText: '确认同步',
        cancelButtonText: '返回'
      }
    );
    if (!confirmed) return;
    officialReviewActionId.value = row.reviewId;
    await appleOfficialPricesApi.approveReview(row.reviewId);
    ElMessage.success('已同步到业务设置');
    await refreshCurrentOfficialResults();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '确认价格变化失败');
    }
  } finally {
    officialReviewActionId.value = '';
  }
}

async function ignoreOfficialResult(row: AppleOfficialPriceCheckBatchResultRow) {
  if (!row.reviewId) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入忽略原因，可留空', '忽略官方价格变化', {
      inputType: 'textarea',
      confirmButtonText: '忽略',
      cancelButtonText: '取消'
    });
    officialReviewActionId.value = row.reviewId;
    await appleOfficialPricesApi.ignoreReview(row.reviewId, value || null);
    ElMessage.success('已忽略该变化');
    await refreshCurrentOfficialResults();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '忽略价格变化失败');
    }
  } finally {
    officialReviewActionId.value = '';
  }
}

async function refreshCurrentOfficialResults() {
  if (!officialCheckResults.value) return;
  officialCheckResults.value = await appleOfficialPricesApi.getCheckBatchResults(
    officialCheckResults.value.batch.id
  );
}

async function openDetail(task: AppleAutomationTask) {
  try {
    selectedTask.value = await appleAutomationTasksApi.get(task.id);
    detailDrawerVisible.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载任务详情失败');
  }
}

async function refreshDetail() {
  if (!selectedTask.value) return;
  try {
    selectedTask.value = await appleAutomationTasksApi.get(selectedTask.value.id);
    await loadTasks();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新任务详情失败');
  }
}

async function runPlaceholder(task: AppleAutomationTask) {
  await runTaskAction(task.id, async () => {
    selectedTask.value = await appleAutomationTasksApi.runPlaceholder(task.id);
    ElMessage.success('任务已执行');
  });
}

async function retryTask(task: AppleAutomationTask) {
  await runTaskAction(task.id, async () => {
    selectedTask.value = await appleAutomationTasksApi.retry(task.id);
    ElMessage.success('任务已重新入队');
  });
}

async function cancelTask(task: AppleAutomationTask) {
  try {
    await ElMessageBox.confirm('取消后任务不会继续执行，确认取消吗？', '取消自动化任务', {
      type: 'warning',
      confirmButtonText: '确认取消',
      cancelButtonText: '返回'
    });
    await runTaskAction(task.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.cancel(task.id);
      ElMessage.success('任务已取消');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '取消任务失败');
    }
  }
}

async function markManual(task: AppleAutomationTask) {
  try {
    const { value } = await ElMessageBox.prompt('请输入转人工原因', '转人工验证', {
      inputType: 'textarea',
      confirmButtonText: '确认转人工',
      cancelButtonText: '取消'
    });
    await runTaskAction(task.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.markManual(task.id, {
        reason: value || '人工验证'
      });
      ElMessage.success('任务已转人工验证');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '转人工失败');
    }
  }
}

async function writeSuccessResult() {
  if (!selectedTask.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入结果 JSON', '回写成功结果', {
      inputType: 'textarea',
      inputValue: '{ "resultStatus": "normal" }',
      confirmButtonText: '回写成功',
      cancelButtonText: '取消'
    });
    const resultPayload = parseJsonPayload(value);
    if (resultPayload === false) return;
    await runTaskAction(selectedTask.value.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.writeResult(selectedTask.value!.id, {
        status: 'success',
        resultPayload
      });
      ElMessage.success('结果已回写');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '回写结果失败');
    }
  }
}

async function writeFailedResult() {
  if (!selectedTask.value) return;
  try {
    const { value } = await ElMessageBox.prompt('请输入失败原因', '回写失败结果', {
      inputType: 'textarea',
      confirmButtonText: '回写失败',
      cancelButtonText: '取消'
    });
    await runTaskAction(selectedTask.value.id, async () => {
      selectedTask.value = await appleAutomationTasksApi.writeResult(selectedTask.value!.id, {
        status: 'failed',
        errorCode: 'manual_writeback_failed',
        errorMessage: value || '人工回写失败'
      });
      ElMessage.success('失败结果已回写');
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '回写失败结果失败');
    }
  }
}

async function runTaskAction(taskId: string, action: () => Promise<void>) {
  actionLoadingId.value = taskId;
  try {
    await action();
    await loadTasks();
    if (selectedTask.value?.id === taskId) {
      selectedTask.value = await appleAutomationTasksApi.get(taskId);
    }
    if (taskBatchResults.value) {
      taskBatchResults.value = await appleAutomationTasksApi.getBatchResults(
        taskBatchResults.value.batch.id
      );
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '任务操作失败');
  } finally {
    actionLoadingId.value = '';
  }
}

function parseJsonPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    ElMessage.error('JSON 格式不正确');
    return false;
  }
}

function exportList() {
  ElMessage.info('Apple ID 自动化任务导出会进入数据中心导出任务，后续统一接入');
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value) return '-';
  return JSON.stringify(value, null, 2);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatAccountRegion(region: string | null | undefined) {
  return formatAppleRegionLabel(region);
}

function formatAccountOption(account: AppleAccountOption) {
  return `${account.appleIdMasked} / ${formatAccountRegion(account.region)} / 余额 ${
    account.currentBalance
  }`;
}

function getTaskTypeLabel(value: AutomationTaskType) {
  return taskTypeOptions.find((item) => item.value === value)?.label ?? value;
}

function getStatusLabel(value: AutomationTaskStatus) {
  return statusOptions.find((item) => item.value === value)?.label ?? value;
}

function getBatchTitle(value: string) {
  if (value === 'status_check') return '批量状态查询结果';
  if (value === 'balance_check') return '批量余额查询结果';
  return '自动化批次结果';
}

function getStatusTone(value: AutomationTaskStatus) {
  if (value === 'success') return 'green';
  if (value === 'failed' || value === 'need_review') return 'red';
  if (value === 'waiting_manual_verify' || value === 'running') return 'orange';
  if (value === 'cancelled' || value === 'skipped') return 'neutral';
  return 'blue';
}

function getCapabilityTone(capability?: AppleAutomationWorkbenchCapability | null) {
  if (!capability) return 'neutral';
  if (!capability.enabled || !capability.ready) return 'orange';
  if (capability.failedCount > 0) return 'red';
  if (capability.runningCount > 0 || capability.queuedCount > 0) return 'blue';
  return 'green';
}

function getStatusCheckAbilityLabel() {
  const capability = workbenchStatus.value?.statusCheck;
  if (!capability) return '读取中';
  if (!capability.enabled) return 'Worker 未开启';
  if (!capability.gatewayConfigured) return '缺少节点';
  return '可真查';
}

function getCapabilityModeLabel(value?: string) {
  if (value === 'apple_web_worker') return '官网 Worker';
  if (value === 'system_snapshot') return '系统快照';
  if (value === 'official_price_sources') return '来源巡检';
  return '读取中';
}

function getCapabilityWorkloadLabel(capability?: AppleAutomationWorkbenchCapability | null) {
  if (!capability) return '任务 -';
  const active = capability.queuedCount + capability.runningCount;
  const abnormal = capability.manualRequiredCount + capability.failedCount;
  return `进行中 ${active} / 待处理 ${abnormal}`;
}

function formatRegionList(values?: string[] | null) {
  if (!values?.length) return '-';
  return values.map((value) => formatAccountRegion(value)).join('、');
}

function getLogTone(value: string) {
  if (value === 'success') return 'green';
  if (value === 'error') return 'red';
  if (value === 'warning') return 'orange';
  return 'neutral';
}

function getResultSourceLabel(value: string) {
  if (value === 'system_snapshot') return '系统快照';
  if (value === 'official_web' || value === 'apple_web_worker') return '官网查询';
  if (value === 'manual_writeback') return '人工回写';
  return '任务结果';
}

function getBatchRowResultLabel(row: AppleAutomationTaskBatchResults['items'][number]) {
  if (row.errorMessage) return '异常';
  if (row.taskType === 'check_status') {
    return getAccountStatusLabel(row.resultStatus) || getStatusLabel(row.status);
  }
  if (row.taskType === 'check_balance') return row.checkedBalance ?? row.systemBalance ?? '-';
  return getStatusLabel(row.status);
}

function getAccountStatusLabel(value?: string | null) {
  if (!value) return '';
  return (
    {
      normal: '正常',
      need_verify: '需验证',
      locked: '已锁定',
      password_error: '密码错误',
      risk: '风险',
      unknown: '未知'
    }[value] ?? value
  );
}

function getProviderLabel(value: string) {
  const provider = officialProviderOptions.value.find((item) => item.value === value);
  return provider?.shortLabel || provider?.label || value;
}

function getOfficialResultLabel(value: string) {
  return (
    {
      unchanged: '没变动',
      price_changed: '价格变化',
      new_plan: '新套餐',
      removed_plan: '疑似下架',
      period_changed: '周期变化',
      currency_changed: '币种变化',
      failed: '失败',
      manual_required: '需人工'
    }[value] ?? value
  );
}

function getOfficialResultTone(value: string) {
  if (value === 'unchanged') return 'green';
  if (value === 'failed') return 'red';
  if (value === 'manual_required') return 'orange';
  return 'purple';
}

function canRun(task: AppleAutomationTask) {
  return ['pending', 'queued', 'failed', 'need_review'].includes(task.status);
}

function canRetry(task: AppleAutomationTask) {
  return ['failed', 'need_review', 'waiting_manual_verify', 'cancelled'].includes(task.status);
}

function isFinalStatus(value: AutomationTaskStatus) {
  return value === 'success' || value === 'cancelled' || value === 'skipped';
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['apple-automation-tasks'], () => {
  if (tasksLoaded.value || activeTab.value === 'manual' || activeTab.value === 'history') {
    void loadTasks({
      background: tasks.value.length > 0,
      force: true
    });
  }
  void loadWorkbenchStatus({ background: true });
  if (taskBatchResults.value?.batch.id) {
    void appleAutomationTasksApi
      .getBatchResults(taskBatchResults.value.batch.id)
      .then((result) => {
        taskBatchResults.value = result;
      })
      .catch(() => undefined);
  }
});

onBeforeUnmount(() => {
  stopRealtimeRefresh();
  clearTaskBatchPollTimer();
  clearOfficialPollTimer();
  if (accountOptionsSearchTimer) {
    clearTimeout(accountOptionsSearchTimer);
    accountOptionsSearchTimer = null;
  }
});
</script>

<style scoped>
.automation-workbench-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.automation-tabs {
  width: 100%;
}

.automation-readiness-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.automation-readiness-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-fill-color-extra-light);
}

.automation-readiness-card > div:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.automation-readiness-card strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.automation-readiness-card span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.automation-readiness-card__meta {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.automation-readiness-card__actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-start;
}

.automation-action-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.automation-action-card {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
}

.automation-action-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.automation-action-card__head > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.automation-action-card__head strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.automation-action-card__head span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.automation-action-card__button {
  margin-top: auto;
  width: 100%;
}

.automation-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.automation-secondary-actions,
.automation-result-block {
  margin-top: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
}

.automation-secondary-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.automation-secondary-actions > div:first-child,
.automation-result-block__head > div:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.automation-secondary-actions span,
.automation-result-block__head span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.automation-result-block__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.automation-history-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.automation-history-toolbar__search {
  width: min(360px, 100%);
}

.automation-history-toolbar__select {
  width: 160px;
}

.full-width {
  width: 100%;
}

@media (max-width: 1180px) {
  .automation-readiness-grid,
  .automation-action-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .automation-form-row,
  .automation-secondary-actions,
  .automation-result-block__head {
    grid-template-columns: 1fr;
  }

  .automation-secondary-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .automation-history-toolbar__search,
  .automation-history-toolbar__select {
    width: 100%;
  }
}
</style>
