<template>
  <PageScaffold
    title="安全中心"
    group="系统管理"
    phase="Phase 10"
    description="集中管理登录日志、在线会话、密码策略、MFA、IP 白名单和敏感字段审批。"
  >
    <template #actions>
      <el-button @click="refreshCurrentTab">刷新</el-button>
      <el-button v-if="activeTab === 'ip'" type="primary" @click="openIpDialog()"
        >新增 IP 规则</el-button
      >
      <el-button v-if="activeTab === 'approvals'" type="primary" @click="openApprovalDialog">
        新增审批申请
      </el-button>
    </template>

    <div class="metric-grid metric-grid--five">
      <MetricCard
        label="失败登录"
        :value="overview?.failedLoginCount ?? '-'"
        hint="需要关注暴力尝试"
        tone="red"
      />
      <MetricCard
        label="异常登录"
        :value="overview?.abnormalLoginCount ?? '-'"
        hint="由安全规则识别"
        tone="orange"
      />
      <MetricCard
        label="在线会话"
        :value="overview?.activeSessionCount ?? '-'"
        hint="未过期且未下线"
        tone="blue"
      />
      <MetricCard
        label="待审批"
        :value="overview?.pendingApprovalCount ?? '-'"
        hint="敏感字段访问"
        tone="purple"
      />
      <MetricCard
        label="白名单"
        :value="overview?.enabledWhitelistCount ?? '-'"
        hint="启用中的规则"
        tone="green"
      />
    </div>

    <section class="content-panel">
      <el-tabs v-model="activeTab" @tab-change="refreshCurrentTab">
        <el-tab-pane label="总览" name="overview">
          <el-table :data="overview?.recentLoginLogs ?? []" row-key="id">
            <el-table-column label="账号" min-width="150" prop="username" />
            <el-table-column label="结果" width="110">
              <template #default="{ row }">
                <el-tag :type="getLoginStatusType(row.status)" size="small" effect="light">
                  {{ getLoginStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="IP" min-width="140" prop="ip" />
            <el-table-column label="原因" min-width="180" prop="failureReason" />
            <el-table-column label="时间" min-width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="登录日志" name="loginLogs">
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
            placeholder="搜索账号、IP、失败原因"
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
                clearable
                placeholder="异常"
                @change="handleLoginSearch"
              >
                <el-option label="异常" value="true" />
                <el-option label="正常" value="false" />
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
              v-if="isLoginColumnVisible('username')"
              label="账号"
              min-width="150"
              prop="username"
              sortable="custom"
            />
            <el-table-column v-if="isLoginColumnVisible('user')" label="用户" min-width="150">
              <template #default="{ row }">{{ row.user?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isLoginColumnVisible('status')"
              label="结果"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="getLoginStatusType(row.status)" size="small" effect="light">
                  {{ getLoginStatusLabel(row.status) }}
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
              <template #default="{ row }">
                <el-tag :type="row.abnormal ? 'danger' : 'info'" size="small" effect="light">
                  {{ row.abnormal ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isLoginColumnVisible('ip')"
              label="IP"
              min-width="140"
              prop="ip"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isLoginColumnVisible('userAgent')"
              label="User-Agent"
              min-width="240"
              prop="userAgent"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isLoginColumnVisible('createdAt')"
              label="时间"
              prop="createdAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="loginQuery.page"
            v-model:page-size="loginQuery.pageSize"
            :total="loginTotal"
            @change="loadLoginLogs"
          />
        </el-tab-pane>

        <el-tab-pane label="在线会话" name="sessions">
          <TableToolbar
            v-model:keyword="sessionQuery.keyword"
            v-model:status="sessionQuery.revoked"
            v-model:density="sessionDensity"
            v-model:visible-columns="sessionVisibleColumns"
            v-model:saved-view-id="sessionSavedViewId"
            :column-options="sessionColumnOptions"
            :status-options="sessionStatusOptions"
            :saved-views="sessionSavedViews"
            :filter-chips="sessionFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索用户、IP、User-Agent"
            @search="handleSessionSearch"
            @refresh="loadSessions"
            @clear-filters="clearSessionFilters"
            @remove-filter="removeSessionFilter"
            @save-view="saveSessionTableView"
            @apply-view="applySessionSavedView"
            @export="showExportMessage"
          />

          <el-table
            v-loading="sessionLoading"
            :data="sessions"
            :size="sessionTableSize"
            row-key="id"
            empty-text="暂无在线会话"
            @sort-change="handleSessionSortChange"
          >
            <el-table-column v-if="isSessionColumnVisible('user')" label="用户" min-width="170">
              <template #default="{ row }"
                >{{ row.user.displayName }} / {{ row.user.username }}</template
              >
            </el-table-column>
            <el-table-column
              v-if="isSessionColumnVisible('ip')"
              label="IP"
              min-width="140"
              prop="ip"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isSessionColumnVisible('userAgent')"
              label="User-Agent"
              min-width="260"
              prop="userAgent"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isSessionColumnVisible('lastActiveAt')"
              label="最近活跃"
              prop="lastActiveAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.lastActiveAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isSessionColumnVisible('expiresAt')"
              label="过期时间"
              prop="expiresAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.expiresAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isSessionColumnVisible('status')"
              label="状态"
              prop="revokedAt"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="row.revokedAt ? 'info' : 'success'" size="small" effect="light">
                  {{ row.revokedAt ? '已下线' : '在线' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="danger"
                  :disabled="Boolean(row.revokedAt)"
                  @click="revoke(row.id)"
                >
                  下线
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="sessionQuery.page"
            v-model:page-size="sessionQuery.pageSize"
            :total="sessionTotal"
            @change="loadSessions"
          />
        </el-tab-pane>

        <el-tab-pane label="策略设置" name="settings">
          <div class="settings-grid">
            <div class="settings-panel">
              <h3>密码策略</h3>
              <el-form label-width="120px">
                <el-form-item label="最小长度">
                  <el-input-number v-model="passwordPolicy.minLength" :min="6" :max="64" />
                </el-form-item>
                <el-form-item label="大写字母"
                  ><el-switch v-model="passwordPolicy.requireUppercase"
                /></el-form-item>
                <el-form-item label="小写字母"
                  ><el-switch v-model="passwordPolicy.requireLowercase"
                /></el-form-item>
                <el-form-item label="数字"
                  ><el-switch v-model="passwordPolicy.requireNumber"
                /></el-form-item>
                <el-form-item label="符号"
                  ><el-switch v-model="passwordPolicy.requireSymbol"
                /></el-form-item>
                <el-form-item label="失败次数">
                  <el-input-number v-model="passwordPolicy.maxFailedAttempts" :min="1" :max="20" />
                </el-form-item>
                <el-button type="primary" @click="savePasswordPolicy">保存密码策略</el-button>
              </el-form>
            </div>
            <div class="settings-panel">
              <h3>MFA 设置</h3>
              <el-form label-width="120px">
                <el-form-item label="启用 MFA"
                  ><el-switch v-model="mfaSettings.enabled"
                /></el-form-item>
                <el-form-item label="管理员强制">
                  <el-switch v-model="mfaSettings.requiredForAdmins" />
                </el-form-item>
                <el-form-item label="签发方">
                  <el-input v-model="mfaSettings.issuer" />
                </el-form-item>
                <el-button type="primary" @click="saveMfaSettings">保存 MFA 设置</el-button>
              </el-form>

              <el-divider />
              <div class="mfa-account">
                <div class="mfa-account__header">
                  <h4>我的 MFA</h4>
                  <el-tag
                    :type="myMfaStatus?.enabled ? 'success' : 'info'"
                    size="small"
                    effect="light"
                  >
                    {{ myMfaStatus?.enabled ? '已启用' : '未启用' }}
                  </el-tag>
                </div>
                <div class="mfa-account__meta">
                  <span>恢复码：{{ myMfaStatus?.recoveryCodeCount ?? 0 }} 个</span>
                  <span>最近使用：{{ formatDate(myMfaStatus?.lastUsedAt) }}</span>
                </div>

                <el-form label-width="120px">
                  <el-form-item v-if="mfaSetup" label="密钥">
                    <el-input :model-value="mfaSetup.secret" readonly />
                  </el-form-item>
                  <el-form-item v-if="mfaSetup" label="绑定 URI">
                    <el-input
                      :model-value="mfaSetup.otpauthUrl"
                      type="textarea"
                      :rows="3"
                      readonly
                    />
                  </el-form-item>
                  <el-form-item label="验证码">
                    <el-input
                      v-model.trim="mfaVerifyCode"
                      autocomplete="one-time-code"
                      placeholder="动态验证码或恢复码"
                    />
                  </el-form-item>
                  <el-form-item v-if="myMfaStatus?.enabled" label="停用原因">
                    <el-input v-model.trim="mfaDisableReason" placeholder="可选" />
                  </el-form-item>
                  <div class="mfa-actions">
                    <el-button :loading="mfaActionLoading" @click="setupMyMfa">
                      生成绑定密钥
                    </el-button>
                    <el-button
                      v-if="mfaSetup"
                      type="primary"
                      :loading="mfaActionLoading"
                      @click="enableMyMfa"
                    >
                      启用 MFA
                    </el-button>
                    <el-button
                      v-if="myMfaStatus?.enabled"
                      :loading="mfaActionLoading"
                      @click="regenerateMfaRecoveryCodes"
                    >
                      重新生成恢复码
                    </el-button>
                    <el-button
                      v-if="myMfaStatus?.enabled"
                      type="danger"
                      :loading="mfaActionLoading"
                      @click="disableMyMfa"
                    >
                      停用 MFA
                    </el-button>
                  </div>
                </el-form>

                <el-alert
                  v-if="mfaRecoveryCodes.length"
                  type="warning"
                  show-icon
                  :closable="false"
                  class="mfa-recovery-alert"
                >
                  <template #title>恢复码只显示一次</template>
                  <div class="mfa-recovery-grid">
                    <code v-for="code in mfaRecoveryCodes" :key="code">{{ code }}</code>
                  </div>
                </el-alert>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="IP 白名单" name="ip">
          <TableToolbar
            v-model:keyword="ipQuery.keyword"
            v-model:status="ipQuery.enabled"
            v-model:density="ipDensity"
            v-model:visible-columns="ipVisibleColumns"
            v-model:saved-view-id="ipSavedViewId"
            :column-options="ipColumnOptions"
            :status-options="enabledStatusOptions"
            :saved-views="ipSavedViews"
            :filter-chips="ipFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索 IP/CIDR 或备注"
            @search="handleIpSearch"
            @refresh="loadIpWhitelists"
            @clear-filters="clearIpFilters"
            @remove-filter="removeIpFilter"
            @save-view="saveIpTableView"
            @apply-view="applyIpSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="ipQuery.scope"
                class="table-toolbar__select"
                clearable
                placeholder="范围"
                @change="handleIpSearch"
              >
                <el-option
                  v-for="option in ipScopeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </TableToolbar>

          <el-table
            v-loading="ipLoading"
            :data="ipWhitelists"
            :size="ipTableSize"
            row-key="id"
            empty-text="暂无 IP 白名单"
            @sort-change="handleIpSortChange"
          >
            <el-table-column
              v-if="isIpColumnVisible('ipOrCidr')"
              label="IP/CIDR"
              min-width="160"
              prop="ipOrCidr"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isIpColumnVisible('scope')"
              label="范围"
              prop="scope"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">{{ getIpScopeLabel(row.scope) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isIpColumnVisible('enabled')"
              label="启用"
              prop="enabled"
              width="90"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="light">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isIpColumnVisible('remark')"
              label="备注"
              min-width="220"
              prop="remark"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isIpColumnVisible('updatedAt')"
              label="更新时间"
              prop="updatedAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="openIpDialog(row)">编辑</el-button>
                <el-button text type="danger" @click="removeIp(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="ipQuery.page"
            v-model:page-size="ipQuery.pageSize"
            :total="ipTotal"
            @change="loadIpWhitelists"
          />
        </el-tab-pane>

        <el-tab-pane label="敏感审批" name="approvals">
          <TableToolbar
            v-model:keyword="approvalQuery.keyword"
            v-model:status="approvalQuery.status"
            v-model:density="approvalDensity"
            v-model:visible-columns="approvalVisibleColumns"
            v-model:saved-view-id="approvalSavedViewId"
            :column-options="approvalColumnOptions"
            :status-options="approvalStatusOptions"
            :saved-views="approvalSavedViews"
            :filter-chips="approvalFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、字段、对象、原因"
            @search="handleApprovalSearch"
            @refresh="loadApprovals"
            @clear-filters="clearApprovalFilters"
            @remove-filter="removeApprovalFilter"
            @save-view="saveApprovalTableView"
            @apply-view="applyApprovalSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-input
                v-model="approvalQuery.module"
                class="table-toolbar__select"
                clearable
                placeholder="模块"
                @keyup.enter="handleApprovalSearch"
                @clear="handleApprovalSearch"
              />
            </template>
          </TableToolbar>

          <el-table
            v-loading="approvalLoading"
            :data="approvals"
            :size="approvalTableSize"
            row-key="id"
            empty-text="暂无敏感审批"
            @sort-change="handleApprovalSortChange"
          >
            <el-table-column
              v-if="isApprovalColumnVisible('requester')"
              label="申请人"
              min-width="150"
            >
              <template #default="{ row }">{{ row.requester.displayName }}</template>
            </el-table-column>
            <el-table-column
              v-if="isApprovalColumnVisible('field')"
              label="字段"
              prop="fieldName"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ row.module }} / {{ row.fieldName }}</template>
            </el-table-column>
            <el-table-column
              v-if="isApprovalColumnVisible('object')"
              label="对象"
              prop="objectType"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }"
                >{{ row.objectType }} / {{ row.objectId ?? '-' }}</template
              >
            </el-table-column>
            <el-table-column
              v-if="isApprovalColumnVisible('reason')"
              label="原因"
              min-width="220"
              prop="reason"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isApprovalColumnVisible('status')"
              label="状态"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="getApprovalStatusType(row.status)" size="small" effect="light">
                  {{ getApprovalStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isApprovalColumnVisible('createdAt')"
              label="申请时间"
              prop="createdAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="success"
                  :disabled="row.status !== 'pending'"
                  @click="approve(row.id)"
                >
                  批准
                </el-button>
                <el-button
                  text
                  type="danger"
                  :disabled="row.status !== 'pending'"
                  @click="reject(row.id)"
                >
                  拒绝
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="approvalQuery.page"
            v-model:page-size="approvalQuery.pageSize"
            :total="approvalTotal"
            @change="loadApprovals"
          />
        </el-tab-pane>

        <el-tab-pane label="敏感查看日志" name="accessLogs">
          <TableToolbar
            v-model:keyword="accessLogQuery.keyword"
            v-model:status="accessLogQuery.approved"
            v-model:density="accessLogDensity"
            v-model:visible-columns="accessLogVisibleColumns"
            v-model:saved-view-id="accessLogSavedViewId"
            :column-options="accessLogColumnOptions"
            :status-options="approvedStatusOptions"
            :saved-views="accessLogSavedViews"
            :filter-chips="accessLogFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模块、字段、对象、原因"
            @search="handleAccessLogSearch"
            @refresh="loadAccessLogs"
            @clear-filters="clearAccessLogFilters"
            @remove-filter="removeAccessLogFilter"
            @save-view="saveAccessLogTableView"
            @apply-view="applyAccessLogSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-input
                v-model="accessLogQuery.module"
                class="table-toolbar__select"
                clearable
                placeholder="模块"
                @keyup.enter="handleAccessLogSearch"
                @clear="handleAccessLogSearch"
              />
            </template>
          </TableToolbar>

          <el-table
            v-loading="accessLogLoading"
            :data="accessLogs"
            :size="accessLogTableSize"
            row-key="id"
            empty-text="暂无敏感查看日志"
            @sort-change="handleAccessLogSortChange"
          >
            <el-table-column v-if="isAccessLogColumnVisible('user')" label="用户" min-width="150">
              <template #default="{ row }">{{ row.user?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAccessLogColumnVisible('field')"
              label="字段"
              prop="fieldName"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }">{{ row.module }} / {{ row.fieldName }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAccessLogColumnVisible('object')"
              label="对象"
              prop="objectType"
              min-width="180"
              sortable="custom"
            >
              <template #default="{ row }"
                >{{ row.objectType }} / {{ row.objectId ?? '-' }}</template
              >
            </el-table-column>
            <el-table-column
              v-if="isAccessLogColumnVisible('approved')"
              label="已审批"
              prop="approved"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }">{{ row.approved ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAccessLogColumnVisible('accessReason')"
              label="原因"
              min-width="220"
              prop="accessReason"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isAccessLogColumnVisible('ip')"
              label="IP"
              prop="ip"
              min-width="140"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isAccessLogColumnVisible('createdAt')"
              label="时间"
              prop="createdAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="accessLogQuery.page"
            v-model:page-size="accessLogQuery.pageSize"
            :total="accessLogTotal"
            @change="loadAccessLogs"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="ipDialogVisible"
      :title="editingIp?.id ? '编辑 IP 规则' : '新增 IP 规则'"
      width="520px"
    >
      <el-form label-width="100px">
        <el-form-item label="IP/CIDR" required><el-input v-model="ipForm.ipOrCidr" /></el-form-item>
        <el-form-item label="范围">
          <el-select v-model="ipForm.scope">
            <el-option label="后台" value="admin" />
            <el-option label="API" value="api" />
            <el-option label="自动化" value="automation" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用"><el-switch v-model="ipForm.enabled" /></el-form-item>
        <el-form-item label="备注"
          ><el-input v-model="ipForm.remark" type="textarea" :rows="3"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ipDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingIp" @click="saveIp">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="approvalDialogVisible" title="新增敏感字段审批申请" width="560px">
      <el-form label-width="110px">
        <el-form-item label="模块" required
          ><el-input v-model="approvalForm.module"
        /></el-form-item>
        <el-form-item label="字段" required
          ><el-input v-model="approvalForm.fieldName"
        /></el-form-item>
        <el-form-item label="对象类型" required
          ><el-input v-model="approvalForm.objectType"
        /></el-form-item>
        <el-form-item label="对象 ID"><el-input v-model="approvalForm.objectId" /></el-form-item>
        <el-form-item label="原因" required>
          <el-input v-model="approvalForm.reason" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approvalDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingApproval" @click="createApproval">提交</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { securityApi, userTableViewsApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  ActiveSession,
  IpWhitelist,
  IpWhitelistScope,
  LoginLog,
  LoginLogStatus,
  MyMfaEnableResult,
  MyMfaSetup,
  MyMfaStatus,
  SecurityOverview,
  SensitiveAccessApproval,
  SensitiveAccessApprovalStatus,
  SensitiveAccessLog,
  TableDensity,
  UserTableView
} from '@/types/system';

const route = useRoute();
const activeTab = ref(getInitialTab());
const overview = ref<SecurityOverview | null>(null);
const loginTableKey = 'security_login_logs';
const sessionTableKey = 'security_active_sessions';
const ipTableKey = 'security_ip_whitelists';
const approvalTableKey = 'security_sensitive_access_approvals';
const accessLogTableKey = 'security_sensitive_access_logs';
const loginStatusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
  { label: '拦截', value: 'blocked' }
];
const sessionStatusOptions = [
  { label: '在线', value: 'false' },
  { label: '已下线', value: 'true' }
];
const enabledStatusOptions = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' }
];
const approvedStatusOptions = [
  { label: '已审批', value: 'true' },
  { label: '未审批', value: 'false' }
];
const approvalStatusOptions = [
  { label: '待审批', value: 'pending' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已过期', value: 'expired' }
];
const ipScopeOptions = [
  { label: '后台', value: 'admin' },
  { label: 'API', value: 'api' },
  { label: '自动化', value: 'automation' }
];
const loginColumnOptions = [
  { label: '账号', value: 'username', required: true },
  { label: '用户', value: 'user' },
  { label: '结果', value: 'status' },
  { label: '异常', value: 'abnormal' },
  { label: 'IP', value: 'ip' },
  { label: 'User-Agent', value: 'userAgent' },
  { label: '时间', value: 'createdAt' }
];
const sessionColumnOptions = [
  { label: '用户', value: 'user', required: true },
  { label: 'IP', value: 'ip' },
  { label: 'User-Agent', value: 'userAgent' },
  { label: '最近活跃', value: 'lastActiveAt' },
  { label: '过期时间', value: 'expiresAt' },
  { label: '状态', value: 'status' }
];
const ipColumnOptions = [
  { label: 'IP/CIDR', value: 'ipOrCidr', required: true },
  { label: '范围', value: 'scope' },
  { label: '启用', value: 'enabled' },
  { label: '备注', value: 'remark' },
  { label: '更新时间', value: 'updatedAt' }
];
const approvalColumnOptions = [
  { label: '申请人', value: 'requester', required: true },
  { label: '字段', value: 'field' },
  { label: '对象', value: 'object' },
  { label: '原因', value: 'reason' },
  { label: '状态', value: 'status' },
  { label: '申请时间', value: 'createdAt' }
];
const accessLogColumnOptions = [
  { label: '用户', value: 'user', required: true },
  { label: '字段', value: 'field' },
  { label: '对象', value: 'object' },
  { label: '已审批', value: 'approved' },
  { label: '原因', value: 'accessReason' },
  { label: 'IP', value: 'ip' },
  { label: '时间', value: 'createdAt' }
];

const loginLogs = ref<LoginLog[]>([]);
const loginTotal = ref(0);
const loginLoading = ref(false);
const loginQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as LoginLogStatus | '',
  abnormal: ''
});
const loginDensity = ref<TableDensity>('default');
const loginVisibleColumns = ref<string[]>([]);
const loginSavedViews = ref<UserTableView[]>([]);
const loginSavedViewId = ref('');
const loginSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const loginViewsLoaded = ref(false);

