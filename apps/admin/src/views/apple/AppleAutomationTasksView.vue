<template>
  <PageScaffold
    title="ID 自动化工作台"
    group="Apple ID 业务"
    phase="Phase 8"
    description="按要做的事开始操作：批量查状态、批量查余额、查礼品卡、巡检价格套餐；执行记录只保留为结果追踪和排查入口。"
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
          <StatusChip tone="orange">待执行 {{ queuedCount }}</StatusChip>
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

      <ListRequestError
        v-if="workbenchStatusLoadError"
        title="自动化能力状态加载失败"
        :message="workbenchStatusLoadError"
        @retry="() => loadWorkbenchStatus()"
      />

      <nav class="automation-feature-nav" aria-label="ID 自动化功能">
        <button
          v-for="item in workspaceNavItems"
          :key="item.key"
          class="automation-feature-nav__item"
          :class="{ active: activeWorkspace === item.key }"
          type="button"
          @click="activeWorkspace = item.key"
        >
          <span>{{ item.badge }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.description }}</small>
        </button>
      </nav>

      <ListRequestError
        v-if="automationAccountsLoadError && isAutomationAccountWorkspace"
        title="Apple ID 自动化账号列表加载失败"
        :message="automationAccountsLoadError"
        @retry="() => loadAutomationAccounts({ force: true })"
      />

      <ListRequestError
        v-if="tasksLoadError && (tasks.length || activeTab === 'history' || opsTab === 'history')"
        title="自动化执行记录加载失败"
        :message="tasksLoadError"
        @retry="() => loadTasks({ force: true })"
      />

      <section class="automation-feature-shell">
        <div v-if="activeWorkspace === 'status'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>ID 状态检测</strong>
              <span>勾选 ID 后直接检测，结果回到本页表格。</span>
            </div>
            <div class="inline-actions">
              <AppButton variant="soft" @click="openGatewaySubscriptionDialog">
                {{ needsGatewaySubscription ? '设置出口节点' : '更新出口节点' }}
              </AppButton>
              <AppButton
                :disabled="!selectedStatusAccountIds.length"
                :loading="runningAction === 'status'"
                @click="startStatusCheck()"
              >
                查询选中 {{ selectedStatusAccountIds.length || '' }}
              </AppButton>
              <AppButton
                variant="primary"
                :loading="runningAction === 'status'"
                @click="startStatusCheck('filtered')"
              >
                查询当前筛选全部 {{ automationAccountsTotal }}
              </AppButton>
            </div>
          </div>

          <div class="automation-inline-settings">
            <el-input
              v-model.trim="automationAccountQuery.keyword"
              class="automation-account-search"
              clearable
              placeholder="搜索 Apple ID、地区、币种、备注"
              @keyup.enter="handleAutomationAccountSearch"
              @clear="handleAutomationAccountSearch"
            />
            <el-select
              v-model="automationAccountQuery.status"
              class="automation-filter-select"
              clearable
              placeholder="系统状态"
              @change="handleAutomationAccountSearch"
            >
              <el-option label="正常" value="normal" />
              <el-option label="需验证" value="need_verify" />
              <el-option label="锁定" value="locked" />
              <el-option label="密码错误" value="password_error" />
              <el-option label="风险" value="risk" />
              <el-option label="未知" value="unknown" />
            </el-select>
            <el-select
              v-model="automationAccountQuery.region"
              class="automation-filter-select"
              clearable
              filterable
              placeholder="地区"
              @change="handleAutomationAccountSearch"
            >
              <el-option
                v-for="item in gatewayRegionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="statusCheckForm.gatewayRegion"
              class="automation-filter-select"
              clearable
              filterable
              placeholder="出口国家（不选按账号地区）"
            >
              <el-option
                v-for="item in gatewayRegionOptions"
                :key="item.value"
                :label="`出口 ${item.label}`"
                :value="item.value"
              />
            </el-select>
            <el-select v-model="statusCheckForm.priority" class="automation-filter-select">
              <el-option
                v-for="item in priorityOptions"
                :key="item.value"
                :label="`优先级 ${item.label}`"
                :value="item.value"
              />
            </el-select>
            <AppButton variant="ghost" @click="clearAutomationAccountFilters">清空筛选</AppButton>
          </div>

          <el-table
            v-loading="accountsLoading"
            class="desktop-data-table automation-business-table"
            :data="automationAccounts"
            row-key="id"
            empty-text="暂无 Apple ID"
            @selection-change="handleStatusAccountSelectionChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                <strong>{{ row.appleIdMasked }}</strong>
                <div class="muted-block">
                  {{ formatAccountRegion(row.region) }} / {{ row.currency }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="系统状态" width="130">
              <template #default="{ row }">
                <StatusChip :tone="getAccountStatusTone(row.status)" dot>
                  {{ getAccountStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="本次检测结果" min-width="150">
              <template #default="{ row }">
                <StatusChip :tone="getStatusResultTone(row.id)" dot>
                  {{ getStatusResultLabel(row) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="处理建议" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ getStatusResultMessage(row.id) }}</template>
            </el-table-column>
            <el-table-column label="余额" width="110" prop="currentBalance" />
            <el-table-column label="资料" min-width="160">
              <template #default="{ row }">
                {{ getAccountSecretSummary(row) }}
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="automationAccountQuery.page"
            v-model:page-size="automationAccountQuery.pageSize"
            :total="automationAccountsTotal"
            @change="loadAutomationAccounts"
          />
        </div>

        <div v-else-if="activeWorkspace === 'balance'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>ID 余额查询</strong>
              <span>当前返回系统余额快照；官网实时余额查询未接入时，不能当作实时余额证明。</span>
            </div>
            <div class="inline-actions">
              <el-select v-model="balanceCheckForm.priority" class="automation-filter-select">
                <el-option
                  v-for="item in priorityOptions"
                  :key="item.value"
                  :label="`优先级 ${item.label}`"
                  :value="item.value"
                />
              </el-select>
              <AppButton
                :disabled="!selectedBalanceAccountIds.length"
                :loading="runningAction === 'balance'"
                @click="startBalanceCheck()"
              >
                查询选中 {{ selectedBalanceAccountIds.length || '' }}
              </AppButton>
              <AppButton
                variant="primary"
                :loading="runningAction === 'balance'"
                @click="startBalanceCheck('filtered')"
              >
                查询当前筛选全部 {{ automationAccountsTotal }}
              </AppButton>
            </div>
          </div>

          <div class="automation-inline-settings">
            <el-input
              v-model.trim="automationAccountQuery.keyword"
              class="automation-account-search"
              clearable
              placeholder="搜索 Apple ID、地区、币种、备注"
              @keyup.enter="handleAutomationAccountSearch"
              @clear="handleAutomationAccountSearch"
            />
            <el-select
              v-model="automationAccountQuery.region"
              class="automation-filter-select"
              clearable
              filterable
              placeholder="地区"
              @change="handleAutomationAccountSearch"
            >
              <el-option
                v-for="item in gatewayRegionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <AppButton variant="ghost" @click="clearAutomationAccountFilters">清空筛选</AppButton>
          </div>

          <el-table
            v-loading="accountsLoading"
            class="desktop-data-table automation-business-table"
            :data="automationAccounts"
            row-key="id"
            empty-text="暂无 Apple ID"
            @selection-change="handleBalanceAccountSelectionChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                <strong>{{ row.appleIdMasked }}</strong>
                <div class="muted-block">
                  {{ formatAccountRegion(row.region) }} / {{ row.currency }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="系统余额" width="120" prop="currentBalance" />
            <el-table-column label="查询余额" width="120">
              <template #default="{ row }">{{ getBalanceCheckedValue(row.id) }}</template>
            </el-table-column>
            <el-table-column label="差额" width="110">
              <template #default="{ row }">{{ getBalanceDiff(row) }}</template>
            </el-table-column>
            <el-table-column label="来源" width="130">
              <template #default="{ row }">{{ getBalanceSourceLabel(row.id) }}</template>
            </el-table-column>
            <el-table-column label="查询结果" min-width="150">
              <template #default="{ row }">
                <StatusChip :tone="getBalanceResultTone(row.id)" dot>
                  {{ getBalanceResultLabel(row.id) }}
                </StatusChip>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="automationAccountQuery.page"
            v-model:page-size="automationAccountQuery.pageSize"
            :total="automationAccountsTotal"
            @change="loadAutomationAccounts"
          />
        </div>

        <div v-else-if="activeWorkspace === 'gift-card'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>礼品卡余额查询</strong>
              <span>准备 5 个以内查询 ID，上传礼品卡图片后在本页看结果。</span>
            </div>
            <div class="inline-actions">
              <StatusChip :tone="giftCardReadyAccountCount ? 'green' : 'orange'">
                查询ID {{ giftCardReadyAccountCount }}/5
              </StatusChip>
              <StatusChip tone="blue">图片 {{ giftCardRows.length }}</StatusChip>
              <AppButton
                v-if="currentGiftCardRunId"
                variant="soft"
                :disabled="!canRunCurrentGiftCardRun"
                :loading="giftCardActionRunning"
                @click="runCurrentGiftCardBalanceCheck"
              >
                重试当前批次
              </AppButton>
              <AppButton
                variant="primary"
                :loading="giftCardActionRunning"
                @click="startGiftCardBalanceCheck"
              >
                上传并开始查询
              </AppButton>
            </div>
          </div>

          <div class="gift-card-workbench">
            <section class="gift-card-credential-panel">
              <PanelTitleHelp
                title="查询账号池"
                help="每行一个 Apple ID 和密码，最多 5 个。保存后会写入后端加密账号池。"
              />
              <el-input
                v-model="giftCardAccountForm.pastedAccounts"
                type="textarea"
                :rows="5"
                placeholder="appleid@example.com 密码&#10;appleid2@example.com----密码"
              />
              <div class="inline-actions">
                <AppButton
                  variant="primary"
                  :loading="giftCardAccountsSaving"
                  @click="saveGiftCardQueryAccountsFromPaste"
                  >保存账号</AppButton
                >
                <AppButton
                  variant="ghost"
                  :loading="giftCardAccountsSaving"
                  @click="clearGiftCardQueryAccounts"
                  >清空</AppButton
                >
              </div>
              <el-table
                v-loading="giftCardAccountsLoading"
                class="desktop-data-table"
                :data="giftCardQueryAccounts"
                row-key="id"
                empty-text="暂无查询账号"
              >
                <el-table-column label="Apple ID" min-width="180">
                  <template #default="{ row }">
                    <strong>{{ row.appleIdMasked }}</strong>
                    <div class="muted-block">密码 {{ row.passwordMasked }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                  <template #default="{ row }">
                    <StatusChip :tone="row.status === 'ready' ? 'green' : 'orange'" dot>
                      {{ getGiftCardAccountStatusLabel(row.status) }}
                    </StatusChip>
                  </template>
                </el-table-column>
                <el-table-column label="说明" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.message }}</template>
                </el-table-column>
              </el-table>
            </section>

            <section class="gift-card-upload-panel">
              <PanelTitleHelp
                title="礼品卡图片"
                help="上传图片后建立查询结果表；系统先 OCR 识别卡号，再分配查询账号执行余额查询，需要补录时在本页处理。"
              />
              <el-upload
                drag
                multiple
                action="#"
                accept="image/*"
                :auto-upload="false"
                :on-change="handleGiftCardImageChange"
                :on-remove="handleGiftCardImageRemove"
              >
                <div class="gift-card-upload-copy">
                  <strong>拖入礼品卡图片</strong>
                  <span>支持多张图片，系统会分配查询 ID</span>
                </div>
              </el-upload>
            </section>
          </div>

          <el-table
            class="desktop-data-table automation-business-table"
            :data="giftCardRows"
            row-key="id"
            empty-text="暂无礼品卡图片"
          >
            <el-table-column label="图片" min-width="180" prop="fileName" show-overflow-tooltip />
            <el-table-column label="识别卡号" min-width="160">
              <template #default="{ row }">{{ row.extractedCode }}</template>
            </el-table-column>
            <el-table-column label="查询 ID" min-width="150">
              <template #default="{ row }">{{ row.assignedAppleId }}</template>
            </el-table-column>
            <el-table-column label="查询状态" width="120">
              <template #default="{ row }">
                <StatusChip :tone="getGiftCardResultTone(row.status)" dot>
                  {{ getGiftCardResultStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="余额" width="110">
              <template #default="{ row }">{{ row.balance }}</template>
            </el-table-column>
            <el-table-column label="币种" width="90">
              <template #default="{ row }">{{ row.currency }}</template>
            </el-table-column>
            <el-table-column label="说明" min-width="260" show-overflow-tooltip>
              <template #default="{ row }">{{ row.message }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton
                    v-if="canEditGiftCardCode(row)"
                    size="small"
                    :loading="giftCardRowActionId === row.id"
                    @click="promptGiftCardCode(row)"
                  >
                    补录代码
                  </AppButton>
                  <AppButton
                    v-if="canRetryGiftCardRow(row)"
                    size="small"
                    variant="primary"
                    :loading="giftCardRowActionId === row.id"
                    @click="retryGiftCardBalanceCheckRow(row)"
                  >
                    重试查询
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-else-if="activeWorkspace === 'official-price'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>官方价格巡检</strong>
              <span>价格有变化时需要人工确认，确认后才同步到业务设置。</span>
            </div>
            <AppButton
              variant="primary"
              :loading="runningAction === 'official'"
              @click="startOfficialPriceCheck"
            >
              开始价格巡检
            </AppButton>
          </div>

          <div class="automation-inline-settings">
            <el-select v-model="officialCheckForm.provider" class="automation-filter-select">
              <el-option label="全部供应商" value="all" />
              <el-option
                v-for="provider in officialProviderOptions"
                :key="provider.value"
                :label="provider.label"
                :value="provider.value"
              />
            </el-select>
            <el-select
              v-model="officialCheckForm.regions"
              class="automation-account-search"
              collapse-tags
              collapse-tags-tooltip
              clearable
              filterable
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
          </div>

          <div class="automation-result-block automation-result-block--inline">
            <div class="automation-result-block__head">
              <div>
                <strong>官方价格巡检结果</strong>
                <span v-if="officialCheckResults">
                  没变 {{ officialCheckResults.summary.unchangedCount }}，变动
                  {{ officialCheckResults.summary.changedCount }}，新套餐
                  {{ officialCheckResults.summary.newPlanCount }}，下架
                  {{ officialCheckResults.summary.removedPlanCount }}
                </span>
                <span v-else>选择供应商和地区后开始巡检，结果会显示在这里。</span>
              </div>
              <StatusChip
                v-if="officialCheckResults"
                :tone="getStatusTone(officialCheckResults.batch.status)"
                dot
              >
                {{ getStatusLabel(officialCheckResults.batch.status) }}
              </StatusChip>
              <StatusChip v-else tone="neutral" dot>待巡检</StatusChip>
            </div>
            <el-table
              v-loading="runningAction === 'official'"
              class="desktop-data-table"
              :data="officialCheckResults?.items ?? []"
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
        </div>

        <div v-else-if="activeWorkspace === 'topup-renewal'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>自动充值 / 续费</strong>
              <span>选中 ID 后在本页开始充值或续费检查，结果直接回到表格。</span>
            </div>
            <div class="inline-actions">
              <AppButton
                :disabled="!selectedTopupAccountIds.length"
                :loading="actionLoadingId === 'topup-selected'"
                @click="createTopupTasks()"
              >
                执行选中充值 {{ selectedTopupAccountIds.length || '' }}
              </AppButton>
              <AppButton
                variant="soft"
                :disabled="!selectedTopupAccountIds.length"
                :loading="actionLoadingId === 'check_renewal-selected'"
                @click="createRenewalCheckTasks()"
              >
                检查选中续费
              </AppButton>
              <AppButton
                variant="soft"
                :loading="actionLoadingId === 'check_renewal-filtered'"
                @click="createRenewalCheckTasks('filtered')"
              >
                当前筛选全部查续费 {{ automationAccountsTotal }}
              </AppButton>
              <AppButton
                variant="primary"
                :loading="actionLoadingId === 'topup-filtered'"
                @click="createTopupTasks('filtered')"
              >
                当前筛选全部充值 {{ automationAccountsTotal }}
              </AppButton>
            </div>
          </div>
          <div class="automation-inline-settings">
            <el-input
              v-model.trim="automationAccountQuery.keyword"
              class="automation-account-search"
              clearable
              placeholder="搜索 Apple ID、地区、币种、备注"
              @keyup.enter="handleAutomationAccountSearch"
              @clear="handleAutomationAccountSearch"
            />
            <el-select
              v-model="automationAccountQuery.status"
              class="automation-filter-select"
              clearable
              placeholder="系统状态"
              @change="handleAutomationAccountSearch"
            >
              <el-option label="正常" value="normal" />
              <el-option label="需验证" value="need_verify" />
              <el-option label="锁定" value="locked" />
              <el-option label="密码错误" value="password_error" />
              <el-option label="风险" value="risk" />
              <el-option label="未知" value="unknown" />
            </el-select>
            <el-select
              v-model="automationAccountQuery.region"
              class="automation-filter-select"
              clearable
              filterable
              placeholder="地区"
              @change="handleAutomationAccountSearch"
            >
              <el-option
                v-for="item in gatewayRegionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <AppButton variant="ghost" @click="clearAutomationAccountFilters">清空筛选</AppButton>
          </div>
          <el-table
            v-loading="accountsLoading"
            class="desktop-data-table automation-business-table"
            :data="automationAccounts"
            row-key="id"
            empty-text="暂无 Apple ID"
            @selection-change="handleTopupAccountSelectionChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                <strong>{{ row.appleIdMasked }}</strong>
                <div class="muted-block">
                  {{ formatAccountRegion(row.region) }} / {{ row.currency }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="当前余额" width="120" prop="currentBalance" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <StatusChip :tone="getAccountStatusTone(row.status)">
                  {{ getAccountStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="建议动作" min-width="180">
              <template #default="{ row }">{{ getTopupRecommendation(row) }}</template>
            </el-table-column>
            <el-table-column label="处理结果" min-width="150">
              <template #default="{ row }">
                <StatusChip
                  :tone="getFeatureActionResultTone(row.id, topupRenewalResultTaskTypes)"
                  dot
                >
                  {{ getFeatureActionResultLabel(row.id, topupRenewalResultTaskTypes) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="结果说明" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ getFeatureActionMessage(row.id, topupRenewalResultTaskTypes) }}
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="automationAccountQuery.page"
            v-model:page-size="automationAccountQuery.pageSize"
            :total="automationAccountsTotal"
            @change="loadAutomationAccounts"
          />
        </div>

        <div v-else-if="activeWorkspace === 'cancel-subscription'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>取消订阅</strong>
              <span>选中需要处理的 ID 后开始取消订阅，遇到验证会在本页提示人工输入。</span>
            </div>
            <div class="inline-actions">
              <AppButton
                :disabled="!selectedCancelAccountIds.length"
                :loading="actionLoadingId === 'cancel_subscription-selected'"
                @click="createCancelSubscriptionTasks()"
              >
                执行取消订阅 {{ selectedCancelAccountIds.length || '' }}
              </AppButton>
              <AppButton
                variant="primary"
                :loading="actionLoadingId === 'cancel_subscription-filtered'"
                @click="createCancelSubscriptionTasks('filtered')"
              >
                当前筛选全部取消 {{ automationAccountsTotal }}
              </AppButton>
            </div>
          </div>
          <div class="automation-inline-settings">
            <el-input
              v-model.trim="automationAccountQuery.keyword"
              class="automation-account-search"
              clearable
              placeholder="搜索 Apple ID、地区、币种、备注"
              @keyup.enter="handleAutomationAccountSearch"
              @clear="handleAutomationAccountSearch"
            />
            <el-select
              v-model="automationAccountQuery.status"
              class="automation-filter-select"
              clearable
              placeholder="系统状态"
              @change="handleAutomationAccountSearch"
            >
              <el-option label="正常" value="normal" />
              <el-option label="需验证" value="need_verify" />
              <el-option label="锁定" value="locked" />
              <el-option label="密码错误" value="password_error" />
              <el-option label="风险" value="risk" />
              <el-option label="未知" value="unknown" />
            </el-select>
            <el-select
              v-model="automationAccountQuery.region"
              class="automation-filter-select"
              clearable
              filterable
              placeholder="地区"
              @change="handleAutomationAccountSearch"
            >
              <el-option
                v-for="item in gatewayRegionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <AppButton variant="ghost" @click="clearAutomationAccountFilters">清空筛选</AppButton>
          </div>
          <el-table
            v-loading="accountsLoading"
            class="desktop-data-table automation-business-table"
            :data="automationAccounts"
            row-key="id"
            empty-text="暂无 Apple ID"
            @selection-change="handleCancelAccountSelectionChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                <strong>{{ row.appleIdMasked }}</strong>
                <div class="muted-block">
                  {{ formatAccountRegion(row.region) }} / {{ row.currency }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="当前状态" width="130">
              <template #default="{ row }">
                <StatusChip :tone="getAccountStatusTone(row.status)">
                  {{ getAccountStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="订阅状态" min-width="150">待接入订阅读取</el-table-column>
            <el-table-column label="取消结果" min-width="150">
              <template #default="{ row }">
                <StatusChip
                  :tone="getFeatureActionResultTone(row.id, cancelSubscriptionResultTaskTypes)"
                  dot
                >
                  {{ getFeatureActionResultLabel(row.id, cancelSubscriptionResultTaskTypes) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="结果说明" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ getFeatureActionMessage(row.id, cancelSubscriptionResultTaskTypes) }}
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="automationAccountQuery.page"
            v-model:page-size="automationAccountQuery.pageSize"
            :total="automationAccountsTotal"
            @change="loadAutomationAccounts"
          />
        </div>

        <div v-else-if="activeWorkspace === 'account-maintenance'" class="automation-feature-page">
          <div class="automation-feature-head">
            <div>
              <strong>账号资料维护</strong>
              <span>修改手机号或密保属于高风险动作，遇到验证会在本页提示人工确认。</span>
            </div>
            <div class="inline-actions">
              <el-radio-group v-model="maintenanceMode">
                <el-radio-button value="change_phone">修改手机号</el-radio-button>
                <el-radio-button value="change_security">修改密保</el-radio-button>
              </el-radio-group>
              <AppButton
                :disabled="!selectedMaintenanceAccountIds.length"
                :loading="actionLoadingId === `${maintenanceMode}-selected`"
                @click="createMaintenanceTasks()"
              >
                执行维护动作 {{ selectedMaintenanceAccountIds.length || '' }}
              </AppButton>
              <AppButton
                variant="primary"
                :loading="actionLoadingId === `${maintenanceMode}-filtered`"
                @click="createMaintenanceTasks('filtered')"
              >
                当前筛选全部维护 {{ automationAccountsTotal }}
              </AppButton>
            </div>
          </div>
          <div class="automation-inline-settings">
            <el-input
              v-model.trim="automationAccountQuery.keyword"
              class="automation-account-search"
              clearable
              placeholder="搜索 Apple ID、地区、币种、备注"
              @keyup.enter="handleAutomationAccountSearch"
              @clear="handleAutomationAccountSearch"
            />
            <el-select
              v-model="automationAccountQuery.status"
              class="automation-filter-select"
              clearable
              placeholder="系统状态"
              @change="handleAutomationAccountSearch"
            >
              <el-option label="正常" value="normal" />
              <el-option label="需验证" value="need_verify" />
              <el-option label="锁定" value="locked" />
              <el-option label="密码错误" value="password_error" />
              <el-option label="风险" value="risk" />
              <el-option label="未知" value="unknown" />
            </el-select>
            <el-select
              v-model="automationAccountQuery.region"
              class="automation-filter-select"
              clearable
              filterable
              placeholder="地区"
              @change="handleAutomationAccountSearch"
            >
              <el-option
                v-for="item in gatewayRegionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <AppButton variant="ghost" @click="clearAutomationAccountFilters">清空筛选</AppButton>
          </div>
          <el-table
            v-loading="accountsLoading"
            class="desktop-data-table automation-business-table"
            :data="automationAccounts"
            row-key="id"
            empty-text="暂无 Apple ID"
            @selection-change="handleMaintenanceAccountSelectionChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                <strong>{{ row.appleIdMasked }}</strong>
                <div class="muted-block">
                  {{ formatAccountRegion(row.region) }} / {{ row.currency }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="资料完整度" min-width="180">
              <template #default="{ row }">{{ getAccountSecretSummary(row) }}</template>
            </el-table-column>
            <el-table-column label="当前状态" width="130">
              <template #default="{ row }">
                <StatusChip :tone="getAccountStatusTone(row.status)">
                  {{ getAccountStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="维护结果" min-width="150">
              <template #default="{ row }">
                <StatusChip
                  :tone="getFeatureActionResultTone(row.id, maintenanceResultTaskTypes)"
                  dot
                >
                  {{ getFeatureActionResultLabel(row.id, maintenanceResultTaskTypes) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="结果说明" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                {{ getFeatureActionMessage(row.id, maintenanceResultTaskTypes) }}
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="automationAccountQuery.page"
            v-model:page-size="automationAccountQuery.pageSize"
            :total="automationAccountsTotal"
            @change="loadAutomationAccounts"
          />
        </div>
      </section>

      <section class="automation-ops-panel">
        <el-tabs v-model="opsTab">
          <el-tab-pane label="人工处理" name="manual">
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
                  {{ row.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' }}
                  <div class="muted-block">
                    {{ formatAccountRegion(row.appleAccount?.region) }}
                  </div>
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
              <el-table-column label="操作" width="300" fixed="right">
                <template #default="{ row }">
                  <div class="table-action-group table-action-group--wrap">
                    <AppButton size="small" variant="ghost" @click="openDetail(row)"
                      >详情</AppButton
                    >
                    <AppButton
                      v-if="isTaskManualInputNeeded(row)"
                      size="small"
                      variant="primary"
                      :loading="actionLoadingId === row.id"
                      @click="promptManualInputForTask(row)"
                    >
                      输入验证码
                    </AppButton>
                    <AppButton
                      size="small"
                      :disabled="!canRetry(row)"
                      :loading="actionLoadingId === row.id"
                      @click="retryTask(row)"
                    >
                      重试
                    </AppButton>
                    <AppButton size="small" variant="primary" @click="openDetail(row)"
                      >回写</AppButton
                    >
                  </div>
                </template>
              </el-table-column>
            </el-table>
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
              <AppButton
                variant="danger"
                :disabled="!selectedHistoryTaskIds.length"
                :loading="bulkDeleting"
                @click="bulkDeleteSelectedTasks"
              >
                批量删除<span v-if="selectedHistoryTaskIds.length">
                  {{ selectedHistoryTaskIds.length }}
                </span>
              </AppButton>
            </div>
            <el-table
              ref="historyTableRef"
              v-loading="loading"
              class="desktop-data-table"
              :data="tasks"
              row-key="id"
              empty-text="暂无执行记录"
              @selection-change="handleHistorySelectionChange"
              @sort-change="handleSortChange"
            >
              <el-table-column type="selection" width="46" fixed="left" />
              <el-table-column label="任务" min-width="150" sortable="custom" prop="taskType">
                <template #default="{ row }">
                  <strong>{{ getTaskTypeLabel(row.taskType) }}</strong>
                </template>
              </el-table-column>
              <el-table-column label="Apple ID" min-width="190">
                <template #default="{ row }">
                  {{ row.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' }}
                  <div class="muted-block">
                    {{ formatAccountRegion(row.appleAccount?.region) }} / 余额
                    {{ row.appleAccount?.currentBalance ?? '-' }}
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
                    <AppButton size="small" variant="ghost" @click="openDetail(row)"
                      >详情</AppButton
                    >
                    <AppButton
                      size="small"
                      variant="success"
                      :disabled="!canRun(row)"
                      :loading="actionLoadingId === row.id"
                      @click="runManualReview(row)"
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

      <el-tabs
        v-if="legacyTaskCenterVisible"
        v-model="activeTab"
        class="automation-tabs"
        aria-hidden="true"
      >
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
                  <span>当前按系统已保存余额生成结果；支持官方读取后会显示来源。</span>
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
              <span>这些动作会在对应页面开始处理；无法自动执行时会转人工，不会伪装完成。</span>
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
              <el-table-column label="验证输入" width="120" fixed="right">
                <template #default="{ row }">
                  <AppButton
                    v-if="isBatchRowManualInputNeeded(row)"
                    size="small"
                    :loading="actionLoadingId === row.taskId"
                    @click="promptManualInputForBatchRow(row)"
                  >
                    输入验证码
                  </AppButton>
                  <span v-else class="muted-block">-</span>
                </template>
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
                  {{ row.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' }}
                  <div class="muted-block">
                    {{ formatAccountRegion(row.appleAccount?.region) }}
                  </div>
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
            <AppButton
              variant="danger"
              :disabled="!selectedHistoryTaskIds.length"
              :loading="bulkDeleting"
              @click="bulkDeleteSelectedTasks"
            >
              批量删除<span v-if="selectedHistoryTaskIds.length">
                {{ selectedHistoryTaskIds.length }}
              </span>
            </AppButton>
          </div>

          <el-table
            ref="historyTableRef"
            v-loading="loading"
            class="desktop-data-table"
            :data="tasks"
            row-key="id"
            empty-text="暂无执行记录"
            @selection-change="handleHistorySelectionChange"
            @sort-change="handleSortChange"
          >
            <el-table-column type="selection" width="46" fixed="left" />
            <el-table-column label="任务" min-width="150" sortable="custom" prop="taskType">
              <template #default="{ row }">
                <strong>{{ getTaskTypeLabel(row.taskType) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="Apple ID" min-width="190">
              <template #default="{ row }">
                {{ row.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' }}
                <div class="muted-block">
                  {{ formatAccountRegion(row.appleAccount?.region) }} / 余额
                  {{ row.appleAccount?.currentBalance ?? '-' }}
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
            <el-table-column label="操作" width="330" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="ghost" @click="openDetail(row)">详情</AppButton>
                  <AppButton
                    v-if="isTaskManualInputNeeded(row)"
                    size="small"
                    variant="primary"
                    :loading="actionLoadingId === row.id"
                    @click="promptManualInputForTask(row)"
                  >
                    输入验证码
                  </AppButton>
                  <AppButton
                    size="small"
                    variant="success"
                    :disabled="!canRun(row)"
                    :loading="actionLoadingId === row.id"
                    @click="runManualReview(row)"
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
          <strong>{{ selectedTask?.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' }}</strong>
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
            v-if="selectedTask && isTaskManualInputNeeded(selectedTask)"
            variant="primary"
            :loading="Boolean(selectedTask && actionLoadingId === selectedTask.id)"
            @click="selectedTask && promptManualInputForTask(selectedTask)"
          >
            输入验证码/人工信息
          </AppButton>
          <AppButton
            variant="success"
            :disabled="!selectedTask || !canRun(selectedTask)"
            :loading="Boolean(selectedTask && actionLoadingId === selectedTask.id)"
            @click="selectedTask && runManualReview(selectedTask)"
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
        <div class="drawer-section__title">处理记录</div>
        <el-table class="desktop-data-table" :data="selectedTask?.logs ?? []" row-key="id">
          <el-table-column label="级别" width="90">
            <template #default="{ row }">
              <StatusChip :tone="getLogTone(row.level)" dot>
                {{ row.level }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="记录" min-width="260">
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
        <div class="drawer-section__title">排查信息</div>
        <el-collapse class="technical-info-collapse">
          <el-collapse-item title="展开查看处理详情" name="technical">
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
              <div class="drawer-section__description">结果详情</div>
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
      :title="`开始${getTaskTypeLabel(advancedForm.taskType)}`"
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
          title="该动作需要后台自动执行能力或人工处理；无法自动执行时会留在人工处理区，不会标记为已完成。"
          type="warning"
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <AppButton @click="advancedDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="savingAdvanced" @click="createAdvancedTask">
          开始处理
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
  attachmentsApi,
  appleAccountsApi,
  appleAutomationTasksApi,
  appleOfficialPricesApi,
  opsApi,
  type AppleAccountQuery,
  type AppleAutomationTaskQuery,
  type AppleOfficialPriceProviderCatalogProvider,
  type SaveAppleGiftCardQueryAccountPayload
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import ListRequestError from '@/components/ui/ListRequestError.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { useAuthenticatedPageLoader } from '@/composables/useAuthenticatedPageLoader';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppleAccount,
  AppleAccountOption,
  AppleAutomationTask,
  AppleAutomationTaskBatchResult,
  AppleAutomationTaskBatchResults,
  AppleAutomationWorkbenchCapability,
  AppleAutomationWorkbenchStatus,
  AppleGiftCardBalanceCheckRow,
  AppleGiftCardQueryAccount,
  AppleOfficialPriceCheckBatchResultRow,
  AppleOfficialPriceCheckBatchResults,
  AutomationTaskPriority,
  AutomationTaskStatus,
  AutomationTaskType,
  PageResult
} from '@/types/system';
import { appleAccountRegionOptions, formatAppleRegionLabel } from '@/utils/appleAccountRegion';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { buildTechnicalFieldRows } from '@/utils/internalTechnicalFields';
import { getLoadErrorMessage } from '@/utils/loadErrorMessage';
import {
  createSmartQueryKey,
  getSmartQueryData,
  invalidateSmartQueries,
  refreshSmartQuery
} from '@/utils/smartQuery';

const ACCOUNT_OPTIONS_PAGE_SIZE = 20;
const AUTOMATION_ACCOUNTS_PAGE_SIZE = 20;
const AUTOMATION_ALL_ACCOUNTS_PAGE_SIZE = 100;
const ACCOUNT_OPTIONS_DEBOUNCE_MS = 300;
type AutomationWorkspaceKey =
  | 'status'
  | 'balance'
  | 'gift-card'
  | 'official-price'
  | 'topup-renewal'
  | 'cancel-subscription'
  | 'account-maintenance';
type GiftCardQueryAccountStatus = 'ready' | 'needs_login' | 'disabled';
type GiftCardResultStatus =
  | 'pending_ocr'
  | 'waiting_worker'
  | 'manual_required'
  | 'success'
  | 'failed';

interface GiftCardQueryAccount {
  id: string;
  appleIdMasked: string;
  passwordMasked: string;
  status: GiftCardQueryAccountStatus;
  message: string;
}

interface GiftCardUploadFile {
  name?: string;
  raw?: File;
}

interface GiftCardResultRow {
  id: string;
  attachmentId: string | null;
  fileName: string;
  extractedCode: string;
  assignedAppleId: string;
  status: GiftCardResultStatus;
  balance: string;
  currency: string;
  message: string;
}
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
    sourceUrl: 'https://chatgpt.com/pricing/',
    regions: fallbackOfficialRegionOptions
  },
  {
    label: 'Gemini / Google',
    shortLabel: 'Gemini',
    value: 'gemini',
    sourceUrl: 'https://one.google.com/intl/en_us/about/google-ai-plans/',
    regions: fallbackOfficialRegionOptions
  },
  {
    label: 'Claude / Anthropic',
    shortLabel: 'Claude',
    value: 'claude',
    sourceUrl: 'https://claude.com/pricing',
    regions: fallbackOfficialRegionOptions
  }
];

const tasks = ref<AppleAutomationTask[]>([]);
const tasksLoaded = ref(false);
const automationAccounts = ref<AppleAccount[]>([]);
const automationAccountsLoaded = ref(false);
const appleAccountOptions = ref<AppleAccountOption[]>([]);
const accountOptionsLoading = ref(false);
const accountOptionsLoaded = ref(false);
const automationAccountsTotal = ref(0);
const total = ref(0);
const loading = ref(false);
const accountsLoading = ref(false);
const tasksLoadError = ref('');
const automationAccountsLoadError = ref('');
const workbenchStatusLoadError = ref('');
const activeWorkspace = ref<AutomationWorkspaceKey>('status');
const opsTab = ref<'manual' | 'history'>('manual');
const activeTab = ref<'start' | 'results' | 'manual' | 'history'>('start');
const legacyTaskCenterVisible = ref(false);
const runningAction = ref<'status' | 'balance' | 'official' | ''>('');
const taskBatchResults = ref<AppleAutomationTaskBatchResults | null>(null);
const taskBatchPolling = ref(false);
const manualInputPromptedTaskIds = ref<string[]>([]);
const officialCheckResults = ref<AppleOfficialPriceCheckBatchResults | null>(null);
const workbenchStatus = ref<AppleAutomationWorkbenchStatus | null>(null);
const workbenchStatusLoading = ref(false);
const officialProviderOptions = ref<AppleOfficialPriceProviderCatalogProvider[]>(
  fallbackOfficialProviderOptions
);
const officialReviewActionId = ref('');
const detailDrawerVisible = ref(false);
const selectedTask = ref<AppleAutomationTask | null>(null);
const selectedHistoryTasks = ref<AppleAutomationTask[]>([]);
const selectedStatusAccounts = ref<AppleAccount[]>([]);
const selectedBalanceAccounts = ref<AppleAccount[]>([]);
const selectedTopupAccounts = ref<AppleAccount[]>([]);
const selectedCancelAccounts = ref<AppleAccount[]>([]);
const selectedMaintenanceAccounts = ref<AppleAccount[]>([]);
const actionLoadingId = ref('');
const bulkDeleting = ref(false);
const advancedDialogVisible = ref(false);
const savingAdvanced = ref(false);
const gatewaySubscriptionDialogVisible = ref(false);
const gatewaySubscriptionSaving = ref(false);
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const activeTasksQueryKey = ref('');
const historyTableRef = ref<{ clearSelection: () => void } | null>(null);
let taskBatchPollTimer: ReturnType<typeof setTimeout> | null = null;
let officialPollTimer: ReturnType<typeof setTimeout> | null = null;
let accountOptionsSearchTimer: ReturnType<typeof setTimeout> | null = null;

const automationAccountQuery = reactive<AppleAccountQuery>({
  page: 1,
  pageSize: AUTOMATION_ACCOUNTS_PAGE_SIZE,
  keyword: '',
  status: '',
  region: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
});

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
  gatewayRegion: '',
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

const giftCardAccountForm = reactive({
  pastedAccounts: ''
});

const giftCardQueryAccounts = ref<GiftCardQueryAccount[]>([]);
const giftCardRows = ref<GiftCardResultRow[]>([]);
const giftCardUploadFiles = ref<GiftCardUploadFile[]>([]);
const giftCardActionRunning = ref(false);
const giftCardRowActionId = ref('');
const currentGiftCardRunId = ref('');
const giftCardAccountsLoading = ref(false);
const giftCardAccountsSaving = ref(false);
const maintenanceMode = ref<'change_phone' | 'change_security'>('change_phone');
const topupRenewalResultTaskTypes: AutomationTaskType[] = ['topup', 'check_renewal'];
const cancelSubscriptionResultTaskTypes: AutomationTaskType[] = ['cancel_subscription'];
const maintenanceResultTaskTypes = computed<AutomationTaskType[]>(() => [maintenanceMode.value]);
const canRunCurrentGiftCardRun = computed(
  () =>
    Boolean(currentGiftCardRunId.value) &&
    giftCardRows.value.length > 0 &&
    giftCardRows.value.every((row) => !isGiftCardCodeMissing(row))
);

const workspaceNavItems: Array<{
  key: AutomationWorkspaceKey;
  title: string;
  description: string;
  badge: string;
}> = [
  {
    key: 'status',
    title: 'ID 状态检测',
    description: '看每个 ID 正常、异常还是要验证',
    badge: '状态'
  },
  {
    key: 'balance',
    title: 'ID 余额查询',
    description: '对比系统余额和本次查询结果',
    badge: '余额'
  },
  {
    key: 'gift-card',
    title: '礼品卡余额查询',
    description: '固定少量查询 ID，上传图片后查卡余额',
    badge: '礼品卡'
  },
  {
    key: 'official-price',
    title: '官方价格巡检',
    description: '检查套餐价格变化，确认后再同步',
    badge: '价格'
  },
  {
    key: 'topup-renewal',
    title: '自动充值 / 续费',
    description: '按余额和到期风险开始处理',
    badge: '充值'
  },
  {
    key: 'cancel-subscription',
    title: '取消订阅',
    description: '集中处理待取消订阅的 ID',
    badge: '订阅'
  },
  {
    key: 'account-maintenance',
    title: '账号资料维护',
    description: '修改手机号、密保等高风险资料',
    badge: '资料'
  }
];

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
  { label: '待执行', value: 'queued' },
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

const giftCardAccountPasteDelimiters = [
  /----+/,
  /\t+/,
  /[，,]/,
  /[|]/,
  /[；;]/,
  /[：:]/,
  /[。]/,
  /\s+/
];

const gatewayRegionOptions = appleAccountRegionOptions.map((item) => ({
  label: formatAppleRegionLabel(item.code),
  value: item.code
}));

const officialRegionOptions = computed(() => {
  const selectedValues = new Set(officialCheckForm.regions);
  const regions = officialProviderOptions.value.flatMap((provider) =>
    Array.isArray(provider.regions) ? provider.regions : []
  );
  const unique = new Map(regions.map((region) => [region.value, region]));
  return Array.from(unique.values())
    .map((region, index) => ({
      label: `${region.label} / ${region.currency}`,
      value: region.value,
      region: region.region,
      currency: region.currency,
      sortIndex: index
    }))
    .sort((left, right) => {
      const leftSelected = selectedValues.has(left.value);
      const rightSelected = selectedValues.has(right.value);
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      return left.sortIndex - right.sortIndex;
    })
    .map((region) => ({
      label: region.label,
      value: region.value,
      region: region.region,
      currency: region.currency
    }));
});
const statusBatchResults = computed(() =>
  taskBatchResults.value?.batch.batchType === 'status_check' ? taskBatchResults.value : null
);
const balanceBatchResults = computed(() =>
  taskBatchResults.value?.batch.batchType === 'balance_check' ? taskBatchResults.value : null
);

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
const selectedHistoryTaskIds = computed(() => selectedHistoryTasks.value.map((task) => task.id));
const selectedStatusAccountIds = computed(() =>
  selectedStatusAccounts.value.map((account) => account.id)
);
const selectedBalanceAccountIds = computed(() =>
  selectedBalanceAccounts.value.map((account) => account.id)
);
const selectedTopupAccountIds = computed(() =>
  selectedTopupAccounts.value.map((account) => account.id)
);
const selectedCancelAccountIds = computed(() =>
  selectedCancelAccounts.value.map((account) => account.id)
);
const selectedMaintenanceAccountIds = computed(() =>
  selectedMaintenanceAccounts.value.map((account) => account.id)
);
const giftCardReadyAccountCount = computed(
  () => giftCardQueryAccounts.value.filter((account) => account.status === 'ready').length
);
const needsGatewaySubscription = computed(() => {
  const capability = workbenchStatus.value?.statusCheck;
  return Boolean(capability && !capability.gatewayConfigured);
});
const isAutomationAccountWorkspace = computed(() =>
  ['status', 'balance', 'topup-renewal', 'cancel-subscription', 'account-maintenance'].includes(
    activeWorkspace.value
  )
);
useAuthenticatedPageLoader(async () => {
  void loadOfficialProviders({ background: true });
  await Promise.all([loadWorkbenchStatus(), loadAutomationAccounts(), loadGiftCardQueryAccounts()]);
});

usePageRefresh(
  async (options) => {
    await Promise.all([
      loadAutomationAccounts({
        background: options.background,
        force: options.force ?? true
      }),
      loadTasks({
        background: options.background,
        force: options.force ?? true
      }),
      loadWorkbenchStatus({ background: true }),
      loadOfficialProviders({ background: true }),
      loadGiftCardQueryAccounts({ background: options.background })
    ]);
  },
  { label: 'Apple ID 自动化任务' }
);

watch(opsTab, (tab) => {
  if (tab === 'manual' || tab === 'history') {
    void loadTasks({ force: false });
  }
});

watch(activeWorkspace, (workspace) => {
  if (
    ['status', 'balance', 'topup-renewal', 'cancel-subscription', 'account-maintenance'].includes(
      workspace
    ) &&
    !automationAccountsLoaded.value
  ) {
    void loadAutomationAccounts({ force: false });
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
  tasksLoadError.value = '';
  selectedHistoryTasks.value = selectedHistoryTasks.value.filter((selected) =>
    tasks.value.some((task) => task.id === selected.id)
  );
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
      tasksLoadError.value = getLoadErrorMessage(error, '加载自动化任务失败');
      ElMessage.error(tasksLoadError.value);
    }
  } finally {
    if (activeTasksQueryKey.value === key) {
      loading.value = false;
    }
  }
}

function buildAutomationAccountParams(page = automationAccountQuery.page): AppleAccountQuery {
  return {
    ...automationAccountQuery,
    page,
    keyword: automationAccountQuery.keyword || undefined,
    status: automationAccountQuery.status || undefined,
    region: automationAccountQuery.region || undefined,
    sortBy: automationAccountQuery.sortBy || 'createdAt',
    sortOrder: automationAccountQuery.sortOrder || 'desc'
  };
}

async function loadAutomationAccounts(options: { background?: boolean; force?: boolean } = {}) {
  accountsLoading.value = !options.background;
  try {
    const result = await appleAccountsApi.list(buildAutomationAccountParams());
    automationAccounts.value = Array.isArray(result.items) ? result.items : [];
    automationAccountsTotal.value = Number.isFinite(Number(result.total))
      ? Number(result.total)
      : automationAccounts.value.length;
    automationAccountsLoaded.value = true;
    automationAccountsLoadError.value = '';
    pruneSelectedAccounts();
  } catch (error) {
    if (!options.background) {
      automationAccountsLoadError.value = getLoadErrorMessage(error, '加载 Apple ID 列表失败');
      ElMessage.error(automationAccountsLoadError.value);
    }
  } finally {
    accountsLoading.value = false;
  }
}

function pruneSelectedAccounts() {
  const visibleIds = new Set(automationAccounts.value.map((account) => account.id));
  selectedStatusAccounts.value = selectedStatusAccounts.value.filter((account) =>
    visibleIds.has(account.id)
  );
  selectedBalanceAccounts.value = selectedBalanceAccounts.value.filter((account) =>
    visibleIds.has(account.id)
  );
  selectedTopupAccounts.value = selectedTopupAccounts.value.filter((account) =>
    visibleIds.has(account.id)
  );
  selectedCancelAccounts.value = selectedCancelAccounts.value.filter((account) =>
    visibleIds.has(account.id)
  );
  selectedMaintenanceAccounts.value = selectedMaintenanceAccounts.value.filter((account) =>
    visibleIds.has(account.id)
  );
}

async function handleAutomationAccountSearch() {
  automationAccountQuery.page = 1;
  await loadAutomationAccounts();
}

async function clearAutomationAccountFilters() {
  automationAccountQuery.keyword = '';
  automationAccountQuery.status = '';
  automationAccountQuery.region = '';
  automationAccountQuery.page = 1;
  await loadAutomationAccounts();
}

function handleStatusAccountSelectionChange(rows: AppleAccount[]) {
  selectedStatusAccounts.value = rows;
}

function handleBalanceAccountSelectionChange(rows: AppleAccount[]) {
  selectedBalanceAccounts.value = rows;
}

function handleTopupAccountSelectionChange(rows: AppleAccount[]) {
  selectedTopupAccounts.value = rows;
}

function handleCancelAccountSelectionChange(rows: AppleAccount[]) {
  selectedCancelAccounts.value = rows;
}

function handleMaintenanceAccountSelectionChange(rows: AppleAccount[]) {
  selectedMaintenanceAccounts.value = rows;
}

async function collectAutomationAccountIdsFromCurrentFilter() {
  const first = await appleAccountsApi.list({
    ...buildAutomationAccountParams(1),
    pageSize: AUTOMATION_ALL_ACCOUNTS_PAGE_SIZE
  });
  const ids = first.items.map((account) => account.id);
  const totalPages = Math.ceil(first.total / AUTOMATION_ALL_ACCOUNTS_PAGE_SIZE);

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await appleAccountsApi.list({
      ...buildAutomationAccountParams(page),
      pageSize: AUTOMATION_ALL_ACCOUNTS_PAGE_SIZE
    });
    ids.push(...result.items.map((account) => account.id));
  }

  return Array.from(new Set(ids));
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
    workbenchStatusLoadError.value = '';
  } catch (error) {
    if (!options.background) {
      workbenchStatusLoadError.value = getLoadErrorMessage(error, '加载自动化能力状态失败');
      ElMessage.error(workbenchStatusLoadError.value);
    }
  } finally {
    workbenchStatusLoading.value = false;
  }
}

async function loadGiftCardQueryAccounts(options: { background?: boolean } = {}) {
  giftCardAccountsLoading.value = !options.background;
  try {
    const result = await appleAutomationTasksApi.listGiftCardQueryAccounts();
    giftCardQueryAccounts.value = result.items.map(mapStoredGiftCardQueryAccount);
    assignGiftCardRowsToAccounts();
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载礼品卡查询账号池失败');
    }
  } finally {
    giftCardAccountsLoading.value = false;
  }
}

function mapStoredGiftCardQueryAccount(account: AppleGiftCardQueryAccount): GiftCardQueryAccount {
  return {
    id: account.id,
    appleIdMasked: account.appleIdMasked,
    passwordMasked: account.passwordSaved ? '已加密保存' : '未保存',
    status: account.status,
    message:
      account.remark ||
      (account.status === 'disabled' ? '该查询账号已暂停' : '已保存到后端加密账号池')
  };
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

function handleHistorySelectionChange(rows: AppleAutomationTask[]) {
  selectedHistoryTasks.value = rows;
}

async function bulkDeleteSelectedTasks() {
  const ids = selectedHistoryTaskIds.value;
  if (!ids.length) {
    ElMessage.warning('请先勾选要删除的执行记录');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${ids.length} 条执行记录吗？这个操作只删除自动化执行记录，不会删除 Apple ID、订单或价格数据。`,
      '批量删除执行记录',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '返回'
      }
    );

    bulkDeleting.value = true;
    await appleAutomationTasksApi.bulkDelete({ ids });
    selectedHistoryTasks.value = [];
    historyTableRef.value?.clearSelection?.();
    invalidateSmartQueries('apple-automation-tasks');
    await loadTasks({ force: true });
    void loadWorkbenchStatus({ background: true });
    ElMessage.success(`已删除 ${ids.length} 条执行记录`);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '批量删除失败');
    }
  } finally {
    bulkDeleting.value = false;
  }
}

async function startStatusCheck(scope: 'selected' | 'filtered' | MouseEvent = 'selected') {
  const executionScope = scope === 'filtered' ? 'filtered' : 'selected';
  manualInputPromptedTaskIds.value = [];
  runningAction.value = 'status';
  try {
    const appleAccountIds =
      executionScope === 'filtered'
        ? await collectAutomationAccountIdsFromCurrentFilter()
        : selectedStatusAccountIds.value;
    if (!appleAccountIds.length) {
      ElMessage.warning(
        executionScope === 'filtered' ? '当前筛选下没有 Apple ID' : '请先勾选要检查的 Apple ID'
      );
      return;
    }
    taskBatchResults.value = await appleAutomationTasksApi.createStatusCheckBatch({
      appleAccountIds,
      priority: statusCheckForm.priority,
      gatewayRegion: statusCheckForm.gatewayRegion || null,
      note: statusCheckForm.note.trim() || null
    });
    activeWorkspace.value = 'status';
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

async function startBalanceCheck(scope: 'selected' | 'filtered' | MouseEvent = 'selected') {
  const executionScope = scope === 'filtered' ? 'filtered' : 'selected';
  clearTaskBatchPollTimer();
  manualInputPromptedTaskIds.value = [];
  runningAction.value = 'balance';
  try {
    const appleAccountIds =
      executionScope === 'filtered'
        ? await collectAutomationAccountIdsFromCurrentFilter()
        : selectedBalanceAccountIds.value;
    if (!appleAccountIds.length) {
      ElMessage.warning(
        executionScope === 'filtered' ? '当前筛选下没有 Apple ID' : '请先勾选要查询余额的 Apple ID'
      );
      return;
    }
    taskBatchResults.value = await appleAutomationTasksApi.createBalanceCheckBatch({
      appleAccountIds,
      priority: balanceCheckForm.priority,
      note: balanceCheckForm.note.trim() || null
    });
    activeWorkspace.value = 'balance';
    query.taskType = 'check_balance';
    query.page = 1;
    void loadTasks({ background: true, force: true });
    void loadWorkbenchStatus({ background: true });
    void maybePromptManualInputForBatchResults(taskBatchResults.value);
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
    activeWorkspace.value = 'official-price';
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
    void maybePromptManualInputForBatchResults(result);
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

async function maybePromptManualInputForBatchResults(result: AppleAutomationTaskBatchResults) {
  const row = result.items.find(
    (item) =>
      isBatchRowManualInputNeeded(item) && !manualInputPromptedTaskIds.value.includes(item.taskId)
  );
  if (!row) return;

  manualInputPromptedTaskIds.value = [...manualInputPromptedTaskIds.value, row.taskId];
  await promptManualInputForBatchRow(row, { auto: true });
}

function isBatchRowManualInputNeeded(row: AppleAutomationTaskBatchResult) {
  const text = `${row.errorMessage ?? ''} ${row.suggestedAction ?? ''}`.toLowerCase();
  return (
    row.manualRequired ||
    row.status === 'waiting_manual_verify' ||
    row.resultStatus === 'need_verify' ||
    text.includes('验证码') ||
    text.includes('人工') ||
    text.includes('captcha') ||
    text.includes('verification')
  );
}

async function promptManualInputForBatchRow(
  row: AppleAutomationTaskBatchResult,
  options: { auto?: boolean } = {}
) {
  const inputType = inferManualInputType(row);
  try {
    const { value } = await ElMessageBox.prompt(
      getManualInputPromptText(inputType, row),
      options.auto ? '需要人工验证' : '输入验证码/人工信息',
      {
        inputType: 'textarea',
        inputPlaceholder: '请输入验证码、设备确认结果或处理说明',
        confirmButtonText: '提交并重试',
        cancelButtonText: '稍后处理'
      }
    );
    if (!value?.trim()) {
      ElMessage.warning('请输入验证码或人工处理说明');
      return;
    }

    await runTaskAction(row.taskId, async () => {
      selectedTask.value = await appleAutomationTasksApi.submitManualInput(row.taskId, {
        inputType,
        value: value.trim(),
        note: row.errorMessage || row.suggestedAction || null
      });
      ElMessage.success('已提交人工输入，任务会重新执行');
      void loadWorkbenchStatus({ background: true });
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '提交人工输入失败');
    }
  }
}

function isTaskManualInputNeeded(task: AppleAutomationTask) {
  const text = getTaskManualInputText(task);
  return (
    task.manualRequired ||
    task.status === 'waiting_manual_verify' ||
    text.includes('验证码') ||
    text.includes('人工') ||
    text.includes('captcha') ||
    text.includes('verification') ||
    text.includes('need_verify')
  );
}

async function promptManualInputForTask(task: AppleAutomationTask) {
  const inputType = inferManualInputTypeForTask(task);
  try {
    const { value } = await ElMessageBox.prompt(
      getManualInputPromptTextForTask(inputType, task),
      '输入验证码/人工信息',
      {
        inputType: 'textarea',
        inputPlaceholder: '请输入验证码、设备确认结果或处理说明',
        confirmButtonText: '提交并重试',
        cancelButtonText: '稍后处理'
      }
    );
    if (!value?.trim()) {
      ElMessage.warning('请输入验证码或人工处理说明');
      return;
    }

    await runTaskAction(task.id, async () => {
      const updated = await appleAutomationTasksApi.submitManualInput(task.id, {
        inputType,
        value: value.trim(),
        note: task.errorMessage || null
      });
      if (selectedTask.value?.id === task.id) {
        selectedTask.value = updated;
      }
      ElMessage.success('已提交人工输入，任务会重新执行');
      await loadTasks({ force: true });
      void loadWorkbenchStatus({ background: true });
    });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '提交人工输入失败');
    }
  }
}

function inferManualInputType(
  row: AppleAutomationTaskBatchResult
): 'verification_code' | 'captcha' | 'device_confirmation' | 'note' {
  const text = `${row.errorMessage ?? ''} ${row.suggestedAction ?? ''}`.toLowerCase();
  if (text.includes('captcha')) return 'captcha';
  if (text.includes('设备') || text.includes('device')) return 'device_confirmation';
  if (
    text.includes('验证码') ||
    text.includes('verification') ||
    row.resultStatus === 'need_verify'
  ) {
    return 'verification_code';
  }
  return 'note';
}

function inferManualInputTypeForTask(
  task: AppleAutomationTask
): 'verification_code' | 'captcha' | 'device_confirmation' | 'note' {
  const text = getTaskManualInputText(task);
  if (text.includes('captcha')) return 'captcha';
  if (text.includes('设备') || text.includes('device')) return 'device_confirmation';
  if (
    text.includes('验证码') ||
    text.includes('verification') ||
    text.includes('need_verify') ||
    task.status === 'waiting_manual_verify'
  ) {
    return 'verification_code';
  }
  return 'note';
}

function getManualInputPromptText(
  inputType: 'verification_code' | 'captcha' | 'device_confirmation' | 'note',
  row: AppleAutomationTaskBatchResult
) {
  const account = row.appleAccount?.appleIdMasked ?? '该 Apple ID';
  if (inputType === 'captcha') {
    return `${account} 需要 CAPTCHA/图形验证信息，请输入人工处理结果或验证码。`;
  }
  if (inputType === 'device_confirmation') {
    return `${account} 需要设备确认，请输入确认结果或收到的代码。`;
  }
  if (inputType === 'note') {
    return `${account} 需要人工处理，请输入处理说明。`;
  }
  return `${account} 需要验证码，请输入收到的验证码。`;
}

function getManualInputPromptTextForTask(
  inputType: 'verification_code' | 'captcha' | 'device_confirmation' | 'note',
  task: AppleAutomationTask
) {
  const account = task.appleAccount?.appleIdMasked ?? '该 Apple ID';
  if (inputType === 'captcha') {
    return `${account} 需要 CAPTCHA/图形验证信息，请输入人工处理结果或验证码。`;
  }
  if (inputType === 'device_confirmation') {
    return `${account} 需要设备确认，请输入确认结果或收到的代码。`;
  }
  if (inputType === 'note') {
    return `${account} 需要人工处理，请输入处理说明。`;
  }
  return `${account} 需要验证码，请输入收到的验证码。`;
}

function getTaskManualInputText(task: AppleAutomationTask) {
  const resultPayload = task.resultPayload ? JSON.stringify(task.resultPayload) : '';
  return `${task.errorMessage ?? ''} ${resultPayload}`.toLowerCase();
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
    opsTab.value = 'manual';
    await loadTasks({ force: true });
    void loadWorkbenchStatus({ background: true });
    ElMessage.success('处理已开始，结果会回到本页表格或人工处理区');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '开始处理失败');
  } finally {
    savingAdvanced.value = false;
  }
}

async function createAutomationTasksForAccounts(
  taskType: AutomationTaskType,
  scope: 'selected' | 'filtered',
  selectedIds: string[]
) {
  const ids =
    scope === 'filtered' ? await collectAutomationAccountIdsFromCurrentFilter() : selectedIds;
  if (!ids.length) {
    ElMessage.warning(scope === 'filtered' ? '当前筛选下没有 Apple ID' : '请先勾选 Apple ID');
    return;
  }

  actionLoadingId.value = `${taskType}-${scope}`;
  try {
    for (const appleAccountId of ids) {
      await appleAutomationTasksApi.create({
        taskType,
        appleAccountId,
        priority: taskType === 'topup' ? 'high' : 'medium',
        inputPayload: {
          source: 'automation_feature_page',
          requiresRealWorkerOrManualFallback: true
        }
      });
    }
    query.taskType = taskType;
    query.page = 1;
    opsTab.value = 'manual';
    await loadTasks({ force: true });
    void loadWorkbenchStatus({ background: true });
    ElMessage.success(`${ids.length} 个 ${getTaskTypeLabel(taskType)}已开始，结果会回到本页表格`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '开始处理失败');
  } finally {
    actionLoadingId.value = '';
  }
}

async function createTopupTasks(scope: 'selected' | 'filtered' = 'selected') {
  await createAutomationTasksForAccounts('topup', scope, selectedTopupAccountIds.value);
}

async function createRenewalCheckTasks(scope: 'selected' | 'filtered' = 'selected') {
  await createAutomationTasksForAccounts('check_renewal', scope, selectedTopupAccountIds.value);
}

async function createCancelSubscriptionTasks(scope: 'selected' | 'filtered' = 'selected') {
  await createAutomationTasksForAccounts(
    'cancel_subscription',
    scope,
    selectedCancelAccountIds.value
  );
}

async function createMaintenanceTasks(scope: 'selected' | 'filtered' = 'selected') {
  await createAutomationTasksForAccounts(
    maintenanceMode.value,
    scope,
    selectedMaintenanceAccountIds.value
  );
}

async function saveGiftCardQueryAccountsFromPaste() {
  const rows = giftCardAccountForm.pastedAccounts
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length > 5) {
    ElMessage.warning('礼品卡查询账号最多保留 5 个，请删掉多余账号');
    return;
  }

  const parsed: SaveAppleGiftCardQueryAccountPayload[] = [];
  const invalidLineNumbers: number[] = [];
  rows.forEach((line, index) => {
    const account = parseGiftCardQueryAccountPasteLine(line);
    if (!account) {
      invalidLineNumbers.push(index + 1);
      return;
    }
    parsed.push({
      appleId: account.appleId,
      status: 'ready',
      password: account.password,
      remark: `查询账号 ${index + 1}`
    });
  });

  if (!parsed.length) {
    ElMessage.warning('请按每行一个“Apple ID 密码”的格式粘贴，支持空格、----、逗号、冒号等分隔');
    return;
  }

  giftCardAccountsSaving.value = true;
  try {
    const result = await appleAutomationTasksApi.saveGiftCardQueryAccounts({ accounts: parsed });
    giftCardQueryAccounts.value = result.items.map(mapStoredGiftCardQueryAccount);
    giftCardAccountForm.pastedAccounts = '';
    assignGiftCardRowsToAccounts();
    ElMessage.success(`已加密保存 ${result.items.length} 个礼品卡查询账号`);
    if (invalidLineNumbers.length) {
      ElMessage.warning(`已忽略格式不完整的第 ${invalidLineNumbers.join('、')} 行`);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存礼品卡查询账号失败');
  } finally {
    giftCardAccountsSaving.value = false;
  }
}

function parseGiftCardQueryAccountPasteLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  for (const delimiter of giftCardAccountPasteDelimiters) {
    delimiter.lastIndex = 0;
    const match = delimiter.exec(trimmed);
    if (!match || match.index <= 0) continue;

    const appleId = trimmed.slice(0, match.index).trim();
    const password = trimmed.slice(match.index + match[0].length).trim();
    if (appleId && password) {
      return { appleId, password };
    }
  }

  return null;
}

async function clearGiftCardQueryAccounts() {
  giftCardAccountsSaving.value = true;
  try {
    const result = await appleAutomationTasksApi.saveGiftCardQueryAccounts({ accounts: [] });
    giftCardAccountForm.pastedAccounts = '';
    giftCardQueryAccounts.value = result.items.map(mapStoredGiftCardQueryAccount);
    assignGiftCardRowsToAccounts();
    ElMessage.success('已清空礼品卡查询账号池');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '清空礼品卡查询账号池失败');
  } finally {
    giftCardAccountsSaving.value = false;
  }
}

function handleGiftCardImageChange(_file: unknown, uploadFiles: GiftCardUploadFile[]) {
  syncGiftCardRows(uploadFiles);
}

function handleGiftCardImageRemove(_file: unknown, uploadFiles: GiftCardUploadFile[]) {
  syncGiftCardRows(uploadFiles);
}

function syncGiftCardRows(uploadFiles: GiftCardUploadFile[]) {
  currentGiftCardRunId.value = '';
  giftCardUploadFiles.value = uploadFiles;
  giftCardRows.value = uploadFiles.map((file, index) => {
    const fileName = file.name || `gift-card-${index + 1}`;
    const existing = giftCardRows.value.find((row) => row.fileName === fileName);
    return {
      id: existing?.id ?? `${Date.now()}-${index}-${fileName}`,
      attachmentId: existing?.attachmentId ?? null,
      fileName,
      extractedCode: existing?.extractedCode ?? '待识别',
      assignedAppleId: existing?.assignedAppleId ?? getAssignedGiftCardAccount(index),
      status: existing?.status ?? 'pending_ocr',
      balance: existing?.balance ?? '-',
      currency: existing?.currency ?? '-',
      message: existing?.message ?? '等待图片识别和查询'
    };
  });
  assignGiftCardRowsToAccounts();
}

function assignGiftCardRowsToAccounts() {
  const readyAccounts = giftCardQueryAccounts.value.filter((account) => account.status === 'ready');
  giftCardRows.value = giftCardRows.value.map((row, index) => ({
    ...row,
    assignedAppleId: readyAccounts.length
      ? readyAccounts[index % readyAccounts.length].appleIdMasked
      : '未分配'
  }));
}

function getAssignedGiftCardAccount(index: number) {
  const readyAccounts = giftCardQueryAccounts.value.filter((account) => account.status === 'ready');
  return readyAccounts.length
    ? readyAccounts[index % readyAccounts.length].appleIdMasked
    : '未分配';
}

async function startGiftCardBalanceCheck() {
  if (!giftCardReadyAccountCount.value) {
    ElMessage.warning('请先准备 5 个以内的查询 Apple ID');
    return;
  }
  if (!giftCardRows.value.length) {
    ElMessage.warning('请先上传礼品卡图片');
    return;
  }

  giftCardActionRunning.value = true;
  try {
    const rowsWithAttachments = await uploadGiftCardImages();
    const attachmentIds = rowsWithAttachments
      .map((row) => row.attachmentId)
      .filter((id): id is string => Boolean(id));
    const run = await appleAutomationTasksApi.createGiftCardBalanceCheck({ attachmentIds });
    currentGiftCardRunId.value = run.id;
    giftCardRows.value = run.rows.map(mapGiftCardBalanceCheckRow);
    if (run.status === 'completed') {
      ElMessage.success('图片已上传，礼品卡余额查询已完成');
    } else if (run.rows.some((row) => row.status === 'pending_ocr')) {
      ElMessage.warning('图片已上传；部分图片等待 OCR 识别或手动补录代码');
    } else {
      ElMessage.warning('图片已上传；当前批次仍有项目需要人工处理或配置执行器');
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建礼品卡余额查询批次失败');
  } finally {
    giftCardActionRunning.value = false;
  }
}

async function runCurrentGiftCardBalanceCheck() {
  if (!currentGiftCardRunId.value) {
    ElMessage.warning('请先创建礼品卡查询批次');
    return;
  }
  if (!canRunCurrentGiftCardRun.value) {
    ElMessage.warning('请先补齐待识别的礼品卡代码');
    return;
  }

  giftCardActionRunning.value = true;
  try {
    const run = await appleAutomationTasksApi.runGiftCardBalanceCheck(currentGiftCardRunId.value);
    currentGiftCardRunId.value = run.id;
    giftCardRows.value = run.rows.map(mapGiftCardBalanceCheckRow);
    if (run.status === 'completed') {
      ElMessage.success('当前礼品卡批次已执行完成');
      return;
    }
    ElMessage.warning('当前礼品卡批次仍有项目需要人工处理');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '执行礼品卡余额查询失败');
  } finally {
    giftCardActionRunning.value = false;
  }
}

async function uploadGiftCardImages() {
  const nextRows: GiftCardResultRow[] = [];
  for (const row of giftCardRows.value) {
    if (row.attachmentId) {
      nextRows.push(row);
      continue;
    }

    const uploadFile = giftCardUploadFiles.value.find((file) => {
      const fileName = file.name || '';
      return fileName === row.fileName;
    });
    if (!uploadFile?.raw) {
      throw new Error(`图片文件不可读取：${row.fileName}`);
    }

    const attachment = await attachmentsApi.upload(uploadFile.raw, {
      businessModule: 'apple_automation_task',
      objectType: 'gift_card_balance_check',
      purpose: 'gift_card_image',
      remark: 'Apple 礼品卡余额查询图片'
    });
    nextRows.push({
      ...row,
      attachmentId: attachment.id,
      status: 'waiting_worker',
      message: '图片已上传，等待创建查询批次'
    });
    giftCardRows.value = nextRows.concat(
      giftCardRows.value.slice(nextRows.length).map((pendingRow) => ({
        ...pendingRow,
        message: pendingRow.attachmentId ? pendingRow.message : '等待上传图片'
      }))
    );
  }

  giftCardRows.value = nextRows;
  return nextRows;
}

function canEditGiftCardCode(row: GiftCardResultRow) {
  return Boolean(currentGiftCardRunId.value) && isGiftCardCodeMissing(row);
}

function canRetryGiftCardRow(row: GiftCardResultRow) {
  return (
    Boolean(currentGiftCardRunId.value) &&
    (row.status === 'manual_required' || row.status === 'failed') &&
    !isGiftCardCodeMissing(row)
  );
}

function isGiftCardCodeMissing(row: GiftCardResultRow) {
  return (
    row.status === 'pending_ocr' ||
    !row.extractedCode ||
    row.extractedCode === '-' ||
    row.extractedCode === '待识别'
  );
}

async function promptGiftCardCode(row: GiftCardResultRow) {
  if (!currentGiftCardRunId.value) {
    ElMessage.warning('请先创建礼品卡查询批次');
    return;
  }

  try {
    const { value } = await ElMessageBox.prompt('请输入图片中的礼品卡代码', '补录礼品卡代码', {
      inputValue: row.extractedCode === '待识别' ? '' : row.extractedCode,
      inputPlaceholder: '可直接粘贴完整代码',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (value) => {
        const normalized = String(value ?? '').replace(/[^a-zA-Z0-9]/g, '');
        if (normalized.length < 8) return '礼品卡代码至少需要 8 位字母或数字';
        if (normalized.length > 64) return '礼品卡代码不能超过 64 位';
        return true;
      }
    });

    giftCardRowActionId.value = row.id;
    const run = await appleAutomationTasksApi.updateGiftCardBalanceCheckRow(
      currentGiftCardRunId.value,
      row.id,
      { extractedCode: value }
    );
    currentGiftCardRunId.value = run.id;
    giftCardRows.value = run.rows.map(mapGiftCardBalanceCheckRow);
    ElMessage.success('已补录礼品卡代码');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '补录礼品卡代码失败');
    }
  } finally {
    giftCardRowActionId.value = '';
  }
}

async function retryGiftCardBalanceCheckRow(row: GiftCardResultRow) {
  if (!currentGiftCardRunId.value) {
    ElMessage.warning('请先创建礼品卡查询批次');
    return;
  }
  if (isGiftCardCodeMissing(row)) {
    ElMessage.warning('请先补录图片中的礼品卡代码');
    return;
  }

  giftCardRowActionId.value = row.id;
  try {
    const run = await appleAutomationTasksApi.runGiftCardBalanceCheck(currentGiftCardRunId.value);
    currentGiftCardRunId.value = run.id;
    giftCardRows.value = run.rows.map(mapGiftCardBalanceCheckRow);
    if (run.status === 'completed') {
      ElMessage.success('礼品卡余额查询已完成');
      return;
    }
    ElMessage.warning('仍有礼品卡需要人工处理');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重试礼品卡余额查询失败');
  } finally {
    giftCardRowActionId.value = '';
  }
}

function mapGiftCardBalanceCheckRow(row: AppleGiftCardBalanceCheckRow): GiftCardResultRow {
  return {
    id: row.id,
    attachmentId: row.attachmentId,
    fileName: row.fileName,
    extractedCode: row.extractedCode,
    assignedAppleId: row.assignedAppleId,
    status: row.status,
    balance: row.balance,
    currency: row.currency,
    message: row.message
  };
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

async function runManualReview(task: AppleAutomationTask) {
  await runTaskAction(task.id, async () => {
    selectedTask.value = await appleAutomationTasksApi.runManualReview(task.id);
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
    const { value } = await ElMessageBox.prompt('请输入结果内容', '回写成功结果', {
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
    ElMessage.error('结果内容格式不正确');
    return false;
  }
}

function exportList() {
  const rows = selectedHistoryTasks.value.length ? selectedHistoryTasks.value : tasks.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的自动化任务');
    return;
  }

  const count = exportRowsToCsv(
    'apple-automation-tasks',
    [
      { header: '任务', value: (row) => getTaskTypeLabel(row.taskType) },
      { header: 'Apple ID', value: (row) => row.appleAccount?.appleIdMasked ?? '未绑定 Apple ID' },
      { header: '地区', value: (row) => formatAccountRegion(row.appleAccount?.region) },
      { header: '当前余额', value: (row) => row.appleAccount?.currentBalance ?? '-' },
      { header: '客户', value: (row) => row.customer?.name ?? '' },
      { header: '业务', value: (row) => row.service?.name ?? '' },
      { header: '优先级', value: (row) => getPriorityLabel(row.priority) },
      { header: '状态', value: (row) => getStatusLabel(row.status) },
      { header: '重试次数', value: (row) => row.retryCount },
      { header: '需要人工', value: (row) => (row.manualRequired ? '是' : '否') },
      { header: '异常说明', value: (row) => row.errorMessage ?? '' },
      {
        header: '创建人',
        value: (row) => row.createdBy?.displayName ?? row.createdBy?.username ?? ''
      },
      { header: '开始时间', value: (row) => formatDate(row.startedAt) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条自动化任务`);
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

function getPriorityLabel(value: AutomationTaskPriority) {
  return priorityOptions.find((item) => item.value === value)?.label ?? value;
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

function getAccountStatusTone(value: AppleAccount['status']) {
  if (value === 'normal') return 'green';
  if (value === 'locked' || value === 'password_error' || value === 'risk') return 'red';
  if (value === 'need_verify' || value === 'unknown') return 'orange';
  return 'neutral';
}

function getGiftCardAccountStatusLabel(value: GiftCardQueryAccountStatus) {
  return (
    {
      ready: '已准备',
      needs_login: '需登录',
      disabled: '暂停'
    }[value] ?? value
  );
}

function getGiftCardResultStatusLabel(value: GiftCardResultStatus) {
  return (
    {
      pending_ocr: '待识别',
      waiting_worker: '待查询',
      manual_required: '需人工',
      success: '成功',
      failed: '失败'
    }[value] ?? value
  );
}

function getGiftCardResultTone(value: GiftCardResultStatus) {
  if (value === 'success') return 'green';
  if (value === 'failed') return 'red';
  if (value === 'manual_required' || value === 'waiting_worker') return 'orange';
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
  if (!capability.enabled) return '自动执行未开启';
  if (!capability.gatewayConfigured) return '缺少节点';
  return '可真查';
}

function getCapabilityModeLabel(value?: string) {
  if (value === 'apple_web_worker') return '官方读取任务';
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

function getBatchResultForAccount(
  batch: AppleAutomationTaskBatchResults | null,
  accountId: string
) {
  return batch?.items.find((item) => item.appleAccount?.id === accountId) ?? null;
}

function getStatusResultLabel(account: AppleAccount) {
  const result = getBatchResultForAccount(statusBatchResults.value, account.id);
  if (!result) return '待查询';
  if (result.errorMessage) return '异常';
  return getBatchRowResultLabel(result);
}

function getStatusResultTone(accountId: string) {
  const result = getBatchResultForAccount(statusBatchResults.value, accountId);
  if (!result) return 'neutral';
  return getStatusTone(result.status);
}

function getStatusResultMessage(accountId: string) {
  const result = getBatchResultForAccount(statusBatchResults.value, accountId);
  return result?.errorMessage || result?.suggestedAction || '等待本页查询';
}

function getBalanceCheckedValue(accountId: string) {
  const result = getBatchResultForAccount(balanceBatchResults.value, accountId);
  return result?.checkedBalance ?? '-';
}

function getBalanceDiff(account: AppleAccount) {
  const result = getBatchResultForAccount(balanceBatchResults.value, account.id);
  if (!result?.checkedBalance) return '-';
  const checked = Number(result.checkedBalance);
  const system = Number(account.currentBalance);
  if (!Number.isFinite(checked) || !Number.isFinite(system)) return '-';
  const diff = checked - system;
  return diff === 0 ? '0' : diff.toFixed(2);
}

function getBalanceSourceLabel(accountId: string) {
  const result = getBatchResultForAccount(balanceBatchResults.value, accountId);
  return result?.resultSource ? getResultSourceLabel(result.resultSource) : '-';
}

function getBalanceResultLabel(accountId: string) {
  const result = getBatchResultForAccount(balanceBatchResults.value, accountId);
  if (!result) return '待查询';
  if (result.errorMessage) return '异常';
  return getStatusLabel(result.status);
}

function getBalanceResultTone(accountId: string) {
  const result = getBatchResultForAccount(balanceBatchResults.value, accountId);
  if (!result) return 'neutral';
  return getStatusTone(result.status);
}

function getLatestTaskForAccount(accountId: string, taskTypes: AutomationTaskType[]) {
  const matchedTasks = tasks.value.filter(
    (task) => task.appleAccount?.id === accountId && taskTypes.includes(task.taskType)
  );
  return (
    matchedTasks.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )[0] ?? null
  );
}

function getFeatureActionResultLabel(accountId: string, taskTypes: AutomationTaskType[]) {
  const task = getLatestTaskForAccount(accountId, taskTypes);
  return task ? getStatusLabel(task.status) : '待操作';
}

function getFeatureActionResultTone(accountId: string, taskTypes: AutomationTaskType[]) {
  const task = getLatestTaskForAccount(accountId, taskTypes);
  return task ? getStatusTone(task.status) : 'neutral';
}

function getFeatureActionMessage(accountId: string, taskTypes: AutomationTaskType[]) {
  const task = getLatestTaskForAccount(accountId, taskTypes);
  if (!task) return '等待本页操作';
  if (task.errorMessage) return task.errorMessage;
  if (task.manualRequired) return '需要人工验证，请在本页下方人工处理区输入验证码或回写结果';
  if (task.resultPayload) return '已有处理结果，可打开详情查看';
  return `${getTaskTypeLabel(task.taskType)}已开始，等待执行反馈`;
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

function getAccountSecretSummary(account: AppleAccount) {
  const parts = [
    account.hasPassword ? '密码' : '',
    account.hasPhone ? '手机号' : '',
    account.hasSecurityInfo ? '密保' : '',
    account.hasRecoveryEmail ? '备用邮箱' : ''
  ].filter(Boolean);
  return parts.length ? parts.join(' / ') : '资料不完整';
}

function getTopupRecommendation(account: AppleAccount) {
  const balance = Number(account.currentBalance);
  if (account.status !== 'normal') return '先处理账号状态';
  if (Number.isFinite(balance) && balance <= 0) return '优先充值';
  if (Number.isFinite(balance) && balance < 5) return '余额偏低';
  return '按续费计划检查';
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
  if (tasksLoaded.value || opsTab.value === 'manual' || opsTab.value === 'history') {
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

.automation-feature-nav {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px;
  background: var(--el-fill-color-extra-light);
}

.automation-feature-nav__item {
  display: flex;
  min-height: 92px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 10px;
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.automation-feature-nav__item:hover,
.automation-feature-nav__item:focus-visible {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-bg-color);
  outline: none;
  transform: translateY(-1px);
}

.automation-feature-nav__item.active {
  border-color: var(--el-color-primary);
  background: var(--el-bg-color);
  color: var(--el-color-primary);
}

.automation-feature-nav__item span {
  border-radius: 4px;
  padding: 2px 6px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
}

.automation-feature-nav__item strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.35;
}

.automation-feature-nav__item small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.automation-feature-shell,
.automation-ops-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
}

.automation-feature-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.automation-feature-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.automation-feature-head > div:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.automation-feature-head strong {
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.automation-feature-head span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.automation-inline-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.automation-account-search {
  width: min(360px, 100%);
}

.automation-filter-select {
  width: 180px;
}

.automation-business-table {
  width: 100%;
}

.automation-result-block--inline {
  margin-top: 0;
}

.gift-card-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 14px;
}

.gift-card-credential-panel,
.gift-card-upload-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-fill-color-extra-light);
}

.gift-card-upload-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--el-text-color-secondary);
}

.gift-card-upload-copy strong {
  color: var(--el-text-color-primary);
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
  .automation-feature-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .automation-readiness-grid,
  .automation-action-grid,
  .gift-card-workbench {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .automation-feature-nav {
    grid-template-columns: 1fr;
  }

  .automation-form-row,
  .automation-secondary-actions,
  .automation-result-block__head,
  .automation-feature-head {
    grid-template-columns: 1fr;
  }

  .automation-feature-head,
  .automation-secondary-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .automation-account-search,
  .automation-filter-select,
  .automation-history-toolbar__search,
  .automation-history-toolbar__select {
    width: 100%;
  }
}
</style>
