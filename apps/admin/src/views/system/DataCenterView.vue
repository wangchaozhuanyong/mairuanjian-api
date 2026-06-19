<template>
  <PageScaffold
    title="数据中心"
    group="系统管理"
    phase="Phase 11"
    description="集中管理备份、恢复、导入、导出、回收站、数据清理、重复合并、数据字典和系统参数。"
  >
    <template #actions>
      <el-button @click="refreshCurrentTab">刷新</el-button>
      <el-button v-if="activeTab === 'backups'" type="primary" @click="openBackupDialog"
        >创建备份</el-button
      >
      <el-button v-if="activeTab === 'restores'" type="primary" @click="openRestoreDialog"
        >创建恢复</el-button
      >
      <el-button v-if="activeTab === 'imports'" type="primary" @click="openImportDialog"
        >新建导入</el-button
      >
      <el-button v-if="activeTab === 'exports'" type="primary" @click="openExportDialog"
        >新建导出</el-button
      >
      <el-button v-if="activeTab === 'cleanup'" type="primary" @click="openCleanupDialog"
        >新建清理</el-button
      >
      <el-button v-if="activeTab === 'duplicates'" type="primary" @click="openDuplicateDialog"
        >新建合并</el-button
      >
      <el-button v-if="activeTab === 'dictionaries'" type="primary" @click="openDictionaryDialog"
        >新增字典</el-button
      >
      <el-button v-if="activeTab === 'parameters'" type="primary" @click="openParameterDialog"
        >保存参数</el-button
      >
    </template>

    <div class="metric-grid metric-grid--five">
      <MetricCard
        label="失败备份"
        :value="overview?.failedBackupCount ?? '-'"
        hint="需要人工处理"
        tone="red"
      />
      <MetricCard
        label="导入队列"
        :value="overview?.runningImportCount ?? '-'"
        hint="待处理或运行中"
        tone="orange"
      />
      <MetricCard
        label="导出队列"
        :value="overview?.runningExportCount ?? '-'"
        hint="待处理或运行中"
        tone="blue"
      />
      <MetricCard
        label="回收站"
        :value="overview?.recycleBinCount ?? '-'"
        hint="未恢复记录"
        tone="purple"
      />
      <MetricCard
        label="数据字典"
        :value="overview?.dictionaryCount ?? '-'"
        hint="启用中的字典项"
        tone="green"
      />
    </div>

    <section class="content-panel">
      <el-tabs v-model="activeTab" @tab-change="refreshCurrentTab">
        <el-tab-pane label="总览" name="overview">
          <div class="overview-grid">
            <div>
              <h3>最近备份</h3>
              <el-table :data="overview?.recentBackupJobs ?? []" row-key="id">
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
            </div>
            <div>
              <h3>最近导入</h3>
              <el-table :data="overview?.recentImportJobs ?? []" row-key="id">
                <el-table-column label="模块" width="120" prop="module" />
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
            </div>
            <div>
              <h3>最近导出</h3>
              <el-table :data="overview?.recentExportJobs ?? []" row-key="id">
                <el-table-column label="模块" width="120" prop="module" />
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
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="备份任务" name="backups">
          <TableToolbar
            v-model:keyword="backupQuery.keyword"
            v-model:status="backupQuery.status"
            v-model:density="backupDensity"
            v-model:visible-columns="backupVisibleColumns"
            v-model:saved-view-id="backupSavedViewId"
            :column-options="backupColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="backupSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索路径、备注、失败原因"
            @search="handleBackupSearch"
            @refresh="loadBackups"
            @clear-filters="clearBackupFilters"
            @save-view="saveBackupTableView"
            @apply-view="applyBackupSavedView"
            @export="showExportMessage"
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
            :data="backups"
            :size="backupTableSize"
            row-key="id"
            empty-text="暂无备份任务"
            @sort-change="handleBackupSortChange"
          >
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
                <el-button text type="primary" @click="executeBackup(row)">执行备份</el-button>
                <el-button text @click="markBackup(row, 'running')">运行</el-button>
                <el-button text type="success" @click="markBackup(row, 'success')">成功</el-button>
                <el-button text type="danger" @click="markBackup(row, 'failed')">失败</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="backupQuery.page"
            v-model:page-size="backupQuery.pageSize"
            :total="backupTotal"
            @change="loadBackups"
          />
        </el-tab-pane>

        <el-tab-pane label="恢复任务" name="restores">
          <TableToolbar
            v-model:keyword="restoreQuery.keyword"
            v-model:status="restoreQuery.status"
            v-model:density="restoreDensity"
            v-model:visible-columns="restoreVisibleColumns"
            v-model:saved-view-id="restoreSavedViewId"
            :column-options="restoreColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="restoreSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索恢复范围、审批说明"
            @search="handleRestoreSearch"
            @refresh="loadRestores"
            @clear-filters="clearRestoreFilters"
            @save-view="saveRestoreTableView"
            @apply-view="applyRestoreSavedView"
            @export="showExportMessage"
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
            :data="restores"
            :size="restoreTableSize"
            row-key="id"
            empty-text="暂无恢复任务"
            @sort-change="handleRestoreSortChange"
          >
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
                <el-button text type="primary" @click="executeRestore(row)">恢复演练</el-button>
                <el-button text @click="markRestore(row.id, 'running')">运行</el-button>
                <el-button text type="success" @click="markRestore(row.id, 'success')"
                  >成功</el-button
                >
                <el-button text type="danger" @click="markRestore(row.id, 'failed')"
                  >失败</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="restoreQuery.page"
            v-model:page-size="restoreQuery.pageSize"
            :total="restoreTotal"
            @change="loadRestores"
          />
        </el-tab-pane>

        <el-tab-pane label="导入任务" name="imports">
          <TableToolbar
            v-model:keyword="importQuery.keyword"
            v-model:status="importQuery.status"
            v-model:density="importDensity"
            v-model:visible-columns="importVisibleColumns"
            v-model:saved-view-id="importSavedViewId"
            :column-options="importColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="importSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、文件或错误报告"
            @search="handleImportSearch"
            @refresh="loadImports"
            @clear-filters="clearImportFilters"
            @save-view="saveImportTableView"
            @apply-view="applyImportSavedView"
            @export="showExportMessage"
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
            :data="imports"
            :size="importTableSize"
            row-key="id"
            empty-text="暂无导入任务"
            @sort-change="handleImportSortChange"
          >
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
                <el-button
                  text
                  type="primary"
                  :disabled="row.status === 'running'"
                  @click="executeImport(row)"
                  >运行</el-button
                >
                <el-button text type="success" @click="markImport(row.id, 'success')"
                  >成功</el-button
                >
                <el-button text type="danger" @click="markImport(row.id, 'failed')">失败</el-button>
                <el-button text :disabled="!row.errorReport" @click="downloadImportErrorReport(row)"
                  >错误报告</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="importQuery.page"
            v-model:page-size="importQuery.pageSize"
            :total="importTotal"
            @change="loadImports"
          />
        </el-tab-pane>

        <el-tab-pane label="导出任务" name="exports">
          <TableToolbar
            v-model:keyword="exportQuery.keyword"
            v-model:status="exportQuery.status"
            v-model:density="exportDensity"
            v-model:visible-columns="exportVisibleColumns"
            v-model:saved-view-id="exportSavedViewId"
            :column-options="exportColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="exportSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、文件、失败原因"
            @search="handleExportSearch"
            @refresh="loadExports"
            @clear-filters="clearExportFilters"
            @save-view="saveExportTableView"
            @apply-view="applyExportSavedView"
            @export="showExportMessage"
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
            :data="exports"
            :size="exportTableSize"
            row-key="id"
            empty-text="暂无导出任务"
            @sort-change="handleExportSortChange"
          >
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
                <el-tag
                  :type="row.containsSensitive ? 'warning' : 'info'"
                  size="small"
                  effect="light"
                >
                  {{ row.containsSensitive ? '是' : '否' }}
                </el-tag>
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
                <el-button
                  text
                  type="primary"
                  :disabled="row.status === 'running'"
                  @click="executeExport(row)"
                  >运行</el-button
                >
                <el-button text type="success" @click="markExport(row.id, 'success')"
                  >成功</el-button
                >
                <el-button text type="danger" @click="markExport(row.id, 'failed')">失败</el-button>
                <el-button text :disabled="row.status !== 'success'" @click="showDownload(row)"
                  >下载</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="exportQuery.page"
            v-model:page-size="exportQuery.pageSize"
            :total="exportTotal"
            @change="loadExports"
          />
        </el-tab-pane>

        <el-tab-pane label="回收站" name="recycle">
          <TableToolbar
            v-model:keyword="recycleQuery.keyword"
            v-model:status="recycleQuery.restored"
            v-model:density="recycleDensity"
            v-model:visible-columns="recycleVisibleColumns"
            v-model:saved-view-id="recycleSavedViewId"
            :column-options="recycleColumnOptions"
            :status-options="recycleStatusOptions"
            :saved-views="recycleSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、对象、名称"
            @search="handleRecycleSearch"
            @refresh="loadRecycleBin"
            @clear-filters="clearRecycleFilters"
            @save-view="saveRecycleTableView"
            @apply-view="applyRecycleSavedView"
            @export="showExportMessage"
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
            :data="recycleRecords"
            :size="recycleTableSize"
            row-key="id"
            empty-text="暂无回收站记录"
            @sort-change="handleRecycleSortChange"
          >
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
                <el-tag :type="row.restoredAt ? 'success' : 'warning'" size="small" effect="light">
                  {{ row.restoredAt ? '已恢复' : '未恢复' }}
                </el-tag>
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
                <el-button
                  text
                  type="primary"
                  :disabled="Boolean(row.restoredAt)"
                  @click="restoreRecycle(row.id)"
                  >恢复</el-button
                >
                <el-button text type="danger" @click="purgeRecycle(row.id)">清理</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="recycleQuery.page"
            v-model:page-size="recycleQuery.pageSize"
            :total="recycleTotal"
            @change="loadRecycleBin"
          />
        </el-tab-pane>

        <el-tab-pane label="数据清理" name="cleanup">
          <TableToolbar
            v-model:keyword="cleanupQuery.keyword"
            v-model:status="cleanupQuery.status"
            v-model:density="cleanupDensity"
            v-model:visible-columns="cleanupVisibleColumns"
            v-model:saved-view-id="cleanupSavedViewId"
            :column-options="cleanupColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="cleanupSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、审批说明或失败原因"
            @search="handleCleanupSearch"
            @refresh="loadCleanupJobs"
            @clear-filters="clearCleanupFilters"
            @save-view="saveCleanupTableView"
            @apply-view="applyCleanupSavedView"
            @export="showExportMessage"
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
            :data="cleanupJobs"
            :size="cleanupTableSize"
            row-key="id"
            empty-text="暂无数据清理任务"
            @sort-change="handleCleanupSortChange"
          >
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
                <el-button text type="primary" @click="markCleanup(row.id, 'running')"
                  >运行</el-button
                >
                <el-button text type="success" @click="markCleanup(row.id, 'success')"
                  >成功</el-button
                >
                <el-button text type="danger" @click="markCleanup(row.id, 'failed')"
                  >失败</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="cleanupQuery.page"
            v-model:page-size="cleanupQuery.pageSize"
            :total="cleanupTotal"
            @change="loadCleanupJobs"
          />
        </el-tab-pane>

        <el-tab-pane label="重复合并" name="duplicates">
          <TableToolbar
            v-model:keyword="duplicateQuery.keyword"
            v-model:status="duplicateQuery.status"
            v-model:density="duplicateDensity"
            v-model:visible-columns="duplicateVisibleColumns"
            v-model:saved-view-id="duplicateSavedViewId"
            :column-options="duplicateColumnOptions"
            :status-options="jobStatusOptions"
            :saved-views="duplicateSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、审批说明或失败原因"
            @search="handleDuplicateSearch"
            @refresh="loadDuplicateJobs"
            @clear-filters="clearDuplicateFilters"
            @save-view="saveDuplicateTableView"
            @apply-view="applyDuplicateSavedView"
            @export="showExportMessage"
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
            :data="duplicateJobs"
            :size="duplicateTableSize"
            row-key="id"
            empty-text="暂无重复合并任务"
            @sort-change="handleDuplicateSortChange"
          >
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
                <el-button text type="primary" @click="markDuplicate(row.id, 'running')"
                  >运行</el-button
                >
                <el-button text type="success" @click="markDuplicate(row.id, 'success')"
                  >成功</el-button
                >
                <el-button text type="danger" @click="markDuplicate(row.id, 'failed')"
                  >失败</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="duplicateQuery.page"
            v-model:page-size="duplicateQuery.pageSize"
            :total="duplicateTotal"
            @change="loadDuplicateJobs"
          />
        </el-tab-pane>

        <el-tab-pane label="数据字典" name="dictionaries">
          <TableToolbar
            v-model:keyword="dictionaryQuery.keyword"
            v-model:status="dictionaryQuery.status"
            v-model:density="dictionaryDensity"
            v-model:visible-columns="dictionaryVisibleColumns"
            v-model:saved-view-id="dictionarySavedViewId"
            :column-options="dictionaryColumnOptions"
            :status-options="dictionaryStatusOptions"
            :saved-views="dictionarySavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索分组、编码、名称"
            @search="handleDictionarySearch"
            @refresh="loadDictionaries"
            @clear-filters="clearDictionaryFilters"
            @save-view="saveDictionaryTableView"
            @apply-view="applyDictionarySavedView"
            @export="showExportMessage"
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
            :data="dictionaries"
            :size="dictionaryTableSize"
            row-key="id"
            empty-text="暂无数据字典"
            @sort-change="handleDictionarySortChange"
          >
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
                <el-tag
                  :type="row.status === 'active' ? 'success' : 'info'"
                  size="small"
                  effect="light"
                >
                  {{ row.status === 'active' ? '启用' : '停用' }}
                </el-tag>
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
                <el-button text type="primary" @click="openDictionaryDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="dictionaryQuery.page"
            v-model:page-size="dictionaryQuery.pageSize"
            :total="dictionaryTotal"
            @change="loadDictionaries"
          />
        </el-tab-pane>

        <el-tab-pane label="系统参数" name="parameters">
          <TableToolbar
            v-model:keyword="parameterQuery.keyword"
            v-model:density="parameterDensity"
            v-model:visible-columns="parameterVisibleColumns"
            v-model:saved-view-id="parameterSavedViewId"
            :column-options="parameterColumnOptions"
            :saved-views="parameterSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            :show-status="false"
            placeholder="搜索 key、分组、备注"
            @search="handleParameterSearch"
            @refresh="loadParameters"
            @clear-filters="clearParameterFilters"
            @save-view="saveParameterTableView"
            @apply-view="applyParameterSavedView"
            @export="showExportMessage"
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
            :data="parameters"
            :size="parameterTableSize"
            row-key="id"
            empty-text="暂无系统参数"
            @sort-change="handleParameterSortChange"
          >
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
                <el-button text type="primary" @click="openParameterDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="parameterQuery.page"
            v-model:page-size="parameterQuery.pageSize"
            :total="parameterTotal"
            @change="loadParameters"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="backupDialogVisible" title="创建备份任务" width="520px">
      <el-form label-width="100px">
        <el-form-item label="备份类型" required>
          <el-select v-model="backupForm.jobType">
            <el-option label="数据库" value="database" />
            <el-option label="文件" value="files" />
            <el-option label="配置" value="config" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="backupForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="backupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createBackup">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="restoreDialogVisible" title="创建恢复任务" width="560px">
      <el-form label-width="110px">
        <el-form-item label="备份任务 ID"
          ><el-input v-model="restoreForm.backupJobId"
        /></el-form-item>
        <el-form-item label="恢复范围" required
          ><el-input v-model="restoreForm.restoreScope"
        /></el-form-item>
        <el-form-item label="审批说明">
          <el-input v-model="restoreForm.approvalNote" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="restoreDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createRestore">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="新建导入任务" width="560px">
      <el-form label-width="100px">
        <el-form-item label="模块" required>
          <el-select v-model="importForm.module" filterable>
            <el-option
              v-for="option in importModuleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文件名"><el-input v-model="importForm.filePath" /></el-form-item>
        <el-form-item label="备注"
          ><el-input v-model="importForm.remark" type="textarea" :rows="3"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createImport">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exportDialogVisible" title="新建导出任务" width="560px">
      <el-form label-width="110px">
        <el-form-item label="模块" required>
          <el-select v-model="exportForm.module" filterable>
            <el-option
              v-for="option in exportModuleOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="字段列表">
          <el-input v-model="exportForm.fieldsText" placeholder="用英文逗号分隔" />
        </el-form-item>
        <el-form-item label="包含敏感字段"
          ><el-switch v-model="exportForm.containsSensitive"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createExport">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="cleanupDialogVisible" title="新建数据清理任务" width="560px">
      <el-form label-width="100px">
        <el-form-item label="模块" required><el-input v-model="cleanupForm.module" /></el-form-item>
        <el-form-item label="审批说明">
          <el-input v-model="cleanupForm.approvalNote" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cleanupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createCleanup">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="duplicateDialogVisible" title="新建重复数据合并任务" width="600px">
      <el-form label-width="120px">
        <el-form-item label="模块" required
          ><el-input v-model="duplicateForm.module"
        /></el-form-item>
        <el-form-item label="主对象 ID"
          ><el-input v-model="duplicateForm.primaryObjectId"
        /></el-form-item>
        <el-form-item label="重复对象 ID">
          <el-input v-model="duplicateForm.duplicateObjectIdsText" placeholder="用英文逗号分隔" />
        </el-form-item>
        <el-form-item label="审批说明">
          <el-input v-model="duplicateForm.approvalNote" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="duplicateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="createDuplicate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictionaryDialogVisible"
      :title="editingDictionary ? '编辑数据字典' : '新增数据字典'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="分组" required
          ><el-input v-model="dictionaryForm.group" :disabled="Boolean(editingDictionary)"
        /></el-form-item>
        <el-form-item label="编码" required
          ><el-input v-model="dictionaryForm.code" :disabled="Boolean(editingDictionary)"
        /></el-form-item>
        <el-form-item label="名称" required
          ><el-input v-model="dictionaryForm.label"
        /></el-form-item>
        <el-form-item label="值"><el-input v-model="dictionaryForm.value" /></el-form-item>
        <el-form-item label="排序"
          ><el-input-number v-model="dictionaryForm.sortOrder" :min="0"
        /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="dictionaryForm.status">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dictionaryForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictionaryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDictionary">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="parameterDialogVisible" title="保存系统参数" width="620px">
      <el-form label-width="100px">
        <el-form-item label="Key" required
          ><el-input v-model="parameterForm.key" :disabled="Boolean(editingParameter)"
        /></el-form-item>
        <el-form-item label="分组"><el-input v-model="parameterForm.group" /></el-form-item>
        <el-form-item label="值 JSON" required>
          <el-input v-model="parameterForm.valueText" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="parameterForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="parameterDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveParameter">保存</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { dataCenterApi, userTableViewsApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
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
  RecycleBinRecord,
  RestoreJob,
  SystemParameter,
  TableDensity,
  UserTableView
} from '@/types/system';

