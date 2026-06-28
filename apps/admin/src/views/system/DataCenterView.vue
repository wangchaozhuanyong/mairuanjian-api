<template>
  <PageScaffold
    title="数据备份"
    group="数据与记录"
    phase="Phase 11"
    description="这里处理数据备份、恢复、导入、导出、回收站和数据清理。系统内部字典不放给普通用户看。"
  >
    <template #actions>
      <AppButton variant="soft" @click="() => refreshCurrentTab()">刷新</AppButton>
      <AppButton v-if="activeTab === 'backups'" variant="primary" @click="openBackupDialog">
        创建备份
      </AppButton>
      <AppButton v-if="activeTab === 'restores'" variant="primary" @click="openRestoreDialog">
        创建恢复
      </AppButton>
      <AppButton v-if="activeTab === 'imports'" variant="primary" @click="openImportDialog">
        新建导入
      </AppButton>
      <AppButton v-if="activeTab === 'exports'" variant="primary" @click="openExportDialog">
        新建导出
      </AppButton>
      <AppButton v-if="activeTab === 'cleanup'" variant="primary" @click="openCleanupDialog">
        新建清理
      </AppButton>
      <AppButton v-if="activeTab === 'duplicates'" variant="primary" @click="openDuplicateDialog">
        新建合并
      </AppButton>
      <AppButton
        v-if="activeTab === 'parameters'"
        variant="primary"
        @click="() => openParameterDialog()"
      >
        保存参数
      </AppButton>
    </template>

    <section class="content-panel system-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp :title="activeTabMeta.title" :help="activeTabMeta.description" />
        <div class="inline-actions">
          <StatusChip :tone="activeTabMeta.tone" dot>{{ activeTabMeta.badge }}</StatusChip>
          <StatusChip :tone="(overview?.failedBackupCount ?? 0) > 0 ? 'red' : 'green'" dot>
            {{
              (overview?.failedBackupCount ?? 0) > 0
                ? `失败备份 ${overview?.failedBackupCount}`
                : '备份正常'
            }}
          </StatusChip>
          <StatusChip tone="orange">导入 {{ overview?.runningImportCount ?? '-' }}</StatusChip>
          <StatusChip tone="blue">导出 {{ overview?.runningExportCount ?? '-' }}</StatusChip>
          <StatusChip tone="purple">回收站 {{ overview?.recycleBinCount ?? '-' }}</StatusChip>
        </div>
      </div>

      <el-tabs
        v-model="activeTab"
        class="system-tabs data-center-tabs"
        @tab-change="() => refreshCurrentTab()"
      >
        <el-tab-pane label="总览" name="overview">
          <div class="overview-grid">
            <div>
              <h3>最近备份</h3>
              <el-table
                class="desktop-data-table"
                :data="overview?.recentBackupJobs ?? []"
                row-key="id"
              >
                <el-table-column label="类型" width="110">
                  <template #default="{ row }">{{ getBackupTypeLabel(row.jobType) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                  <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
                </el-table-column>
                <el-table-column label="备注" min-width="180" prop="remark" />
                <el-table-column label="时间" width="170">
                  <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
              <div v-if="overview?.recentBackupJobs.length" class="mobile-record-list">
                <article
                  v-for="row in overview.recentBackupJobs"
                  :key="row.id"
                  class="mobile-record-card"
                >
                  <div class="mobile-record-card__head">
                    <div class="mobile-record-card__title">
                      <strong>{{ getBackupTypeLabel(row.jobType) }}</strong>
                      <span>{{ row.remark || row.storagePath || '暂无备注' }}</span>
                    </div>
                    <JobStatusTag :status="row.status" />
                  </div>
                  <div class="mobile-record-card__meta">
                    <div>
                      <span>创建时间</span>
                      <strong>{{ formatDate(row.createdAt) }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <AppState
                v-else
                class="mobile-record-list"
                type="empty"
                title="暂无最近备份"
                description="备份任务执行后会在这里显示最近记录。"
                compact
              />
            </div>
            <div>
              <h3>最近导入</h3>
              <el-table
                class="desktop-data-table"
                :data="overview?.recentImportJobs ?? []"
                row-key="id"
              >
                <el-table-column label="模块" width="140">
                  <template #default="{ row }">{{ getImportModuleLabel(row.module) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                  <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
                </el-table-column>
                <el-table-column label="成功/失败" width="120">
                  <template #default="{ row }"
                    >{{ row.successCount }} / {{ row.failedCount }}</template
                  >
                </el-table-column>
                <el-table-column label="时间" width="170">
                  <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
              <div v-if="overview?.recentImportJobs.length" class="mobile-record-list">
                <article
                  v-for="row in overview.recentImportJobs"
                  :key="row.id"
                  class="mobile-record-card"
                >
                  <div class="mobile-record-card__head">
                    <div class="mobile-record-card__title">
                      <strong>{{ getImportModuleLabel(row.module) }}</strong>
                      <span>{{ row.filePath || row.remark || '暂无文件信息' }}</span>
                    </div>
                    <JobStatusTag :status="row.status" />
                  </div>
                  <div class="mobile-record-card__stats">
                    <div>
                      <span>成功</span>
                      <strong>{{ row.successCount }}</strong>
                    </div>
                    <div>
                      <span>失败</span>
                      <strong>{{ row.failedCount }}</strong>
                    </div>
                    <div>
                      <span>创建时间</span>
                      <strong>{{ formatDate(row.createdAt) }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <AppState
                v-else
                class="mobile-record-list"
                type="empty"
                title="暂无最近导入"
                description="导入任务执行后会在这里显示成功和失败统计。"
                compact
              />
            </div>
            <div>
              <h3>最近导出</h3>
              <el-table
                class="desktop-data-table"
                :data="overview?.recentExportJobs ?? []"
                row-key="id"
              >
                <el-table-column label="模块" width="140">
                  <template #default="{ row }">{{ getExportModuleLabel(row.module) }}</template>
                </el-table-column>
                <el-table-column label="状态" width="110">
                  <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
                </el-table-column>
                <el-table-column label="敏感" width="90">
                  <template #default="{ row }">{{ row.containsSensitive ? '是' : '否' }}</template>
                </el-table-column>
                <el-table-column label="时间" width="170">
                  <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
              <div v-if="overview?.recentExportJobs.length" class="mobile-record-list">
                <article
                  v-for="row in overview.recentExportJobs"
                  :key="row.id"
                  class="mobile-record-card"
                >
                  <div class="mobile-record-card__head">
                    <div class="mobile-record-card__title">
                      <strong>{{ getExportModuleLabel(row.module) }}</strong>
                      <span>{{ row.filePath || row.fields.join(', ') || '暂无字段信息' }}</span>
                    </div>
                    <JobStatusTag :status="row.status" />
                  </div>
                  <div class="mobile-record-card__stats">
                    <div>
                      <span>敏感字段</span>
                      <strong>{{ row.containsSensitive ? '是' : '否' }}</strong>
                    </div>
                    <div>
                      <span>字段数</span>
                      <strong>{{ row.fields.length }}</strong>
                    </div>
                    <div>
                      <span>创建时间</span>
                      <strong>{{ formatDate(row.createdAt) }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <AppState
                v-else
                class="mobile-record-list"
                type="empty"
                title="暂无最近导出"
                description="导出任务执行后会在这里显示文件和敏感字段状态。"
                compact
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="备份任务" name="backups">
          <TableToolbar
            v-model:keyword="backupQuery.keyword"
            v-model:status="backupQuery.status"
            v-model:visible-columns="backupVisibleColumns"
            v-model:saved-view-id="backupSavedViewId"
            :column-options="backupColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="backupSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索路径、备注、失败原因"
            @search="handleBackupSearch"
            @refresh="() => loadBackups()"
            @clear-filters="clearBackupFilters"
            @save-view="saveBackupTableView"
            @apply-view="applyBackupSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-select
                v-model="backupQuery.jobType"
                class="toolbar-select"
                placeholder="类型"
                clearable
                @change="handleBackupSearch"
              >
                <el-option
                  v-for="option in backupTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </TableToolbar>
          <el-table
            v-loading="backupLoading"
            class="desktop-data-table"
            :data="backups"
            :size="backupTableSize"
            row-key="id"
            @sort-change="handleBackupSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无备份任务</strong>
                <span>可以创建备份任务，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearBackupFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openBackupDialog">创建备份</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isBackupColumnVisible('jobType')"
              label="类型"
              prop="jobType"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">{{ getBackupTypeLabel(row.jobType) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isBackupColumnVisible('status')"
              label="状态"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isBackupColumnVisible('storagePath')"
              label="文件路径"
              min-width="220"
              prop="storagePath"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isBackupColumnVisible('fileSize')"
              label="文件大小"
              prop="fileSize"
              width="120"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
            </el-table-column>
            <el-table-column v-if="isBackupColumnVisible('createdBy')" label="发起人" width="130">
              <template #default="{ row }">{{ row.createdBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isBackupColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="360" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="soft" @click="executeBackup(row)">
                    执行备份
                  </AppButton>
                  <AppButton size="small" variant="ghost" @click="markBackup(row, 'running')">
                    运行
                  </AppButton>
                  <AppButton size="small" variant="success" @click="markBackup(row, 'success')">
                    成功
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="markBackup(row, 'failed')">
                    失败
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="backups.length" class="mobile-record-list">
            <article v-for="row in backups" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getBackupTypeLabel(row.jobType) }}</strong>
                  <span>{{ row.storagePath || row.remark || '等待生成备份文件' }}</span>
                </div>
                <JobStatusTag :status="row.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>文件大小</span>
                  <strong>{{ formatFileSize(row.fileSize) }}</strong>
                </div>
                <div>
                  <span>发起人</span>
                  <strong>{{ row.createdBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="executeBackup(row)">
                  执行备份
                </AppButton>
                <AppButton size="small" variant="ghost" @click="markBackup(row, 'running')">
                  运行
                </AppButton>
                <AppButton size="small" variant="success" @click="markBackup(row, 'success')">
                  成功
                </AppButton>
                <AppButton size="small" variant="danger" @click="markBackup(row, 'failed')">
                  失败
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!backupLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无备份任务"
            description="可以创建备份任务，或调整筛选后重新查看。"
            compact
          />
          <PaginationBar
            v-model:page="backupQuery.page"
            v-model:page-size="backupQuery.pageSize"
            :total="backupTotal"
            @change="() => loadBackups()"
          />
        </el-tab-pane>

        <el-tab-pane label="恢复任务" name="restores">
          <TableToolbar
            v-model:keyword="restoreQuery.keyword"
            v-model:status="restoreQuery.status"
            v-model:visible-columns="restoreVisibleColumns"
            v-model:saved-view-id="restoreSavedViewId"
            :column-options="restoreColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="restoreSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索恢复范围、审批说明"
            @search="handleRestoreSearch"
            @refresh="() => loadRestores()"
            @clear-filters="clearRestoreFilters"
            @save-view="saveRestoreTableView"
            @apply-view="applyRestoreSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="restoreQuery.backupJobId"
                class="toolbar-select"
                placeholder="备份任务 ID"
                clearable
                @keyup.enter="handleRestoreSearch"
                @clear="handleRestoreSearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="restoreLoading"
            class="desktop-data-table"
            :data="restores"
            :size="restoreTableSize"
            row-key="id"
            @sort-change="handleRestoreSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无恢复任务</strong>
                <span>可以创建恢复任务，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearRestoreFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openRestoreDialog">创建恢复</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isRestoreColumnVisible('restoreScope')"
              label="恢复范围"
              min-width="180"
              prop="restoreScope"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isRestoreColumnVisible('backupJob')"
              label="备份任务"
              min-width="180"
            >
              <template #default="{ row }">{{ row.backupJob?.id ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isRestoreColumnVisible('status')"
              label="状态"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isRestoreColumnVisible('approvalNote')"
              label="审批说明"
              min-width="220"
              prop="approvalNote"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isRestoreColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="320" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="soft" @click="executeRestore(row)">
                    恢复演练
                  </AppButton>
                  <AppButton size="small" variant="ghost" @click="markRestore(row.id, 'running')">
                    运行
                  </AppButton>
                  <AppButton size="small" variant="success" @click="markRestore(row.id, 'success')">
                    成功
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="markRestore(row.id, 'failed')">
                    失败
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="restores.length" class="mobile-record-list">
            <article v-for="row in restores" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ row.restoreScope }}</strong>
                  <span>备份任务：{{ row.backupJob?.id ?? row.backupJobId ?? '-' }}</span>
                </div>
                <JobStatusTag :status="row.status" />
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>审批说明</span>
                  <strong>{{ row.approvalNote || '-' }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="executeRestore(row)">
                  恢复演练
                </AppButton>
                <AppButton size="small" variant="ghost" @click="markRestore(row.id, 'running')">
                  运行
                </AppButton>
                <AppButton size="small" variant="success" @click="markRestore(row.id, 'success')">
                  成功
                </AppButton>
                <AppButton size="small" variant="danger" @click="markRestore(row.id, 'failed')">
                  失败
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!restoreLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无恢复任务"
            description="恢复演练或恢复申请创建后会显示在这里。"
            compact
          />
          <PaginationBar
            v-model:page="restoreQuery.page"
            v-model:page-size="restoreQuery.pageSize"
            :total="restoreTotal"
            @change="() => loadRestores()"
          />
        </el-tab-pane>

        <el-tab-pane label="导入任务" name="imports">
          <TableToolbar
            v-model:keyword="importQuery.keyword"
            v-model:status="importQuery.status"
            v-model:visible-columns="importVisibleColumns"
            v-model:saved-view-id="importSavedViewId"
            :column-options="importColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="importSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、文件或错误报告"
            @search="handleImportSearch"
            @refresh="() => loadImports()"
            @clear-filters="clearImportFilters"
            @save-view="saveImportTableView"
            @apply-view="applyImportSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="importQuery.module"
                class="toolbar-select"
                placeholder="模块"
                clearable
                @keyup.enter="handleImportSearch"
                @clear="handleImportSearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="importLoading"
            class="desktop-data-table"
            :data="imports"
            :size="importTableSize"
            row-key="id"
            @sort-change="handleImportSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无导入任务</strong>
                <span>可以新建导入任务，或清空筛选后查看历史导入。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearImportFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openImportDialog">新建导入</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isImportColumnVisible('module')"
              label="模块"
              width="130"
              prop="module"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isImportColumnVisible('status')"
              label="状态"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isImportColumnVisible('totalCount')"
              label="总数"
              width="90"
              prop="totalCount"
              sortable="custom"
            />
            <el-table-column
              v-if="isImportColumnVisible('successCount')"
              label="成功"
              width="90"
              prop="successCount"
              sortable="custom"
            />
            <el-table-column
              v-if="isImportColumnVisible('failedCount')"
              label="失败"
              width="90"
              prop="failedCount"
              sortable="custom"
            />
            <el-table-column
              v-if="isImportColumnVisible('filePath')"
              label="文件"
              min-width="220"
              prop="filePath"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isImportColumnVisible('errorReport')"
              label="错误报告"
              min-width="180"
              prop="errorReport"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isImportColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton
                    size="small"
                    variant="soft"
                    :disabled="row.status === 'running'"
                    @click="executeImport(row)"
                  >
                    运行
                  </AppButton>
                  <AppButton size="small" variant="success" @click="markImport(row.id, 'success')">
                    成功
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="markImport(row.id, 'failed')">
                    失败
                  </AppButton>
                  <AppButton
                    size="small"
                    variant="ghost"
                    :disabled="!row.errorReport"
                    @click="downloadImportErrorReport(row)"
                  >
                    错误报告
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="imports.length" class="mobile-record-list">
            <article v-for="row in imports" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getImportModuleLabel(row.module) }}</strong>
                  <span>{{ row.filePath || row.remark || '暂无文件信息' }}</span>
                </div>
                <JobStatusTag :status="row.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>总数</span>
                  <strong>{{ row.totalCount }}</strong>
                </div>
                <div>
                  <span>成功</span>
                  <strong>{{ row.successCount }}</strong>
                </div>
                <div>
                  <span>失败</span>
                  <strong>{{ row.failedCount }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
                <div>
                  <span>错误报告</span>
                  <strong>{{ row.errorReport || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton
                  size="small"
                  variant="soft"
                  :disabled="row.status === 'running'"
                  @click="executeImport(row)"
                >
                  运行
                </AppButton>
                <AppButton size="small" variant="success" @click="markImport(row.id, 'success')">
                  成功
                </AppButton>
                <AppButton size="small" variant="danger" @click="markImport(row.id, 'failed')">
                  失败
                </AppButton>
                <AppButton
                  size="small"
                  variant="ghost"
                  :disabled="!row.errorReport"
                  @click="downloadImportErrorReport(row)"
                >
                  错误报告
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!importLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无导入任务"
            description="新建导入任务后可跟踪总数、成功数和失败数。"
            compact
          />
          <PaginationBar
            v-model:page="importQuery.page"
            v-model:page-size="importQuery.pageSize"
            :total="importTotal"
            @change="() => loadImports()"
          />
        </el-tab-pane>

        <el-tab-pane label="导出任务" name="exports">
          <TableToolbar
            v-model:keyword="exportQuery.keyword"
            v-model:status="exportQuery.status"
            v-model:visible-columns="exportVisibleColumns"
            v-model:saved-view-id="exportSavedViewId"
            :column-options="exportColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="exportSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、文件、失败原因"
            @search="handleExportSearch"
            @refresh="() => loadExports()"
            @clear-filters="clearExportFilters"
            @save-view="saveExportTableView"
            @apply-view="applyExportSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="exportQuery.module"
                class="toolbar-select"
                placeholder="模块"
                clearable
                @keyup.enter="handleExportSearch"
                @clear="handleExportSearch"
              />
              <el-select
                v-model="exportQuery.containsSensitive"
                class="toolbar-select"
                placeholder="敏感"
                clearable
                @change="handleExportSearch"
              >
                <el-option
                  v-for="option in sensitiveOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </TableToolbar>
          <el-table
            v-loading="exportLoading"
            class="desktop-data-table"
            :data="exports"
            :size="exportTableSize"
            row-key="id"
            @sort-change="handleExportSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无导出任务</strong>
                <span>可以新建导出任务，或清空筛选后查看历史导出。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearExportFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openExportDialog">新建导出</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isExportColumnVisible('module')"
              label="模块"
              width="130"
              prop="module"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isExportColumnVisible('status')"
              label="状态"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column v-if="isExportColumnVisible('fields')" label="字段" min-width="220">
              <template #default="{ row }">{{ row.fields?.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isExportColumnVisible('containsSensitive')"
              label="敏感"
              prop="containsSensitive"
              width="90"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="row.containsSensitive ? 'orange' : 'neutral'">
                  {{ row.containsSensitive ? '是' : '否' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isExportColumnVisible('downloadExpiresAt')"
              label="下载过期"
              prop="downloadExpiresAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.downloadExpiresAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isExportColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton
                    size="small"
                    variant="soft"
                    :disabled="row.status === 'running'"
                    @click="executeExport(row)"
                  >
                    运行
                  </AppButton>
                  <AppButton size="small" variant="success" @click="markExport(row.id, 'success')">
                    成功
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="markExport(row.id, 'failed')">
                    失败
                  </AppButton>
                  <AppButton
                    size="small"
                    variant="ghost"
                    :disabled="row.status !== 'success'"
                    @click="showDownload(row)"
                  >
                    下载
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="exports.length" class="mobile-record-list">
            <article v-for="row in exports" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getExportModuleLabel(row.module) }}</strong>
                  <span>{{ row.filePath || row.fields.join(', ') || '暂无字段信息' }}</span>
                </div>
                <JobStatusTag :status="row.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>字段数</span>
                  <strong>{{ row.fields.length }}</strong>
                </div>
                <div>
                  <span>敏感</span>
                  <strong>{{ row.containsSensitive ? '是' : '否' }}</strong>
                </div>
                <div>
                  <span>过期</span>
                  <strong>{{ formatDate(row.downloadExpiresAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton
                  size="small"
                  variant="soft"
                  :disabled="row.status === 'running'"
                  @click="executeExport(row)"
                >
                  运行
                </AppButton>
                <AppButton size="small" variant="success" @click="markExport(row.id, 'success')">
                  成功
                </AppButton>
                <AppButton size="small" variant="danger" @click="markExport(row.id, 'failed')">
                  失败
                </AppButton>
                <AppButton
                  size="small"
                  variant="ghost"
                  :disabled="row.status !== 'success'"
                  @click="showDownload(row)"
                >
                  下载
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!exportLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无导出任务"
            description="导出任务创建后可查看字段、敏感标记和下载状态。"
            compact
          />
          <PaginationBar
            v-model:page="exportQuery.page"
            v-model:page-size="exportQuery.pageSize"
            :total="exportTotal"
            @change="() => loadExports()"
          />
        </el-tab-pane>

        <el-tab-pane label="回收站" name="recycle">
          <TableToolbar
            v-model:keyword="recycleQuery.keyword"
            v-model:status="recycleQuery.restored"
            v-model:visible-columns="recycleVisibleColumns"
            v-model:saved-view-id="recycleSavedViewId"
            :column-options="recycleColumnOptions"
            :status-options="recycleStatusOptions"
            :saved-views="recycleSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、对象、名称"
            @search="handleRecycleSearch"
            @refresh="() => loadRecycleBin()"
            @clear-filters="clearRecycleFilters"
            @save-view="saveRecycleTableView"
            @apply-view="applyRecycleSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="recycleQuery.module"
                class="toolbar-select"
                placeholder="模块"
                clearable
                @keyup.enter="handleRecycleSearch"
                @clear="handleRecycleSearch"
              />
              <el-input
                v-model="recycleQuery.objectType"
                class="toolbar-select"
                placeholder="对象类型"
                clearable
                @keyup.enter="handleRecycleSearch"
                @clear="handleRecycleSearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="recycleLoading"
            class="desktop-data-table"
            :data="recycleRecords"
            :size="recycleTableSize"
            row-key="id"
            @sort-change="handleRecycleSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无回收站记录</strong>
                <span>删除后的可恢复数据会进入这里统一管理。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearRecycleFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isRecycleColumnVisible('objectLabel')"
              label="对象"
              min-width="220"
              prop="objectLabel"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isRecycleColumnVisible('module')"
              label="模块"
              width="120"
              prop="module"
              sortable="custom"
            />
            <el-table-column
              v-if="isRecycleColumnVisible('objectType')"
              label="类型"
              width="140"
              prop="objectType"
              sortable="custom"
            />
            <el-table-column v-if="isRecycleColumnVisible('deletedBy')" label="删除人" width="130">
              <template #default="{ row }">{{ row.deletedBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isRecycleColumnVisible('deletedAt')"
              label="删除时间"
              prop="deletedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.deletedAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isRecycleColumnVisible('restoredStatus')"
              label="恢复状态"
              width="110"
            >
              <template #default="{ row }">
                <StatusChip :tone="row.restoredAt ? 'green' : 'orange'">
                  {{ row.restoredAt ? '已恢复' : '未恢复' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isRecycleColumnVisible('restoredAt')"
              label="恢复时间"
              prop="restoredAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.restoredAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton
                    size="small"
                    variant="soft"
                    :disabled="Boolean(row.restoredAt)"
                    @click="restoreRecycle(row.id)"
                  >
                    恢复
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="purgeRecycle(row.id)">
                    清理
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="recycleRecords.length" class="mobile-record-list">
            <article v-for="row in recycleRecords" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ row.objectLabel }}</strong>
                  <span>{{ row.module }} · {{ row.objectType }}</span>
                </div>
                <StatusChip :tone="row.restoredAt ? 'green' : 'orange'">
                  {{ row.restoredAt ? '已恢复' : '未恢复' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>删除人</span>
                  <strong>{{ row.deletedBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>删除时间</span>
                  <strong>{{ formatDate(row.deletedAt) }}</strong>
                </div>
                <div>
                  <span>恢复时间</span>
                  <strong>{{ formatDate(row.restoredAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton
                  size="small"
                  variant="soft"
                  :disabled="Boolean(row.restoredAt)"
                  @click="restoreRecycle(row.id)"
                >
                  恢复
                </AppButton>
                <AppButton size="small" variant="danger" @click="purgeRecycle(row.id)">
                  清理
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!recycleLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无回收站记录"
            description="删除后的可恢复数据会进入这里统一管理。"
            compact
          />
          <PaginationBar
            v-model:page="recycleQuery.page"
            v-model:page-size="recycleQuery.pageSize"
            :total="recycleTotal"
            @change="() => loadRecycleBin()"
          />
        </el-tab-pane>

        <el-tab-pane label="数据清理" name="cleanup">
          <TableToolbar
            v-model:keyword="cleanupQuery.keyword"
            v-model:status="cleanupQuery.status"
            v-model:visible-columns="cleanupVisibleColumns"
            v-model:saved-view-id="cleanupSavedViewId"
            :column-options="cleanupColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="cleanupSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、审批说明或失败原因"
            @search="handleCleanupSearch"
            @refresh="() => loadCleanupJobs()"
            @clear-filters="clearCleanupFilters"
            @save-view="saveCleanupTableView"
            @apply-view="applyCleanupSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="cleanupQuery.module"
                class="toolbar-select"
                placeholder="模块"
                clearable
                @keyup.enter="handleCleanupSearch"
                @clear="handleCleanupSearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="cleanupLoading"
            class="desktop-data-table"
            :data="cleanupJobs"
            :size="cleanupTableSize"
            row-key="id"
            @sort-change="handleCleanupSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无数据清理任务</strong>
                <span>可以新建清理任务，或清空筛选后查看历史任务。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearCleanupFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openCleanupDialog">新建清理</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isCleanupColumnVisible('module')"
              label="模块"
              width="130"
              prop="module"
              sortable="custom"
            />
            <el-table-column
              v-if="isCleanupColumnVisible('status')"
              label="状态"
              width="110"
              prop="status"
              sortable="custom"
            >
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isCleanupColumnVisible('affectedCount')"
              label="影响数量"
              width="100"
              prop="affectedCount"
              sortable="custom"
            />
            <el-table-column
              v-if="isCleanupColumnVisible('approvalNote')"
              label="审批说明"
              min-width="240"
              prop="approvalNote"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isCleanupColumnVisible('errorMessage')"
              label="失败原因"
              min-width="220"
              prop="errorMessage"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isCleanupColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="soft" @click="markCleanup(row.id, 'running')">
                    运行
                  </AppButton>
                  <AppButton size="small" variant="success" @click="markCleanup(row.id, 'success')">
                    成功
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="markCleanup(row.id, 'failed')">
                    失败
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="cleanupJobs.length" class="mobile-record-list">
            <article v-for="row in cleanupJobs" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ row.module }}</strong>
                  <span>{{ row.approvalNote || row.errorMessage || '暂无说明' }}</span>
                </div>
                <JobStatusTag :status="row.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>影响数量</span>
                  <strong>{{ row.affectedCount }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
                <div>
                  <span>完成时间</span>
                  <strong>{{ formatDate(row.finishedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="markCleanup(row.id, 'running')">
                  运行
                </AppButton>
                <AppButton size="small" variant="success" @click="markCleanup(row.id, 'success')">
                  成功
                </AppButton>
                <AppButton size="small" variant="danger" @click="markCleanup(row.id, 'failed')">
                  失败
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!cleanupLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无数据清理任务"
            description="创建清理任务后可跟踪审批、影响数量和执行结果。"
            compact
          />
          <PaginationBar
            v-model:page="cleanupQuery.page"
            v-model:page-size="cleanupQuery.pageSize"
            :total="cleanupTotal"
            @change="() => loadCleanupJobs()"
          />
        </el-tab-pane>

        <el-tab-pane label="重复合并" name="duplicates">
          <TableToolbar
            v-model:keyword="duplicateQuery.keyword"
            v-model:status="duplicateQuery.status"
            v-model:visible-columns="duplicateVisibleColumns"
            v-model:saved-view-id="duplicateSavedViewId"
            :column-options="duplicateColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="duplicateSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、审批说明或失败原因"
            @search="handleDuplicateSearch"
            @refresh="() => loadDuplicateJobs()"
            @clear-filters="clearDuplicateFilters"
            @save-view="saveDuplicateTableView"
            @apply-view="applyDuplicateSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="duplicateQuery.module"
                class="toolbar-select"
                placeholder="模块"
                clearable
                @keyup.enter="handleDuplicateSearch"
                @clear="handleDuplicateSearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="duplicateLoading"
            class="desktop-data-table"
            :data="duplicateJobs"
            :size="duplicateTableSize"
            row-key="id"
            @sort-change="handleDuplicateSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无重复合并任务</strong>
                <span>可以新建合并任务，或清空筛选后查看历史任务。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearDuplicateFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openDuplicateDialog">新建合并</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isDuplicateColumnVisible('module')"
              label="模块"
              width="130"
              prop="module"
              sortable="custom"
            />
            <el-table-column
              v-if="isDuplicateColumnVisible('status')"
              label="状态"
              width="110"
              prop="status"
              sortable="custom"
            >
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isDuplicateColumnVisible('primaryObjectId')"
              label="主对象"
              min-width="180"
              prop="primaryObjectId"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isDuplicateColumnVisible('duplicateCount')"
              label="重复对象数"
              width="120"
            >
              <template #default="{ row }">{{ row.duplicateObjectIds?.length ?? 0 }}</template>
            </el-table-column>
            <el-table-column
              v-if="isDuplicateColumnVisible('affectedCount')"
              label="影响数量"
              width="100"
              prop="affectedCount"
              sortable="custom"
            />
            <el-table-column
              v-if="isDuplicateColumnVisible('approvalNote')"
              label="审批说明"
              min-width="240"
              prop="approvalNote"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isDuplicateColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="soft" @click="markDuplicate(row.id, 'running')">
                    运行
                  </AppButton>
                  <AppButton
                    size="small"
                    variant="success"
                    @click="markDuplicate(row.id, 'success')"
                  >
                    成功
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="markDuplicate(row.id, 'failed')">
                    失败
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="duplicateJobs.length" class="mobile-record-list">
            <article v-for="row in duplicateJobs" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ row.module }}</strong>
                  <span>{{ row.primaryObjectId || '未指定主对象' }}</span>
                </div>
                <JobStatusTag :status="row.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>重复对象</span>
                  <strong>{{ row.duplicateObjectIds?.length ?? 0 }}</strong>
                </div>
                <div>
                  <span>影响数量</span>
                  <strong>{{ row.affectedCount }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(row.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>审批说明</span>
                  <strong>{{ row.approvalNote || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="markDuplicate(row.id, 'running')">
                  运行
                </AppButton>
                <AppButton size="small" variant="success" @click="markDuplicate(row.id, 'success')">
                  成功
                </AppButton>
                <AppButton size="small" variant="danger" @click="markDuplicate(row.id, 'failed')">
                  失败
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!duplicateLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无重复合并任务"
            description="重复对象合并任务创建后会在这里显示。"
            compact
          />
          <PaginationBar
            v-model:page="duplicateQuery.page"
            v-model:page-size="duplicateQuery.pageSize"
            :total="duplicateTotal"
            @change="() => loadDuplicateJobs()"
          />
        </el-tab-pane>

        <el-tab-pane v-if="false" label="数据字典" name="dictionaries">
          <TableToolbar
            v-model:keyword="dictionaryQuery.keyword"
            v-model:status="dictionaryQuery.status"
            v-model:visible-columns="dictionaryVisibleColumns"
            v-model:saved-view-id="dictionarySavedViewId"
            :column-options="dictionaryColumnOptions"
            :status-options="dictionaryStatusOptions"
            :saved-views="dictionarySavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索分组、编码、名称"
            @search="handleDictionarySearch"
            @refresh="() => loadDictionaries()"
            @clear-filters="clearDictionaryFilters"
            @save-view="saveDictionaryTableView"
            @apply-view="applyDictionarySavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="dictionaryQuery.group"
                class="toolbar-select"
                placeholder="分组"
                clearable
                @keyup.enter="handleDictionarySearch"
                @clear="handleDictionarySearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="dictionaryLoading"
            class="desktop-data-table"
            :data="dictionaries"
            :size="dictionaryTableSize"
            row-key="id"
            @sort-change="handleDictionarySortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无数据字典</strong>
                <span>可以新增字典项，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearDictionaryFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="() => openDictionaryDialog()">
                    新增字典
                  </AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isDictionaryColumnVisible('group')"
              label="分组"
              width="160"
              prop="group"
              sortable="custom"
            />
            <el-table-column
              v-if="isDictionaryColumnVisible('code')"
              label="编码"
              min-width="180"
              prop="code"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isDictionaryColumnVisible('label')"
              label="名称"
              min-width="180"
              prop="label"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isDictionaryColumnVisible('value')"
              label="值"
              min-width="160"
              prop="value"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isDictionaryColumnVisible('sortOrder')"
              label="排序"
              width="90"
              prop="sortOrder"
              sortable="custom"
            />
            <el-table-column
              v-if="isDictionaryColumnVisible('status')"
              label="状态"
              width="90"
              prop="status"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="row.status === 'active' ? 'green' : 'neutral'">
                  {{ row.status === 'active' ? '启用' : '停用' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isDictionaryColumnVisible('updatedBy')"
              label="更新人"
              width="130"
            >
              <template #default="{ row }">{{ row.updatedBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isDictionaryColumnVisible('updatedAt')"
              label="更新时间"
              prop="updatedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group">
                  <AppButton size="small" variant="soft" @click="openDictionaryDialog(row)">
                    编辑
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="dictionaries.length" class="mobile-record-list">
            <article v-for="row in dictionaries" :key="row.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ row.label }}</strong>
                  <span>{{ row.group }} · {{ row.code }}</span>
                </div>
                <StatusChip :tone="row.status === 'active' ? 'green' : 'neutral'">
                  {{ row.status === 'active' ? '启用' : '停用' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>值</span>
                  <strong>{{ row.value || '-' }}</strong>
                </div>
                <div>
                  <span>排序</span>
                  <strong>{{ row.sortOrder }}</strong>
                </div>
                <div>
                  <span>更新人</span>
                  <strong>{{ row.updatedBy?.displayName ?? '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>更新时间</span>
                  <strong>{{ formatDate(row.updatedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="openDictionaryDialog(row)">
                  编辑
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!dictionaryLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无数据字典"
            description="新增字典项后可在这里维护分组、编码和值。"
            compact
          />
          <PaginationBar
            v-model:page="dictionaryQuery.page"
            v-model:page-size="dictionaryQuery.pageSize"
            :total="dictionaryTotal"
            @change="() => loadDictionaries()"
          />
        </el-tab-pane>

        <el-tab-pane label="系统参数" name="parameters">
          <TableToolbar
            v-model:keyword="parameterQuery.keyword"
            v-model:visible-columns="parameterVisibleColumns"
            v-model:saved-view-id="parameterSavedViewId"
            :column-options="parameterColumnOptions"
            :saved-views="parameterSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            :show-status="false"
            placeholder="搜索 key、分组、备注"
            @search="handleParameterSearch"
            @refresh="() => loadParameters()"
            @clear-filters="clearParameterFilters"
            @save-view="saveParameterTableView"
            @apply-view="applyParameterSavedView"
            @export="exportCurrentTab"
          >
            <template #filters>
              <el-input
                v-model="parameterQuery.group"
                class="toolbar-select"
                placeholder="分组"
                clearable
                @keyup.enter="handleParameterSearch"
                @clear="handleParameterSearch"
              />
            </template>
          </TableToolbar>
          <el-table
            v-loading="parameterLoading"
            class="desktop-data-table"
            :data="parameters"
            :size="parameterTableSize"
            row-key="id"
            @sort-change="handleParameterSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无系统参数</strong>
                <span>系统参数加载后可在这里查看和编辑配置值。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearParameterFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isParameterColumnVisible('key')"
              label="Key"
              min-width="220"
              prop="key"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isParameterColumnVisible('group')"
              label="分组"
              width="120"
              prop="group"
              sortable="custom"
            />
            <el-table-column v-if="isParameterColumnVisible('value')" label="值" min-width="260">
              <template #default="{ row }">
                <code class="json-cell">{{ JSON.stringify(row.value) }}</code>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isParameterColumnVisible('remark')"
              label="备注"
              min-width="220"
              prop="remark"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isParameterColumnVisible('updatedBy')"
              label="更新人"
              width="130"
            >
              <template #default="{ row }">{{ row.updatedBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isParameterColumnVisible('updatedAt')"
              label="更新时间"
              prop="updatedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group">
                  <AppButton size="small" variant="soft" @click="openParameterDialog(row)">
                    编辑
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="parameters.length" class="mobile-record-list">
            <article v-for="row in parameters" :key="row.key" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ row.key }}</strong>
                  <span>{{ row.group }} · {{ row.remark || '暂无备注' }}</span>
                </div>
                <StatusChip tone="blue">参数</StatusChip>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>值</span>
                  <strong>
                    <code class="json-cell">{{ JSON.stringify(row.value) }}</code>
                  </strong>
                </div>
                <div>
                  <span>更新人</span>
                  <strong>{{ row.updatedBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{{ formatDate(row.updatedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="openParameterDialog(row)">
                  编辑
                </AppButton>
              </div>
            </article>
          </div>
          <AppState
            v-else-if="!parameterLoading"
            class="mobile-record-list"
            type="empty"
            title="暂无系统参数"
            description="系统参数加载后可在这里查看和编辑配置值。"
            compact
          />
          <PaginationBar
            v-model:page="parameterQuery.page"
            v-model:page-size="parameterQuery.pageSize"
            :total="parameterTotal"
            @change="() => loadParameters()"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="backupDialogVisible"
      title="创建备份任务"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form label-width="100px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="备份类型"
              purpose="选择要备份的数据范围，用于后续恢复或审计留档。"
              example="日常数据选数据库；上传文件选文件；系统配置选配置。"
            />
          </template>
          <el-select v-model="backupForm.jobType">
            <el-option
              v-for="option in backupTypeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="说明这次备份的原因或范围，方便以后找到正确备份。"
              example="可以写上线前备份、月度备份、修复前备份。"
            />
          </template>
          <el-input v-model="backupForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="backupDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createBackup">创建</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="restoreDialogVisible"
      title="创建恢复任务"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="110px">
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备份任务 ID"
              purpose="指定要从哪一次备份恢复。"
              example="从备份任务列表复制对应的任务 ID。"
            />
          </template>
          <el-input v-model="restoreForm.backupJobId" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="恢复范围"
              purpose="说明这次要恢复哪些数据，避免误恢复整个系统。"
              example="可以写仅恢复 customers，或恢复 2026-06-21 前的配置。"
            />
          </template>
          <el-input v-model="restoreForm.restoreScope" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="审批说明"
              purpose="记录恢复任务为什么被允许执行，方便上线和审计追踪。"
              example="可以写客户误删数据，已由负责人确认恢复。"
            />
          </template>
          <el-input v-model="restoreForm.approvalNote" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="restoreDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createRestore">创建</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      title="新建导入任务"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="100px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模块"
              purpose="选择这次导入要写入哪个业务模块。"
              example="导入客户选客户模块，导入兑换码库存选兑换码模块。"
            />
          </template>
          <el-select v-model="importForm.module" filterable>
            <el-option
              v-for="option in importModuleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="文件名"
              purpose="记录导入文件名或文件路径，方便追踪导入来源。"
              example="可以填 customers-20260621.xlsx 或上传后的文件路径。"
            />
          </template>
          <el-input v-model="importForm.filePath" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录导入原因、数据来源或注意事项。"
              example="可以写客户资料整理导入、供应商库存导入。"
            />
          </template>
          <el-input v-model="importForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="importDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createImport">创建</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="exportDialogVisible"
      title="新建导出任务"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="110px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模块"
              purpose="选择这次要导出的业务模块。"
              example="导出客户资料选客户模块，导出订单选对应订单模块。"
            />
          </template>
          <el-select v-model="exportForm.module" filterable>
            <el-option
              v-for="option in exportModuleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="字段列表"
              purpose="指定导出哪些字段，留空时按系统默认字段导出。"
              example="用英文逗号分隔，例如 name,phone,status。"
            />
          </template>
          <el-input v-model="exportForm.fieldsText" placeholder="用英文逗号分隔" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="包含敏感字段"
              purpose="控制导出结果是否包含手机号、完整码等敏感字段。"
              example="普通报表不要打开；确需完整资料时先确认权限和审批原因。"
            />
          </template>
          <el-switch v-model="exportForm.containsSensitive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="exportDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createExport">创建</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="cleanupDialogVisible"
      title="新建数据清理任务"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="100px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模块"
              purpose="选择要执行数据清理的模块，避免误清其他业务数据。"
              example="只清导入失败任务就填 data_import，不要写整个系统。"
            />
          </template>
          <el-input v-model="cleanupForm.module" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="审批说明"
              purpose="说明为什么允许清理数据，便于追责和复盘。"
              example="可以写测试数据清理，已确认不含生产客户数据。"
            />
          </template>
          <el-input v-model="cleanupForm.approvalNote" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="cleanupDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createCleanup">创建</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="duplicateDialogVisible"
      title="新建重复数据合并任务"
      width="min(600px, calc(100vw - 24px))"
    >
      <el-form label-width="120px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模块"
              purpose="选择要合并重复数据的模块。"
              example="合并重复客户就填 customers，合并重复平台就填 source_platforms。"
            />
          </template>
          <el-input v-model="duplicateForm.module" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="主对象 ID"
              purpose="保留下来的主记录 ID，合并后其他重复记录会归到它下面。"
              example="选择资料最完整、历史订单最多的客户作为主对象。"
            />
          </template>
          <el-input v-model="duplicateForm.primaryObjectId" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="重复对象 ID"
              purpose="需要被合并掉的重复记录 ID 列表。"
              example="多个 ID 用英文逗号分隔，例如 id1,id2,id3。"
            />
          </template>
          <el-input v-model="duplicateForm.duplicateObjectIdsText" placeholder="用英文逗号分隔" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="审批说明"
              purpose="说明为什么要合并这些重复记录。"
              example="可以写同一客户重复创建，已核对手机号和订单归属。"
            />
          </template>
          <el-input v-model="duplicateForm.approvalNote" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="duplicateDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="createDuplicate">创建</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryDialogVisible"
      :title="editingDictionary ? '编辑数据字典' : '新增数据字典'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="100px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="分组"
              purpose="数据字典所属分组，用来区分客户标签、地区、发货方式等不同选项。"
              example="客户标签可用 customer_tags，Apple 地区可用 apple_regions。"
            />
          </template>
          <el-input v-model="dictionaryForm.group" :disabled="Boolean(editingDictionary)" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="编码"
              purpose="系统识别这个字典项的稳定代码，创建后通常不修改。"
              example="手工发货可用 manual，美区可用 US。"
            />
          </template>
          <el-input v-model="dictionaryForm.code" :disabled="Boolean(editingDictionary)" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="名称"
              purpose="员工在页面上看到的选项名称。"
              example="可以填手工发货、美区、老客户。"
            />
          </template>
          <el-input v-model="dictionaryForm.label" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="值"
              purpose="字典项额外保存的值，业务需要时才填写。"
              example="地区字典可把币种或区号放到值里；普通标签可留空。"
            />
          </template>
          <el-input v-model="dictionaryForm.value" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="排序"
              purpose="控制选项显示顺序，数字越小越靠前。"
              example="常用选项填 1，不常用选项填 100。"
            />
          </template>
          <el-input-number v-model="dictionaryForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个字典项是否还能被选择。"
              example="正在用选启用；废弃选项选停用。"
            />
          </template>
          <el-select v-model="dictionaryForm.status">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个字典项的使用说明。"
              example="可以写只用于新客户、只用于某个平台。"
            />
          </template>
          <el-input v-model="dictionaryForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dictionaryDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveDictionary">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="parameterDialogVisible"
      title="保存系统参数"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form label-width="100px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="Key"
              purpose="系统参数的唯一键名，业务代码会按这个 Key 读取配置。"
              example="可以填 apple.low_balance_threshold，创建后不要随意改。"
            />
          </template>
          <el-input v-model="parameterForm.key" :disabled="Boolean(editingParameter)" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="分组"
              purpose="把系统参数按用途分组，方便列表筛选。"
              example="可以填 apple、code、security、ops。"
            />
          </template>
          <el-input v-model="parameterForm.group" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="值 JSON"
              purpose="系统参数的实际配置值，必须是合法 JSON。"
              example='简单文本也要写成 JSON，例如 "enabled"；对象可写 {"days":7}。'
            />
          </template>
          <el-input v-model="parameterForm.valueText" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="说明这个系统参数的用途和修改注意事项。"
              example="可以写影响余额提醒阈值，修改后需刷新页面。"
            />
          </template>
          <el-input v-model="parameterForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="parameterDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveParameter">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useRoute } from 'vue-router';
import { dataCenterApi, userTableViewsApi } from '@/api/system';
import type {
  BackupJobQuery,
  DataDictionaryQuery,
  DataJobQuery,
  ExportJobQuery,
  RecycleBinQuery,
  RestoreJobQuery,
  SystemParameterQuery
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppState from '@/components/ui/AppState.vue';
import JobStatusTag from '@/components/ui/DataJobStatusTag.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import {
  DATA_BACKUP_TYPE_DICTIONARY_GROUP,
  DATA_EXPORT_MODULE_DICTIONARY_GROUP,
  DATA_IMPORT_MODULE_DICTIONARY_GROUP
} from '@/config/quickSettings';
import type {
  BackupJob,
  BackupJobType,
  DataCenterOverview,
  DataCleanupJob,
  DataDictionary,
  DataDictionaryStatus,
  DataExportJob,
  DataImportJob,
  DataJobStatus,
  DuplicateMergeJob,
  PageResult,
  RecycleBinRecord,
  RestoreJob,
  SystemParameter,
  TableDensity,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import { exportRowsToCsv, type CsvColumn } from '@/utils/exportCsv';
import {
  buildDataBackupTypeOptions,
  buildDataExportModuleOptions,
  buildDataImportModuleOptions,
  getDataBackupTypeLabel,
  getDataExportModuleLabel,
  getDataImportModuleLabel,
  isDataBackupType
} from '@/utils/systemQuickOptions';

type LoadOptions = { background?: boolean; force?: boolean };

const route = useRoute();
const activeTab = ref(getInitialTab());
const overview = ref<DataCenterOverview | null>(null);
const backupTypeDictionaries = ref<DataDictionary[]>([]);
const importModuleDictionaries = ref<DataDictionary[]>([]);
const exportModuleDictionaries = ref<DataDictionary[]>([]);
const saving = ref(false);
const backupTableKey = 'data_backup_jobs';
const restoreTableKey = 'data_restore_jobs';
const importTableKey = 'data_import_jobs';
const exportTableKey = 'data_export_jobs';
const recycleTableKey = 'data_recycle_bin';
const cleanupTableKey = 'data_cleanup_jobs';
const duplicateTableKey = 'data_duplicate_merge_jobs';
const dictionaryTableKey = 'data_dictionaries';
const parameterTableKey = 'data_system_parameters';
const jobStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '运行中', value: 'running' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' }
];
const recycleStatusOptions = [
  { label: '未恢复', value: 'false' },
  { label: '已恢复', value: 'true' }
];
const dictionaryStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const backupTypeOptions = computed(() => buildDataBackupTypeOptions(backupTypeDictionaries.value));
const sensitiveOptions = [
  { label: '包含敏感字段', value: 'true' },
  { label: '不含敏感字段', value: 'false' }
];
const backupColumnOptions = [
  { label: '类型', value: 'jobType', required: true },
  { label: '状态', value: 'status' },
  { label: '文件路径', value: 'storagePath' },
  { label: '文件大小', value: 'fileSize' },
  { label: '发起人', value: 'createdBy' },
  { label: '创建时间', value: 'createdAt' }
];
const restoreColumnOptions = [
  { label: '恢复范围', value: 'restoreScope', required: true },
  { label: '备份任务', value: 'backupJob' },
  { label: '状态', value: 'status' },
  { label: '审批说明', value: 'approvalNote' },
  { label: '创建时间', value: 'createdAt' }
];
const importColumnOptions = [
  { label: '模块', value: 'module', required: true },
  { label: '状态', value: 'status' },
  { label: '总数', value: 'totalCount' },
  { label: '成功', value: 'successCount' },
  { label: '失败', value: 'failedCount' },
  { label: '文件', value: 'filePath' },
  { label: '错误报告', value: 'errorReport' },
  { label: '创建时间', value: 'createdAt' }
];
const importModuleOptions = computed(() =>
  buildDataImportModuleOptions(importModuleDictionaries.value)
);
const exportColumnOptions = [
  { label: '模块', value: 'module', required: true },
  { label: '状态', value: 'status' },
  { label: '字段', value: 'fields' },
  { label: '敏感', value: 'containsSensitive' },
  { label: '下载过期', value: 'downloadExpiresAt' },
  { label: '创建时间', value: 'createdAt' }
];
const exportModuleOptions = computed(() =>
  buildDataExportModuleOptions(exportModuleDictionaries.value)
);
const recycleColumnOptions = [
  { label: '对象', value: 'objectLabel', required: true },
  { label: '模块', value: 'module' },
  { label: '类型', value: 'objectType' },
  { label: '删除人', value: 'deletedBy' },
  { label: '删除时间', value: 'deletedAt' },
  { label: '恢复状态', value: 'restoredStatus' },
  { label: '恢复时间', value: 'restoredAt' }
];
const cleanupColumnOptions = [
  { label: '模块', value: 'module', required: true },
  { label: '状态', value: 'status' },
  { label: '影响数量', value: 'affectedCount' },
  { label: '审批说明', value: 'approvalNote' },
  { label: '失败原因', value: 'errorMessage' },
  { label: '创建时间', value: 'createdAt' }
];
const duplicateColumnOptions = [
  { label: '模块', value: 'module', required: true },
  { label: '状态', value: 'status' },
  { label: '主对象', value: 'primaryObjectId' },
  { label: '重复对象数', value: 'duplicateCount' },
  { label: '影响数量', value: 'affectedCount' },
  { label: '审批说明', value: 'approvalNote' },
  { label: '创建时间', value: 'createdAt' }
];
const dictionaryColumnOptions = [
  { label: '分组', value: 'group', required: true },
  { label: '编码', value: 'code' },
  { label: '名称', value: 'label' },
  { label: '值', value: 'value' },
  { label: '排序', value: 'sortOrder' },
  { label: '状态', value: 'status' },
  { label: '更新人', value: 'updatedBy' },
  { label: '更新时间', value: 'updatedAt' }
];
const parameterColumnOptions = [
  { label: 'Key', value: 'key', required: true },
  { label: '分组', value: 'group' },
  { label: '值', value: 'value' },
  { label: '备注', value: 'remark' },
  { label: '更新人', value: 'updatedBy' },
  { label: '更新时间', value: 'updatedAt' }
];

const backups = ref<BackupJob[]>([]);
const backupTotal = ref(0);
const backupLoading = ref(false);
const backupDensity = ref<TableDensity>('default');
const backupVisibleColumns = ref<string[]>([]);
const backupSavedViews = ref<UserTableView[]>([]);
const backupSavedViewId = ref('');
const backupSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const backupViewsLoaded = ref(false);
const backupQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as DataJobStatus | '',
  jobType: '' as BackupJobType | ''
});

const restores = ref<RestoreJob[]>([]);
const restoreTotal = ref(0);
const restoreLoading = ref(false);
const restoreDensity = ref<TableDensity>('default');
const restoreVisibleColumns = ref<string[]>([]);
const restoreSavedViews = ref<UserTableView[]>([]);
const restoreSavedViewId = ref('');
const restoreSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const restoreViewsLoaded = ref(false);
const restoreQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as DataJobStatus | '',
  backupJobId: ''
});

const imports = ref<DataImportJob[]>([]);
const importTotal = ref(0);
const importLoading = ref(false);
const importDensity = ref<TableDensity>('default');
const importVisibleColumns = ref<string[]>([]);
const importSavedViews = ref<UserTableView[]>([]);
const importSavedViewId = ref('');
const importSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const importViewsLoaded = ref(false);
const importQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as DataJobStatus | '',
  module: ''
});

const exports = ref<DataExportJob[]>([]);
const exportTotal = ref(0);
const exportLoading = ref(false);
const exportDensity = ref<TableDensity>('default');
const exportVisibleColumns = ref<string[]>([]);
const exportSavedViews = ref<UserTableView[]>([]);
const exportSavedViewId = ref('');
const exportSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const exportViewsLoaded = ref(false);
const exportQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as DataJobStatus | '',
  module: '',
  containsSensitive: ''
});

const recycleRecords = ref<RecycleBinRecord[]>([]);
const recycleTotal = ref(0);
const recycleLoading = ref(false);
const recycleDensity = ref<TableDensity>('default');
const recycleVisibleColumns = ref<string[]>([]);
const recycleSavedViews = ref<UserTableView[]>([]);
const recycleSavedViewId = ref('');
const recycleSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const recycleViewsLoaded = ref(false);
const recycleQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  module: '',
  objectType: '',
  restored: 'false'
});

const cleanupJobs = ref<DataCleanupJob[]>([]);
const cleanupTotal = ref(0);
const cleanupLoading = ref(false);
const cleanupDensity = ref<TableDensity>('default');
const cleanupVisibleColumns = ref<string[]>([]);
const cleanupSavedViews = ref<UserTableView[]>([]);
const cleanupSavedViewId = ref('');
const cleanupSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const cleanupViewsLoaded = ref(false);
const cleanupQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as DataJobStatus | '',
  module: ''
});

const duplicateJobs = ref<DuplicateMergeJob[]>([]);
const duplicateTotal = ref(0);
const duplicateLoading = ref(false);
const duplicateDensity = ref<TableDensity>('default');
const duplicateVisibleColumns = ref<string[]>([]);
const duplicateSavedViews = ref<UserTableView[]>([]);
const duplicateSavedViewId = ref('');
const duplicateSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const duplicateViewsLoaded = ref(false);
const duplicateQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as DataJobStatus | '',
  module: ''
});

const dictionaries = ref<DataDictionary[]>([]);
const dictionaryTotal = ref(0);
const dictionaryLoading = ref(false);
const dictionaryDensity = ref<TableDensity>('default');
const dictionaryVisibleColumns = ref<string[]>([]);
const dictionarySavedViews = ref<UserTableView[]>([]);
const dictionarySavedViewId = ref('');
const dictionarySortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const dictionaryViewsLoaded = ref(false);
const dictionaryQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  group: '',
  status: '' as DataDictionaryStatus | ''
});

const parameters = ref<SystemParameter[]>([]);
const parameterTotal = ref(0);
const parameterLoading = ref(false);
const parameterDensity = ref<TableDensity>('default');
const parameterVisibleColumns = ref<string[]>([]);
const parameterSavedViews = ref<UserTableView[]>([]);
const parameterSavedViewId = ref('');
const parameterSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const parameterViewsLoaded = ref(false);
const parameterQuery = reactive({ page: 1, pageSize: 10, keyword: '', group: '' });
const activeOverviewQueryKey = ref('');
const activeBackupQueryKey = ref('');
const activeRestoreQueryKey = ref('');
const activeImportQueryKey = ref('');
const activeExportQueryKey = ref('');
const activeRecycleQueryKey = ref('');
const activeCleanupQueryKey = ref('');
const activeDuplicateQueryKey = ref('');
const activeDictionaryQueryKey = ref('');
const activeParameterQueryKey = ref('');

const backupDialogVisible = ref(false);
const backupForm = reactive({ jobType: 'database' as BackupJobType, remark: '' });

const restoreDialogVisible = ref(false);
const restoreForm = reactive({ backupJobId: '', restoreScope: '', approvalNote: '' });

const importDialogVisible = ref(false);
const importForm = reactive({ module: 'customers', filePath: '', remark: '' });

const exportDialogVisible = ref(false);
const exportForm = reactive({ module: 'customers', fieldsText: '', containsSensitive: false });

const cleanupDialogVisible = ref(false);
const cleanupForm = reactive({ module: 'common', approvalNote: '' });

const duplicateDialogVisible = ref(false);
const duplicateForm = reactive({
  module: 'common',
  primaryObjectId: '',
  duplicateObjectIdsText: '',
  approvalNote: ''
});

const dictionaryDialogVisible = ref(false);
const editingDictionary = ref<DataDictionary | null>(null);
const dictionaryForm = reactive({
  group: '',
  code: '',
  label: '',
  value: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const parameterDialogVisible = ref(false);
const editingParameter = ref<SystemParameter | null>(null);
const parameterForm = reactive({
  key: '',
  group: 'data',
  valueText: '{}',
  remark: ''
});

const backupTableSize = computed(() => getTableSize(backupDensity.value));
const restoreTableSize = computed(() => getTableSize(restoreDensity.value));
const importTableSize = computed(() => getTableSize(importDensity.value));
const exportTableSize = computed(() => getTableSize(exportDensity.value));
const recycleTableSize = computed(() => getTableSize(recycleDensity.value));
const cleanupTableSize = computed(() => getTableSize(cleanupDensity.value));
const duplicateTableSize = computed(() => getTableSize(duplicateDensity.value));
const dictionaryTableSize = computed(() => getTableSize(dictionaryDensity.value));
const parameterTableSize = computed(() => getTableSize(parameterDensity.value));
const activeTabMeta = computed(() => {
  const metaMap: Record<
    string,
    {
      title: string;
      description: string;
      badge: string;
      tone: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
    }
  > = {
    overview: {
      title: '数据总览',
      description: '集中查看最近备份、导入、导出和回收站数据状态。',
      badge: '总览',
      tone: 'blue'
    },
    backups: {
      title: '备份任务',
      description: '管理数据库、文件和配置备份，失败任务需要人工确认。',
      badge: '备份',
      tone: 'red'
    },
    restores: {
      title: '恢复任务',
      description: '恢复操作必须记录范围和审批说明，避免误覆盖关键数据。',
      badge: '恢复',
      tone: 'orange'
    },
    imports: {
      title: '导入任务',
      description: '跟踪导入文件、成功失败数量和错误报告。',
      badge: '导入',
      tone: 'cyan'
    },
    exports: {
      title: '导出任务',
      description: '导出任务需要标记是否包含敏感字段并保留审计线索。',
      badge: '导出',
      tone: 'purple'
    },
    recycle: {
      title: '回收站',
      description: '查看软删除记录、恢复状态和彻底清理入口。',
      badge: '回收',
      tone: 'green'
    },
    cleanup: {
      title: '数据清理',
      description: '清理任务必须记录影响数量、审批说明和失败原因。',
      badge: '清理',
      tone: 'orange'
    },
    duplicates: {
      title: '重复合并',
      description: '合并重复数据时保留主对象、重复对象和处理结果。',
      badge: '合并',
      tone: 'blue'
    },
    dictionaries: {
      title: '数据字典',
      description: '维护分组、编码、显示名称、排序和启停状态。',
      badge: '字典',
      tone: 'green'
    },
    parameters: {
      title: '系统参数',
      description: '系统参数以 JSON 形式保存，修改后需可追溯。',
      badge: '参数',
      tone: 'neutral'
    }
  };
  return metaMap[activeTab.value] ?? metaMap.overview;
});

onMounted(() => {
  void refreshCurrentTab({ force: false });
});

watch(
  () => route.name,
  () => {
    activeTab.value = getInitialTab();
    void refreshCurrentTab({ force: false });
  }
);

usePageRefresh(
  (options) =>
    refreshCurrentTab({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '数据备份' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [
    'data-overview',
    'data-backups',
    'data-restores',
    'data-imports',
    'data-exports',
    'data-recycle-bin',
    'data-cleanup-jobs',
    'data-duplicate-merge-jobs',
    'data-dictionaries',
    'data-parameters'
  ],
  ({ scopes }) => {
    if (scopes.includes('data-dictionaries')) {
      void loadDataCenterOptions({ background: true, force: true });
    }

    if (scopes.includes('data-overview')) {
      void loadOverview({
        background: Boolean(overview.value),
        force: true
      });
    }

    if (activeTab.value === 'backups' && scopes.includes('data-backups')) {
      void loadBackups({ background: backups.value.length > 0, force: true });
    }

    if (activeTab.value === 'restores' && scopes.includes('data-restores')) {
      void loadRestores({ background: restores.value.length > 0, force: true });
    }

    if (activeTab.value === 'imports' && scopes.includes('data-imports')) {
      void loadImports({ background: imports.value.length > 0, force: true });
    }

    if (activeTab.value === 'exports' && scopes.includes('data-exports')) {
      void loadExports({ background: exports.value.length > 0, force: true });
    }

    if (activeTab.value === 'recycle' && scopes.includes('data-recycle-bin')) {
      void loadRecycleBin({ background: recycleRecords.value.length > 0, force: true });
    }

    if (activeTab.value === 'cleanup' && scopes.includes('data-cleanup-jobs')) {
      void loadCleanupJobs({ background: cleanupJobs.value.length > 0, force: true });
    }

    if (activeTab.value === 'duplicates' && scopes.includes('data-duplicate-merge-jobs')) {
      void loadDuplicateJobs({ background: duplicateJobs.value.length > 0, force: true });
    }

    if (activeTab.value === 'dictionaries' && scopes.includes('data-dictionaries')) {
      void loadDictionaries({ background: dictionaries.value.length > 0, force: true });
    }

    if (activeTab.value === 'parameters' && scopes.includes('data-parameters')) {
      void loadParameters({ background: parameters.value.length > 0, force: true });
    }
  }
);

onBeforeUnmount(stopRealtimeRefresh);

async function refreshCurrentTab(options: LoadOptions = {}) {
  await loadDataCenterOptions(options);
  await loadOverview(options);
  if (activeTab.value === 'backups') await loadBackupsWithViews(options);
  if (activeTab.value === 'restores') await loadRestoresWithViews(options);
  if (activeTab.value === 'imports') await loadImportsWithViews(options);
  if (activeTab.value === 'exports') await loadExportsWithViews(options);
  if (activeTab.value === 'recycle') await loadRecycleBinWithViews(options);
  if (activeTab.value === 'cleanup') await loadCleanupJobsWithViews(options);
  if (activeTab.value === 'duplicates') await loadDuplicateJobsWithViews(options);
  if (activeTab.value === 'dictionaries') await loadDictionariesWithViews(options);
  if (activeTab.value === 'parameters') await loadParametersWithViews(options);
}

function buildDataCenterOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadDataCenterOptions(options: LoadOptions = {}) {
  try {
    const [backupTypes, importModules, exportModules] = await Promise.all([
      dataCenterApi.listDictionaries(
        buildDataCenterOptionParams(DATA_BACKUP_TYPE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildDataCenterOptionParams(DATA_IMPORT_MODULE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildDataCenterOptionParams(DATA_EXPORT_MODULE_DICTIONARY_GROUP)
      )
    ]);
    backupTypeDictionaries.value = backupTypes.items;
    importModuleDictionaries.value = importModules.items;
    exportModuleDictionaries.value = exportModules.items;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载数据中心选项失败');
    }
  }
}

async function loadOverview(options: LoadOptions = {}) {
  const key = createSmartQueryKey('data-overview');
  const cached = getSmartQueryData<DataCenterOverview>(key);

  activeOverviewQueryKey.value = key;

  if (cached) {
    overview.value = cached;
  }

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => dataCenterApi.overview(),
      force: options.force ?? true
    });

    if (activeOverviewQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      overview.value = result.data;
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载数据中心总览失败');
    }
  }
}

async function loadPagedData<TItem>(config: {
  scope: string;
  params: unknown;
  activeKey: Ref<string>;
  setLoading: (loading: boolean) => void;
  apply: (result: PageResult<TItem>) => void;
  fetcher: () => Promise<PageResult<TItem>>;
  errorMessage: string;
  options?: LoadOptions;
}) {
  const options = config.options ?? {};
  const key = createSmartQueryKey(config.scope, config.params);
  const cached = getSmartQueryData<PageResult<TItem>>(key);

  config.activeKey.value = key;

  if (cached) {
    config.apply(cached);
  }

  config.setLoading(!cached && !options.background);

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: config.fetcher,
      force: options.force ?? true
    });

    if (config.activeKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      config.apply(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : config.errorMessage);
    }
  } finally {
    if (config.activeKey.value === key) {
      config.setLoading(false);
    }
  }
}

function buildBackupParams(): BackupJobQuery {
  return {
    ...backupQuery,
    sortBy: mapSortField(backupSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(backupSortConfig.value.order)
  };
}

async function loadBackups(options: LoadOptions = {}) {
  const params = buildBackupParams();
  await loadPagedData<BackupJob>({
    scope: 'data-backups',
    params,
    activeKey: activeBackupQueryKey,
    setLoading: (loading) => {
      backupLoading.value = loading;
    },
    apply: (result) => {
      backups.value = result.items;
      backupTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listBackupJobs(params),
    errorMessage: '加载备份任务失败',
    options
  });
}

async function loadBackupsWithViews(options: LoadOptions = {}) {
  await ensureBackupTableViews();
  await loadBackups(options);
}

function buildRestoreParams(): RestoreJobQuery {
  return {
    ...restoreQuery,
    sortBy: mapSortField(restoreSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(restoreSortConfig.value.order)
  };
}

async function loadRestores(options: LoadOptions = {}) {
  const params = buildRestoreParams();
  await loadPagedData<RestoreJob>({
    scope: 'data-restores',
    params,
    activeKey: activeRestoreQueryKey,
    setLoading: (loading) => {
      restoreLoading.value = loading;
    },
    apply: (result) => {
      restores.value = result.items;
      restoreTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listRestoreJobs(params),
    errorMessage: '加载恢复任务失败',
    options
  });
}

async function loadRestoresWithViews(options: LoadOptions = {}) {
  await ensureRestoreTableViews();
  await loadRestores(options);
}

function buildImportParams(): DataJobQuery {
  return {
    ...importQuery,
    sortBy: mapSortField(importSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(importSortConfig.value.order)
  };
}

async function loadImports(options: LoadOptions = {}) {
  const params = buildImportParams();
  await loadPagedData<DataImportJob>({
    scope: 'data-imports',
    params,
    activeKey: activeImportQueryKey,
    setLoading: (loading) => {
      importLoading.value = loading;
    },
    apply: (result) => {
      imports.value = result.items;
      importTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listImportJobs(params),
    errorMessage: '加载导入任务失败',
    options
  });
}

async function loadImportsWithViews(options: LoadOptions = {}) {
  await ensureImportTableViews();
  await loadImports(options);
}

function buildExportParams(): ExportJobQuery {
  return {
    ...exportQuery,
    sortBy: mapSortField(exportSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(exportSortConfig.value.order)
  };
}

async function loadExports(options: LoadOptions = {}) {
  const params = buildExportParams();
  await loadPagedData<DataExportJob>({
    scope: 'data-exports',
    params,
    activeKey: activeExportQueryKey,
    setLoading: (loading) => {
      exportLoading.value = loading;
    },
    apply: (result) => {
      exports.value = result.items;
      exportTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listExportJobs(params),
    errorMessage: '加载导出任务失败',
    options
  });
}

async function loadExportsWithViews(options: LoadOptions = {}) {
  await ensureExportTableViews();
  await loadExports(options);
}

async function loadRecycleBinWithViews(options: LoadOptions = {}) {
  await ensureRecycleTableViews();
  await loadRecycleBin(options);
}

async function loadCleanupJobsWithViews(options: LoadOptions = {}) {
  await ensureCleanupTableViews();
  await loadCleanupJobs(options);
}

async function loadDuplicateJobsWithViews(options: LoadOptions = {}) {
  await ensureDuplicateTableViews();
  await loadDuplicateJobs(options);
}

async function loadDictionariesWithViews(options: LoadOptions = {}) {
  await ensureDictionaryTableViews();
  await loadDictionaries(options);
}

async function loadParametersWithViews(options: LoadOptions = {}) {
  await ensureParameterTableViews();
  await loadParameters(options);
}

async function handleBackupSearch() {
  backupQuery.page = 1;
  await loadBackups();
}

async function handleRestoreSearch() {
  restoreQuery.page = 1;
  await loadRestores();
}

async function handleImportSearch() {
  importQuery.page = 1;
  await loadImports();
}

async function handleExportSearch() {
  exportQuery.page = 1;
  await loadExports();
}

async function handleRecycleSearch() {
  recycleQuery.page = 1;
  await loadRecycleBin();
}

async function handleCleanupSearch() {
  cleanupQuery.page = 1;
  await loadCleanupJobs();
}

async function handleDuplicateSearch() {
  duplicateQuery.page = 1;
  await loadDuplicateJobs();
}

async function handleDictionarySearch() {
  dictionaryQuery.page = 1;
  await loadDictionaries();
}

async function handleParameterSearch() {
  parameterQuery.page = 1;
  await loadParameters();
}

async function handleBackupSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  backupSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  backupQuery.page = 1;
  await loadBackups();
}

async function handleRestoreSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  restoreSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  restoreQuery.page = 1;
  await loadRestores();
}

async function handleImportSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  importSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  importQuery.page = 1;
  await loadImports();
}

async function handleExportSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  exportSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  exportQuery.page = 1;
  await loadExports();
}

async function handleRecycleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  recycleSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  recycleQuery.page = 1;
  await loadRecycleBin();
}

async function handleCleanupSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  cleanupSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  cleanupQuery.page = 1;
  await loadCleanupJobs();
}

async function handleDuplicateSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  duplicateSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  duplicateQuery.page = 1;
  await loadDuplicateJobs();
}

async function handleDictionarySortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  dictionarySortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  dictionaryQuery.page = 1;
  await loadDictionaries();
}

async function handleParameterSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  parameterSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  parameterQuery.page = 1;
  await loadParameters();
}

function clearBackupFilters() {
  backupQuery.page = 1;
  backupQuery.keyword = '';
  backupQuery.status = '';
  backupQuery.jobType = '';
  backupSavedViewId.value = '';
  backupDensity.value = 'default';
  backupSortConfig.value = {};
}

function clearRestoreFilters() {
  restoreQuery.page = 1;
  restoreQuery.keyword = '';
  restoreQuery.status = '';
  restoreQuery.backupJobId = '';
  restoreSavedViewId.value = '';
  restoreDensity.value = 'default';
  restoreSortConfig.value = {};
}

function clearImportFilters() {
  importQuery.page = 1;
  importQuery.keyword = '';
  importQuery.status = '';
  importQuery.module = '';
  importSavedViewId.value = '';
  importDensity.value = 'default';
  importSortConfig.value = {};
}

function clearExportFilters() {
  exportQuery.page = 1;
  exportQuery.keyword = '';
  exportQuery.status = '';
  exportQuery.module = '';
  exportQuery.containsSensitive = '';
  exportSavedViewId.value = '';
  exportDensity.value = 'default';
  exportSortConfig.value = {};
}

function clearRecycleFilters() {
  recycleQuery.page = 1;
  recycleQuery.keyword = '';
  recycleQuery.module = '';
  recycleQuery.objectType = '';
  recycleQuery.restored = '';
  recycleSavedViewId.value = '';
  recycleDensity.value = 'default';
  recycleSortConfig.value = {};
}

function clearCleanupFilters() {
  cleanupQuery.page = 1;
  cleanupQuery.keyword = '';
  cleanupQuery.status = '';
  cleanupQuery.module = '';
  cleanupSavedViewId.value = '';
  cleanupDensity.value = 'default';
  cleanupSortConfig.value = {};
}

function clearDuplicateFilters() {
  duplicateQuery.page = 1;
  duplicateQuery.keyword = '';
  duplicateQuery.status = '';
  duplicateQuery.module = '';
  duplicateSavedViewId.value = '';
  duplicateDensity.value = 'default';
  duplicateSortConfig.value = {};
}

function clearDictionaryFilters() {
  dictionaryQuery.page = 1;
  dictionaryQuery.keyword = '';
  dictionaryQuery.group = '';
  dictionaryQuery.status = '';
  dictionarySavedViewId.value = '';
  dictionaryDensity.value = 'default';
  dictionarySortConfig.value = {};
}

function clearParameterFilters() {
  parameterQuery.page = 1;
  parameterQuery.keyword = '';
  parameterQuery.group = '';
  parameterSavedViewId.value = '';
  parameterDensity.value = 'default';
  parameterSortConfig.value = {};
}

async function ensureBackupTableViews() {
  if (backupViewsLoaded.value) return;
  await loadBackupTableViews(true);
  backupViewsLoaded.value = true;
}

async function ensureRestoreTableViews() {
  if (restoreViewsLoaded.value) return;
  await loadRestoreTableViews(true);
  restoreViewsLoaded.value = true;
}

async function ensureImportTableViews() {
  if (importViewsLoaded.value) return;
  await loadImportTableViews(true);
  importViewsLoaded.value = true;
}

async function ensureExportTableViews() {
  if (exportViewsLoaded.value) return;
  await loadExportTableViews(true);
  exportViewsLoaded.value = true;
}

async function ensureRecycleTableViews() {
  if (recycleViewsLoaded.value) return;
  await loadRecycleTableViews(true);
  recycleViewsLoaded.value = true;
}

async function ensureCleanupTableViews() {
  if (cleanupViewsLoaded.value) return;
  await loadCleanupTableViews(true);
  cleanupViewsLoaded.value = true;
}

async function ensureDuplicateTableViews() {
  if (duplicateViewsLoaded.value) return;
  await loadDuplicateTableViews(true);
  duplicateViewsLoaded.value = true;
}

async function ensureDictionaryTableViews() {
  if (dictionaryViewsLoaded.value) return;
  await loadDictionaryTableViews(true);
  dictionaryViewsLoaded.value = true;
}

async function ensureParameterTableViews() {
  if (parameterViewsLoaded.value) return;
  await loadParameterTableViews(true);
  parameterViewsLoaded.value = true;
}

async function loadBackupTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: backupTableKey });
    backupSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyBackupView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadRestoreTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: restoreTableKey
    });
    restoreSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyRestoreView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadImportTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: importTableKey });
    importSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyImportView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadExportTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: exportTableKey });
    exportSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyExportView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadRecycleTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: recycleTableKey
    });
    recycleSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyRecycleView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadCleanupTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: cleanupTableKey
    });
    cleanupSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyCleanupView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadDuplicateTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: duplicateTableKey
    });
    duplicateSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyDuplicateView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadDictionaryTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: dictionaryTableKey
    });
    dictionarySavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyDictionaryView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadParameterTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: parameterTableKey
    });
    parameterSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyParameterView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveBackupTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存备份任务视图', {
      inputValue: '备份任务常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: backupTableKey,
      viewName: value.trim(),
      filters: {
        keyword: backupQuery.keyword,
        status: backupQuery.status,
        jobType: backupQuery.jobType
      },
      sortConfig: backupSortConfig.value,
      columns: backupVisibleColumns.value.length
        ? backupVisibleColumns.value
        : backupColumnOptions.map((column) => column.value),
      density: backupDensity.value,
      pageSize: backupQuery.pageSize,
      isDefault: backupSavedViews.value.length === 0
    });
    await loadBackupTableViews();
    backupSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveRestoreTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存恢复任务视图', {
      inputValue: '恢复任务常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: restoreTableKey,
      viewName: value.trim(),
      filters: {
        keyword: restoreQuery.keyword,
        status: restoreQuery.status,
        backupJobId: restoreQuery.backupJobId
      },
      sortConfig: restoreSortConfig.value,
      columns: restoreVisibleColumns.value.length
        ? restoreVisibleColumns.value
        : restoreColumnOptions.map((column) => column.value),
      density: restoreDensity.value,
      pageSize: restoreQuery.pageSize,
      isDefault: restoreSavedViews.value.length === 0
    });
    await loadRestoreTableViews();
    restoreSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveImportTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存导入任务视图', {
      inputValue: '导入任务常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: importTableKey,
      viewName: value.trim(),
      filters: {
        keyword: importQuery.keyword,
        status: importQuery.status,
        module: importQuery.module
      },
      sortConfig: importSortConfig.value,
      columns: importVisibleColumns.value.length
        ? importVisibleColumns.value
        : importColumnOptions.map((column) => column.value),
      density: importDensity.value,
      pageSize: importQuery.pageSize,
      isDefault: importSavedViews.value.length === 0
    });
    await loadImportTableViews();
    importSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveExportTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存导出任务视图', {
      inputValue: '导出任务常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: exportTableKey,
      viewName: value.trim(),
      filters: {
        keyword: exportQuery.keyword,
        status: exportQuery.status,
        module: exportQuery.module,
        containsSensitive: exportQuery.containsSensitive
      },
      sortConfig: exportSortConfig.value,
      columns: exportVisibleColumns.value.length
        ? exportVisibleColumns.value
        : exportColumnOptions.map((column) => column.value),
      density: exportDensity.value,
      pageSize: exportQuery.pageSize,
      isDefault: exportSavedViews.value.length === 0
    });
    await loadExportTableViews();
    exportSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveRecycleTableView() {
  await saveDataCenterTableView({
    title: '保存回收站视图',
    defaultName: '回收站常用视图',
    tableKey: recycleTableKey,
    filters: {
      keyword: recycleQuery.keyword,
      module: recycleQuery.module,
      objectType: recycleQuery.objectType,
      restored: recycleQuery.restored
    },
    sortConfig: recycleSortConfig.value,
    columns: recycleVisibleColumns.value.length
      ? recycleVisibleColumns.value
      : recycleColumnOptions.map((column) => column.value),
    density: recycleDensity.value,
    pageSize: recycleQuery.pageSize,
    isDefault: recycleSavedViews.value.length === 0,
    reload: loadRecycleTableViews,
    select: (id) => {
      recycleSavedViewId.value = id;
    }
  });
}

