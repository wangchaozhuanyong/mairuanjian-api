<template>
  <PageScaffold
    title="通知中心"
    group="系统管理"
    phase="Phase 9"
    description="集中管理站内通知、Telegram 配置、通知规则、通知模板和发送日志。"
  >
    <template #actions>
      <el-button @click="refreshCurrentTab">刷新</el-button>
      <el-button type="primary" @click="openPrimaryDialog">{{ primaryActionText }}</el-button>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="启用规则"
        :value="overview?.enabledRuleCount ?? '-'"
        hint="当前启用的通知规则"
        tone="blue"
      />
      <MetricCard
        label="未读站内通知"
        :value="overview?.unreadCount ?? '-'"
        hint="当前用户可见"
        tone="orange"
      />
      <MetricCard
        label="失败通知"
        :value="overview?.failedLogCount ?? '-'"
        hint="需要重试或排查"
        tone="red"
      />
      <MetricCard
        label="Telegram 配置"
        :value="overview?.telegramCount ?? '-'"
        hint="已启用配置"
        tone="green"
      />
    </div>

    <section class="content-panel">
      <el-tabs v-model="activeTab" @tab-change="refreshCurrentTab">
        <el-tab-pane label="通知总览" name="overview">
          <el-table :data="overview?.recentLogs ?? []" row-key="id">
            <el-table-column label="事件" min-width="170">
              <template #default="{ row }">
                {{ row.title }}
                <div class="muted-block">{{ row.eventCode }} / {{ row.module }}</div>
              </template>
            </el-table-column>
            <el-table-column label="渠道" width="100">
              <template #default="{ row }">{{ getChannelLabel(row.channel) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="getLogStatusType(row.status)" size="small" effect="light">
                  {{ getLogStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="内容摘要" min-width="260" prop="contentDigest" />
            <el-table-column label="时间" min-width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="通知规则" name="rules">
          <TableToolbar
            v-model:keyword="ruleQuery.keyword"
            v-model:status="ruleQuery.enabled"
            v-model:density="ruleDensity"
            v-model:visible-columns="ruleVisibleColumns"
            v-model:saved-view-id="ruleSavedViewId"
            :column-options="ruleColumnOptions"
            :status-options="enabledStatusOptions"
            :saved-views="ruleSavedViews"
            :filter-chips="ruleFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索规则名称、事件编码、模块"
            @search="handleRuleSearch"
            @refresh="loadRules"
            @clear-filters="clearRuleFilters"
            @remove-filter="removeRuleFilter"
            @save-view="saveRuleTableView"
            @apply-view="applyRuleSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="ruleQuery.module"
                class="table-toolbar__select"
                clearable
                placeholder="模块"
                @change="handleRuleSearch"
              >
                <el-option
                  v-for="item in moduleOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-select
                v-model="ruleQuery.level"
                class="table-toolbar__select"
                clearable
                placeholder="级别"
                @change="handleRuleSearch"
              >
                <el-option
                  v-for="item in levelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </template>
          </TableToolbar>

          <el-table
            v-loading="rulesLoading"
            :data="rules"
            :size="ruleTableSize"
            row-key="id"
            empty-text="暂无通知规则"
            @sort-change="handleRuleSortChange"
          >
            <el-table-column
              v-if="isRuleColumnVisible('name')"
              label="规则"
              prop="name"
              min-width="220"
              sortable="custom"
            >
              <template #default="{ row }">
                <strong>{{ row.name }}</strong>
                <div class="muted-block">{{ row.eventCode }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isRuleColumnVisible('module')"
              label="模块"
              prop="module"
              min-width="120"
              sortable="custom"
            >
              <template #default="{ row }">
                {{ getModuleLabel(row.module) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isRuleColumnVisible('level')"
              label="级别"
              prop="level"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag class="tag-gap" :type="getLevelType(row.level)" size="small" effect="light">
                  {{ getLevelLabel(row.level) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column v-if="isRuleColumnVisible('channels')" label="渠道" min-width="140">
              <template #default="{ row }">
                <el-tag v-for="channel in row.channels" :key="channel" class="tag-gap" size="small">
                  {{ getChannelLabel(channel) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isRuleColumnVisible('enabled')"
              label="状态"
              prop="enabled"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="light">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isRuleColumnVisible('lastTriggeredAt')"
              label="最近触发"
              prop="lastTriggeredAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.lastTriggeredAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="editRule(row)">编辑</el-button>
                <el-button
                  text
                  :type="row.enabled ? 'warning' : 'success'"
                  @click="toggleRule(row)"
                >
                  {{ row.enabled ? '停用' : '启用' }}
                </el-button>
                <el-button text type="danger" @click="removeRule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="ruleQuery.page"
              v-model:page-size="ruleQuery.pageSize"
              :total="ruleTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadRules"
              @size-change="loadRules"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="消息模板" name="templates">
          <TableToolbar
            v-model:keyword="templateQuery.keyword"
            v-model:status="templateQuery.enabled"
            v-model:density="templateDensity"
            v-model:visible-columns="templateVisibleColumns"
            v-model:saved-view-id="templateSavedViewId"
            :column-options="templateColumnOptions"
            :status-options="enabledStatusOptions"
            :saved-views="templateSavedViews"
            :filter-chips="templateFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索模板名称、标题、内容"
            @search="handleTemplateSearch"
            @refresh="loadTemplates"
            @clear-filters="clearTemplateFilters"
            @remove-filter="removeTemplateFilter"
            @save-view="saveTemplateTableView"
            @apply-view="applyTemplateSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="templateQuery.channel"
                class="table-toolbar__select"
                clearable
                placeholder="渠道"
                @change="handleTemplateSearch"
              >
                <el-option
                  v-for="item in channelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </template>
          </TableToolbar>

          <el-table
            v-loading="templatesLoading"
            :data="templates"
            :size="templateTableSize"
            row-key="id"
            empty-text="暂无消息模板"
            @sort-change="handleTemplateSortChange"
          >
            <el-table-column
              v-if="isTemplateColumnVisible('name')"
              label="模板"
              prop="name"
              min-width="220"
              sortable="custom"
            >
              <template #default="{ row }">
                <strong>{{ row.name }}</strong>
                <div class="muted-block">{{ row.eventCode }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isTemplateColumnVisible('channel')"
              label="渠道"
              prop="channel"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">{{ getChannelLabel(row.channel) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isTemplateColumnVisible('title')"
              label="标题"
              min-width="180"
              prop="title"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isTemplateColumnVisible('content')"
              label="内容"
              min-width="260"
              prop="content"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isTemplateColumnVisible('enabled')"
              label="状态"
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
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="editTemplate(row)">编辑</el-button>
                <el-button text type="danger" @click="removeTemplate(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="templateQuery.page"
              v-model:page-size="templateQuery.pageSize"
              :total="templateTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadTemplates"
              @size-change="loadTemplates"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="Telegram 配置" name="telegram">
          <el-table v-loading="telegramLoading" :data="telegramConfigs" row-key="id">
            <el-table-column label="通知名称" min-width="170" prop="notificationName" />
            <el-table-column label="Chat ID" min-width="160" prop="chatId" />
            <el-table-column label="Token" width="110">
              <template #default="{ row }">
                {{ row.hasBotToken ? `****${row.botTokenTail ?? ''}` : '未配置' }}
              </template>
            </el-table-column>
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getLevelType(row.notificationLevel)" size="small" effect="light">
                  {{ getLevelLabel(row.notificationLevel) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="light">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最近测试" min-width="170">
              <template #default="{ row }">
                {{ getTelegramTestLabel(row.lastTestStatus) }}
                <div class="muted-block">{{ formatDate(row.lastTestAt) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="editTelegram(row)">编辑</el-button>
                <el-button text type="success" @click="testTelegram(row)">测试发送</el-button>
                <el-button text type="danger" @click="removeTelegram(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="通知日志" name="logs">
          <TableToolbar
            v-model:keyword="logQuery.keyword"
            v-model:status="logQuery.status"
            v-model:density="logDensity"
            v-model:visible-columns="logVisibleColumns"
            v-model:saved-view-id="logSavedViewId"
            :column-options="logColumnOptions"
            :status-options="logStatusOptions"
            :saved-views="logSavedViews"
            :filter-chips="logFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索标题、内容、接收人、错误"
            @search="handleLogSearch"
            @refresh="loadLogs"
            @clear-filters="clearLogFilters"
            @remove-filter="removeLogFilter"
            @save-view="saveLogTableView"
            @apply-view="applyLogSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="logQuery.channel"
                class="table-toolbar__select"
                clearable
                placeholder="渠道"
                @change="handleLogSearch"
              >
                <el-option
                  v-for="item in channelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-select
                v-model="logQuery.module"
                class="table-toolbar__select"
                clearable
                placeholder="模块"
                @change="handleLogSearch"
              >
                <el-option
                  v-for="item in moduleOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-button @click="markAllRead">全部已读</el-button>
            </template>
          </TableToolbar>

          <el-table
            v-loading="logsLoading"
            :data="logs"
            :size="logTableSize"
            row-key="id"
            empty-text="暂无通知日志"
            @sort-change="handleLogSortChange"
          >
            <el-table-column
              v-if="isLogColumnVisible('title')"
              label="通知"
              prop="title"
              min-width="240"
              sortable="custom"
            >
              <template #default="{ row }">
                <strong>{{ row.title }}</strong>
                <div class="muted-block">
                  {{ row.eventCode }} / {{ getModuleLabel(row.module) }}
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isLogColumnVisible('channel')"
              label="渠道/接收人"
              prop="channel"
              min-width="150"
              sortable="custom"
            >
              <template #default="{ row }">
                {{ getChannelLabel(row.channel) }}
                <div class="muted-block">{{ row.recipient || row.recipientUserId || '全部' }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isLogColumnVisible('contentDigest')"
              label="内容摘要"
              min-width="260"
              prop="contentDigest"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isLogColumnVisible('status')"
              label="状态"
              prop="status"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-tag :type="getLogStatusType(row.status)" size="small" effect="light">
                  {{ getLogStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isLogColumnVisible('errorMessage')"
              label="错误"
              prop="errorMessage"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.errorMessage || '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isLogColumnVisible('createdAt')"
              label="时间"
              prop="createdAt"
              min-width="160"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button text :disabled="row.readAt" @click="markRead(row)">已读</el-button>
                <el-button
                  text
                  type="primary"
                  :disabled="!canRetryLog(row.status)"
                  @click="retryLog(row)"
                >
                  重试
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-row">
            <el-pagination
              v-model:current-page="logQuery.page"
              v-model:page-size="logQuery.pageSize"
              :total="logTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadLogs"
              @size-change="loadLogs"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="ruleDialogVisible"
      :title="editingRuleId ? '编辑通知规则' : '新增通知规则'"
      width="560px"
    >
      <el-form label-position="top">
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.name" />
        </el-form-item>
        <el-form-item label="事件编码" required>
          <el-input v-model="ruleForm.eventCode" placeholder="apple.balance.low" />
        </el-form-item>
        <el-form-item label="模块" required>
          <el-select v-model="ruleForm.module" class="full-width">
            <el-option label="Apple ID" value="apple" />
            <el-option label="兑换码" value="code" />
            <el-option label="平台接口" value="platform" />
            <el-option label="系统安全" value="security" />
            <el-option label="运维" value="ops" />
          </el-select>
        </el-form-item>
        <el-form-item label="级别">
          <el-select v-model="ruleForm.level" class="full-width">
            <el-option
              v-for="item in levelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="渠道">
          <el-checkbox-group v-model="ruleForm.channels">
            <el-checkbox value="system">站内通知</el-checkbox>
            <el-checkbox value="telegram">Telegram</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="templateDialogVisible"
      :title="editingTemplateId ? '编辑通知模板' : '新增通知模板'"
      width="620px"
    >
      <el-form label-position="top">
        <el-form-item label="模板名称" required>
          <el-input v-model="templateForm.name" />
        </el-form-item>
        <el-form-item label="事件编码" required>
          <el-input v-model="templateForm.eventCode" placeholder="apple.balance.low" />
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="templateForm.channel" class="full-width">
            <el-option label="站内通知" value="system" />
            <el-option label="Telegram" value="telegram" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="templateForm.title" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="templateForm.content" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="templateForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="telegramDialogVisible"
      :title="editingTelegramId ? '编辑 Telegram 配置' : '新增 Telegram 配置'"
      width="560px"
    >
      <el-alert
        class="dialog-alert"
        title="Bot Token 会加密保存，列表只显示尾号。"
        type="info"
        show-icon
        :closable="false"
      />
      <el-form label-position="top">
        <el-form-item label="通知名称" required>
          <el-input v-model="telegramForm.notificationName" />
        </el-form-item>
        <el-form-item label="Bot Token">
          <el-input v-model="telegramForm.botToken" type="password" show-password />
        </el-form-item>
        <el-form-item label="Chat ID / 群组 ID" required>
          <el-input v-model="telegramForm.chatId" />
        </el-form-item>
        <el-form-item label="通知级别">
          <el-select v-model="telegramForm.notificationLevel" class="full-width">
            <el-option
              v-for="item in levelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="静默时间">
          <div class="inline-fields">
            <el-input v-model="telegramForm.silentStartTime" placeholder="开始 HH:mm" />
            <el-input v-model="telegramForm.silentEndTime" placeholder="结束 HH:mm" />
          </div>
        </el-form-item>
        <el-form-item label="失败重试次数">
          <el-input-number
            v-model="telegramForm.retryCount"
            :min="0"
            :max="10"
            class="full-width"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="telegramForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="telegramDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveTelegram">保存</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import {
  notificationsApi,
  userTableViewsApi,
  type NotificationLogQuery,
  type NotificationRuleQuery,
  type NotificationTemplateQuery
} from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  NotificationLevel,
  NotificationLog,
  NotificationOverview,
  NotificationRule,
  NotificationTemplate,
  TableDensity,
  TelegramConfig,
  UserTableView
} from '@/types/system';

const activeTab = ref('overview');
const overview = ref<NotificationOverview | null>(null);
const rules = ref<NotificationRule[]>([]);
const templates = ref<NotificationTemplate[]>([]);
const logs = ref<NotificationLog[]>([]);
const telegramConfigs = ref<TelegramConfig[]>([]);
const ruleTotal = ref(0);
const templateTotal = ref(0);
const logTotal = ref(0);
const rulesLoading = ref(false);
const templatesLoading = ref(false);
const logsLoading = ref(false);
const telegramLoading = ref(false);
const saving = ref(false);
const ruleDensity = ref<TableDensity>('default');
const templateDensity = ref<TableDensity>('default');
const logDensity = ref<TableDensity>('default');
const ruleVisibleColumns = ref<string[]>([]);
const templateVisibleColumns = ref<string[]>([]);
const logVisibleColumns = ref<string[]>([]);
const ruleSavedViews = ref<UserTableView[]>([]);
const templateSavedViews = ref<UserTableView[]>([]);
const logSavedViews = ref<UserTableView[]>([]);
const ruleSavedViewId = ref('');
const templateSavedViewId = ref('');
const logSavedViewId = ref('');
const ruleSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const templateSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const logSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const ruleViewsLoaded = ref(false);
const templateViewsLoaded = ref(false);
const logViewsLoaded = ref(false);
const ruleDialogVisible = ref(false);
const templateDialogVisible = ref(false);
const telegramDialogVisible = ref(false);
const editingRuleId = ref('');
const editingTemplateId = ref('');
const editingTelegramId = ref('');

const levelOptions: Array<{ label: string; value: NotificationLevel }> = [
  { label: '普通', value: 'info' },
  { label: '警告', value: 'warning' },
  { label: '错误', value: 'error' },
  { label: '严重', value: 'critical' }
];
const moduleOptions = [
  { label: 'Apple ID', value: 'apple' },
  { label: '兑换码', value: 'code' },
  { label: '平台接口', value: 'platform' },
  { label: '系统安全', value: 'security' },
  { label: '运维', value: 'ops' },
  { label: '通知中心', value: 'notification' }
];
const channelOptions = [
  { label: '站内通知', value: 'system' },
  { label: 'Telegram', value: 'telegram' }
];
const enabledStatusOptions = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' }
];
const logStatusOptions = [
  { label: '待发送', value: 'pending' },
  { label: '已发送', value: 'sent' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' }
];
const ruleTableKey = 'notification_rules';
const templateTableKey = 'notification_templates';
const logTableKey = 'notification_logs';
const ruleColumnOptions = [
  { label: '规则', value: 'name', required: true },
  { label: '模块', value: 'module' },
  { label: '级别', value: 'level' },
  { label: '渠道', value: 'channels' },
  { label: '状态', value: 'enabled' },
  { label: '最近触发', value: 'lastTriggeredAt' }
];
const templateColumnOptions = [
  { label: '模板', value: 'name', required: true },
  { label: '渠道', value: 'channel' },
  { label: '标题', value: 'title' },
  { label: '内容', value: 'content' },
  { label: '状态', value: 'enabled' }
];
const logColumnOptions = [
  { label: '通知', value: 'title', required: true },
  { label: '渠道/接收人', value: 'channel' },
  { label: '内容摘要', value: 'contentDigest' },
  { label: '状态', value: 'status' },
  { label: '错误', value: 'errorMessage' },
  { label: '时间', value: 'createdAt' }
];

const ruleQuery = reactive<NotificationRuleQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  module: '',
  level: '',
  enabled: ''
});

const templateQuery = reactive<NotificationTemplateQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  eventCode: '',
  channel: '',
  enabled: ''
});

const logQuery = reactive<NotificationLogQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  module: '',
  eventCode: '',
  channel: '',
  status: ''
});

const ruleForm = reactive({
  name: '',
  eventCode: '',
  module: 'apple',
  level: 'warning' as NotificationLevel,
  enabled: true,
  channels: ['system'] as Array<'telegram' | 'system'>
});

const templateForm = reactive({
  name: '',
  eventCode: '',
  channel: 'system' as 'telegram' | 'system',
  title: '',
  content: '',
  enabled: true
});

const telegramForm = reactive({
  notificationName: '',
  enabled: false,
  botToken: '',
  chatId: '',
  notificationLevel: 'warning' as NotificationLevel,
  silentStartTime: '',
  silentEndTime: '',
  retryCount: 3
});

const primaryActionText = computed(() => {
  if (activeTab.value === 'rules') return '新增通知规则';
  if (activeTab.value === 'templates') return '新增消息模板';
  if (activeTab.value === 'telegram') return '新增 Telegram';
  return '新增通知规则';
});
const ruleTableSize = computed(() => getTableSize(ruleDensity.value));
const templateTableSize = computed(() => getTableSize(templateDensity.value));
const logTableSize = computed(() => getTableSize(logDensity.value));
const ruleFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const moduleLabel = moduleOptions.find((item) => item.value === ruleQuery.module)?.label;
  const levelLabel = levelOptions.find((item) => item.value === ruleQuery.level)?.label;
  if (moduleLabel) chips.push({ key: 'module', label: '模块', value: moduleLabel });
  if (levelLabel) chips.push({ key: 'level', label: '级别', value: levelLabel });
  return chips;
});
const templateFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const channelLabel = channelOptions.find((item) => item.value === templateQuery.channel)?.label;
  if (channelLabel) chips.push({ key: 'channel', label: '渠道', value: channelLabel });
  return chips;
});
const logFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const channelLabel = channelOptions.find((item) => item.value === logQuery.channel)?.label;
  const moduleLabel = moduleOptions.find((item) => item.value === logQuery.module)?.label;
  if (channelLabel) chips.push({ key: 'channel', label: '渠道', value: channelLabel });
  if (moduleLabel) chips.push({ key: 'module', label: '模块', value: moduleLabel });
  return chips;
});

onMounted(async () => {
  await Promise.all([
    loadOverview(),
    loadRulesWithViews(),
    loadTemplatesWithViews(),
    loadTelegramConfigs(),
    loadLogsWithViews()
  ]);
});

async function refreshCurrentTab() {
  if (activeTab.value === 'overview') await loadOverview();
  if (activeTab.value === 'rules') await loadRulesWithViews();
  if (activeTab.value === 'templates') await loadTemplatesWithViews();
  if (activeTab.value === 'telegram') await loadTelegramConfigs();
  if (activeTab.value === 'logs') await loadLogsWithViews();
}

function openPrimaryDialog() {
  if (activeTab.value === 'templates') {
    openTemplateDialog();
    return;
  }
  if (activeTab.value === 'telegram') {
    openTelegramDialog();
    return;
  }
  openRuleDialog();
}

async function loadOverview() {
  try {
    overview.value = await notificationsApi.overview();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载通知总览失败');
  }
}

async function loadRules() {
  rulesLoading.value = true;
  try {
    const result = await notificationsApi.listRules({
      ...ruleQuery,
      keyword: ruleQuery.keyword || undefined,
      module: ruleQuery.module || undefined,
      level: ruleQuery.level || undefined,
      enabled: ruleQuery.enabled || undefined,
      sortBy: ruleSortConfig.value.prop,
      sortOrder: mapSortOrder(ruleSortConfig.value.order)
    });
    rules.value = result.items;
    ruleTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载通知规则失败');
  } finally {
    rulesLoading.value = false;
  }
}

async function loadTemplates() {
  templatesLoading.value = true;
  try {
    const result = await notificationsApi.listTemplates({
      ...templateQuery,
      keyword: templateQuery.keyword || undefined,
      eventCode: templateQuery.eventCode || undefined,
      channel: templateQuery.channel || undefined,
      enabled: templateQuery.enabled || undefined,
      sortBy: templateSortConfig.value.prop,
      sortOrder: mapSortOrder(templateSortConfig.value.order)
    });
    templates.value = result.items;
    templateTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载通知模板失败');
  } finally {
    templatesLoading.value = false;
  }
}

async function loadTelegramConfigs() {
  telegramLoading.value = true;
  try {
    const result = await notificationsApi.listTelegramConfigs();
    telegramConfigs.value = result.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Telegram 配置失败');
  } finally {
    telegramLoading.value = false;
  }
}

async function loadLogs() {
  logsLoading.value = true;
  try {
    const result = await notificationsApi.listLogs({
      ...logQuery,
      keyword: logQuery.keyword || undefined,
      module: logQuery.module || undefined,
      eventCode: logQuery.eventCode || undefined,
      channel: logQuery.channel || undefined,
      status: logQuery.status || undefined,
      sortBy: logSortConfig.value.prop,
      sortOrder: mapSortOrder(logSortConfig.value.order)
    });
    logs.value = result.items;
    logTotal.value = result.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载通知日志失败');
  } finally {
    logsLoading.value = false;
  }
}

async function loadRulesWithViews() {
  await ensureRuleTableViews();
  await loadRules();
}

async function loadTemplatesWithViews() {
  await ensureTemplateTableViews();
  await loadTemplates();
}

async function loadLogsWithViews() {
  await ensureLogTableViews();
  await loadLogs();
}

async function handleRuleSearch() {
  ruleQuery.page = 1;
  await loadRules();
}

async function handleTemplateSearch() {
  templateQuery.page = 1;
  await loadTemplates();
}

async function handleLogSearch() {
  logQuery.page = 1;
  await loadLogs();
}

async function handleRuleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  ruleSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  ruleQuery.page = 1;
  await loadRules();
}

async function handleTemplateSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  templateSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  templateQuery.page = 1;
  await loadTemplates();
}

async function handleLogSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  logSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  logQuery.page = 1;
  await loadLogs();
}

