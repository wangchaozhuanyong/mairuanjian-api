<template>
  <PageScaffold
    title="运维监控"
    group="系统管理"
    phase="Phase 12"
    description="监控 API、数据库、Redis、队列、定时任务、平台同步、Worker、文件存储、磁盘空间和最近错误。"
  >
    <template #actions>
      <el-tag type="success" effect="light">已接入接口</el-tag>
      <el-button @click="refreshCurrentTab">刷新</el-button>
      <el-button type="primary" :loading="capturing" @click="captureSnapshot">记录快照</el-button>
      <el-button v-if="activeTab === 'errors'" type="primary" @click="openErrorDialog"
        >记录错误</el-button
      >
    </template>

    <div class="metric-grid metric-grid--five">
      <MetricCard
        label="API"
        :value="getComponentStatus('API')"
        :hint="getComponentMessage('API')"
        :tone="getComponentTone('API')"
      />
      <MetricCard
        label="数据库"
        :value="getComponentStatus('PostgreSQL')"
        :hint="getComponentMessage('PostgreSQL')"
        :tone="getComponentTone('PostgreSQL')"
      />
      <MetricCard
        label="Redis"
        :value="getComponentStatus('Redis')"
        :hint="getComponentMessage('Redis')"
        :tone="getComponentTone('Redis')"
      />
      <MetricCard
        label="队列"
        :value="overview?.queue.status ?? '-'"
        :hint="queueHint"
        :tone="toneOf(overview?.queue.status)"
      />
      <MetricCard
        label="最近错误"
        :value="overview?.recentErrors.length ?? '-'"
        hint="最近 8 条"
        :tone="overview?.recentErrors.length ? 'red' : 'green'"
      />
    </div>

    <section class="content-panel">
      <el-tabs v-model="activeTab" @tab-change="refreshCurrentTab">
        <el-tab-pane label="总览" name="overview">
          <el-table v-loading="overviewLoading" :data="overview?.components ?? []" row-key="name">
            <el-table-column label="服务" min-width="160" prop="name" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><StatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="延迟" width="110">
              <template #default="{ row }">{{ row.latencyMs ?? '-' }} ms</template>
            </el-table-column>
            <el-table-column label="说明" min-width="320" prop="message" />
            <el-table-column label="最近检查" width="180">
              <template #default="{ row }">{{ formatDate(row.checkedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="队列状态" name="queue">
          <div class="current-box">
            <div>
              <span>当前队列</span>
              <strong>{{ queueResult?.current.queueName ?? '-' }}</strong>
            </div>
            <div>
              <span>等待 / 执行 / 失败 / 延迟</span>
              <strong>{{ queueCounts }}</strong>
            </div>
            <StatusTag :status="queueResult?.current.status ?? 'unknown'" />
          </div>
          <el-table :data="queueResult?.logs.items ?? []" row-key="id">
            <el-table-column label="队列" min-width="160" prop="queueName" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><StatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="等待" width="90" prop="waitingCount" />
            <el-table-column label="执行中" width="90" prop="activeCount" />
            <el-table-column label="失败" width="90" prop="failedCount" />
            <el-table-column label="延迟" width="90" prop="delayedCount" />
            <el-table-column label="检查时间" width="180">
              <template #default="{ row }">{{ formatDate(row.checkedAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="queueQuery.page"
            v-model:page-size="queueQuery.pageSize"
            :total="queueResult?.logs.total ?? 0"
            @change="loadQueueStatus"
          />
        </el-tab-pane>

        <el-tab-pane label="定时任务" name="cron">
          <div class="toolbar">
            <el-input
              v-model="cronQuery.keyword"
              class="toolbar-search"
              placeholder="搜索任务名或失败原因"
              clearable
              @keyup.enter="loadCronJobs"
            />
            <el-select
              v-model="cronQuery.status"
              class="toolbar-select"
              placeholder="状态"
              clearable
            >
              <el-option label="运行中" value="running" />
              <el-option label="成功" value="success" />
              <el-option label="失败" value="failed" />
              <el-option label="跳过" value="skipped" />
            </el-select>
            <el-button @click="loadCronJobs">查询</el-button>
          </div>
          <el-table :data="cronJobs" row-key="id">
            <el-table-column label="任务" min-width="180" prop="jobName" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><CronStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="开始" width="180">
              <template #default="{ row }">{{ formatDate(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column label="结束" width="180">
              <template #default="{ row }">{{ formatDate(row.finishedAt) }}</template>
            </el-table-column>
            <el-table-column label="失败原因" min-width="260" prop="errorMessage" />
          </el-table>
          <PaginationBar
            v-model:page="cronQuery.page"
            v-model:page-size="cronQuery.pageSize"
            :total="cronTotal"
            @change="loadCronJobs"
          />
        </el-tab-pane>

        <el-tab-pane label="平台同步" name="platforms">
          <el-table :data="platformResult?.current ?? []" row-key="platform">
            <el-table-column label="平台" width="130">
              <template #default="{ row }">{{ getPlatformLabel(row.platform) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><StatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="同步类型" width="120" prop="syncType" />
            <el-table-column label="错误率" width="100" prop="errorRate" />
            <el-table-column label="最近失败" min-width="260" prop="errorMessage" />
            <el-table-column label="最近检查" width="180">
              <template #default="{ row }">{{ formatDate(row.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button text type="primary" @click="testPlatform(row.platform)">测试</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-divider />
          <el-table :data="platformResult?.logs.items ?? []" row-key="id">
            <el-table-column label="平台" width="120">
              <template #default="{ row }">{{ getPlatformLabel(row.platform) }}</template>
            </el-table-column>
            <el-table-column label="类型" width="110" prop="syncType" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === 'success' ? 'success' : 'danger'"
                  size="small"
                  effect="light"
                >
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="请求数" width="90" prop="requestCount" />
            <el-table-column label="错误率" width="90" prop="errorRate" />
            <el-table-column label="失败原因" min-width="240" prop="errorMessage" />
            <el-table-column label="完成时间" width="180">
              <template #default="{ row }">{{ formatDate(row.finishedAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="Worker / 存储 / 磁盘" name="resources">
          <el-table :data="resourceRows" row-key="name">
            <el-table-column label="资源" min-width="160" prop="name" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><StatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="说明" min-width="320" prop="message" />
            <el-table-column label="指标" min-width="320">
              <template #default="{ row }">
                <code class="json-cell">{{ JSON.stringify(row.metrics ?? {}) }}</code>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="最近错误" name="errors">
          <div class="toolbar">
            <el-input
              v-model="errorQuery.keyword"
              class="toolbar-search"
              placeholder="搜索模块、错误信息、堆栈"
              clearable
              @keyup.enter="loadErrors"
            />
            <el-select
              v-model="errorQuery.level"
              class="toolbar-select"
              placeholder="级别"
              clearable
            >
              <el-option label="Info" value="info" />
              <el-option label="Warn" value="warn" />
              <el-option label="Error" value="error" />
              <el-option label="Fatal" value="fatal" />
            </el-select>
            <el-button @click="loadErrors">查询</el-button>
          </div>
          <el-table :data="errors" row-key="id">
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getErrorTagType(row.level)" size="small" effect="light">
                  {{ row.level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="模块" width="140" prop="module" />
            <el-table-column label="错误信息" min-width="320" prop="message" />
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatDate(row.occurredAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="errorQuery.page"
            v-model:page-size="errorQuery.pageSize"
            :total="errorTotal"
            @change="loadErrors"
          />
        </el-tab-pane>

        <el-tab-pane label="健康快照" name="snapshots">
          <el-table :data="snapshots" row-key="id">
            <el-table-column label="API" width="100">
              <template #default="{ row }"><StatusTag :status="row.apiStatus" /></template>
            </el-table-column>
            <el-table-column label="DB" width="100">
              <template #default="{ row }"><StatusTag :status="row.dbStatus" /></template>
            </el-table-column>
            <el-table-column label="Redis" width="100">
              <template #default="{ row }"><StatusTag :status="row.redisStatus" /></template>
            </el-table-column>
            <el-table-column label="队列" width="100">
              <template #default="{ row }"><StatusTag :status="row.queueStatus" /></template>
            </el-table-column>
            <el-table-column label="Worker" width="110">
              <template #default="{ row }"><StatusTag :status="row.workerStatus" /></template>
            </el-table-column>
            <el-table-column label="磁盘使用率" width="120" prop="diskUsage" />
            <el-table-column label="检查时间" width="180">
              <template #default="{ row }">{{ formatDate(row.checkedAt) }}</template>
            </el-table-column>
          </el-table>
          <PaginationBar
            v-model:page="snapshotQuery.page"
            v-model:page-size="snapshotQuery.pageSize"
            :total="snapshotTotal"
            @change="loadSnapshots"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog v-model="errorDialogVisible" title="记录运维错误" width="620px">
      <el-form label-width="90px">
        <el-form-item label="级别">
          <el-select v-model="errorForm.level">
            <el-option label="Info" value="info" />
            <el-option label="Warn" value="warn" />
            <el-option label="Error" value="error" />
            <el-option label="Fatal" value="fatal" />
          </el-select>
        </el-form-item>
        <el-form-item label="模块" required><el-input v-model="errorForm.module" /></el-form-item>
        <el-form-item label="信息" required>
          <el-input v-model="errorForm.message" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="上下文 JSON">
          <el-input v-model="errorForm.contextText" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="errorDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingError" @click="createError">保存</el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { opsApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import type {
  CronJobLog,
  CronJobLogStatus,
  ErrorLog,
  ErrorLogLevel,
  OpsComponentStatus,
  OpsHealthStatus,
  OpsOverview,
  PlatformSyncLogStatus,
  SystemHealthSnapshot
} from '@/types/system';

const overview = ref<OpsOverview | null>(null);
const overviewLoading = ref(false);
const activeTab = ref('overview');
const capturing = ref(false);

const queueResult = ref<Awaited<ReturnType<typeof opsApi.queueStatus>> | null>(null);
const queueQuery = reactive({
  page: 1,
  pageSize: 10,
  queueName: '',
  status: '' as OpsHealthStatus | ''
});

const cronJobs = ref<CronJobLog[]>([]);
const cronTotal = ref(0);
const cronQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  status: '' as CronJobLogStatus | ''
});

const platformResult = ref<Awaited<ReturnType<typeof opsApi.platformSyncStatus>> | null>(null);
const platformQuery = reactive({
  page: 1,
  pageSize: 10,
  platform: '',
  status: '' as PlatformSyncLogStatus | ''
});

const resourceRows = ref<OpsComponentStatus[]>([]);

const errors = ref<ErrorLog[]>([]);
const errorTotal = ref(0);
const errorQuery = reactive({
  page: 1,
  pageSize: 10,
  keyword: '',
  module: '',
  level: '' as ErrorLogLevel | ''
});

const snapshots = ref<SystemHealthSnapshot[]>([]);
const snapshotTotal = ref(0);
const snapshotQuery = reactive({ page: 1, pageSize: 10, status: '' as OpsHealthStatus | '' });

const errorDialogVisible = ref(false);
const savingError = ref(false);
const errorForm = reactive({
  level: 'error' as ErrorLogLevel,
  module: 'ops',
  message: '',
  contextText: '{}'
});

const queueHint = computed(() => {
  const queue = overview.value?.queue;
  if (!queue) return '等待数据';
  return `等待 ${queue.waitingCount}，失败 ${queue.failedCount}`;
});

const queueCounts = computed(() => {
  const queue = queueResult.value?.current;
  if (!queue) return '-';
  return `${queue.waitingCount} / ${queue.activeCount} / ${queue.failedCount} / ${queue.delayedCount}`;
});

onMounted(() => {
  void refreshCurrentTab();
});

async function refreshCurrentTab() {
  await loadOverview();
  if (activeTab.value === 'queue') await loadQueueStatus();
  if (activeTab.value === 'cron') await loadCronJobs();
  if (activeTab.value === 'platforms') await loadPlatformSync();
  if (activeTab.value === 'resources') await loadResources();
  if (activeTab.value === 'errors') await loadErrors();
  if (activeTab.value === 'snapshots') await loadSnapshots();
}

async function loadOverview() {
  overviewLoading.value = true;
  try {
    overview.value = await opsApi.overview();
  } finally {
    overviewLoading.value = false;
  }
}

async function loadQueueStatus() {
  queueResult.value = await opsApi.queueStatus(queueQuery);
}

async function loadCronJobs() {
  const result = await opsApi.cronJobs(cronQuery);
  cronJobs.value = result.items;
  cronTotal.value = result.total;
}

async function loadPlatformSync() {
  platformResult.value = await opsApi.platformSyncStatus(platformQuery);
}

async function loadResources() {
  resourceRows.value = await Promise.all([
    opsApi.automationWorkers(),
    opsApi.fileStorageStatus(),
    opsApi.diskSpace()
  ]);
}

async function loadErrors() {
  const result = await opsApi.errorLogs(errorQuery);
  errors.value = result.items;
  errorTotal.value = result.total;
}

async function loadSnapshots() {
  const result = await opsApi.healthSnapshots(snapshotQuery);
  snapshots.value = result.items;
  snapshotTotal.value = result.total;
}

async function captureSnapshot() {
  capturing.value = true;
  try {
    await opsApi.captureHealthSnapshot();
    ElMessage.success('健康快照已记录');
    await loadOverview();
    if (activeTab.value === 'snapshots') await loadSnapshots();
    if (activeTab.value === 'queue') await loadQueueStatus();
  } finally {
    capturing.value = false;
  }
}

async function testPlatform(platform: string) {
  const result = await opsApi.testPlatformConnection(platform, { syncType: 'test' });
  if (result.status === 'normal') {
    ElMessage.success(result.message);
  } else {
    ElMessage.warning(result.message);
  }
  await loadPlatformSync();
}

function openErrorDialog() {
  Object.assign(errorForm, {
    level: 'error',
    module: 'ops',
    message: '',
    contextText: '{}'
  });
  errorDialogVisible.value = true;
}

async function createError() {
  let context: Record<string, unknown>;
  try {
    context = JSON.parse(errorForm.contextText) as Record<string, unknown>;
  } catch {
    ElMessage.error('上下文必须是合法 JSON');
    return;
  }
  savingError.value = true;
  try {
    await opsApi.createErrorLog({
      level: errorForm.level,
      module: errorForm.module,
      message: errorForm.message,
      context
    });
    ElMessage.success('错误日志已记录');
    errorDialogVisible.value = false;
    await loadErrors();
    await loadOverview();
  } finally {
    savingError.value = false;
  }
}

function getComponentStatus(name: string) {
  return overview.value?.components.find((item) => item.name === name)?.status ?? '-';
}

function getComponentMessage(name: string) {
  return overview.value?.components.find((item) => item.name === name)?.message ?? '等待检查';
}

function getComponentTone(name: string) {
  return toneOf(overview.value?.components.find((item) => item.name === name)?.status);
}

function toneOf(status?: string): 'blue' | 'green' | 'orange' | 'red' | 'purple' {
  if (status === 'normal') return 'green';
  if (status === 'warning' || status === 'unknown') return 'orange';
  if (status === 'error' || status === 'critical') return 'red';
  return 'blue';
}

function getErrorTagType(level: string) {
  if (level === 'fatal' || level === 'error') return 'danger';
  if (level === 'warn') return 'warning';
  return 'info';
}

function getPlatformLabel(platform: string) {
  return (
    {
      taobao: '淘宝',
      xianyu: '闲鱼',
      telegram: 'Telegram',
      storage: '文件存储',
      automation: '自动化'
    }[platform] ?? platform
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}
</script>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  components: {
    StatusTag: {
      props: {
        status: { type: String, required: true }
      },
      methods: {
        getStatusLabel(status: string) {
          return (
            {
              normal: '正常',
              warning: '警告',
              error: '异常',
              critical: '严重',
              unknown: '未知'
            }[status] ?? status
          );
        },
        getStatusTagType(status: string) {
          if (status === 'normal') return 'success';
          if (status === 'warning' || status === 'unknown') return 'warning';
          if (status === 'error' || status === 'critical') return 'danger';
          return 'info';
        }
      },
      template: `
        <el-tag :type="getStatusTagType(status)" size="small" effect="light">
          {{ getStatusLabel(status) }}
        </el-tag>
      `
    },
    CronStatusTag: {
      props: {
        status: { type: String, required: true }
      },
      methods: {
        getCronStatusLabel(status: string) {
          return (
            { running: '运行中', success: '成功', failed: '失败', skipped: '跳过' }[status] ??
            status
          );
        },
        getCronTagType(status: string) {
          if (status === 'success') return 'success';
          if (status === 'running') return 'primary';
          if (status === 'failed') return 'danger';
          return 'info';
        }
      },
      template: `
        <el-tag :type="getCronTagType(status)" size="small" effect="light">
          {{ getCronStatusLabel(status) }}
        </el-tag>
      `
    },
    PaginationBar: {
      props: {
        page: { type: Number, required: true },
        pageSize: { type: Number, required: true },
        total: { type: Number, required: true }
      },
      emits: ['update:page', 'update:pageSize', 'change'],
      template: `
        <div class="pagination-row">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="total, sizes, prev, pager, next"
            @current-change="$emit('update:page', $event); $emit('change')"
            @size-change="$emit('update:pageSize', $event); $emit('change')"
          />
        </div>
      `
    }
  }
});
</script>

<style scoped>
.content-panel {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-color);
}

.current-box {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--muted-bg-color);
}

.current-box span {
  display: block;
  margin-bottom: 4px;
  color: var(--muted-text-color);
  font-size: 12px;
}

.current-box strong {
  color: var(--text-color);
  font-size: 18px;
}

.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.toolbar-search {
  width: min(320px, 100%);
}

.toolbar-select {
  width: 150px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.json-cell {
  display: inline-block;
  max-width: 100%;
  padding: 2px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 4px;
  background: var(--muted-bg-color);
  color: var(--text-color);
}

@media (max-width: 760px) {
  .current-box {
    align-items: flex-start;
    flex-direction: column;
  }

  .toolbar-search,
  .toolbar-select {
    width: 100%;
  }
}
</style>