async function saveCleanupTableView() {
  await saveDataCenterTableView({
    title: '保存数据清理视图',
    defaultName: '数据清理常用视图',
    tableKey: cleanupTableKey,
    filters: {
      keyword: cleanupQuery.keyword,
      status: cleanupQuery.status,
      module: cleanupQuery.module
    },
    sortConfig: cleanupSortConfig.value,
    columns: cleanupVisibleColumns.value.length
      ? cleanupVisibleColumns.value
      : cleanupColumnOptions.map((column) => column.value),
    density: cleanupDensity.value,
    pageSize: cleanupQuery.pageSize,
    isDefault: cleanupSavedViews.value.length === 0,
    reload: loadCleanupTableViews,
    select: (id) => {
      cleanupSavedViewId.value = id;
    }
  });
}

async function saveDuplicateTableView() {
  await saveDataCenterTableView({
    title: '保存重复合并视图',
    defaultName: '重复合并常用视图',
    tableKey: duplicateTableKey,
    filters: {
      keyword: duplicateQuery.keyword,
      status: duplicateQuery.status,
      module: duplicateQuery.module
    },
    sortConfig: duplicateSortConfig.value,
    columns: duplicateVisibleColumns.value.length
      ? duplicateVisibleColumns.value
      : duplicateColumnOptions.map((column) => column.value),
    density: duplicateDensity.value,
    pageSize: duplicateQuery.pageSize,
    isDefault: duplicateSavedViews.value.length === 0,
    reload: loadDuplicateTableViews,
    select: (id) => {
      duplicateSavedViewId.value = id;
    }
  });
}

