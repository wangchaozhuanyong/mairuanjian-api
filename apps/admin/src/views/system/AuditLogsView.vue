<template>
  <PageScaffold
    title="审计日志中心"
    group="数据与审计"
    phase="Phase 14"
    description="统一查看操作日志、敏感查看日志、登录日志、导出日志、权限变更日志、自动化任务日志和平台接口日志。"
  >
    <section class="content-panel system-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="审计日志工作台"
          help="这里集中查后台发生过的事情，比如谁操作了数据、谁看了敏感资料、谁登录了系统、谁导出了文件。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>审计中心</StatusChip>
          <StatusChip tone="blue">操作 {{ operationTotal }}</StatusChip>
          <StatusChip :tone="sensitiveTotal > 0 ? 'orange' : 'green'" dot>
            {{ sensitiveTotal > 0 ? `敏感查看 ${sensitiveTotal}` : '敏感查看正常' }}
          </StatusChip>
          <StatusChip tone="green">登录 {{ loginTotal }}</StatusChip>
          <StatusChip tone="purple">平台 {{ platformTotal }}</StatusChip>
        </div>
      </div>

      <el-tabs
        v-model="activeTab"
        class="system-tabs audit-log-tabs"
        @tab-change="refreshCurrentTab"
      >
        <el-tab-pane label="操作日志" name="operation">
          <TableToolbar
            v-model:keyword="operationQuery.keyword"
            v-model:visible-columns="operationVisibleColumns"
            v-model:saved-view-id="operationSavedViewId"
            :column-options="operationColumnOptions"
            :saved-views="operationSavedViews"
            :filter-chips="operationFilterChips"
            :show-status="false"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索备注、模块、动作或对象"
            @search="handleOperationSearch"
            @refresh="() => loadOperationLogs()"
            @clear-filters="clearOperationFilters"
            @remove-filter="removeOperationFilter"
            @save-view="saveOperationTableView"
            @apply-view="applyOperationSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-input
                v-model.trim="operationQuery.module"
                class="table-toolbar__select"
                placeholder="模块"
                clearable
                @keyup.enter="handleOperationSearch"
                @clear="handleOperationSearch"
              />
              <el-input
                v-model.trim="operationQuery.action"
                class="table-toolbar__select"
                placeholder="动作"
                clearable
                @keyup.enter="handleOperationSearch"
                @clear="handleOperationSearch"
              />
            </template>
          </TableToolbar>

          <el-table
            v-loading="operationLoading"
            class="desktop-data-table"
            :data="operationLogs"
            :size="operationTableSize"
            row-key="id"
            @sort-change="handleOperationSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无操作日志</strong>
                <span>调整模块、动作或关键词后重新查询。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearOperationFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isOperationColumnVisible('createdAt')"
              prop="createdAt"
              label="时间"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column v-if="isOperationColumnVisible('user')" label="用户" min-width="140">
              <template #default="{ row }">
                {{ row.user?.displayName ?? row.user?.username ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isOperationColumnVisible('module')"
              label="模块"
              prop="module"
              min-width="120"
              sortable="custom"
            />
            <el-table-column
              v-if="isOperationColumnVisible('action')"
              label="动作"
              prop="action"
              min-width="190"
              sortable="custom"
            />
            <el-table-column
              v-if="isOperationColumnVisible('objectType')"
              label="对象"
              prop="objectType"
              min-width="130"
              sortable="custom"
            />
            <el-table-column
              v-if="isOperationColumnVisible('remark')"
              label="备注"
              prop="remark"
              min-width="260"
              show-overflow-tooltip
            />
          </el-table>
          <div v-if="operationLogs.length" class="mobile-record-list" aria-label="操作日志移动列表">
            <article v-for="log in operationLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.action }}</strong>
                  <span>{{ formatDate(log.createdAt) }}</span>
                </div>
                <StatusChip tone="blue">{{ log.module }}</StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>用户</span>
                  <strong>{{ log.user?.displayName ?? log.user?.username ?? '-' }}</strong>
                </div>
                <div>
                  <span>对象</span>
                  <strong>{{ log.objectType || '-' }}</strong>
                </div>
                <div>
                  <span>IP</span>
                  <strong>{{ log.ip || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>备注</span>
                  <strong>{{ log.remark || '-' }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无操作日志</strong>
              <span>调整模块、动作或关键词后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="operationQuery.page"
            v-model:page-size="operationQuery.pageSize"
            :total="operationTotal"
            @change="() => loadOperationLogs()"
          />
        </el-tab-pane>

        <el-tab-pane label="敏感查看日志" name="sensitive">
          <TableToolbar
            v-model:keyword="sensitiveQuery.keyword"
            v-model:status="sensitiveQuery.approved"
            v-model:visible-columns="sensitiveVisibleColumns"
            v-model:saved-view-id="sensitiveSavedViewId"
            :column-options="sensitiveColumnOptions"
            :status-options="sensitiveApprovedOptions"
            :saved-views="sensitiveSavedViews"
            :filter-chips="sensitiveFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、字段、对象或原因"
            @search="handleSensitiveSearch"
            @refresh="() => loadSensitiveLogs()"
            @clear-filters="clearSensitiveFilters"
            @remove-filter="removeSensitiveFilter"
            @save-view="saveSensitiveTableView"
            @apply-view="applySensitiveSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-input
                v-model.trim="sensitiveQuery.module"
                class="table-toolbar__select"
                placeholder="模块"
                clearable
                @keyup.enter="handleSensitiveSearch"
                @clear="handleSensitiveSearch"
              />
              <el-input
                v-model.trim="sensitiveQuery.fieldName"
                class="table-toolbar__select"
                placeholder="字段"
                clearable
                @keyup.enter="handleSensitiveSearch"
                @clear="handleSensitiveSearch"
              />
            </template>
          </TableToolbar>

          <el-table
            v-loading="sensitiveLoading"
            class="desktop-data-table"
            :data="sensitiveLogs"
            :size="sensitiveTableSize"
            row-key="id"
            @sort-change="handleSensitiveSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无敏感查看日志</strong>
                <span>调整模块、字段或审批条件后重新查询。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearSensitiveFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isSensitiveColumnVisible('createdAt')"
              prop="createdAt"
              label="时间"
              width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column v-if="isSensitiveColumnVisible('user')" label="用户" width="140">
              <template #default="{ row }">{{
                row.user?.displayName ?? row.user?.username ?? '-'
              }}</template>
            </el-table-column>
            <el-table-column
              v-if="isSensitiveColumnVisible('module')"
              label="模块"
              width="120"
              prop="module"
              sortable="custom"
            />
            <el-table-column
              v-if="isSensitiveColumnVisible('fieldName')"
              label="字段"
              min-width="160"
              prop="fieldName"
              sortable="custom"
            />
            <el-table-column
              v-if="isSensitiveColumnVisible('objectType')"
              prop="objectType"
              label="对象"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }"
                >{{ row.objectType }} / {{ row.objectId ?? '-' }}</template
              >
            </el-table-column>
            <el-table-column
              v-if="isSensitiveColumnVisible('approved')"
              prop="approved"
              label="审批"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="row.approved ? 'green' : 'orange'" dot>
                  {{ row.approved ? '已审批' : '未审批' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isSensitiveColumnVisible('accessReason')"
              label="原因"
              min-width="240"
              prop="accessReason"
              show-overflow-tooltip
            />
          </el-table>
          <div
            v-if="sensitiveLogs.length"
            class="mobile-record-list"
            aria-label="敏感查看日志移动列表"
          >
            <article v-for="log in sensitiveLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.fieldName }}</strong>
                  <span>{{ log.module }} · {{ formatDate(log.createdAt) }}</span>
                </div>
                <StatusChip :tone="log.approved ? 'green' : 'orange'" dot>
                  {{ log.approved ? '已审批' : '未审批' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>用户</span>
                  <strong>{{ log.user?.displayName ?? log.user?.username ?? '-' }}</strong>
                </div>
                <div>
                  <span>对象</span>
                  <strong>{{ log.objectType }}</strong>
                </div>
                <div>
                  <span>IP</span>
                  <strong>{{ log.ip || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>访问原因</span>
                  <strong>{{ log.accessReason || '-' }}</strong>
                </div>
                <div>
                  <span>对象 ID</span>
                  <strong>{{ log.objectId || '-' }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无敏感查看日志</strong>
              <span>调整字段、模块或审批状态后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="sensitiveQuery.page"
            v-model:page-size="sensitiveQuery.pageSize"
            :total="sensitiveTotal"
            @change="() => loadSensitiveLogs()"
          />
        </el-tab-pane>

        <el-tab-pane label="登录日志" name="login">
          <TableToolbar
            v-model:keyword="loginQuery.keyword"
            v-model:status="loginQuery.status"
            v-model:visible-columns="loginVisibleColumns"
            v-model:saved-view-id="loginSavedViewId"
            :column-options="loginColumnOptions"
            :status-options="loginStatusOptions"
            :saved-views="loginSavedViews"
            :filter-chips="loginFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索账号、IP 或失败原因"
            @search="handleLoginSearch"
            @refresh="() => loadLoginLogs()"
            @clear-filters="clearLoginFilters"
            @remove-filter="removeLoginFilter"
            @save-view="saveLoginTableView"
            @apply-view="applyLoginSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="loginQuery.abnormal"
                class="table-toolbar__select"
                placeholder="异常"
                clearable
                @change="handleLoginSearch"
              >
                <el-option
                  v-for="option in loginAbnormalOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </TableToolbar>

          <el-table
            v-loading="loginLoading"
            class="desktop-data-table"
            :data="loginLogs"
            :size="loginTableSize"
            row-key="id"
            @sort-change="handleLoginSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无登录日志</strong>
                <span>可以清空筛选后重新查看登录记录。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearLoginFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isLoginColumnVisible('createdAt')"
              label="时间"
              prop="createdAt"
              width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isLoginColumnVisible('username')"
              label="账号"
              min-width="160"
              prop="username"
              sortable="custom"
            />
            <el-table-column
              v-if="isLoginColumnVisible('status')"
              label="状态"
              prop="status"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="getLoginTone(row.status)" dot>
                  {{ getLoginLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isLoginColumnVisible('abnormal')"
              label="异常"
              prop="abnormal"
              width="90"
              sortable="custom"
            >
              <template #default="{ row }">{{ row.abnormal ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isLoginColumnVisible('ip')"
              label="IP"
              min-width="130"
              prop="ip"
              sortable="custom"
            />
            <el-table-column
              v-if="isLoginColumnVisible('failureReason')"
              label="失败原因"
              min-width="260"
              prop="failureReason"
              sortable="custom"
              show-overflow-tooltip
            />
          </el-table>
          <div v-if="loginLogs.length" class="mobile-record-list" aria-label="登录日志移动列表">
            <article v-for="log in loginLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.username }}</strong>
                  <span>{{ formatDate(log.createdAt) }}</span>
                </div>
                <StatusChip :tone="getLoginTone(log.status)" dot>
                  {{ getLoginLabel(log.status) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>异常</span>
                  <strong>{{ log.abnormal ? '是' : '否' }}</strong>
                </div>
                <div>
                  <span>IP</span>
                  <strong>{{ log.ip || '-' }}</strong>
                </div>
                <div>
                  <span>位置</span>
                  <strong>{{ log.location || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>失败原因</span>
                  <strong>{{ log.failureReason || '-' }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无登录日志</strong>
              <span>调整账号、状态或异常筛选后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="loginQuery.page"
            v-model:page-size="loginQuery.pageSize"
            :total="loginTotal"
            @change="() => loadLoginLogs()"
          />
        </el-tab-pane>

        <el-tab-pane label="导出日志" name="exports">
          <TableToolbar
            v-model:keyword="exportQuery.keyword"
            v-model:status="exportQuery.status"
            v-model:visible-columns="exportVisibleColumns"
            v-model:saved-view-id="exportSavedViewId"
            :column-options="exportColumnOptions"
            :status-options="exportStatusOptions"
            :saved-views="exportSavedViews"
            :filter-chips="exportFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、文件或失败原因"
            @search="handleExportSearch"
            @refresh="() => loadExportLogs()"
            @clear-filters="clearExportFilters"
            @remove-filter="removeExportFilter"
            @save-view="saveExportTableView"
            @apply-view="applyExportSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-input
                v-model.trim="exportQuery.module"
                class="table-toolbar__select"
                placeholder="模块"
                clearable
                @keyup.enter="handleExportSearch"
                @clear="handleExportSearch"
              />
              <el-select
                v-model="exportQuery.containsSensitive"
                class="table-toolbar__select"
                placeholder="敏感"
                clearable
                @change="handleExportSearch"
              >
                <el-option
                  v-for="option in exportSensitiveOptions"
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
            :data="exportLogs"
            :size="exportTableSize"
            row-key="id"
            @sort-change="handleExportSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无导出日志</strong>
                <span>调整导出模块、状态或敏感条件后重新查询。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearExportFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isExportColumnVisible('createdAt')"
              label="时间"
              prop="createdAt"
              width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isExportColumnVisible('module')"
              label="模块"
              width="130"
              prop="module"
              sortable="custom"
            />
            <el-table-column
              v-if="isExportColumnVisible('status')"
              label="状态"
              width="100"
              prop="status"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="getJobStatusTone(row.status)" dot>
                  {{ getJobLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isExportColumnVisible('containsSensitive')"
              label="敏感"
              width="90"
              prop="containsSensitive"
              sortable="custom"
            >
              <template #default="{ row }">{{ row.containsSensitive ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column v-if="isExportColumnVisible('fields')" label="字段" min-width="220">
              <template #default="{ row }">{{ row.fields?.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isExportColumnVisible('filePath')"
              label="文件"
              min-width="240"
              prop="filePath"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isExportColumnVisible('errorMessage')"
              label="失败原因"
              min-width="220"
              prop="errorMessage"
              sortable="custom"
              show-overflow-tooltip
            />
          </el-table>
          <div v-if="exportLogs.length" class="mobile-record-list" aria-label="导出日志移动列表">
            <article v-for="log in exportLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.module }}</strong>
                  <span>{{ formatDate(log.createdAt) }}</span>
                </div>
                <StatusChip :tone="getJobStatusTone(log.status)" dot>
                  {{ getJobLabel(log.status) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>敏感字段</span>
                  <strong>{{ log.containsSensitive ? '是' : '否' }}</strong>
                </div>
                <div>
                  <span>字段数</span>
                  <strong>{{ log.fields.length }}</strong>
                </div>
                <div>
                  <span>完成时间</span>
                  <strong>{{ formatDate(log.finishedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>文件</span>
                  <strong>{{ log.filePath || '-' }}</strong>
                </div>
                <div>
                  <span>失败原因</span>
                  <strong>{{ log.errorMessage || '-' }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无导出日志</strong>
              <span>调整模块、状态或敏感筛选后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="exportQuery.page"
            v-model:page-size="exportQuery.pageSize"
            :total="exportTotal"
            @change="() => loadExportLogs()"
          />
        </el-tab-pane>

        <el-tab-pane label="权限变更日志" name="permission">
          <TableToolbar
            v-model:keyword="permissionQuery.keyword"
            v-model:visible-columns="permissionVisibleColumns"
            v-model:saved-view-id="permissionSavedViewId"
            :column-options="permissionColumnOptions"
            :saved-views="permissionSavedViews"
            :show-status="false"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索权限、角色、备注"
            @search="handlePermissionSearch"
            @refresh="() => loadPermissionLogs()"
            @clear-filters="clearPermissionFilters"
            @save-view="savePermissionTableView"
            @apply-view="applyPermissionSavedView"
            @export="showExportMessage"
          />

          <el-table
            v-loading="permissionLoading"
            class="desktop-data-table"
            :data="permissionLogs"
            :size="permissionTableSize"
            row-key="id"
            @sort-change="handlePermissionSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无权限变更日志</strong>
                <span>调整权限、角色或备注关键词后重新查询。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearPermissionFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isPermissionColumnVisible('createdAt')"
              prop="createdAt"
              label="时间"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column v-if="isPermissionColumnVisible('user')" label="用户" min-width="140">
              <template #default="{ row }">
                {{ row.user?.displayName ?? row.user?.username ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isPermissionColumnVisible('module')"
              label="模块"
              prop="module"
              min-width="120"
              sortable="custom"
            />
            <el-table-column
              v-if="isPermissionColumnVisible('action')"
              label="动作"
              prop="action"
              min-width="190"
              sortable="custom"
            />
            <el-table-column
              v-if="isPermissionColumnVisible('objectType')"
              label="对象"
              prop="objectType"
              min-width="130"
              sortable="custom"
            />
            <el-table-column
              v-if="isPermissionColumnVisible('remark')"
              label="备注"
              prop="remark"
              min-width="260"
              show-overflow-tooltip
            />
          </el-table>
          <div
            v-if="permissionLogs.length"
            class="mobile-record-list"
            aria-label="权限变更日志移动列表"
          >
            <article v-for="log in permissionLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.action }}</strong>
                  <span>{{ formatDate(log.createdAt) }}</span>
                </div>
                <StatusChip tone="purple">{{ log.module }}</StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>用户</span>
                  <strong>{{ log.user?.displayName ?? log.user?.username ?? '-' }}</strong>
                </div>
                <div>
                  <span>对象</span>
                  <strong>{{ log.objectType || '-' }}</strong>
                </div>
                <div>
                  <span>对象 ID</span>
                  <strong>{{ log.objectId || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>备注</span>
                  <strong>{{ log.remark || '-' }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无权限变更日志</strong>
              <span>调整权限、角色或备注关键词后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="permissionQuery.page"
            v-model:page-size="permissionQuery.pageSize"
            :total="permissionTotal"
            @change="() => loadPermissionLogs()"
          />
        </el-tab-pane>

        <el-tab-pane label="自动化任务日志" name="automation">
          <TableToolbar
            v-model:keyword="automationQuery.keyword"
            v-model:status="automationQuery.level"
            v-model:visible-columns="automationVisibleColumns"
            v-model:saved-view-id="automationSavedViewId"
            :column-options="automationColumnOptions"
            :status-options="automationLevelOptions"
            :saved-views="automationSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索任务消息、任务类型"
            @search="handleAutomationSearch"
            @refresh="() => loadAutomationLogs()"
            @clear-filters="clearAutomationFilters"
            @save-view="saveAutomationTableView"
            @apply-view="applyAutomationSavedView"
            @export="showExportMessage"
          />

          <el-table
            v-loading="automationLoading"
            class="desktop-data-table"
            :data="automationLogs"
            :size="automationTableSize"
            row-key="id"
            @sort-change="handleAutomationSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无自动化任务日志</strong>
                <span>调整任务消息、级别或任务类型后重新查询。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearAutomationFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isAutomationColumnVisible('createdAt')"
              label="时间"
              prop="createdAt"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAutomationColumnVisible('task')"
              label="任务"
              prop="message"
              min-width="220"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ getAutomationTaskTypeLabel(row.task?.taskType) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isAutomationColumnVisible('level')"
              label="级别"
              prop="level"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="getAutomationTone(row.level)" dot>
                  {{ row.level }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column v-if="isAutomationColumnVisible('status')" label="状态" width="120">
              <template #default="{ row }">{{ row.task?.status ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAutomationColumnVisible('message')"
              label="消息"
              min-width="320"
              prop="message"
              sortable="custom"
              show-overflow-tooltip
            />
          </el-table>
          <div
            v-if="automationLogs.length"
            class="mobile-record-list"
            aria-label="自动化任务日志移动列表"
          >
            <article v-for="log in automationLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getAutomationTaskTypeLabel(log.task?.taskType) }}</strong>
                  <span>{{ formatDate(log.createdAt) }}</span>
                </div>
                <StatusChip :tone="getAutomationTone(log.level)" dot>
                  {{ log.level }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>状态</span>
                  <strong>{{ log.task?.status ?? '-' }}</strong>
                </div>
                <div>
                  <span>人工验证</span>
                  <strong>{{ log.task?.manualRequired ? '需要' : '无需' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>消息</span>
                  <strong>{{ log.message }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无自动化任务日志</strong>
              <span>调整级别或任务关键词后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="automationQuery.page"
            v-model:page-size="automationQuery.pageSize"
            :total="automationTotal"
            @change="() => loadAutomationLogs()"
          />
        </el-tab-pane>

        <el-tab-pane label="平台接口日志" name="platform">
          <TableToolbar
            v-model:keyword="platformQuery.keyword"
            v-model:status="platformQuery.status"
            v-model:visible-columns="platformVisibleColumns"
            v-model:saved-view-id="platformSavedViewId"
            :column-options="platformColumnOptions"
            :status-options="platformStatusOptions"
            :saved-views="platformSavedViews"
            :filter-chips="platformFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索平台、接口、失败原因"
            @search="handlePlatformSearch"
            @refresh="() => loadPlatformLogs()"
            @clear-filters="clearPlatformFilters"
            @remove-filter="removePlatformFilter"
            @save-view="savePlatformTableView"
            @apply-view="applyPlatformSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="platformQuery.platform"
                class="table-toolbar__select"
                placeholder="平台"
                clearable
                @change="handlePlatformSearch"
              >
                <el-option
                  v-for="option in platformOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </TableToolbar>

          <el-table
            v-loading="platformLoading"
            class="desktop-data-table"
            :data="platformLogs"
            :size="platformTableSize"
            row-key="id"
            @sort-change="handlePlatformSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无平台接口日志</strong>
                <span>调整平台、状态或接口关键词后重新查询。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearPlatformFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
            <el-table-column
              v-if="isPlatformColumnVisible('finishedAt')"
              label="时间"
              prop="finishedAt"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{
                formatDate(row.finishedAt ?? row.createdAt)
              }}</template>
            </el-table-column>
            <el-table-column
              v-if="isPlatformColumnVisible('platform')"
              label="平台"
              prop="platform"
              min-width="130"
              sortable="custom"
            >
              <template #default="{ row }">{{ getPlatformLabel(row.platform) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isPlatformColumnVisible('syncType')"
              label="接口"
              min-width="130"
              prop="syncType"
              sortable="custom"
            />
            <el-table-column
              v-if="isPlatformColumnVisible('status')"
              label="状态"
              width="110"
              prop="status"
              sortable="custom"
            >
              <template #default="{ row }">
                <StatusChip :tone="row.status === 'success' ? 'green' : 'red'" dot>
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isPlatformColumnVisible('requestCount')"
              label="请求数"
              width="110"
              prop="requestCount"
              sortable="custom"
            />
            <el-table-column
              v-if="isPlatformColumnVisible('errorRate')"
              label="错误率"
              width="110"
              prop="errorRate"
              sortable="custom"
            />
            <el-table-column
              v-if="isPlatformColumnVisible('errorMessage')"
              label="失败原因"
              min-width="300"
              prop="errorMessage"
              sortable="custom"
              show-overflow-tooltip
            />
          </el-table>
          <div
            v-if="platformLogs.length"
            class="mobile-record-list"
            aria-label="平台接口日志移动列表"
          >
            <article v-for="log in platformLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getPlatformLabel(log.platform) }}</strong>
                  <span
                    >{{ log.syncType }} · {{ formatDate(log.finishedAt ?? log.createdAt) }}</span
                  >
                </div>
                <StatusChip :tone="log.status === 'success' ? 'green' : 'red'" dot>
                  {{ log.status === 'success' ? '成功' : '失败' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>请求数</span>
                  <strong>{{ log.requestCount }}</strong>
                </div>
                <div>
                  <span>错误率</span>
                  <strong>{{ log.errorRate }}</strong>
                </div>
                <div>
                  <span>开始时间</span>
                  <strong>{{ formatDate(log.startedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>失败原因</span>
                  <strong>{{ log.errorMessage || '-' }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无平台接口日志</strong>
              <span>调整平台、状态或接口关键词后重新查询。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="platformQuery.page"
            v-model:page-size="platformQuery.pageSize"
            :total="platformTotal"
            @change="() => loadPlatformLogs()"
          />
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { auditLogsApi, userTableViewsApi } from '@/api/system';
import type {
  AuditAutomationTaskLogQuery,
  AuditExportQuery,
  AuditLoginQuery,
  AuditLogQuery,
  AuditPermissionChangeQuery,
  AuditPlatformInterfaceLogQuery,
  AuditSensitiveAccessQuery
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AuditLog,
  AutomationTaskLog,
  DataExportJob,
  DataJobStatus,
  LoginLog,
  LoginLogStatus,
  PageResult,
  PlatformSyncLog,
  PlatformSyncLogStatus,
  SensitiveAccessLog,
  TableDensity,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

const route = useRoute();
const activeTab = ref('operation');

const operationTableKey = 'audit_operation_logs';
const operationColumnOptions = [
  { label: '时间', value: 'createdAt', required: true },
  { label: '用户', value: 'user' },
  { label: '模块', value: 'module' },
  { label: '动作', value: 'action' },
  { label: '对象', value: 'objectType' },
  { label: '备注', value: 'remark' }
];
const sensitiveTableKey = 'audit_sensitive_access_logs';
const sensitiveApprovedOptions = [
  { label: '已审批', value: 'true' },
  { label: '未审批', value: 'false' }
];
const sensitiveColumnOptions = [
  { label: '时间', value: 'createdAt', required: true },
  { label: '用户', value: 'user' },
  { label: '模块', value: 'module' },
  { label: '字段', value: 'fieldName' },
  { label: '对象', value: 'objectType' },
  { label: '审批', value: 'approved' },
  { label: '原因', value: 'accessReason' }
];
const loginTableKey = 'audit_login_logs';
const loginStatusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '阻止', value: 'blocked' }
];
const loginAbnormalOptions = [
  { label: '异常', value: 'true' },
  { label: '正常', value: 'false' }
];
const loginColumnOptions = [
  { label: '时间', value: 'createdAt', required: true },
  { label: '账号', value: 'username' },
  { label: '状态', value: 'status' },
  { label: '异常', value: 'abnormal' },
  { label: 'IP', value: 'ip' },
  { label: '失败原因', value: 'failureReason' }
];
const exportTableKey = 'audit_export_logs';
const exportStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '运行中', value: 'running' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '取消', value: 'cancelled' }
];
const exportSensitiveOptions = [
  { label: '包含敏感字段', value: 'true' },
  { label: '不含敏感字段', value: 'false' }
];
const exportColumnOptions = [
  { label: '时间', value: 'createdAt', required: true },
  { label: '模块', value: 'module' },
  { label: '状态', value: 'status' },
  { label: '敏感', value: 'containsSensitive' },
  { label: '字段', value: 'fields' },
  { label: '文件', value: 'filePath' },
  { label: '失败原因', value: 'errorMessage' }
];
const permissionTableKey = 'audit_permission_change_logs';
const permissionColumnOptions = [
  { label: '时间', value: 'createdAt', required: true },
  { label: '用户', value: 'user' },
  { label: '模块', value: 'module' },
  { label: '动作', value: 'action' },
  { label: '对象', value: 'objectType' },
  { label: '备注', value: 'remark' }
];
const automationTableKey = 'audit_automation_task_logs';
const automationLevelOptions = [
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Success', value: 'success' }
];
const automationColumnOptions = [
  { label: '时间', value: 'createdAt', required: true },
  { label: '任务', value: 'task' },
  { label: '级别', value: 'level' },
  { label: '状态', value: 'status' },
  { label: '消息', value: 'message' }
];
const platformTableKey = 'audit_platform_interface_logs';
const platformOptions = [
  { label: '淘宝', value: 'taobao' },
  { label: '闲鱼', value: 'xianyu' },
  { label: 'Telegram', value: 'telegram' },
  { label: '文件存储', value: 'file-storage' },
  { label: '自动化服务', value: 'automation-service' }
];
const platformStatusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' }
];
const platformColumnOptions = [
  { label: '时间', value: 'finishedAt', required: true },
  { label: '平台', value: 'platform' },
  { label: '接口', value: 'syncType' },
  { label: '状态', value: 'status' },
  { label: '请求数', value: 'requestCount' },
  { label: '错误率', value: 'errorRate' },
  { label: '失败原因', value: 'errorMessage' }
];

const operationQuery = reactive({ page: 1, pageSize: 20, keyword: '', module: '', action: '' });
const operationLogs = ref<AuditLog[]>([]);
const operationTotal = ref(0);
const operationLoading = ref(false);
const operationDensity = ref<TableDensity>('default');
const operationVisibleColumns = ref<string[]>([]);
const operationSavedViews = ref<UserTableView[]>([]);
const operationSavedViewId = ref('');
const operationSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const operationViewsLoaded = ref(false);
const activeOperationQueryKey = ref('');

const sensitiveQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  module: '',
  fieldName: '',
  approved: ''
});
const sensitiveLogs = ref<SensitiveAccessLog[]>([]);
const sensitiveTotal = ref(0);
const sensitiveLoading = ref(false);
const sensitiveDensity = ref<TableDensity>('default');
const sensitiveVisibleColumns = ref<string[]>([]);
const sensitiveSavedViews = ref<UserTableView[]>([]);
const sensitiveSavedViewId = ref('');
const sensitiveSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const sensitiveViewsLoaded = ref(false);
const activeSensitiveQueryKey = ref('');

const loginQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as LoginLogStatus | '',
  abnormal: ''
});
const loginLogs = ref<LoginLog[]>([]);
const loginTotal = ref(0);
const loginLoading = ref(false);
const loginDensity = ref<TableDensity>('default');
const loginVisibleColumns = ref<string[]>([]);
const loginSavedViews = ref<UserTableView[]>([]);
const loginSavedViewId = ref('');
const loginSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const loginViewsLoaded = ref(false);
const activeLoginQueryKey = ref('');

const exportQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  module: '',
  status: '' as DataJobStatus | '',
  containsSensitive: ''
});
const exportLogs = ref<DataExportJob[]>([]);
const exportTotal = ref(0);
const exportLoading = ref(false);
const exportDensity = ref<TableDensity>('default');
const exportVisibleColumns = ref<string[]>([]);
const exportSavedViews = ref<UserTableView[]>([]);
const exportSavedViewId = ref('');
const exportSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const exportViewsLoaded = ref(false);
const activeExportQueryKey = ref('');

const permissionQuery = reactive({ page: 1, pageSize: 20, keyword: '' });
const permissionLogs = ref<AuditLog[]>([]);
const permissionTotal = ref(0);
const permissionLoading = ref(false);
const permissionDensity = ref<TableDensity>('default');
const permissionVisibleColumns = ref<string[]>([]);
const permissionSavedViews = ref<UserTableView[]>([]);
const permissionSavedViewId = ref('');
const permissionSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const permissionViewsLoaded = ref(false);
const activePermissionQueryKey = ref('');

const automationQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  level: '' as AutomationTaskLog['level'] | ''
});
const automationLogs = ref<AutomationTaskLog[]>([]);
const automationTotal = ref(0);
const automationLoading = ref(false);
const automationDensity = ref<TableDensity>('default');
const automationVisibleColumns = ref<string[]>([]);
const automationSavedViews = ref<UserTableView[]>([]);
const automationSavedViewId = ref('');
const automationSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const automationViewsLoaded = ref(false);
const activeAutomationQueryKey = ref('');

const platformQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  platform: '',
  status: '' as PlatformSyncLogStatus | ''
});
const platformLogs = ref<PlatformSyncLog[]>([]);
const platformTotal = ref(0);
const platformLoading = ref(false);
const platformDensity = ref<TableDensity>('default');
const platformVisibleColumns = ref<string[]>([]);
const platformSavedViews = ref<UserTableView[]>([]);
const platformSavedViewId = ref('');
const platformSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const platformViewsLoaded = ref(false);
const activePlatformQueryKey = ref('');

const operationTableSize = computed(() =>
  operationDensity.value === 'compact'
    ? 'small'
    : operationDensity.value === 'loose'
      ? 'large'
      : 'default'
);
const operationFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (operationQuery.module) {
    chips.push({ key: 'module', label: '模块', value: operationQuery.module });
  }
  if (operationQuery.action) {
    chips.push({ key: 'action', label: '动作', value: operationQuery.action });
  }
  return chips;
});
const sensitiveTableSize = computed(() =>
  sensitiveDensity.value === 'compact'
    ? 'small'
    : sensitiveDensity.value === 'loose'
      ? 'large'
      : 'default'
);
const sensitiveFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (sensitiveQuery.module) {
    chips.push({ key: 'module', label: '模块', value: sensitiveQuery.module });
  }
  if (sensitiveQuery.fieldName) {
    chips.push({ key: 'fieldName', label: '字段', value: sensitiveQuery.fieldName });
  }
  return chips;
});
const loginTableSize = computed(() =>
  loginDensity.value === 'compact' ? 'small' : loginDensity.value === 'loose' ? 'large' : 'default'
);
const loginFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const abnormalLabel = loginAbnormalOptions.find(
    (option) => option.value === loginQuery.abnormal
  )?.label;
  if (abnormalLabel) {
    chips.push({ key: 'abnormal', label: '异常', value: abnormalLabel });
  }
  return chips;
});
const exportTableSize = computed(() =>
  exportDensity.value === 'compact'
    ? 'small'
    : exportDensity.value === 'loose'
      ? 'large'
      : 'default'
);
const exportFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const containsSensitiveLabel = exportSensitiveOptions.find(
    (option) => option.value === exportQuery.containsSensitive
  )?.label;
  if (exportQuery.module) {
    chips.push({ key: 'module', label: '模块', value: exportQuery.module });
  }
  if (containsSensitiveLabel) {
    chips.push({ key: 'containsSensitive', label: '敏感', value: containsSensitiveLabel });
  }
  return chips;
});
const permissionTableSize = computed(() =>
  permissionDensity.value === 'compact'
    ? 'small'
    : permissionDensity.value === 'loose'
      ? 'large'
      : 'default'
);
const automationTableSize = computed(() =>
  automationDensity.value === 'compact'
    ? 'small'
    : automationDensity.value === 'loose'
      ? 'large'
      : 'default'
);
const platformTableSize = computed(() =>
  platformDensity.value === 'compact'
    ? 'small'
    : platformDensity.value === 'loose'
      ? 'large'
      : 'default'
);
const platformFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const platformLabel = platformOptions.find(
    (option) => option.value === platformQuery.platform
  )?.label;
  if (platformLabel) {
    chips.push({ key: 'platform', label: '平台', value: platformLabel });
  }
  return chips;
});

watch(
  () => route.meta.moduleKey,
  (moduleKey) => {
    activeTab.value = getRouteTab(String(moduleKey ?? 'audit-log'));
    void refreshCurrentTab();
  },
  { immediate: true }
);

async function refreshCurrentTab() {
  if (activeTab.value === 'operation') {
    await ensureOperationTableViews();
    await loadOperationLogs();
  }
  if (activeTab.value === 'sensitive') {
    await ensureSensitiveTableViews();
    await loadSensitiveLogs();
  }
  if (activeTab.value === 'login') {
    await ensureLoginTableViews();
    await loadLoginLogs();
  }
  if (activeTab.value === 'exports') {
    await ensureExportTableViews();
    await loadExportLogs();
  }
  if (activeTab.value === 'permission') {
    await ensurePermissionTableViews();
    await loadPermissionLogs();
  }
  if (activeTab.value === 'automation') {
    await ensureAutomationTableViews();
    await loadAutomationLogs();
  }
  if (activeTab.value === 'platform') {
    await ensurePlatformTableViews();
    await loadPlatformLogs();
  }
}

function buildOperationParams(): AuditLogQuery {
  return {
    ...operationQuery,
    sortBy: operationSortConfig.value.prop,
    sortOrder: mapOperationSortOrder(operationSortConfig.value.order)
  };
}

function applyOperationLogsResult(result: PageResult<AuditLog>) {
  operationLogs.value = result.items;
  operationTotal.value = result.total;
}

async function loadOperationLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildOperationParams();
  const key = createSmartQueryKey('audit-operation-logs', params);
  const cached = getSmartQueryData<PageResult<AuditLog>>(key);

  activeOperationQueryKey.value = key;

  if (cached) {
    applyOperationLogsResult(cached);
  }

  operationLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.operation(params),
      force: options.force ?? true
    });

    if (activeOperationQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyOperationLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载操作日志失败');
    }
  } finally {
    if (activeOperationQueryKey.value === key) {
      operationLoading.value = false;
    }
  }
}

async function handleOperationSearch() {
  operationQuery.page = 1;
  await loadOperationLogs();
}

async function handleOperationSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  operationSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  operationQuery.page = 1;
  await loadOperationLogs();
}

function isOperationColumnVisible(column: string) {
  return operationVisibleColumns.value.length
    ? operationVisibleColumns.value.includes(column)
    : true;
}

function clearOperationFilters() {
  operationQuery.page = 1;
  operationQuery.keyword = '';
  operationQuery.module = '';
  operationQuery.action = '';
  operationSavedViewId.value = '';
  operationDensity.value = 'default';
  operationSortConfig.value = {};
}

function removeOperationFilter(key: string) {
  if (key === 'module') {
    operationQuery.module = '';
  }
  if (key === 'action') {
    operationQuery.action = '';
  }
}

async function ensureOperationTableViews() {
  if (operationViewsLoaded.value) return;
  await loadOperationTableViews(true);
  operationViewsLoaded.value = true;
}

async function loadOperationTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: operationTableKey
    });
    operationSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyOperationView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveOperationTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存操作日志视图', {
      inputValue: '操作日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: operationTableKey,
      viewName: value.trim(),
      filters: {
        keyword: operationQuery.keyword,
        module: operationQuery.module,
        action: operationQuery.action
      },
      sortConfig: operationSortConfig.value,
      columns: operationVisibleColumns.value.length
        ? operationVisibleColumns.value
        : operationColumnOptions.map((column) => column.value),
      density: operationDensity.value,
      pageSize: operationQuery.pageSize,
      isDefault: operationSavedViews.value.length === 0
    });
    await loadOperationTableViews();
    operationSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyOperationSavedView(id: string) {
  const view = operationSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyOperationView(view);
  ElMessage.success('已应用保存视图');
  await loadOperationLogs();
}

function applyOperationView(view: UserTableView) {
  const filters = view.filters;
  operationQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  operationQuery.module = typeof filters.module === 'string' ? filters.module : '';
  operationQuery.action = typeof filters.action === 'string' ? filters.action : '';
  operationQuery.pageSize = view.pageSize;
  operationDensity.value = 'default';
  operationVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        operationColumnOptions.some((option) => option.value === column)
      )
    : operationColumnOptions.map((column) => column.value);
  operationSortConfig.value = parseOperationSortConfig(view.sortConfig);
  operationSavedViewId.value = view.id;
}

function parseOperationSortConfig(value: Record<string, unknown>): {
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

function mapOperationSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function buildSensitiveParams(): AuditSensitiveAccessQuery {
  return {
    ...sensitiveQuery,
    sortBy: sensitiveSortConfig.value.prop,
    sortOrder: mapSensitiveSortOrder(sensitiveSortConfig.value.order)
  };
}

function applySensitiveLogsResult(result: PageResult<SensitiveAccessLog>) {
  sensitiveLogs.value = result.items;
  sensitiveTotal.value = result.total;
}

async function loadSensitiveLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildSensitiveParams();
  const key = createSmartQueryKey('audit-sensitive-logs', params);
  const cached = getSmartQueryData<PageResult<SensitiveAccessLog>>(key);

  activeSensitiveQueryKey.value = key;

  if (cached) {
    applySensitiveLogsResult(cached);
  }

  sensitiveLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.sensitiveAccess(params),
      force: options.force ?? true
    });

    if (activeSensitiveQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applySensitiveLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载敏感查看日志失败');
    }
  } finally {
    if (activeSensitiveQueryKey.value === key) {
      sensitiveLoading.value = false;
    }
  }
}

async function handleSensitiveSearch() {
  sensitiveQuery.page = 1;
  await loadSensitiveLogs();
}

async function handleSensitiveSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sensitiveSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  sensitiveQuery.page = 1;
  await loadSensitiveLogs();
}

function isSensitiveColumnVisible(column: string) {
  return sensitiveVisibleColumns.value.length
    ? sensitiveVisibleColumns.value.includes(column)
    : true;
}

function clearSensitiveFilters() {
  sensitiveQuery.page = 1;
  sensitiveQuery.keyword = '';
  sensitiveQuery.module = '';
  sensitiveQuery.fieldName = '';
  sensitiveQuery.approved = '';
  sensitiveSavedViewId.value = '';
  sensitiveDensity.value = 'default';
  sensitiveSortConfig.value = {};
}

function removeSensitiveFilter(key: string) {
  if (key === 'module') {
    sensitiveQuery.module = '';
  }
  if (key === 'fieldName') {
    sensitiveQuery.fieldName = '';
  }
}

async function ensureSensitiveTableViews() {
  if (sensitiveViewsLoaded.value) return;
  await loadSensitiveTableViews(true);
  sensitiveViewsLoaded.value = true;
}

async function loadSensitiveTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: sensitiveTableKey
    });
    sensitiveSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applySensitiveView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveSensitiveTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存敏感查看日志视图', {
      inputValue: '敏感查看日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: sensitiveTableKey,
      viewName: value.trim(),
      filters: {
        keyword: sensitiveQuery.keyword,
        module: sensitiveQuery.module,
        fieldName: sensitiveQuery.fieldName,
        approved: sensitiveQuery.approved
      },
      sortConfig: sensitiveSortConfig.value,
      columns: sensitiveVisibleColumns.value.length
        ? sensitiveVisibleColumns.value
        : sensitiveColumnOptions.map((column) => column.value),
      density: sensitiveDensity.value,
      pageSize: sensitiveQuery.pageSize,
      isDefault: sensitiveSavedViews.value.length === 0
    });
    await loadSensitiveTableViews();
    sensitiveSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applySensitiveSavedView(id: string) {
  const view = sensitiveSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applySensitiveView(view);
  ElMessage.success('已应用保存视图');
  await loadSensitiveLogs();
}