const sessions = ref<ActiveSession[]>([]);
const sessionTotal = ref(0);
const sessionLoading = ref(false);
const sessionQuery = reactive({ page: 1, pageSize: 10, keyword: '', revoked: 'false' });
const sessionDensity = ref<TableDensity>('default');
const sessionVisibleColumns = ref<string[]>([]);
const sessionSavedViews = ref<UserTableView[]>([]);
const sessionSavedViewId = ref('');
const sessionSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const sessionViewsLoaded = ref(false);

const ipWhitelists = ref<IpWhitelist[]>([]);
const ipTotal = ref(0);
const ipLoading = ref(false);
const ipQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  scope: '' as IpWhitelistScope | '',
  enabled: ''
});
const ipDensity = ref<TableDensity>('default');
const ipVisibleColumns = ref<string[]>([]);
const ipSavedViews = ref<UserTableView[]>([]);
const ipSavedViewId = ref('');
const ipSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const ipViewsLoaded = ref(false);

const approvals = ref<SensitiveAccessApproval[]>([]);
const approvalTotal = ref(0);
const approvalLoading = ref(false);
const approvalQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as SensitiveAccessApprovalStatus | '',
  module: ''
});
const approvalDensity = ref<TableDensity>('default');
const approvalVisibleColumns = ref<string[]>([]);
const approvalSavedViews = ref<UserTableView[]>([]);
const approvalSavedViewId = ref('');
const approvalSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const approvalViewsLoaded = ref(false);