async function saveDictionaryTableView() {
  await saveDataCenterTableView({
    title: '保存数据字典视图',
    defaultName: '数据字典常用视图',
    tableKey: dictionaryTableKey,
    filters: {
      keyword: dictionaryQuery.keyword,
      group: dictionaryQuery.group,
      status: dictionaryQuery.status
    },
    sortConfig: dictionarySortConfig.value,
    columns: dictionaryVisibleColumns.value.length
      ? dictionaryVisibleColumns.value
      : dictionaryColumnOptions.map((column) => column.value),
    density: dictionaryDensity.value,
    pageSize: dictionaryQuery.pageSize,
    isDefault: dictionarySavedViews.value.length === 0,
    reload: loadDictionaryTableViews,
    select: (id) => {
      dictionarySavedViewId.value = id;
    }
  });
}

async function saveParameterTableView() {
  await saveDataCenterTableView({
    title: '保存系统参数视图',
    defaultName: '系统参数常用视图',
    tableKey: parameterTableKey,
    filters: {
      keyword: parameterQuery.keyword,
      group: parameterQuery.group
    },
    sortConfig: parameterSortConfig.value,
    columns: parameterVisibleColumns.value.length
      ? parameterVisibleColumns.value
      : parameterColumnOptions.map((column) => column.value),
    density: parameterDensity.value,
    pageSize: parameterQuery.pageSize,
    isDefault: parameterSavedViews.value.length === 0,
    reload: loadParameterTableViews,
    select: (id) => {
      parameterSavedViewId.value = id;
    }
  });
}