function isRuleColumnVisible(column: string) {
  return ruleVisibleColumns.value.length ? ruleVisibleColumns.value.includes(column) : true;
}

function isTemplateColumnVisible(column: string) {
  return templateVisibleColumns.value.length ? templateVisibleColumns.value.includes(column) : true;
}

function isLogColumnVisible(column: string) {
  return logVisibleColumns.value.length ? logVisibleColumns.value.includes(column) : true;
}

function clearRuleFilters() {
  ruleQuery.page = 1;
  ruleQuery.keyword = '';
  ruleQuery.module = '';
  ruleQuery.level = '';
  ruleQuery.enabled = '';
  ruleSavedViewId.value = '';
  ruleDensity.value = 'default';
  ruleSortConfig.value = {};
}

function clearTemplateFilters() {
  templateQuery.page = 1;
  templateQuery.keyword = '';
  templateQuery.eventCode = '';
  templateQuery.channel = '';
  templateQuery.enabled = '';
  templateSavedViewId.value = '';
  templateDensity.value = 'default';
  templateSortConfig.value = {};
}

function clearLogFilters() {
  logQuery.page = 1;
  logQuery.keyword = '';
  logQuery.module = '';
  logQuery.eventCode = '';
  logQuery.channel = '';
  logQuery.status = '';
  logSavedViewId.value = '';
  logDensity.value = 'default';
  logSortConfig.value = {};
}

