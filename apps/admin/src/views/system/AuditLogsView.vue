<template>
  <PageScaffold
    title="审计日志中心"
    group="系统管理"
    phase="Phase 14"
    description="统一查看操作日志、敏感查看日志、登录日志、导出日志、权限变更日志、自动化任务日志和平台接口日志。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="操作日志" :value="operationTotal" hint="当前筛选结果" tone="blue" />
      <MetricCard label="敏感查看" :value="sensitiveTotal" hint="敏感字段访问记录" tone="orange" />
      <MetricCard label="登录日志" :value="loginTotal" hint="登录成功、失败和异常" tone="green" />
      <MetricCard
        label="平台接口"
        :value="platformTotal"
        hint="同步、测试和授权记录"
        tone="purple"
      />
    </div>

    <section class="content-panel">
      <el-tabs v-model="activeTab" @tab-change="refreshCurrentTab">
        <el-tab-pane label="操作日志" name="operation">
          <TableToolbar
            v-model:keyword="operationQuery.keyword"
            v-model:density="operationDensity"
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
            @refresh="loadOperationLogs"
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
            :data="operationLogs"
            :size="operationTableSize"
            row-key="id"
            empty-text="暂无操作日志"
            @sort-change="handleOperationSortChange"
          >
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
          <PaginationBar
            v-model:page="operationQuery.page"
            v-model:page-size="operationQuery.pageSize"
            :total="operationTotal"
            @change="loadOperationLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="敏感查看日志" name="sensitive">
          <TableToolbar
            v-model:keyword="sensitiveQuery.keyword"
            v-model:status="sensitiveQuery.approved"
            v-model:density="sensitiveDensity"
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
            @refresh="loadSensitiveLogs"
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
            :data="sensitiveLogs"
            :size="sensitiveTableSize"
            row-key="id"
            empty-text="暂无敏感查看日志"
            @sort-change="handleSensitiveSortChange"
          >
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
                <el-tag :type="row.approved ? 'success' : 'warning'" size="small" effect="light">
                  {{ row.approved ? '已审批' : '未审批' }}
                </el-tag>
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
          <PaginationBar
            v-model:page="sensitiveQuery.page"
            v-model:page-size="sensitiveQuery.pageSize"
            :total="sensitiveTotal"
            @change="loadSensitiveLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="登录日志" name="login">
          <TableToolbar
            v-model:keyword="loginQuery.keyword"
            v-model:status="loginQuery.status"
            v-model:density="loginDensity"
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
            @refresh="loadLoginLogs"
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
            :data="loginLogs"
            :size="loginTableSize"
            row-key="id"
            empty-text="暂无登录日志"
            @sort-change="handleLoginSortChange"
          >
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
                <el-tag :type="getLoginTagType(row.status)" size="small" effect="light">
                  {{ getLoginLabel(row.status) }}
                </el-tag>
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
          <PaginationBar
            v-model:page="loginQuery.page"
            v-model:page-size="loginQuery.pageSize"
            :total="loginTotal"
            @change="loadLoginLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="导出日志" name="exports">
          <TableToolbar
            v-model:keyword="exportQuery.keyword"
            v-model:status="exportQuery.status"
            v-model:density="exportDensity"
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
            @refresh="loadExportLogs"
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
            :data="exportLogs"
            :size="exportTableSize"
            row-key="id"
            empty-text="暂无导出日志"
            @sort-change="handleExportSortChange"
          >
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
              <template #default="{ row }"><JobStatusTag :status="row.status" /></template>
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
          <PaginationBar
            v-model:page="exportQuery.page"
            v-model:page-size="exportQuery.pageSize"
            :total="exportTotal"
            @change="loadExportLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="权限变更日志" name="permission">
          <TableToolbar
            v-model:keyword="permissionQuery.keyword"
            v-model:density="permissionDensity"
            v-model:visible-columns="permissionVisibleColumns"
            v-model:saved-view-id="permissionSavedViewId"
            :column-options="permissionColumnOptions"
            :saved-views="permissionSavedViews"
            :show-status="false"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索权限、角色、备注"
            @search="handlePermissionSearch"
            @refresh="loadPermissionLogs"
            @clear-filters="clearPermissionFilters"
            @save-view="savePermissionTableView"
            @apply-view="applyPermissionSavedView"
            @export="showExportMessage"
          />

          <el-table
            v-loading="permissionLoading"
            :data="permissionLogs"
            :size="permissionTableSize"
            row-key="id"
            empty-text="暂无权限变更日志"
            @sort-change="handlePermissionSortChange"
          >
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
          <PaginationBar
            v-model:page="permissionQuery.page"
            v-model:page-size="permissionQuery.pageSize"
            :total="permissionTotal"
            @change="loadPermissionLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="自动化任务日志" name="automation">
          <TableToolbar
            v-model:keyword="automationQuery.keyword"
            v-model:status="automationQuery.level"
            v-model:density="automationDensity"
            v-model:visible-columns="automationVisibleColumns"
            v-model:saved-view-id="automationSavedViewId"
            :column-options="automationColumnOptions"
            :status-options="automationLevelOptions"
            :saved-views="automationSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索任务消息、错误码、队列 ID"
            @search="handleAutomationSearch"
            @refresh="loadAutomationLogs"
            @clear-filters="clearAutomationFilters"
            @save-view="saveAutomationTableView"
            @apply-view="applyAutomationSavedView"
            @export="showExportMessage"
          />

          <el-table
            v-loading="automationLoading"
            :data="automationLogs"
            :size="automationTableSize"
            row-key="id"
            empty-text="暂无自动化任务日志"
            @sort-change="handleAutomationSortChange"
          >
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
              v-if="isAutomationColumnVisible('taskId')"
              label="任务"
              prop="taskId"
              min-width="220"
              sortable="custom"
              show-overflow-tooltip
            >
              <template #default="{ row }"
                >{{ row.task?.taskType ?? '-' }} / {{ row.taskId }}</template
              >
            </el-table-column>
            <el-table-column
              v-if="isAutomationColumnVisible('level')"
              label="级别"
              prop="level"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="getAutomationTagType(row.level)" size="small" effect="light">
                  {{ row.level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column v-if="isAutomationColumnVisible('status')" label="状态" width="120">
              <template #default="{ row }">{{ row.task?.status ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAutomationColumnVisible('queueJobId')"
              label="队列 ID"
              min-width="160"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.task?.queueJobId ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAutomationColumnVisible('errorCode')"
              label="错误码"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.task?.errorCode ?? '-' }}</template>
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
          <PaginationBar
            v-model:page="automationQuery.page"
            v-model:page-size="automationQuery.pageSize"
            :total="automationTotal"
            @change="loadAutomationLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="平台接口日志" name="platform">
          <TableToolbar
            v-model:keyword="platformQuery.keyword"
            v-model:status="platformQuery.status"
            v-model:density="platformDensity"
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
            @refresh="loadPlatformLogs"
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
            :data="platformLogs"
            :size="platformTableSize"
            row-key="id"
            empty-text="暂无平台接口日志"
            @sort-change="handlePlatformSortChange"
          >
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
                <el-tag
                  :type="row.status === 'success' ? 'success' : 'danger'"
                  size="small"
                  effect="light"
                >
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
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
          <PaginationBar
            v-model:page="platformQuery.page"
            v-model:page-size="platformQuery.pageSize"
            :total="platformTotal"
            @change="loadPlatformLogs"
          />
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, reactive, ref, resolveComponent, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { auditLogsApi, userTableViewsApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  AuditLog,
  AutomationTaskLog,
  DataExportJob,
  DataJobStatus,
  LoginLog,
  LoginLogStatus,
  PlatformSyncLog,
  PlatformSyncLogStatus,
  SensitiveAccessLog,
  TableDensity,
  UserTableView
} from '@/types/system';

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
  { label: '任务', value: 'taskId' },
  { label: '级别', value: 'level' },
  { label: '状态', value: 'status' },
  { label: '队列 ID', value: 'queueJobId' },
  { label: '错误码', value: 'errorCode' },
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

