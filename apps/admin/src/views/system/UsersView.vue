<template>
  <PageScaffold
    title="用户管理"
    group="系统管理"
    phase="Phase 1"
    description="管理员工账号、启停状态、角色分配和基础身份信息。"
  >
    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
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
        @refresh="loadUsers"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      />

      <el-table
        v-loading="loading"
        :data="users"
        :size="tableSize"
        row-key="id"
        empty-text="暂无用户"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
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
            <el-tag v-for="role in row.roles" :key="role.id" class="tag-gap" size="small">
              {{ role.name }}
            </el-tag>
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
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
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
            <el-button type="primary" text @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadUsers"
          @size-change="loadUsers"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="editingUser ? '编辑用户' : '新增用户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item v-if="!editingUser" label="账号" prop="username">
          <el-input v-model.trim="form.username" />
        </el-form-item>
        <el-form-item
          :label="editingUser ? '新密码' : '密码'"
          :prop="editingUser ? undefined : 'password'"
        >
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="displayName">
          <el-input v-model.trim="form.displayName" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model.trim="form.phone" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model.trim="form.email" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio-button value="active">启用</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleIds" multiple clearable class="full-input">
            <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { rolesApi, userTableViewsApi, usersApi } from '@/api/system';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type { ManagedUser, Role, TableDensity, UserTableView } from '@/types/system';

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
const selectedUsers = ref<ManagedUser[]>([]);
const roles = ref<Role[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const total = ref(0);

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

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

async function loadRoles() {
  roles.value = await rolesApi.listRoles();
}

async function loadUsers() {
  loading.value = true;
  try {
    const data = await usersApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      sortBy: sortConfig.value.prop,
      sortOrder: mapSortOrder(sortConfig.value.order)
    });
    users.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载用户失败');
  } finally {
    loading.value = false;
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
  ElMessage.info('用户列表导出会进入数据中心导出任务，后续统一接入');
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
  density.value = view.density;
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
  await loadUsers();
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
    await loadUsers();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadRoles(), initializePage()]);
});
</script>