function removeRuleFilter(key: string) {
  if (key === 'module') ruleQuery.module = '';
  if (key === 'level') ruleQuery.level = '';
}

function removeTemplateFilter(key: string) {
  if (key === 'channel') templateQuery.channel = '';
}

function removeLogFilter(key: string) {
  if (key === 'channel') logQuery.channel = '';
  if (key === 'module') logQuery.module = '';
}

async function ensureRuleTableViews() {
  if (ruleViewsLoaded.value) return;
  await loadRuleTableViews(true);
  ruleViewsLoaded.value = true;
}

async function ensureTemplateTableViews() {
  if (templateViewsLoaded.value) return;
  await loadTemplateTableViews(true);
  templateViewsLoaded.value = true;
}

async function ensureLogTableViews() {
  if (logViewsLoaded.value) return;
  await loadLogTableViews(true);
  logViewsLoaded.value = true;
}

async function loadRuleTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: ruleTableKey });
    ruleSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyRuleView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadTemplateTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: templateTableKey
    });
    templateSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyTemplateView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadLogTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: logTableKey });
    logSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyLogView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveRuleTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存通知规则视图', {
      inputValue: '通知规则常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: ruleTableKey,
      viewName: value.trim(),
      filters: {
        keyword: ruleQuery.keyword,
        module: ruleQuery.module,
        level: ruleQuery.level,
        enabled: ruleQuery.enabled
      },
      sortConfig: ruleSortConfig.value,
      columns: ruleVisibleColumns.value.length
        ? ruleVisibleColumns.value
        : ruleColumnOptions.map((column) => column.value),
      density: ruleDensity.value,
      pageSize: ruleQuery.pageSize,
      isDefault: ruleSavedViews.value.length === 0
    });
    await loadRuleTableViews();
    ruleSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveTemplateTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存消息模板视图', {
      inputValue: '消息模板常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: templateTableKey,
      viewName: value.trim(),
      filters: {
        keyword: templateQuery.keyword,
        eventCode: templateQuery.eventCode,
        channel: templateQuery.channel,
        enabled: templateQuery.enabled
      },
      sortConfig: templateSortConfig.value,
      columns: templateVisibleColumns.value.length
        ? templateVisibleColumns.value
        : templateColumnOptions.map((column) => column.value),
      density: templateDensity.value,
      pageSize: templateQuery.pageSize,
      isDefault: templateSavedViews.value.length === 0
    });
    await loadTemplateTableViews();
    templateSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveLogTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存通知日志视图', {
      inputValue: '通知日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: logTableKey,
      viewName: value.trim(),
      filters: {
        keyword: logQuery.keyword,
        module: logQuery.module,
        eventCode: logQuery.eventCode,
        channel: logQuery.channel,
        status: logQuery.status
      },
      sortConfig: logSortConfig.value,
      columns: logVisibleColumns.value.length
        ? logVisibleColumns.value
        : logColumnOptions.map((column) => column.value),
      density: logDensity.value,
      pageSize: logQuery.pageSize,
      isDefault: logSavedViews.value.length === 0
    });
    await loadLogTableViews();
    logSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyRuleSavedView(id: string) {
  const view = ruleSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyRuleView(view);
  ElMessage.success('已应用保存视图');
  await loadRules();
}