const accessLogs = ref<SensitiveAccessLog[]>([]);
const accessLogTotal = ref(0);
const accessLogLoading = ref(false);
const accessLogQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  module: '',
  fieldName: '',
  approved: ''
});
const accessLogDensity = ref<TableDensity>('default');
const accessLogVisibleColumns = ref<string[]>([]);
const accessLogSavedViews = ref<UserTableView[]>([]);
const accessLogSavedViewId = ref('');
const accessLogSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const accessLogViewsLoaded = ref(false);

const passwordPolicy = reactive({
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
  maxFailedAttempts: 5
});
const mfaSettings = reactive({
  enabled: false,
  requiredForAdmins: false,
  issuer: '代充管理后台'
});
const myMfaStatus = ref<MyMfaStatus | null>(null);
const mfaSetup = ref<MyMfaSetup | null>(null);
const mfaRecoveryCodes = ref<string[]>([]);
const mfaVerifyCode = ref('');
const mfaDisableReason = ref('');
const mfaActionLoading = ref(false);

const ipDialogVisible = ref(false);
const savingIp = ref(false);
const editingIp = ref<IpWhitelist | null>(null);
const ipForm = reactive({
  ipOrCidr: '',
  scope: 'admin' as IpWhitelist['scope'],
  enabled: true,
  remark: ''
});