function applySensitiveView(view: UserTableView) {
  const filters = view.filters;
  sensitiveQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  sensitiveQuery.module = typeof filters.module === 'string' ? filters.module : '';
  sensitiveQuery.fieldName = typeof filters.fieldName === 'string' ? filters.fieldName : '';
  sensitiveQuery.approved = typeof filters.approved === 'string' ? filters.approved : '';
  sensitiveQuery.pageSize = view.pageSize;
  sensitiveDensity.value = 'default';
  sensitiveVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        sensitiveColumnOptions.some((option) => option.value === column)
      )
    : sensitiveColumnOptions.map((column) => column.value);
  sensitiveSortConfig.value = parseSensitiveSortConfig(view.sortConfig);
  sensitiveSavedViewId.value = view.id;
}

function parseSensitiveSortConfig(value: Record<string, unknown>): {
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

function mapSensitiveSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function buildLoginParams(): AuditLoginQuery {
  return {
    ...loginQuery,
    sortBy: loginSortConfig.value.prop,
    sortOrder: mapLoginSortOrder(loginSortConfig.value.order)
  };
}

function applyLoginLogsResult(result: PageResult<LoginLog>) {
  loginLogs.value = result.items;
  loginTotal.value = result.total;
}

async function loadLoginLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildLoginParams();
  const key = createSmartQueryKey('audit-login-logs', params);
  const cached = getSmartQueryData<PageResult<LoginLog>>(key);

  activeLoginQueryKey.value = key;

  if (cached) {
    applyLoginLogsResult(cached);
  }

  loginLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.login(params),
      force: options.force ?? true
    });

    if (activeLoginQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyLoginLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载登录日志失败');
    }
  } finally {
    if (activeLoginQueryKey.value === key) {
      loginLoading.value = false;
    }
  }
}

