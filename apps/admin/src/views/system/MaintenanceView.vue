<template>
  <PageScaffold
    title="网站维护"
    group="系统管理"
    phase="Phase 13"
    description="集中管理系统公告、维护模式、版本信息、更新日志、功能开关、菜单配置、主题配置和系统参数。"
  >
    <template #actions>
      <el-button @click="refreshCurrentTab">刷新</el-button>
      <el-button type="primary" @click="openPrimaryDialog">{{ primaryActionText }}</el-button>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="启用公告"
        :value="overview?.enabledAnnouncementCount ?? '-'"
        hint="当前对后台用户可见"
        tone="blue"
      />
      <MetricCard
        label="维护模式"
        :value="overview?.maintenanceModeEnabled ? '开启' : '关闭'"
        :hint="overview?.activeMaintenanceWindow.reason ?? '系统正常运行'"
        :tone="overview?.maintenanceModeEnabled ? 'red' : 'green'"
      />
      <MetricCard
        label="功能开关"
        :value="overview?.enabledFeatureFlagCount ?? '-'"
        hint="当前启用数量"
        tone="orange"
      />
      <MetricCard
        label="最新版本"
        :value="overview?.latestVersion?.version ?? '-'"
        :hint="overview?.latestVersion?.title ?? '暂无版本记录'"
        tone="purple"
      />
    </div>

    <section class="content-panel">
      <el-tabs v-model="activeTab" @tab-change="refreshCurrentTab">
        <el-tab-pane label="维护总览" name="overview">
          <div class="overview-grid">
            <div>
              <h3>最近公告</h3>
              <el-table v-loading="overviewLoading" :data="overview?.recentAnnouncements ?? []">
                <el-table-column label="公告" min-width="220">
                  <template #default="{ row }">
                    <strong>{{ row.title }}</strong>
                    <div class="muted-block">{{ row.content }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="级别" width="100">
                  <template #default="{ row }">
                    <LevelTag :level="row.level" />
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                  <template #default="{ row }">
                    <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="light">
                      {{ row.enabled ? '启用' : '停用' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="时间" width="170">
                  <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
            <div>
              <h3>最近版本</h3>
              <el-table v-loading="overviewLoading" :data="overview?.recentVersions ?? []">
                <el-table-column label="版本" width="120" prop="version" />
                <el-table-column label="标题" min-width="180" prop="title" />
                <el-table-column label="状态" width="100">
                  <template #default="{ row }"><VersionStatusTag :status="row.status" /></template>
                </el-table-column>
                <el-table-column label="发布" width="170">
                  <template #default="{ row }">{{ formatDate(row.releasedAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="系统公告" name="announcements">
          <TableToolbar
            v-model:keyword="announcementQuery.keyword"
            v-model:status="announcementQuery.enabled"
            v-model:density="announcementDensity"
            v-model:visible-columns="announcementVisibleColumns"
            v-model:saved-view-id="announcementSavedViewId"
            :column-options="announcementColumnOptions"
            :status-options="enabledStatusOptions"
            :saved-views="announcementSavedViews"
            :filter-chips="announcementFilterChips"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索公告标题或内容"
            @search="handleAnnouncementSearch"
            @refresh="loadAnnouncements"
            @clear-filters="clearAnnouncementFilters"
            @remove-filter="removeAnnouncementFilter"
            @save-view="saveAnnouncementTableView"
            @apply-view="applyAnnouncementSavedView"
            @export="showExportMessage"
          >
            <template #filters>
              <el-select
                v-model="announcementQuery.level"
                class="table-toolbar__select"
                placeholder="级别"
                clearable
                @change="handleAnnouncementSearch"
              >
                <el-option label="信息" value="info" />
                <el-option label="警告" value="warning" />
                <el-option label="错误" value="error" />
              </el-select>
            </template>
          </TableToolbar>
          <el-table
            v-loading="announcementsLoading"
            :data="announcements"
            :size="announcementTableSize"
            row-key="id"
            empty-text="暂无系统公告"
            @sort-change="handleAnnouncementSortChange"
          >
            <el-table-column
              v-if="isAnnouncementColumnVisible('announcement')"
              label="公告"
              prop="title"
              min-width="260"
              sortable="custom"
            >
              <template #default="{ row }">
                <strong>{{ row.title }}</strong>
                <div class="muted-block">{{ row.content }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isAnnouncementColumnVisible('level')"
              label="级别"
              prop="level"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }"><LevelTag :level="row.level" /></template>
            </el-table-column>
            <el-table-column
              v-if="isAnnouncementColumnVisible('enabled')"
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
            <el-table-column
              v-if="isAnnouncementColumnVisible('displayTime')"
              label="展示时间"
              prop="startAt"
              min-width="210"
              sortable="custom"
            >
              <template #default="{ row }">
                {{ formatDate(row.startAt) }} - {{ formatDate(row.endAt) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="isAnnouncementColumnVisible('updatedBy')"
              label="更新人"
              width="120"
            >
              <template #default="{ row }">{{ row.updatedBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isAnnouncementColumnVisible('updatedAt')"
              label="更新时间"
              prop="updatedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="editAnnouncement(row)">编辑</el-button>
                <el-button text type="danger" @click="removeAnnouncement(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="announcementQuery.page"
            v-model:page-size="announcementQuery.pageSize"
            :total="announcementTotal"
            @change="loadAnnouncements"
          />
        </el-tab-pane>

        <el-tab-pane label="维护模式" name="mode">
          <div class="settings-layout">
            <el-form label-width="110px" class="settings-form">
              <el-form-item label="是否启用">
                <el-switch
                  v-model="modeForm.enabled"
                  active-text="开启维护"
                  inactive-text="正常运行"
                />
              </el-form-item>
              <el-form-item label="维护原因">
                <el-input
                  v-model="modeForm.reason"
                  type="textarea"
                  :rows="3"
                  placeholder="输入维护原因，会显示给后台用户"
                />
              </el-form-item>
              <el-form-item label="允许角色">
                <el-input v-model="modeForm.allowedRolesText" placeholder="例如 admin,technician" />
              </el-form-item>
              <el-form-item label="允许 IP">
                <el-input
                  v-model="modeForm.allowedIpsText"
                  placeholder="多个 IP 或 CIDR 用逗号分隔"
                />
              </el-form-item>
              <el-form-item label="开始时间">
                <el-date-picker
                  v-model="modeForm.startAt"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
                  placeholder="可选"
                />
              </el-form-item>
              <el-form-item label="结束时间">
                <el-date-picker
                  v-model="modeForm.endAt"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
                  placeholder="可选"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="modeSaving" @click="saveMode"
                  >保存维护模式</el-button
                >
              </el-form-item>
            </el-form>
            <div class="settings-note">
              <h3>当前状态</h3>
              <p>
                {{
                  modeForm.enabled ? '维护模式开启后，普通用户将被限制访问。' : '系统当前正常运行。'
                }}
              </p>
              <p>修改维护模式会写入审计日志，后续可接入前台拦截和发布窗口。</p>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="功能开关" name="flags">
          <TableToolbar
            v-model:keyword="flagQuery.keyword"
            v-model:status="flagQuery.enabled"
            v-model:density="flagDensity"
            v-model:visible-columns="flagVisibleColumns"
            v-model:saved-view-id="flagSavedViewId"
            :column-options="flagColumnOptions"
            :status-options="enabledStatusOptions"
            :saved-views="flagSavedViews"
            :filter-chips="[]"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索开关编码、名称、备注"
            @search="handleFlagSearch"
            @refresh="loadFeatureFlags"
            @clear-filters="clearFlagFilters"
            @save-view="saveFlagTableView"
            @apply-view="applyFlagSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="flagsLoading"
            :data="featureFlags"
            :size="flagTableSize"
            row-key="id"
            empty-text="暂无功能开关"
            @sort-change="handleFlagSortChange"
          >
            <el-table-column
              v-if="isFlagColumnVisible('flag')"
              label="开关"
              prop="name"
              min-width="240"
              sortable="custom"
            >
              <template #default="{ row }">
                <strong>{{ row.name }}</strong>
                <div class="muted-block">{{ row.key }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isFlagColumnVisible('enabled')"
              label="状态"
              prop="enabled"
              width="110"
              sortable="custom"
            >
              <template #default="{ row }">
                <el-switch :model-value="row.enabled" @change="toggleFeatureFlag(row)" />
              </template>
            </el-table-column>
            <el-table-column v-if="isFlagColumnVisible('config')" label="配置" min-width="240">
              <template #default="{ row }">
                <code class="json-cell">{{ JSON.stringify(row.config ?? {}) }}</code>
              </template>
            </el-table-column>
            <el-table-column
              v-if="isFlagColumnVisible('remark')"
              label="备注"
              min-width="220"
              prop="remark"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column v-if="isFlagColumnVisible('updatedBy')" label="更新人" width="120">
              <template #default="{ row }">{{ row.updatedBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isFlagColumnVisible('updatedAt')"
              label="更新时间"
              prop="updatedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="editFeatureFlag(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="flagQuery.page"
            v-model:page-size="flagQuery.pageSize"
            :total="flagTotal"
            @change="loadFeatureFlags"
          />
        </el-tab-pane>

        <el-tab-pane label="版本信息" name="versions">
          <TableToolbar
            v-model:keyword="versionQuery.keyword"
            v-model:status="versionQuery.status"
            v-model:density="versionDensity"
            v-model:visible-columns="versionVisibleColumns"
            v-model:saved-view-id="versionSavedViewId"
            :column-options="versionColumnOptions"
            :status-options="versionStatusOptions"
            :saved-views="versionSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索版本、标题、更新内容"
            @search="handleVersionSearch"
            @refresh="loadAppVersions"
            @clear-filters="clearVersionFilters"
            @save-view="saveVersionTableView"
            @apply-view="applyVersionSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="versionsLoading"
            :data="appVersions"
            :size="versionTableSize"
            row-key="id"
            empty-text="暂无版本记录"
            @sort-change="handleVersionSortChange"
          >
            <el-table-column
              v-if="isVersionColumnVisible('version')"
              label="版本"
              prop="version"
              width="120"
              sortable="custom"
            />
            <el-table-column
              v-if="isVersionColumnVisible('title')"
              label="标题"
              prop="title"
              min-width="180"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isVersionColumnVisible('status')"
              label="状态"
              prop="status"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }"><VersionStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isVersionColumnVisible('impactModules')"
              label="影响模块"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.impactModules.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isVersionColumnVisible('releaseNotes')"
              label="更新内容"
              min-width="280"
              prop="releaseNotes"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isVersionColumnVisible('releasedAt')"
              label="发布时间"
              prop="releasedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.releasedAt) }}</template>
            </el-table-column>
            <el-table-column v-if="isVersionColumnVisible('createdBy')" label="创建人" width="120">
              <template #default="{ row }">{{ row.createdBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isVersionColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="versionQuery.page"
            v-model:page-size="versionQuery.pageSize"
            :total="versionTotal"
            @change="loadAppVersions"
          />
        </el-tab-pane>

        <el-tab-pane label="更新日志" name="changelog">
          <TableToolbar
            v-model:keyword="changelogQuery.keyword"
            v-model:status="changelogQuery.status"
            v-model:density="changelogDensity"
            v-model:visible-columns="changelogVisibleColumns"
            v-model:saved-view-id="changelogSavedViewId"
            :column-options="versionColumnOptions"
            :status-options="versionStatusOptions"
            :saved-views="changelogSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索版本、标题、更新内容"
            @search="handleChangelogSearch"
            @refresh="loadChangelogs"
            @clear-filters="clearChangelogFilters"
            @save-view="saveChangelogTableView"
            @apply-view="applyChangelogSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="changelogLoading"
            :data="changelogs"
            :size="changelogTableSize"
            row-key="id"
            empty-text="暂无更新日志"
            @sort-change="handleChangelogSortChange"
          >
            <el-table-column
              v-if="isChangelogColumnVisible('version')"
              label="版本"
              prop="version"
              width="120"
              sortable="custom"
            />
            <el-table-column
              v-if="isChangelogColumnVisible('title')"
              label="标题"
              prop="title"
              min-width="180"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isChangelogColumnVisible('status')"
              label="状态"
              prop="status"
              width="100"
              sortable="custom"
            >
              <template #default="{ row }"><VersionStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column
              v-if="isChangelogColumnVisible('impactModules')"
              label="影响模块"
              min-width="180"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ row.impactModules.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isChangelogColumnVisible('releaseNotes')"
              label="更新内容"
              min-width="280"
              prop="releaseNotes"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="isChangelogColumnVisible('releasedAt')"
              label="发布时间"
              prop="releasedAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.releasedAt) }}</template>
            </el-table-column>
            <el-table-column
              v-if="isChangelogColumnVisible('createdBy')"
              label="创建人"
              width="120"
            >
              <template #default="{ row }">{{ row.createdBy?.displayName ?? '-' }}</template>
            </el-table-column>
            <el-table-column
              v-if="isChangelogColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="changelogQuery.page"
            v-model:page-size="changelogQuery.pageSize"
            :total="changelogTotal"
            @change="loadChangelogs"
          />
        </el-tab-pane>

        <el-tab-pane label="菜单配置" name="menu">
          <ConfigEditor
            title="菜单配置"
            description="控制菜单折叠、隐藏模块、固定模块等后台菜单体验参数。"
            :model-value="menuConfigText"
            :loading="menuConfigLoading"
            @update:model-value="menuConfigText = $event"
            @save="saveMenuConfig"
          />
        </el-tab-pane>

        <el-tab-pane label="主题配置" name="theme">
          <ConfigEditor
            title="主题配置"
            description="控制后台主色、密度、侧边栏样式、表格样式等体验参数。"
            :model-value="themeConfigText"
            :loading="themeConfigLoading"
            @update:model-value="themeConfigText = $event"
            @save="saveThemeConfig"
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
            :show-status="false"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索参数 key 或备注"
            @search="handleParameterSearch"
            @refresh="loadSystemParameters"
            @clear-filters="clearParameterFilters"
            @save-view="saveParameterTableView"
            @apply-view="applyParameterSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="parametersLoading"
            :data="systemParameters"
            :size="parameterTableSize"
            row-key="key"
            empty-text="暂无系统参数"
            @sort-change="handleParameterSortChange"
          >
            <el-table-column
              v-if="isParameterColumnVisible('key')"
              label="参数"
              min-width="200"
              prop="key"
              sortable="custom"
              show-overflow-tooltip
            />
            <el-table-column v-if="isParameterColumnVisible('value')" label="值" min-width="300">
              <template #default="{ row }">
                <code class="json-cell">{{ JSON.stringify(row.value ?? {}) }}</code>
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
              width="120"
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
            <el-table-column
              v-if="isParameterColumnVisible('createdAt')"
              label="创建时间"
              prop="createdAt"
              width="170"
              sortable="custom"
            >
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="editSystemParameter(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="parameterQuery.page"
            v-model:page-size="parameterQuery.pageSize"
            :total="parameterTotal"
            @change="loadSystemParameters"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="announcementDialogVisible"
      :title="announcementForm.id ? '编辑公告' : '发布公告'"
      width="560px"
    >
      <el-form label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="announcementForm.title" placeholder="公告标题" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="announcementForm.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="级别">
          <el-select v-model="announcementForm.level">
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warning" />
            <el-option label="错误" value="error" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="announcementForm.enabled" />
        </el-form-item>
        <el-form-item label="开始">
          <el-date-picker
            v-model="announcementForm.startAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item label="结束">
          <el-date-picker
            v-model="announcementForm.endAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="可选"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announcementDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="announcementSaving" @click="saveAnnouncement">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="flagDialogVisible"
      :title="flagForm.id ? '编辑功能开关' : '新增功能开关'"
      width="560px"
    >
      <el-form label-width="90px">
        <el-form-item label="编码" required>
          <el-input v-model="flagForm.key" :disabled="Boolean(flagForm.id)" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="flagForm.name" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="flagForm.enabled" />
        </el-form-item>
        <el-form-item label="配置 JSON">
          <el-input v-model="flagForm.configText" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="flagForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="flagDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="flagSaving" @click="saveFeatureFlag">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="versionDialogVisible" title="登记版本" width="620px">
      <el-form label-width="100px">
        <el-form-item label="版本号" required>
          <el-input v-model="versionForm.version" placeholder="例如 0.1.1" />
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="versionForm.title" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="versionForm.status">
            <el-option label="草稿" value="draft" />
            <el-option label="已发布" value="released" />
            <el-option label="已废弃" value="deprecated" />
          </el-select>
        </el-form-item>
        <el-form-item label="影响模块">
          <el-input v-model="versionForm.impactModulesText" placeholder="多个模块用逗号分隔" />
        </el-form-item>
        <el-form-item label="发布时间">
          <el-date-picker
            v-model="versionForm.releasedAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item label="更新内容" required>
          <el-input v-model="versionForm.releaseNotes" type="textarea" :rows="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="versionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="versionSaving" @click="saveAppVersion">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="parameterDialogVisible"
      :title="parameterForm.id ? '编辑系统参数' : '新增系统参数'"
      width="620px"
    >
      <el-form label-width="90px">
        <el-form-item label="参数 key" required>
          <el-input v-model="parameterForm.key" :disabled="Boolean(parameterForm.id)" />
        </el-form-item>
        <el-form-item label="值 JSON">
          <el-input v-model="parameterForm.valueText" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="parameterForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="parameterDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="parameterSaving" @click="saveSystemParameter">
          保存
        </el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, reactive, ref, resolveComponent, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { maintenanceApi, userTableViewsApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  AppAnnouncement,
  AppAnnouncementLevel,
  AppVersion,
  AppVersionStatus,
  FeatureFlag,
  MaintenanceOverview,
  MaintenanceWindow,
  PageResult,
  SystemParameter,
  TableDensity,
  UserTableView
} from '@/types/system';

const route = useRoute();
const activeTab = ref('overview');
const overview = ref<MaintenanceOverview | null>(null);
const overviewLoading = ref(false);
const announcementTableKey = 'maintenance_announcements';
const flagTableKey = 'maintenance_feature_flags';
const versionTableKey = 'maintenance_app_versions';
const changelogTableKey = 'maintenance_changelogs';
const parameterTableKey = 'maintenance_system_parameters';
const enabledStatusOptions = [
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' }
];
const versionStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'released' },
  { label: '已废弃', value: 'deprecated' }
];
const announcementColumnOptions = [
  { label: '公告', value: 'announcement', required: true },
  { label: '级别', value: 'level' },
  { label: '状态', value: 'enabled' },
  { label: '展示时间', value: 'displayTime' },
  { label: '更新人', value: 'updatedBy' },
  { label: '更新时间', value: 'updatedAt' }
];
const flagColumnOptions = [
  { label: '开关', value: 'flag', required: true },
  { label: '状态', value: 'enabled' },
  { label: '配置', value: 'config' },
  { label: '备注', value: 'remark' },
  { label: '更新人', value: 'updatedBy' },
  { label: '更新时间', value: 'updatedAt' }
];
const versionColumnOptions = [
  { label: '版本', value: 'version', required: true },
  { label: '标题', value: 'title' },
  { label: '状态', value: 'status' },
  { label: '影响模块', value: 'impactModules' },
  { label: '更新内容', value: 'releaseNotes' },
  { label: '发布时间', value: 'releasedAt' },
  { label: '创建人', value: 'createdBy' },
  { label: '创建时间', value: 'createdAt' }
];
const parameterColumnOptions = [
  { label: '参数', value: 'key', required: true },
  { label: '值', value: 'value' },
  { label: '备注', value: 'remark' },
  { label: '更新人', value: 'updatedBy' },
  { label: '更新时间', value: 'updatedAt' },
  { label: '创建时间', value: 'createdAt' }
];

const announcementQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  level: '' as AppAnnouncementLevel | '',
  enabled: ''
});
const announcements = ref<AppAnnouncement[]>([]);
const announcementTotal = ref(0);
const announcementsLoading = ref(false);
const announcementDensity = ref<TableDensity>('default');
const announcementVisibleColumns = ref<string[]>([]);
const announcementSavedViews = ref<UserTableView[]>([]);
const announcementSavedViewId = ref('');
const announcementSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>(
  {}
);
const announcementViewsLoaded = ref(false);
const announcementDialogVisible = ref(false);
const announcementSaving = ref(false);
const announcementForm = reactive({
  id: '',
  title: '',
  content: '',
  level: 'info' as AppAnnouncementLevel,
  enabled: true,
  startAt: '',
  endAt: ''
});

const modeForm = reactive({
  enabled: false,
  reason: '系统正常运行',
  allowedRolesText: 'admin',
  allowedIpsText: '',
  startAt: '',
  endAt: ''
});
const modeSaving = ref(false);

const flagQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  enabled: ''
});
const featureFlags = ref<FeatureFlag[]>([]);
const flagTotal = ref(0);
const flagsLoading = ref(false);
const flagDensity = ref<TableDensity>('default');
const flagVisibleColumns = ref<string[]>([]);
const flagSavedViews = ref<UserTableView[]>([]);
const flagSavedViewId = ref('');
const flagSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const flagViewsLoaded = ref(false);
const flagDialogVisible = ref(false);
const flagSaving = ref(false);
const flagForm = reactive({
  id: '',
  key: '',
  name: '',
  enabled: false,
  configText: '{}',
  remark: ''
});

const versionQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as AppVersionStatus | ''
});
const appVersions = ref<AppVersion[]>([]);
const versionTotal = ref(0);
const versionsLoading = ref(false);
const versionDensity = ref<TableDensity>('default');
const versionVisibleColumns = ref<string[]>([]);
const versionSavedViews = ref<UserTableView[]>([]);
const versionSavedViewId = ref('');
const versionSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const versionViewsLoaded = ref(false);
const versionDialogVisible = ref(false);
const versionSaving = ref(false);
const versionForm = reactive({
  version: '',
  title: '',
  status: 'draft' as AppVersionStatus,
  releaseNotes: '',
  impactModulesText: '',
  releasedAt: ''
});

const changelogQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as AppVersionStatus | ''
});
const changelogs = ref<AppVersion[]>([]);
const changelogTotal = ref(0);
const changelogLoading = ref(false);
const changelogDensity = ref<TableDensity>('default');
const changelogVisibleColumns = ref<string[]>([]);
const changelogSavedViews = ref<UserTableView[]>([]);
const changelogSavedViewId = ref('');
const changelogSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const changelogViewsLoaded = ref(false);

const menuConfigText = ref('{}');
const themeConfigText = ref('{}');
const menuConfigLoading = ref(false);
const themeConfigLoading = ref(false);

const parameterQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: ''
});
const systemParameters = ref<SystemParameter[]>([]);
const parameterTotal = ref(0);
const parametersLoading = ref(false);
const parameterDensity = ref<TableDensity>('default');
const parameterVisibleColumns = ref<string[]>([]);
const parameterSavedViews = ref<UserTableView[]>([]);
const parameterSavedViewId = ref('');
const parameterSortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const parameterViewsLoaded = ref(false);
const parameterDialogVisible = ref(false);
const parameterSaving = ref(false);
const parameterForm = reactive({
  id: '',
  key: '',
  valueText: '{}',
  remark: ''
});

const primaryActionText = computed(() => {
  if (activeTab.value === 'announcements' || activeTab.value === 'overview') return '发布公告';
  if (activeTab.value === 'flags') return '新增功能开关';
  if (activeTab.value === 'versions' || activeTab.value === 'changelog') return '登记版本';
  if (activeTab.value === 'parameters') return '新增参数';
  return '保存配置';
});
const announcementTableSize = computed(() => getTableSize(announcementDensity.value));
const flagTableSize = computed(() => getTableSize(flagDensity.value));
const versionTableSize = computed(() => getTableSize(versionDensity.value));
const changelogTableSize = computed(() => getTableSize(changelogDensity.value));
const parameterTableSize = computed(() => getTableSize(parameterDensity.value));
const announcementFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  if (isAnnouncementLevel(announcementQuery.level)) {
    chips.push({ key: 'level', label: '级别', value: getLevelLabel(announcementQuery.level) });
  }
  return chips;
});