const approvalDialogVisible = ref(false);
const savingApproval = ref(false);
const approvalForm = reactive({
  module: '',
  fieldName: '',
  objectType: '',
  objectId: '',
  reason: ''
});
const loginTableSize = computed(() => getTableSize(loginDensity.value));
const sessionTableSize = computed(() => getTableSize(sessionDensity.value));
const ipTableSize = computed(() => getTableSize(ipDensity.value));
const approvalTableSize = computed(() => getTableSize(approvalDensity.value));
const accessLogTableSize = computed(() => getTableSize(accessLogDensity.value));
const loginFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const abnormalLabel =
    loginQuery.abnormal === 'true' ? '异常' : loginQuery.abnormal === 'false' ? '正常' : '';
  if (abnormalLabel) chips.push({ key: 'abnormal', label: '异常', value: abnormalLabel });
  return chips;
});
const ipFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const scopeLabel = ipScopeOptions.find((option) => option.value === ipQuery.scope)?.label;
  if (scopeLabel) chips.push({ key: 'scope', label: '范围', value: scopeLabel });
  return chips;
});
const sessionFilterChips = computed(() => []);
const approvalFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (approvalQuery.module)
    chips.push({ key: 'module', label: '模块', value: approvalQuery.module });
  return chips;
});
const accessLogFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (accessLogQuery.module) {
    chips.push({ key: 'module', label: '模块', value: accessLogQuery.module });
  }
  return chips;
});