async function handleLoginSearch() {
  loginQuery.page = 1;
  await loadLoginLogs();
}

async function handleLoginSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  loginSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  loginQuery.page = 1;
  await loadLoginLogs();
}

function isLoginColumnVisible(column: string) {
  return loginVisibleColumns.value.length ? loginVisibleColumns.value.includes(column) : true;
}

function clearLoginFilters() {
  loginQuery.page = 1;
  loginQuery.keyword = '';
  loginQuery.status = '';
  loginQuery.abnormal = '';
  loginSavedViewId.value = '';
  loginDensity.value = 'default';
  loginSortConfig.value = {};
}

function removeLoginFilter(key: string) {
  if (key === 'abnormal') {
    loginQuery.abnormal = '';
  }
}

async function ensureLoginTableViews() {
  if (loginViewsLoaded.value) return;
  await loadLoginTableViews(true);
  loginViewsLoaded.value = true;
}

async function loadLoginTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: loginTableKey
    });
    loginSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyLoginView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveLoginTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存登录日志视图', {
      inputValue: '登录日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: loginTableKey,
      viewName: value.trim(),
      filters: {
        keyword: loginQuery.keyword,
        status: loginQuery.status,
        abnormal: loginQuery.abnormal
      },
      sortConfig: loginSortConfig.value,
      columns: loginVisibleColumns.value.length
        ? loginVisibleColumns.value
        : loginColumnOptions.map((column) => column.value),
      density: loginDensity.value,
      pageSize: loginQuery.pageSize,
      isDefault: loginSavedViews.value.length === 0
    });
    await loadLoginTableViews();
    loginSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyLoginSavedView(id: string) {
  const view = loginSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyLoginView(view);
  ElMessage.success('已应用保存视图');
  await loadLoginLogs();
}