async function applyTemplateSavedView(id: string) {
  const view = templateSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyTemplateView(view);
  ElMessage.success('已应用保存视图');
  await loadTemplates();
}

async function applyLogSavedView(id: string) {
  const view = logSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyLogView(view);
  ElMessage.success('已应用保存视图');
  await loadLogs();
}

function applyRuleView(view: UserTableView) {
  const filters = view.filters;
  ruleQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  ruleQuery.module = typeof filters.module === 'string' ? filters.module : '';
  ruleQuery.level = isNotificationLevel(filters.level) ? filters.level : '';
  ruleQuery.enabled = typeof filters.enabled === 'string' ? filters.enabled : '';
  ruleQuery.pageSize = view.pageSize;
  ruleDensity.value = view.density;
  ruleVisibleColumns.value = normalizeColumns(view.columns, ruleColumnOptions);
  ruleSortConfig.value = parseSortConfig(view.sortConfig);
  ruleSavedViewId.value = view.id;
}

function applyTemplateView(view: UserTableView) {
  const filters = view.filters;
  templateQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  templateQuery.eventCode = typeof filters.eventCode === 'string' ? filters.eventCode : '';
  templateQuery.channel = isNotificationChannel(filters.channel) ? filters.channel : '';
  templateQuery.enabled = typeof filters.enabled === 'string' ? filters.enabled : '';
  templateQuery.pageSize = view.pageSize;
  templateDensity.value = view.density;
  templateVisibleColumns.value = normalizeColumns(view.columns, templateColumnOptions);
  templateSortConfig.value = parseSortConfig(view.sortConfig);
  templateSavedViewId.value = view.id;
}