const LevelTag = defineComponent({
  props: {
    level: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const ElTag = resolveComponent('ElTag');
    return () =>
      h(
        'span',
        {},
        h(
          ElTag,
          {
            type: getLevelType(props.level as AppAnnouncementLevel),
            size: 'small',
            effect: 'light'
          },
          () => getLevelLabel(props.level as AppAnnouncementLevel)
        )
      );
  }
});

const VersionStatusTag = defineComponent({
  props: {
    status: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const ElTag = resolveComponent('ElTag');
    return () =>
      h(
        'span',
        {},
        h(
          ElTag,
          {
            type: getVersionStatusType(props.status as AppVersionStatus),
            size: 'small',
            effect: 'light'
          },
          () => getVersionStatusLabel(props.status as AppVersionStatus)
        )
      );
  }
});

const PaginationBar = defineComponent({
  props: {
    page: {
      type: Number,
      required: true
    },
    pageSize: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
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

const ConfigEditor = defineComponent({
  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    modelValue: {
      type: String,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    const ElInput = resolveComponent('ElInput');
    const ElButton = resolveComponent('ElButton');
    return () =>
      h('div', { class: 'config-editor' }, [
        h('div', { class: 'settings-note' }, [
          h('h3', {}, props.title),
          h('p', {}, props.description),
          h('p', {}, '请使用合法 JSON，对配置的修改会写入审计日志。')
        ]),
        h(ElInput, {
          modelValue: props.modelValue,
          'onUpdate:modelValue': (value: string) => emit('update:modelValue', value),
          type: 'textarea',
          rows: 12,
          spellcheck: false
        }),
        h(
          'div',
          { class: 'config-editor__footer' },
          h(
            ElButton,
            {
              type: 'primary',
              loading: props.loading,
              onClick: () => emit('save')
            },
            () => '保存配置'
          )
        )
      ]);
  }
});

watch(
  () => route.meta.moduleKey,
  (moduleKey) => {
    activeTab.value = getRouteTab(String(moduleKey ?? 'maintenance'));
    void refreshCurrentTab();
  },
  { immediate: true }
);

async function refreshCurrentTab() {
  await loadOverview();
  if (activeTab.value === 'overview') return;
  if (activeTab.value === 'announcements') await loadAnnouncementsWithViews();
  if (activeTab.value === 'mode') await loadMode();
  if (activeTab.value === 'flags') await loadFeatureFlagsWithViews();
  if (activeTab.value === 'versions') await loadAppVersionsWithViews();
  if (activeTab.value === 'changelog') await loadChangelogsWithViews();
  if (activeTab.value === 'menu') await loadMenuConfig();
  if (activeTab.value === 'theme') await loadThemeConfig();
  if (activeTab.value === 'parameters') await loadSystemParametersWithViews();
}

async function loadOverview() {
  overviewLoading.value = true;
  try {
    overview.value = await maintenanceApi.overview();
  } finally {
    overviewLoading.value = false;
  }
}

async function loadAnnouncements() {
  announcementsLoading.value = true;
  try {
    const result = await maintenanceApi.listAnnouncements({
      ...announcementQuery,
      sortBy: mapSortField(announcementSortConfig.value.prop, {
        announcement: 'title',
        displayTime: 'startAt'
      }),
      sortOrder: mapSortOrder(announcementSortConfig.value.order)
    });
    applyPage(result, announcements, (total) => {
      announcementTotal.value = total;
    });
  } finally {
    announcementsLoading.value = false;
  }
}

async function loadAnnouncementsWithViews() {
  await ensureAnnouncementTableViews();
  await loadAnnouncements();
}

async function loadMode() {
  const mode = await maintenanceApi.getMode();
  applyMode(mode);
}

async function loadFeatureFlags() {
  flagsLoading.value = true;
  try {
    const result = await maintenanceApi.listFeatureFlags({
      ...flagQuery,
      sortBy: mapSortField(flagSortConfig.value.prop, {
        flag: 'name'
      }),
      sortOrder: mapSortOrder(flagSortConfig.value.order)
    });
    applyPage(result, featureFlags, (total) => {
      flagTotal.value = total;
    });
  } finally {
    flagsLoading.value = false;
  }
}

async function loadFeatureFlagsWithViews() {
  await ensureFlagTableViews();
  await loadFeatureFlags();
}

async function loadAppVersions() {
  versionsLoading.value = true;
  try {
    const result = await maintenanceApi.listAppVersions({
      ...versionQuery,
      sortBy: mapSortField(versionSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(versionSortConfig.value.order)
    });
    applyPage(result, appVersions, (total) => {
      versionTotal.value = total;
    });
  } finally {
    versionsLoading.value = false;
  }
}

async function loadAppVersionsWithViews() {
  await ensureVersionTableViews();
  await loadAppVersions();
}

async function loadChangelogs() {
  changelogLoading.value = true;
  try {
    const result = await maintenanceApi.listChangelogs({
      ...changelogQuery,
      sortBy: mapSortField(changelogSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(changelogSortConfig.value.order)
    });
    applyPage(result, changelogs, (total) => {
      changelogTotal.value = total;
    });
  } finally {
    changelogLoading.value = false;
  }
}

async function loadChangelogsWithViews() {
  await ensureChangelogTableViews();
  await loadChangelogs();
}

async function loadMenuConfig() {
  menuConfigLoading.value = true;
  try {
    const parameter = await maintenanceApi.getMenuConfig();
    menuConfigText.value = formatJson(parameter.value);
  } finally {
    menuConfigLoading.value = false;
  }
}

async function loadThemeConfig() {
  themeConfigLoading.value = true;
  try {
    const parameter = await maintenanceApi.getThemeConfig();
    themeConfigText.value = formatJson(parameter.value);
  } finally {
    themeConfigLoading.value = false;
  }
}

async function loadSystemParameters() {
  parametersLoading.value = true;
  try {
    const result = await maintenanceApi.listSystemParameters({
      ...parameterQuery,
      sortBy: mapSortField(parameterSortConfig.value.prop, {}),
      sortOrder: mapSortOrder(parameterSortConfig.value.order)
    });
    applyPage(result, systemParameters, (total) => {
      parameterTotal.value = total;
    });
  } finally {
    parametersLoading.value = false;
  }
}

async function loadSystemParametersWithViews() {
  await ensureParameterTableViews();
  await loadSystemParameters();
}

async function handleAnnouncementSearch() {
  announcementQuery.page = 1;
  await loadAnnouncements();
}

async function handleFlagSearch() {
  flagQuery.page = 1;
  await loadFeatureFlags();
}

async function handleVersionSearch() {
  versionQuery.page = 1;
  await loadAppVersions();
}

async function handleChangelogSearch() {
  changelogQuery.page = 1;
  await loadChangelogs();
}

async function handleParameterSearch() {
  parameterQuery.page = 1;
  await loadSystemParameters();
}

async function handleAnnouncementSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  announcementSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  announcementQuery.page = 1;
  await loadAnnouncements();
}

async function handleFlagSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  flagSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  flagQuery.page = 1;
  await loadFeatureFlags();
}

async function handleVersionSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  versionSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  versionQuery.page = 1;
  await loadAppVersions();
}

async function handleChangelogSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  changelogSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  changelogQuery.page = 1;
  await loadChangelogs();
}

async function handleParameterSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  parameterSortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  parameterQuery.page = 1;
  await loadSystemParameters();
}