function applyLoginView(view: UserTableView) {
  const filters = view.filters;
  loginQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  loginQuery.status = isLoginStatus(filters.status) ? filters.status : '';
  loginQuery.abnormal = typeof filters.abnormal === 'string' ? filters.abnormal : '';
  loginQuery.pageSize = view.pageSize;
  loginDensity.value = 'default';
  loginVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) => loginColumnOptions.some((option) => option.value === column))
    : loginColumnOptions.map((column) => column.value);
  loginSortConfig.value = parseLoginSortConfig(view.sortConfig);
  loginSavedViewId.value = view.id;
}

function parseLoginSortConfig(value: Record<string, unknown>): {
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

function mapLoginSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function buildExportParams(): AuditExportQuery {
  return {
    ...exportQuery,
    sortBy: exportSortConfig.value.prop,
    sortOrder: mapExportSortOrder(exportSortConfig.value.order)
  };
}

function applyExportLogsResult(result: PageResult<DataExportJob>) {
  exportLogs.value = result.items;
  exportTotal.value = result.total;
}

async function loadExportLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildExportParams();
  const key = createSmartQueryKey('audit-export-logs', params);
  const cached = getSmartQueryData<PageResult<DataExportJob>>(key);

  activeExportQueryKey.value = key;

  if (cached) {
    applyExportLogsResult(cached);
  }

  exportLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.exports(params),
      force: options.force ?? true
    });

    if (activeExportQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyExportLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载导出日志失败');
    }
  } finally {
    if (activeExportQueryKey.value === key) {
      exportLoading.value = false;
    }
  }
}