function applyLogView(view: UserTableView) {
  const filters = view.filters;
  logQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  logQuery.module = typeof filters.module === 'string' ? filters.module : '';
  logQuery.eventCode = typeof filters.eventCode === 'string' ? filters.eventCode : '';
  logQuery.channel = isNotificationChannel(filters.channel) ? filters.channel : '';
  logQuery.status = isNotificationLogStatus(filters.status) ? filters.status : '';
  logQuery.pageSize = view.pageSize;
  logDensity.value = view.density;
  logVisibleColumns.value = normalizeColumns(view.columns, logColumnOptions);
  logSortConfig.value = parseSortConfig(view.sortConfig);
  logSavedViewId.value = view.id;
}

function openRuleDialog() {
  editingRuleId.value = '';
  Object.assign(ruleForm, {
    name: '',
    eventCode: '',
    module: 'apple',
    level: 'warning',
    enabled: true,
    channels: ['system']
  });
  ruleDialogVisible.value = true;
}

function editRule(row: NotificationRule) {
  editingRuleId.value = row.id;
  Object.assign(ruleForm, {
    name: row.name,
    eventCode: row.eventCode,
    module: row.module,
    level: row.level,
    enabled: row.enabled,
    channels: [...row.channels]
  });
  ruleDialogVisible.value = true;
}

