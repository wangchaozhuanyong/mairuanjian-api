<template>
  <PageScaffold
    title="用户管理"
    group="安全与风控"
    phase="Phase 1"
    description="管理员工账号、启停状态、角色分配和基础身份信息。"
  >
    <section class="content-panel users-summary-panel" aria-label="用户管理概览">
      <div class="users-summary-row">
        <div class="users-summary-item">
          <span>用户数量</span>
          <strong>{{ total }}</strong>
          <small>当前筛选结果</small>
        </div>
        <div class="users-summary-item">
          <span>启用账号</span>
          <strong>{{ activeUserCount }}</strong>
          <small>当前页</small>
        </div>
        <div class="users-summary-item">
          <span>已分配角色</span>
          <strong>{{ roleAssignedCount }}</strong>
          <small>当前页</small>
        </div>
        <div class="users-summary-item">
          <span>有登录记录</span>
          <strong>{{ loggedInUserCount }}</strong>
          <small>当前页</small>
        </div>
      </div>
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="员工账号列表"
          help="这里管理谁能登录后台、账号是启用还是停用、绑定了哪些角色。涉及敏感权限的变化会进审计日志。"
        />
        <StatusChip tone="blue" dot>权限基础</StatusChip>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="userColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :selected-count="selectedUsers.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增用户"
        placeholder="搜索账号、姓名、手机号、邮箱"
        @search="handleSearch"
        @refresh="() => loadUsers()"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      />

      <ListRequestError
        v-if="rolesLoadError"
        title="角色选项加载失败"
        :message="rolesLoadError"
        @retry="() => loadRoles({ force: true })"
      />

      <ListRequestError
        v-if="usersLoadError && users.length"
        title="用户列表刷新失败"
        :message="usersLoadError"
        @retry="() => loadUsers({ force: true })"
      />

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="users"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <ListRequestError
            v-if="usersLoadError"
            title="用户列表加载失败"
            :message="usersLoadError"
            @retry="() => loadUsers({ force: true })"
          />
          <div v-else class="apple-core-empty-state">
            <strong>暂无用户</strong>
            <span>可以新增用户，或清空筛选后重新查看员工账号列表。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增用户</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('username')"
          prop="username"
          label="账号"
          min-width="140"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('displayName')"
          prop="displayName"
          label="姓名"
          min-width="140"
          sortable="custom"
        />
        <el-table-column v-if="isColumnVisible('roles')" label="角色" min-width="220">
          <template #default="{ row }">
            <StatusChip v-for="role in row.roles" :key="role.id" class="tag-gap" tone="blue">
              {{ role.name }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="100"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="row.status === 'active' ? 'green' : 'neutral'" dot>
              {{ row.status === 'active' ? '启用' : '停用' }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('lastLoginAt')"
          prop="lastLoginAt"
          label="最后登录"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('updatedAt')"
          prop="updatedAt"
          label="更新时间"
          min-width="180"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="users.length" class="mobile-record-list" aria-label="用户管理移动列表">
        <article v-for="user in users" :key="user.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ user.displayName }}</strong>
              <span>{{ user.username }} · {{ user.email || user.phone || '未填写联系方式' }}</span>
            </div>
            <StatusChip :tone="user.status === 'active' ? 'green' : 'neutral'" dot>
              {{ user.status === 'active' ? '启用' : '停用' }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>角色</span>
              <strong>{{ user.roles.length }}</strong>
            </div>
            <div>
              <span>最后登录</span>
              <strong>{{ formatDate(user.lastLoginAt) }}</strong>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(user.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip v-for="role in user.roles" :key="role.id" tone="blue">
              {{ role.name }}
            </StatusChip>
            <StatusChip v-if="!user.roles.length" tone="orange">未分配角色</StatusChip>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEdit(user)">编辑</AppButton>
          </div>
        </article>
      </div>

      <div v-else-if="usersLoadError" class="mobile-record-list" aria-label="用户列表加载失败">
        <ListRequestError
          title="用户列表加载失败"
          :message="usersLoadError"
          @retry="() => loadUsers({ force: true })"
        />
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无用户</strong>
          <span>可以新增员工账号，或清空筛选后查看全部账号。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增用户</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadUsers()"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingUser ? '编辑用户' : '新增用户'"
      width="min(520px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item v-if="!editingUser" prop="username">
          <template #label>
            <FieldHelpLabel
              label="账号"
              purpose="员工登录后台使用的用户名，创建后用于登录和审计日志归属。"
              example="可以填 zhangsan、kefu01；不要填手机号密码混合内容。"
            />
          </template>
          <el-input v-model.trim="form.username" />
        </el-form-item>
        <el-form-item :prop="editingUser ? undefined : 'password'">
          <template #label>
            <FieldHelpLabel
              :label="editingUser ? '新密码' : '密码'"
              purpose="员工登录后台的密码，编辑用户时留空表示不重置密码。"
              example="新增用户必须填强密码；只改角色或状态时新密码留空。"
            />
          </template>
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item prop="displayName">
          <template #label>
            <FieldHelpLabel
              label="姓名"
              purpose="后台显示的员工名称，列表、操作日志和通知里会显示。"
              example="可以填真实姓名、客服小张、运营 01。"
            />
          </template>
          <el-input v-model.trim="form.displayName" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="手机号"
              purpose="员工联系方式，便于安全通知或内部联络。"
              example="可以填完整手机号；不需要记录可留空。"
            />
          </template>
          <el-input v-model.trim="form.phone" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="邮箱"
              purpose="员工邮箱，后续可用于通知、找回或外部系统关联。"
              example="可以填 name@example.com；没有邮箱可留空。"
            />
          </template>
          <el-input v-model.trim="form.email" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制员工账号是否可以登录后台。"
              example="在职员工选启用；离职、冻结或暂停权限选停用。"
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
              label="角色"
              purpose="给员工分配权限集合，决定他能看哪些页面和执行哪些操作。"
              example="客服选客服角色；管理员或财务按实际岗位分配，不要随便给最高权限。"
            />
          </template>
          <el-select v-model="form.roleIds" multiple clearable class="full-input">
            <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveUser">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { rolesApi, userTableViewsApi, usersApi } from '@/api/system';
import type { UserQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import ListRequestError from '@/components/ui/ListRequestError.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { ManagedUser, PageResult, Role, TableDensity, UserTableView } from '@/types/system';
import { exportRowsToCsv } from '@/utils/exportCsv';
import { getLoadErrorMessage } from '@/utils/loadErrorMessage';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';

const tableKey = 'system_users';
const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];
const userColumnOptions = [
  { label: '账号', value: 'username', required: true },
  { label: '姓名', value: 'displayName' },
  { label: '角色', value: 'roles' },
  { label: '状态', value: 'status' },
  { label: '最后登录', value: 'lastLoginAt' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const editingUser = ref<ManagedUser | null>(null);
const formRef = ref<FormInstance>();
const users = ref<ManagedUser[]>([]);
const usersLoadError = ref('');
const selectedUsers = ref<ManagedUser[]>([]);
const roles = ref<Role[]>([]);
const rolesLoadError = ref('');
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);
const activeUsersQueryKey = ref('');
const activeRolesQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
});

const form = reactive({
  username: '',
  password: '',
  displayName: '',
  phone: '',
  email: '',
  status: 'active' as 'active' | 'disabled',
  roleIds: [] as string[]
});

const rules: FormRules<typeof form> = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入姓名', trigger: 'blur' }]
};

const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const activeUserCount = computed(
  () => users.value.filter((user) => user.status === 'active').length
);
const roleAssignedCount = computed(
  () => users.value.filter((user) => user.roles.length > 0).length
);
const loggedInUserCount = computed(
  () => users.value.filter((user) => Boolean(user.lastLoginAt)).length
);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function applyRolesResult(data: Role[]) {
  roles.value = data;
  rolesLoadError.value = '';
}

async function loadRoles(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('system-user-roles');
  const cached = getSmartQueryData<Role[]>(key);

  activeRolesQueryKey.value = key;

  if (cached) {
    applyRolesResult(cached);
  }

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => rolesApi.listRoles(),
      force: options.force ?? true
    });

    if (activeRolesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyRolesResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      rolesLoadError.value = getLoadErrorMessage(error, '加载角色失败');
      ElMessage.error(rolesLoadError.value);
    }
  }
}