async function handleExportSearch() {
  exportQuery.page = 1;
  await loadExportLogs();
}

async function handleExportSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  exportSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  exportQuery.page = 1;
  await loadExportLogs();
}

function isExportColumnVisible(column: string) {
  return exportVisibleColumns.value.length ? exportVisibleColumns.value.includes(column) : true;
}

function clearExportFilters() {
  exportQuery.page = 1;
  exportQuery.keyword = '';
  exportQuery.module = '';
  exportQuery.status = '';
  exportQuery.containsSensitive = '';
  exportSavedViewId.value = '';
  exportDensity.value = 'default';
  exportSortConfig.value = {};
}

function removeExportFilter(key: string) {
  if (key === 'module') {
    exportQuery.module = '';
  }
  if (key === 'containsSensitive') {
    exportQuery.containsSensitive = '';
  }
}

async function ensureExportTableViews() {
  if (exportViewsLoaded.value) return;
  await loadExportTableViews(true);
  exportViewsLoaded.value = true;
}

async function loadExportTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: exportTableKey
    });
    exportSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyExportView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveExportTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存导出日志视图', {
      inputValue: '导出日志常用视图',
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
        module: exportQuery.module,
        status: exportQuery.status,
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

async function applyExportSavedView(id: string) {
  const view = exportSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyExportView(view);
  ElMessage.success('已应用保存视图');
  await loadExportLogs();
}