onMounted(() => {
  void loadOverview();
  void refreshCurrentTab();
});

async function loadOverview() {
  overview.value = await securityApi.overview();
}

async function refreshCurrentTab() {
  await loadOverview();
  if (activeTab.value === 'loginLogs') await loadLoginLogsWithViews();
  if (activeTab.value === 'sessions') await loadSessionsWithViews();
  if (activeTab.value === 'settings') await loadSettings();
  if (activeTab.value === 'ip') await loadIpWhitelistsWithViews();
  if (activeTab.value === 'approvals') await loadApprovalsWithViews();
  if (activeTab.value === 'accessLogs') await loadAccessLogsWithViews();
}

async function loadLoginLogs() {
  loginLoading.value = true;
  try {
    const result = await securityApi.listLoginLogs({
      ...loginQuery,
      sortBy: loginSortConfig.value.prop,
      sortOrder: mapSortOrder(loginSortConfig.value.order)
    });
    loginLogs.value = result.items;
    loginTotal.value = result.total;
  } finally {
    loginLoading.value = false;
  }
}

async function loadSessions() {
  sessionLoading.value = true;
  try {
    const result = await securityApi.listActiveSessions({
      ...sessionQuery,
      sortBy: sessionSortConfig.value.prop,
      sortOrder: mapSortOrder(sessionSortConfig.value.order)
    });
    sessions.value = result.items;
    sessionTotal.value = result.total;
  } finally {
    sessionLoading.value = false;
  }
}

async function loadSettings() {
  const [password, mfa, myMfa] = await Promise.all([
    securityApi.getPasswordPolicy(),
    securityApi.getMfaSettings(),
    securityApi.getMyMfaStatus()
  ]);
  Object.assign(passwordPolicy, password.value);
  Object.assign(mfaSettings, mfa.value);
  myMfaStatus.value = myMfa;
}

async function loadIpWhitelists() {
  ipLoading.value = true;
  try {
    const result = await securityApi.listIpWhitelists({
      ...ipQuery,
      sortBy: ipSortConfig.value.prop,
      sortOrder: mapSortOrder(ipSortConfig.value.order)
    });
    ipWhitelists.value = result.items;
    ipTotal.value = result.total;
  } finally {
    ipLoading.value = false;
  }
}

async function loadLoginLogsWithViews() {
  await ensureLoginTableViews();
  await loadLoginLogs();
}

async function loadSessionsWithViews() {
  await ensureSessionTableViews();
  await loadSessions();
}

async function loadIpWhitelistsWithViews() {
  await ensureIpTableViews();
  await loadIpWhitelists();
}

async function loadApprovalsWithViews() {
  await ensureApprovalTableViews();
  await loadApprovals();
}

async function loadAccessLogsWithViews() {
  await ensureAccessLogTableViews();
  await loadAccessLogs();
}

async function handleLoginSearch() {
  loginQuery.page = 1;
  await loadLoginLogs();
}

async function handleSessionSearch() {
  sessionQuery.page = 1;
  await loadSessions();
}

async function handleIpSearch() {
  ipQuery.page = 1;
  await loadIpWhitelists();
}

async function handleApprovalSearch() {
  approvalQuery.page = 1;
  await loadApprovals();
}

async function handleAccessLogSearch() {
  accessLogQuery.page = 1;
  await loadAccessLogs();
}

async function handleLoginSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  loginSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  loginQuery.page = 1;
  await loadLoginLogs();
}

async function handleSessionSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sessionSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  sessionQuery.page = 1;
  await loadSessions();
}

async function handleIpSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  ipSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  ipQuery.page = 1;
  await loadIpWhitelists();
}

async function handleApprovalSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  approvalSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  approvalQuery.page = 1;
  await loadApprovals();
}

async function handleAccessLogSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  accessLogSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  accessLogQuery.page = 1;
  await loadAccessLogs();
}

function isLoginColumnVisible(column: string) {
  return loginVisibleColumns.value.length ? loginVisibleColumns.value.includes(column) : true;
}

function isSessionColumnVisible(column: string) {
  return sessionVisibleColumns.value.length ? sessionVisibleColumns.value.includes(column) : true;
}