async function saveDataCenterTableView(config: {
  title: string;
  defaultName: string;
  tableKey: string;
  filters: Record<string, unknown>;
  sortConfig: Record<string, unknown>;
  columns: string[];
  density: TableDensity;
  pageSize: number;
  isDefault: boolean;
  reload: () => Promise<void>;
  select: (id: string) => void;
}) {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', config.title, {
      inputValue: config.defaultName,
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: config.tableKey,
      viewName: value.trim(),
      filters: config.filters,
      sortConfig: config.sortConfig,
      columns: config.columns,
      density: config.density,
      pageSize: config.pageSize,
      isDefault: config.isDefault
    });
    await config.reload();
    config.select(created.id);
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyBackupSavedView(id: string) {
  const view = backupSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyBackupView(view);
  ElMessage.success('已应用保存视图');
  await loadBackups();
}

async function applyRestoreSavedView(id: string) {
  const view = restoreSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyRestoreView(view);
  ElMessage.success('已应用保存视图');
  await loadRestores();
}

async function applyImportSavedView(id: string) {
  const view = importSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyImportView(view);
  ElMessage.success('已应用保存视图');
  await loadImports();
}

async function applyExportSavedView(id: string) {
  const view = exportSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyExportView(view);
  ElMessage.success('已应用保存视图');
  await loadExports();
}