function applyExportView(view: UserTableView) {
  const filters = view.filters;
  exportQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  exportQuery.module = typeof filters.module === 'string' ? filters.module : '';
  exportQuery.status = isDataJobStatus(filters.status) ? filters.status : '';
  exportQuery.containsSensitive =
    typeof filters.containsSensitive === 'string' ? filters.containsSensitive : '';
  exportQuery.pageSize = view.pageSize;
  exportDensity.value = 'default';
  exportVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) => exportColumnOptions.some((option) => option.value === column))
    : exportColumnOptions.map((column) => column.value);
  exportSortConfig.value = parseExportSortConfig(view.sortConfig);
  exportSavedViewId.value = view.id;
}

function parseExportSortConfig(value: Record<string, unknown>): {
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

function mapExportSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function buildPermissionParams(): AuditPermissionChangeQuery {
  return {
    ...permissionQuery,
    sortBy: permissionSortConfig.value.prop,
    sortOrder: mapPermissionSortOrder(permissionSortConfig.value.order)
  };
}

function applyPermissionLogsResult(result: PageResult<AuditLog>) {
  permissionLogs.value = result.items;
  permissionTotal.value = result.total;
}

async function loadPermissionLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildPermissionParams();
  const key = createSmartQueryKey('audit-permission-logs', params);
  const cached = getSmartQueryData<PageResult<AuditLog>>(key);

  activePermissionQueryKey.value = key;

  if (cached) {
    applyPermissionLogsResult(cached);
  }

  permissionLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.permissionChanges(params),
      force: options.force ?? true
    });

    if (activePermissionQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyPermissionLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载权限变更日志失败');
    }
  } finally {
    if (activePermissionQueryKey.value === key) {
      permissionLoading.value = false;
    }
  }
}

