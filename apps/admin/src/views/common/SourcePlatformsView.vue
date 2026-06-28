<template>
  <PageScaffold
    title="选项设置"
    group="系统配置"
    phase="Phase 2"
    description="这里维护日常会改的选项内容，比如来源平台、客户标签、Apple ID 分类、地区币种和兑换码发货方式。系统内部用的技术字典不放在这里。"
  >
    <nav class="source-options-nav" aria-label="选项设置导航">
      <AppButton
        v-for="section in sourceOptionSections"
        :key="section.key"
        class="source-options-nav__button"
        :variant="isSourceOptionSectionActive(section.key) ? 'primary' : 'soft'"
        @click="goToSourceOptionSection(section.route)"
      >
        {{ section.label }}
      </AppButton>
    </nav>

    <section
      v-if="isSourceOptionSectionActive('platforms')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          title="来源平台"
          :help="[
            '这里设置客户和订单从哪里来，比如微信、官网、线下转账。',
            '平台名称、手续费和状态会给客户、订单和利润计算一起使用。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>来源平台 {{ total }}</StatusChip>
          <StatusChip tone="green">启用 {{ activePlatformCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="platformColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedPlatforms.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增来源平台"
        placeholder="搜索平台名称、备注"
        @search="handleSearch"
        @refresh="() => loadPlatforms()"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="platforms"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无来源平台</strong>
            <span>可以新增来源平台，或清空筛选后重新查看配置列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增来源平台</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="平台名称"
          min-width="150"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('feeRate')"
          prop="feeRate"
          label="费率"
          width="110"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              费率
              <FeatureHelp
                :text="[
                  '用途：平台按订单金额抽成的比例，订单录入时会用它自动估算手续费。',
                  '举例：1% 填 0.01，0.6% 填 0.006。'
                ]"
                title="费率"
              />
            </span>
          </template>
          <template #default="{ row }">{{ row.feeRate }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('feeFixed')"
          prop="feeFixed"
          label="固定费用"
          width="120"
          sortable="custom"
        >
          <template #header>
            <span class="help-label">
              固定费用
              <FeatureHelp
                :text="[
                  '用途：平台每单固定扣掉的钱，会和费率一起计入平台手续费。',
                  '举例：每单固定扣 0.5 元就填 0.5，没有固定费用就填 0。'
                ]"
                title="固定费用"
              />
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="90"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('updatedAt')"
          prop="updatedAt"
          label="更新时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingPlatformId === row.id"
                @click="deletePlatform(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="platforms.length" class="mobile-record-list">
        <article v-for="platform in platforms" :key="platform.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ platform.name }}</strong>
              <span>{{ platform.remark || '无备注' }}</span>
            </div>
            <StatusTag :status="platform.status" />
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>费率</span>
              <strong>{{ platform.feeRate }}</strong>
            </div>
            <div>
              <span>固定费用</span>
              <strong>{{ platform.feeFixed }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(platform.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEdit(platform)">编辑</AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingPlatformId === platform.id"
              @click="deletePlatform(platform)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无来源平台</strong>
          <span>可以新增来源平台，或清空筛选后重新查看配置列表。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增来源平台</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadPlatforms()"
      />
    </section>

    <section
      v-if="isSourceOptionSectionActive('system-options')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          :title="activeSystemOptionGroup.title"
          :help="activeSystemOptionGroup.help"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>选项 {{ systemOptionTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeSystemOptionCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-radio-group v-model="selectedSystemOptionGroup" class="quick-settings-segmented">
          <el-radio-button
            v-for="group in systemQuickOptionGroups"
            :key="group.key"
            :value="group.key"
          >
            {{ group.title }}
          </el-radio-button>
        </el-radio-group>
        <AppButton variant="soft" @click="() => loadSystemOptionGroup(selectedSystemOptionGroup)">
          刷新
        </AppButton>
      </div>

      <el-table
        v-loading="systemOptionLoading"
        class="desktop-data-table"
        :data="currentSystemOptionDictionaries"
        :size="tableSize"
        row-key="id"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 {{ activeSystemOptionGroup.title }}</strong>
            <span>需要系统默认项时，可以手动恢复默认选项。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton
                variant="primary"
                @click="
                  () =>
                    loadSystemOptionGroup(selectedSystemOptionGroup, {
                      force: true,
                      restoreDefaults: true
                    })
                "
              >
                恢复默认选项
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="code" label="选项代码" min-width="160" />
        <el-table-column prop="label" label="显示名称" min-width="180" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditSystemOption(row)">
                编辑
              </AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingSystemOptionId === row.id"
                @click="toggleSystemOptionStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteSystemOption(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="currentSystemOptionDictionaries.length" class="mobile-record-list">
        <article
          v-for="option in currentSystemOptionDictionaries"
          :key="option.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ option.label }}</strong>
              <span>{{ option.code }}</span>
            </div>
            <StatusTag :status="option.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ option.sortOrder }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(option.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditSystemOption(option)">
              编辑
            </AppButton>
            <AppButton
              size="small"
              :variant="option.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingSystemOptionId === option.id"
              @click="toggleSystemOptionStatus(option)"
            >
              {{ option.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === option.id"
              @click="deleteSystemOption(option)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="isSourceOptionSectionActive('notification-options')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          :title="activeNotificationOptionGroup.title"
          :help="activeNotificationOptionGroup.help"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>选项 {{ notificationOptionTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeNotificationOptionCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-radio-group v-model="selectedNotificationOptionGroup" class="quick-settings-segmented">
          <el-radio-button
            v-for="group in notificationQuickOptionGroups"
            :key="group.key"
            :value="group.key"
          >
            {{ group.title }}
          </el-radio-button>
        </el-radio-group>
        <AppButton
          variant="soft"
          @click="() => loadNotificationOptionGroup(selectedNotificationOptionGroup)"
        >
          刷新
        </AppButton>
      </div>

      <el-table
        v-loading="notificationOptionLoading"
        class="desktop-data-table"
        :data="currentNotificationOptionDictionaries"
        :size="tableSize"
        row-key="id"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 {{ activeNotificationOptionGroup.title }}</strong>
            <span>需要系统默认项时，可以手动恢复默认选项。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton
                variant="primary"
                @click="
                  () =>
                    loadNotificationOptionGroup(selectedNotificationOptionGroup, {
                      force: true,
                      restoreDefaults: true
                    })
                "
              >
                恢复默认选项
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="code" label="选项代码" min-width="160" />
        <el-table-column prop="label" label="显示名称" min-width="180" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditNotificationOption(row)">
                编辑
              </AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingNotificationOptionId === row.id"
                @click="toggleNotificationOptionStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteNotificationOption(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="currentNotificationOptionDictionaries.length" class="mobile-record-list">
        <article
          v-for="option in currentNotificationOptionDictionaries"
          :key="option.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ option.label }}</strong>
              <span>{{ option.code }}</span>
            </div>
            <StatusTag :status="option.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ option.sortOrder }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(option.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditNotificationOption(option)">
              编辑
            </AppButton>
            <AppButton
              size="small"
              :variant="option.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingNotificationOptionId === option.id"
              @click="toggleNotificationOptionStatus(option)"
            >
              {{ option.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === option.id"
              @click="deleteNotificationOption(option)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="isSourceOptionSectionActive('apple-service-categories')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          title="Apple ID 业务分类"
          :help="[
            '这里统一维护 Apple ID 业务设置里的分类，比如 AI 会员、流媒体、工具订阅。',
            '停用后不会再出现在新增业务的分类下拉里，历史业务已经用到的分类会继续保留。',
            '订单录入能不能选到这个分类，还要看分类下面有没有启用的具体业务，以及可用的地区套餐价格。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>分类 {{ categoryTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeCategoryCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-input
          v-model.trim="categoryQuery.keyword"
          class="quick-settings-toolbar__search"
          clearable
          placeholder="搜索分类名称、备注"
          @clear="handleCategorySearch"
          @keyup.enter="handleCategorySearch"
        />
        <el-select
          v-model="categoryQuery.status"
          class="quick-settings-toolbar__select"
          clearable
          placeholder="状态"
          @change="handleCategorySearch"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <AppButton variant="soft" @click="() => loadAppleServiceCategories()">刷新</AppButton>
        <AppButton variant="primary" @click="openCreateCategory">新增业务分类</AppButton>
      </div>

      <el-table
        v-loading="categoryLoading"
        class="desktop-data-table"
        :data="appleServiceCategories"
        :size="tableSize"
        row-key="id"
        @sort-change="handleCategorySortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 Apple ID 业务分类</strong>
            <span>可以新增分类，后面 Apple ID 业务设置里就能直接选择。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearCategoryFilters">清空筛选</AppButton>
              <AppButton variant="soft" @click="restoreDefaultAppleServiceCategories">
                恢复默认分类
              </AppButton>
              <AppButton variant="primary" @click="openCreateCategory">新增业务分类</AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="label" label="分类名称" min-width="180" sortable="custom" />
        <el-table-column label="关联业务" width="120">
          <template #default="{ row }">
            <AppButton size="small" variant="soft" @click="openCategoryServices(row)">
              {{ getCategoryUsageCount(row) }} 个
            </AppButton>
          </template>
        </el-table-column>
        <el-table-column label="订单可选套餐" width="130">
          <template #default="{ row }">
            <StatusChip :tone="getCategoryOrderOptionCount(row) > 0 ? 'green' : 'orange'">
              {{ getCategoryOrderOptionCount(row) }} 个
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="排序" width="100" sortable="custom" />
        <el-table-column prop="status" label="状态" width="90" sortable="custom">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="220">
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditCategory(row)"
                >编辑</AppButton
              >
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingCategoryId === row.id"
                @click="toggleAppleServiceCategoryStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteAppleServiceCategory(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="appleServiceCategories.length" class="mobile-record-list">
        <article
          v-for="category in appleServiceCategories"
          :key="category.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ category.label }}</strong>
              <span>{{ category.remark || '无备注' }}</span>
            </div>
            <StatusTag :status="category.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ category.sortOrder }}</strong>
            </div>
            <div>
              <span>关联业务</span>
              <AppButton size="small" variant="soft" @click="openCategoryServices(category)">
                {{ getCategoryUsageCount(category) }} 个
              </AppButton>
            </div>
            <div>
              <span>订单可选套餐</span>
              <strong>{{ getCategoryOrderOptionCount(category) }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(category.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditCategory(category)">
              编辑
            </AppButton>
            <AppButton
              size="small"
              :variant="category.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingCategoryId === category.id"
              @click="toggleAppleServiceCategoryStatus(category)"
            >
              {{ category.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === category.id"
              @click="deleteAppleServiceCategory(category)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <PaginationBar
        v-model:page="categoryQuery.page"
        v-model:page-size="categoryQuery.pageSize"
        :total="categoryTotal"
        @change="() => loadAppleServiceCategories()"
      />
    </section>

    <section
      v-if="isSourceOptionSectionActive('apple-service-options')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          :title="`Apple ID ${activeAppleServiceOptionGroup.title}`"
          :help="activeAppleServiceOptionGroup.help"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>选项 {{ appleServiceOptionTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeAppleServiceOptionCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-radio-group v-model="selectedAppleServiceOptionGroup" class="quick-settings-segmented">
          <el-radio-button
            v-for="group in appleServiceQuickOptionGroups"
            :key="group.key"
            :value="group.key"
          >
            {{ group.title }}
          </el-radio-button>
        </el-radio-group>
        <AppButton
          variant="soft"
          @click="() => loadAppleServiceOptionGroup(selectedAppleServiceOptionGroup)"
        >
          刷新
        </AppButton>
      </div>

      <el-table
        v-loading="appleServiceOptionLoading"
        class="desktop-data-table"
        :data="currentAppleServiceOptionDictionaries"
        :size="tableSize"
        row-key="id"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 {{ activeAppleServiceOptionGroup.title }}</strong>
            <span>需要系统默认项时，可以手动恢复默认选项。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton
                variant="primary"
                @click="
                  () =>
                    loadAppleServiceOptionGroup(selectedAppleServiceOptionGroup, {
                      force: true,
                      restoreDefaults: true
                    })
                "
              >
                恢复默认选项
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="code" label="选项代码" min-width="160" />
        <el-table-column prop="label" label="显示名称" min-width="180" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditAppleServiceOption(row)">
                编辑
              </AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingAppleServiceOptionId === row.id"
                @click="toggleAppleServiceOptionStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteAppleServiceOption(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="currentAppleServiceOptionDictionaries.length" class="mobile-record-list">
        <article
          v-for="option in currentAppleServiceOptionDictionaries"
          :key="option.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ option.label }}</strong>
              <span>{{ option.code }}</span>
            </div>
            <StatusTag :status="option.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ option.sortOrder }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(option.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditAppleServiceOption(option)">
              编辑
            </AppButton>
            <AppButton
              size="small"
              :variant="option.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingAppleServiceOptionId === option.id"
              @click="toggleAppleServiceOptionStatus(option)"
            >
              {{ option.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === option.id"
              @click="deleteAppleServiceOption(option)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="isSourceOptionSectionActive('customer-tags')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          title="客户标签"
          :help="[
            '这里统一维护新增客户时可以选择的标签，比如大客户、官网客户、待跟进。',
            '停用后的标签不会再出现在新增客户下拉里，已经保存到客户身上的标签会继续保留。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>标签 {{ tagTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeTagCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-input
          v-model.trim="tagQuery.keyword"
          class="quick-settings-toolbar__search"
          clearable
          placeholder="搜索标签名称、备注"
          @clear="handleTagSearch"
          @keyup.enter="handleTagSearch"
        />
        <el-select
          v-model="tagQuery.status"
          class="quick-settings-toolbar__select"
          clearable
          placeholder="状态"
          @change="handleTagSearch"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <AppButton variant="soft" @click="() => loadCustomerTags()">刷新</AppButton>
        <AppButton variant="primary" @click="openCreateTag">新增客户标签</AppButton>
      </div>

      <el-table
        v-loading="tagLoading"
        class="desktop-data-table"
        :data="customerTags"
        :size="tableSize"
        row-key="id"
        @sort-change="handleTagSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无客户标签</strong>
            <span>可以新增客户标签，后面新增客户时就能直接选择。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearTagFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreateTag">新增客户标签</AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="label" label="标签名称" min-width="180" sortable="custom" />
        <el-table-column prop="sortOrder" label="排序" width="100" sortable="custom" />
        <el-table-column prop="status" label="状态" width="90" sortable="custom">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="220">
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditTag(row)">编辑</AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingTagId === row.id"
                @click="toggleCustomerTagStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteCustomerTag(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="customerTags.length" class="mobile-record-list">
        <article v-for="tag in customerTags" :key="tag.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ tag.label }}</strong>
              <span>{{ tag.remark || '无备注' }}</span>
            </div>
            <StatusTag :status="tag.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ tag.sortOrder }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(tag.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditTag(tag)">编辑</AppButton>
            <AppButton
              size="small"
              :variant="tag.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingTagId === tag.id"
              @click="toggleCustomerTagStatus(tag)"
            >
              {{ tag.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === tag.id"
              @click="deleteCustomerTag(tag)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <PaginationBar
        v-model:page="tagQuery.page"
        v-model:page-size="tagQuery.pageSize"
        :total="tagTotal"
        @change="() => loadCustomerTags()"
      />
    </section>

    <section
      v-if="isSourceOptionSectionActive('apple-regions')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          title="Apple ID 地区/币种"
          :help="[
            '这里管新增 Apple ID 时地区下拉里的选项，比如 us、cn、my。',
            '地区只影响 Apple ID 属于哪里和默认币种；绑定手机号默认 +86，可以自己改，不再跟地区锁死。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>地区 {{ regionTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeRegionCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-input
          v-model.trim="regionQuery.keyword"
          class="quick-settings-toolbar__search"
          clearable
          placeholder="搜索地区代码、显示名、币种"
          @clear="handleRegionSearch"
          @keyup.enter="handleRegionSearch"
        />
        <el-select
          v-model="regionQuery.status"
          class="quick-settings-toolbar__select"
          clearable
          placeholder="状态"
          @change="handleRegionSearch"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <AppButton variant="soft" @click="() => loadAppleRegions()">刷新</AppButton>
        <AppButton variant="primary" @click="openCreateRegion">新增地区</AppButton>
      </div>

      <el-table
        v-loading="regionLoading"
        class="desktop-data-table"
        :data="appleRegionDictionaries"
        :size="tableSize"
        row-key="id"
        @sort-change="handleRegionSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 Apple ID 地区</strong>
            <span>可以新增地区，后面新增 Apple ID 时就能直接选择。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearRegionFilters">清空筛选</AppButton>
              <AppButton variant="soft" @click="restoreDefaultAppleRegions">
                恢复默认地区
              </AppButton>
              <AppButton variant="primary" @click="openCreateRegion">新增地区</AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="code" label="国家/代码" width="140" sortable="custom">
          <template #default="{ row }">{{ getAppleRegionLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="label" label="显示名" min-width="150" sortable="custom" />
        <el-table-column label="币种" width="120">
          <template #default="{ row }">{{ getAppleRegionCurrency(row) }}</template>
        </el-table-column>
        <el-table-column label="手机号区号" width="130">
          <template #default="{ row }">{{ getAppleRegionDialCode(row) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" sortable="custom">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditRegion(row)">编辑</AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingRegionId === row.id"
                @click="toggleAppleRegionStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteAppleRegion(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="appleRegionDictionaries.length" class="mobile-record-list">
        <article
          v-for="region in appleRegionDictionaries"
          :key="region.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ getAppleRegionCurrencySummary(region) }}</strong>
              <span>{{ region.label }}</span>
            </div>
            <StatusTag :status="region.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>手机号区号</span>
              <strong>{{ getAppleRegionDialCode(region) }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(region.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditRegion(region)">编辑</AppButton>
            <AppButton
              size="small"
              :variant="region.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingRegionId === region.id"
              @click="toggleAppleRegionStatus(region)"
            >
              {{ region.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === region.id"
              @click="deleteAppleRegion(region)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <PaginationBar
        v-model:page="regionQuery.page"
        v-model:page-size="regionQuery.pageSize"
        :total="regionTotal"
        @change="() => loadAppleRegions()"
      />
    </section>

    <section
      v-if="isSourceOptionSectionActive('code-delivery-methods')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          title="兑换码发货方式"
          :help="[
            '这里管兑换码订单确认发货、售后补发时可以选择的发货方式。',
            '这些方式目前和后端发货记录字段绑定，所以只支持改名称、排序和停用，不随便新增系统不认识的方式。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>方式 {{ methodTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeMethodCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <AppButton variant="soft" @click="() => loadCodeDeliveryMethods()">刷新</AppButton>
      </div>

      <el-table
        v-loading="methodLoading"
        class="desktop-data-table"
        :data="codeDeliveryMethodDictionaries"
        :size="tableSize"
        row-key="id"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无发货方式</strong>
            <span>需要系统默认发货方式时，可以手动恢复默认项。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton
                variant="primary"
                @click="() => loadCodeDeliveryMethods({ force: true, restoreDefaults: true })"
              >
                恢复默认发货方式
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="code" label="方式代码" min-width="160" />
        <el-table-column prop="label" label="显示名称" min-width="180" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditMethod(row)">编辑</AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingMethodId === row.id"
                @click="toggleCodeDeliveryMethodStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteCodeDeliveryMethod(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="codeDeliveryMethodDictionaries.length" class="mobile-record-list">
        <article
          v-for="method in codeDeliveryMethodDictionaries"
          :key="method.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ method.label }}</strong>
              <span>{{ method.code }}</span>
            </div>
            <StatusTag :status="method.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ method.sortOrder }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(method.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditMethod(method)">编辑</AppButton>
            <AppButton
              size="small"
              :variant="method.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingMethodId === method.id"
              @click="toggleCodeDeliveryMethodStatus(method)"
            >
              {{ method.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === method.id"
              @click="deleteCodeDeliveryMethod(method)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="isSourceOptionSectionActive('code-delivery-modes')"
      class="content-panel common-compact-list-panel"
    >
      <div class="panel-title-row">
        <PanelTitleHelp
          title="兑换码业务发货模式"
          :help="[
            '这里管兑换码业务设置里的发货模式，比如自动、半自动、手工。',
            '这些模式和后端业务规则绑定，所以只支持改显示名称、排序和启停，不随便新增系统不认识的模式。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>模式 {{ deliveryModeTotal }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeDeliveryModeCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <AppButton variant="soft" @click="() => loadCodeServiceDeliveryModes()">刷新</AppButton>
      </div>

      <el-table
        v-loading="deliveryModeLoading"
        class="desktop-data-table"
        :data="codeServiceDeliveryModeDictionaries"
        :size="tableSize"
        row-key="id"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无发货模式</strong>
            <span>需要系统默认发货模式时，可以手动恢复默认项。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton
                variant="primary"
                @click="() => loadCodeServiceDeliveryModes({ force: true, restoreDefaults: true })"
              >
                恢复默认发货模式
              </AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="code" label="模式代码" min-width="160" />
        <el-table-column prop="label" label="显示名称" min-width="180" />
        <el-table-column prop="sortOrder" label="排序" width="100" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEditDeliveryMode(row)">
                编辑
              </AppButton>
              <AppButton
                size="small"
                :variant="row.status === 'active' ? 'danger' : 'soft'"
                :loading="updatingDeliveryModeId === row.id"
                @click="toggleCodeServiceDeliveryModeStatus(row)"
              >
                {{ row.status === 'active' ? '停用' : '启用' }}
              </AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingDictionaryId === row.id"
                @click="deleteCodeServiceDeliveryMode(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="codeServiceDeliveryModeDictionaries.length" class="mobile-record-list">
        <article
          v-for="mode in codeServiceDeliveryModeDictionaries"
          :key="mode.id"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ mode.label }}</strong>
              <span>{{ mode.code }}</span>
            </div>
            <StatusTag :status="mode.status" />
          </div>
          <div class="mobile-record-card__stats">
            <div>
              <span>排序</span>
              <strong>{{ mode.sortOrder }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(mode.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEditDeliveryMode(mode)">
              编辑
            </AppButton>
            <AppButton
              size="small"
              :variant="mode.status === 'active' ? 'danger' : 'soft'"
              :loading="updatingDeliveryModeId === mode.id"
              @click="toggleCodeServiceDeliveryModeStatus(mode)"
            >
              {{ mode.status === 'active' ? '停用' : '启用' }}
            </AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingDictionaryId === mode.id"
              @click="deleteCodeServiceDeliveryMode(mode)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingPlatform ? '编辑来源平台' : '新增来源平台'"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item prop="name">
          <template #label>
            <FieldHelpLabel
              label="平台名称"
              purpose="标记订单来源平台，订单录入、客户来源和报表筛选都会用到。"
              example="可以填微信私域、官网订单、线下转账。"
            />
          </template>
          <el-input v-model.trim="form.name" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="手续费率"
              purpose="平台按订单金额抽成的比例，系统用它自动计算平台手续费。"
              example="1% 填 0.01，0.6% 填 0.006；没有抽成就填 0。"
            />
          </template>
          <el-input v-model.trim="form.feeRate" placeholder="例如 0.006" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="固定手续费"
              purpose="每单固定扣掉的手续费，会和手续费率一起计入订单成本。"
              example="每单固定扣 0.5 元就填 0.5；没有固定费用填 0.00。"
            />
          </template>
          <el-input v-model.trim="form.feeFixed" placeholder="例如 0.00" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个来源平台是否还能在订单、客户和映射里选择。"
              example="还在使用选启用；不再接单的平台选停用。"
            />
          </template>
          <el-radio-group v-model="form.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录平台特殊规则或内部说明，不参与手续费自动计算。"
              example="可以写提现周期、特殊扣费规则、对账注意事项。"
            />
          </template>
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="savePlatform">保存</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="tagDialogVisible"
      :title="editingTag ? '编辑客户标签' : '新增客户标签'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form ref="tagFormRef" :model="tagForm" :rules="tagRules" label-position="top">
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="标签名称"
              purpose="客户标签的显示名称，用来给客户分类和搜索。"
              example="可以填大客户、官网客户、高频续费、售后关注。"
            />
          </template>
          <el-input v-model.trim="tagForm.label" placeholder="例如 大客户 / 官网客户" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="排序"
              purpose="控制标签在下拉列表里的显示顺序，数字越小越靠前。"
              example="常用标签填 1、2、3，不常用的可以填 100。"
            />
          </template>
          <el-input-number v-model="tagForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个客户标签是否还能被选择。"
              example="正在用的标签选启用，废弃标签选停用。"
            />
          </template>
          <el-radio-group v-model="tagForm.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个标签的使用规则，方便员工打标签时理解。"
              example="可以写只给复购 3 次以上客户使用。"
            />
          </template>
          <el-input v-model="tagForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="tagDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="tagSaving" @click="saveCustomerTag">
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryDialogVisible"
      :title="editingCategory ? '编辑 Apple ID 业务分类' : '新增 Apple ID 业务分类'"
      width="min(860px, calc(100vw - 24px))"
    >
      <el-form
        ref="categoryFormRef"
        :model="categoryForm"
        :rules="categoryRules"
        label-position="top"
      >
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="分类名称"
              purpose="Apple ID 业务设置里的分类名称，方便员工按业务类型找服务。"
              example="可以填 AI 会员、流媒体、工具订阅、云盘会员。"
            />
          </template>
          <el-input v-model.trim="categoryForm.label" placeholder="例如 AI 会员" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="排序"
              purpose="控制分类在业务设置下拉和分类按钮里的显示顺序，数字越小越靠前。"
              example="常用分类填 1、2、3，不常用的可以填 100。"
            />
          </template>
          <el-input-number v-model="categoryForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个分类是否还能被新业务选择。"
              example="正在使用选启用，废弃分类选停用。"
            />
          </template>
          <el-radio-group v-model="categoryForm.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个分类适合放哪些业务，避免员工随便新建重复分类。"
              example="可以写 ChatGPT、Claude、Midjourney 等 AI 工具放这里。"
            />
          </template>
          <el-input v-model="categoryForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>

      <section v-if="editingCategory" class="category-service-panel">
        <div class="category-service-panel__head">
          <div>
            <strong>使用中业务</strong>
            <span>这里直接显示正在使用这个分类的业务，可以编辑业务或删除业务。</span>
          </div>
          <div class="inline-actions">
            <StatusChip tone="blue">{{ categoryServicesTotal }} 个</StatusChip>
            <AppButton size="small" variant="soft" @click="() => loadCategoryServices()">
              刷新
            </AppButton>
          </div>
        </div>
        <el-table
          v-loading="categoryServicesLoading"
          class="desktop-data-table category-service-table"
          :data="categoryServices"
          size="small"
          row-key="id"
          empty-text="暂无业务使用这个分类"
        >
          <el-table-column label="业务" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <strong>{{ row.name }}</strong>
              <div class="muted-block">
                {{ getAppleServicePeriodLabel(row) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <StatusChip :tone="getAppleServiceStatusTone(row.status)" dot>
                {{ getAppleServiceStatusLabel(row.status) }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <div class="table-action-group">
                <AppButton size="small" variant="ghost" @click="openCategoryServiceEdit(row)">
                  编辑
                </AppButton>
                <AppButton
                  size="small"
                  variant="danger"
                  :loading="categoryServiceDeletingId === row.id"
                  @click="deleteCategoryService(row)"
                >
                  删除
                </AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </section>
      <template #footer>
        <AppButton @click="categoryDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="categorySaving" @click="saveAppleServiceCategory">
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryServicesDialogVisible"
      :title="
        activeCategoryForServices ? `使用中业务 · ${activeCategoryForServices.label}` : '使用中业务'
      "
      width="min(860px, calc(100vw - 24px))"
    >
      <div class="category-service-panel category-service-panel--plain">
        <div class="category-service-panel__head">
          <div>
            <strong>{{ categoryServicesTotal }} 个业务正在使用这个分类</strong>
            <span>分类删除前，需要先把这些业务改到其他分类或删除业务。</span>
          </div>
          <AppButton size="small" variant="soft" @click="() => loadCategoryServices()">
            刷新
          </AppButton>
        </div>
        <el-table
          v-loading="categoryServicesLoading"
          class="desktop-data-table category-service-table"
          :data="categoryServices"
          size="small"
          row-key="id"
          empty-text="暂无业务使用这个分类"
        >
          <el-table-column label="业务" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <strong>{{ row.name }}</strong>
              <div class="muted-block">
                {{ getAppleServicePeriodLabel(row) }}
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <StatusChip :tone="getAppleServiceStatusTone(row.status)" dot>
                {{ getAppleServiceStatusLabel(row.status) }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <div class="table-action-group">
                <AppButton size="small" variant="ghost" @click="openCategoryServiceEdit(row)">
                  编辑
                </AppButton>
                <AppButton
                  size="small"
                  variant="danger"
                  :loading="categoryServiceDeletingId === row.id"
                  @click="deleteCategoryService(row)"
                >
                  删除
                </AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <AppButton @click="categoryServicesDialogVisible = false">关闭</AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryServiceDialogVisible"
      :title="editingCategoryService ? `编辑业务 · ${editingCategoryService.name}` : '编辑业务'"
      width="min(640px, calc(100vw - 24px))"
    >
      <el-form
        ref="categoryServiceFormRef"
        :model="categoryServiceForm"
        :rules="categoryServiceRules"
        label-position="top"
      >
        <div class="form-grid">
          <el-form-item prop="name" label="业务名称">
            <el-input v-model.trim="categoryServiceForm.name" />
          </el-form-item>
          <el-form-item prop="category" label="业务分类">
            <el-select v-model="categoryServiceForm.category" class="full-input" filterable>
              <el-option
                v-for="category in categoryServiceEditCategoryOptions"
                :key="category.value"
                :label="category.label"
                :value="category.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item prop="officialBasePrice" label="官网价">
            <el-input v-model.trim="categoryServiceForm.officialBasePrice" />
          </el-form-item>
          <el-form-item prop="officialCostValue" label="Apple余额价">
            <el-input v-model.trim="categoryServiceForm.officialCostValue" />
          </el-form-item>
          <el-form-item prop="currency" label="币种">
            <el-input v-model.trim="categoryServiceForm.currency" />
          </el-form-item>
          <el-form-item label="业务周期">
            <div class="category-service-period-fields">
              <el-select v-model="categoryServiceForm.defaultPeriodType">
                <el-option label="按月" value="month" />
                <el-option label="按天" value="day" />
                <el-option label="手动" value="manual" />
              </el-select>
              <el-input-number v-model="categoryServiceForm.defaultPeriodValue" :min="1" />
            </div>
          </el-form-item>
          <el-form-item label="状态">
            <el-radio-group v-model="categoryServiceForm.status">
              <el-radio-button value="enabled">启用</el-radio-button>
              <el-radio-button value="paused">暂停</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="categoryServiceForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="categoryServiceDialogVisible = false">取消</AppButton>
        <AppButton
          variant="primary"
          :loading="
            Boolean(editingCategoryService && categoryServiceSavingId === editingCategoryService.id)
          "
          @click="saveCategoryService"
        >
          保存业务
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="appleServiceOptionDialogVisible"
      :title="`编辑 ${activeAppleServiceOptionGroup.title}`"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form
        ref="appleServiceOptionFormRef"
        :model="appleServiceOptionForm"
        :rules="appleServiceOptionRules"
        label-position="top"
      >
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="选项代码"
              purpose="系统真正识别的固定代码，只能看，不能随便改。"
              example="比如 month、by_month、global、rate。"
            />
          </template>
          <el-input v-model="appleServiceOptionForm.code" disabled />
        </el-form-item>
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="显示名称"
              purpose="员工在下拉里看到的名字，改这里不会改变系统内部规则。"
              example="可以把 by_month 显示成按月，也可以写自然月。"
            />
          </template>
          <el-input v-model.trim="appleServiceOptionForm.label" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="排序"
              purpose="控制这个选项在下拉里的顺序，数字越小越靠前。"
              example="最常用的填 0 或 1。"
            />
          </template>
          <el-input-number v-model="appleServiceOptionForm.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个选项还能不能被新业务选择。"
              example="不想员工再选某个旧规则，就停用；历史业务不受影响。"
            />
          </template>
          <el-radio-group v-model="appleServiceOptionForm.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个选项什么时候用，方便员工理解。"
              example="可以写多数月费业务用这个，特殊订单再手工。"
            />
          </template>
          <el-input v-model="appleServiceOptionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="appleServiceOptionDialogVisible = false">取消</AppButton>
        <AppButton
          variant="primary"
          :loading="appleServiceOptionSaving"
          @click="saveAppleServiceOption"
        >
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="notificationOptionDialogVisible"
      title="编辑通知选项"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form
        ref="notificationOptionFormRef"
        :model="notificationOptionForm"
        :rules="notificationOptionRules"
        label-position="top"
      >
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="选项代码"
              purpose="通知选项的系统代码，用于后端识别通知模块、级别或渠道。"
              example="比如 apple、warning、telegram。"
            />
          </template>
          <el-input v-model="notificationOptionForm.code" disabled />
        </el-form-item>
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="显示名称"
              purpose="员工在通知设置下拉里看到的名字，改这里不会改变系统内部规则。"
              example="可以把 warning 显示成警告，也可以写需要留意。"
            />
          </template>
          <el-input v-model.trim="notificationOptionForm.label" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="排序"
                purpose="控制这个选项在下拉里的顺序，数字越小越靠前。"
                example="最常用的填 0 或 1。"
              />
            </template>
            <el-input-number v-model="notificationOptionForm.sortOrder" :min="0" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="控制这个选项还能不能被新通知规则选择。"
                example="不想员工再选某个旧渠道或旧级别，就停用；历史通知不受影响。"
              />
            </template>
            <el-radio-group v-model="notificationOptionForm.status">
              <el-radio-button value="active">启用</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个选项什么时候用，方便员工理解。"
              example="可以写严重级别要立刻处理，Telegram 用于外部提醒。"
            />
          </template>
          <el-input v-model="notificationOptionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="notificationOptionDialogVisible = false">取消</AppButton>
        <AppButton
          variant="primary"
          :loading="notificationOptionSaving"
          @click="saveNotificationOption"
        >
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="systemOptionDialogVisible"
      title="编辑系统选项"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form
        ref="systemOptionFormRef"
        :model="systemOptionForm"
        :rules="systemOptionRules"
        label-position="top"
      >
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="选项代码"
              purpose="系统内部识别用的代码，不能随便改。"
              example="比如 admin、api、oauth、manual_token。"
            />
          </template>
          <el-input v-model="systemOptionForm.code" disabled />
        </el-form-item>
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="显示名称"
              purpose="员工在系统设置下拉里看到的名字。"
              example="可以把 manual_token 显示成手工凭证，也可以写托管凭证。"
            />
          </template>
          <el-input v-model.trim="systemOptionForm.label" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="排序"
                purpose="控制这个选项在下拉里的顺序，数字越小越靠前。"
                example="常用选项填 0 或 1。"
              />
            </template>
            <el-input-number v-model="systemOptionForm.sortOrder" :min="0" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="控制这个选项还能不能被新配置选择。"
                example="暂时不让员工选择某种授权方式，就停用；历史配置不受影响。"
              />
            </template>
            <el-radio-group v-model="systemOptionForm.status">
              <el-radio-button value="active">启用</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个选项适合什么场景，方便员工选择。"
              example="可以写 API 用于程序调用，OAuth 用于开放平台授权。"
            />
          </template>
          <el-input v-model="systemOptionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="systemOptionDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="systemOptionSaving" @click="saveSystemOption">
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="deliveryModeDialogVisible"
      title="编辑兑换码业务发货模式"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form
        ref="deliveryModeFormRef"
        :model="deliveryModeForm"
        :rules="deliveryModeRules"
        label-position="top"
      >
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="模式代码"
              purpose="发货模式的系统代码，用于业务规则识别，通常不允许手动修改。"
              example="auto 表示自动，semi_auto 表示半自动，manual 表示手工。"
            />
          </template>
          <el-input v-model="deliveryModeForm.code" disabled />
        </el-form-item>
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="显示名称"
              purpose="员工在兑换码业务设置里看到的发货模式名称。"
              example="可以填自动、半自动、手工。"
            />
          </template>
          <el-input v-model.trim="deliveryModeForm.label" placeholder="例如 半自动" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="排序"
                purpose="控制发货模式在下拉列表中的顺序，数字越小越靠前。"
                example="常用模式填 1，不常用模式填 100。"
              />
            </template>
            <el-input-number v-model="deliveryModeForm.sortOrder" :min="0" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="控制这种发货模式是否还能被新业务选择。"
                example="正在使用选启用，暂时不让选就停用。"
              />
            </template>
            <el-radio-group v-model="deliveryModeForm.status">
              <el-radio-button value="active">启用</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这种发货模式适合什么业务，方便员工选择。"
              example="可以写平台可自动处理时用自动，需要人工确认时用半自动。"
            />
          </template>
          <el-input v-model="deliveryModeForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="deliveryModeDialogVisible = false">取消</AppButton>
        <AppButton
          variant="primary"
          :loading="deliveryModeSaving"
          @click="saveCodeServiceDeliveryMode"
        >
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="methodDialogVisible"
      title="编辑兑换码发货方式"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form ref="methodFormRef" :model="methodForm" :rules="methodRules" label-position="top">
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="方式代码"
              purpose="发货方式的系统代码，用于业务逻辑识别，通常不允许手动修改。"
              example="manual 表示手工发货，eticket 表示电子凭证。"
            />
          </template>
          <el-input v-model="methodForm.code" disabled />
        </el-form-item>
        <el-form-item prop="label">
          <template #label>
            <FieldHelpLabel
              label="显示名称"
              purpose="员工在下拉框里看到的发货方式名称。"
              example="可以填手工发货、电子凭证、虚拟无需物流。"
            />
          </template>
          <el-input v-model.trim="methodForm.label" placeholder="例如 手工发货" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="排序"
                purpose="控制发货方式在下拉列表中的顺序，数字越小越靠前。"
                example="最常用方式填 1，不常用方式填 100。"
              />
            </template>
            <el-input-number v-model="methodForm.sortOrder" :min="0" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="控制这种发货方式是否还能被选择。"
                example="正在使用选启用，废弃方式选停用。"
              />
            </template>
            <el-radio-group v-model="methodForm.status">
              <el-radio-button value="active">启用</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这种发货方式的使用场景或注意事项。"
              example="可以写只用于手工复制、需要人工确认、暂不自动发货。"
            />
          </template>
          <el-input v-model="methodForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="methodDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="methodSaving" @click="saveCodeDeliveryMethod">
          保存
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="regionDialogVisible"
      :title="editingRegion ? '编辑 Apple ID 地区' : '新增 Apple ID 地区'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form ref="regionFormRef" :model="regionForm" :rules="regionRules" label-position="top">
        <div class="form-grid">
          <el-form-item prop="code">
            <template #label>
              <FieldHelpLabel
                label="地区代码"
                purpose="Apple ID 所属地区的代码，新增 Apple ID 时会作为地区选项。"
                example="美国区填 US，香港区填 HK，日本区填 JP。"
              />
            </template>
            <el-input
              v-model.trim="regionForm.code"
              :disabled="Boolean(editingRegion)"
              placeholder="例如 US"
            />
          </el-form-item>
          <el-form-item prop="label">
            <template #label>
              <FieldHelpLabel
                label="显示名"
                purpose="给员工看的地区名称，比代码更容易识别。"
                example="US 可以显示为 美国区 或 us；保持团队习惯一致即可。"
              />
            </template>
            <el-input v-model.trim="regionForm.label" placeholder="例如 us" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="currency">
            <template #label>
              <FieldHelpLabel
                label="币种"
                purpose="这个地区 Apple ID 默认使用的余额币种，影响业务匹配和成本展示。"
                example="美国区填 USD，香港区填 HKD，中国区填 CNY。"
              />
            </template>
            <el-input v-model.trim="regionForm.currency" placeholder="例如 USD" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="手机号区号"
                purpose="新增 Apple ID 资料时给手机号字段提供默认区号提示。"
                example="中国手机号填 +86，美国手机号填 +1；不确定可以留空后手动填手机号。"
              />
            </template>
            <el-input v-model.trim="regionForm.dialCode" placeholder="+86" />
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="手机号示例"
              purpose="给员工展示这个地区手机号应该怎么写，减少录入格式混乱。"
              example="中国手机号可以写 +86 138 0013 8000，美国手机号可以写 +1 202 555 0136。"
            />
          </template>
          <el-input v-model.trim="regionForm.phoneExample" placeholder="+86 138 0013 8000" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="排序"
                purpose="控制地区选项在下拉列表里的顺序，数字越小越靠前。"
                example="最常用地区填 1、2、3，少用地区填 100。"
              />
            </template>
            <el-input-number v-model="regionForm.sortOrder" :min="0" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="状态"
                purpose="控制这个 Apple ID 地区是否还能被选择。"
                example="还在使用的地区选启用，暂时不用的地区选停用。"
              />
            </template>
            <el-radio-group v-model="regionForm.status">
              <el-radio-button value="active">启用</el-radio-button>
              <el-radio-button value="disabled">停用</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="记录这个地区的特殊说明，方便员工录入 Apple ID 时判断。"
              example="可以写该地区常用币种、手机号格式或注意事项。"
            />
          </template>
          <el-input v-model="regionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="regionDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="regionSaving" @click="saveAppleRegion">
          保存
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type Ref
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  appleServicesApi,
  dataCenterApi,
  sourcePlatformsApi,
  userTableViewsApi
} from '@/api/system';
import type { DataDictionaryQuery, SourcePlatformQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import {
  APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
  APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
  buildQuickSettingCode,
  CODE_DELIVERY_METHOD_DICTIONARY_GROUP,
  CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP,
  CUSTOMER_TAG_DICTIONARY_GROUP
} from '@/config/quickSettings';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  AppleServiceRegionPrice,
  DataDictionary,
  DataDictionaryStatus,
  PageResult,
  AppleService,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  encodeAppleAccountRegionValue,
  formatAppleRegionCurrencyLabel,
  formatAppleRegionLabel,
  getDefaultAppleAccountRegionDictionaries,
  parseAppleAccountRegionDictionary
} from '@/utils/appleAccountRegion';
import {
  appleServiceQuickOptionGroups,
  getDefaultAppleServiceQuickOptionDictionaries,
  isAppleServiceQuickOptionCode,
  type AppleServiceQuickOptionGroupKey
} from '@/utils/appleServiceOptions';
import {
  getDefaultCodeDeliveryMethodDictionaries,
  isCodeDeliveryMethod
} from '@/utils/codeDeliveryMethods';
import {
  getDefaultCodeServiceDeliveryModeDictionaries,
  isCodeServiceDeliveryMode
} from '@/utils/codeServiceDeliveryModes';
import {
  getDefaultNotificationQuickOptionDictionaries,
  isNotificationQuickOptionCode,
  notificationQuickOptionGroups,
  type NotificationQuickOptionGroupKey
} from '@/utils/notificationOptions';
import {
  getDefaultSystemQuickOptionDictionaries,
  isSystemQuickOptionCode,
  systemQuickOptionGroups,
  type SystemQuickOptionGroupKey
} from '@/utils/systemQuickOptions';
import {
  createSmartQueryKey,
  invalidateSmartQueries,
  refreshSmartQueryResource
} from '@/utils/smartQuery';
import { exportRowsToCsv } from '@/utils/exportCsv';

const tableKey = 'source_platforms';
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const appleServiceDependentQueryScopes = [
  'apple-services',
  'order-entry-base',
  'data-dictionaries'
];
const platformColumnOptions = [
  { label: '平台名称', value: 'name', required: true },
  { label: '费率', value: 'feeRate' },
  { label: '固定费用', value: 'feeFixed' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];
const sourceOptionSections = [
  {
    key: 'platforms',
    label: '来源平台',
    route: '/system/source-platforms/platforms'
  },
  {
    key: 'customer-tags',
    label: '客户标签',
    route: '/system/source-platforms/customer-tags'
  },
  {
    key: 'apple-service-categories',
    label: 'Apple ID 分类',
    route: '/system/source-platforms/apple-service-categories'
  },
  {
    key: 'apple-regions',
    label: '地区币种',
    route: '/system/source-platforms/apple-regions'
  },
  {
    key: 'apple-service-options',
    label: 'ID 业务选项',
    route: '/system/source-platforms/apple-service-options'
  },
  {
    key: 'code-delivery-methods',
    label: '兑换码发货方式',
    route: '/system/source-platforms/code-delivery-methods'
  },
  {
    key: 'code-delivery-modes',
    label: '兑换码发货模式',
    route: '/system/source-platforms/code-delivery-modes'
  },
  {
    key: 'notification-options',
    label: '通知选项',
    route: '/system/source-platforms/notification-options'
  },
  {
    key: 'system-options',
    label: '系统与平台选项',
    route: '/system/source-platforms/system-options'
  }
] as const;
type SourceOptionSectionKey = (typeof sourceOptionSections)[number]['key'];
type SourceOptionSectionRoute = (typeof sourceOptionSections)[number]['route'];
type DictionaryLoadOptions = {
  background?: boolean;
  force?: boolean;
  restoreDefaults?: boolean;
};
type DictionaryDeleteContext = {
  entityLabel: string;
  confirmDetail: string;
  displayName?: string;
  beforeReload?: () => void;
  reload: () => Promise<void>;
};
const sourceOptionSectionKeys = new Set<SourceOptionSectionKey>(
  sourceOptionSections.map((section) => section.key)
);

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const tagLoading = ref(false);
const tagSaving = ref(false);
const categoryLoading = ref(false);
const categorySaving = ref(false);
const appleServiceOptionLoading = ref(false);
const appleServiceOptionSaving = ref(false);
const notificationOptionLoading = ref(false);
const notificationOptionSaving = ref(false);
const systemOptionLoading = ref(false);
const systemOptionSaving = ref(false);
const regionLoading = ref(false);
const regionSaving = ref(false);
const methodLoading = ref(false);
const methodSaving = ref(false);
const deliveryModeLoading = ref(false);
const deliveryModeSaving = ref(false);
const deletingPlatformId = ref('');
const deletingDictionaryId = ref('');
const updatingTagId = ref('');
const updatingCategoryId = ref('');
const updatingAppleServiceOptionId = ref('');
const updatingNotificationOptionId = ref('');
const updatingSystemOptionId = ref('');
const updatingRegionId = ref('');
const updatingMethodId = ref('');
const updatingDeliveryModeId = ref('');
const dialogVisible = ref(false);
const tagDialogVisible = ref(false);
const categoryDialogVisible = ref(false);
const appleServiceOptionDialogVisible = ref(false);
const notificationOptionDialogVisible = ref(false);
const systemOptionDialogVisible = ref(false);
const regionDialogVisible = ref(false);
const methodDialogVisible = ref(false);
const deliveryModeDialogVisible = ref(false);
const editingPlatform = ref<SourcePlatform | null>(null);
const editingTag = ref<DataDictionary | null>(null);
const editingCategory = ref<DataDictionary | null>(null);
const editingCategoryService = ref<AppleService | null>(null);
const editingAppleServiceOption = ref<DataDictionary | null>(null);
const editingAppleServiceOptionGroup = ref<AppleServiceQuickOptionGroupKey>('periodType');
const editingNotificationOption = ref<DataDictionary | null>(null);
const editingNotificationOptionGroup = ref<NotificationQuickOptionGroupKey>('module');
const editingSystemOption = ref<DataDictionary | null>(null);
const editingSystemOptionGroup = ref<SystemQuickOptionGroupKey>('ipScope');
const editingRegion = ref<DataDictionary | null>(null);
const editingMethod = ref<DataDictionary | null>(null);
const editingDeliveryMode = ref<DataDictionary | null>(null);
const formRef = ref<FormInstance>();
const tagFormRef = ref<FormInstance>();
const categoryFormRef = ref<FormInstance>();
const categoryServiceFormRef = ref<FormInstance>();
const appleServiceOptionFormRef = ref<FormInstance>();
const notificationOptionFormRef = ref<FormInstance>();
const systemOptionFormRef = ref<FormInstance>();
const regionFormRef = ref<FormInstance>();
const methodFormRef = ref<FormInstance>();
const deliveryModeFormRef = ref<FormInstance>();
const platforms = ref<SourcePlatform[]>([]);
const customerTags = ref<DataDictionary[]>([]);
const appleServiceCategories = ref<DataDictionary[]>([]);
const appleServiceOptionDictionaries = reactive<
  Record<AppleServiceQuickOptionGroupKey, DataDictionary[]>
>({
  periodType: [],
  expireCalcType: [],
  lockRule: [],
  platformFeeType: []
});
const notificationOptionDictionaries = reactive<
  Record<NotificationQuickOptionGroupKey, DataDictionary[]>
>({
  module: [],
  level: [],
  channel: []
});
const systemOptionDictionaries = reactive<Record<SystemQuickOptionGroupKey, DataDictionary[]>>({
  ipScope: [],
  platformAuthMode: [],
  announcementLevel: [],
  versionStatus: [],
  backupType: [],
  importModule: [],
  exportModule: [],
  opsErrorLevel: [],
  attachmentBusinessModule: [],
  attachmentPurpose: []
});
const appleRegionDictionaries = ref<DataDictionary[]>([]);
const codeDeliveryMethodDictionaries = ref<DataDictionary[]>([]);
const codeServiceDeliveryModeDictionaries = ref<DataDictionary[]>([]);
const selectedPlatforms = ref<SourcePlatform[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const tagTotal = ref(0);
const categoryTotal = ref(0);
const categoryUsageCounts = ref<Record<string, number>>({});
const categoryOrderOptionCounts = ref<Record<string, number>>({});
const categoryServicesDialogVisible = ref(false);
const categoryServiceDialogVisible = ref(false);
const categoryServicesLoading = ref(false);
const categoryServiceSavingId = ref('');
const categoryServiceDeletingId = ref('');
const activeCategoryForServices = ref<DataDictionary | null>(null);
const categoryServices = ref<AppleService[]>([]);
const categoryServicesTotal = ref(0);
const regionTotal = ref(0);
const methodTotal = ref(0);
const deliveryModeTotal = ref(0);
const activePlatformsQueryKey = ref('');
const activeCustomerTagsQueryKey = ref('');
const activeAppleServiceCategoriesQueryKey = ref('');
const activeAppleServiceOptionQueryKeys = reactive<Record<AppleServiceQuickOptionGroupKey, string>>(
  {
    periodType: '',
    expireCalcType: '',
    lockRule: '',
    platformFeeType: ''
  }
);
const activeNotificationOptionQueryKeys = reactive<Record<NotificationQuickOptionGroupKey, string>>(
  {
    module: '',
    level: '',
    channel: ''
  }
);
const activeSystemOptionQueryKeys = reactive<Record<SystemQuickOptionGroupKey, string>>({
  ipScope: '',
  platformAuthMode: '',
  announcementLevel: '',
  versionStatus: '',
  backupType: '',
  importModule: '',
  exportModule: '',
  opsErrorLevel: '',
  attachmentBusinessModule: '',
  attachmentPurpose: ''
});
const activeAppleRegionsQueryKey = ref('');
const activeCodeDeliveryMethodsQueryKey = ref('');
const activeCodeServiceDeliveryModesQueryKey = ref('');
let categoryUsageRequestId = 0;

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const tagQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as DataDictionaryStatus | '',
  sortBy: '',
  sortOrder: '' as 'asc' | 'desc' | ''
});

const categoryQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as DataDictionaryStatus | '',
  sortBy: '',
  sortOrder: '' as 'asc' | 'desc' | ''
});

const regionQuery = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '' as DataDictionaryStatus | '',
  sortBy: 'sortOrder',
  sortOrder: 'asc' as 'asc' | 'desc' | ''
});

const selectedAppleServiceOptionGroup = ref<AppleServiceQuickOptionGroupKey>('periodType');
const selectedNotificationOptionGroup = ref<NotificationQuickOptionGroupKey>('module');
const selectedSystemOptionGroup = ref<SystemQuickOptionGroupKey>('ipScope');

const form = reactive({
  name: '',
  feeRate: '0',
  feeFixed: '0',
  status: 'active' as 'active' | 'disabled',
  remark: ''
});

const tagForm = reactive({
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const categoryForm = reactive({
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const categoryServiceForm = reactive({
  name: '',
  category: '',
  officialBasePrice: '0',
  officialCostValue: '0',
  currency: 'USD',
  defaultPeriodType: 'month' as AppleService['defaultPeriodType'],
  defaultPeriodValue: 1,
  status: 'enabled' as AppleService['status'],
  remark: ''
});

const appleServiceOptionForm = reactive({
  code: '',
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const notificationOptionForm = reactive({
  code: '',
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const systemOptionForm = reactive({
  code: '',
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const regionForm = reactive({
  code: 'US',
  label: 'us',
  currency: 'USD',
  dialCode: '+86',
  phoneExample: '+86 138 0013 8000',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const methodForm = reactive({
  code: '',
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const deliveryModeForm = reactive({
  code: '',
  label: '',
  sortOrder: 0,
  status: 'active' as DataDictionaryStatus,
  remark: ''
});

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const activePlatformCount = computed(
  () => platforms.value.filter((platform) => platform.status === 'active').length
);
const activeTagCount = computed(
  () => customerTags.value.filter((tag) => tag.status === 'active').length
);
const activeCategoryCount = computed(
  () => appleServiceCategories.value.filter((category) => category.status === 'active').length
);
const categoryServiceEditCategoryOptions = computed(() => {
  const optionMap = new Map<string, { label: string; value: string }>();

  for (const category of appleServiceCategories.value) {
    const value = getAppleServiceCategoryValue(category);
    if (category.status !== 'active' && value !== categoryServiceForm.category) {
      continue;
    }
    optionMap.set(value, { label: category.label, value });
  }

  if (categoryServiceForm.category && !optionMap.has(categoryServiceForm.category)) {
    optionMap.set(categoryServiceForm.category, {
      label: categoryServiceForm.category,
      value: categoryServiceForm.category
    });
  }

  return [...optionMap.values()];
});
const activeAppleServiceOptionGroup = computed(
  () =>
    appleServiceQuickOptionGroups.find(
      (group) => group.key === selectedAppleServiceOptionGroup.value
    ) ?? appleServiceQuickOptionGroups[0]
);
const currentAppleServiceOptionDictionaries = computed(
  () => appleServiceOptionDictionaries[selectedAppleServiceOptionGroup.value]
);
const appleServiceOptionTotal = computed(() => currentAppleServiceOptionDictionaries.value.length);
const activeAppleServiceOptionCount = computed(
  () =>
    currentAppleServiceOptionDictionaries.value.filter((option) => option.status === 'active')
      .length
);
const activeNotificationOptionGroup = computed(
  () =>
    notificationQuickOptionGroups.find(
      (group) => group.key === selectedNotificationOptionGroup.value
    ) ?? notificationQuickOptionGroups[0]
);
const currentNotificationOptionDictionaries = computed(
  () => notificationOptionDictionaries[selectedNotificationOptionGroup.value]
);
const notificationOptionTotal = computed(() => currentNotificationOptionDictionaries.value.length);
const activeNotificationOptionCount = computed(
  () =>
    currentNotificationOptionDictionaries.value.filter((option) => option.status === 'active')
      .length
);
const activeSystemOptionGroup = computed(
  () =>
    systemQuickOptionGroups.find((group) => group.key === selectedSystemOptionGroup.value) ??
    systemQuickOptionGroups[0]
);
const currentSystemOptionDictionaries = computed(
  () => systemOptionDictionaries[selectedSystemOptionGroup.value]
);
const systemOptionTotal = computed(() => currentSystemOptionDictionaries.value.length);
const activeSystemOptionCount = computed(
  () => currentSystemOptionDictionaries.value.filter((option) => option.status === 'active').length
);
const activeRegionCount = computed(
  () => appleRegionDictionaries.value.filter((region) => region.status === 'active').length
);
const activeMethodCount = computed(
  () => codeDeliveryMethodDictionaries.value.filter((method) => method.status === 'active').length
);
const activeDeliveryModeCount = computed(
  () => codeServiceDeliveryModeDictionaries.value.filter((mode) => mode.status === 'active').length
);
const filterChips = computed<Array<{ key: string; label: string; value: string }>>(() => []);
const activeSourceOptionSectionKey = computed<SourceOptionSectionKey>(() => {
  const sectionKey = route.meta.sourceOptionSection;

  return isSourceOptionSectionKey(sectionKey) ? sectionKey : 'platforms';
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入平台名称', trigger: 'blur' }]
};

const tagRules: FormRules<typeof tagForm> = {
  label: [{ required: true, message: '请输入标签名称', trigger: 'blur' }]
};

const categoryRules: FormRules<typeof categoryForm> = {
  label: [{ required: true, message: '请输入分类名称', trigger: 'blur' }]
};

const categoryServiceRules: FormRules<typeof categoryServiceForm> = {
  name: [{ required: true, message: '请输入业务名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择业务分类', trigger: 'change' }],
  officialBasePrice: [{ required: true, message: '请输入官网价', trigger: 'blur' }],
  officialCostValue: [{ required: true, message: '请输入 Apple余额价', trigger: 'blur' }],
  currency: [{ required: true, message: '请输入币种', trigger: 'blur' }]
};

const appleServiceOptionRules: FormRules<typeof appleServiceOptionForm> = {
  label: [{ required: true, message: '请输入显示名称', trigger: 'blur' }]
};

const notificationOptionRules: FormRules<typeof notificationOptionForm> = {
  label: [{ required: true, message: '请输入显示名称', trigger: 'blur' }]
};

const systemOptionRules: FormRules<typeof systemOptionForm> = {
  label: [{ required: true, message: '请输入显示名称', trigger: 'blur' }]
};

const regionRules: FormRules<typeof regionForm> = {
  code: [{ required: true, message: '请输入地区代码', trigger: 'blur' }],
  label: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
  currency: [{ required: true, message: '请输入币种', trigger: 'blur' }]
};

const methodRules: FormRules<typeof methodForm> = {
  label: [{ required: true, message: '请输入显示名称', trigger: 'blur' }]
};

const deliveryModeRules: FormRules<typeof deliveryModeForm> = {
  label: [{ required: true, message: '请输入显示名称', trigger: 'blur' }]
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getAppleRegionOption(region: DataDictionary) {
  return parseAppleAccountRegionDictionary(region);
}

function getAppleRegionCurrency(region: DataDictionary) {
  return getAppleRegionOption(region).currency;
}

function getAppleRegionLabel(region: DataDictionary) {
  const option = getAppleRegionOption(region);
  return formatAppleRegionLabel(option.code, [option]);
}

function getAppleRegionCurrencySummary(region: DataDictionary) {
  const option = getAppleRegionOption(region);
  return formatAppleRegionCurrencyLabel(option.code, option.currency, [option]);
}

function getAppleRegionDialCode(region: DataDictionary) {
  return getAppleRegionOption(region).dialCode;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function isSourceOptionSectionKey(value: unknown): value is SourceOptionSectionKey {
  return typeof value === 'string' && sourceOptionSectionKeys.has(value as SourceOptionSectionKey);
}

function isSourceOptionSectionActive(sectionKey: SourceOptionSectionKey) {
  return activeSourceOptionSectionKey.value === sectionKey;
}

async function goToSourceOptionSection(routePath: SourceOptionSectionRoute) {
  if (route.path === routePath) {
    return;
  }

  await router.push(routePath);
}

function buildPlatformParams(): SourcePlatformQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyPlatformResult(data: PageResult<SourcePlatform>) {
  platforms.value = data.items;
  total.value = data.total;
}

function buildCustomerTagParams(): DataDictionaryQuery {
  return {
    page: tagQuery.page,
    pageSize: tagQuery.pageSize,
    keyword: tagQuery.keyword || undefined,
    group: CUSTOMER_TAG_DICTIONARY_GROUP,
    status: tagQuery.status,
    sortBy: tagQuery.sortBy || undefined,
    sortOrder: tagQuery.sortOrder
  };
}

function buildAppleServiceCategoryParams(): DataDictionaryQuery {
  return {
    page: categoryQuery.page,
    pageSize: categoryQuery.pageSize,
    keyword: categoryQuery.keyword || undefined,
    group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
    status: categoryQuery.status,
    sortBy: categoryQuery.sortBy || undefined,
    sortOrder: categoryQuery.sortOrder
  };
}

function getAppleServiceOptionGroup(groupKey: AppleServiceQuickOptionGroupKey) {
  return (
    appleServiceQuickOptionGroups.find((group) => group.key === groupKey) ??
    appleServiceQuickOptionGroups[0]
  );
}

function buildAppleServiceOptionParams(
  groupKey: AppleServiceQuickOptionGroupKey
): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: getAppleServiceOptionGroup(groupKey).group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function getNotificationOptionGroup(groupKey: NotificationQuickOptionGroupKey) {
  return (
    notificationQuickOptionGroups.find((group) => group.key === groupKey) ??
    notificationQuickOptionGroups[0]
  );
}

function buildNotificationOptionParams(
  groupKey: NotificationQuickOptionGroupKey
): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: getNotificationOptionGroup(groupKey).group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function getSystemOptionGroup(groupKey: SystemQuickOptionGroupKey) {
  return (
    systemQuickOptionGroups.find((group) => group.key === groupKey) ?? systemQuickOptionGroups[0]
  );
}

function buildSystemOptionParams(groupKey: SystemQuickOptionGroupKey): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: getSystemOptionGroup(groupKey).group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function buildAppleRegionParams(): DataDictionaryQuery {
  return {
    page: regionQuery.page,
    pageSize: regionQuery.pageSize,
    keyword: regionQuery.keyword || undefined,
    group: APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
    status: regionQuery.status,
    sortBy: regionQuery.sortBy || undefined,
    sortOrder: regionQuery.sortOrder
  };
}

function buildCodeDeliveryMethodParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: CODE_DELIVERY_METHOD_DICTIONARY_GROUP,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function buildCodeServiceDeliveryModeParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function applyCustomerTagResult(data: PageResult<DataDictionary>) {
  customerTags.value = data.items;
  tagTotal.value = data.total;
}

function applyAppleServiceCategoryResult(data: PageResult<DataDictionary>) {
  appleServiceCategories.value = data.items;
  categoryTotal.value = data.total;
  void loadAppleServiceCategoryUsageCounts(data.items);
}

function normalizeAppleServiceCategoryValue(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized === 'default') {
    return '通用';
  }
  return normalized;
}

function getAppleServiceCategoryValue(category: DataDictionary) {
  return normalizeAppleServiceCategoryValue(category.value || category.label);
}

function getCategoryUsageCount(category: DataDictionary) {
  return categoryUsageCounts.value[category.id] ?? 0;
}

function getCategoryOrderOptionCount(category: DataDictionary) {
  return categoryOrderOptionCounts.value[category.id] ?? 0;
}

async function loadAppleServiceCategoryUsageCounts(categories: DataDictionary[]) {
  const requestId = ++categoryUsageRequestId;
  if (!categories.length) {
    categoryUsageCounts.value = {};
    categoryOrderOptionCounts.value = {};
    return;
  }

  try {
    const [usageEntries, orderOptionData] = await Promise.all([
      Promise.all(
        categories.map(async (category) => {
          const result = await appleServicesApi.list({
            page: 1,
            pageSize: 1,
            category: getAppleServiceCategoryValue(category)
          });
          return [category.id, result.total] as const;
        })
      ),
      appleServicesApi.listOrderOptions()
    ]);

    const orderOptionCounts = buildCategoryOrderOptionCounts(categories, orderOptionData.items);

    if (requestId === categoryUsageRequestId) {
      categoryUsageCounts.value = Object.fromEntries(usageEntries);
      categoryOrderOptionCounts.value = orderOptionCounts;
    }
  } catch (error) {
    if (requestId === categoryUsageRequestId) {
      categoryUsageCounts.value = {};
      categoryOrderOptionCounts.value = {};
    }
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 业务分类使用数失败');
  }
}

function buildCategoryOrderOptionCounts(
  categories: DataDictionary[],
  prices: AppleServiceRegionPrice[]
) {
  const categoryIdByValue = new Map(
    categories.map((category) => [getAppleServiceCategoryValue(category), category.id])
  );
  const counts: Record<string, number> = {};

  for (const price of prices) {
    const categoryValue = normalizeAppleServiceCategoryValue(
      price.category || price.service?.category
    );
    const categoryId = categoryIdByValue.get(categoryValue);
    if (!categoryId) continue;
    counts[categoryId] = (counts[categoryId] ?? 0) + 1;
  }

  return counts;
}

function invalidateAppleServiceConsumers() {
  for (const scope of appleServiceDependentQueryScopes) {
    invalidateSmartQueries(scope);
  }
}

async function loadCategoryServices(category = activeCategoryForServices.value) {
  if (!category) {
    categoryServices.value = [];
    categoryServicesTotal.value = 0;
    return;
  }

  activeCategoryForServices.value = category;
  categoryServicesLoading.value = true;
  try {
    const result = await appleServicesApi.list({
      page: 1,
      pageSize: 100,
      category: getAppleServiceCategoryValue(category),
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });
    categoryServices.value = result.items;
    categoryServicesTotal.value = result.total;
    categoryUsageCounts.value = {
      ...categoryUsageCounts.value,
      [category.id]: result.total
    };
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载使用中业务失败');
  } finally {
    categoryServicesLoading.value = false;
  }
}

function openCategoryServices(category: DataDictionary) {
  activeCategoryForServices.value = category;
  categoryServicesDialogVisible.value = true;
  void loadCategoryServices(category);
}

function openCategoryServiceEdit(service: AppleService) {
  editingCategoryService.value = service;
  categoryServiceForm.name = service.name;
  categoryServiceForm.category = normalizeAppleServiceCategoryValue(service.category);
  categoryServiceForm.officialBasePrice = service.officialBasePrice;
  categoryServiceForm.officialCostValue = service.officialCostValue;
  categoryServiceForm.currency = service.currency;
  categoryServiceForm.defaultPeriodType = service.defaultPeriodType;
  categoryServiceForm.defaultPeriodValue = service.defaultPeriodValue;
  categoryServiceForm.status = service.status;
  categoryServiceForm.remark = service.remark ?? '';
  categoryServiceDialogVisible.value = true;
  void nextTick(() => categoryServiceFormRef.value?.clearValidate());
}

function getAppleServiceStatusLabel(status: AppleService['status']) {
  const labels: Record<AppleService['status'], string> = {
    enabled: '启用',
    paused: '暂停',
    disabled: '停用'
  };
  return labels[status] ?? status;
}

function getAppleServiceStatusTone(status: AppleService['status']) {
  if (status === 'enabled') return 'green';
  if (status === 'paused') return 'orange';
  return 'neutral';
}

function getAppleServicePeriodLabel(
  service: Pick<AppleService, 'defaultPeriodType' | 'defaultPeriodValue'>
) {
  if (service.defaultPeriodType === 'day') {
    return `${service.defaultPeriodValue} 天`;
  }
  if (service.defaultPeriodType === 'manual') {
    return '手动';
  }
  return `${service.defaultPeriodValue} 个月`;
}

function applyAppleServiceOptionResult(
  groupKey: AppleServiceQuickOptionGroupKey,
  data: PageResult<DataDictionary>
) {
  appleServiceOptionDictionaries[groupKey] = data.items.filter((item) =>
    isAppleServiceQuickOptionCode(groupKey, item.code)
  );
}

function applyNotificationOptionResult(
  groupKey: NotificationQuickOptionGroupKey,
  data: PageResult<DataDictionary>
) {
  notificationOptionDictionaries[groupKey] = data.items.filter((item) =>
    isNotificationQuickOptionCode(groupKey, item.code)
  );
}

function applySystemOptionResult(
  groupKey: SystemQuickOptionGroupKey,
  data: PageResult<DataDictionary>
) {
  systemOptionDictionaries[groupKey] = data.items.filter((item) =>
    isSystemQuickOptionCode(groupKey, item.code)
  );
}

function applyAppleRegionResult(data: PageResult<DataDictionary>) {
  appleRegionDictionaries.value = data.items;
  regionTotal.value = data.total;
}

function applyCodeDeliveryMethodResult(data: PageResult<DataDictionary>) {
  codeDeliveryMethodDictionaries.value = data.items.filter((item) =>
    isCodeDeliveryMethod(item.code)
  );
  methodTotal.value = codeDeliveryMethodDictionaries.value.length;
}

function applyCodeServiceDeliveryModeResult(data: PageResult<DataDictionary>) {
  codeServiceDeliveryModeDictionaries.value = data.items.filter((item) =>
    isCodeServiceDeliveryMode(item.code)
  );
  deliveryModeTotal.value = codeServiceDeliveryModeDictionaries.value.length;
}

interface SourceOptionResourceConfig<TData> {
  key: string;
  activeKey: Ref<string>;
  loading?: Ref<boolean>;
  options: DictionaryLoadOptions;
  cancelScope: string;
  fetcher: (signal: AbortSignal) => Promise<TData>;
  apply: (data: TData) => void;
  errorMessage: string;
  isCurrent?: () => boolean;
}

async function loadSourceOptionResource<TData>({
  key,
  activeKey,
  loading: loadingRef,
  options,
  cancelScope,
  fetcher,
  apply,
  errorMessage,
  isCurrent
}: SourceOptionResourceConfig<TData>) {
  activeKey.value = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => fetcher(signal),
      apply,
      background: options.background,
      cancelPreviousMatching: options.force ? cancelScope : undefined,
      isCurrent: () => (isCurrent?.() ?? true) && activeKey.value === key,
      setLoading: loadingRef
        ? (value) => {
            loadingRef.value = value;
          }
        : undefined,
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : errorMessage);
    }
  }
}

interface GroupedSourceOptionResourceConfig<TData, TGroup extends string> {
  key: string;
  groupKey: TGroup;
  activeKeys: Record<TGroup, string>;
  loading?: Ref<boolean>;
  options: DictionaryLoadOptions;
  cancelScope: string;
  fetcher: (signal: AbortSignal) => Promise<TData>;
  apply: (data: TData) => void;
  errorMessage: string;
  isCurrentGroup: boolean;
}

async function loadGroupedSourceOptionResource<TData, TGroup extends string>({
  key,
  groupKey,
  activeKeys,
  loading: loadingRef,
  options,
  cancelScope,
  fetcher,
  apply,
  errorMessage,
  isCurrentGroup
}: GroupedSourceOptionResourceConfig<TData, TGroup>) {
  activeKeys[groupKey] = key;

  try {
    await refreshSmartQueryResource({
      key,
      fetcher: ({ signal }) => fetcher(signal),
      apply,
      background: options.background,
      cancelPreviousMatching: options.force ? cancelScope : undefined,
      isCurrent: () => activeKeys[groupKey] === key,
      setLoading:
        loadingRef && isCurrentGroup
          ? (value) => {
              loadingRef.value = value;
            }
          : undefined,
      force: options.force ?? true
    });
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : errorMessage);
    }
  }
}

async function loadPlatforms(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildPlatformParams();
  const key = createSmartQueryKey('source-platforms', params);

  await loadSourceOptionResource({
    key,
    activeKey: activePlatformsQueryKey,
    loading,
    options,
    cancelScope: 'source-platforms',
    fetcher: (signal) => sourcePlatformsApi.list(params, { signal }),
    apply: applyPlatformResult,
    errorMessage: '加载来源平台失败'
  });
}

async function loadCustomerTags(options: DictionaryLoadOptions = {}) {
  const params = buildCustomerTagParams();
  const key = createSmartQueryKey('customer-tags', params);

  await loadSourceOptionResource({
    key,
    activeKey: activeCustomerTagsQueryKey,
    loading: tagLoading,
    options,
    cancelScope: 'customer-tags',
    fetcher: (signal) => dataCenterApi.listDictionaries(params, { signal }),
    apply: applyCustomerTagResult,
    errorMessage: '加载客户标签失败'
  });
}

async function loadAppleServiceCategories(options: DictionaryLoadOptions = {}) {
  const params = buildAppleServiceCategoryParams();
  const key = createSmartQueryKey('apple-service-categories', params);

  await loadSourceOptionResource({
    key,
    activeKey: activeAppleServiceCategoriesQueryKey,
    loading: categoryLoading,
    options,
    cancelScope: 'apple-service-categories',
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults && !params.keyword && !params.status && params.page === 1) {
        const createdDefaults = await ensureDefaultAppleServiceCategories(data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: applyAppleServiceCategoryResult,
    errorMessage: '加载 Apple ID 业务分类失败'
  });
}

async function loadAppleServiceOptionGroup(
  groupKey: AppleServiceQuickOptionGroupKey,
  options: DictionaryLoadOptions = {}
) {
  const params = buildAppleServiceOptionParams(groupKey);
  const key = createSmartQueryKey(`apple-service-option-${groupKey}`, params);
  const isCurrentGroup = selectedAppleServiceOptionGroup.value === groupKey;

  await loadGroupedSourceOptionResource({
    key,
    groupKey,
    activeKeys: activeAppleServiceOptionQueryKeys,
    loading: appleServiceOptionLoading,
    options,
    cancelScope: `apple-service-option-${groupKey}`,
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults) {
        const createdDefaults = await ensureDefaultAppleServiceOptions(groupKey, data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: (data) => applyAppleServiceOptionResult(groupKey, data),
    errorMessage: '加载 Apple ID 业务选项失败',
    isCurrentGroup
  });
}

async function loadNotificationOptionGroup(
  groupKey: NotificationQuickOptionGroupKey,
  options: DictionaryLoadOptions = {}
) {
  const params = buildNotificationOptionParams(groupKey);
  const key = createSmartQueryKey(`notification-option-${groupKey}`, params);
  const isCurrentGroup = selectedNotificationOptionGroup.value === groupKey;

  await loadGroupedSourceOptionResource({
    key,
    groupKey,
    activeKeys: activeNotificationOptionQueryKeys,
    loading: notificationOptionLoading,
    options,
    cancelScope: `notification-option-${groupKey}`,
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults) {
        const createdDefaults = await ensureDefaultNotificationOptions(groupKey, data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: (data) => applyNotificationOptionResult(groupKey, data),
    errorMessage: '加载通知选项失败',
    isCurrentGroup
  });
}

async function loadSystemOptionGroup(
  groupKey: SystemQuickOptionGroupKey,
  options: DictionaryLoadOptions = {}
) {
  const params = buildSystemOptionParams(groupKey);
  const key = createSmartQueryKey(`system-option-${groupKey}`, params);
  const isCurrentGroup = selectedSystemOptionGroup.value === groupKey;

  await loadGroupedSourceOptionResource({
    key,
    groupKey,
    activeKeys: activeSystemOptionQueryKeys,
    loading: systemOptionLoading,
    options,
    cancelScope: `system-option-${groupKey}`,
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults) {
        const createdDefaults = await ensureDefaultSystemOptions(groupKey, data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: (data) => applySystemOptionResult(groupKey, data),
    errorMessage: '加载系统选项失败',
    isCurrentGroup
  });
}

async function loadAppleRegions(options: DictionaryLoadOptions = {}) {
  const params = buildAppleRegionParams();
  const key = createSmartQueryKey('apple-account-regions', params);

  await loadSourceOptionResource({
    key,
    activeKey: activeAppleRegionsQueryKey,
    loading: regionLoading,
    options,
    cancelScope: 'apple-account-regions',
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults && !params.keyword && !params.status && params.page === 1) {
        const createdDefaults = await ensureDefaultAppleRegions(data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: applyAppleRegionResult,
    errorMessage: '加载 Apple ID 地区失败'
  });
}

async function loadCodeDeliveryMethods(options: DictionaryLoadOptions = {}) {
  const params = buildCodeDeliveryMethodParams();
  const key = createSmartQueryKey('code-delivery-methods', params);

  await loadSourceOptionResource({
    key,
    activeKey: activeCodeDeliveryMethodsQueryKey,
    loading: methodLoading,
    options,
    cancelScope: 'code-delivery-methods',
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults) {
        const createdDefaults = await ensureDefaultCodeDeliveryMethods(data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: applyCodeDeliveryMethodResult,
    errorMessage: '加载兑换码发货方式失败'
  });
}

async function loadCodeServiceDeliveryModes(options: DictionaryLoadOptions = {}) {
  const params = buildCodeServiceDeliveryModeParams();
  const key = createSmartQueryKey('code-service-delivery-modes', params);

  await loadSourceOptionResource({
    key,
    activeKey: activeCodeServiceDeliveryModesQueryKey,
    loading: deliveryModeLoading,
    options,
    cancelScope: 'code-service-delivery-modes',
    fetcher: async (signal) => {
      const data = await dataCenterApi.listDictionaries(params, { signal });
      if (options.restoreDefaults) {
        const createdDefaults = await ensureDefaultCodeServiceDeliveryModes(data.items);
        if (createdDefaults) {
          return dataCenterApi.listDictionaries(params, { signal });
        }
      }
      return data;
    },
    apply: applyCodeServiceDeliveryModeResult,
    errorMessage: '加载兑换码业务发货模式失败'
  });
}

async function ensureDefaultAppleRegions(existingRegions: DataDictionary[]) {
  const existingCodes = new Set(existingRegions.map((region) => region.code.toUpperCase()));
  const defaults = getDefaultAppleAccountRegionDictionaries().filter(
    (region) => !existingCodes.has(region.code.toUpperCase())
  );

  if (!defaults.length) {
    return false;
  }

  await Promise.all(defaults.map((region) => dataCenterApi.createDictionary(region)));
  return true;
}

async function ensureDefaultAppleServiceCategories(existingCategories: DataDictionary[]) {
  const existingLabels = new Set(
    existingCategories.map((category) => category.label.trim()).filter(Boolean)
  );

  if (existingLabels.has('通用')) {
    return false;
  }

  await dataCenterApi.createDictionary({
    group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
    code: 'general',
    label: '通用',
    value: '通用',
    sortOrder: 0,
    status: 'active',
    remark: '默认业务分类，适合暂时不需要细分的 Apple ID 业务'
  });
  return true;
}

async function ensureDefaultAppleServiceOptions(
  groupKey: AppleServiceQuickOptionGroupKey,
  existingOptions: DataDictionary[]
) {
  const existingCodes = new Set(existingOptions.map((option) => option.code));
  const defaults = getDefaultAppleServiceQuickOptionDictionaries(groupKey).filter(
    (option) => !existingCodes.has(option.code)
  );

  if (!defaults.length) {
    return false;
  }

  await Promise.all(defaults.map((option) => dataCenterApi.createDictionary(option)));
  return true;
}

async function ensureDefaultNotificationOptions(
  groupKey: NotificationQuickOptionGroupKey,
  existingOptions: DataDictionary[]
) {
  const existingCodes = new Set(existingOptions.map((option) => option.code));
  const defaults = getDefaultNotificationQuickOptionDictionaries(groupKey).filter(
    (option) => !existingCodes.has(option.code)
  );

  if (!defaults.length) {
    return false;
  }

  await Promise.all(defaults.map((option) => dataCenterApi.createDictionary(option)));
  return true;
}

async function ensureDefaultSystemOptions(
  groupKey: SystemQuickOptionGroupKey,
  existingOptions: DataDictionary[]
) {
  const existingCodes = new Set(existingOptions.map((option) => option.code));
  const defaults = getDefaultSystemQuickOptionDictionaries(groupKey).filter(
    (option) => !existingCodes.has(option.code)
  );

  if (!defaults.length) {
    return false;
  }

  await Promise.all(defaults.map((option) => dataCenterApi.createDictionary(option)));
  return true;
}

async function ensureDefaultCodeDeliveryMethods(existingMethods: DataDictionary[]) {
  const existingCodes = new Set(existingMethods.map((method) => method.code));
  const defaults = getDefaultCodeDeliveryMethodDictionaries().filter(
    (method) => !existingCodes.has(method.code)
  );

  if (!defaults.length) {
    return false;
  }

  await Promise.all(defaults.map((method) => dataCenterApi.createDictionary(method)));
  return true;
}

async function ensureDefaultCodeServiceDeliveryModes(existingModes: DataDictionary[]) {
  const existingCodes = new Set(existingModes.map((mode) => mode.code));
  const defaults = getDefaultCodeServiceDeliveryModeDictionaries().filter(
    (mode) => !existingCodes.has(mode.code)
  );

  if (!defaults.length) {
    return false;
  }

  await Promise.all(defaults.map((mode) => dataCenterApi.createDictionary(mode)));
  return true;
}

async function handleSearch() {
  query.page = 1;
  await loadPlatforms();
}

async function handleTagSearch() {
  tagQuery.page = 1;
  await loadCustomerTags();
}

async function handleCategorySearch() {
  categoryQuery.page = 1;
  await loadAppleServiceCategories();
}

async function handleRegionSearch() {
  regionQuery.page = 1;
  await loadAppleRegions();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadPlatforms();
}

async function handleTagSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  tagQuery.sortBy = payload.prop ?? '';
  tagQuery.sortOrder = mapSortOrder(payload.order) ?? '';
  tagQuery.page = 1;
  await loadCustomerTags();
}

async function handleCategorySortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  categoryQuery.sortBy = payload.prop ?? '';
  categoryQuery.sortOrder = mapSortOrder(payload.order) ?? '';
  categoryQuery.page = 1;
  await loadAppleServiceCategories();
}

async function handleRegionSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  regionQuery.sortBy = payload.prop || 'sortOrder';
  regionQuery.sortOrder = mapSortOrder(payload.order) ?? '';
  regionQuery.page = 1;

  if (!regionQuery.sortOrder) {
    regionQuery.sortBy = 'sortOrder';
    regionQuery.sortOrder = 'asc';
  }

  await loadAppleRegions();
}

function handleSelectionChange(rows: SourcePlatform[]) {
  selectedPlatforms.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function clearTagFilters() {
  tagQuery.page = 1;
  tagQuery.keyword = '';
  tagQuery.status = '';
  tagQuery.sortBy = '';
  tagQuery.sortOrder = '';
  void loadCustomerTags();
}

function clearCategoryFilters() {
  categoryQuery.page = 1;
  categoryQuery.keyword = '';
  categoryQuery.status = '';
  categoryQuery.sortBy = '';
  categoryQuery.sortOrder = '';
  void loadAppleServiceCategories();
}

async function restoreDefaultAppleServiceCategories() {
  categoryQuery.page = 1;
  categoryQuery.keyword = '';
  categoryQuery.status = '';
  categoryQuery.sortBy = '';
  categoryQuery.sortOrder = '';
  await loadAppleServiceCategories({ force: true, restoreDefaults: true });
}

function clearRegionFilters() {
  regionQuery.page = 1;
  regionQuery.keyword = '';
  regionQuery.status = '';
  regionQuery.sortBy = 'sortOrder';
  regionQuery.sortOrder = 'asc';
  void loadAppleRegions();
}

async function restoreDefaultAppleRegions() {
  regionQuery.page = 1;
  regionQuery.keyword = '';
  regionQuery.status = '';
  regionQuery.sortBy = 'sortOrder';
  regionQuery.sortOrder = 'asc';
  await loadAppleRegions({ force: true, restoreDefaults: true });
}

function removeFilter() {
  clearFilters();
}

function exportList() {
  const rows = selectedPlatforms.value.length ? selectedPlatforms.value : platforms.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的来源平台');
    return;
  }

  const count = exportRowsToCsv(
    'source-platforms',
    [
      { header: '平台名称', value: (row) => row.name },
      { header: '费率', value: (row) => row.feeRate },
      { header: '固定费用', value: (row) => row.feeFixed },
      { header: '状态', value: (row) => getPlatformStatusLabel(row.status) },
      { header: '备注', value: (row) => row.remark ?? '' },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条来源平台`);
}

function getPlatformStatusLabel(status: SourcePlatform['status']) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function handleBatchAction(action: string) {
  if (action === 'export') {
    exportList();
  }
}

async function loadTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey
    });
    savedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存来源平台视图', {
      inputValue: '来源平台常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey,
      viewName: value.trim(),
      filters: {
        keyword: query.keyword,
        status: query.status
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : platformColumnOptions.map((column) => column.value),
      density: density.value,
      pageSize: query.pageSize,
      isDefault: savedViews.value.length === 0
    });
    await loadTableViews();
    savedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applySavedView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyView(view);
  ElMessage.success('已应用保存视图');
  await loadPlatforms();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.pageSize = view.pageSize;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        platformColumnOptions.some((option) => option.value === column)
      )
    : platformColumnOptions.map((column) => column.value);
  sortConfig.value = parseSortConfig(view.sortConfig);
  savedViewId.value = view.id;
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

async function loadActiveSourceOptionSection(options: DictionaryLoadOptions = {}) {
  switch (activeSourceOptionSectionKey.value) {
    case 'platforms':
      await Promise.all([loadTableViews(true), loadPlatforms(options)]);
      break;
    case 'customer-tags':
      await loadCustomerTags(options);
      break;
    case 'apple-service-categories':
      await loadAppleServiceCategories(options);
      break;
    case 'apple-regions':
      await loadAppleRegions(options);
      break;
    case 'apple-service-options':
      await loadAppleServiceOptionGroup(selectedAppleServiceOptionGroup.value, options);
      break;
    case 'code-delivery-methods':
      await loadCodeDeliveryMethods(options);
      break;
    case 'code-delivery-modes':
      await loadCodeServiceDeliveryModes(options);
      break;
    case 'notification-options':
      await loadNotificationOptionGroup(selectedNotificationOptionGroup.value, options);
      break;
    case 'system-options':
      await loadSystemOptionGroup(selectedSystemOptionGroup.value, options);
      break;
  }
}

async function initializePage() {
  await loadActiveSourceOptionSection({ force: false });
}

function resetForm() {
  form.name = '';
  form.feeRate = '0';
  form.feeFixed = '0';
  form.status = 'active';
  form.remark = '';
}

function openCreate() {
  editingPlatform.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(platform: SourcePlatform) {
  editingPlatform.value = platform;
  form.name = platform.name;
  form.feeRate = platform.feeRate;
  form.feeFixed = platform.feeFixed;
  form.status = platform.status;
  form.remark = platform.remark ?? '';
  dialogVisible.value = true;
}

function resetTagForm() {
  tagForm.label = '';
  tagForm.sortOrder = 0;
  tagForm.status = 'active';
  tagForm.remark = '';
}

function openCreateTag() {
  editingTag.value = null;
  resetTagForm();
  tagDialogVisible.value = true;
}

function openEditTag(tag: DataDictionary) {
  editingTag.value = tag;
  tagForm.label = tag.label;
  tagForm.sortOrder = tag.sortOrder;
  tagForm.status = tag.status;
  tagForm.remark = tag.remark ?? '';
  tagDialogVisible.value = true;
}

function resetCategoryForm() {
  categoryForm.label = '';
  categoryForm.sortOrder = appleServiceCategories.value.length;
  categoryForm.status = 'active';
  categoryForm.remark = '';
}

function openCreateCategory() {
  editingCategory.value = null;
  activeCategoryForServices.value = null;
  categoryServices.value = [];
  categoryServicesTotal.value = 0;
  resetCategoryForm();
  categoryDialogVisible.value = true;
}

function openEditCategory(category: DataDictionary) {
  editingCategory.value = category;
  categoryForm.label = category.label;
  categoryForm.sortOrder = category.sortOrder;
  categoryForm.status = category.status;
  categoryForm.remark = category.remark ?? '';
  activeCategoryForServices.value = category;
  categoryDialogVisible.value = true;
  void loadCategoryServices(category);
}

function openEditAppleServiceOption(option: DataDictionary) {
  editingAppleServiceOption.value = option;
  editingAppleServiceOptionGroup.value = selectedAppleServiceOptionGroup.value;
  appleServiceOptionForm.code = option.code;
  appleServiceOptionForm.label = option.label;
  appleServiceOptionForm.sortOrder = option.sortOrder;
  appleServiceOptionForm.status = option.status;
  appleServiceOptionForm.remark = option.remark ?? '';
  appleServiceOptionDialogVisible.value = true;
}

function openEditNotificationOption(option: DataDictionary) {
  editingNotificationOption.value = option;
  editingNotificationOptionGroup.value = selectedNotificationOptionGroup.value;
  notificationOptionForm.code = option.code;
  notificationOptionForm.label = option.label;
  notificationOptionForm.sortOrder = option.sortOrder;
  notificationOptionForm.status = option.status;
  notificationOptionForm.remark = option.remark ?? '';
  notificationOptionDialogVisible.value = true;
}

function openEditSystemOption(option: DataDictionary) {
  editingSystemOption.value = option;
  editingSystemOptionGroup.value = selectedSystemOptionGroup.value;
  systemOptionForm.code = option.code;
  systemOptionForm.label = option.label;
  systemOptionForm.sortOrder = option.sortOrder;
  systemOptionForm.status = option.status;
  systemOptionForm.remark = option.remark ?? '';
  systemOptionDialogVisible.value = true;
}

function resetRegionForm() {
  regionForm.code = 'US';
  regionForm.label = 'us';
  regionForm.currency = 'USD';
  regionForm.dialCode = '+86';
  regionForm.phoneExample = '+86 138 0013 8000';
  regionForm.sortOrder = appleRegionDictionaries.value.length;
  regionForm.status = 'active';
  regionForm.remark = '';
}

function openCreateRegion() {
  editingRegion.value = null;
  resetRegionForm();
  regionDialogVisible.value = true;
}

function openEditRegion(region: DataDictionary) {
  const option = parseAppleAccountRegionDictionary(region);
  editingRegion.value = region;
  regionForm.code = region.code.toUpperCase();
  regionForm.label = region.label || option.code.toLowerCase();
  regionForm.currency = option.currency;
  regionForm.dialCode = option.dialCode;
  regionForm.phoneExample = option.phoneExample;
  regionForm.sortOrder = region.sortOrder;
  regionForm.status = region.status;
  regionForm.remark = region.remark ?? '';
  regionDialogVisible.value = true;
}

function openEditMethod(method: DataDictionary) {
  editingMethod.value = method;
  methodForm.code = method.code;
  methodForm.label = method.label;
  methodForm.sortOrder = method.sortOrder;
  methodForm.status = method.status;
  methodForm.remark = method.remark ?? '';
  methodDialogVisible.value = true;
}

function openEditDeliveryMode(mode: DataDictionary) {
  editingDeliveryMode.value = mode;
  deliveryModeForm.code = mode.code;
  deliveryModeForm.label = mode.label;
  deliveryModeForm.sortOrder = mode.sortOrder;
  deliveryModeForm.status = mode.status;
  deliveryModeForm.remark = mode.remark ?? '';
  deliveryModeDialogVisible.value = true;
}

async function savePlatform() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      feeRate: form.feeRate,
      feeFixed: form.feeFixed,
      status: form.status,
      remark: form.remark || null
    };

    if (editingPlatform.value) {
      await sourcePlatformsApi.update(editingPlatform.value.id, payload);
    } else {
      await sourcePlatformsApi.create(payload);
    }

    ElMessage.success('来源平台已保存');
    dialogVisible.value = false;
    await loadPlatforms({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存来源平台失败');
  } finally {
    saving.value = false;
  }
}

async function deletePlatform(platform: SourcePlatform) {
  try {
    await ElMessageBox.confirm(
      `确认删除“${platform.name}”？删除后它不会再出现在来源平台列表和新建资料的下拉里，历史记录只保留原来的关联。`,
      '删除来源平台',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );

    deletingPlatformId.value = platform.id;
    await sourcePlatformsApi.remove(platform.id);
    ElMessage.success('来源平台已删除');

    if (platforms.value.length === 1 && query.page > 1) {
      query.page -= 1;
    }

    await loadPlatforms({ force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '删除来源平台失败');
    }
  } finally {
    deletingPlatformId.value = '';
  }
}

async function deleteDictionaryOption(
  dictionary: DataDictionary,
  context: DictionaryDeleteContext
) {
  const displayName = context.displayName ?? dictionary.label;

  try {
    await ElMessageBox.confirm(
      `确认删除“${displayName}”？${context.confirmDetail}`,
      `删除${context.entityLabel}`,
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );

    deletingDictionaryId.value = dictionary.id;
    await dataCenterApi.removeDictionary(dictionary.id);
    ElMessage.success(`${context.entityLabel}已删除`);
    context.beforeReload?.();
    await context.reload();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `删除${context.entityLabel}失败`);
    }
  } finally {
    deletingDictionaryId.value = '';
  }
}

async function deleteCustomerTag(tag: DataDictionary) {
  await deleteDictionaryOption(tag, {
    entityLabel: '客户标签',
    confirmDetail: '删除后不会再出现在客户标签列表和新增客户下拉里，已有客户身上的文字标签会保留。',
    beforeReload: () => {
      if (customerTags.value.length === 1 && tagQuery.page > 1) {
        tagQuery.page -= 1;
      }
    },
    reload: () => loadCustomerTags({ force: true })
  });
}

async function deleteAppleServiceCategory(category: DataDictionary) {
  const usageCount = getCategoryUsageCount(category);
  if (usageCount > 0) {
    try {
      await ElMessageBox.confirm(
        `这个分类还有 ${usageCount} 个业务正在使用，不能直接删除。请先查看使用中业务，把业务改到其他分类或删除业务后再删除分类。`,
        '不能直接删除使用中的分类',
        {
          type: 'warning',
          confirmButtonText: '查看使用中业务',
          cancelButtonText: '返回'
        }
      );
      openCategoryServices(category);
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(error instanceof Error ? error.message : '打开使用中业务失败');
      }
    }
    return;
  }

  await deleteDictionaryOption(category, {
    entityLabel: 'Apple ID 业务分类',
    confirmDetail: '确认前已检测到没有业务使用；删除后不会再出现在 Apple ID 业务分类下拉里。',
    beforeReload: () => {
      if (appleServiceCategories.value.length === 1 && categoryQuery.page > 1) {
        categoryQuery.page -= 1;
      }
    },
    reload: () => loadAppleServiceCategories({ force: true })
  });
  invalidateAppleServiceConsumers();
}

async function saveCategoryService() {
  const valid = await categoryServiceFormRef.value?.validate().catch(() => false);
  if (!valid || !editingCategoryService.value) {
    return;
  }

  const serviceId = editingCategoryService.value.id;
  categoryServiceSavingId.value = serviceId;
  try {
    await appleServicesApi.update(serviceId, {
      name: categoryServiceForm.name.trim(),
      category: normalizeAppleServiceCategoryValue(categoryServiceForm.category),
      officialBasePrice: categoryServiceForm.officialBasePrice.trim(),
      officialCostValue: categoryServiceForm.officialCostValue.trim(),
      currency: categoryServiceForm.currency.trim().toUpperCase(),
      defaultPeriodType: categoryServiceForm.defaultPeriodType,
      defaultPeriodValue: categoryServiceForm.defaultPeriodValue,
      status: categoryServiceForm.status,
      remark: categoryServiceForm.remark.trim() || null
    });

    ElMessage.success('业务已保存');
    categoryServiceDialogVisible.value = false;
    invalidateAppleServiceConsumers();
    await Promise.all([
      loadCategoryServices(activeCategoryForServices.value),
      loadAppleServiceCategories({ force: true })
    ]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存业务失败');
  } finally {
    categoryServiceSavingId.value = '';
  }
}

async function deleteCategoryService(service: AppleService) {
  try {
    await ElMessageBox.confirm(
      `确认删除业务“${service.name}”？删除后订单录入不能再选择这个开通业务，历史订单不受影响。`,
      '删除使用中业务',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      }
    );

    categoryServiceDeletingId.value = service.id;
    await appleServicesApi.remove(service.id);
    ElMessage.success('业务已删除');
    invalidateAppleServiceConsumers();
    await Promise.all([
      loadCategoryServices(activeCategoryForServices.value),
      loadAppleServiceCategories({ force: true })
    ]);
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '删除业务失败');
    }
  } finally {
    categoryServiceDeletingId.value = '';
  }
}

async function syncAppleServicesCategoryLabel(oldCategory: string, newCategory: string) {
  if (oldCategory === newCategory) return 0;

  let syncedCount = 0;
  for (let index = 0; index < 100; index += 1) {
    const result = await appleServicesApi.list({
      page: 1,
      pageSize: 100,
      category: oldCategory
    });

    if (!result.items.length) {
      return syncedCount;
    }

    await Promise.all(
      result.items.map((service) =>
        appleServicesApi.update(service.id, {
          category: newCategory
        })
      )
    );
    syncedCount += result.items.length;
  }

  throw new Error('分类同步数量异常，请稍后重试');
}

async function deleteAppleServiceOption(option: DataDictionary) {
  const group = activeAppleServiceOptionGroup.value;
  await deleteDictionaryOption(option, {
    entityLabel: group.title,
    confirmDetail: `删除后不会再出现在 ${group.title} 下拉里，历史业务不受影响。`,
    reload: () =>
      loadAppleServiceOptionGroup(selectedAppleServiceOptionGroup.value, { force: true })
  });
}

async function deleteNotificationOption(option: DataDictionary) {
  const group = activeNotificationOptionGroup.value;
  await deleteDictionaryOption(option, {
    entityLabel: group.title,
    confirmDetail: `删除后不会再出现在 ${group.title} 下拉里，历史通知记录不受影响。`,
    reload: () =>
      loadNotificationOptionGroup(selectedNotificationOptionGroup.value, { force: true })
  });
}

async function deleteSystemOption(option: DataDictionary) {
  const group = activeSystemOptionGroup.value;
  await deleteDictionaryOption(option, {
    entityLabel: group.title,
    confirmDetail: `删除后不会再出现在 ${group.title} 下拉里，历史配置不受影响。`,
    reload: () => loadSystemOptionGroup(selectedSystemOptionGroup.value, { force: true })
  });
}

async function deleteAppleRegion(region: DataDictionary) {
  await deleteDictionaryOption(region, {
    entityLabel: 'Apple ID 地区',
    displayName: getAppleRegionLabel(region),
    confirmDetail: '删除后新增 Apple ID 不会再出现这个地区，历史账号不受影响。',
    beforeReload: () => {
      if (appleRegionDictionaries.value.length === 1 && regionQuery.page > 1) {
        regionQuery.page -= 1;
      }
    },
    reload: () => loadAppleRegions({ force: true })
  });
}

async function deleteCodeDeliveryMethod(method: DataDictionary) {
  await deleteDictionaryOption(method, {
    entityLabel: '兑换码发货方式',
    confirmDetail: '删除后不会再出现在发货方式下拉里，历史发货记录不受影响。',
    reload: () => loadCodeDeliveryMethods({ force: true })
  });
}

async function deleteCodeServiceDeliveryMode(mode: DataDictionary) {
  await deleteDictionaryOption(mode, {
    entityLabel: '兑换码业务发货模式',
    confirmDetail: '删除后不会再出现在兑换码业务设置下拉里，历史业务不受影响。',
    reload: () => loadCodeServiceDeliveryModes({ force: true })
  });
}

async function saveCustomerTag() {
  const valid = await tagFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const normalizedLabel = tagForm.label.trim();
  const duplicated = customerTags.value.some(
    (tag) => tag.id !== editingTag.value?.id && tag.label.trim() === normalizedLabel
  );

  if (duplicated) {
    ElMessage.error('这个客户标签已经存在');
    return;
  }

  tagSaving.value = true;
  try {
    if (editingTag.value) {
      await dataCenterApi.updateDictionary(editingTag.value.id, {
        label: normalizedLabel,
        sortOrder: tagForm.sortOrder,
        status: tagForm.status,
        remark: tagForm.remark.trim() || null
      });
    } else {
      await dataCenterApi.createDictionary({
        group: CUSTOMER_TAG_DICTIONARY_GROUP,
        code: buildQuickSettingCode(normalizedLabel, 'tag'),
        label: normalizedLabel,
        value: normalizedLabel,
        sortOrder: tagForm.sortOrder,
        status: tagForm.status,
        remark: tagForm.remark.trim() || null
      });
    }

    ElMessage.success('客户标签已保存');
    tagDialogVisible.value = false;
    await loadCustomerTags({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存客户标签失败');
  } finally {
    tagSaving.value = false;
  }
}

async function toggleCustomerTagStatus(tag: DataDictionary) {
  const nextStatus: DataDictionaryStatus = tag.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${tag.label}”？启用后新增客户可以选择这个标签。`
        : `确认停用“${tag.label}”？停用后不会再出现在新增客户下拉里，已有客户标签会保留。`,
      `${actionLabel}客户标签`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingTagId.value = tag.id;
    await dataCenterApi.updateDictionary(tag.id, {
      status: nextStatus
    });
    ElMessage.success(`客户标签已${actionLabel}`);
    await loadCustomerTags({ force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `${actionLabel}客户标签失败`);
    }
  } finally {
    updatingTagId.value = '';
  }
}

async function saveAppleServiceCategory() {
  const valid = await categoryFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const normalizedLabel = categoryForm.label.trim();
  const duplicated = appleServiceCategories.value.some(
    (category) =>
      category.id !== editingCategory.value?.id && category.label.trim() === normalizedLabel
  );

  if (duplicated) {
    ElMessage.error('这个 Apple ID 业务分类已经存在');
    return;
  }

  categorySaving.value = true;
  try {
    const oldCategory = editingCategory.value
      ? getAppleServiceCategoryValue(editingCategory.value)
      : '';
    if (editingCategory.value) {
      await dataCenterApi.updateDictionary(editingCategory.value.id, {
        label: normalizedLabel,
        value: normalizedLabel,
        sortOrder: categoryForm.sortOrder,
        status: categoryForm.status,
        remark: categoryForm.remark.trim() || null
      });
    } else {
      await dataCenterApi.createDictionary({
        group: APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP,
        code: buildQuickSettingCode(normalizedLabel, 'apple-service-category'),
        label: normalizedLabel,
        value: normalizedLabel,
        sortOrder: categoryForm.sortOrder,
        status: categoryForm.status,
        remark: categoryForm.remark.trim() || null
      });
    }

    const syncedCount =
      editingCategory.value && oldCategory !== normalizedLabel
        ? await syncAppleServicesCategoryLabel(oldCategory, normalizedLabel)
        : 0;

    ElMessage.success(
      syncedCount > 0
        ? `Apple ID 业务分类已保存，并同步 ${syncedCount} 个业务`
        : 'Apple ID 业务分类已保存'
    );
    categoryDialogVisible.value = false;
    invalidateAppleServiceConsumers();
    await loadAppleServiceCategories({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 业务分类失败');
  } finally {
    categorySaving.value = false;
  }
}

async function toggleAppleServiceCategoryStatus(category: DataDictionary) {
  const nextStatus: DataDictionaryStatus = category.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${category.label}”？启用后 Apple ID 业务设置可以选择这个分类。`
        : `确认停用“${category.label}”？停用后新增 Apple ID 业务不会再出现这个分类，历史业务不受影响。`,
      `${actionLabel}Apple ID 业务分类`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingCategoryId.value = category.id;
    await dataCenterApi.updateDictionary(category.id, {
      status: nextStatus
    });
    ElMessage.success(`Apple ID 业务分类已${actionLabel}`);
    invalidateAppleServiceConsumers();
    await loadAppleServiceCategories({ force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(
        error instanceof Error ? error.message : `${actionLabel}Apple ID 业务分类失败`
      );
    }
  } finally {
    updatingCategoryId.value = '';
  }
}

async function saveAppleServiceOption() {
  const valid = await appleServiceOptionFormRef.value?.validate().catch(() => false);
  if (!valid || !editingAppleServiceOption.value) {
    return;
  }

  appleServiceOptionSaving.value = true;
  try {
    await dataCenterApi.updateDictionary(editingAppleServiceOption.value.id, {
      label: appleServiceOptionForm.label.trim(),
      value: editingAppleServiceOption.value.code,
      sortOrder: appleServiceOptionForm.sortOrder,
      status: appleServiceOptionForm.status,
      remark: appleServiceOptionForm.remark.trim() || null
    });

    ElMessage.success('Apple ID 业务选项已保存');
    appleServiceOptionDialogVisible.value = false;
    await loadAppleServiceOptionGroup(editingAppleServiceOptionGroup.value, { force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 业务选项失败');
  } finally {
    appleServiceOptionSaving.value = false;
  }
}

async function toggleAppleServiceOptionStatus(option: DataDictionary) {
  const nextStatus: DataDictionaryStatus = option.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';
  const group = activeAppleServiceOptionGroup.value;

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${option.label}”？启用后 ${group.title} 下拉可以选择它。`
        : `确认停用“${option.label}”？停用后不会再出现在 ${group.title} 下拉里，历史业务不受影响。`,
      `${actionLabel}${group.title}`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingAppleServiceOptionId.value = option.id;
    await dataCenterApi.updateDictionary(option.id, {
      status: nextStatus
    });
    ElMessage.success(`${group.title}已${actionLabel}`);
    await loadAppleServiceOptionGroup(selectedAppleServiceOptionGroup.value, { force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `${actionLabel}${group.title}失败`);
    }
  } finally {
    updatingAppleServiceOptionId.value = '';
  }
}

async function saveNotificationOption() {
  const valid = await notificationOptionFormRef.value?.validate().catch(() => false);
  if (!valid || !editingNotificationOption.value) {
    return;
  }

  notificationOptionSaving.value = true;
  try {
    await dataCenterApi.updateDictionary(editingNotificationOption.value.id, {
      label: notificationOptionForm.label.trim(),
      value: editingNotificationOption.value.code,
      sortOrder: notificationOptionForm.sortOrder,
      status: notificationOptionForm.status,
      remark: notificationOptionForm.remark.trim() || null
    });

    ElMessage.success('通知选项已保存');
    notificationOptionDialogVisible.value = false;
    await loadNotificationOptionGroup(editingNotificationOptionGroup.value, { force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存通知选项失败');
  } finally {
    notificationOptionSaving.value = false;
  }
}

async function toggleNotificationOptionStatus(option: DataDictionary) {
  const nextStatus: DataDictionaryStatus = option.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';
  const group = activeNotificationOptionGroup.value;

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${option.label}”？启用后通知设置里的 ${group.title} 下拉可以选择它。`
        : `确认停用“${option.label}”？停用后不会再出现在 ${group.title} 下拉里，历史通知记录不受影响。`,
      `${actionLabel}${group.title}`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingNotificationOptionId.value = option.id;
    await dataCenterApi.updateDictionary(option.id, {
      status: nextStatus
    });
    ElMessage.success(`${group.title}已${actionLabel}`);
    await loadNotificationOptionGroup(selectedNotificationOptionGroup.value, { force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `${actionLabel}${group.title}失败`);
    }
  } finally {
    updatingNotificationOptionId.value = '';
  }
}

async function saveSystemOption() {
  const valid = await systemOptionFormRef.value?.validate().catch(() => false);
  if (!valid || !editingSystemOption.value) {
    return;
  }

  systemOptionSaving.value = true;
  try {
    await dataCenterApi.updateDictionary(editingSystemOption.value.id, {
      label: systemOptionForm.label.trim(),
      value: editingSystemOption.value.code,
      sortOrder: systemOptionForm.sortOrder,
      status: systemOptionForm.status,
      remark: systemOptionForm.remark.trim() || null
    });

    ElMessage.success('系统选项已保存');
    systemOptionDialogVisible.value = false;
    await loadSystemOptionGroup(editingSystemOptionGroup.value, { force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存系统选项失败');
  } finally {
    systemOptionSaving.value = false;
  }
}

async function toggleSystemOptionStatus(option: DataDictionary) {
  const nextStatus: DataDictionaryStatus = option.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';
  const group = activeSystemOptionGroup.value;

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${option.label}”？启用后 ${group.title} 下拉可以选择它。`
        : `确认停用“${option.label}”？停用后不会再出现在 ${group.title} 下拉里，历史配置不受影响。`,
      `${actionLabel}${group.title}`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingSystemOptionId.value = option.id;
    await dataCenterApi.updateDictionary(option.id, {
      status: nextStatus
    });
    ElMessage.success(`${group.title}已${actionLabel}`);
    await loadSystemOptionGroup(selectedSystemOptionGroup.value, { force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `${actionLabel}${group.title}失败`);
    }
  } finally {
    updatingSystemOptionId.value = '';
  }
}

async function saveAppleRegion() {
  const valid = await regionFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const normalizedCode = regionForm.code.trim().toUpperCase();
  const normalizedLabel = regionForm.label.trim() || normalizedCode.toLowerCase();
  const duplicated = appleRegionDictionaries.value.some(
    (region) =>
      region.id !== editingRegion.value?.id && region.code.trim().toUpperCase() === normalizedCode
  );

  if (duplicated) {
    ElMessage.error('这个地区代码已经存在');
    return;
  }

  regionSaving.value = true;
  try {
    const value = encodeAppleAccountRegionValue({
      currency: regionForm.currency,
      dialCode: regionForm.dialCode,
      phoneExample: regionForm.phoneExample
    });

    if (editingRegion.value) {
      await dataCenterApi.updateDictionary(editingRegion.value.id, {
        label: normalizedLabel,
        value,
        sortOrder: regionForm.sortOrder,
        status: regionForm.status,
        remark: regionForm.remark.trim() || null
      });
    } else {
      await dataCenterApi.createDictionary({
        group: APPLE_ACCOUNT_REGION_DICTIONARY_GROUP,
        code: normalizedCode,
        label: normalizedLabel,
        value,
        sortOrder: regionForm.sortOrder,
        status: regionForm.status,
        remark: regionForm.remark.trim() || null
      });
    }

    ElMessage.success('Apple ID 地区已保存');
    regionDialogVisible.value = false;
    await loadAppleRegions({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 地区失败');
  } finally {
    regionSaving.value = false;
  }
}

async function toggleAppleRegionStatus(region: DataDictionary) {
  const nextStatus: DataDictionaryStatus = region.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${getAppleRegionLabel(region)}”？启用后新增 Apple ID 可以选择这个地区。`
        : `确认停用“${getAppleRegionLabel(region)}”？停用后新增 Apple ID 不会再出现这个地区，历史账号不受影响。`,
      `${actionLabel}Apple ID 地区`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingRegionId.value = region.id;
    await dataCenterApi.updateDictionary(region.id, {
      status: nextStatus
    });
    ElMessage.success(`Apple ID 地区已${actionLabel}`);
    await loadAppleRegions({ force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `${actionLabel}Apple ID 地区失败`);
    }
  } finally {
    updatingRegionId.value = '';
  }
}

async function saveCodeDeliveryMethod() {
  const valid = await methodFormRef.value?.validate().catch(() => false);
  if (!valid || !editingMethod.value) {
    return;
  }

  methodSaving.value = true;
  try {
    await dataCenterApi.updateDictionary(editingMethod.value.id, {
      label: methodForm.label.trim(),
      value: editingMethod.value.code,
      sortOrder: methodForm.sortOrder,
      status: methodForm.status,
      remark: methodForm.remark.trim() || null
    });

    ElMessage.success('兑换码发货方式已保存');
    methodDialogVisible.value = false;
    await loadCodeDeliveryMethods({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存兑换码发货方式失败');
  } finally {
    methodSaving.value = false;
  }
}

async function toggleCodeDeliveryMethodStatus(method: DataDictionary) {
  const nextStatus: DataDictionaryStatus = method.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${method.label}”？启用后兑换码发货和补发可以选择这个方式。`
        : `确认停用“${method.label}”？停用后不会再出现在发货方式下拉里，历史发货记录不受影响。`,
      `${actionLabel}兑换码发货方式`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingMethodId.value = method.id;
    await dataCenterApi.updateDictionary(method.id, {
      status: nextStatus
    });
    ElMessage.success(`兑换码发货方式已${actionLabel}`);
    await loadCodeDeliveryMethods({ force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : `${actionLabel}兑换码发货方式失败`);
    }
  } finally {
    updatingMethodId.value = '';
  }
}

async function saveCodeServiceDeliveryMode() {
  const valid = await deliveryModeFormRef.value?.validate().catch(() => false);
  if (!valid || !editingDeliveryMode.value) {
    return;
  }

  deliveryModeSaving.value = true;
  try {
    await dataCenterApi.updateDictionary(editingDeliveryMode.value.id, {
      label: deliveryModeForm.label.trim(),
      value: editingDeliveryMode.value.code,
      sortOrder: deliveryModeForm.sortOrder,
      status: deliveryModeForm.status,
      remark: deliveryModeForm.remark.trim() || null
    });

    ElMessage.success('兑换码业务发货模式已保存');
    deliveryModeDialogVisible.value = false;
    await loadCodeServiceDeliveryModes({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存兑换码业务发货模式失败');
  } finally {
    deliveryModeSaving.value = false;
  }
}

async function toggleCodeServiceDeliveryModeStatus(mode: DataDictionary) {
  const nextStatus: DataDictionaryStatus = mode.status === 'active' ? 'disabled' : 'active';
  const actionLabel = nextStatus === 'active' ? '启用' : '停用';

  try {
    await ElMessageBox.confirm(
      nextStatus === 'active'
        ? `确认启用“${mode.label}”？启用后兑换码业务设置可以选择这个发货模式。`
        : `确认停用“${mode.label}”？停用后不会再出现在兑换码业务设置下拉里，历史业务不受影响。`,
      `${actionLabel}兑换码业务发货模式`,
      {
        type: 'warning',
        confirmButtonText: actionLabel,
        cancelButtonText: '取消'
      }
    );

    updatingDeliveryModeId.value = mode.id;
    await dataCenterApi.updateDictionary(mode.id, {
      status: nextStatus
    });
    ElMessage.success(`兑换码业务发货模式已${actionLabel}`);
    await loadCodeServiceDeliveryModes({ force: true });
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(
        error instanceof Error ? error.message : `${actionLabel}兑换码业务发货模式失败`
      );
    }
  } finally {
    updatingDeliveryModeId.value = '';
  }
}

onMounted(initializePage);

watch(activeSourceOptionSectionKey, () => {
  void loadActiveSourceOptionSection({ force: false });
});

watch(selectedAppleServiceOptionGroup, (groupKey) => {
  if (activeSourceOptionSectionKey.value === 'apple-service-options') {
    void loadAppleServiceOptionGroup(groupKey, { force: false });
  }
});

watch(selectedNotificationOptionGroup, (groupKey) => {
  if (activeSourceOptionSectionKey.value === 'notification-options') {
    void loadNotificationOptionGroup(groupKey, { force: false });
  }
});

watch(selectedSystemOptionGroup, (groupKey) => {
  if (activeSourceOptionSectionKey.value === 'system-options') {
    void loadSystemOptionGroup(groupKey, { force: false });
  }
});

usePageRefresh(
  async (options) => {
    await loadActiveSourceOptionSection({
      background: options.background,
      force: options.force ?? true
    });
  },
  { label: '选项设置' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['source-platforms', 'data-dictionaries'],
  () => {
    void loadActiveSourceOptionSection({
      background: true,
      force: true
    });
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.source-options-nav {
  position: sticky;
  z-index: 4;
  top: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 0 14px;
  overflow-x: auto;
  scrollbar-width: thin;
}

.source-options-nav__button {
  flex: 0 0 auto;
}

.common-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.common-compact-list-panel .inline-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: min(680px, 100%);
}

.quick-settings-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}

.quick-settings-toolbar__search {
  width: min(360px, 100%);
}

.quick-settings-toolbar__select {
  width: 150px;
}

.category-service-panel {
  padding-top: 16px;
  margin-top: 18px;
  border-top: 1px solid var(--border-soft);
}

.category-service-panel--plain {
  padding-top: 0;
  margin-top: 0;
  border-top: 0;
}

.category-service-panel__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.category-service-panel__head strong {
  display: block;
  color: var(--text-primary);
}

.category-service-panel__head span {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.category-service-table {
  width: 100%;
}

.category-service-period-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
}

@media (max-width: 840px) {
  .source-options-nav {
    margin: 0 -12px;
    padding: 0 12px 12px;
  }

  .common-compact-list-panel .inline-actions {
    justify-content: flex-start;
    max-width: none;
  }

  .quick-settings-toolbar,
  .quick-settings-toolbar__search,
  .quick-settings-toolbar__select {
    width: 100%;
  }

  .category-service-panel__head {
    flex-direction: column;
  }

  .category-service-period-fields {
    grid-template-columns: 1fr;
  }
}
</style>
