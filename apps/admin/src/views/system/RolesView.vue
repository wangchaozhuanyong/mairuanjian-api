<template>
  <PageScaffold
    title="权限管理"
    group="安全与风控"
    phase="Phase 1"
    description="管理角色、权限树和字段级权限入口。权限变更应写入审计日志。"
  >
    <template #actions>
      <StatusChip :tone="selectedRole ? 'green' : 'neutral'" dot>
        {{ selectedRole ? `当前角色：${selectedRole.name}` : '未选择角色' }}
      </StatusChip>
      <AppButton
        variant="primary"
        :disabled="!selectedRole"
        :loading="saving"
        @click="savePermissions"
      >
        保存权限
      </AppButton>
    </template>

    <section class="content-panel" aria-label="权限管理概览">
      <div class="detail-note-grid">
        <div class="detail-note-item">
          <span>角色数量</span>
          <strong>{{ roles.length }}</strong>
          <span>当前角色全集</span>
        </div>
        <div class="detail-note-item">
          <span>权限模块</span>
          <strong>{{ permissionModuleCount }}</strong>
          <span>按 module 分组</span>
        </div>
        <div class="detail-note-item">
          <span>已选权限</span>
          <strong>{{ selectedPermissionCount }}</strong>
          <span>当前角色</span>
        </div>
        <div class="detail-note-item">
          <span>覆盖用户</span>
          <strong>{{ totalAssignedUsers }}</strong>
          <span>角色绑定用户合计</span>
        </div>
      </div>
    </section>

    <section class="split-page">
      <section class="content-panel role-list-panel">
        <div class="panel-title-row">
          <PanelTitleHelp
            title="角色列表"
            help="先选一个角色，再到右侧给这个角色配置能看哪些模块、能点哪些操作。"
          />
          <StatusChip tone="blue" dot>权限角色</StatusChip>
        </div>

        <TableToolbar
          v-model:keyword="roleKeyword"
          v-model:visible-columns="visibleColumns"
          v-model:saved-view-id="savedViewId"
          :column-options="roleColumnOptions"
          :saved-views="savedViews"
          :show-status="false"
          :show-date-shortcut="false"
          :show-primary="false"
          placeholder="搜索角色名称、编码、描述"
          @search="handleRoleSearch"
          @refresh="() => loadData()"
          @clear-filters="clearRoleFilters"
          @save-view="saveTableView"
          @apply-view="applySavedView"
          @export="exportRoles"
        />

        <el-table
          v-loading="loading"
          class="desktop-data-table"
          :data="filteredRoles"
          :size="tableSize"
          row-key="id"
          highlight-current-row
          @current-change="selectRole"
          @sort-change="handleSortChange"
        >
          <template #empty>
            <div class="apple-core-empty-state">
              <strong>暂无角色</strong>
              <span>可以清空筛选后重新查看角色，或在后续版本接入角色新增入口。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="soft" @click="clearRoleFilters">清空筛选</AppButton>
              </div>
            </div>
          </template>
          <el-table-column
            v-if="isColumnVisible('name')"
            prop="name"
            label="名称"
            min-width="120"
            sortable="custom"
          />
          <el-table-column
            v-if="isColumnVisible('code')"
            prop="code"
            label="编码"
            min-width="160"
            sortable="custom"
          />
          <el-table-column
            v-if="isColumnVisible('description')"
            prop="description"
            label="描述"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.description || '-' }}</template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('userCount')"
            prop="userCount"
            label="用户"
            width="80"
            sortable="custom"
          >
            <template #default="{ row }">{{ row._count?.userRoles ?? 0 }}</template>
          </el-table-column>
          <el-table-column
            v-if="isColumnVisible('permissionCount')"
            prop="permissionCount"
            label="权限"
            width="80"
            sortable="custom"
          >
            <template #default="{ row }">{{ row.rolePermissions?.length ?? 0 }}</template>
          </el-table-column>
        </el-table>

        <div v-if="filteredRoles.length" class="mobile-record-list" aria-label="角色移动列表">
          <article v-for="role in filteredRoles" :key="role.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ role.name }}</strong>
                <span>{{ role.code }}</span>
              </div>
              <StatusChip :tone="selectedRole?.id === role.id ? 'green' : 'blue'" dot>
                {{ selectedRole?.id === role.id ? '当前角色' : '可选择' }}
              </StatusChip>
            </div>

            <div class="mobile-record-card__stats">
              <div>
                <span>绑定用户</span>
                <strong>{{ role._count?.userRoles ?? 0 }}</strong>
              </div>
              <div>
                <span>权限数</span>
                <strong>{{ role.rolePermissions?.length ?? 0 }}</strong>
              </div>
              <div>
                <span>权限模块</span>
                <strong>{{ permissionModuleCount }}</strong>
              </div>
            </div>

            <div class="mobile-record-card__meta">
              <div>
                <span>描述</span>
                <strong>{{ role.description || '-' }}</strong>
              </div>
            </div>

            <div class="mobile-record-card__actions">
              <AppButton size="small" variant="soft" @click="selectRole(role)">选择角色</AppButton>
            </div>
          </article>
        </div>

        <div v-else class="mobile-record-list">
          <div class="apple-core-empty-state">
            <strong>暂无匹配角色</strong>
            <span>可以清空搜索条件后查看全部角色。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearRoleFilters">清空筛选</AppButton>
            </div>
          </div>
        </div>
      </section>

      <section class="content-panel permission-panel">
        <div class="panel-title-row">
          <PanelTitleHelp
            :title="selectedRole?.name ?? '权限配置'"
            :help="selectedRole?.description || '请选择左侧角色后维护权限树。'"
          />
          <StatusChip :tone="selectedRole ? 'green' : 'neutral'" dot>
            {{ selectedRole ? selectedRole.code : '待选择' }}
          </StatusChip>
          <AppButton
            variant="primary"
            :disabled="!selectedRole"
            :loading="saving"
            @click="savePermissions"
          >
            保存权限
          </AppButton>
        </div>

        <div v-if="!selectedRole" class="apple-core-empty-state">
          <strong>请选择角色</strong>
          <span>选择左侧角色后，可以查看绑定用户数量、已配置权限和权限树。</span>
        </div>
        <template v-else>
          <div class="detail-note-grid permission-summary-grid">
            <div class="detail-note-item">
              <span>角色编码</span>
              <strong>{{ selectedRole.code }}</strong>
            </div>
            <div class="detail-note-item">
              <span>绑定用户</span>
              <strong>{{ selectedRole._count?.userRoles ?? 0 }}</strong>
            </div>
            <div class="detail-note-item">
              <span>已配置权限</span>
              <strong>{{ selectedPermissionCount }}</strong>
            </div>
            <div class="detail-note-item">
              <span>权限模块</span>
              <strong>{{ permissionModuleCount }}</strong>
            </div>
          </div>
          <div class="drawer-section permission-tree-section">
            <div class="drawer-section__title">
              <span>权限树</span>
              <StatusChip tone="blue">{{ permissions.length }} 项权限</StatusChip>
            </div>
            <el-tree
              ref="treeRef"
              :data="permissionTree"
              :props="{ label: 'label', children: 'children' }"
              node-key="id"
              show-checkbox
              default-expand-all
            />
          </div>
        </template>
      </section>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { ElTree } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { rolesApi, userTableViewsApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { Permission, Role, TableDensity, UserTableView } from '@/types/system';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

interface PermissionTreeNode {
  id: string;
  label: string;
  children?: PermissionTreeNode[];
}

const tableKey = 'system_roles';
const roleColumnOptions = [
  { label: '名称', value: 'name', required: true },
  { label: '编码', value: 'code' },
  { label: '描述', value: 'description' },
  { label: '用户', value: 'userCount' },
  { label: '权限', value: 'permissionCount' }
];

const loading = ref(false);
const saving = ref(false);
const roles = ref<Role[]>([]);
const permissions = ref<Permission[]>([]);
const selectedRole = ref<Role | null>(null);
const treeRef = ref<InstanceType<typeof ElTree>>();
const roleKeyword = ref('');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const activeRolesQueryKey = ref('');

const permissionTree = computed<PermissionTreeNode[]>(() => {
  const modules = new Map<string, PermissionTreeNode>();

  for (const permission of permissions.value) {
    const moduleNode = modules.get(permission.module) ?? {
      id: `module:${permission.module}`,
      label: permission.module,
      children: []
    };

    moduleNode.children?.push({
      id: permission.id,
      label: `${permission.name} (${permission.code})`
    });
    modules.set(permission.module, moduleNode);
  }

  return [...modules.values()];
});

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const permissionModuleCount = computed(
  () => new Set(permissions.value.map((item) => item.module)).size
);
const selectedPermissionCount = computed(() => selectedRole.value?.rolePermissions?.length ?? 0);
const totalAssignedUsers = computed(() =>
  roles.value.reduce((sum, role) => sum + (role._count?.userRoles ?? 0), 0)
);

const filteredRoles = computed(() => {
  const keyword = roleKeyword.value.trim().toLowerCase();
  const matched = keyword
    ? roles.value.filter((role) =>
        [role.name, role.code, role.description ?? ''].some((value) =>
          value.toLowerCase().includes(keyword)
        )
      )
    : [...roles.value];

  const sortOrder = sortConfig.value.order;
  const sortProp = sortConfig.value.prop;
  if (!sortProp || !sortOrder) {
    return matched;
  }

  return matched.sort((left, right) => {
    const direction = sortOrder === 'ascending' ? 1 : -1;
    return (
      compareRoleValues(getRoleSortValue(left, sortProp), getRoleSortValue(right, sortProp)) *
      direction
    );
  });
});

function applyRoleData(data: { roles: Role[]; permissions: Permission[] }) {
  roles.value = data.roles;
  permissions.value = data.permissions;

  if (selectedRole.value) {
    selectedRole.value = roles.value.find((role) => role.id === selectedRole.value?.id) ?? null;
    syncCheckedPermissions();
  }
}

async function loadData(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('system-roles');
  const cached = getSmartQueryData<{ roles: Role[]; permissions: Permission[] }>(key);

  activeRolesQueryKey.value = key;

  if (cached) {
    applyRoleData(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: async () => {
        const [roleData, permissionData] = await Promise.all([
          rolesApi.listRoles(),
          rolesApi.listPermissions()
        ]);

        return {
          roles: roleData,
          permissions: permissionData
        };
      },
      force: options.force ?? true
    });

    if (activeRolesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyRoleData(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载角色权限失败');
    }
  } finally {
    if (activeRolesQueryKey.value === key) {
      loading.value = false;
    }
  }
}

function handleRoleSearch() {
  if (
    selectedRole.value &&
    !filteredRoles.value.some((role) => role.id === selectedRole.value?.id)
  ) {
    selectedRole.value = null;
  }
}

function handleSortChange(payload: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
}

function selectRole(role?: Role) {
  selectedRole.value = role ?? null;
  syncCheckedPermissions();
}

function syncCheckedPermissions() {
  const permissionIds =
    selectedRole.value?.rolePermissions?.map((item) => item.permission.id) ?? [];

  requestAnimationFrame(() => {
    treeRef.value?.setCheckedKeys(permissionIds);
  });
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function clearRoleFilters() {
  roleKeyword.value = '';
  density.value = 'default';
  savedViewId.value = '';
  sortConfig.value = {};
}

function exportRoles() {
  ElMessage.info('角色权限导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存角色列表视图', {
      inputValue: '权限管理常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey,
      viewName: value.trim(),
      filters: {
        keyword: roleKeyword.value
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : roleColumnOptions.map((column) => column.value),
      density: density.value,
      pageSize: 100,
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
  handleRoleSearch();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  roleKeyword.value = typeof filters.keyword === 'string' ? filters.keyword : '';
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) => roleColumnOptions.some((option) => option.value === column))
    : roleColumnOptions.map((column) => column.value);
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

function getRoleSortValue(role: Role, prop: string) {
  if (prop === 'userCount') return role._count?.userRoles ?? 0;
  if (prop === 'permissionCount') return role.rolePermissions?.length ?? 0;
  if (prop === 'description') return role.description ?? '';
  if (prop === 'code') return role.code;
  return role.name;
}

function compareRoleValues(left: string | number, right: string | number) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), 'zh-CN');
}

async function savePermissions() {
  if (!selectedRole.value) {
    return;
  }

  const checkedKeys = treeRef.value?.getCheckedKeys(false).map(String) ?? [];
  const permissionIds = checkedKeys.filter((key) => !key.startsWith('module:'));

  saving.value = true;
  try {
    await rolesApi.updatePermissions(selectedRole.value.id, permissionIds);
    ElMessage.success('权限已保存');
    await loadData({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function initializePage() {
  await loadTableViews(true);
  await loadData({ force: false });
}

onMounted(initializePage);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(['system-roles'], () => {
  void loadData({
    background: roles.value.length > 0 || permissions.value.length > 0,
    force: true
  });
});

onBeforeUnmount(stopRealtimeRefresh);
</script>