function clearAnnouncementFilters() {
  announcementQuery.page = 1;
  announcementQuery.keyword = '';
  announcementQuery.level = '';
  announcementQuery.enabled = '';
  announcementSavedViewId.value = '';
  announcementDensity.value = 'default';
  announcementSortConfig.value = {};
}

function clearFlagFilters() {
  flagQuery.page = 1;
  flagQuery.keyword = '';
  flagQuery.enabled = '';
  flagSavedViewId.value = '';
  flagDensity.value = 'default';
  flagSortConfig.value = {};
}

function clearVersionFilters() {
  versionQuery.page = 1;
  versionQuery.keyword = '';
  versionQuery.status = '';
  versionSavedViewId.value = '';
  versionDensity.value = 'default';
  versionSortConfig.value = {};
}

function clearChangelogFilters() {
  changelogQuery.page = 1;
  changelogQuery.keyword = '';
  changelogQuery.status = '';
  changelogSavedViewId.value = '';
  changelogDensity.value = 'default';
  changelogSortConfig.value = {};
}

function clearParameterFilters() {
  parameterQuery.page = 1;
  parameterQuery.keyword = '';
  parameterSavedViewId.value = '';
  parameterDensity.value = 'default';
  parameterSortConfig.value = {};
}

function removeAnnouncementFilter(key: string) {
  if (key === 'level') announcementQuery.level = '';
}