async function applyRecycleSavedView(id: string) {
  const view = recycleSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyRecycleView(view);
  ElMessage.success('已应用保存视图');
  await loadRecycleBin();
}

async function applyCleanupSavedView(id: string) {
  const view = cleanupSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyCleanupView(view);
  ElMessage.success('已应用保存视图');
  await loadCleanupJobs();
}

async function applyDuplicateSavedView(id: string) {
  const view = duplicateSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyDuplicateView(view);
  ElMessage.success('已应用保存视图');
  await loadDuplicateJobs();
}

async function applyDictionarySavedView(id: string) {
  const view = dictionarySavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyDictionaryView(view);
  ElMessage.success('已应用保存视图');
  await loadDictionaries();
}

async function applyParameterSavedView(id: string) {
  const view = parameterSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyParameterView(view);
  ElMessage.success('已应用保存视图');
  await loadParameters();
}

function applyBackupView(view: UserTableView) {
  const filters = view.filters;
  backupQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  backupQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  backupQuery.jobType = isBackupJobType(filters.jobType) ? filters.jobType : '';
  backupQuery.pageSize = view.pageSize;
  backupDensity.value = 'default';
  backupVisibleColumns.value = normalizeColumns(view.columns, backupColumnOptions);
  backupSortConfig.value = parseSortConfig(view.sortConfig);
  backupSavedViewId.value = view.id;
}

