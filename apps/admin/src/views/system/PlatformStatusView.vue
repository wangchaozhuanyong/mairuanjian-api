<template>
  <PageScaffold
    title="平台连接状态"
    group="平台连接"
    phase="Phase 14"
    description="查看 Telegram、文件存储、自动化服务等外部连接有没有连上，授权有没有过期，同步有没有失败。"
  >
    <template #actions>
      <AppButton @click="() => loadPlatforms({ force: true })">刷新</AppButton>
      <AppButton variant="primary" :loading="testingAll" @click="testAllPlatforms">
        测试全部
      </AppButton>
    </template>

    <section class="content-panel" aria-label="平台接口概览">
      <div class="detail-note-grid">
        <div class="detail-note-item">
          <span>平台数量</span>
          <strong>{{ platforms.length }}</strong>
          <span>当前监控对象</span>
        </div>
        <div class="detail-note-item">
          <span>正常</span>
          <strong>{{ normalCount }}</strong>
          <span>状态正常的平台</span>
        </div>
        <div class="detail-note-item">
          <span>异常</span>
          <strong>{{ errorCount }}</strong>
          <span>需要处理的平台</span>
        </div>
        <div class="detail-note-item">
          <span>未配置</span>
          <strong>{{ notConfiguredCount }}</strong>
          <span>授权或配置未完成</span>
        </div>
      </div>
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="平台接口健康台账"
          help="这里看 Telegram、文件存储、自动化服务等外部接口是否正常，比如授权有没有过期、同步有没有失败、错误是不是变多了。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>平台接口</StatusChip>
          <StatusChip :tone="errorCount > 0 ? 'red' : 'green'" dot>
            {{ errorCount > 0 ? `异常 ${errorCount}` : '接口稳定' }}
          </StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
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
        @refresh="() => loadPlatforms({ force: true })"
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
        class="desktop-data-table"
        :data="platformRows"
        :size="tableSize"
        row-key="platform"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无平台接口状态</strong>
            <span>可以清空筛选，或到平台授权配置中测试连接状态。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            </div>
          </div>
        </template>
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
            <StatusChip :tone="getHealthTone(row.status)" dot>
              {{ getHealthLabel(row.status) }}
            </StatusChip>
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
            <StatusChip :tone="getAuthorizationTone(row.authorizationStatus)" dot>
              {{ getAuthorizationLabel(row.authorizationStatus) }}
            </StatusChip>
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
            <AppButton
              size="small"
              variant="ghost"
              :disabled="!row.canTestConnection"
              :loading="testingPlatform === row.platform"
              @click="testPlatform(row)"
            >
              测试
            </AppButton>
            <AppButton
              size="small"
              variant="ghost"
              :disabled="!row.canReauthorize"
              :loading="reauthorizingPlatform === row.platform"
              @click="reauthorize(row)"
            >
              授权配置
            </AppButton>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="platformRows.length" class="mobile-record-list" aria-label="平台接口状态移动列表">
        <article
          v-for="platform in platformRows"
          :key="platform.platform"
          class="mobile-record-card"
        >
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ platform.displayName }}</strong>
              <span>{{ platform.platform }} · {{ platform.message }}</span>
            </div>
            <StatusChip :tone="getHealthTone(platform.status)" dot>
              {{ getHealthLabel(platform.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>授权</span>
              <strong>{{ getAuthorizationLabel(platform.authorizationStatus) }}</strong>
            </div>
            <div>
              <span>错误率</span>
              <strong>{{ formatErrorRate(platform.errorRate) }}</strong>
            </div>
            <div>
              <span>调用次数</span>
              <strong>{{ platform.requestCount }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>Token 有效期</span>
              <strong>{{ formatDate(platform.tokenExpiresAt) }}</strong>
            </div>
            <div>
              <span>最近失败</span>
              <strong>{{ platform.lastFailureReason || '-' }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__chips">
            <StatusChip :tone="getAuthorizationTone(platform.authorizationStatus)" dot>
              {{ getAuthorizationLabel(platform.authorizationStatus) }}
            </StatusChip>
            <StatusChip tone="blue">最近同步 {{ formatDate(platform.lastSyncAt) }}</StatusChip>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton
              size="small"
              variant="ghost"
              :disabled="!platform.canTestConnection"
              :loading="testingPlatform === platform.platform"
              @click="testPlatform(platform)"
            >
              测试
            </AppButton>
            <AppButton
              size="small"
              variant="soft"
              :disabled="!platform.canReauthorize"
              :loading="reauthorizingPlatform === platform.platform"
              @click="reauthorize(platform)"
            >
              授权配置
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无平台接口状态</strong>
          <span>可以清空筛选或刷新平台接口状态后重新查看。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" :loading="loading" @click="() => loadPlatforms()">
              刷新
            </AppButton>
          </div>
        </div>
      </div>
    </section>

    <el-dialog
      v-model="authorizationDialogVisible"
      :title="`${authorizationPlatform?.displayName ?? ''}授权配置`"
      width="min(760px, calc(100vw - 24px))"
      destroy-on-close
    >
      <el-skeleton v-if="authorizationLoading" :rows="5" animated />
      <el-form v-else label-position="top">
        <div class="apple-core-alert apple-core-alert--orange auth-alert">
          <StatusChip tone="orange">敏感</StatusChip>
          <div>
            <strong>敏感字段只支持重新填写，不会回显历史明文</strong>
            <p>真实平台接口接入前，保存配置只代表凭据已托管。</p>
          </div>
        </div>
        <div v-if="authorizationConfig" class="auth-summary">
          <StatusChip :tone="authorizationConfig.configured ? 'green' : 'orange'" dot>
            {{ authorizationConfig.configured ? '已保存授权配置' : '未保存授权配置' }}
          </StatusChip>
          <span>App Key 尾号：{{ authorizationConfig.appKeyTail || '-' }}</span>
          <span>Access Token 尾号：{{ authorizationConfig.accessTokenTail || '-' }}</span>
          <span>Refresh Token 尾号：{{ authorizationConfig.refreshTokenTail || '-' }}</span>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="授权方式"
              purpose="说明这个平台接口使用哪种授权模式，后续真实对接会按它处理 Token。"
              example="开放平台 OAuth 选 OAuth；手工托管 Token 选手工 Token。"
            />
          </template>
          <el-select v-model="authorizationForm.authMode" class="full-width">
            <el-option
              v-for="option in authorizationModeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="店铺/账号名称"
              purpose="记录这组平台授权属于哪个店铺或账号，避免多个店铺混用。"
              example="可以填主账号、企业账号、通知服务账号。"
            />
          </template>
          <el-input v-model.trim="authorizationForm.shopName" placeholder="例如：通知服务账号" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="App Key"
              purpose="平台开放应用的公开标识，会加密托管，编辑时不填表示保留原配置。"
              example="从对应外部服务后台复制 App Key。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.appKey"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="App Secret"
              purpose="平台开放应用的密钥，属于敏感信息，会加密保存且不会回显明文。"
              example="从开放平台复制完整 Secret；只改其他字段时这里留空。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.appSecret"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="Access Token"
              purpose="平台接口调用凭证，系统会用它同步订单或发货，会加密保存。"
              example="手工托管时粘贴当前有效 Token；不更新 Token 就留空。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.accessToken"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="Refresh Token"
              purpose="用于刷新 Access Token 的长期凭证，属于敏感信息，会加密保存。"
              example="平台提供 refresh token 时填写；不提供可留空。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.refreshToken"
            placeholder="不填写则保留原配置"
            show-password
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="Token 有效期"
              purpose="记录 Access Token 到什么时候失效，系统可据此提醒授权过期。"
              example="按 ISO 时间填写，如 2026-07-01T00:00:00.000Z。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.tokenExpiresAt"
            placeholder="例如：2026-07-01T00:00:00.000Z"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="授权范围"
              purpose="记录平台允许这组凭证访问哪些接口能力。"
              example="多个范围用英文逗号分隔，如 order.read,delivery.write。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.scopesText"
            placeholder="多个范围用英文逗号分隔，例如 order.read,delivery.write"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="授权地址"
              purpose="OAuth 授权跳转地址，用于发起平台授权。"
              example="填写平台文档里的 authorize URL，如 https://open.example.com/oauth/authorize。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.authorizationUrl"
            placeholder="例如：https://open.example.com/oauth/authorize"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="Token 地址"
              purpose="OAuth 换取或刷新 Token 的接口地址。"
              example="填写平台文档里的 token URL，真实平台接入时会使用。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.tokenUrl"
            placeholder="真实平台接入 token 交换时使用"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="回调地址"
              purpose="平台授权完成后跳回系统的地址。"
              example="不确定就留空使用后端默认回调；自定义域名上线后再填写正式回调。"
            />
          </template>
          <el-input
            v-model.trim="authorizationForm.redirectUri"
            placeholder="不填写则使用后端默认回调地址"
          />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="Client ID 参数名"
              purpose="平台授权 URL 中客户端标识参数的名字。"
              example="多数平台是 client_id，部分平台可能叫 app_key。"
            />
          </template>
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
        <AppButton @click="authorizationDialogVisible = false">取消</AppButton>
        <AppButton
          variant="soft"
          :loading="oauthStarting"
          :disabled="authorizationForm.authMode !== 'oauth'"
          @click="startOAuth"
        >
          发起 OAuth
        </AppButton>
        <AppButton variant="primary" :loading="authorizationSaving" @click="saveAuthorization">
          保存配置
        </AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { dataCenterApi, opsApi, userTableViewsApi } from '@/api/system';
import type { DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  DataDictionary,
  OpsHealthStatus,
  PlatformAuthorizationConfig,
  PlatformAuthorizationStatus,
  PlatformInterfaceStatus,
  TableDensity,
  UserTableView
} from '@/types/system';
import { PLATFORM_AUTH_MODE_DICTIONARY_GROUP } from '@/config/quickSettings';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import { buildPlatformAuthModeOptions } from '@/utils/systemQuickOptions';

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
const authorizationModeDictionaries = ref<DataDictionary[]>([]);
const authorizationModeOptions = computed(() =>
  buildPlatformAuthModeOptions(authorizationModeDictionaries.value)
);
function getDefaultPlatformAuthMode() {
  return authorizationModeOptions.value[0]?.value ?? 'oauth';
}
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
  authMode: getDefaultPlatformAuthMode(),
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
const activePlatformsQueryKey = ref('');

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
  void Promise.all([
    loadTableViews(),
    loadPlatformOptions({ force: false }),
    loadPlatforms({ force: false })
  ]);
});

usePageRefresh(
  async (options) => {
    await Promise.all([
      loadPlatformOptions({
        background: options.background,
        force: options.force ?? true
      }),
      loadPlatforms({
        background: options.background,
        force: options.force ?? true
      })
    ]);
  },
  { label: '平台接口状态' }
);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['ops-platform-status', 'data-dictionaries'],
  ({ scopes }) => {
    if (scopes.includes('data-dictionaries')) {
      void loadPlatformOptions({
        background: authorizationModeDictionaries.value.length > 0,
        force: true
      });
    }

    if (scopes.includes('ops-platform-status')) {
      void loadPlatforms({
        background: platforms.value.length > 0,
        force: true
      });
    }
  }
);

onBeforeUnmount(stopRealtimeRefresh);

function buildPlatformOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadPlatformOptions(options: { background?: boolean; force?: boolean } = {}) {
  try {
    const data = await dataCenterApi.listDictionaries(
      buildPlatformOptionParams(PLATFORM_AUTH_MODE_DICTIONARY_GROUP)
    );
    authorizationModeDictionaries.value = data.items;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载平台接口选项失败');
    }
  }
}

async function loadPlatforms(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('ops-platform-status');
  const cached = getSmartQueryData<{ items: PlatformInterfaceStatus[] }>(key);

  activePlatformsQueryKey.value = key;

  if (cached) {
    platforms.value = cached.items;
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => opsApi.platforms(),
      force: options.force ?? true
    });

    if (activePlatformsQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      platforms.value = result.data.items;
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载平台接口状态失败');
    }
  } finally {
    if (activePlatformsQueryKey.value === key) {
      loading.value = false;
    }
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
  tableDensity.value = 'default';
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
    await loadPlatforms({ force: true });
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
    await loadPlatforms({ force: true });
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
    await loadPlatforms({ force: true });
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

function getHealthTone(status: OpsHealthStatus) {
  if (status === 'normal') return 'green';
  if (status === 'warning' || status === 'unknown') return 'orange';
  if (status === 'error' || status === 'critical') return 'red';
  return 'neutral';
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

function getAuthorizationTone(status: PlatformAuthorizationStatus) {
  if (status === 'configured' || status === 'not_required') return 'green';
  if (status === 'not_configured' || status === 'expiring') return 'orange';
  if (status === 'expired') return 'red';
  return 'neutral';
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