async function ensureAnnouncementTableViews() {
  if (announcementViewsLoaded.value) return;
  await loadAnnouncementTableViews(true);
  announcementViewsLoaded.value = true;
}

async function ensureFlagTableViews() {
  if (flagViewsLoaded.value) return;
  await loadFlagTableViews(true);
  flagViewsLoaded.value = true;
}

async function ensureVersionTableViews() {
  if (versionViewsLoaded.value) return;
  await loadVersionTableViews(true);
  versionViewsLoaded.value = true;
}

async function ensureChangelogTableViews() {
  if (changelogViewsLoaded.value) return;
  await loadChangelogTableViews(true);
  changelogViewsLoaded.value = true;
}

async function ensureParameterTableViews() {
  if (parameterViewsLoaded.value) return;
  await loadParameterTableViews(true);
  parameterViewsLoaded.value = true;
}

async function loadAnnouncementTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: announcementTableKey
    });
    announcementSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyAnnouncementView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadFlagTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey: flagTableKey });
    flagSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyFlagView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadVersionTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: versionTableKey
    });
    versionSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyVersionView(defaultView);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function loadChangelogTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey: changelogTableKey
    });
    changelogSavedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyChangelogView(defaultView);
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

async function saveAnnouncementTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存系统公告视图', {
      inputValue: '系统公告常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: announcementTableKey,
      viewName: value.trim(),
      filters: {
        keyword: announcementQuery.keyword,
        level: announcementQuery.level,
        enabled: announcementQuery.enabled
      },
      sortConfig: announcementSortConfig.value,
      columns: announcementVisibleColumns.value.length
        ? announcementVisibleColumns.value
        : announcementColumnOptions.map((column) => column.value),
      density: announcementDensity.value,
      pageSize: announcementQuery.pageSize,
      isDefault: announcementSavedViews.value.length === 0
    });
    await loadAnnouncementTableViews();
    announcementSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveFlagTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存功能开关视图', {
      inputValue: '功能开关常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: flagTableKey,
      viewName: value.trim(),
      filters: {
        keyword: flagQuery.keyword,
        enabled: flagQuery.enabled
      },
      sortConfig: flagSortConfig.value,
      columns: flagVisibleColumns.value.length
        ? flagVisibleColumns.value
        : flagColumnOptions.map((column) => column.value),
      density: flagDensity.value,
      pageSize: flagQuery.pageSize,
      isDefault: flagSavedViews.value.length === 0
    });
    await loadFlagTableViews();
    flagSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveVersionTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存版本信息视图', {
      inputValue: '版本信息常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: versionTableKey,
      viewName: value.trim(),
      filters: {
        keyword: versionQuery.keyword,
        status: versionQuery.status
      },
      sortConfig: versionSortConfig.value,
      columns: versionVisibleColumns.value.length
        ? versionVisibleColumns.value
        : versionColumnOptions.map((column) => column.value),
      density: versionDensity.value,
      pageSize: versionQuery.pageSize,
      isDefault: versionSavedViews.value.length === 0
    });
    await loadVersionTableViews();
    versionSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveChangelogTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存更新日志视图', {
      inputValue: '更新日志常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: changelogTableKey,
      viewName: value.trim(),
      filters: {
        keyword: changelogQuery.keyword,
        status: changelogQuery.status
      },
      sortConfig: changelogSortConfig.value,
      columns: changelogVisibleColumns.value.length
        ? changelogVisibleColumns.value
        : versionColumnOptions.map((column) => column.value),
      density: changelogDensity.value,
      pageSize: changelogQuery.pageSize,
      isDefault: changelogSavedViews.value.length === 0
    });
    await loadChangelogTableViews();
    changelogSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function saveParameterTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存系统参数视图', {
      inputValue: '系统参数常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey: parameterTableKey,
      viewName: value.trim(),
      filters: {
        keyword: parameterQuery.keyword
      },
      sortConfig: parameterSortConfig.value,
      columns: parameterVisibleColumns.value.length
        ? parameterVisibleColumns.value
        : parameterColumnOptions.map((column) => column.value),
      density: parameterDensity.value,
      pageSize: parameterQuery.pageSize,
      isDefault: parameterSavedViews.value.length === 0
    });
    await loadParameterTableViews();
    parameterSavedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applyAnnouncementSavedView(id: string) {
  const view = announcementSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyAnnouncementView(view);
  ElMessage.success('已应用保存视图');
  await loadAnnouncements();
}

async function applyFlagSavedView(id: string) {
  const view = flagSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyFlagView(view);
  ElMessage.success('已应用保存视图');
  await loadFeatureFlags();
}

async function applyVersionSavedView(id: string) {
  const view = versionSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyVersionView(view);
  ElMessage.success('已应用保存视图');
  await loadAppVersions();
}

async function applyChangelogSavedView(id: string) {
  const view = changelogSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyChangelogView(view);
  ElMessage.success('已应用保存视图');
  await loadChangelogs();
}

async function applyParameterSavedView(id: string) {
  const view = parameterSavedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyParameterView(view);
  ElMessage.success('已应用保存视图');
  await loadSystemParameters();
}

function applyAnnouncementView(view: UserTableView) {
  const filters = view.filters;
  announcementQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  announcementQuery.level = isAnnouncementLevel(filters.level) ? filters.level : '';
  announcementQuery.enabled = typeof filters.enabled === 'string' ? filters.enabled : '';
  announcementQuery.pageSize = view.pageSize;
  announcementDensity.value = view.density;
  announcementVisibleColumns.value = normalizeColumns(view.columns, announcementColumnOptions);
  announcementSortConfig.value = parseSortConfig(view.sortConfig);
  announcementSavedViewId.value = view.id;
}