function applyRestoreView(view: UserTableView) {
  const filters = view.filters;
  restoreQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  restoreQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  restoreQuery.backupJobId = typeof filters.backupJobId === 'string' ? filters.backupJobId : '';
  restoreQuery.pageSize = view.pageSize;
  restoreDensity.value = 'default';
  restoreVisibleColumns.value = normalizeColumns(view.columns, restoreColumnOptions);
  restoreSortConfig.value = parseSortConfig(view.sortConfig);
  restoreSavedViewId.value = view.id;
}

function applyImportView(view: UserTableView) {
  const filters = view.filters;
  importQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  importQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  importQuery.module = typeof filters.module === 'string' ? filters.module : '';
  importQuery.pageSize = view.pageSize;
  importDensity.value = 'default';
  importVisibleColumns.value = normalizeColumns(view.columns, importColumnOptions);
  importSortConfig.value = parseSortConfig(view.sortConfig);
  importSavedViewId.value = view.id;
}

function applyExportView(view: UserTableView) {
  const filters = view.filters;
  exportQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  exportQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  exportQuery.module = typeof filters.module === 'string' ? filters.module : '';
  exportQuery.containsSensitive =
    filters.containsSensitive === 'true' || filters.containsSensitive === 'false'
      ? filters.containsSensitive
      : '';
  exportQuery.pageSize = view.pageSize;
  exportDensity.value = 'default';
  exportVisibleColumns.value = normalizeColumns(view.columns, exportColumnOptions);
  exportSortConfig.value = parseSortConfig(view.sortConfig);
  exportSavedViewId.value = view.id;
}

function applyRecycleView(view: UserTableView) {
  const filters = view.filters;
  recycleQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  recycleQuery.module = typeof filters.module === 'string' ? filters.module : '';
  recycleQuery.objectType = typeof filters.objectType === 'string' ? filters.objectType : '';
  recycleQuery.restored =
    filters.restored === 'true' || filters.restored === 'false' ? filters.restored : '';
  recycleQuery.pageSize = view.pageSize;
  recycleDensity.value = 'default';
  recycleVisibleColumns.value = normalizeColumns(view.columns, recycleColumnOptions);
  recycleSortConfig.value = parseSortConfig(view.sortConfig);
  recycleSavedViewId.value = view.id;
}

function applyCleanupView(view: UserTableView) {
  const filters = view.filters;
  cleanupQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  cleanupQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  cleanupQuery.module = typeof filters.module === 'string' ? filters.module : '';
  cleanupQuery.pageSize = view.pageSize;
  cleanupDensity.value = 'default';
  cleanupVisibleColumns.value = normalizeColumns(view.columns, cleanupColumnOptions);
  cleanupSortConfig.value = parseSortConfig(view.sortConfig);
  cleanupSavedViewId.value = view.id;
}

function applyDuplicateView(view: UserTableView) {
  const filters = view.filters;
  duplicateQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  duplicateQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  duplicateQuery.module = typeof filters.module === 'string' ? filters.module : '';
  duplicateQuery.pageSize = view.pageSize;
  duplicateDensity.value = 'default';
  duplicateVisibleColumns.value = normalizeColumns(view.columns, duplicateColumnOptions);
  duplicateSortConfig.value = parseSortConfig(view.sortConfig);
  duplicateSavedViewId.value = view.id;
}