const route = useRoute();
const activeTab = ref(getInitialTab());
const overview = ref<DataCenterOverview | null>(null);
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
const backupTypeOptions = [
  { label: '数据库', value: 'database' },
  { label: '文件', value: 'files' },
  { label: '配置', value: 'config' }
];
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
const importModuleOptions = [
  { label: '客户', value: 'customers' },
  { label: '来源平台', value: 'source_platforms' }
];
const exportColumnOptions = [
  { label: '模块', value: 'module', required: true },
  { label: '状态', value: 'status' },
  { label: '字段', value: 'fields' },
  { label: '敏感', value: 'containsSensitive' },
  { label: '下载过期', value: 'downloadExpiresAt' },
  { label: '创建时间', value: 'createdAt' }
];
const exportModuleOptions = [
  { label: '客户', value: 'customers' },
  { label: '来源平台', value: 'source_platforms' },
  { label: 'Apple ID 账号概览', value: 'apple_accounts' },
  { label: 'Apple ID 订单', value: 'apple_orders' },
  { label: '兑换码库存概览', value: 'redeem_codes' },
  { label: '兑换码订单', value: 'code_orders' }
];
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

onMounted(() => {
  void refreshCurrentTab();
});

watch(
  () => route.name,
  () => {
    activeTab.value = getInitialTab();
    void refreshCurrentTab();
  }
);