function applyFlagView(view: UserTableView) {
  const filters = view.filters;
  flagQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  flagQuery.enabled = typeof filters.enabled === 'string' ? filters.enabled : '';
  flagQuery.pageSize = view.pageSize;
  flagDensity.value = view.density;
  flagVisibleColumns.value = normalizeColumns(view.columns, flagColumnOptions);
  flagSortConfig.value = parseSortConfig(view.sortConfig);
  flagSavedViewId.value = view.id;
}

function applyVersionView(view: UserTableView) {
  const filters = view.filters;
  versionQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  versionQuery.status = isAppVersionStatus(filters.status) ? filters.status : '';
  versionQuery.pageSize = view.pageSize;
  versionDensity.value = view.density;
  versionVisibleColumns.value = normalizeColumns(view.columns, versionColumnOptions);
  versionSortConfig.value = parseSortConfig(view.sortConfig);
  versionSavedViewId.value = view.id;
}

function applyChangelogView(view: UserTableView) {
  const filters = view.filters;
  changelogQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  changelogQuery.status = isAppVersionStatus(filters.status) ? filters.status : '';
  changelogQuery.pageSize = view.pageSize;
  changelogDensity.value = view.density;
  changelogVisibleColumns.value = normalizeColumns(view.columns, versionColumnOptions);
  changelogSortConfig.value = parseSortConfig(view.sortConfig);
  changelogSavedViewId.value = view.id;
}

function applyParameterView(view: UserTableView) {
  const filters = view.filters;
  parameterQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  parameterQuery.pageSize = view.pageSize;
  parameterDensity.value = view.density;
  parameterVisibleColumns.value = normalizeColumns(view.columns, parameterColumnOptions);
  parameterSortConfig.value = parseSortConfig(view.sortConfig);
  parameterSavedViewId.value = view.id;
}

function isAnnouncementColumnVisible(column: string) {
  return announcementVisibleColumns.value.length
    ? announcementVisibleColumns.value.includes(column)
    : true;
}

function isFlagColumnVisible(column: string) {
  return flagVisibleColumns.value.length ? flagVisibleColumns.value.includes(column) : true;
}

function isVersionColumnVisible(column: string) {
  return versionVisibleColumns.value.length ? versionVisibleColumns.value.includes(column) : true;
}

function isChangelogColumnVisible(column: string) {
  return changelogVisibleColumns.value.length
    ? changelogVisibleColumns.value.includes(column)
    : true;
}

function isParameterColumnVisible(column: string) {
  return parameterVisibleColumns.value.length
    ? parameterVisibleColumns.value.includes(column)
    : true;
}

function openPrimaryDialog() {
  if (activeTab.value === 'announcements' || activeTab.value === 'overview') {
    openAnnouncementDialog();
    return;
  }
  if (activeTab.value === 'flags') {
    openFeatureFlagDialog();
    return;
  }
  if (activeTab.value === 'versions' || activeTab.value === 'changelog') {
    openVersionDialog();
    return;
  }
  if (activeTab.value === 'parameters') {
    openParameterDialog();
    return;
  }
  void refreshCurrentTab();
}

function openAnnouncementDialog() {
  Object.assign(announcementForm, {
    id: '',
    title: '',
    content: '',
    level: 'info',
    enabled: true,
    startAt: '',
    endAt: ''
  });
  announcementDialogVisible.value = true;
}

function editAnnouncement(row: AppAnnouncement) {
  Object.assign(announcementForm, {
    id: row.id,
    title: row.title,
    content: row.content,
    level: row.level,
    enabled: row.enabled,
    startAt: row.startAt ?? '',
    endAt: row.endAt ?? ''
  });
  announcementDialogVisible.value = true;
}

async function saveAnnouncement() {
  announcementSaving.value = true;
  try {
    const payload = {
      title: announcementForm.title,
      content: announcementForm.content,
      level: announcementForm.level,
      enabled: announcementForm.enabled,
      startAt: announcementForm.startAt || null,
      endAt: announcementForm.endAt || null
    };
    if (announcementForm.id) {
      await maintenanceApi.updateAnnouncement(announcementForm.id, payload);
    } else {
      await maintenanceApi.createAnnouncement(payload);
    }
    ElMessage.success('公告已保存');
    announcementDialogVisible.value = false;
    await loadAnnouncements();
    await loadOverview();
  } finally {
    announcementSaving.value = false;
  }
}

async function removeAnnouncement(row: AppAnnouncement) {
  await ElMessageBox.confirm(`确认删除公告“${row.title}”？`, '删除公告', { type: 'warning' });
  await maintenanceApi.removeAnnouncement(row.id);
  ElMessage.success('公告已删除');
  await loadAnnouncements();
  await loadOverview();
}

async function saveMode() {
  modeSaving.value = true;
  try {
    const mode = await maintenanceApi.saveMode({
      enabled: modeForm.enabled,
      reason: modeForm.reason,
      allowedRoles: splitList(modeForm.allowedRolesText),
      allowedIps: splitList(modeForm.allowedIpsText),
      startAt: modeForm.startAt || null,
      endAt: modeForm.endAt || null
    });
    applyMode(mode);
    ElMessage.success('维护模式已保存');
    await loadOverview();
  } finally {
    modeSaving.value = false;
  }
}

function openFeatureFlagDialog() {
  Object.assign(flagForm, {
    id: '',
    key: '',
    name: '',
    enabled: false,
    configText: '{}',
    remark: ''
  });
  flagDialogVisible.value = true;
}

function editFeatureFlag(row: FeatureFlag) {
  Object.assign(flagForm, {
    id: row.id,
    key: row.key,
    name: row.name,
    enabled: row.enabled,
    configText: formatJson(row.config ?? {}),
    remark: row.remark ?? ''
  });
  flagDialogVisible.value = true;
}

async function saveFeatureFlag() {
  const config = parseJsonObject(flagForm.configText, '配置 JSON');
  if (!config) return;

  flagSaving.value = true;
  try {
    const payload = {
      key: flagForm.key,
      name: flagForm.name,
      enabled: flagForm.enabled,
      config,
      remark: flagForm.remark || null
    };
    if (flagForm.id) {
      await maintenanceApi.updateFeatureFlag(flagForm.id, payload);
    } else {
      await maintenanceApi.createFeatureFlag(payload);
    }
    ElMessage.success('功能开关已保存');
    flagDialogVisible.value = false;
    await loadFeatureFlags();
    await loadOverview();
  } finally {
    flagSaving.value = false;
  }
}