function buildUserParams(): UserQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyUsersResult(data: PageResult<ManagedUser>) {
  users.value = data.items;
  total.value = data.total;
  usersLoadError.value = '';
}

async function loadUsers(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildUserParams();
  const key = createSmartQueryKey('system-users', params);
  const cached = getSmartQueryData<PageResult<ManagedUser>>(key);

  activeUsersQueryKey.value = key;

  if (cached) {
    applyUsersResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => usersApi.list(params),
      force: options.force ?? true
    });

    if (activeUsersQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyUsersResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      usersLoadError.value = getLoadErrorMessage(error, '加载用户失败');
      ElMessage.error(usersLoadError.value);
    }
  } finally {
    if (activeUsersQueryKey.value === key) {
      loading.value = false;
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadUsers();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadUsers();
}

function handleSelectionChange(rows: ManagedUser[]) {
  selectedUsers.value = rows;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  savedViewId.value = '';
  density.value = 'default';
  sortConfig.value = {};
}

function exportList() {
  const rows = selectedUsers.value.length ? selectedUsers.value : users.value;

  if (!rows.length) {
    ElMessage.warning('暂无可导出的用户数据');
    return;
  }

  const count = exportRowsToCsv(
    'system-users',
    [
      { header: '账号', value: (row) => row.username },
      { header: '姓名', value: (row) => row.displayName },
      { header: '角色', value: (row) => row.roles.map((role) => role.name).join('、') },
      { header: '状态', value: (row) => (row.status === 'active' ? '启用' : '停用') },
      { header: '最后登录', value: (row) => formatDate(row.lastLoginAt) },
      { header: '创建时间', value: (row) => formatDate(row.createdAt) },
      { header: '更新时间', value: (row) => formatDate(row.updatedAt) }
    ],
    rows
  );

  ElMessage.success(`已导出 ${count} 条用户数据`);
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存用户列表视图', {
      inputValue: '用户管理常用视图',
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
        : userColumnOptions.map((column) => column.value),
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
  await loadUsers();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isUserStatus(filters.status) ? filters.status : '';
  query.pageSize = view.pageSize;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) => userColumnOptions.some((option) => option.value === column))
    : userColumnOptions.map((column) => column.value);
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