async function handlePermissionSearch() {
  permissionQuery.page = 1;
  await loadPermissionLogs();
}

async function handlePermissionSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  permissionSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  permissionQuery.page = 1;
  await loadPermissionLogs();
}

function isPermissionColumnVisible(column: string) {
  return permissionVisibleColumns.value.length
    ? permissionVisibleColumns.value.includes(column)
    : true;
}

function clearPermissionFilters() {
  permissionQuery.page = 1;
  permissionQuery.keyword = '';
  permissionSavedViewId.value = '';
  permissionDensity.value = 'default';
  permissionSortConfig.value = {};
}

async function ensurePermissionTableViews() {
  if (permissionViewsLoaded.value) return;
  await loadPermissionTableViews(true);
  permissionViewsLoaded.value = true;
}

async function loadPermissionTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: permissionTableKey
    });
    permissionSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyPermissionView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function savePermissionTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存权限变更日志视图', {
      inputValue: '权限变更日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: permissionTableKey,
      viewName: value.trim(),
      filters: {
        keyword: permissionQuery.keyword
      },
      sortConfig: permissionSortConfig.value,
      columns: permissionVisibleColumns.value.length
        ? permissionVisibleColumns.value
        : permissionColumnOptions.map((column) => column.value),
      density: permissionDensity.value,
      pageSize: permissionQuery.pageSize,
      isDefault: permissionSavedViews.value.length === 0
    });
    await loadPermissionTableViews();
    permissionSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyPermissionSavedView(id: string) {
  const view = permissionSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyPermissionView(view);
  ElMessage.success('已应用保存视图');
  await loadPermissionLogs();
}

function applyPermissionView(view: UserTableView) {
  const filters = view.filters;
  permissionQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  permissionQuery.pageSize = view.pageSize;
  permissionDensity.value = 'default';
  permissionVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        permissionColumnOptions.some((option) => option.value === column)
      )
    : permissionColumnOptions.map((column) => column.value);
  permissionSortConfig.value = parsePermissionSortConfig(view.sortConfig);
  permissionSavedViewId.value = view.id;
}

function parsePermissionSortConfig(value: Record<string, unknown>): {
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

function mapPermissionSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function buildAutomationParams(): AuditAutomationTaskLogQuery {
  return {
    ...automationQuery,
    sortBy: automationSortConfig.value.prop,
    sortOrder: mapAutomationSortOrder(automationSortConfig.value.order)
  };
}

function applyAutomationLogsResult(result: PageResult<AutomationTaskLog>) {
  automationLogs.value = result.items;
  automationTotal.value = result.total;
}

async function loadAutomationLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildAutomationParams();
  const key = createSmartQueryKey('audit-automation-logs', params);
  const cached = getSmartQueryData<PageResult<AutomationTaskLog>>(key);

  activeAutomationQueryKey.value = key;

  if (cached) {
    applyAutomationLogsResult(cached);
  }

  automationLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.automationTasks(params),
      force: options.force ?? true
    });

    if (activeAutomationQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyAutomationLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载自动化任务日志失败');
    }
  } finally {
    if (activeAutomationQueryKey.value === key) {
      automationLoading.value = false;
    }
  }
}

async function handleAutomationSearch() {
  automationQuery.page = 1;
  await loadAutomationLogs();
}

async function handleAutomationSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  automationSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  automationQuery.page = 1;
  await loadAutomationLogs();
}

function isAutomationColumnVisible(column: string) {
  return automationVisibleColumns.value.length
    ? automationVisibleColumns.value.includes(column)
    : true;
}

function clearAutomationFilters() {
  automationQuery.page = 1;
  automationQuery.keyword = '';
  automationQuery.level = '';
  automationSavedViewId.value = '';
  automationDensity.value = 'default';
  automationSortConfig.value = {};
}

async function ensureAutomationTableViews() {
  if (automationViewsLoaded.value) return;
  await loadAutomationTableViews(true);
  automationViewsLoaded.value = true;
}

async function loadAutomationTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: automationTableKey
    });
    automationSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyAutomationView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveAutomationTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存自动化任务日志视图', {
      inputValue: '自动化任务日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: automationTableKey,
      viewName: value.trim(),
      filters: {
        keyword: automationQuery.keyword,
        level: automationQuery.level
      },
      sortConfig: automationSortConfig.value,
      columns: automationVisibleColumns.value.length
        ? automationVisibleColumns.value
        : automationColumnOptions.map((column) => column.value),
      density: automationDensity.value,
      pageSize: automationQuery.pageSize,
      isDefault: automationSavedViews.value.length === 0
    });
    await loadAutomationTableViews();
    automationSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyAutomationSavedView(id: string) {
  const view = automationSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyAutomationView(view);
  ElMessage.success('已应用保存视图');
  await loadAutomationLogs();
}