function isIpColumnVisible(column: string) {
  return ipVisibleColumns.value.length ? ipVisibleColumns.value.includes(column) : true;
}

function isApprovalColumnVisible(column: string) {
  return approvalVisibleColumns.value.length ? approvalVisibleColumns.value.includes(column) : true;
}

function isAccessLogColumnVisible(column: string) {
  return accessLogVisibleColumns.value.length
    ? accessLogVisibleColumns.value.includes(column)
    : true;
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

function clearSessionFilters() {
  sessionQuery.page = 1;
  sessionQuery.keyword = '';
  sessionQuery.revoked = '';
  sessionSavedViewId.value = '';
  sessionDensity.value = 'default';
  sessionSortConfig.value = {};
}

function clearIpFilters() {
  ipQuery.page = 1;
  ipQuery.keyword = '';
  ipQuery.scope = '';
  ipQuery.enabled = '';
  ipSavedViewId.value = '';
  ipDensity.value = 'default';
  ipSortConfig.value = {};
}

function clearApprovalFilters() {
  approvalQuery.page = 1;
  approvalQuery.keyword = '';
  approvalQuery.status = '';
  approvalQuery.module = '';
  approvalSavedViewId.value = '';
  approvalDensity.value = 'default';
  approvalSortConfig.value = {};
}

function clearAccessLogFilters() {
  accessLogQuery.page = 1;
  accessLogQuery.keyword = '';
  accessLogQuery.approved = '';
  accessLogQuery.module = '';
  accessLogQuery.fieldName = '';
  accessLogSavedViewId.value = '';
  accessLogDensity.value = 'default';
  accessLogSortConfig.value = {};
}

function removeLoginFilter(key: string) {
  if (key === 'abnormal') loginQuery.abnormal = '';
}

function removeSessionFilter(_key: string) {
  // 在线会话当前只使用内置状态和搜索筛选。
}

function removeIpFilter(key: string) {
  if (key === 'scope') ipQuery.scope = '';
}

function removeApprovalFilter(key: string) {
  if (key === 'module') approvalQuery.module = '';
}

function removeAccessLogFilter(key: string) {
  if (key === 'module') accessLogQuery.module = '';
}

async function ensureLoginTableViews() {
  if (loginViewsLoaded.value) return;
  await loadLoginTableViews(true);
  loginViewsLoaded.value = true;
}

async function ensureSessionTableViews() {
  if (sessionViewsLoaded.value) return;
  await loadSessionTableViews(true);
  sessionViewsLoaded.value = true;
}

async function ensureIpTableViews() {
  if (ipViewsLoaded.value) return;
  await loadIpTableViews(true);
  ipViewsLoaded.value = true;
}

async function ensureApprovalTableViews() {
  if (approvalViewsLoaded.value) return;
  await loadApprovalTableViews(true);
  approvalViewsLoaded.value = true;
}

async function ensureAccessLogTableViews() {
  if (accessLogViewsLoaded.value) return;
  await loadAccessLogTableViews(true);
  accessLogViewsLoaded.value = true;
}

async function loadLoginTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: loginTableKey });
    loginSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyLoginView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadSessionTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: sessionTableKey
    });
    sessionSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applySessionView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadIpTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: ipTableKey });
    ipSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyIpView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadApprovalTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: approvalTableKey
    });
    approvalSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyApprovalView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadAccessLogTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: accessLogTableKey
    });
    accessLogSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyAccessLogView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveLoginTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存登录日志视图', {
      inputValue: '安全登录日志常用视图',
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

async function saveSessionTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存在线会话视图', {
      inputValue: '在线会话常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: sessionTableKey,
      viewName: value.trim(),
      filters: {
        keyword: sessionQuery.keyword,
        revoked: sessionQuery.revoked
      },
      sortConfig: sessionSortConfig.value,
      columns: sessionVisibleColumns.value.length
        ? sessionVisibleColumns.value
        : sessionColumnOptions.map((column) => column.value),
      density: sessionDensity.value,
      pageSize: sessionQuery.pageSize,
      isDefault: sessionSavedViews.value.length === 0
    });
    await loadSessionTableViews();
    sessionSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveIpTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 IP 白名单视图', {
      inputValue: 'IP 白名单常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: ipTableKey,
      viewName: value.trim(),
      filters: {
        keyword: ipQuery.keyword,
        scope: ipQuery.scope,
        enabled: ipQuery.enabled
      },
      sortConfig: ipSortConfig.value,
      columns: ipVisibleColumns.value.length
        ? ipVisibleColumns.value
        : ipColumnOptions.map((column) => column.value),
      density: ipDensity.value,
      pageSize: ipQuery.pageSize,
      isDefault: ipSavedViews.value.length === 0
    });
    await loadIpTableViews();
    ipSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveApprovalTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存敏感审批视图', {
      inputValue: '敏感审批常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: approvalTableKey,
      viewName: value.trim(),
      filters: {
        keyword: approvalQuery.keyword,
        status: approvalQuery.status,
        module: approvalQuery.module
      },
      sortConfig: approvalSortConfig.value,
      columns: approvalVisibleColumns.value.length
        ? approvalVisibleColumns.value
        : approvalColumnOptions.map((column) => column.value),
      density: approvalDensity.value,
      pageSize: approvalQuery.pageSize,
      isDefault: approvalSavedViews.value.length === 0
    });
    await loadApprovalTableViews();
    approvalSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveAccessLogTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存敏感查看日志视图', {
      inputValue: '敏感查看日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: accessLogTableKey,
      viewName: value.trim(),
      filters: {
        keyword: accessLogQuery.keyword,
        module: accessLogQuery.module,
        fieldName: accessLogQuery.fieldName,
        approved: accessLogQuery.approved
      },
      sortConfig: accessLogSortConfig.value,
      columns: accessLogVisibleColumns.value.length
        ? accessLogVisibleColumns.value
        : accessLogColumnOptions.map((column) => column.value),
      density: accessLogDensity.value,
      pageSize: accessLogQuery.pageSize,
      isDefault: accessLogSavedViews.value.length === 0
    });
    await loadAccessLogTableViews();
    accessLogSavedViewId.value = created.id;
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