async function toggleFeatureFlag(row: FeatureFlag) {
  const updated = await maintenanceApi.updateFeatureFlag(row.id, {
    enabled: !row.enabled,
    name: row.name,
    remark: row.remark,
    config: row.config ?? {}
  });
  Object.assign(row, updated);
  ElMessage.success(updated.enabled ? '功能开关已启用' : '功能开关已停用');
  await loadOverview();
}

function openVersionDialog() {
  Object.assign(versionForm, {
    version: '',
    title: '',
    status: 'draft',
    releaseNotes: '',
    impactModulesText: '',
    releasedAt: ''
  });
  versionDialogVisible.value = true;
}

async function saveAppVersion() {
  versionSaving.value = true;
  try {
    await maintenanceApi.createAppVersion({
      version: versionForm.version,
      title: versionForm.title,
      status: versionForm.status,
      releaseNotes: versionForm.releaseNotes,
      impactModules: splitList(versionForm.impactModulesText),
      releasedAt: versionForm.releasedAt || null
    });
    ElMessage.success('版本已登记');
    versionDialogVisible.value = false;
    await Promise.all([loadAppVersions(), loadChangelogs(), loadOverview()]);
  } finally {
    versionSaving.value = false;
  }
}

async function saveMenuConfig() {
  const value = parseJsonObject(menuConfigText.value, '菜单配置');
  if (!value) return;
  menuConfigLoading.value = true;
  try {
    await maintenanceApi.saveMenuConfig({
      value,
      remark: '网站维护菜单配置'
    });
    ElMessage.success('菜单配置已保存');
  } finally {
    menuConfigLoading.value = false;
  }
}

async function saveThemeConfig() {
  const value = parseJsonObject(themeConfigText.value, '主题配置');
  if (!value) return;
  themeConfigLoading.value = true;
  try {
    await maintenanceApi.saveThemeConfig({
      value,
      remark: '网站维护主题配置'
    });
    ElMessage.success('主题配置已保存');
  } finally {
    themeConfigLoading.value = false;
  }
}

function openParameterDialog() {
  Object.assign(parameterForm, {
    id: '',
    key: '',
    valueText: '{}',
    remark: ''
  });
  parameterDialogVisible.value = true;
}

function editSystemParameter(row: SystemParameter) {
  Object.assign(parameterForm, {
    id: row.id ?? '',
    key: row.key,
    valueText: formatJson(row.value ?? {}),
    remark: row.remark ?? ''
  });
  parameterDialogVisible.value = true;
}

async function saveSystemParameter() {
  const value = parseJsonObject(parameterForm.valueText, '参数值');
  if (!value) return;

  parameterSaving.value = true;
  try {
    if (parameterForm.id) {
      await maintenanceApi.updateSystemParameter(parameterForm.id, {
        value,
        remark: parameterForm.remark || null
      });
    } else {
      await maintenanceApi.createSystemParameter({
        key: parameterForm.key,
        value,
        group: 'maintenance',
        remark: parameterForm.remark || null
      });
    }
    ElMessage.success('系统参数已保存');
    parameterDialogVisible.value = false;
    await loadSystemParameters();
  } finally {
    parameterSaving.value = false;
  }
}

function applyMode(mode: MaintenanceWindow) {
  modeForm.enabled = mode.enabled;
  modeForm.reason = mode.reason;
  modeForm.allowedRolesText = mode.allowedRoles.join(',');
  modeForm.allowedIpsText = mode.allowedIps.join(',');
  modeForm.startAt = mode.startAt ?? '';
  modeForm.endAt = mode.endAt ?? '';
}

function applyPage<T>(
  result: PageResult<T>,
  target: { value: T[] },
  setTotal: (total: number) => void
) {
  target.value = result.items;
  setTotal(result.total);
}

function getRouteTab(moduleKey: string) {
  if (moduleKey === 'feature-flags') return 'flags';
  if (moduleKey === 'versions') return 'versions';
  if (moduleKey === 'changelog') return 'changelog';
  if (moduleKey === 'system-parameters') return 'parameters';
  return 'overview';
}

function splitList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(text: string, field: string) {
  try {
    const parsed = JSON.parse(text || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${field} 必须是 JSON 对象`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${field} 不是合法 JSON`);
    return null;
  }
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

function mapSortField(prop: string | undefined, aliases: Record<string, string>) {
  if (!prop) return undefined;
  return aliases[prop] ?? prop;
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isAnnouncementLevel(value: unknown): value is AppAnnouncementLevel {
  return value === 'info' || value === 'warning' || value === 'error';
}

function isAppVersionStatus(value: unknown): value is AppVersionStatus {
  return value === 'draft' || value === 'released' || value === 'deprecated';
}

function showExportMessage() {
  ElMessage.info('网站维护导出会走数据中心导出任务，后续统一接入');
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getLevelLabel(level: AppAnnouncementLevel) {
  const labels: Record<AppAnnouncementLevel, string> = {
    info: '信息',
    warning: '警告',
    error: '错误'
  };
  return labels[level] ?? level;
}

function getLevelType(level: AppAnnouncementLevel) {
  if (level === 'warning') return 'warning';
  if (level === 'error') return 'danger';
  return 'info';
}

function getVersionStatusLabel(status: AppVersionStatus) {
  const labels: Record<AppVersionStatus, string> = {
    draft: '草稿',
    released: '已发布',
    deprecated: '已废弃'
  };
  return labels[status] ?? status;
}

function getVersionStatusType(status: AppVersionStatus) {
  if (status === 'released') return 'success';
  if (status === 'deprecated') return 'info';
  return 'warning';
}
</script>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.overview-grid h3,
.settings-note h3 {
  margin: 0 0 12px;
  color: var(--text-primary);
  font-size: 16px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.toolbar-search {
  width: min(360px, 100%);
}

.toolbar-select {
  width: 150px;
}

.muted-block {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.json-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}

.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
}

.settings-form {
  max-width: 640px;
}

.settings-note {
  align-self: start;
  padding: 16px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--text-secondary);
  line-height: 1.7;
}

.settings-note p {
  margin: 0 0 10px;
}

.config-editor {
  display: grid;
  gap: 14px;
}

.config-editor__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .overview-grid,
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .toolbar-search,
  .toolbar-select {
    width: 100%;
  }
}
</style>