function applyAutomationView(view: UserTableView) {
  const filters = view.filters;
  automationQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  automationQuery.level = isAutomationLogLevel(filters.level) ? filters.level : '';
  automationQuery.pageSize = view.pageSize;
  automationDensity.value = 'default';
  automationVisibleColumns.value = view.columns.length
    ? normalizeAutomationColumns(view.columns)
    : automationColumnOptions.map((column) => column.value);
  automationSortConfig.value = parseAutomationSortConfig(view.sortConfig);
  automationSavedViewId.value = view.id;
}

function normalizeAutomationColumns(columns: string[]) {
  const normalized = columns
    .map((column) => (column === 'taskId' ? 'task' : column))
    .filter((column) => automationColumnOptions.some((option) => option.value === column));

  return Array.from(new Set(normalized));
}

function parseAutomationSortConfig(value: Record<string, unknown>): {
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

function mapAutomationSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function buildPlatformParams(): AuditPlatformInterfaceLogQuery {
  return {
    ...platformQuery,
    sortBy: platformSortConfig.value.prop,
    sortOrder: mapPlatformSortOrder(platformSortConfig.value.order)
  };
}

function applyPlatformLogsResult(result: PageResult<PlatformSyncLog>) {
  platformLogs.value = result.items;
  platformTotal.value = result.total;
}

async function loadPlatformLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildPlatformParams();
  const key = createSmartQueryKey('audit-platform-logs', params);
  const cached = getSmartQueryData<PageResult<PlatformSyncLog>>(key);

  activePlatformQueryKey.value = key;

  if (cached) {
    applyPlatformLogsResult(cached);
  }

  platformLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => auditLogsApi.platformInterfaces(params),
      force: options.force ?? true
    });

    if (activePlatformQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyPlatformLogsResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载平台接口日志失败');
    }
  } finally {
    if (activePlatformQueryKey.value === key) {
      platformLoading.value = false;
    }
  }
}

async function handlePlatformSearch() {
  platformQuery.page = 1;
  await loadPlatformLogs();
}

async function handlePlatformSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  platformSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  platformQuery.page = 1;
  await loadPlatformLogs();
}

function isPlatformColumnVisible(column: string) {
  return platformVisibleColumns.value.length ? platformVisibleColumns.value.includes(column) : true;
}

function clearPlatformFilters() {
  platformQuery.page = 1;
  platformQuery.keyword = '';
  platformQuery.platform = '';
  platformQuery.status = '';
  platformSavedViewId.value = '';
  platformDensity.value = 'default';
  platformSortConfig.value = {};
}

function removePlatformFilter(key: string) {
  if (key === 'platform') {
    platformQuery.platform = '';
  }
}

async function ensurePlatformTableViews() {
  if (platformViewsLoaded.value) return;
  await loadPlatformTableViews(true);
  platformViewsLoaded.value = true;
}

async function loadPlatformTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: platformTableKey
    });
    platformSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyPlatformView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function savePlatformTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存平台接口日志视图', {
      inputValue: '平台接口日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: platformTableKey,
      viewName: value.trim(),
      filters: {
        keyword: platformQuery.keyword,
        platform: platformQuery.platform,
        status: platformQuery.status
      },
      sortConfig: platformSortConfig.value,
      columns: platformVisibleColumns.value.length
        ? platformVisibleColumns.value
        : platformColumnOptions.map((column) => column.value),
      density: platformDensity.value,
      pageSize: platformQuery.pageSize,
      isDefault: platformSavedViews.value.length === 0
    });
    await loadPlatformTableViews();
    platformSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyPlatformSavedView(id: string) {
  const view = platformSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyPlatformView(view);
  ElMessage.success('已应用保存视图');
  await loadPlatformLogs();
}

function applyPlatformView(view: UserTableView) {
  const filters = view.filters;
  platformQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  platformQuery.platform = typeof filters.platform === 'string' ? filters.platform : '';
  platformQuery.status = isPlatformSyncStatus(filters.status) ? filters.status : '';
  platformQuery.pageSize = view.pageSize;
  platformDensity.value = 'default';
  platformVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        platformColumnOptions.some((option) => option.value === column)
      )
    : platformColumnOptions.map((column) => column.value);
  platformSortConfig.value = parsePlatformSortConfig(view.sortConfig);
  platformSavedViewId.value = view.id;
}

function parsePlatformSortConfig(value: Record<string, unknown>): {
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

function mapPlatformSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function showExportMessage() {
  ElMessage.info('导出日志会走数据中心导出任务，后续和保存视图一起增强');
}

function getRouteTab(moduleKey: string) {
  if (moduleKey === 'platform-interface-logs') return 'platform';
  if (moduleKey === 'automation-logs') return 'automation';
  return 'operation';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function getLoginLabel(status: LoginLogStatus) {
  return { success: '成功', failed: '失败', blocked: '阻止' }[status] ?? status;
}

function isLoginStatus(value: unknown): value is LoginLogStatus {
  return value === 'success' || value === 'failed' || value === 'blocked';
}

function getLoginTone(status: LoginLogStatus) {
  if (status === 'success') return 'green';
  if (status === 'failed') return 'red';
  return 'orange';
}

function getAutomationTone(level: AutomationTaskLog['level']) {
  if (level === 'success') return 'green';
  if (level === 'warning') return 'orange';
  if (level === 'error') return 'red';
  return 'neutral';
}

function getAutomationTaskTypeLabel(value?: string | null) {
  return (
    {
      check_status: '检测状态',
      check_balance: '查询余额',
      topup: '自动充值',
      cancel_subscription: '取消订阅',
      change_phone: '修改手机号',
      change_security: '修改密保',
      check_renewal: '检查续费'
    }[value ?? ''] ?? '自动化任务'
  );
}

function isAutomationLogLevel(value: unknown): value is AutomationTaskLog['level'] {
  return value === 'info' || value === 'warning' || value === 'error' || value === 'success';
}

function isPlatformSyncStatus(value: unknown): value is PlatformSyncLogStatus {
  return value === 'success' || value === 'failed';
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

function getJobLabel(status: string) {
  return (
    {
      pending: '待处理',
      running: '运行中',
      success: '成功',
      failed: '失败',
      cancelled: '已取消'
    }[status] ?? status
  );
}

function getJobStatusTone(status: string) {
  if (status === 'success') return 'green';
  if (status === 'running') return 'blue';
  if (status === 'failed') return 'red';
  if (status === 'cancelled') return 'neutral';
  return 'orange';
}

function getPlatformLabel(platform: string) {
  return (
    {
      taobao: '淘宝',
      xianyu: '闲鱼',
      telegram: 'Telegram',
      'file-storage': '文件存储',
      storage: '文件存储',
      'automation-service': '自动化服务',
      automation: '自动化服务'
    }[platform] ?? platform
  );
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [
    'audit-operation-logs',
    'audit-sensitive-logs',
    'audit-login-logs',
    'audit-export-logs',
    'audit-permission-logs',
    'audit-automation-logs',
    'audit-platform-logs'
  ],
  ({ scopes }) => {
    if (activeTab.value === 'operation' && scopes.includes('audit-operation-logs')) {
      void loadOperationLogs({
        background: operationLogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'sensitive' && scopes.includes('audit-sensitive-logs')) {
      void loadSensitiveLogs({
        background: sensitiveLogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'login' && scopes.includes('audit-login-logs')) {
      void loadLoginLogs({
        background: loginLogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'exports' && scopes.includes('audit-export-logs')) {
      void loadExportLogs({
        background: exportLogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'permission' && scopes.includes('audit-permission-logs')) {
      void loadPermissionLogs({
        background: permissionLogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'automation' && scopes.includes('audit-automation-logs')) {
      void loadAutomationLogs({
        background: automationLogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'platform' && scopes.includes('audit-platform-logs')) {
      void loadPlatformLogs({
        background: platformLogs.value.length > 0,
        force: true
      });
    }
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar-search {
  width: min(360px, 100%);
  min-width: 0;
}

.toolbar-select {
  width: min(150px, 100%);
  min-width: 0;
}

.system-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.system-compact-list-panel .inline-actions {
  max-width: min(620px, 100%);
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (max-width: 760px) {
  .toolbar-search,
  .toolbar-select {
    width: 100%;
  }

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