async function saveRule() {
  saving.value = true;
  try {
    const payload = {
      name: ruleForm.name,
      eventCode: ruleForm.eventCode,
      module: ruleForm.module,
      level: ruleForm.level,
      enabled: ruleForm.enabled,
      channels: ruleForm.channels
    };
    if (editingRuleId.value) {
      await notificationsApi.updateRule(editingRuleId.value, payload);
    } else {
      await notificationsApi.createRule(payload);
    }
    ElMessage.success('通知规则已保存');
    ruleDialogVisible.value = false;
    await Promise.all([loadRules(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存通知规则失败');
  } finally {
    saving.value = false;
  }
}

async function toggleRule(row: NotificationRule) {
  try {
    if (row.enabled) {
      await notificationsApi.disableRule(row.id);
      ElMessage.success('通知规则已停用');
    } else {
      await notificationsApi.enableRule(row.id);
      ElMessage.success('通知规则已启用');
    }
    await Promise.all([loadRules(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '切换通知规则失败');
  }
}

async function removeRule(row: NotificationRule) {
  try {
    await ElMessageBox.confirm('删除后不会删除历史通知日志，确认删除规则吗？', '删除通知规则', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
    await notificationsApi.removeRule(row.id);
    ElMessage.success('通知规则已删除');
    await Promise.all([loadRules(), loadOverview()]);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除通知规则失败');
    }
  }
}

function openTemplateDialog() {
  editingTemplateId.value = '';
  Object.assign(templateForm, {
    name: '',
    eventCode: '',
    channel: 'system',
    title: '',
    content: '',
    enabled: true
  });
  templateDialogVisible.value = true;
}

function editTemplate(row: NotificationTemplate) {
  editingTemplateId.value = row.id;
  Object.assign(templateForm, {
    name: row.name,
    eventCode: row.eventCode,
    channel: row.channel,
    title: row.title,
    content: row.content,
    enabled: row.enabled
  });
  templateDialogVisible.value = true;
}

async function saveTemplate() {
  saving.value = true;
  try {
    const payload = { ...templateForm };
    if (editingTemplateId.value) {
      await notificationsApi.updateTemplate(editingTemplateId.value, payload);
    } else {
      await notificationsApi.createTemplate(payload);
    }
    ElMessage.success('通知模板已保存');
    templateDialogVisible.value = false;
    await loadTemplates();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存通知模板失败');
  } finally {
    saving.value = false;
  }
}

async function removeTemplate(row: NotificationTemplate) {
  try {
    await ElMessageBox.confirm('确认删除该通知模板吗？', '删除通知模板', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
    await notificationsApi.removeTemplate(row.id);
    ElMessage.success('通知模板已删除');
    await loadTemplates();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除通知模板失败');
    }
  }
}

function openTelegramDialog() {
  editingTelegramId.value = '';
  Object.assign(telegramForm, {
    notificationName: '',
    enabled: false,
    botToken: '',
    chatId: '',
    notificationLevel: 'warning',
    silentStartTime: '',
    silentEndTime: '',
    retryCount: 3
  });
  telegramDialogVisible.value = true;
}

function editTelegram(row: TelegramConfig) {
  editingTelegramId.value = row.id;
  Object.assign(telegramForm, {
    notificationName: row.notificationName,
    enabled: row.enabled,
    botToken: '',
    chatId: row.chatId,
    notificationLevel: row.notificationLevel,
    silentStartTime: row.silentStartTime ?? '',
    silentEndTime: row.silentEndTime ?? '',
    retryCount: row.retryCount
  });
  telegramDialogVisible.value = true;
}

async function saveTelegram() {
  saving.value = true;
  try {
    const payload = {
      notificationName: telegramForm.notificationName,
      enabled: telegramForm.enabled,
      botToken: telegramForm.botToken || undefined,
      chatId: telegramForm.chatId,
      notificationLevel: telegramForm.notificationLevel,
      silentStartTime: telegramForm.silentStartTime || null,
      silentEndTime: telegramForm.silentEndTime || null,
      retryCount: telegramForm.retryCount
    };
    if (editingTelegramId.value) {
      await notificationsApi.updateTelegramConfig(editingTelegramId.value, payload);
    } else {
      await notificationsApi.createTelegramConfig(payload);
    }
    ElMessage.success('Telegram 配置已保存');
    telegramDialogVisible.value = false;
    await Promise.all([loadTelegramConfigs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Telegram 配置失败');
  } finally {
    saving.value = false;
  }
}

async function testTelegram(row: TelegramConfig) {
  try {
    const result = await notificationsApi.testTelegram({
      configId: row.id,
      title: 'Telegram 通知测试',
      content: '这是一条来自代充管理后台的 Telegram 测试通知。'
    });
    if (result.status === 'success') {
      ElMessage.success('Telegram 测试发送成功');
    } else {
      ElMessage.warning(result.errorMessage || 'Telegram 测试发送失败');
    }
    await Promise.all([loadTelegramConfigs(), loadLogs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Telegram 测试发送失败');
  }
}

async function removeTelegram(row: TelegramConfig) {
  try {
    await ElMessageBox.confirm('确认删除该 Telegram 配置吗？', '删除 Telegram 配置', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
    await notificationsApi.removeTelegramConfig(row.id);
    ElMessage.success('Telegram 配置已删除');
    await Promise.all([loadTelegramConfigs(), loadOverview()]);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除 Telegram 配置失败');
    }
  }
}

async function markRead(row: NotificationLog) {
  try {
    await notificationsApi.markRead(row.id);
    await Promise.all([loadLogs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '标记已读失败');
  }
}

async function markAllRead() {
  try {
    const result = await notificationsApi.markAllRead();
    ElMessage.success(`已标记 ${result.updatedCount} 条通知为已读`);
    await Promise.all([loadLogs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '全部已读失败');
  }
}

async function retryLog(row: NotificationLog) {
  try {
    await notificationsApi.retryLog(row.id);
    ElMessage.success('通知已重试');
    await Promise.all([loadLogs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重试通知失败');
  }
}

function canRetryLog(status: NotificationLog['status']) {
  return status === 'failed' || status === 'skipped' || status === 'pending';
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

function isNotificationLevel(value: unknown): value is NotificationLevel {
  return value === 'info' || value === 'warning' || value === 'error' || value === 'critical';
}

function isNotificationChannel(value: unknown): value is 'telegram' | 'system' {
  return value === 'telegram' || value === 'system';
}

function isNotificationLogStatus(value: unknown): value is NotificationLog['status'] {
  return value === 'pending' || value === 'sent' || value === 'failed' || value === 'skipped';
}

function showExportMessage() {
  ElMessage.info('通知中心导出会走数据中心导出任务，后续统一接入');
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getChannelLabel(value: string) {
  if (value === 'telegram') return 'Telegram';
  if (value === 'system') return '站内通知';
  return value;
}

function getModuleLabel(value: string) {
  const labels: Record<string, string> = {
    apple: 'Apple ID',
    code: '兑换码',
    platform: '平台接口',
    security: '系统安全',
    ops: '运维',
    notification: '通知中心'
  };
  return labels[value] ?? value;
}

function getLevelLabel(value: NotificationLevel) {
  return levelOptions.find((item) => item.value === value)?.label ?? value;
}

function getLevelType(value: NotificationLevel) {
  if (value === 'critical' || value === 'error') return 'danger';
  if (value === 'warning') return 'warning';
  return 'info';
}

function getLogStatusLabel(value: NotificationLog['status']) {
  const labels: Record<NotificationLog['status'], string> = {
    pending: '待发送',
    sent: '已发送',
    failed: '失败',
    skipped: '已跳过'
  };
  return labels[value];
}

function getLogStatusType(value: NotificationLog['status']) {
  if (value === 'sent') return 'success';
  if (value === 'failed') return 'danger';
  if (value === 'skipped') return 'info';
  return 'warning';
}

function getTelegramTestLabel(value: TelegramConfig['lastTestStatus']) {
  if (value === 'success') return '成功';
  if (value === 'failed') return '失败';
  return '未测试';
}
</script>

<style scoped>
.dialog-alert {
  margin-bottom: 16px;
}

.inline-fields {
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}

.tag-gap {
  margin-left: 6px;
}

@media (max-width: 760px) {
  .inline-fields {
    grid-template-columns: 1fr;
  }
}
</style>
