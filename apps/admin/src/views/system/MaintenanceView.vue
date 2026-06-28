<template>
  <PageScaffold
    title="系统配置"
    group="系统配置"
    phase="Phase 13"
    description="集中管理系统公告、维护模式、版本信息、更新日志、功能开关、菜单配置、主题配置和系统参数。"
  >
    <template #actions>
      <AppButton @click="() => refreshCurrentTab({ force: true })">刷新</AppButton>
      <AppButton variant="primary" @click="openPrimaryDialog">{{ primaryActionText }}</AppButton>
    </template>

    <section class="content-panel system-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp :title="activeTabMeta.title" :help="activeTabMeta.description" />
        <div class="inline-actions">
          <StatusChip :tone="activeTabMeta.tone" dot>{{ activeTabMeta.badge }}</StatusChip>
          <StatusChip tone="blue">公告 {{ overview?.enabledAnnouncementCount ?? '-' }}</StatusChip>
          <StatusChip :tone="overview?.maintenanceModeEnabled ? 'red' : 'green'" dot>
            维护{{ overview?.maintenanceModeEnabled ? '开启' : '关闭' }}
          </StatusChip>
          <StatusChip tone="orange"
            >功能开关 {{ overview?.enabledFeatureFlagCount ?? '-' }}</StatusChip
          >
          <StatusChip tone="purple">版本 {{ overview?.latestVersion?.version ?? '-' }}</StatusChip>
        </div>
      </div>

      <el-tabs
        v-model="activeTab"
        class="system-tabs maintenance-tabs"
        @tab-change="() => refreshCurrentTab()"
      >
        <el-tab-pane label="维护总览" name="overview">
          <div class="overview-grid">
            <div>
              <h3>最近公告</h3>
              <el-table
                v-loading="overviewLoading"
                class="desktop-data-table"
                :data="overview?.recentAnnouncements ?? []"
              >
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
                    <StatusChip :tone="row.enabled ? 'green' : 'neutral'" dot>
                      {{ row.enabled ? '启用' : '停用' }}
                    </StatusChip>
                  </template>
                </el-table-column>
                <el-table-column label="时间" width="170">
                  <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
              <div
                v-if="overview?.recentAnnouncements.length"
                class="mobile-record-list"
                aria-label="最近公告移动列表"
              >
                <article
                  v-for="announcement in overview.recentAnnouncements"
                  :key="announcement.id"
                  class="mobile-record-card"
                >
                  <div class="mobile-record-card__head">
                    <div class="mobile-record-card__title">
                      <strong>{{ announcement.title }}</strong>
                      <span>{{ announcement.content }}</span>
                    </div>
                    <LevelTag :level="announcement.level" />
                  </div>
                  <div class="mobile-record-card__stats">
                    <div>
                      <span>状态</span>
                      <strong>{{ announcement.enabled ? '启用' : '停用' }}</strong>
                    </div>
                    <div>
                      <span>创建时间</span>
                      <strong>{{ formatDate(announcement.createdAt) }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <div v-else class="mobile-record-list">
                <div class="apple-core-empty-state">
                  <strong>暂无最近公告</strong>
                  <span>发布系统公告后会在这里显示。</span>
                </div>
              </div>
            </div>
            <div>
              <h3>最近版本</h3>
              <el-table
                v-loading="overviewLoading"
                class="desktop-data-table"
                :data="overview?.recentVersions ?? []"
              >
                <el-table-column label="版本" width="120" prop="version" />
                <el-table-column label="标题" min-width="180" prop="title" />
                <el-table-column label="状态" width="100">
                  <template #default="{ row }"><VersionStatusTag :status="row.status" /></template>
                </el-table-column>
                <el-table-column label="发布" width="170">
                  <template #default="{ row }">{{ formatDate(row.releasedAt) }}</template>
                </el-table-column>
              </el-table>
              <div
                v-if="overview?.recentVersions.length"
                class="mobile-record-list"
                aria-label="最近版本移动列表"
              >
                <article
                  v-for="version in overview.recentVersions"
                  :key="version.id"
                  class="mobile-record-card"
                >
                  <div class="mobile-record-card__head">
                    <div class="mobile-record-card__title">
                      <strong>{{ version.version }}</strong>
                      <span>{{ version.title }}</span>
                    </div>
                    <VersionStatusTag :status="version.status" />
                  </div>
                  <div class="mobile-record-card__stats">
                    <div>
                      <span>发布时间</span>
                      <strong>{{ formatDate(version.releasedAt) }}</strong>
                    </div>
                    <div>
                      <span>影响模块</span>
                      <strong>{{ version.impactModules.join(', ') || '-' }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <div v-else class="mobile-record-list">
                <div class="apple-core-empty-state">
                  <strong>暂无版本记录</strong>
                  <span>登记版本后会展示最新发布信息。</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="系统公告" name="announcements">
          <TableToolbar
            v-model:keyword="announcementQuery.keyword"
            v-model:status="announcementQuery.enabled"
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
            @refresh="() => loadAnnouncements()"
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
                <el-option
                  v-for="option in announcementLevelOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </template>
          </TableToolbar>
          <el-table
            v-loading="announcementsLoading"
            class="desktop-data-table"
            :data="announcements"
            :size="announcementTableSize"
            row-key="id"
            @sort-change="handleAnnouncementSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无系统公告</strong>
                <span>可以新增公告，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearAnnouncementFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
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
                <StatusChip :tone="row.enabled ? 'green' : 'neutral'" dot>
                  {{ row.enabled ? '启用' : '停用' }}
                </StatusChip>
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
                <div class="table-action-group table-action-group--wrap">
                  <AppButton size="small" variant="ghost" @click="editAnnouncement(row)">
                    编辑
                  </AppButton>
                  <AppButton size="small" variant="danger" @click="removeAnnouncement(row)">
                    删除
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="announcements.length" class="mobile-record-list" aria-label="系统公告移动列表">
            <article
              v-for="announcement in announcements"
              :key="announcement.id"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ announcement.title }}</strong>
                  <span>{{ announcement.content }}</span>
                </div>
                <LevelTag :level="announcement.level" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>状态</span>
                  <strong>{{ announcement.enabled ? '启用' : '停用' }}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{{ formatDate(announcement.updatedAt) }}</strong>
                </div>
                <div>
                  <span>更新人</span>
                  <strong>{{ announcement.updatedBy?.displayName ?? '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>展示时间</span>
                  <strong>
                    {{ formatDate(announcement.startAt) }} - {{ formatDate(announcement.endAt) }}
                  </strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="ghost" @click="editAnnouncement(announcement)">
                  编辑
                </AppButton>
                <AppButton size="small" variant="danger" @click="removeAnnouncement(announcement)">
                  删除
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else-if="!announcementsLoading" class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无系统公告</strong>
              <span>发布公告后会同步显示在维护中心。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="announcementQuery.page"
            v-model:page-size="announcementQuery.pageSize"
            :total="announcementTotal"
            @change="() => loadAnnouncements()"
          />
        </el-tab-pane>

        <el-tab-pane label="维护模式" name="mode">
          <div class="settings-layout">
            <el-form label-width="110px" class="settings-form">
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="是否启用"
                    purpose="开启后后台进入维护状态，只允许指定角色或 IP 访问。"
                    example="上线升级或紧急修复时开启，完成后及时关闭。"
                  />
                </template>
                <el-switch
                  v-model="modeForm.enabled"
                  active-text="开启维护"
                  inactive-text="正常运行"
                />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="维护原因"
                    purpose="告诉后台用户为什么正在维护，减少误会和重复询问。"
                    example="可以写系统升级中，预计 30 分钟后恢复。"
                  />
                </template>
                <el-input
                  v-model="modeForm.reason"
                  type="textarea"
                  :rows="3"
                  placeholder="输入维护原因，会显示给后台用户"
                />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="允许角色"
                    purpose="维护期间仍可访问后台的角色编码。"
                    example="多个角色用英文逗号分隔，如 admin,technician。"
                  />
                </template>
                <el-input v-model="modeForm.allowedRolesText" placeholder="例如 admin,technician" />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="允许 IP"
                    purpose="维护期间仍可访问后台的 IP 或网段。"
                    example="多个 IP 或 CIDR 用逗号分隔，如 1.2.3.4,1.2.3.0/24。"
                  />
                </template>
                <el-input
                  v-model="modeForm.allowedIpsText"
                  placeholder="多个 IP 或 CIDR 用逗号分隔"
                />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="开始时间"
                    purpose="计划维护开始时间，用于记录和展示维护窗口。"
                    example="马上维护可留空或填当前时间；预约维护填计划时间。"
                  />
                </template>
                <el-date-picker
                  v-model="modeForm.startAt"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
                  placeholder="可选"
                />
              </el-form-item>
              <el-form-item>
                <template #label>
                  <FieldHelpLabel
                    label="结束时间"
                    purpose="计划维护结束时间，提醒员工预计恢复时间。"
                    example="预计 2 小时后恢复，就选择对应结束时间。"
                  />
                </template>
                <el-date-picker
                  v-model="modeForm.endAt"
                  type="datetime"
                  value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
                  placeholder="可选"
                />
              </el-form-item>
              <el-form-item>
                <AppButton variant="primary" :loading="modeSaving" @click="saveMode">
                  保存维护模式
                </AppButton>
              </el-form-item>
            </el-form>
            <div class="settings-note">
              <h3>当前状态</h3>
              <p>
                {{
                  modeForm.enabled ? '维护模式开启后，普通用户将被限制访问。' : '系统当前正常运行。'
                }}
              </p>
              <p>修改维护模式会限制普通用户访问，并写入审计日志。</p>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="功能开关" name="flags">
          <TableToolbar
            v-model:keyword="flagQuery.keyword"
            v-model:status="flagQuery.enabled"
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
            @refresh="() => loadFeatureFlags()"
            @clear-filters="clearFlagFilters"
            @save-view="saveFlagTableView"
            @apply-view="applyFlagSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="flagsLoading"
            class="desktop-data-table"
            :data="featureFlags"
            :size="flagTableSize"
            row-key="id"
            @sort-change="handleFlagSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无功能开关</strong>
                <span>可以新增功能开关，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearFlagFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
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
                <div class="table-action-group">
                  <AppButton size="small" variant="ghost" @click="editFeatureFlag(row)">
                    编辑
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="featureFlags.length" class="mobile-record-list" aria-label="功能开关移动列表">
            <article v-for="flag in featureFlags" :key="flag.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ flag.name }}</strong>
                  <span>{{ flag.key }}</span>
                </div>
                <StatusChip :tone="flag.enabled ? 'green' : 'neutral'" dot>
                  {{ flag.enabled ? '启用' : '停用' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>配置</span>
                  <strong>{{ formatJson(flag.config ?? {}) }}</strong>
                </div>
                <div>
                  <span>备注</span>
                  <strong>{{ flag.remark || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>更新人</span>
                  <strong>{{ flag.updatedBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{{ formatDate(flag.updatedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="soft" @click="toggleFeatureFlag(flag)">
                  {{ flag.enabled ? '停用' : '启用' }}
                </AppButton>
                <AppButton size="small" variant="ghost" @click="editFeatureFlag(flag)">
                  编辑
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else-if="!flagsLoading" class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无功能开关</strong>
              <span>新增功能开关后可在这里控制模块启停。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="flagQuery.page"
            v-model:page-size="flagQuery.pageSize"
            :total="flagTotal"
            @change="() => loadFeatureFlags()"
          />
        </el-tab-pane>

        <el-tab-pane label="版本信息" name="versions">
          <TableToolbar
            v-model:keyword="versionQuery.keyword"
            v-model:status="versionQuery.status"
            v-model:visible-columns="versionVisibleColumns"
            v-model:saved-view-id="versionSavedViewId"
            :column-options="versionColumnOptions"
            :status-options="versionStatusOptions"
            :saved-views="versionSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索版本、标题、更新内容"
            @search="handleVersionSearch"
            @refresh="() => loadAppVersions()"
            @clear-filters="clearVersionFilters"
            @save-view="saveVersionTableView"
            @apply-view="applyVersionSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="versionsLoading"
            class="desktop-data-table"
            :data="appVersions"
            :size="versionTableSize"
            row-key="id"
            @sort-change="handleVersionSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无版本记录</strong>
                <span>可以登记版本，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearVersionFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
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
          <div v-if="appVersions.length" class="mobile-record-list" aria-label="版本信息移动列表">
            <article v-for="version in appVersions" :key="version.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ version.version }}</strong>
                  <span>{{ version.title }}</span>
                </div>
                <VersionStatusTag :status="version.status" />
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>更新内容</span>
                  <strong>{{ version.releaseNotes || '-' }}</strong>
                </div>
                <div>
                  <span>影响模块</span>
                  <strong>{{ version.impactModules.join(', ') || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>发布时间</span>
                  <strong>{{ formatDate(version.releasedAt) }}</strong>
                </div>
                <div>
                  <span>创建人</span>
                  <strong>{{ version.createdBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(version.createdAt) }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else-if="!versionsLoading" class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无版本记录</strong>
              <span>登记版本后可追踪发布时间和影响模块。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="versionQuery.page"
            v-model:page-size="versionQuery.pageSize"
            :total="versionTotal"
            @change="() => loadAppVersions()"
          />
        </el-tab-pane>

        <el-tab-pane label="更新日志" name="changelog">
          <TableToolbar
            v-model:keyword="changelogQuery.keyword"
            v-model:status="changelogQuery.status"
            v-model:visible-columns="changelogVisibleColumns"
            v-model:saved-view-id="changelogSavedViewId"
            :column-options="versionColumnOptions"
            :status-options="versionStatusOptions"
            :saved-views="changelogSavedViews"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索版本、标题、更新内容"
            @search="handleChangelogSearch"
            @refresh="() => loadChangelogs()"
            @clear-filters="clearChangelogFilters"
            @save-view="saveChangelogTableView"
            @apply-view="applyChangelogSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="changelogLoading"
            class="desktop-data-table"
            :data="changelogs"
            :size="changelogTableSize"
            row-key="id"
            @sort-change="handleChangelogSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无更新日志</strong>
                <span>可以登记更新内容，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearChangelogFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
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
          <div v-if="changelogs.length" class="mobile-record-list" aria-label="更新日志移动列表">
            <article v-for="log in changelogs" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.version }}</strong>
                  <span>{{ log.title }}</span>
                </div>
                <VersionStatusTag :status="log.status" />
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>更新内容</span>
                  <strong>{{ log.releaseNotes || '-' }}</strong>
                </div>
                <div>
                  <span>影响模块</span>
                  <strong>{{ log.impactModules.join(', ') || '-' }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>发布时间</span>
                  <strong>{{ formatDate(log.releasedAt) }}</strong>
                </div>
                <div>
                  <span>创建人</span>
                  <strong>{{ log.createdBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(log.createdAt) }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else-if="!changelogLoading" class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无更新日志</strong>
              <span>发布记录会按时间展示在这里。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="changelogQuery.page"
            v-model:page-size="changelogQuery.pageSize"
            :total="changelogTotal"
            @change="() => loadChangelogs()"
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
            v-model:visible-columns="parameterVisibleColumns"
            v-model:saved-view-id="parameterSavedViewId"
            :column-options="parameterColumnOptions"
            :saved-views="parameterSavedViews"
            :show-status="false"
            :show-date-shortcut="false"
            :show-primary="false"
            placeholder="搜索参数 key 或备注"
            @search="handleParameterSearch"
            @refresh="() => loadSystemParameters()"
            @clear-filters="clearParameterFilters"
            @save-view="saveParameterTableView"
            @apply-view="applyParameterSavedView"
            @export="showExportMessage"
          />
          <el-table
            v-loading="parametersLoading"
            class="desktop-data-table"
            :data="systemParameters"
            :size="parameterTableSize"
            row-key="key"
            @sort-change="handleParameterSortChange"
          >
            <template #empty>
              <div class="apple-core-empty-state">
                <strong>暂无系统参数</strong>
                <span>可以新增参数，或清空筛选后重新查看。</span>
                <div class="apple-core-empty-state__actions">
                  <AppButton variant="soft" @click="clearParameterFilters">清空筛选</AppButton>
                </div>
              </div>
            </template>
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
                <div class="table-action-group">
                  <AppButton size="small" variant="ghost" @click="editSystemParameter(row)">
                    编辑
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div
            v-if="systemParameters.length"
            class="mobile-record-list"
            aria-label="系统参数移动列表"
          >
            <article
              v-for="parameter in systemParameters"
              :key="parameter.key"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ parameter.key }}</strong>
                  <span>{{ parameter.remark || '暂无备注' }}</span>
                </div>
                <StatusChip tone="blue" dot>参数</StatusChip>
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>值</span>
                  <strong>{{ formatJson(parameter.value ?? {}) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>更新人</span>
                  <strong>{{ parameter.updatedBy?.displayName ?? '-' }}</strong>
                </div>
                <div>
                  <span>更新时间</span>
                  <strong>{{ formatDate(parameter.updatedAt) }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatDate(parameter.createdAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="ghost" @click="editSystemParameter(parameter)">
                  编辑
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else-if="!parametersLoading" class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无系统参数</strong>
              <span>新增参数后可集中管理维护配置。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="parameterQuery.page"
            v-model:page-size="parameterQuery.pageSize"
            :total="parameterTotal"
            @change="() => loadSystemParameters()"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="announcementDialogVisible"
      :title="announcementForm.id ? '编辑公告' : '发布公告'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="90px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="标题"
              purpose="公告标题，用户或员工第一眼看到的内容。"
              example="可以写系统维护通知、版本升级公告。"
            />
          </template>
          <el-input v-model="announcementForm.title" placeholder="公告标题" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="内容"
              purpose="公告正文，说明具体影响、时间和处理建议。"
              example="可以写今晚 23:00-24:00 升级，期间可能无法登录。"
            />
          </template>
          <el-input v-model="announcementForm.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="级别"
              purpose="公告重要程度，影响页面展示颜色和员工关注度。"
              example="普通说明选信息；有影响但可接受选警告；严重异常选错误。"
            />
          </template>
          <el-select v-model="announcementForm.level">
            <el-option
              v-for="option in announcementLevelOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="启用"
              purpose="控制这条公告是否对用户或员工展示。"
              example="确认文案无误后启用；草稿或过期公告关闭。"
            />
          </template>
          <el-switch v-model="announcementForm.enabled" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="开始"
              purpose="公告开始展示的时间。"
              example="立即展示可留空或填当前时间；预约公告填未来时间。"
            />
          </template>
          <el-date-picker
            v-model="announcementForm.startAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="结束"
              purpose="公告自动停止展示的时间。"
              example="维护完成后不需要继续显示，就设置结束时间。"
            />
          </template>
          <el-date-picker
            v-model="announcementForm.endAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="可选"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="announcementDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="announcementSaving" @click="saveAnnouncement">
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="flagDialogVisible"
      :title="flagForm.id ? '编辑功能开关' : '新增功能开关'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form label-width="90px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="编码"
              purpose="功能开关的唯一代码，前端或后端按它判断功能是否开启。"
              example="可以填 code.auto_delivery、apple.automation。"
            />
          </template>
          <el-input v-model="flagForm.key" :disabled="Boolean(flagForm.id)" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="名称"
              purpose="功能开关的显示名称，方便员工理解控制的是哪个功能。"
              example="可以填兑换码自动发货、Apple ID 自动化任务。"
            />
          </template>
          <el-input v-model="flagForm.name" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="启用"
              purpose="控制这个功能开关是否生效。"
              example="新功能测试通过后开启；有故障时可临时关闭。"
            />
          </template>
          <el-switch v-model="flagForm.enabled" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="配置 JSON"
              purpose="给功能开关附加更细的配置，必须是合法 JSON。"
              example='可以填 {"rollout":50}，没有额外配置可填 {}。'
            />
          </template>
          <el-input v-model="flagForm.configText" type="textarea" :rows="5" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录功能开关的用途和修改注意事项。"
              example="可以写只给管理员使用，或灰度期间不要关闭。"
            />
          </template>
          <el-input v-model="flagForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="flagDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="flagSaving" @click="saveFeatureFlag">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="versionDialogVisible"
      title="登记版本"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form label-width="100px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="版本号"
              purpose="登记本次发布或变更的版本编号。"
              example="可以填 0.1.1、2026.06.21。"
            />
          </template>
          <el-input v-model="versionForm.version" placeholder="例如 0.1.1" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="标题"
              purpose="版本更新标题，用来概括这次发布内容。"
              example="可以写订单录入体验优化、兑换码发货增强。"
            />
          </template>
          <el-input v-model="versionForm.title" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="标记这个版本当前处于草稿、已发布还是废弃。"
              example="还没上线选草稿；已经上线选已发布；回滚废弃选已废弃。"
            />
          </template>
          <el-select v-model="versionForm.status">
            <el-option
              v-for="option in versionStatusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="影响模块"
              purpose="记录本次版本影响哪些业务模块，便于排查问题。"
              example="多个模块用逗号分隔，如 apple,code,system。"
            />
          </template>
          <el-input v-model="versionForm.impactModulesText" placeholder="多个模块用逗号分隔" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="发布时间"
              purpose="记录版本正式发布时间。"
              example="正式上线时选择实际发布时间；草稿可以留空。"
            />
          </template>
          <el-date-picker
            v-model="versionForm.releasedAt"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="更新内容"
              purpose="详细记录这次版本改了什么，方便员工和后续维护查看。"
              example="可以分行写新增字段说明、修复订单问题、优化移动端。"
            />
          </template>
          <el-input v-model="versionForm.releaseNotes" type="textarea" :rows="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="versionDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="versionSaving" @click="saveAppVersion"
          >保存</AppButton
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="parameterDialogVisible"
      :title="parameterForm.id ? '编辑系统参数' : '新增系统参数'"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form label-width="90px">
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="参数 key"
              purpose="系统参数唯一键名，代码会按它读取配置。"
              example="可以填 maintenance.banner 或 code.low_stock_threshold。"
            />
          </template>
          <el-input v-model="parameterForm.key" :disabled="Boolean(parameterForm.id)" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="值 JSON"
              purpose="系统参数的配置值，必须是合法 JSON。"
              example='简单开关可填 true，对象可填 {"days":7}。'
            />
          </template>
          <el-input v-model="parameterForm.valueText" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="说明这个参数的用途和修改注意事项。"
              example="可以写影响维护公告展示，修改后需刷新页面。"
            />
          </template>
          <el-input v-model="parameterForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="parameterDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="parameterSaving" @click="saveSystemParameter">
          保存
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
/* eslint-disable vue/one-component-per-file */
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  reactive,
  ref,
  resolveComponent,
  watch
} from 'vue';
import type { Ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { dataCenterApi, maintenanceApi, userTableViewsApi } from '@/api/system';
import type {
  DataDictionaryQuery,
  MaintenanceAnnouncementQuery,
  MaintenanceFeatureFlagQuery,
  MaintenanceParameterQuery,
  MaintenanceVersionQuery
} from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppAnnouncement,
  AppAnnouncementLevel,
  AppVersion,
  AppVersionStatus,
  DataDictionary,
  FeatureFlag,
  MaintenanceOverview,
  MaintenanceWindow,
  PageResult,
  SystemParameter,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  MAINTENANCE_ANNOUNCEMENT_LEVEL_DICTIONARY_GROUP,
  MAINTENANCE_VERSION_STATUS_DICTIONARY_GROUP
} from '@/config/quickSettings';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import {
  buildMaintenanceAnnouncementLevelOptions,
  buildMaintenanceVersionStatusOptions,
  getMaintenanceAnnouncementLevelLabel,
  getMaintenanceVersionStatusLabel,
  isMaintenanceAnnouncementLevel,
  isMaintenanceVersionStatus
} from '@/utils/systemQuickOptions';
import { exportRowsToCsv } from '@/utils/exportCsv';

type LoadOptions = { background?: boolean; force?: boolean };

const route = useRoute();
const activeTab = ref('overview');
const overview = ref<MaintenanceOverview | null>(null);
const announcementLevelDictionaries = ref<DataDictionary[]>([]);
const versionStatusDictionaries = ref<DataDictionary[]>([]);
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
const announcementLevelOptions = computed(() =>
  buildMaintenanceAnnouncementLevelOptions(announcementLevelDictionaries.value)
);
const versionStatusOptions = computed(() =>
  buildMaintenanceVersionStatusOptions(versionStatusDictionaries.value)
);
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
const activeOverviewQueryKey = ref('');
const activeAnnouncementQueryKey = ref('');
const activeModeQueryKey = ref('');
const activeFlagQueryKey = ref('');
const activeVersionQueryKey = ref('');
const activeChangelogQueryKey = ref('');
const activeMenuConfigQueryKey = ref('');
const activeThemeConfigQueryKey = ref('');
const activeParameterQueryKey = ref('');
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
      title: '维护总览',
      description: '查看公告、版本和维护模式概览，确认后台运行状态。',
      badge: '总览',
      tone: 'blue'
    },
    announcements: {
      title: '系统公告',
      description: '发布、停用和维护面向后台用户的系统公告。',
      badge: '公告',
      tone: 'cyan'
    },
    mode: {
      title: '维护模式',
      description: '维护模式会限制普通用户访问，修改必须记录原因和允许范围。',
      badge: '维护',
      tone: modeForm.enabled ? 'red' : 'green'
    },
    flags: {
      title: '功能开关',
      description: '管理功能启停和灰度配置，避免临时开关散落在代码里。',
      badge: '开关',
      tone: 'orange'
    },
    versions: {
      title: '版本信息',
      description: '登记版本号、发布状态、影响模块和发布时间。',
      badge: '版本',
      tone: 'purple'
    },
    changelog: {
      title: '更新日志',
      description: '沉淀每次更新内容，方便员工理解系统变化。',
      badge: '日志',
      tone: 'blue'
    },
    menu: {
      title: '菜单配置',
      description: '维护菜单配置 JSON，用于控制后台菜单展示和入口顺序。',
      badge: '菜单',
      tone: 'neutral'
    },
    theme: {
      title: '主题配置',
      description: '保存主题配置 JSON，保持视觉参数可控可追溯。',
      badge: '主题',
      tone: 'cyan'
    },
    parameters: {
      title: '系统参数',
      description: '集中维护系统级参数，参数值以 JSON 形式保存。',
      badge: '参数',
      tone: 'green'
    }
  };
  return metaMap[activeTab.value] ?? metaMap.overview;
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
    return () =>
      h(StatusChip, { tone: getLevelTone(props.level as AppAnnouncementLevel), dot: true }, () =>
        getLevelLabel(props.level as AppAnnouncementLevel)
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
    return () =>
      h(
        StatusChip,
        { tone: getVersionStatusTone(props.status as AppVersionStatus), dot: true },
        () => getVersionStatusLabel(props.status as AppVersionStatus)
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
            AppButton,
            {
              variant: 'primary',
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
    void refreshCurrentTab({ force: false });
  },
  { immediate: true }
);

usePageRefresh(
  (options) =>
    refreshCurrentTab({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '系统配置' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [
    'maintenance-overview',
    'maintenance-announcements',
    'maintenance-mode',
    'maintenance-feature-flags',
    'maintenance-versions',
    'maintenance-changelogs',
    'maintenance-menu-config',
    'maintenance-theme-config',
    'maintenance-parameters',
    'data-dictionaries'
  ],
  ({ scopes }) => {
    if (scopes.includes('data-dictionaries')) {
      void loadMaintenanceOptions({ background: true, force: true });
    }

    if (scopes.includes('maintenance-overview')) {
      void loadOverview({ background: Boolean(overview.value), force: true });
    }

    if (activeTab.value === 'announcements' && scopes.includes('maintenance-announcements')) {
      void loadAnnouncements({
        background: announcements.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'mode' && scopes.includes('maintenance-mode')) {
      void loadMode({ background: true, force: true });
    }

    if (activeTab.value === 'flags' && scopes.includes('maintenance-feature-flags')) {
      void loadFeatureFlags({
        background: featureFlags.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'versions' && scopes.includes('maintenance-versions')) {
      void loadAppVersions({
        background: appVersions.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'changelog' && scopes.includes('maintenance-changelogs')) {
      void loadChangelogs({
        background: changelogs.value.length > 0,
        force: true
      });
    }

    if (activeTab.value === 'menu' && scopes.includes('maintenance-menu-config')) {
      void loadMenuConfig({ background: true, force: true });
    }

    if (activeTab.value === 'theme' && scopes.includes('maintenance-theme-config')) {
      void loadThemeConfig({ background: true, force: true });
    }

    if (activeTab.value === 'parameters' && scopes.includes('maintenance-parameters')) {
      void loadSystemParameters({
        background: systemParameters.value.length > 0,
        force: true
      });
    }
  }
);

onBeforeUnmount(stopRealtimeRefresh);

async function refreshCurrentTab(options: LoadOptions = {}) {
  await loadMaintenanceOptions(options);
  await loadOverview(options);
  if (activeTab.value === 'overview') return;
  if (activeTab.value === 'announcements') await loadAnnouncementsWithViews(options);
  if (activeTab.value === 'mode') await loadMode(options);
  if (activeTab.value === 'flags') await loadFeatureFlagsWithViews(options);
  if (activeTab.value === 'versions') await loadAppVersionsWithViews(options);
  if (activeTab.value === 'changelog') await loadChangelogsWithViews(options);
  if (activeTab.value === 'menu') await loadMenuConfig(options);
  if (activeTab.value === 'theme') await loadThemeConfig(options);
  if (activeTab.value === 'parameters') await loadSystemParametersWithViews(options);
}

function buildMaintenanceOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadMaintenanceOptions(options: LoadOptions = {}) {
  try {
    const [announcementLevels, versionStatuses] = await Promise.all([
      dataCenterApi.listDictionaries(
        buildMaintenanceOptionParams(MAINTENANCE_ANNOUNCEMENT_LEVEL_DICTIONARY_GROUP)
      ),
      dataCenterApi.listDictionaries(
        buildMaintenanceOptionParams(MAINTENANCE_VERSION_STATUS_DICTIONARY_GROUP)
      )
    ]);
    announcementLevelDictionaries.value = announcementLevels.items;
    versionStatusDictionaries.value = versionStatuses.items;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载系统维护选项失败');
    }
  }
}

async function loadCachedData<TData>(config: {
  scope: string;
  activeKey: Ref<string>;
  setLoading?: (loading: boolean) => void;
  apply: (data: TData) => void;
  fetcher: () => Promise<TData>;
  errorMessage: string;
  options?: LoadOptions;
}) {
  const options = config.options ?? {};
  const key = createSmartQueryKey(config.scope);
  const cached = getSmartQueryData<TData>(key);

  config.activeKey.value = key;

  if (cached) {
    config.apply(cached);
  }

  config.setLoading?.(!cached && !options.background);

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
      config.setLoading?.(false);
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

async function loadOverview(options: LoadOptions = {}) {
  await loadCachedData<MaintenanceOverview>({
    scope: 'maintenance-overview',
    activeKey: activeOverviewQueryKey,
    setLoading: (loading) => {
      overviewLoading.value = loading;
    },
    apply: (data) => {
      overview.value = data;
    },
    fetcher: () => maintenanceApi.overview(),
    errorMessage: '加载维护总览失败',
    options
  });
}

function buildAnnouncementParams(): MaintenanceAnnouncementQuery {
  return {
    ...announcementQuery,
    sortBy: mapSortField(announcementSortConfig.value.prop, {
      announcement: 'title',
      displayTime: 'startAt'
    }),
    sortOrder: mapSortOrder(announcementSortConfig.value.order)
  };
}

async function loadAnnouncements(options: LoadOptions = {}) {
  const params = buildAnnouncementParams();
  await loadPagedData<AppAnnouncement>({
    scope: 'maintenance-announcements',
    params,
    activeKey: activeAnnouncementQueryKey,
    setLoading: (loading) => {
      announcementsLoading.value = loading;
    },
    apply: (result) => {
      applyPage(result, announcements, (total) => {
        announcementTotal.value = total;
      });
    },
    fetcher: () => maintenanceApi.listAnnouncements(params),
    errorMessage: '加载系统公告失败',
    options
  });
}

async function loadAnnouncementsWithViews(options: LoadOptions = {}) {
  await ensureAnnouncementTableViews();
  await loadAnnouncements(options);
}

async function loadMode(options: LoadOptions = {}) {
  await loadCachedData<MaintenanceWindow>({
    scope: 'maintenance-mode',
    activeKey: activeModeQueryKey,
    apply: applyMode,
    fetcher: () => maintenanceApi.getMode(),
    errorMessage: '加载维护模式失败',
    options
  });
}

function buildFeatureFlagParams(): MaintenanceFeatureFlagQuery {
  return {
    ...flagQuery,
    sortBy: mapSortField(flagSortConfig.value.prop, {
      flag: 'name'
    }),
    sortOrder: mapSortOrder(flagSortConfig.value.order)
  };
}

async function loadFeatureFlags(options: LoadOptions = {}) {
  const params = buildFeatureFlagParams();
  await loadPagedData<FeatureFlag>({
    scope: 'maintenance-feature-flags',
    params,
    activeKey: activeFlagQueryKey,
    setLoading: (loading) => {
      flagsLoading.value = loading;
    },
    apply: (result) => {
      applyPage(result, featureFlags, (total) => {
        flagTotal.value = total;
      });
    },
    fetcher: () => maintenanceApi.listFeatureFlags(params),
    errorMessage: '加载功能开关失败',
    options
  });
}

async function loadFeatureFlagsWithViews(options: LoadOptions = {}) {
  await ensureFlagTableViews();
  await loadFeatureFlags(options);
}

function buildVersionParams(): MaintenanceVersionQuery {
  return {
    ...versionQuery,
    sortBy: mapSortField(versionSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(versionSortConfig.value.order)
  };
}

async function loadAppVersions(options: LoadOptions = {}) {
  const params = buildVersionParams();
  await loadPagedData<AppVersion>({
    scope: 'maintenance-versions',
    params,
    activeKey: activeVersionQueryKey,
    setLoading: (loading) => {
      versionsLoading.value = loading;
    },
    apply: (result) => {
      applyPage(result, appVersions, (total) => {
        versionTotal.value = total;
      });
    },
    fetcher: () => maintenanceApi.listAppVersions(params),
    errorMessage: '加载版本信息失败',
    options
  });
}

async function loadAppVersionsWithViews(options: LoadOptions = {}) {
  await ensureVersionTableViews();
  await loadAppVersions(options);
}

function buildChangelogParams(): MaintenanceVersionQuery {
  return {
    ...changelogQuery,
    sortBy: mapSortField(changelogSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(changelogSortConfig.value.order)
  };
}

async function loadChangelogs(options: LoadOptions = {}) {
  const params = buildChangelogParams();
  await loadPagedData<AppVersion>({
    scope: 'maintenance-changelogs',
    params,
    activeKey: activeChangelogQueryKey,
    setLoading: (loading) => {
      changelogLoading.value = loading;
    },
    apply: (result) => {
      applyPage(result, changelogs, (total) => {
        changelogTotal.value = total;
      });
    },
    fetcher: () => maintenanceApi.listChangelogs(params),
    errorMessage: '加载更新日志失败',
    options
  });
}

async function loadChangelogsWithViews(options: LoadOptions = {}) {
  await ensureChangelogTableViews();
  await loadChangelogs(options);
}

async function loadMenuConfig(options: LoadOptions = {}) {
  await loadCachedData<SystemParameter>({
    scope: 'maintenance-menu-config',
    activeKey: activeMenuConfigQueryKey,
    setLoading: (loading) => {
      menuConfigLoading.value = loading;
    },
    apply: (parameter) => {
      menuConfigText.value = formatJson(parameter.value);
    },
    fetcher: () => maintenanceApi.getMenuConfig(),
    errorMessage: '加载菜单配置失败',
    options
  });
}

async function loadThemeConfig(options: LoadOptions = {}) {
  await loadCachedData<SystemParameter>({
    scope: 'maintenance-theme-config',
    activeKey: activeThemeConfigQueryKey,
    setLoading: (loading) => {
      themeConfigLoading.value = loading;
    },
    apply: (parameter) => {
      themeConfigText.value = formatJson(parameter.value);
    },
    fetcher: () => maintenanceApi.getThemeConfig(),
    errorMessage: '加载主题配置失败',
    options
  });
}

function buildParameterParams(): MaintenanceParameterQuery {
  return {
    ...parameterQuery,
    sortBy: mapSortField(parameterSortConfig.value.prop, {}),
    sortOrder: mapSortOrder(parameterSortConfig.value.order)
  };
}

async function loadSystemParameters(options: LoadOptions = {}) {
  const params = buildParameterParams();
  await loadPagedData<SystemParameter>({
    scope: 'maintenance-parameters',
    params,
    activeKey: activeParameterQueryKey,
    setLoading: (loading) => {
      parametersLoading.value = loading;
    },
    apply: (result) => {
      applyPage(result, systemParameters, (total) => {
        parameterTotal.value = total;
      });
    },
    fetcher: () => maintenanceApi.listSystemParameters(params),
    errorMessage: '加载系统参数失败',
    options
  });
}

async function loadSystemParametersWithViews(options: LoadOptions = {}) {
  await ensureParameterTableViews();
  await loadSystemParameters(options);
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
  announcementDensity.value = 'default';
  announcementVisibleColumns.value = normalizeColumns(view.columns, announcementColumnOptions);
  announcementSortConfig.value = parseSortConfig(view.sortConfig);
  announcementSavedViewId.value = view.id;
}

function applyFlagView(view: UserTableView) {
  const filters = view.filters;
  flagQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  flagQuery.enabled = typeof filters.enabled === 'string' ? filters.enabled : '';
  flagQuery.pageSize = view.pageSize;
  flagDensity.value = 'default';
  flagVisibleColumns.value = normalizeColumns(view.columns, flagColumnOptions);
  flagSortConfig.value = parseSortConfig(view.sortConfig);
  flagSavedViewId.value = view.id;
}

function applyVersionView(view: UserTableView) {
  const filters = view.filters;
  versionQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  versionQuery.status = isAppVersionStatus(filters.status) ? filters.status : '';
  versionQuery.pageSize = view.pageSize;
  versionDensity.value = 'default';
  versionVisibleColumns.value = normalizeColumns(view.columns, versionColumnOptions);
  versionSortConfig.value = parseSortConfig(view.sortConfig);
  versionSavedViewId.value = view.id;
}

function applyChangelogView(view: UserTableView) {
  const filters = view.filters;
  changelogQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  changelogQuery.status = isAppVersionStatus(filters.status) ? filters.status : '';
  changelogQuery.pageSize = view.pageSize;
  changelogDensity.value = 'default';
  changelogVisibleColumns.value = normalizeColumns(view.columns, versionColumnOptions);
  changelogSortConfig.value = parseSortConfig(view.sortConfig);
  changelogSavedViewId.value = view.id;
}

function applyParameterView(view: UserTableView) {
  const filters = view.filters;
  parameterQuery.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  parameterQuery.pageSize = view.pageSize;
  parameterDensity.value = 'default';
  parameterVisibleColumns.value = normalizeColumns(view.columns, parameterColumnOptions);
  parameterSortConfig.value = parseSortConfig(view.sortConfig);
  parameterSavedViewId.value = view.id;
}

function getDefaultAnnouncementLevel() {
  return announcementLevelOptions.value[0]?.value ?? 'info';
}

function getDefaultVersionStatus() {
  return (
    versionStatusOptions.value.find((option) => option.value === 'draft')?.value ??
    versionStatusOptions.value[0]?.value ??
    'draft'
  );
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
    level: getDefaultAnnouncementLevel(),
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
    status: getDefaultVersionStatus(),
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
      remark: '系统配置菜单配置'
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
      remark: '系统配置主题配置'
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
  return typeof value === 'string' && isMaintenanceAnnouncementLevel(value);
}

function isAppVersionStatus(value: unknown): value is AppVersionStatus {
  return typeof value === 'string' && isMaintenanceVersionStatus(value);
}

function showExportMessage() {
  if (activeTab.value === 'announcements') {
    if (!announcements.value.length) {
      ElMessage.warning('暂无可导出的系统公告');
      return;
    }

    const count = exportRowsToCsv(
      'system-announcements',
      [
        { header: '公告标题', value: (row) => row.title },
        { header: '公告内容', value: (row) => row.content },
        { header: '级别', value: (row) => getLevelLabel(row.level) },
        { header: '启用', value: (row) => (row.enabled ? '是' : '否') },
        { header: '开始时间', value: (row) => formatDate(row.startAt) },
        { header: '结束时间', value: (row) => formatDate(row.endAt) },
        {
          header: '更新人',
          value: (row) => row.updatedBy?.displayName ?? row.updatedBy?.username ?? ''
        },
        { header: '创建时间', value: (row) => formatDate(row.createdAt) },
        { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
      ],
      announcements.value
    );

    ElMessage.success(`已导出 ${count} 条系统公告`);
    return;
  }

  if (activeTab.value === 'flags') {
    if (!featureFlags.value.length) {
      ElMessage.warning('暂无可导出的功能开关');
      return;
    }

    const count = exportRowsToCsv(
      'system-feature-flags',
      [
        { header: '开关键', value: (row) => row.key },
        { header: '名称', value: (row) => row.name },
        { header: '启用', value: (row) => (row.enabled ? '是' : '否') },
        { header: '配置', value: (row) => formatJson(row.config ?? {}) },
        { header: '备注', value: (row) => row.remark ?? '' },
        {
          header: '更新人',
          value: (row) => row.updatedBy?.displayName ?? row.updatedBy?.username ?? ''
        },
        { header: '创建时间', value: (row) => formatDate(row.createdAt) },
        { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
      ],
      featureFlags.value
    );

    ElMessage.success(`已导出 ${count} 个功能开关`);
    return;
  }

  if (activeTab.value === 'versions' || activeTab.value === 'changelog') {
    const rows = activeTab.value === 'versions' ? appVersions.value : changelogs.value;

    if (!rows.length) {
      ElMessage.warning(
        activeTab.value === 'versions' ? '暂无可导出的版本信息' : '暂无可导出的更新日志'
      );
      return;
    }

    const count = exportRowsToCsv(
      activeTab.value === 'versions' ? 'system-versions' : 'system-changelog',
      [
        { header: '版本', value: (row) => row.version },
        { header: '标题', value: (row) => row.title },
        { header: '状态', value: (row) => getVersionStatusLabel(row.status) },
        { header: '影响模块', value: (row) => row.impactModules.join('、') },
        { header: '更新内容', value: (row) => row.releaseNotes },
        { header: '发布时间', value: (row) => formatDate(row.releasedAt) },
        {
          header: '创建人',
          value: (row) => row.createdBy?.displayName ?? row.createdBy?.username ?? ''
        },
        { header: '创建时间', value: (row) => formatDate(row.createdAt) }
      ],
      rows
    );

    ElMessage.success(
      `已导出 ${count} 条${activeTab.value === 'versions' ? '版本信息' : '更新日志'}`
    );
    return;
  }

  if (activeTab.value === 'parameters') {
    if (!systemParameters.value.length) {
      ElMessage.warning('暂无可导出的系统参数');
      return;
    }

    const count = exportRowsToCsv(
      'system-parameters',
      [
        { header: '参数键', value: (row) => row.key },
        { header: '分组', value: (row) => row.group },
        { header: '参数值', value: (row) => formatJson(row.value) },
        { header: '备注', value: (row) => row.remark ?? '' },
        {
          header: '更新人',
          value: (row) => row.updatedBy?.displayName ?? row.updatedBy?.username ?? ''
        },
        { header: '创建时间', value: (row) => formatDate(row.createdAt) },
        { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
      ],
      systemParameters.value
    );

    ElMessage.success(`已导出 ${count} 条系统参数`);
    return;
  }

  ElMessage.warning('当前页签没有可导出的列表');
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function getLevelLabel(level: AppAnnouncementLevel) {
  return getMaintenanceAnnouncementLevelLabel(level, announcementLevelDictionaries.value);
}

function getLevelTone(level: AppAnnouncementLevel) {
  if (level === 'warning') return 'orange';
  if (level === 'error') return 'red';
  return 'blue';
}

function getVersionStatusLabel(status: AppVersionStatus) {
  return getMaintenanceVersionStatusLabel(status, versionStatusDictionaries.value);
}

function getVersionStatusTone(status: AppVersionStatus) {
  if (status === 'released') return 'green';
  if (status === 'deprecated') return 'neutral';
  return 'orange';
}
</script>

<style scoped>
.system-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.system-compact-list-panel .inline-actions {
  max-width: min(640px, 100%);
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