function applyDictionaryView(view: UserTableView) {
  const filters = view.filters;
  dictionaryQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  dictionaryQuery.group = typeof filters.group === 'string' ? filters.group : '';
  dictionaryQuery.status = isDictionaryStatus(filters.status) ? filters.status : '';
  dictionaryQuery.pageSize = view.pageSize;
  dictionaryDensity.value = 'default';
  dictionaryVisibleColumns.value = normalizeColumns(view.columns, dictionaryColumnOptions);
  dictionarySortConfig.value = parseSortConfig(view.sortConfig);
  dictionarySavedViewId.value = view.id;
}

function applyParameterView(view: UserTableView) {
  const filters = view.filters;
  parameterQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  parameterQuery.group = typeof filters.group === 'string' ? filters.group : '';
  parameterQuery.pageSize = view.pageSize;
  parameterDensity.value = 'default';
  parameterVisibleColumns.value = normalizeColumns(view.columns, parameterColumnOptions);
  parameterSortConfig.value = parseSortConfig(view.sortConfig);
  parameterSavedViewId.value = view.id;
}

function isBackupColumnVisible(column: string) {
  return backupVisibleColumns.value.length ? backupVisibleColumns.value.includes(column) : true;
}

function isRestoreColumnVisible(column: string) {
  return restoreVisibleColumns.value.length ? restoreVisibleColumns.value.includes(column) : true;
}

function isImportColumnVisible(column: string) {
  return importVisibleColumns.value.length ? importVisibleColumns.value.includes(column) : true;
}

function isExportColumnVisible(column: string) {
  return exportVisibleColumns.value.length ? exportVisibleColumns.value.includes(column) : true;
}

function isRecycleColumnVisible(column: string) {
  return recycleVisibleColumns.value.length ? recycleVisibleColumns.value.includes(column) : true;
}

function isCleanupColumnVisible(column: string) {
  return cleanupVisibleColumns.value.length ? cleanupVisibleColumns.value.includes(column) : true;
}

function isDuplicateColumnVisible(column: string) {
  return duplicateVisibleColumns.value.length
    ? duplicateVisibleColumns.value.includes(column)
    : true;
}

function isDictionaryColumnVisible(column: string) {
  return dictionaryVisibleColumns.value.length
    ? dictionaryVisibleColumns.value.includes(column)
    : true;
}

function isParameterColumnVisible(column: string) {
  return parameterVisibleColumns.value.length
    ? parameterVisibleColumns.value.includes(column)
    : true;
}

function buildRecycleParams(): RecycleBinQuery {
  return {
    ...recycleQuery,
    sortBy: mapSortField(recycleSortConfig.value.prop, {
      restoredStatus: 'restoredAt'
    }),
    sortOrder: mapSortOrder(recycleSortConfig.value.order)
  };
}