const PaginationBar = defineComponent({
  props: {
    page: { type: Number, required: true },
    pageSize: { type: Number, required: true },
    total: { type: Number, required: true }
  },
  emits: ['update:page', 'update:pageSize', 'change'],
  setup(props, { emit }) {
    const ElPagination = resolveComponent('ElPagination');
    return () =>
      h(
        'div',
        { class: 'pagination-row' },
        h(ElPagination, {
          currentPage: props.page,
          pageSize: props.pageSize,
          total: props.total,
          pageSizes: [10, 20, 50, 100],
          layout: 'total, sizes, prev, pager, next',
          onCurrentChange: (value: number) => {
            emit('update:page', value);
            emit('change');
          },
          onSizeChange: (value: number) => {
            emit('update:pageSize', value);
            emit('update:page', 1);
            emit('change');
          }
        })
      );
  }
});

const JobStatusTag = defineComponent({
  props: {
    status: { type: String, required: true }
  },
  setup(props) {
    const ElTag = resolveComponent('ElTag');
    return () =>
      h(ElTag, { type: getJobTagType(props.status), size: 'small', effect: 'light' }, () =>
        getJobLabel(props.status)
      );
  }
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

async function loadOperationLogs() {
  operationLoading.value = true;
  try {
    const result = await auditLogsApi.operation({
      ...operationQuery,
      sortBy: operationSortConfig.value.prop,
      sortOrder: mapOperationSortOrder(operationSortConfig.value.order)
    });
    operationLogs.value = result.items;
    operationTotal.value = result.total;
  } finally {
    operationLoading.value = false;
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
  operationDensity.value = view.density;
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

async function loadSensitiveLogs() {
  sensitiveLoading.value = true;
  try {
    const result = await auditLogsApi.sensitiveAccess({
      ...sensitiveQuery,
      sortBy: sensitiveSortConfig.value.prop,
      sortOrder: mapSensitiveSortOrder(sensitiveSortConfig.value.order)
    });
    sensitiveLogs.value = result.items;
    sensitiveTotal.value = result.total;
  } finally {
    sensitiveLoading.value = false;
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
  sensitiveDensity.value = view.density;
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

async function loadLoginLogs() {
  loginLoading.value = true;
  try {
    const result = await auditLogsApi.login({
      ...loginQuery,
      sortBy: loginSortConfig.value.prop,
      sortOrder: mapLoginSortOrder(loginSortConfig.value.order)
    });
    loginLogs.value = result.items;
    loginTotal.value = result.total;
  } finally {
    loginLoading.value = false;
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
  loginDensity.value = view.density;
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

async function loadExportLogs() {
  exportLoading.value = true;
  try {
    const result = await auditLogsApi.exports({
      ...exportQuery,
      sortBy: exportSortConfig.value.prop,
      sortOrder: mapExportSortOrder(exportSortConfig.value.order)
    });
    exportLogs.value = result.items;
    exportTotal.value = result.total;
  } finally {
    exportLoading.value = false;
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
  exportDensity.value = view.density;
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

async function loadPermissionLogs() {
  permissionLoading.value = true;
  try {
    const result = await auditLogsApi.permissionChanges({
      ...permissionQuery,
      sortBy: permissionSortConfig.value.prop,
      sortOrder: mapPermissionSortOrder(permissionSortConfig.value.order)
    });
    permissionLogs.value = result.items;
    permissionTotal.value = result.total;
  } finally {
    permissionLoading.value = false;
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
  permissionDensity.value = view.density;
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

async function loadAutomationLogs() {
  automationLoading.value = true;
  try {
    const result = await auditLogsApi.automationTasks({
      ...automationQuery,
      sortBy: automationSortConfig.value.prop,
      sortOrder: mapAutomationSortOrder(automationSortConfig.value.order)
    });
    automationLogs.value = result.items;
    automationTotal.value = result.total;
  } finally {
    automationLoading.value = false;
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
  automationDensity.value = view.density;
  automationVisibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        automationColumnOptions.some((option) => option.value === column)
      )
    : automationColumnOptions.map((column) => column.value);
  automationSortConfig.value = parseAutomationSortConfig(view.sortConfig);
  automationSavedViewId.value = view.id;
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

async function loadPlatformLogs() {
  platformLoading.value = true;
  try {
    const result = await auditLogsApi.platformInterfaces({
      ...platformQuery,
      sortBy: platformSortConfig.value.prop,
      sortOrder: mapPlatformSortOrder(platformSortConfig.value.order)
    });
    platformLogs.value = result.items;
    platformTotal.value = result.total;
  } finally {
    platformLoading.value = false;
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
  platformDensity.value = view.density;
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

function getLoginTagType(status: LoginLogStatus) {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'danger';
  return 'warning';
}

function getAutomationTagType(level: AutomationTaskLog['level']) {
  if (level === 'success') return 'success';
  if (level === 'warning') return 'warning';
  if (level === 'error') return 'danger';
  return 'info';
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

function getJobTagType(status: string) {
  if (status === 'success') return 'success';
  if (status === 'running') return 'primary';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'info';
  return 'warning';
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
</script>

<style scoped>
.content-panel {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-color);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar-search {
  width: min(360px, 100%);
}

.toolbar-select {
  width: 150px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

@media (max-width: 760px) {
  .toolbar-search,
  .toolbar-select {
    width: 100%;
  }
}
</style>
