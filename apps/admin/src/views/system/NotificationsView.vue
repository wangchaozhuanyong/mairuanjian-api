<template>
  <PageScaffold
    title="通知设置"
    group="系统配置"
    phase="Phase 9"
    description="配置后台提醒规则、Telegram、通知模板和发送日志。"
  >
    <template #actions>
      <AppButton @click="refreshCurrentTab">刷新</AppButton>
      <AppButton variant="primary" @click="openPrimaryDialog">{{ primaryActionText }}</AppButton>
    </template>

    <section class="content-panel" aria-label="通知设置概览">
      <div class="detail-note-grid">
        <div class="detail-note-item">
          <span>启用规则</span>
          <strong>{{ overview?.enabledRuleCount ?? '-' }}</strong>
          <span>当前启用的通知规则</span>
        </div>
        <div class="detail-note-item">
          <span>未读站内通知</span>
          <strong>{{ overview?.unreadCount ?? '-' }}</strong>
          <span>当前用户可见</span>
        </div>
        <div class="detail-note-item">
          <span>失败通知</span>
          <strong>{{ overview?.failedLogCount ?? '-' }}</strong>
          <span>需要重试或排查</span>
        </div>
        <div class="detail-note-item">
          <span>Telegram 配置</span>
          <strong>{{ overview?.telegramCount ?? '-' }}</strong>
          <span>已启用配置</span>
        </div>
      </div>
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <PanelTitleHelp :title="activeTabMeta.title" :help="activeTabMeta.description" />
        <div class="inline-actions">
          <StatusChip :tone="activeTabMeta.tone" dot>{{ activeTabMeta.badge }}</StatusChip>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="notification-tabs" @tab-change="refreshCurrentTab">
        <el-tab-pane label="通知总览" name="overview">
          <el-table class="desktop-data-table" :data="overview?.recentLogs ?? []" row-key="id">
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
                <StatusChip :tone="getLogStatusTone(row.status)" dot>
                  {{ getLogStatusLabel(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="内容摘要" min-width="260" prop="contentDigest" />
            <el-table-column label="时间" min-width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>

          <div v-if="overview?.recentLogs?.length" class="mobile-record-list">
            <article v-for="log in overview.recentLogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.title }}</strong>
                  <span>{{ log.eventCode }} · {{ getModuleLabel(log.module) }}</span>
                </div>
                <StatusChip :tone="getLogStatusTone(log.status)" dot>
                  {{ getLogStatusLabel(log.status) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>渠道</span>
                  <strong>{{ getChannelLabel(log.channel) }}</strong>
                </div>
                <div>
                  <span>模块</span>
                  <strong>{{ getModuleLabel(log.module) }}</strong>
                </div>
                <div>
                  <span>时间</span>
                  <strong>{{ formatDate(log.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>内容摘要</span>
                  <strong>{{ log.contentDigest }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无最近通知</strong>
              <span>通知发送后会在这里显示最近日志。</span>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="通知规则" name="rules">
          <TableToolbar
            v-model:keyword="ruleQuery.keyword"
            v-model:status="ruleQuery.enabled"
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
            class="desktop-data-table"
            :data="rules"
            :size="ruleTableSize"
            row-key="id"
            @sort-change="handleRuleSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无通知规则</strong>
                <span>可以新增规则，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearRuleFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openRuleDialog">新增通知规则</AppButton>
                </div>
              </div>
            </template>
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
                <StatusChip class="tag-gap" :tone="getLevelTone(row.level)" dot>
                  {{ getLevelLabel(row.level) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column v-if="isRuleColumnVisible('channels')" label="渠道" min-width="140">
              <template #default="{ row }">
                <StatusChip
                  v-for="channel in row.channels"
                  :key="channel"
                  class="tag-gap"
                  tone="blue"
                >
                  {{ getChannelLabel(channel) }}
                </StatusChip>
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
                <StatusChip :tone="row.enabled ? 'green' : 'neutral'" dot>
                  {{ row.enabled ? '启用' : '停用' }}
                </StatusChip>
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
                <div class="table-action-group">
                  <AppButton size="small" variant="ghost" @click="editRule(row)">编辑</AppButton>
                  <AppButton size="small" variant="soft" @click="toggleRule(row)">
                    {{ row.enabled ? '停用' : '启用' }}
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="removeRule(row)">删除</AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="rules.length" class="mobile-record-list">
            <article v-for="rule in rules" :key="rule.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ rule.name }}</strong>
                  <span>{{ rule.eventCode }} · {{ getModuleLabel(rule.module) }}</span>
                </div>
                <StatusChip :tone="rule.enabled ? 'green' : 'neutral'" dot>
                  {{ rule.enabled ? '启用' : '停用' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>模块</span>
                  <strong>{{ getModuleLabel(rule.module) }}</strong>
                </div>
                <div>
                  <span>级别</span>
                  <strong>{{ getLevelLabel(rule.level) }}</strong>
                </div>
                <div>
                  <span>最近触发</span>
                  <strong>{{ formatDate(rule.lastTriggeredAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__chips">
                <StatusChip v-for="channel in rule.channels" :key="channel" tone="blue">
                  {{ getChannelLabel(channel) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="ghost" @click="editRule(rule)">编辑</AppButton>
                <AppButton size="small" variant="soft" @click="toggleRule(rule)">
                  {{ rule.enabled ? '停用' : '启用' }}
                </AppButton>
                <AppButton size="small" variant="danger" @click="removeRule(rule)">删除</AppButton>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无通知规则</strong>
              <span>可以通过顶部主操作新增规则，或清空筛选后重新查看。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="clearRuleFilters">清空筛选</AppButton>
                <AppButton variant="primary" @click="openRuleDialog">新增通知规则</AppButton>
              </div>
            </div>
          </div>
          <PaginationBar
            v-model:page="ruleQuery.page"
            v-model:page-size="ruleQuery.pageSize"
            :total="ruleTotal"
            @change="loadRules"
          />
        </el-tab-pane>

        <el-tab-pane label="通知模板" name="templates">
          <TableToolbar
            v-model:keyword="templateQuery.keyword"
            v-model:status="templateQuery.enabled"
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
            class="desktop-data-table"
            :data="templates"
            :size="templateTableSize"
            row-key="id"
            @sort-change="handleTemplateSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无通知模板</strong>
                <span>可以新增模板，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearTemplateFilters">清空筛选</AppButton>
                  <AppButton variant="primary" @click="openTemplateDialog">新增通知模板</AppButton>
                </div>
              </div>
            </template>
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
                <StatusChip :tone="row.enabled ? 'green' : 'neutral'" dot>
                  {{ row.enabled ? '启用' : '停用' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group">
                  <AppButton size="small" variant="ghost" @click="editTemplate(row)"
                    >编辑</AppButton
                  >
                  <AppButton size="small" variant="danger" @click="removeTemplate(row)">
                    删除
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="templates.length" class="mobile-record-list">
            <article v-for="template in templates" :key="template.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ template.name }}</strong>
                  <span>{{ template.eventCode }} · {{ getChannelLabel(template.channel) }}</span>
                </div>
                <StatusChip :tone="template.enabled ? 'green' : 'neutral'" dot>
                  {{ template.enabled ? '启用' : '停用' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>标题</span>
                  <strong>{{ template.title }}</strong>
                </div>
                <div>
                  <span>内容</span>
                  <strong>{{ template.content }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="ghost" @click="editTemplate(template)">
                  编辑
                </AppButton>
                <AppButton size="small" variant="danger" @click="removeTemplate(template)">
                  删除
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无通知模板</strong>
              <span>可以新增模板，或清空筛选后重新查看。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="clearTemplateFilters">清空筛选</AppButton>
                <AppButton variant="primary" @click="openTemplateDialog">新增通知模板</AppButton>
              </div>
            </div>
          </div>
          <PaginationBar
            v-model:page="templateQuery.page"
            v-model:page-size="templateQuery.pageSize"
            :total="templateTotal"
            @change="loadTemplates"
          />
        </el-tab-pane>

        <el-tab-pane label="Telegram 配置" name="telegram">
          <div class="detail-note-grid notification-telegram-summary">
            <div class="detail-note-item">
              <span>配置数量</span>
              <strong>{{ telegramConfigs.length }}</strong>
            </div>
            <div class="detail-note-item">
              <span>启用配置</span>
              <strong>{{ enabledTelegramCount }}</strong>
            </div>
            <div class="detail-note-item">
              <span>已配置 Token</span>
              <strong>{{ tokenConfiguredCount }}</strong>
            </div>
            <div class="detail-note-item">
              <span>测试成功</span>
              <strong>{{ successfulTelegramTests }}</strong>
            </div>
          </div>
          <el-table
            v-loading="telegramLoading"
            class="desktop-data-table"
            :data="telegramConfigs"
            row-key="id"
          >
            <el-table-column label="通知名称" min-width="170" prop="notificationName" />
            <el-table-column label="Chat ID" min-width="160" prop="chatId" />
            <el-table-column label="Token" width="110">
              <template #default="{ row }">
                {{ row.hasBotToken ? `****${row.botTokenTail ?? ''}` : '未配置' }}
              </template>
            </el-table-column>
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <StatusChip :tone="getLevelTone(row.notificationLevel)" dot>
                  {{ getLevelLabel(row.notificationLevel) }}
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
            <el-table-column label="最近测试" min-width="170">
              <template #default="{ row }">
                {{ getTelegramTestLabel(row.lastTestStatus) }}
                <div class="muted-block">{{ formatDate(row.lastTestAt) }}</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group">
                  <AppButton size="small" variant="ghost" @click="editTelegram(row)"
                    >编辑</AppButton
                  >
                  <AppButton size="small" variant="success" @click="testTelegram(row)">
                    测试发送
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="removeTelegram(row)">
                    删除
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="telegramConfigs.length" class="mobile-record-list">
            <article v-for="config in telegramConfigs" :key="config.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ config.notificationName }}</strong>
                  <span>{{ config.chatId }}</span>
                </div>
                <StatusChip :tone="config.enabled ? 'green' : 'neutral'" dot>
                  {{ config.enabled ? '启用' : '停用' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>Token</span>
                  <strong>{{
                    config.hasBotToken ? `****${config.botTokenTail ?? ''}` : '未配置'
                  }}</strong>
                </div>
                <div>
                  <span>级别</span>
                  <strong>{{ getLevelLabel(config.notificationLevel) }}</strong>
                </div>
                <div>
                  <span>最近测试</span>
                  <strong>{{ getTelegramTestLabel(config.lastTestStatus) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>测试时间</span>
                  <strong>{{ formatDate(config.lastTestAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="ghost" @click="editTelegram(config)">
                  编辑
                </AppButton>
                <AppButton size="small" variant="success" @click="testTelegram(config)">
                  测试发送
                </AppButton>
                <AppButton size="small" variant="danger" @click="removeTelegram(config)">
                  删除
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无 Telegram 配置</strong>
              <span>新增配置后可以在这里测试发送和管理通知级别。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="primary" @click="openTelegramDialog"
                  >新增 Telegram 配置</AppButton
                >
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="通知日志" name="logs">
          <TableToolbar
            v-model:keyword="logQuery.keyword"
            v-model:status="logQuery.status"
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
              <AppButton @click="markAllRead">全部已读</AppButton>
            </template>
          </TableToolbar>

          <el-table
            v-loading="logsLoading"
            class="desktop-data-table"
            :data="logs"
            :size="logTableSize"
            row-key="id"
            @sort-change="handleLogSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无通知日志</strong>
                <span>可以清空筛选后重新查看，或等待通知任务生成日志。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearLogFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
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
                <StatusChip :tone="getLogStatusTone(row.status)" dot>
                  {{ getLogStatusLabel(row.status) }}
                </StatusChip>
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
                <div class="table-action-group">
                  <AppButton
                    size="small"
                    variant="ghost"
                    :disabled="row.readAt"
                    @click="markRead(row)"
                  >
                    已读
                  </AppButton>
                  <AppButton
                    size="small"
                    variant="ghost"
                    :disabled="!canRetryLog(row.status)"
                    @click="retryLog(row)"
                  >
                    重试
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="logs.length" class="mobile-record-list">
            <article v-for="log in logs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.title }}</strong>
                  <span>{{ log.eventCode }} · {{ getModuleLabel(log.module) }}</span>
                </div>
                <StatusChip :tone="getLogStatusTone(log.status)" dot>
                  {{ getLogStatusLabel(log.status) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>渠道</span>
                  <strong>{{ getChannelLabel(log.channel) }}</strong>
                </div>
                <div>
                  <span>接收人</span>
                  <strong>{{ log.recipient || log.recipientUserId || '全部' }}</strong>
                </div>
                <div>
                  <span>时间</span>
                  <strong>{{ formatDate(log.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>内容摘要</span>
                  <strong>{{ log.contentDigest }}</strong>
                </div>
                <div>
                  <span>错误</span>
                  <strong>{{ log.errorMessage || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton
                  size="small"
                  variant="ghost"
                  :disabled="Boolean(log.readAt)"
                  @click="markRead(log)"
                >
                  已读
                </AppButton>
                <AppButton
                  size="small"
                  variant="ghost"
                  :disabled="!canRetryLog(log.status)"
                  @click="retryLog(log)"
                >
                  重试
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无通知日志</strong>
              <span>可以清空筛选后重新查看，或等待通知任务生成日志。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="clearLogFilters">清空筛选</AppButton>
              </div>
            </div>
          </div>
          <PaginationBar
            v-model:page="logQuery.page"
            v-model:page-size="logQuery.pageSize"
            :total="logTotal"
            @change="loadLogs"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="ruleDialogVisible"
      :title="editingRuleId ? '编辑通知规则' : '新增通知规则'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="规则名称"
              purpose="通知规则的内部名称，列表里用它区分不同提醒。"
              example="可以填 Apple ID 余额不足提醒、兑换码低库存提醒。"
            />
          </template>
          <el-input v-model="ruleForm.name" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="事件编码"
              purpose="系统触发通知时使用的事件标识，必须和后端事件保持一致。"
              example="Apple ID 余额低可以填 apple.balance.low。"
            />
          </template>
          <el-input v-model="ruleForm.eventCode" placeholder="apple.balance.low" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模块"
              purpose="说明这条通知属于哪个业务模块，方便筛选和分级管理。"
              example="Apple ID 相关选 Apple ID，兑换码库存相关选兑换码。"
            />
          </template>
          <el-select v-model="ruleForm.module" class="full-width">
            <el-option
              v-for="item in moduleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="级别"
              purpose="通知严重程度，影响员工优先级和 Telegram 配置过滤。"
              example="普通提醒选信息；可能影响订单选警告；需要立刻处理选严重。"
            />
          </template>
          <el-select v-model="ruleForm.level" class="full-width">
            <el-option
              v-for="item in levelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="渠道"
              purpose="选择这条规则触发后通过哪些地方提醒员工。"
              example="后台必看选站内通知；需要外部提醒再勾 Telegram。"
            />
          </template>
          <el-checkbox-group v-model="ruleForm.channels">
            <el-checkbox
              v-for="item in channelOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="启用"
              purpose="控制这条通知规则是否生效。"
              example="确认事件和模板都配置好后打开；测试或废弃规则关闭。"
            />
          </template>
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="ruleDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveRule">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="templateDialogVisible"
      :title="editingTemplateId ? '编辑通知模板' : '新增通知模板'"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form label-position="top">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模板名称"
              purpose="通知模板的内部名称，便于区分不同事件和渠道模板。"
              example="可以填余额不足 Telegram 模板、低库存站内模板。"
            />
          </template>
          <el-input v-model="templateForm.name" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="事件编码"
              purpose="模板对应的触发事件，需和通知规则事件编码一致。"
              example="规则是 apple.balance.low，这里也填 apple.balance.low。"
            />
          </template>
          <el-input v-model="templateForm.eventCode" placeholder="apple.balance.low" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="渠道"
              purpose="这个模板用于哪个通知渠道，不同渠道可以使用不同文字。"
              example="站内通知可以短一点，Telegram 可以带更完整处理建议。"
            />
          </template>
          <el-select v-model="templateForm.channel" class="full-width">
            <el-option
              v-for="item in channelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="标题"
              purpose="通知显示的标题，员工第一眼会看到它。"
              example="可以写 Apple ID 余额不足、兑换码库存告警。"
            />
          </template>
          <el-input v-model="templateForm.title" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="内容"
              purpose="通知正文，告诉员工发生了什么、该怎么处理。"
              example="可以写账号 {{appleId}} 余额低于 {{threshold}}，请及时充值。"
            />
          </template>
          <el-input v-model="templateForm.content" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="启用"
              purpose="控制这个模板是否可用于发送通知。"
              example="模板确认无误后启用；草稿或旧模板关闭。"
            />
          </template>
          <el-switch v-model="templateForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="templateDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveTemplate">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="telegramDialogVisible"
      :title="editingTelegramId ? '编辑 Telegram 配置' : '新增 Telegram 配置'"
      width="min(560px, calc(100vw - 24px))"
    >
      <div class="apple-core-alert apple-core-alert--blue dialog-alert" role="status">
        <StatusChip tone="blue">加密保存</StatusChip>
        <div>
          <strong>Bot Token 会加密保存</strong>
          <p>列表只显示尾号，查看和编辑仍按现有权限与审计流程执行。</p>
        </div>
      </div>
      <el-form label-position="top">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="通知名称"
              purpose="Telegram 配置的内部名称，便于区分不同群或机器人。"
              example="可以填老板群、客服值班群、运维告警群。"
            />
          </template>
          <el-input v-model="telegramForm.notificationName" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="Bot Token"
              purpose="Telegram 机器人 Token，属于敏感信息，会加密保存且列表只显示尾号。"
              example="从 BotFather 复制完整 Token；编辑时不更新 Token 可留空。"
            />
          </template>
          <el-input v-model="telegramForm.botToken" type="password" show-password />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="Chat ID / 群组 ID"
              purpose="机器人要把消息发到哪个聊天或群组。"
              example="群组一般是负数 ID，个人聊天可能是数字 ID。"
            />
          </template>
          <el-input v-model="telegramForm.chatId" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="通知级别"
              purpose="限制哪些级别的通知会发到这个 Telegram 配置。"
              example="老板群只收严重告警，客服群可以收警告和严重。"
            />
          </template>
          <el-select v-model="telegramForm.notificationLevel" class="full-width">
            <el-option
              v-for="item in levelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="静默时间"
              purpose="设置不想被 Telegram 打扰的时间段。"
              example="晚上不发可填开始 23:00、结束 08:00。"
            />
          </template>
          <div class="inline-fields">
            <el-input v-model="telegramForm.silentStartTime" placeholder="开始 HH:mm" />
            <el-input v-model="telegramForm.silentEndTime" placeholder="结束 HH:mm" />
          </div>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="失败重试次数"
              purpose="Telegram 发送失败后系统最多重试几次。"
              example="网络偶发不稳定可以填 3；不想重试填 0。"
            />
          </template>
          <el-input-number
            v-model="telegramForm.retryCount"
            :min="0"
            :max="10"
            class="full-width"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="启用"
              purpose="控制这组 Telegram 通知配置是否生效。"
              example="Token 和 Chat ID 测试通过后打开；临时停用通知就关闭。"
            />
          </template>
          <el-switch v-model="telegramForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="telegramDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveTelegram">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  dataCenterApi,
  notificationsApi,
  userTableViewsApi,
  type DataDictionaryQuery,
  type NotificationLogQuery,
  type NotificationRuleQuery,
  type NotificationTemplateQuery
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import type {
  DataDictionary,
  NotificationLevel,
  NotificationLog,
  NotificationOverview,
  NotificationRule,
  NotificationTemplate,
  TableDensity,
  TelegramConfig,
  UserTableView
} from '@/types/system';
import {
  createSmartQueryKey,
  getSmartQueryData,
  invalidateSmartQueries,
  refreshSmartQuery
} from '@/utils/smartQuery';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import {
  buildNotificationChannelOptions,
  buildNotificationLevelOptions,
  buildNotificationModuleOptions,
  getNotificationChannelLabel,
  getNotificationLevelLabel,
  getNotificationModuleLabel,
  isNotificationChannel as isQuickNotificationChannel,
  isNotificationLevel as isQuickNotificationLevel
} from '@/utils/notificationOptions';
import {
  NOTIFICATION_CHANNEL_DICTIONARY_GROUP,
  NOTIFICATION_LEVEL_DICTIONARY_GROUP,
  NOTIFICATION_MODULE_DICTIONARY_GROUP
} from '@/config/quickSettings';

const activeTab = ref('overview');
const overview = ref<NotificationOverview | null>(null);
const rules = ref<NotificationRule[]>([]);
const templates = ref<NotificationTemplate[]>([]);
const logs = ref<NotificationLog[]>([]);
const telegramConfigs = ref<TelegramConfig[]>([]);
const notificationModuleDictionaries = ref<DataDictionary[]>([]);
const notificationLevelDictionaries = ref<DataDictionary[]>([]);
const notificationChannelDictionaries = ref<DataDictionary[]>([]);
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
const activeOverviewQueryKey = ref('');
const activeRulesQueryKey = ref('');
const activeTemplatesQueryKey = ref('');
const activeTelegramQueryKey = ref('');
const activeLogsQueryKey = ref('');
const activatedOnce = ref(false);
const ruleViewsLoaded = ref(false);
const templateViewsLoaded = ref(false);
const logViewsLoaded = ref(false);
const ruleDialogVisible = ref(false);
const templateDialogVisible = ref(false);
const telegramDialogVisible = ref(false);
const editingRuleId = ref('');
const editingTemplateId = ref('');
const editingTelegramId = ref('');

type NotificationRulePage = Awaited<ReturnType<typeof notificationsApi.listRules>>;
type NotificationTemplatePage = Awaited<ReturnType<typeof notificationsApi.listTemplates>>;
type NotificationLogPage = Awaited<ReturnType<typeof notificationsApi.listLogs>>;
type TelegramConfigPage = Awaited<ReturnType<typeof notificationsApi.listTelegramConfigs>>;

const levelOptions = computed(() =>
  buildNotificationLevelOptions(notificationLevelDictionaries.value)
);
const moduleOptions = computed(() =>
  buildNotificationModuleOptions(notificationModuleDictionaries.value)
);
const channelOptions = computed(() =>
  buildNotificationChannelOptions(notificationChannelDictionaries.value)
);
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
  if (activeTab.value === 'templates') return '新增通知模板';
  if (activeTab.value === 'telegram') return '新增 Telegram';
  return '新增通知规则';
});
const activeTabMeta = computed(() => {
  if (activeTab.value === 'rules') {
    return {
      title: '通知规则',
      description: '按事件、模块、级别和渠道管理触发规则，启停动作会写入操作日志。',
      badge: `${ruleTotal.value} 条规则`,
      tone: 'blue' as const
    };
  }

  if (activeTab.value === 'templates') {
    return {
      title: '通知模板',
      description: '维护站内通知和 Telegram 的标题、正文和变量占位内容。',
      badge: `${templateTotal.value} 个模板`,
      tone: 'purple' as const
    };
  }

  if (activeTab.value === 'telegram') {
    return {
      title: 'Telegram 配置',
      description: 'Bot Token 加密保存，列表只展示尾号，测试发送用于验证配置可用性。',
      badge: `${enabledTelegramCount.value} 个启用`,
      tone: 'green' as const
    };
  }

  if (activeTab.value === 'logs') {
    return {
      title: '通知日志',
      description: '排查通知发送、跳过、失败和重试记录，失败项可在这里重新触发。',
      badge: `${logTotal.value} 条日志`,
      tone: 'orange' as const
    };
  }

  return {
    title: '通知总览',
    description: '快速查看近期通知、未读站内消息、失败发送和 Telegram 配置状态。',
    badge: `${overview.value?.recentLogs.length ?? 0} 条近期记录`,
    tone: 'blue' as const
  };
});
const enabledTelegramCount = computed(
  () => telegramConfigs.value.filter((item) => item.enabled).length
);
const tokenConfiguredCount = computed(
  () => telegramConfigs.value.filter((item) => item.hasBotToken).length
);
const successfulTelegramTests = computed(
  () => telegramConfigs.value.filter((item) => item.lastTestStatus === 'success').length
);
const ruleTableSize = computed(() => getTableSize(ruleDensity.value));
const templateTableSize = computed(() => getTableSize(templateDensity.value));
const logTableSize = computed(() => getTableSize(logDensity.value));
const ruleFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const moduleLabel = moduleOptions.value.find((item) => item.value === ruleQuery.module)?.label;
  const levelLabel = levelOptions.value.find((item) => item.value === ruleQuery.level)?.label;
  if (moduleLabel) chips.push({ key: 'module', label: '模块', value: moduleLabel });
  if (levelLabel) chips.push({ key: 'level', label: '级别', value: levelLabel });
  return chips;
});
const templateFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const channelLabel = channelOptions.value.find(
    (item) => item.value === templateQuery.channel
  )?.label;
  if (channelLabel) chips.push({ key: 'channel', label: '渠道', value: channelLabel });
  return chips;
});
const logFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const channelLabel = channelOptions.value.find(
    (item) => item.value === logQuery.channel
  )?.label;
  const moduleLabel = moduleOptions.value.find((item) => item.value === logQuery.module)?.label;
  if (channelLabel) chips.push({ key: 'channel', label: '渠道', value: channelLabel });
  if (moduleLabel) chips.push({ key: 'module', label: '模块', value: moduleLabel });
  return chips;
});

onMounted(async () => {
  await Promise.all([
    loadNotificationOptions({ force: false }),
    loadOverview({ force: false }),
    loadRulesWithViews({ force: false }),
    loadTemplatesWithViews({ force: false }),
    loadTelegramConfigs({ force: false }),
    loadLogsWithViews({ force: false })
  ]);
});

onActivated(() => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }

  const requests: Array<Promise<void>> = [
    loadOverview({
      background: Boolean(overview.value),
      force: false
    })
  ];

  if (activeTab.value !== 'overview') {
    requests.push(refreshActiveNotificationData({ background: true, force: false }));
  }

  void Promise.all(requests);
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [
    'notification-overview',
    'notification-rules',
    'notification-templates',
    'notification-telegram',
    'notification-logs',
    'data-dictionaries'
  ],
  ({ scopes }) => {
    const scopeSet = new Set(scopes);
    const requests: Array<Promise<void>> = [];

    if (scopeSet.has('data-dictionaries')) {
      requests.push(loadNotificationOptions({ background: true, force: true }));
    }

    if (scopeSet.has('notification-overview')) {
      requests.push(loadOverview({ background: Boolean(overview.value), force: true }));
    }

    if (activeTab.value === 'rules' && scopeSet.has('notification-rules')) {
      requests.push(loadRules({ background: rules.value.length > 0, force: true }));
    }

    if (activeTab.value === 'templates' && scopeSet.has('notification-templates')) {
      requests.push(loadTemplates({ background: templates.value.length > 0, force: true }));
    }

    if (activeTab.value === 'telegram' && scopeSet.has('notification-telegram')) {
      requests.push(
        loadTelegramConfigs({ background: telegramConfigs.value.length > 0, force: true })
      );
    }

    if (activeTab.value === 'logs' && scopeSet.has('notification-logs')) {
      requests.push(loadLogs({ background: logs.value.length > 0, force: true }));
    }

    void Promise.all(requests);
  }
);

onBeforeUnmount(stopRealtimeRefresh);

usePageRefresh(
  async (options) => {
    await Promise.all([
      loadNotificationOptions({
        background: options.background,
        force: options.force ?? true
      }),
      refreshActiveNotificationData({
        background: options.background,
        force: options.force ?? true
      })
    ]);
  },
  { label: '通知设置当前标签' }
);

async function refreshCurrentTab() {
  await refreshActiveNotificationData({ force: true });
}

async function refreshActiveNotificationData(
  options: { background?: boolean; force?: boolean } = {}
) {
  if (activeTab.value === 'overview') {
    await loadOverview(options);
  }
  if (activeTab.value === 'rules') {
    await loadRulesWithViews(options);
  }
  if (activeTab.value === 'templates') {
    await loadTemplatesWithViews(options);
  }
  if (activeTab.value === 'telegram') {
    await loadTelegramConfigs(options);
  }
  if (activeTab.value === 'logs') {
    await loadLogsWithViews(options);
  }
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

function buildNotificationOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadNotificationOptions(options: { background?: boolean; force?: boolean } = {}) {
  try {
    const [modules, levels, channels] = await Promise.all([
      dataCenterApi.listDictionaries(
        buildNotificationOptionParams(NOTIFICATION_MODULE_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildNotificationOptionParams(NOTIFICATION_LEVEL_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildNotificationOptionParams(NOTIFICATION_CHANNEL_DICTIONARY_GROUP)
      )
    ]);
    notificationModuleDictionaries.value = modules.items;
    notificationLevelDictionaries.value = levels.items;
    notificationChannelDictionaries.value = channels.items;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载通知选项失败');
    }
  }
}

async function loadOverview(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('notification-overview');
  const cached = getSmartQueryData<NotificationOverview>(key);

  activeOverviewQueryKey.value = key;

  if (cached) {
    overview.value = cached;
  }

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => notificationsApi.overview(),
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
      ElMessage.error(error instanceof Error ? error.message : '加载通知总览失败');
    }
  }
}

async function loadRules(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildRuleListParams();
  const key = createSmartQueryKey('notification-rules', params);
  const cached = getSmartQueryData<NotificationRulePage>(key);

  activeRulesQueryKey.value = key;

  if (cached) {
    applyRuleListResult(cached);
  }

  rulesLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => notificationsApi.listRules(params),
      force: options.force ?? true
    });

    if (activeRulesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyRuleListResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载通知规则失败');
    }
  } finally {
    if (activeRulesQueryKey.value === key) {
      rulesLoading.value = false;
    }
  }
}

async function loadTemplates(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildTemplateListParams();
  const key = createSmartQueryKey('notification-templates', params);
  const cached = getSmartQueryData<NotificationTemplatePage>(key);

  activeTemplatesQueryKey.value = key;

  if (cached) {
    applyTemplateListResult(cached);
  }

  templatesLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => notificationsApi.listTemplates(params),
      force: options.force ?? true
    });

    if (activeTemplatesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyTemplateListResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载通知模板失败');
    }
  } finally {
    if (activeTemplatesQueryKey.value === key) {
      templatesLoading.value = false;
    }
  }
}

async function loadTelegramConfigs(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('notification-telegram');
  const cached = getSmartQueryData<TelegramConfigPage>(key);

  activeTelegramQueryKey.value = key;

  if (cached) {
    telegramConfigs.value = cached.items;
  }

  telegramLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => notificationsApi.listTelegramConfigs(),
      force: options.force ?? true
    });

    if (activeTelegramQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      telegramConfigs.value = result.data.items;
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Telegram 配置失败');
    }
  } finally {
    if (activeTelegramQueryKey.value === key) {
      telegramLoading.value = false;
    }
  }
}

async function loadLogs(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildLogListParams();
  const key = createSmartQueryKey('notification-logs', params);
  const cached = getSmartQueryData<NotificationLogPage>(key);

  activeLogsQueryKey.value = key;

  if (cached) {
    applyLogListResult(cached);
  }

  logsLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => notificationsApi.listLogs(params),
      force: options.force ?? true
    });

    if (activeLogsQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyLogListResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载通知日志失败');
    }
  } finally {
    if (activeLogsQueryKey.value === key) {
      logsLoading.value = false;
    }
  }
}

function buildRuleListParams(): NotificationRuleQuery {
  return {
    ...ruleQuery,
    keyword: ruleQuery.keyword || undefined,
    module: ruleQuery.module || undefined,
    level: ruleQuery.level || undefined,
    enabled: ruleQuery.enabled || undefined,
    sortBy: ruleSortConfig.value.prop,
    sortOrder: mapSortOrder(ruleSortConfig.value.order)
  };
}

function buildTemplateListParams(): NotificationTemplateQuery {
  return {
    ...templateQuery,
    keyword: templateQuery.keyword || undefined,
    eventCode: templateQuery.eventCode || undefined,
    channel: templateQuery.channel || undefined,
    enabled: templateQuery.enabled || undefined,
    sortBy: templateSortConfig.value.prop,
    sortOrder: mapSortOrder(templateSortConfig.value.order)
  };
}

function buildLogListParams(): NotificationLogQuery {
  return {
    ...logQuery,
    keyword: logQuery.keyword || undefined,
    module: logQuery.module || undefined,
    eventCode: logQuery.eventCode || undefined,
    channel: logQuery.channel || undefined,
    status: logQuery.status || undefined,
    sortBy: logSortConfig.value.prop,
    sortOrder: mapSortOrder(logSortConfig.value.order)
  };
}

function applyRuleListResult(result: NotificationRulePage) {
  rules.value = result.items;
  ruleTotal.value = result.total;
}

function applyTemplateListResult(result: NotificationTemplatePage) {
  templates.value = result.items;
  templateTotal.value = result.total;
}

function applyLogListResult(result: NotificationLogPage) {
  logs.value = result.items;
  logTotal.value = result.total;
}

async function loadRulesWithViews(options: { background?: boolean; force?: boolean } = {}) {
  await ensureRuleTableViews();
  await loadRules(options);
}

async function loadTemplatesWithViews(options: { background?: boolean; force?: boolean } = {}) {
  await ensureTemplateTableViews();
  await loadTemplates(options);
}

async function loadLogsWithViews(options: { background?: boolean; force?: boolean } = {}) {
  await ensureLogTableViews();
  await loadLogs(options);
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存通知模板视图', {
      inputValue: '通知模板常用视图',
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
  ruleDensity.value = 'default';
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
  templateDensity.value = 'default';
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
  logDensity.value = 'default';
  logVisibleColumns.value = normalizeColumns(view.columns, logColumnOptions);
  logSortConfig.value = parseSortConfig(view.sortConfig);
  logSavedViewId.value = view.id;
}

function getDefaultRuleModule() {
  return moduleOptions.value[0]?.value ?? 'apple';
}

function getDefaultNotificationLevel() {
  return (
    levelOptions.value.find((option) => option.value === 'warning')?.value ??
    levelOptions.value[0]?.value ??
    'warning'
  );
}

function getDefaultNotificationChannel() {
  return channelOptions.value[0]?.value ?? 'system';
}

function openRuleDialog() {
  editingRuleId.value = '';
  Object.assign(ruleForm, {
    name: '',
    eventCode: '',
    module: getDefaultRuleModule(),
    level: getDefaultNotificationLevel(),
    enabled: true,
    channels: [getDefaultNotificationChannel()]
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
    invalidateSmartQueries('notification-rules');
    invalidateSmartQueries('notification-overview');
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
    invalidateSmartQueries('notification-rules');
    invalidateSmartQueries('notification-overview');
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
    invalidateSmartQueries('notification-rules');
    invalidateSmartQueries('notification-overview');
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
    channel: getDefaultNotificationChannel(),
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
    invalidateSmartQueries('notification-templates');
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
    invalidateSmartQueries('notification-templates');
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
    notificationLevel: getDefaultNotificationLevel(),
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
    invalidateSmartQueries('notification-telegram');
    invalidateSmartQueries('notification-overview');
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
    invalidateSmartQueries('notification-telegram');
    invalidateSmartQueries('notification-logs');
    invalidateSmartQueries('notification-overview');
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
    invalidateSmartQueries('notification-telegram');
    invalidateSmartQueries('notification-overview');
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
    invalidateSmartQueries('notification-logs');
    invalidateSmartQueries('notification-overview');
    await Promise.all([loadLogs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '标记已读失败');
  }
}

async function markAllRead() {
  try {
    const result = await notificationsApi.markAllRead();
    ElMessage.success(`已标记 ${result.updatedCount} 条通知为已读`);
    invalidateSmartQueries('notification-logs');
    invalidateSmartQueries('notification-overview');
    await Promise.all([loadLogs(), loadOverview()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '全部已读失败');
  }
}

async function retryLog(row: NotificationLog) {
  try {
    await notificationsApi.retryLog(row.id);
    ElMessage.success('通知已重试');
    invalidateSmartQueries('notification-logs');
    invalidateSmartQueries('notification-overview');
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
  return typeof value === 'string' && isQuickNotificationLevel(value);
}

function isNotificationChannel(value: unknown): value is 'telegram' | 'system' {
  return typeof value === 'string' && isQuickNotificationChannel(value);
}

function isNotificationLogStatus(value: unknown): value is NotificationLog['status'] {
  return value === 'pending' || value === 'sent' || value === 'failed' || value === 'skipped';
}

function showExportMessage() {
  ElMessage.info('通知设置导出会走数据中心导出任务，后续统一接入');
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getChannelLabel(value: string) {
  return getNotificationChannelLabel(value, notificationChannelDictionaries.value);
}

function getModuleLabel(value: string) {
  return getNotificationModuleLabel(value, notificationModuleDictionaries.value);
}

function getLevelLabel(value: NotificationLevel) {
  return getNotificationLevelLabel(value, notificationLevelDictionaries.value);
}

function getLevelTone(value: NotificationLevel) {
  if (value === 'critical' || value === 'error') return 'red';
  if (value === 'warning') return 'orange';
  return 'blue';
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

function getLogStatusTone(value: NotificationLog['status']) {
  if (value === 'sent') return 'green';
  if (value === 'failed') return 'red';
  if (value === 'skipped') return 'neutral';
  return 'orange';
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