async function loadRecycleBin(options: LoadOptions = {}) {
  const params = buildRecycleParams();
  await loadPagedData<RecycleBinRecord>({
    scope: 'data-recycle-bin',
    params,
    activeKey: activeRecycleQueryKey,
    setLoading: (loading) => {
      recycleLoading.value = loading;
    },
    apply: (result) => {
      recycleRecords.value = result.items;
      recycleTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listRecycleBin(params),
    errorMessage: '加载回收站失败',
    options
  });
}

function buildCleanupParams(): DataJobQuery {
  return {
    ...cleanupQuery,
    sortBy: mapSortField(cleanupSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(cleanupSortConfig.value.order)
  };
}

async function loadCleanupJobs(options: LoadOptions = {}) {
  const params = buildCleanupParams();
  await loadPagedData<DataCleanupJob>({
    scope: 'data-cleanup-jobs',
    params,
    activeKey: activeCleanupQueryKey,
    setLoading: (loading) => {
      cleanupLoading.value = loading;
    },
    apply: (result) => {
      cleanupJobs.value = result.items;
      cleanupTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listCleanupJobs(params),
    errorMessage: '加载数据清理任务失败',
    options
  });
}

function buildDuplicateParams(): DataJobQuery {
  return {
    ...duplicateQuery,
    sortBy: mapSortField(duplicateSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(duplicateSortConfig.value.order)
  };
}

async function loadDuplicateJobs(options: LoadOptions = {}) {
  const params = buildDuplicateParams();
  await loadPagedData<DuplicateMergeJob>({
    scope: 'data-duplicate-merge-jobs',
    params,
    activeKey: activeDuplicateQueryKey,
    setLoading: (loading) => {
      duplicateLoading.value = loading;
    },
    apply: (result) => {
      duplicateJobs.value = result.items;
      duplicateTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listDuplicateMergeJobs(params),
    errorMessage: '加载重复合并任务失败',
    options
  });
}

function buildDictionaryParams(): DataDictionaryQuery {
  return {
    ...dictionaryQuery,
    sortBy: mapSortField(dictionarySortConfig.value.prop, {}),
    sortOrder: mapSortOrder(dictionarySortConfig.value.order)
  };
}

async function loadDictionaries(options: LoadOptions = {}) {
  const params = buildDictionaryParams();
  await loadPagedData<DataDictionary>({
    scope: 'data-dictionaries',
    params,
    activeKey: activeDictionaryQueryKey,
    setLoading: (loading) => {
      dictionaryLoading.value = loading;
    },
    apply: (result) => {
      dictionaries.value = result.items;
      dictionaryTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listDictionaries(params),
    errorMessage: '加载数据字典失败',
    options
  });
}

function buildParameterParams(): SystemParameterQuery {
  return {
    ...parameterQuery,
    sortBy: mapSortField(parameterSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(parameterSortConfig.value.order)
  };
}

async function loadParameters(options: LoadOptions = {}) {
  const params = buildParameterParams();
  await loadPagedData<SystemParameter>({
    scope: 'data-parameters',
    params,
    activeKey: activeParameterQueryKey,
    setLoading: (loading) => {
      parameterLoading.value = loading;
    },
    apply: (result) => {
      parameters.value = result.items;
      parameterTotal.value = result.total;
    },
    fetcher: () => dataCenterApi.listSystemParameters(params),
    errorMessage: '加载系统参数失败',
    options
  });
}

function openBackupDialog() {
  Object.assign(backupForm, { jobType: getDefaultBackupType(), remark: '' });
  backupDialogVisible.value = true;
}

async function createBackup() {
  saving.value = true;
  try {
    await dataCenterApi.createBackupJob({ ...backupForm });
    ElMessage.success('备份任务已创建');
    backupDialogVisible.value = false;
    await loadBackups();
    await loadOverview();
  } finally {
    saving.value = false;
  }
}

function openRestoreDialog() {
  Object.assign(restoreForm, { backupJobId: '', restoreScope: 'database', approvalNote: '' });
  restoreDialogVisible.value = true;
}

async function createRestore() {
  saving.value = true;
  try {
    await dataCenterApi.createRestoreJob({
      backupJobId: restoreForm.backupJobId || null,
      restoreScope: restoreForm.restoreScope,
      approvalNote: restoreForm.approvalNote || null
    });
    ElMessage.success('恢复任务已创建');
    restoreDialogVisible.value = false;
    await loadRestores();
  } finally {
    saving.value = false;
  }
}

function openImportDialog() {
  Object.assign(importForm, { module: getDefaultImportModule(), filePath: '', remark: '' });
  importDialogVisible.value = true;
}

async function createImport() {
  saving.value = true;
  try {
    await dataCenterApi.createImportJob({
      module: importForm.module,
      filePath: importForm.filePath || null,
      remark: importForm.remark || null
    });
    ElMessage.success('导入任务已创建');
    importDialogVisible.value = false;
    await loadImports();
    await loadOverview();
  } finally {
    saving.value = false;
  }
}

function openExportDialog() {
  Object.assign(exportForm, {
    module: getDefaultExportModule(),
    fieldsText: '',
    containsSensitive: false
  });
  exportDialogVisible.value = true;
}

async function createExport() {
  saving.value = true;
  try {
    await dataCenterApi.createExportJob({
      module: exportForm.module,
      fields: splitList(exportForm.fieldsText),
      containsSensitive: exportForm.containsSensitive
    });
    ElMessage.success('导出任务已创建');
    exportDialogVisible.value = false;
    await loadExports();
    await loadOverview();
  } finally {
    saving.value = false;
  }
}

function openCleanupDialog() {
  Object.assign(cleanupForm, { module: 'common', approvalNote: '' });
  cleanupDialogVisible.value = true;
}

async function createCleanup() {
  saving.value = true;
  try {
    await dataCenterApi.createCleanupJob({
      module: cleanupForm.module,
      approvalNote: cleanupForm.approvalNote || null
    });
    ElMessage.success('数据清理任务已创建');
    cleanupDialogVisible.value = false;
    await loadCleanupJobs();
  } finally {
    saving.value = false;
  }
}

function openDuplicateDialog() {
  Object.assign(duplicateForm, {
    module: 'common',
    primaryObjectId: '',
    duplicateObjectIdsText: '',
    approvalNote: ''
  });
  duplicateDialogVisible.value = true;
}

async function createDuplicate() {
  saving.value = true;
  try {
    await dataCenterApi.createDuplicateMergeJob({
      module: duplicateForm.module,
      primaryObjectId: duplicateForm.primaryObjectId || null,
      duplicateObjectIds: splitList(duplicateForm.duplicateObjectIdsText),
      approvalNote: duplicateForm.approvalNote || null
    });
    ElMessage.success('重复合并任务已创建');
    duplicateDialogVisible.value = false;
    await loadDuplicateJobs();
  } finally {
    saving.value = false;
  }
}

function openDictionaryDialog(row?: DataDictionary) {
  editingDictionary.value = row ?? null;
  Object.assign(dictionaryForm, {
    group: row?.group ?? '',
    code: row?.code ?? '',
    label: row?.label ?? '',
    value: row?.value ?? '',
    sortOrder: row?.sortOrder ?? 0,
    status: row?.status ?? 'active',
    remark: row?.remark ?? ''
  });
  dictionaryDialogVisible.value = true;
}

async function saveDictionary() {
  saving.value = true;
  try {
    if (editingDictionary.value) {
      await dataCenterApi.updateDictionary(editingDictionary.value.id, {
        label: dictionaryForm.label,
        value: dictionaryForm.value || null,
        sortOrder: dictionaryForm.sortOrder,
        status: dictionaryForm.status,
        remark: dictionaryForm.remark || null
      });
    } else {
      await dataCenterApi.createDictionary({
        ...dictionaryForm,
        value: dictionaryForm.value || null
      });
    }
    ElMessage.success('数据字典已保存');
    dictionaryDialogVisible.value = false;
    await loadDictionaries();
    await loadOverview();
  } finally {
    saving.value = false;
  }
}

function openParameterDialog(row?: SystemParameter) {
  editingParameter.value = row ?? null;
  Object.assign(parameterForm, {
    key: row?.key ?? '',
    group: row?.group ?? 'data',
    valueText: JSON.stringify(row?.value ?? {}, null, 2),
    remark: row?.remark ?? ''
  });
  parameterDialogVisible.value = true;
}

async function saveParameter() {
  let parsedValue: Record<string, unknown>;
  try {
    parsedValue = JSON.parse(parameterForm.valueText) as Record<string, unknown>;
  } catch {
    ElMessage.error('值必须是合法 JSON');
    return;
  }
  saving.value = true;
  try {
    await dataCenterApi.saveSystemParameter(parameterForm.key, {
      value: parsedValue,
      group: parameterForm.group,
      remark: parameterForm.remark || null
    });
    ElMessage.success('系统参数已保存');
    parameterDialogVisible.value = false;
    await loadParameters();
  } finally {
    saving.value = false;
  }
}

async function markBackup(row: BackupJob, status: DataJobStatus) {
  const errorMessage = await maybeAskFailureReason(status);
  await dataCenterApi.updateBackupJobStatus(row.id, { status, errorMessage });
  ElMessage.success('备份任务状态已更新');
  await loadBackups();
  await loadOverview();
}

async function executeBackup(row: BackupJob) {
  await ElMessageBox.confirm(
    '将调用 PostgreSQL 备份脚本生成数据库备份文件，确认执行？',
    '执行备份',
    {
      type: 'warning'
    }
  );
  const result = await dataCenterApi.executeBackupJob(row.id);
  if (result.status === 'failed') {
    ElMessage.error(result.errorMessage ?? '备份执行失败');
  } else {
    ElMessage.success('备份文件已生成');
  }
  await loadBackups();
  await loadOverview();
}

async function markRestore(id: string, status: DataJobStatus) {
  await markGeneric(id, status, dataCenterApi.updateRestoreJobStatus, loadRestores);
}

async function executeRestore(row: RestoreJob) {
  const expectedConfirmText = getRestoreConfirmText(row.id);
  const confirmText = await ElMessageBox.prompt(
    `请输入 ${expectedConfirmText} 后执行恢复演练。本操作只恢复到临时库验证，不覆盖当前数据库。`,
    '恢复演练确认',
    {
      confirmButtonText: '执行演练',
      cancelButtonText: '取消',
      inputPattern: new RegExp(`^${escapeRegExp(expectedConfirmText)}$`),
      inputErrorMessage: '确认文本不匹配',
      type: 'warning'
    }
  );
  const result = await dataCenterApi.executeRestoreJob(row.id, confirmText.value);
  if (result.status === 'failed') {
    ElMessage.error(result.errorMessage ?? '恢复演练失败');
  } else {
    ElMessage.success('恢复演练已通过');
  }
  await loadRestores();
  await loadOverview();
}

async function markImport(id: string, status: DataJobStatus) {
  await markGeneric(id, status, dataCenterApi.updateImportJobStatus, loadImports);
}

async function executeImport(row: DataImportJob) {
  const result = await dataCenterApi.executeImportJob(row.id);
  if (result.status === 'failed') {
    ElMessage.error(result.errorReport ? '导入失败，已生成错误报告' : '导入失败');
  } else if (result.failedCount > 0) {
    ElMessage.warning(`导入完成，成功 ${result.successCount} 条，失败 ${result.failedCount} 条`);
  } else {
    ElMessage.success(`导入完成，成功 ${result.successCount} 条`);
  }
  await loadImports();
  await loadOverview();
}

async function markExport(id: string, status: DataJobStatus) {
  await markGeneric(id, status, dataCenterApi.updateExportJobStatus, loadExports);
}

async function executeExport(row: DataExportJob) {
  const result = await dataCenterApi.executeExportJob(row.id);
  if (result.status === 'failed') {
    ElMessage.error(result.errorMessage ?? '导出执行失败');
  } else {
    ElMessage.success('导出文件已生成');
  }
  await loadExports();
  await loadOverview();
}

async function markCleanup(id: string, status: DataJobStatus) {
  await markGeneric(id, status, dataCenterApi.updateCleanupJobStatus, loadCleanupJobs);
}

async function markDuplicate(id: string, status: DataJobStatus) {
  await markGeneric(id, status, dataCenterApi.updateDuplicateMergeJobStatus, loadDuplicateJobs);
}

async function markGeneric(
  id: string,
  status: DataJobStatus,
  updater: (
    id: string,
    payload: { status: DataJobStatus; errorMessage?: string | null }
  ) => Promise<unknown>,
  reload: () => Promise<void>
) {
  const errorMessage = await maybeAskFailureReason(status);
  await updater(id, { status, errorMessage });
  ElMessage.success('任务状态已更新');
  await reload();
  await loadOverview();
}

async function maybeAskFailureReason(status: DataJobStatus) {
  if (status !== 'failed') return null;
  const result = await ElMessageBox.prompt('请输入失败原因，便于后续排查。', '标记失败', {
    inputType: 'textarea',
    confirmButtonText: '确认',
    cancelButtonText: '取消'
  });
  return result.value || '人工标记失败';
}

async function exportCurrentTab() {
  try {
    if (activeTab.value === 'backups') {
      await exportBackups();
      return;
    }
    if (activeTab.value === 'restores') {
      await exportRestores();
      return;
    }
    if (activeTab.value === 'imports') {
      await exportImports();
      return;
    }
    if (activeTab.value === 'exports') {
      await exportExports();
      return;
    }
    if (activeTab.value === 'recycle') {
      await exportRecycleBin();
      return;
    }
    if (activeTab.value === 'cleanup') {
      await exportCleanupJobs();
      return;
    }
    if (activeTab.value === 'duplicates') {
      await exportDuplicateJobs();
      return;
    }
    if (activeTab.value === 'dictionaries') {
      await exportDictionaries();
      return;
    }
    if (activeTab.value === 'parameters') {
      await exportParameters();
      return;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败');
  }
}

async function exportBackups() {
  await exportDataCenterRows({
    filenamePrefix: 'data-backup-jobs',
    label: '备份任务',
    params: buildBackupParams(),
    fetcher: dataCenterApi.listBackupJobs,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '类型', value: (row) => getBackupTypeLabel(row.jobType) },
      { header: '状态', value: (row) => getDataJobStatusLabel(row.status) },
      { header: '文件路径', value: (row) => row.storagePath },
      { header: '文件大小', value: (row) => formatFileSize(row.fileSize) },
      { header: '失败原因', value: (row) => row.errorMessage },
      { header: '备注', value: (row) => row.remark },
      { header: '发起人', value: (row) => getUserDisplayName(row.createdBy) },
      { header: '开始时间', value: (row) => formatDate(row.startedAt) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportRestores() {
  await exportDataCenterRows({
    filenamePrefix: 'data-restore-jobs',
    label: '恢复任务',
    params: buildRestoreParams(),
    fetcher: dataCenterApi.listRestoreJobs,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '恢复范围', value: (row) => row.restoreScope },
      { header: '备份任务', value: (row) => getBackupJobSummary(row) },
      { header: '状态', value: (row) => getDataJobStatusLabel(row.status) },
      { header: '审批说明', value: (row) => row.approvalNote },
      { header: '失败原因', value: (row) => row.errorMessage },
      { header: '发起人', value: (row) => getUserDisplayName(row.createdBy) },
      { header: '开始时间', value: (row) => formatDate(row.startedAt) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportImports() {
  await exportDataCenterRows({
    filenamePrefix: 'data-import-jobs',
    label: '导入任务',
    params: buildImportParams(),
    fetcher: dataCenterApi.listImportJobs,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '模块', value: (row) => getImportModuleLabel(row.module) },
      { header: '状态', value: (row) => getDataJobStatusLabel(row.status) },
      { header: '总数', value: (row) => row.totalCount },
      { header: '成功数', value: (row) => row.successCount },
      { header: '失败数', value: (row) => row.failedCount },
      { header: '文件', value: (row) => row.filePath },
      { header: '错误报告', value: (row) => row.errorReport },
      { header: '备注', value: (row) => row.remark },
      { header: '发起人', value: (row) => getUserDisplayName(row.createdBy) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportExports() {
  await exportDataCenterRows({
    filenamePrefix: 'data-export-jobs',
    label: '导出任务',
    params: buildExportParams(),
    fetcher: dataCenterApi.listExportJobs,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '模块', value: (row) => getExportModuleLabel(row.module) },
      { header: '状态', value: (row) => getDataJobStatusLabel(row.status) },
      { header: '字段', value: (row) => row.fields.join(', ') },
      { header: '包含敏感字段', value: (row) => (row.containsSensitive ? '是' : '否') },
      { header: '文件路径', value: (row) => row.filePath },
      { header: '下载过期', value: (row) => formatDate(row.downloadExpiresAt) },
      { header: '失败原因', value: (row) => row.errorMessage },
      { header: '发起人', value: (row) => getUserDisplayName(row.createdBy) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportRecycleBin() {
  await exportDataCenterRows({
    filenamePrefix: 'data-recycle-bin',
    label: '回收站记录',
    params: buildRecycleParams(),
    fetcher: dataCenterApi.listRecycleBin,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '模块', value: (row) => row.module },
      { header: '对象类型', value: (row) => row.objectType },
      { header: '对象 ID', value: (row) => row.objectId },
      { header: '对象名称', value: (row) => row.objectLabel },
      { header: '删除人', value: (row) => getUserDisplayName(row.deletedBy) },
      { header: '删除时间', value: (row) => formatDate(row.deletedAt) },
      { header: '恢复状态', value: (row) => (row.restoredAt ? '已恢复' : '未恢复') },
      { header: '恢复人', value: (row) => getUserDisplayName(row.restoredBy) },
      { header: '恢复时间', value: (row) => formatDate(row.restoredAt) }
    ]
  });
}

async function exportCleanupJobs() {
  await exportDataCenterRows({
    filenamePrefix: 'data-cleanup-jobs',
    label: '数据清理任务',
    params: buildCleanupParams(),
    fetcher: dataCenterApi.listCleanupJobs,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '模块', value: (row) => row.module },
      { header: '状态', value: (row) => getDataJobStatusLabel(row.status) },
      { header: '影响数量', value: (row) => row.affectedCount },
      { header: '清理范围', value: (row) => stringifyExportValue(row.cleanupScope) },
      { header: '审批说明', value: (row) => row.approvalNote },
      { header: '失败原因', value: (row) => row.errorMessage },
      { header: '发起人', value: (row) => getUserDisplayName(row.createdBy) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportDuplicateJobs() {
  await exportDataCenterRows({
    filenamePrefix: 'data-duplicate-merge-jobs',
    label: '重复合并任务',
    params: buildDuplicateParams(),
    fetcher: dataCenterApi.listDuplicateMergeJobs,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '模块', value: (row) => row.module },
      { header: '状态', value: (row) => getDataJobStatusLabel(row.status) },
      { header: '主对象 ID', value: (row) => row.primaryObjectId },
      { header: '重复对象 ID', value: (row) => row.duplicateObjectIds.join(', ') },
      { header: '重复对象数', value: (row) => row.duplicateObjectIds.length },
      { header: '影响数量', value: (row) => row.affectedCount },
      { header: '匹配规则', value: (row) => stringifyExportValue(row.matchRule) },
      { header: '审批说明', value: (row) => row.approvalNote },
      { header: '失败原因', value: (row) => row.errorMessage },
      { header: '发起人', value: (row) => getUserDisplayName(row.createdBy) },
      { header: '完成时间', value: (row) => formatDate(row.finishedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportDictionaries() {
  await exportDataCenterRows({
    filenamePrefix: 'data-dictionaries',
    label: '数据字典',
    params: buildDictionaryParams(),
    fetcher: dataCenterApi.listDictionaries,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: '分组', value: (row) => row.group },
      { header: '编码', value: (row) => row.code },
      { header: '名称', value: (row) => row.label },
      { header: '值', value: (row) => row.value },
      { header: '排序', value: (row) => row.sortOrder },
      { header: '状态', value: (row) => getDictionaryStatusLabel(row.status) },
      { header: '备注', value: (row) => row.remark },
      { header: '更新人', value: (row) => getUserDisplayName(row.updatedBy) },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportParameters() {
  await exportDataCenterRows({
    filenamePrefix: 'data-system-parameters',
    label: '系统参数',
    params: buildParameterParams(),
    fetcher: dataCenterApi.listSystemParameters,
    columns: [
      { header: 'ID', value: (row) => row.id },
      { header: 'Key', value: (row) => row.key },
      { header: '分组', value: (row) => row.group },
      { header: '值', value: (row) => stringifyExportValue(row.value) },
      { header: '备注', value: (row) => row.remark },
      { header: '更新人', value: (row) => getUserDisplayName(row.updatedBy) },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) }
    ]
  });
}

async function exportDataCenterRows<
  TItem,
  TParams extends { page: number; pageSize: number }
>(config: {
  filenamePrefix: string;
  label: string;
  params: TParams;
  fetcher: (params: TParams) => Promise<PageResult<TItem>>;
  columns: Array<CsvColumn<TItem>>;
}) {
  saving.value = true;
  try {
    const rows = await fetchAllDataCenterRows(config.params, config.fetcher);
    const count = exportRowsToCsv(config.filenamePrefix, config.columns, rows);
    ElMessage.success(`已导出${config.label} ${count} 条`);
  } finally {
    saving.value = false;
  }
}

async function fetchAllDataCenterRows<TItem, TParams extends { page: number; pageSize: number }>(
  params: TParams,
  fetcher: (params: TParams) => Promise<PageResult<TItem>>
) {
  const rows: TItem[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const result = await fetcher({ ...params, page, pageSize } as TParams);
    rows.push(...result.items);

    if (rows.length >= result.total || result.items.length === 0) {
      return rows;
    }

    page += 1;
  }
}

function getDataJobStatusLabel(status: DataJobStatus) {
  return jobStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function getDictionaryStatusLabel(status: DataDictionaryStatus) {
  return dictionaryStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function getUserDisplayName(
  user?: { displayName?: string | null; username?: string | null } | null
) {
  return user?.displayName || user?.username || '-';
}

function getBackupJobSummary(row: RestoreJob) {
  if (row.backupJob?.storagePath) return row.backupJob.storagePath;
  if (row.backupJob?.id) return row.backupJob.id;
  return row.backupJobId ?? '-';
}

function stringifyExportValue(value?: Record<string, unknown> | null) {
  if (!value) return '';
  return JSON.stringify(value);
}

async function showDownload(row: DataExportJob) {
  const response = await dataCenterApi.downloadExportJob(row.id);
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = row.filePath || `data-export-${row.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  ElMessage.success('导出文件开始下载');
}

async function downloadImportErrorReport(row: DataImportJob) {
  const response = await dataCenterApi.downloadImportErrorReport(row.id);
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = row.errorReport || `import-errors-${row.id}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  ElMessage.success('错误报告开始下载');
}

async function restoreRecycle(id: string) {
  await dataCenterApi.restoreRecycleBinRecord(id);
  ElMessage.success('回收站记录已标记恢复');
  await loadRecycleBin();
  await loadOverview();
}

async function purgeRecycle(id: string) {
  await ElMessageBox.confirm('清理后只会删除回收站记录，不会恢复业务数据，确认继续？', '清理确认', {
    type: 'warning'
  });
  await dataCenterApi.purgeRecycleBinRecord(id);
  ElMessage.success('回收站记录已清理');
  await loadRecycleBin();
  await loadOverview();
}

function getInitialTab() {
  const key = String(route.name ?? '');
  if (key === 'data-imports') return 'imports';
  if (key === 'data-exports') return 'exports';
  if (key === 'data-dictionaries') return 'overview';
  if (key === 'recycle-bin') return 'recycle';
  return 'overview';
}

function getBackupTypeLabel(type: string) {
  if (!isDataBackupType(type)) {
    return type;
  }
  return getDataBackupTypeLabel(type, backupTypeDictionaries.value);
}

function getImportModuleLabel(module: string) {
  return getDataImportModuleLabel(module, importModuleDictionaries.value);
}

function getExportModuleLabel(module: string) {
  return getDataExportModuleLabel(module, exportModuleDictionaries.value);
}

function getDefaultBackupType() {
  return backupTypeOptions.value[0]?.value ?? 'database';
}

function getDefaultImportModule() {
  return importModuleOptions.value[0]?.value ?? 'customers';
}

function getDefaultExportModule() {
  return exportModuleOptions.value[0]?.value ?? 'customers';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function getRestoreConfirmText(id: string) {
  return `CONFIRM_RESTORE_DRILL ${id.slice(0, 8)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatFileSize(value?: string | null) {
  if (!value) return '-';
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getTableSize(density: TableDensity) {
  if (density === 'compact') return 'small';
  if (density === 'loose') return 'large';
  return 'default';
}

function normalizeColumns(columns: unknown, options: Array<{ value: string }>) {
  const allowed = new Set(options.map((option) => option.value));
  const parsed = Array.isArray(columns)
    ? columns.filter((column): column is string => typeof column === 'string')
    : [];
  return parsed.length
    ? parsed.filter((column) => allowed.has(column))
    : options.map((option) => option.value);
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

function mapSortField(prop: string | undefined, aliases: Record<string, string>) {
  if (!prop) return undefined;
  return aliases[prop] ?? prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isDataJobStatus(value: unknown): value is DataJobStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'success' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function isBackupJobType(value: unknown): value is BackupJobType {
  return typeof value === 'string' && isDataBackupType(value);
}

function isDictionaryStatus(value: unknown): value is DataDictionaryStatus {
  return value === 'active' || value === 'disabled';
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
</script>

<style scoped>
.system-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.system-compact-list-panel .inline-actions {
  max-width: min(680px, 100%);
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (max-width: 840px) {
  .system-compact-list-panel .inline-actions {
    justify-content: flex-start;
  }

  .system-compact-list-panel :deep(.el-tabs__nav-wrap),
  .system-compact-list-panel :deep(.el-tabs__nav-scroll) {
    width: 100%;
    max-width: 100%;
    overflow: visible;
  }

  .system-compact-list-panel :deep(.el-tabs__nav) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    width: 100%;
    min-width: 0;
    transform: none !important;
    white-space: normal;
  }

  .system-compact-list-panel :deep(.el-tabs__item) {
    height: 32px;
    padding: 0 10px;
    border-radius: 10px;
    line-height: 32px;
  }

  .system-compact-list-panel :deep(.el-tabs__active-bar),
  .system-compact-list-panel :deep(.el-tabs__nav-next),
  .system-compact-list-panel :deep(.el-tabs__nav-prev) {
    display: none;
  }
}
</style>