async function applySessionSavedView(id: string) {
  const view = sessionSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applySessionView(view);
  ElMessage.success('已应用保存视图');
  await loadSessions();
}

async function applyIpSavedView(id: string) {
  const view = ipSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyIpView(view);
  ElMessage.success('已应用保存视图');
  await loadIpWhitelists();
}

async function applyApprovalSavedView(id: string) {
  const view = approvalSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyApprovalView(view);
  ElMessage.success('已应用保存视图');
  await loadApprovals();
}

async function applyAccessLogSavedView(id: string) {
  const view = accessLogSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyAccessLogView(view);
  ElMessage.success('已应用保存视图');
  await loadAccessLogs();
}

function applyLoginView(view: UserTableView) {
  const filters = view.filters;
  loginQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  loginQuery.status = isLoginStatus(filters.status) ? filters.status : '';
  loginQuery.abnormal = typeof filters.abnormal === 'string' ? filters.abnormal : '';
  loginQuery.pageSize = view.pageSize;
  loginDensity.value = view.density;
  loginVisibleColumns.value = normalizeColumns(view.columns, loginColumnOptions);
  loginSortConfig.value = parseSortConfig(view.sortConfig);
  loginSavedViewId.value = view.id;
}

function applySessionView(view: UserTableView) {
  const filters = view.filters;
  sessionQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  sessionQuery.revoked = typeof filters.revoked === 'string' ? filters.revoked : '';
  sessionQuery.pageSize = view.pageSize;
  sessionDensity.value = view.density;
  sessionVisibleColumns.value = normalizeColumns(view.columns, sessionColumnOptions);
  sessionSortConfig.value = parseSortConfig(view.sortConfig);
  sessionSavedViewId.value = view.id;
}

function applyIpView(view: UserTableView) {
  const filters = view.filters;
  ipQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  ipQuery.scope = isIpScope(filters.scope) ? filters.scope : '';
  ipQuery.enabled = typeof filters.enabled === 'string' ? filters.enabled : '';
  ipQuery.pageSize = view.pageSize;
  ipDensity.value = view.density;
  ipVisibleColumns.value = normalizeColumns(view.columns, ipColumnOptions);
  ipSortConfig.value = parseSortConfig(view.sortConfig);
  ipSavedViewId.value = view.id;
}

function applyApprovalView(view: UserTableView) {
  const filters = view.filters;
  approvalQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  approvalQuery.status = isApprovalStatus(filters.status) ? filters.status : '';
  approvalQuery.module = typeof filters.module === 'string' ? filters.module : '';
  approvalQuery.pageSize = view.pageSize;
  approvalDensity.value = view.density;
  approvalVisibleColumns.value = normalizeColumns(view.columns, approvalColumnOptions);
  approvalSortConfig.value = parseSortConfig(view.sortConfig);
  approvalSavedViewId.value = view.id;
}

function applyAccessLogView(view: UserTableView) {
  const filters = view.filters;
  accessLogQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  accessLogQuery.module = typeof filters.module === 'string' ? filters.module : '';
  accessLogQuery.fieldName = typeof filters.fieldName === 'string' ? filters.fieldName : '';
  accessLogQuery.approved = typeof filters.approved === 'string' ? filters.approved : '';
  accessLogQuery.pageSize = view.pageSize;
  accessLogDensity.value = view.density;
  accessLogVisibleColumns.value = normalizeColumns(view.columns, accessLogColumnOptions);
  accessLogSortConfig.value = parseSortConfig(view.sortConfig);
  accessLogSavedViewId.value = view.id;
}

async function loadApprovals() {
  approvalLoading.value = true;
  try {
    const result = await securityApi.listSensitiveApprovals({
      ...approvalQuery,
      sortBy: approvalSortConfig.value.prop,
      sortOrder: mapSortOrder(approvalSortConfig.value.order)
    });
    approvals.value = result.items;
    approvalTotal.value = result.total;
  } finally {
    approvalLoading.value = false;
  }
}

async function loadAccessLogs() {
  accessLogLoading.value = true;
  try {
    const result = await securityApi.listSensitiveAccessLogs({
      ...accessLogQuery,
      sortBy: accessLogSortConfig.value.prop,
      sortOrder: mapSortOrder(accessLogSortConfig.value.order)
    });
    accessLogs.value = result.items;
    accessLogTotal.value = result.total;
  } finally {
    accessLogLoading.value = false;
  }
}

async function savePasswordPolicy() {
  await securityApi.updatePasswordPolicy({ ...passwordPolicy });
  ElMessage.success('密码策略已保存');
}

async function saveMfaSettings() {
  await securityApi.updateMfaSettings({ ...mfaSettings });
  ElMessage.success('MFA 设置已保存');
}

async function setupMyMfa() {
  mfaActionLoading.value = true;
  try {
    mfaSetup.value = await securityApi.setupMyMfa();
    mfaRecoveryCodes.value = [];
    ElMessage.success('MFA 绑定密钥已生成');
  } finally {
    mfaActionLoading.value = false;
  }
}

async function enableMyMfa() {
  if (!mfaVerifyCode.value) {
    ElMessage.warning('请输入验证码');
    return;
  }

  mfaActionLoading.value = true;
  try {
    const result = await securityApi.enableMyMfa(mfaVerifyCode.value);
    applyMfaResult(result);
    mfaSetup.value = null;
    mfaVerifyCode.value = '';
    ElMessage.success('MFA 已启用');
  } finally {
    mfaActionLoading.value = false;
  }
}

async function regenerateMfaRecoveryCodes() {
  if (!mfaVerifyCode.value) {
    ElMessage.warning('请输入验证码或恢复码');
    return;
  }
  await ElMessageBox.confirm('重新生成后旧恢复码会立即失效，确认继续？', '重新生成恢复码', {
    type: 'warning'
  });

  mfaActionLoading.value = true;
  try {
    const result = await securityApi.regenerateMyMfaRecoveryCodes(mfaVerifyCode.value);
    applyMfaResult(result);
    mfaVerifyCode.value = '';
    ElMessage.success('恢复码已重新生成');
  } finally {
    mfaActionLoading.value = false;
  }
}