function isUserStatus(value: unknown): value is ManagedUser['status'] | '' {
  return value === '' || value === 'active' || value === 'disabled';
}

async function initializePage() {
  await loadTableViews(true);
  await loadUsers({ force: false });
}

function resetForm() {
  form.username = '';
  form.password = '';
  form.displayName = '';
  form.phone = '';
  form.email = '';
  form.status = 'active';
  form.roleIds = [];
}

function openCreate() {
  editingUser.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(user: ManagedUser) {
  editingUser.value = user;
  form.username = user.username;
  form.password = '';
  form.displayName = user.displayName;
  form.phone = user.phone ?? '';
  form.email = user.email ?? '';
  form.status = user.status;
  form.roleIds = [...user.roleIds];
  dialogVisible.value = true;
}

async function saveUser() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      username: form.username,
      password: form.password || undefined,
      displayName: form.displayName,
      phone: form.phone || null,
      email: form.email || null,
      status: form.status,
      roleIds: form.roleIds
    };

    if (editingUser.value) {
      await usersApi.update(editingUser.value.id, payload);
    } else {
      await usersApi.create(payload);
    }

    ElMessage.success('已保存');
    dialogVisible.value = false;
    await loadUsers({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadRoles({ force: false }), initializePage()]);
});

usePageRefresh(
  (options) =>
    refreshUsersPage({
      background: options.background,
      force: options.force ?? true
    }),
  { label: '员工账号' }
);

async function refreshUsersPage(options: { background?: boolean; force?: boolean } = {}) {
  await Promise.all([loadRoles(options), loadUsers(options)]);
}

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['system-users', 'system-user-roles'],
  () => {
    void Promise.all([
      loadRoles({
        background: roles.value.length > 0,
        force: true
      }),
      loadUsers({
        background: users.value.length > 0,
        force: true
      })
    ]);
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.users-summary-panel {
  padding: 10px;
}

.users-summary-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.users-summary-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 3px 12px;
  min-width: 0;
  min-height: 52px;
  padding: 9px 12px;
  border: 1px solid var(--v3-line);
  border-radius: var(--v3-radius);
  background: linear-gradient(180deg, var(--v3-surface), var(--v3-surface-2));
}

.users-summary-item span,
.users-summary-item small {
  min-width: 0;
  overflow: hidden;
  color: var(--v3-muted);
  font-size: 12px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.users-summary-item span {
  color: var(--v3-text-soft);
  font-weight: 750;
}

.users-summary-item strong {
  grid-column: 2;
  grid-row: 1 / span 2;
  color: var(--v3-text);
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

@media (max-width: 840px) {
  .users-summary-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .users-summary-row {
    grid-template-columns: 1fr;
  }
}
</style>