async function refreshCurrentTab() {
  await loadOverview();
  if (activeTab.value === 'backups') await loadBackupsWithViews();
  if (activeTab.value === 'restores') await loadRestoresWithViews();
  if (activeTab.value === 'imports') await loadImportsWithViews();
  if (activeTab.value === 'exports') await loadExportsWithViews();
  if (activeTab.value === 'recycle') await loadRecycleBinWithViews();
  if (activeTab.value === 'cleanup') await loadCleanupJobsWithViews();
  if (activeTab.value === 'duplicates') await loadDuplicateJobsWithViews();
  if (activeTab.value === 'dictionaries') await loadDictionariesWithViews();
  if (activeTab.value === 'parameters') await loadParametersWithViews();
}

async function loadOverview() {
  overview.value = await dataCenterApi.overview();
}

async function loadBackups() {
  backupLoading.value = true;
  try {
    const result = await dataCenterApi.listBackupJobs({
      ...backupQuery,
      sortBy: mapSortField(backupSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(backupSortConfig.value.order)
    });
    backups.value = result.items;
    backupTotal.value = result.total;
  } finally {
    backupLoading.value = false;
  }
}

async function loadBackupsWithViews() {
  await ensureBackupTableViews();
  await loadBackups();
}

async function loadRestores() {
  restoreLoading.value = true;
  try {
    const result = await dataCenterApi.listRestoreJobs({
      ...restoreQuery,
      sortBy: mapSortField(restoreSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(restoreSortConfig.value.order)
    });
    restores.value = result.items;
    restoreTotal.value = result.total;
  } finally {
    restoreLoading.value = false;
  }
}

async function loadRestoresWithViews() {
  await ensureRestoreTableViews();
  await loadRestores();
}

async function loadImports() {
  importLoading.value = true;
  try {
    const result = await dataCenterApi.listImportJobs({
      ...importQuery,
      sortBy: mapSortField(importSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(importSortConfig.value.order)
    });
    imports.value = result.items;
    importTotal.value = result.total;
  } finally {
    importLoading.value = false;
  }
}

async function loadImportsWithViews() {
  await ensureImportTableViews();
  await loadImports();
}

async function loadExports() {
  exportLoading.value = true;
  try {
    const result = await dataCenterApi.listExportJobs({
      ...exportQuery,
      sortBy: mapSortField(exportSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(exportSortConfig.value.order)
    });
    exports.value = result.items;
    exportTotal.value = result.total;
  } finally {
    exportLoading.value = false;
  }
}

async function loadExportsWithViews() {
  await ensureExportTableViews();
  await loadExports();
}

async function loadRecycleBinWithViews() {
  await ensureRecycleTableViews();
  await loadRecycleBin();
}

async function loadCleanupJobsWithViews() {
  await ensureCleanupTableViews();
  await loadCleanupJobs();
}

async function loadDuplicateJobsWithViews() {
  await ensureDuplicateTableViews();
  await loadDuplicateJobs();
}

async function loadDictionariesWithViews() {
  await ensureDictionaryTableViews();
  await loadDictionaries();
}

async function loadParametersWithViews() {
  await ensureParameterTableViews();
  await loadParameters();
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
  backupDensity.value = view.density;
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
  restoreDensity.value = view.density;
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
  importDensity.value = view.density;
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
  exportDensity.value = view.density;
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
  recycleDensity.value = view.density;
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
  cleanupDensity.value = view.density;
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
  duplicateDensity.value = view.density;
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
  dictionaryDensity.value = view.density;
  dictionaryVisibleColumns.value = normalizeColumns(view.columns, dictionaryColumnOptions);
  dictionarySortConfig.value = parseSortConfig(view.sortConfig);
  dictionarySavedViewId.value = view.id;
}

function applyParameterView(view: UserTableView) {
  const filters = view.filters;
  parameterQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  parameterQuery.group = typeof filters.group === 'string' ? filters.group : '';
  parameterQuery.pageSize = view.pageSize;
  parameterDensity.value = view.density;
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

async function loadRecycleBin() {
  recycleLoading.value = true;
  try {
    const result = await dataCenterApi.listRecycleBin({
      ...recycleQuery,
      sortBy: mapSortField(recycleSortConfig.value.prop, {
        restoredStatus: 'restoredAt'
      }),
      sortOrder: mapSortOrder(recycleSortConfig.value.order)
    });
    recycleRecords.value = result.items;
    recycleTotal.value = result.total;
  } finally {
    recycleLoading.value = false;
  }
}

async function loadCleanupJobs() {
  cleanupLoading.value = true;
  try {
    const result = await dataCenterApi.listCleanupJobs({
      ...cleanupQuery,
      sortBy: mapSortField(cleanupSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(cleanupSortConfig.value.order)
    });
    cleanupJobs.value = result.items;
    cleanupTotal.value = result.total;
  } finally {
    cleanupLoading.value = false;
  }
}

async function loadDuplicateJobs() {
  duplicateLoading.value = true;
  try {
    const result = await dataCenterApi.listDuplicateMergeJobs({
      ...duplicateQuery,
      sortBy: mapSortField(duplicateSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(duplicateSortConfig.value.order)
    });
    duplicateJobs.value = result.items;
    duplicateTotal.value = result.total;
  } finally {
    duplicateLoading.value = false;
  }
}

async function loadDictionaries() {
  dictionaryLoading.value = true;
  try {
    const result = await dataCenterApi.listDictionaries({
      ...dictionaryQuery,
      sortBy: mapSortField(dictionarySortConfig.value.prop, {}),
      sortOrder: mapSortOrder(dictionarySortConfig.value.order)
    });
    dictionaries.value = result.items;
    dictionaryTotal.value = result.total;
  } finally {
    dictionaryLoading.value = false;
  }
}

async function loadParameters() {
  parameterLoading.value = true;
  try {
    const result = await dataCenterApi.listSystemParameters({
      ...parameterQuery,
      sortBy: mapSortField(parameterSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(parameterSortConfig.value.order)
    });
    parameters.value = result.items;
    parameterTotal.value = result.total;
  } finally {
    parameterLoading.value = false;
  }
}

function openBackupDialog() {
  Object.assign(backupForm, { jobType: 'database', remark: '' });
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
  Object.assign(importForm, { module: 'customers', filePath: '', remark: '' });
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
  Object.assign(exportForm, { module: 'customers', fieldsText: '', containsSensitive: false });
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
  if (key === 'data-dictionaries') return 'dictionaries';
  if (key === 'recycle-bin') return 'recycle';
  return 'overview';
}

function getBackupTypeLabel(type: string) {
  return { database: '数据库', files: '文件', config: '配置' }[type] ?? type;
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
  return value === 'database' || value === 'files' || value === 'config';
}

function isDictionaryStatus(value: unknown): value is DataDictionaryStatus {
  return value === 'active' || value === 'disabled';
}

function showExportMessage() {
  ElMessage.info('数据中心导出会统一创建导出任务，请在导出任务中跟踪下载');
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
</script>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  components: {
    JobStatusTag: {
      props: {
        status: { type: String, required: true }
      },
      methods: {
        getStatusLabel(status: string) {
          return (
            {
              pending: '待处理',
              running: '运行中',
              success: '成功',
              failed: '失败',
              cancelled: '已取消'
            }[status] ?? status
          );
        },
        getStatusType(status: string) {
          if (status === 'success') return 'success';
          if (status === 'failed') return 'danger';
          if (status === 'running') return 'primary';
          if (status === 'cancelled') return 'info';
          return 'warning';
        }
      },
      template: `
        <el-tag :type="getStatusType(status)" size="small" effect="light">
          {{ getStatusLabel(status) }}
        </el-tag>
      `
    },
    PaginationBar: {
      props: {
        page: { type: Number, required: true },
        pageSize: { type: Number, required: true },
        total: { type: Number, required: true }
      },
      emits: ['update:page', 'update:pageSize', 'change'],
      template: `
        <div class="pagination-row">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="total, sizes, prev, pager, next"
            @current-change="$emit('update:page', $event); $emit('change')"
            @size-change="$emit('update:pageSize', $event); $emit('change')"
          />
        </div>
      `
    }
  }
});
</script>

<style scoped>
.content-panel {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-color);
}

.overview-grid {
  display: grid;
  gap: 18px;
}

.overview-grid h3 {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--text-color);
}

.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.toolbar-search {
  width: min(320px, 100%);
}

.toolbar-select {
  width: 150px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.json-cell {
  display: inline-block;
  max-width: 100%;
  padding: 2px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 4px;
  background: var(--muted-bg-color);
  color: var(--text-color);
}

@media (max-width: 760px) {
  .content-panel {
    padding: 12px;
  }

  .toolbar-search,
  .toolbar-select {
    width: 100%;
  }
}
</style>