async function disableMyMfa() {
  if (!mfaVerifyCode.value) {
    ElMessage.warning('请输入验证码或恢复码');
    return;
  }
  await ElMessageBox.confirm('停用后登录将不再要求 MFA，确认停用？', '停用 MFA', {
    type: 'warning'
  });

  mfaActionLoading.value = true;
  try {
    myMfaStatus.value = await securityApi.disableMyMfa({
      code: mfaVerifyCode.value,
      reason: mfaDisableReason.value || undefined
    });
    mfaSetup.value = null;
    mfaRecoveryCodes.value = [];
    mfaVerifyCode.value = '';
    mfaDisableReason.value = '';
    ElMessage.success('MFA 已停用');
  } finally {
    mfaActionLoading.value = false;
  }
}

function applyMfaResult(result: MyMfaEnableResult) {
  myMfaStatus.value = result;
  mfaRecoveryCodes.value = result.recoveryCodes;
}

function openIpDialog(row?: IpWhitelist) {
  editingIp.value = row ?? null;
  Object.assign(ipForm, {
    ipOrCidr: row?.ipOrCidr ?? '',
    scope: row?.scope ?? 'admin',
    enabled: row?.enabled ?? true,
    remark: row?.remark ?? ''
  });
  ipDialogVisible.value = true;
}

async function saveIp() {
  savingIp.value = true;
  try {
    if (editingIp.value) {
      await securityApi.updateIpWhitelist(editingIp.value.id, ipForm);
    } else {
      await securityApi.createIpWhitelist(ipForm);
    }
    ElMessage.success('IP 规则已保存');
    ipDialogVisible.value = false;
    await loadIpWhitelists();
    await loadOverview();
  } finally {
    savingIp.value = false;
  }
}

async function removeIp(id: string) {
  await ElMessageBox.confirm('删除后该 IP 白名单规则不再生效，确认删除？', '删除确认', {
    type: 'warning'
  });
  await securityApi.removeIpWhitelist(id);
  ElMessage.success('IP 规则已删除');
  await loadIpWhitelists();
  await loadOverview();
}

function openApprovalDialog() {
  Object.assign(approvalForm, {
    module: '',
    fieldName: '',
    objectType: '',
    objectId: '',
    reason: ''
  });
  approvalDialogVisible.value = true;
}

async function createApproval() {
  savingApproval.value = true;
  try {
    await securityApi.createSensitiveApproval({
      ...approvalForm,
      objectId: approvalForm.objectId || null
    });
    ElMessage.success('审批申请已提交');
    approvalDialogVisible.value = false;
    await loadApprovals();
    await loadOverview();
  } finally {
    savingApproval.value = false;
  }
}

async function approve(id: string) {
  await securityApi.approveSensitiveApproval(id, { decisionNote: '后台批准' });
  ElMessage.success('已批准');
  await loadApprovals();
  await loadOverview();
}

async function reject(id: string) {
  await securityApi.rejectSensitiveApproval(id, { decisionNote: '后台拒绝' });
  ElMessage.success('已拒绝');
  await loadApprovals();
  await loadOverview();
}

async function revoke(id: string) {
  await ElMessageBox.confirm('强制下线后该会话需要重新登录，确认操作？', '强制下线', {
    type: 'warning'
  });
  await securityApi.revokeSession(id);
  ElMessage.success('会话已下线');
  await loadSessions();
  await loadOverview();
}

function getInitialTab() {
  if (route.path.includes('login-logs')) return 'loginLogs';
  if (route.path.includes('sessions')) return 'sessions';
  if (route.path.includes('mfa')) return 'settings';
  if (route.path.includes('ip-whitelist')) return 'ip';
  if (route.path.includes('sensitive-approvals')) return 'approvals';
  return 'overview';
}

function getLoginStatusLabel(status: string) {
  return { success: '成功', failed: '失败', blocked: '拦截' }[status] ?? status;
}

function getLoginStatusType(status: string) {
  if (status === 'success') return 'success';
  if (status === 'blocked') return 'warning';
  return 'danger';
}

function getIpScopeLabel(scope: string) {
  return { admin: '后台', api: 'API', automation: '自动化' }[scope] ?? scope;
}

function getTableSize(density: TableDensity) {
  if (density === 'compact') return 'small';
  if (density === 'loose') return 'large';
  return 'default';
}

function normalizeColumns(columns: string[], options: Array<{ value: string }>) {
  const allowed = new Set(options.map((option) => option.value));
  return columns.length
    ? columns.filter((column) => allowed.has(column))
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

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isLoginStatus(value: unknown): value is LoginLogStatus {
  return value === 'success' || value === 'failed' || value === 'blocked';
}

function isIpScope(value: unknown): value is IpWhitelistScope {
  return value === 'admin' || value === 'api' || value === 'automation';
}

function isApprovalStatus(value: unknown): value is SensitiveAccessApprovalStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected' || value === 'expired';
}

function showExportMessage() {
  ElMessage.info('安全中心导出会走数据中心导出任务，后续统一接入');
}

function getApprovalStatusLabel(status: string) {
  return (
    { pending: '待审批', approved: '已批准', rejected: '已拒绝', expired: '已过期' }[status] ??
    status
  );
}

function getApprovalStatusType(status: string) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'expired') return 'info';
  return 'warning';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}
</script>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  components: {
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

.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-search {
  width: min(320px, 100%);
}

.toolbar-select {
  width: 140px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.settings-panel {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.settings-panel h3 {
  margin: 0 0 16px;
  font-size: 16px;
}

.mfa-account {
  display: grid;
  gap: 14px;
}

.mfa-account__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mfa-account__header h4 {
  margin: 0;
  font-size: 15px;
}

.mfa-account__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.mfa-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-left: 120px;
}

.mfa-recovery-alert {
  margin-top: 2px;
}

.mfa-recovery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.mfa-recovery-grid code {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .mfa-actions {
    padding-left: 0;
  }

  .mfa-recovery-grid {
    grid-template-columns: 1fr;
  }
}
</style>
