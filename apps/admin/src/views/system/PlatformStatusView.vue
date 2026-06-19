<template>
  <PageScaffold
    title="平台接口状态"
    group="系统管理"
    phase="Phase 14"
    description="查看淘宝、闲鱼、Telegram、文件存储和自动化服务的授权状态、最近同步、失败原因、调用次数和错误率。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
      <el-button @click="loadPlatforms">刷新</el-button>
      <el-button type="primary" :loading="testingAll" @click="testAllPlatforms">测试全部</el-button>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="平台数量" :value="platforms.length" hint="当前监控对象" tone="blue" />
      <MetricCard label="正常" :value="normalCount" hint="状态正常的平台" tone="green" />
      <MetricCard label="异常" :value="errorCount" hint="需要处理的平台" tone="red" />
      <MetricCard
        label="未配置"
        :value="notConfiguredCount"
        hint="授权或配置未完成"
        tone="orange"
      />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="tableDensity"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="columnOptions"
        :status-options="healthStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :show-date-shortcut="false"
        :show-primary="false"
        placeholder="搜索平台、说明、失败原因"
        @search="handleSearch"
        @refresh="loadPlatforms"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="showExportMessage"
      >
        <template #filters>
          <el-select
            v-model="query.authorizationStatus"
            class="table-toolbar__select"
            clearable
            placeholder="授权"
            @change="handleSearch"
          >
            <el-option
              v-for="option in authorizationStatusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="platformRows"
        :size="tableSize"
        row-key="platform"
        empty-text="暂无平台接口状态"
        @sort-change="handleSortChange"
      >
        <el-table-column
          v-if="isColumnVisible('platform')"
          label="平台"
          prop="platform"
          min-width="160"
          sortable="custom"
        >
          <template #default="{ row }">
            <strong>{{ row.displayName }}</strong>
            <div class="muted-block">{{ row.platform }}</div>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          label="状态"
          prop="status"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="getHealthTagType(row.status)" size="small" effect="light">
              {{ getHealthLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('authorizationStatus')"
          label="授权"
          prop="authorizationStatus"
          width="120"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag
              :type="getAuthorizationTagType(row.authorizationStatus)"
              size="small"
              effect="light"
            >
              {{ getAuthorizationLabel(row.authorizationStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('tokenExpiresAt')"
          label="Token 有效期"
          prop="tokenExpiresAt"
          width="160"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.tokenExpiresAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('lastSyncAt')"
          label="最近同步"
          prop="lastSyncAt"
          width="180"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.lastSyncAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('requestCount')"
          label="调用次数"
          width="100"
          prop="requestCount"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('errorRate')"
          label="错误率"
          width="100"
          prop="errorRate"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatErrorRate(row.errorRate) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('failedRequestCount')"
          label="失败请求"
          width="100"
          prop="failedRequestCount"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('failureLogCount')"
          label="失败日志"
          width="100"
          prop="failureLogCount"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('lastFailureAt')"
          label="最近失败时间"
          width="180"
          prop="lastFailureAt"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.lastFailureAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('retryLogCount')"
          label="重试记录"
          width="100"
          prop="retryLogCount"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('lastRetryAt')"
          label="最近重试"
          width="180"
          prop="lastRetryAt"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.lastRetryAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('lastFailureReason')"
          label="最近失败"
          min-width="260"
          prop="lastFailureReason"
          show-overflow-tooltip
        />
        <el-table-column
          v-if="isColumnVisible('message')"
          label="说明"
          min-width="260"
          prop="message"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button
              text
              type="primary"
              :disabled="!row.canTestConnection"
              :loading="testingPlatform === row.platform"
              @click="testPlatform(row)"
            >
              测试
            </el-button>
            <el-button
              text
              type="warning"
              :disabled="!row.canReauthorize"
              :loading="reauthorizingPlatform === row.platform"
              @click="reauthorize(row)"
            >
              授权配置
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="authorizationDialogVisible"
      :title="`${authorizationPlatform?.displayName ?? ''}授权配置`"
      width="760px"
      destroy-on-close
    >
      <el-skeleton v-if="authorizationLoading" :rows="5" animated />
      <el-form v-else label-position="top">
        <el-alert
          class="auth-alert"
          type="warning"
          show-icon
          :closable="false"
          title="敏感字段只支持重新填写，不会回显历史明文。真实平台接口接入前，保存配置只代表凭据已托管。"
        />
        <div v-if="authorizationConfig" class="auth-summary">
          <el-tag :type="authorizationConfig.configured ? 'success' : 'warning'" effect="light">
            {{ authorizationConfig.configured ? '已保存授权配置' : '未保存授权配置' }}
          </el-tag>
          <span>App Key 尾号：{{ authorizationConfig.appKeyTail || '-' }}</span>
          <span>Access Token 尾号：{{ authorizationConfig.accessTokenTail || '-' }}</span>
          <span>Refresh Token 尾号：{{ authorizationConfig.refreshTokenTail || '-' }}</span>
        </div>
        <el-form-item label="授权方式">
          <el-select v-model="authorizationForm.authMode" class="full-width">
            <el-option
              v-for="option in authorizationModeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="店铺/账号名称">
          <el-input v-model.trim="authorizationForm.shopName" placeholder="例如：淘宝主店" />
        </el-form-item>
        <el-form-item label="App Key">
          <el-input
            v-model.trim="authorizationForm.appKey"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item label="App Secret">
          <el-input
            v-model.trim="authorizationForm.appSecret"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item label="Access Token">
          <el-input
            v-model.trim="authorizationForm.accessToken"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item label="Refresh Token">
          <el-input
            v-model.trim="authorizationForm.refreshToken"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item label="Token 有效期">
          <el-input
            v-model.trim="authorizationForm.tokenExpiresAt"
            placeholder="例如：2026-07-01T00:00:00.000Z"
          />
        </el-form-item>
        <el-form-item label="授权范围">
          <el-input
            v-model.trim="authorizationForm.scopesText"
            placeholder="多个范围用英文逗号分隔，例如 order.read,delivery.write"
          />
        </el-form-item>
        <el-form-item label="授权地址">
          <el-input
            v-model.trim="authorizationForm.authorizationUrl"
            placeholder="例如：https://open.example.com/oauth/authorize"
          />
        </el-form-item>
        <el-form-item label="Token 地址">
          <el-input
            v-model.trim="authorizationForm.tokenUrl"
            placeholder="真实平台接入 token 交换时使用"
          />
        </el-form-item>
        <el-form-item label="回调地址">
          <el-input
            v-model.trim="authorizationForm.redirectUri"
            placeholder="不填写则使用后端默认回调地址"
          />
        </el-form-item>
        <el-form-item label="Client ID 参数名">
          <el-input
            v-model.trim="authorizationForm.clientIdParam"
            placeholder="默认 client_id，部分平台可能是 app_key"
          />
        </el-form-item>
        <el-checkbox v-model="authorizationForm.clearSecrets">
          清空已保存的 App Key / Secret / Token
        </el-checkbox>
      </el-form>
      <template #footer>
        <el-button @click="authorizationDialogVisible = false">取消</el-button>
        <el-button
          type="warning"
          plain
          :loading="oauthStarting"
          :disabled="authorizationForm.authMode !== 'oauth'"
          @click="startOAuth"
        >
          发起 OAuth
        </el-button>
        <el-button type="primary" :loading="authorizationSaving" @click="saveAuthorization">
          保存配置
        </el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { opsApi, userTableViewsApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import type {
  OpsHealthStatus,
  PlatformAuthMode,
  PlatformAuthorizationConfig,
  PlatformAuthorizationStatus,
  PlatformInterfaceStatus,
  TableDensity,
  UserTableView
} from '@/types/system';

const tableKey = 'ops_platform_interface_status';
const healthStatusOptions = [
  { label: '正常', value: 'normal' },
  { label: '警告', value: 'warning' },
  { label: '异常', value: 'error' },
  { label: '严重', value: 'critical' },
  { label: '未知', value: 'unknown' }
];
const authorizationStatusOptions = [
  { label: '已配置', value: 'configured' },
  { label: '即将过期', value: 'expiring' },
  { label: '已过期', value: 'expired' },
  { label: '未配置', value: 'not_configured' },
  { label: '无需授权', value: 'not_required' },
  { label: '未知', value: 'unknown' }
];
const authorizationModeOptions: Array<{ label: string; value: PlatformAuthMode }> = [
  { label: 'OAuth', value: 'oauth' },
  { label: '手工 Token', value: 'manual_token' },
  { label: '应用凭据', value: 'app_credentials' }
];
const columnOptions = [
  { label: '平台', value: 'platform', required: true },
  { label: '状态', value: 'status' },
  { label: '授权', value: 'authorizationStatus' },
  { label: 'Token 有效期', value: 'tokenExpiresAt' },
  { label: '最近同步', value: 'lastSyncAt' },
  { label: '调用次数', value: 'requestCount' },
  { label: '错误率', value: 'errorRate' },
  { label: '失败请求', value: 'failedRequestCount' },
  { label: '失败日志', value: 'failureLogCount' },
  { label: '最近失败时间', value: 'lastFailureAt' },
  { label: '重试记录', value: 'retryLogCount' },
  { label: '最近重试', value: 'lastRetryAt' },
  { label: '最近失败', value: 'lastFailureReason' },
  { label: '说明', value: 'message' }
];

const loading = ref(false);
const testingAll = ref(false);
const testingPlatform = ref('');
const reauthorizingPlatform = ref('');
const platforms = ref<PlatformInterfaceStatus[]>([]);
const authorizationDialogVisible = ref(false);
const authorizationLoading = ref(false);
const authorizationSaving = ref(false);
const oauthStarting = ref(false);
const authorizationPlatform = ref<PlatformInterfaceStatus | null>(null);
const authorizationConfig = ref<PlatformAuthorizationConfig | null>(null);
const authorizationForm = reactive({
  authMode: 'oauth' as PlatformAuthMode,
  shopName: '',
  appKey: '',
  appSecret: '',
  accessToken: '',
  refreshToken: '',
  tokenExpiresAt: '',
  scopesText: '',
  authorizationUrl: '',
  tokenUrl: '',
  redirectUri: '',
  clientIdParam: 'client_id',
  clearSecrets: false
});
const query = reactive({
  keyword: '',
  status: '' as OpsHealthStatus | '',
  authorizationStatus: '' as PlatformAuthorizationStatus | ''
});
const tableDensity = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const viewsLoaded = ref(false);

const normalCount = computed(
  () => platforms.value.filter((item) => item.status === 'normal').length
);
const errorCount = computed(
  () =>
    platforms.value.filter(
      (item) => item.status === 'error' || item.status === 'critical' || item.status === 'warning'
    ).length
);
const notConfiguredCount = computed(
  () =>
    platforms.value.filter(
      (item) =>
        item.authorizationStatus === 'not_configured' || item.authorizationStatus === 'expired'
    ).length
);
const tableSize = computed(() => {
  if (tableDensity.value === 'compact') return 'small';
  if (tableDensity.value === 'loose') return 'large';
  return 'default';
});
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const authorizationLabel = authorizationStatusOptions.find(
    (option) => option.value === query.authorizationStatus
  )?.label;
  if (authorizationLabel) {
    chips.push({ key: 'authorizationStatus', label: '授权', value: authorizationLabel });
  }
  return chips;
});
const platformRows = computed(() => {
  const keyword = query.keyword.trim().toLowerCase();
  const filtered = platforms.value.filter((item) => {
    const matchesKeyword = keyword
      ? [
          item.platform,
          item.displayName,
          item.message,
          item.lastFailureReason,
          item.failedRequestCount,
          item.failureLogCount,
          item.retryLogCount,
          getHealthLabel(item.status),
          getAuthorizationLabel(item.authorizationStatus)
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword))
      : true;
    const matchesStatus = query.status ? item.status === query.status : true;
    const matchesAuthorization = query.authorizationStatus
      ? item.authorizationStatus === query.authorizationStatus
      : true;
    return matchesKeyword && matchesStatus && matchesAuthorization;
  });

  return sortPlatforms(filtered);
});

onMounted(() => {
  void loadTableViews();
  void loadPlatforms();
});

async function loadPlatforms() {
  loading.value = true;
  try {
    const result = await opsApi.platforms();
    platforms.value = result.items;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  // 固定平台状态列表在客户端筛选，无需重新请求。
}

function handleSortChange(payload: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
}

function clearFilters() {
  query.keyword = '';
  query.status = '';
  query.authorizationStatus = '';
  savedViewId.value = '';
  tableDensity.value = 'default';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'authorizationStatus') query.authorizationStatus = '';
}

async function loadTableViews(applyDefault = true) {
  if (viewsLoaded.value && applyDefault) return;
  try {
    const data = await userTableViewsApi.list({ page: 1, pageSize: 100, tableKey });
    savedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) applyView(defaultView);
      viewsLoaded.value = true;
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存平台接口状态视图', {
      inputValue: '平台接口状态常用视图',
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
        status: query.status,
        authorizationStatus: query.authorizationStatus
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : columnOptions.map((column) => column.value),
      density: tableDensity.value,
      pageSize: 20,
      isDefault: savedViews.value.length === 0
    });
    await loadTableViews(false);
    savedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

function applySavedView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyView(view);
  ElMessage.success('已应用保存视图');
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isHealthStatus(filters.status) ? filters.status : '';
  query.authorizationStatus = isAuthorizationStatus(filters.authorizationStatus)
    ? filters.authorizationStatus
    : '';
  tableDensity.value = view.density;
  visibleColumns.value = normalizeColumns(view.columns);
  sortConfig.value = parseSortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function normalizeColumns(columns: string[]) {
  const allowed = new Set(columnOptions.map((option) => option.value));
  return columns.length
    ? columns.filter((column) => allowed.has(column))
    : columnOptions.map((column) => column.value);
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

function sortPlatforms(items: PlatformInterfaceStatus[]) {
  const prop = sortConfig.value.prop;
  const order = sortConfig.value.order;
  if (!prop || !order) return items;

  const direction = order === 'ascending' ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = getSortableValue(left, prop);
    const rightValue = getSortableValue(right, prop);
    if (leftValue === rightValue) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return leftValue > rightValue ? direction : -direction;
  });
}

function getSortableValue(item: PlatformInterfaceStatus, prop: string): string | number | null {
  if (
    prop === 'requestCount' ||
    prop === 'failedRequestCount' ||
    prop === 'failureLogCount' ||
    prop === 'retryLogCount'
  ) {
    return Number(item[prop as keyof PlatformInterfaceStatus]) || 0;
  }
  if (prop === 'errorRate') return Number.parseFloat(item.errorRate) || 0;
  if (
    prop === 'tokenExpiresAt' ||
    prop === 'lastSyncAt' ||
    prop === 'lastFailureAt' ||
    prop === 'lastRetryAt'
  ) {
    const value = item[prop];
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  const value = item[prop as keyof PlatformInterfaceStatus];
  if (value === undefined || value === null) return null;
  return String(value).toLowerCase();
}

function showExportMessage() {
  ElMessage.info('平台接口状态导出会走数据中心导出任务，后续统一接入');
}

async function testPlatform(row: PlatformInterfaceStatus) {
  testingPlatform.value = row.platform;
  try {
    const result = await opsApi.testPlatformConnection(row.platform, { syncType: 'test' });
    if (result.status === 'normal') {
      ElMessage.success(result.message);
    } else {
      ElMessage.warning(result.message);
    }
    await loadPlatforms();
  } finally {
    testingPlatform.value = '';
  }
}

async function testAllPlatforms() {
  testingAll.value = true;
  try {
    for (const platform of platforms.value) {
      await opsApi.testPlatformConnection(platform.platform, { syncType: 'test_all' });
    }
    ElMessage.success('平台连接测试已完成');
    await loadPlatforms();
  } finally {
    testingAll.value = false;
  }
}

async function reauthorize(row: PlatformInterfaceStatus) {
  authorizationPlatform.value = row;
  authorizationDialogVisible.value = true;
  authorizationLoading.value = true;
  reauthorizingPlatform.value = row.platform;
  try {
    const config = await opsApi.platformAuthorization(row.platform);
    authorizationConfig.value = config;
    fillAuthorizationForm(config);
  } finally {
    reauthorizingPlatform.value = '';
    authorizationLoading.value = false;
  }
}

async function saveAuthorization() {
  if (!authorizationPlatform.value) return;
  authorizationSaving.value = true;
  try {
    const result = await opsApi.savePlatformAuthorization(authorizationPlatform.value.platform, {
      authMode: authorizationForm.authMode,
      shopName: authorizationForm.shopName || null,
      appKey: authorizationForm.appKey || undefined,
      appSecret: authorizationForm.appSecret || undefined,
      accessToken: authorizationForm.accessToken || undefined,
      refreshToken: authorizationForm.refreshToken || undefined,
      tokenExpiresAt: authorizationForm.tokenExpiresAt || null,
      scopes: parseScopes(authorizationForm.scopesText),
      authorizationUrl: authorizationForm.authorizationUrl || null,
      tokenUrl: authorizationForm.tokenUrl || null,
      redirectUri: authorizationForm.redirectUri || null,
      clientIdParam: authorizationForm.clientIdParam || 'client_id',
      clearSecrets: authorizationForm.clearSecrets
    });
    authorizationConfig.value = result;
    fillAuthorizationForm(result);
    ElMessage.success('平台授权配置已保存');
    authorizationDialogVisible.value = false;
    await loadPlatforms();
  } finally {
    authorizationSaving.value = false;
  }
}

async function startOAuth() {
  if (!authorizationPlatform.value) return;
  oauthStarting.value = true;
  try {
    const result = await opsApi.startPlatformOAuth(authorizationPlatform.value.platform, {
      authorizationUrl: authorizationForm.authorizationUrl || null,
      redirectUri: authorizationForm.redirectUri || null,
      scopes: parseScopes(authorizationForm.scopesText),
      clientIdParam: authorizationForm.clientIdParam || 'client_id'
    });
    window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
    ElMessage.success('已生成 OAuth 授权链接，请在新窗口完成平台授权');
  } finally {
    oauthStarting.value = false;
  }
}

function fillAuthorizationForm(config: PlatformAuthorizationConfig) {
  authorizationForm.authMode = config.authMode;
  authorizationForm.shopName = config.shopName ?? '';
  authorizationForm.appKey = '';
  authorizationForm.appSecret = '';
  authorizationForm.accessToken = '';
  authorizationForm.refreshToken = '';
  authorizationForm.tokenExpiresAt = config.tokenExpiresAt ?? '';
  authorizationForm.scopesText = config.scopes.join(',');
  authorizationForm.authorizationUrl = config.authorizationUrl ?? '';
  authorizationForm.tokenUrl = config.tokenUrl ?? '';
  authorizationForm.redirectUri = config.redirectUri ?? '';
  authorizationForm.clientIdParam = config.clientIdParam || 'client_id';
  authorizationForm.clearSecrets = false;
}

function parseScopes(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getHealthLabel(status: OpsHealthStatus) {
  return (
    {
      normal: '正常',
      warning: '警告',
      error: '异常',
      critical: '严重',
      unknown: '未知'
    }[status] ?? status
  );
}

function getHealthTagType(status: OpsHealthStatus) {
  if (status === 'normal') return 'success';
  if (status === 'warning' || status === 'unknown') return 'warning';
  if (status === 'error' || status === 'critical') return 'danger';
  return 'info';
}

function getAuthorizationLabel(status: PlatformAuthorizationStatus) {
  return (
    {
      configured: '已配置',
      expiring: '即将过期',
      expired: '已过期',
      not_configured: '未配置',
      not_required: '无需授权',
      unknown: '未知'
    }[status] ?? status
  );
}

function getAuthorizationTagType(status: PlatformAuthorizationStatus) {
  if (status === 'configured' || status === 'not_required') return 'success';
  if (status === 'not_configured' || status === 'expiring') return 'warning';
  if (status === 'expired') return 'danger';
  return 'info';
}

function isHealthStatus(value: unknown): value is OpsHealthStatus {
  return (
    value === 'normal' ||
    value === 'warning' ||
    value === 'error' ||
    value === 'critical' ||
    value === 'unknown'
  );
}

function isAuthorizationStatus(value: unknown): value is PlatformAuthorizationStatus {
  return (
    value === 'configured' ||
    value === 'expiring' ||
    value === 'expired' ||
    value === 'not_configured' ||
    value === 'not_required' ||
    value === 'unknown'
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function formatErrorRate(value?: string | null) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  return `${(numberValue * 100).toFixed(2)}%`;
}
</script>

<style scoped>
.content-panel {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-color);
}

.muted-block {
  margin-top: 4px;
  color: var(--muted-text-color);
  font-size: 12px;
  line-height: 1.4;
}

.auth-alert {
  margin-bottom: 14px;
}

.auth-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  margin-bottom: 14px;
  color: var(--muted-text-color);
  font-size: 13px;
}

.full-width {
  width: 100%;
}
</style>
