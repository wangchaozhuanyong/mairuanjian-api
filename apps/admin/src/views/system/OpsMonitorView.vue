<template>
  <PageScaffold
    title="运维监控"
    group="系统管理"
    phase="Phase 12"
    description="监控 API、数据库、Redis、队列、定时任务、平台同步、Worker、文件存储、磁盘空间和最近错误。"
  >
    <template #actions>
      <AppButton @click="refreshCurrentTab">刷新</AppButton>
      <AppButton variant="primary" :loading="capturing" @click="captureSnapshot">
        记录快照
      </AppButton>
      <AppButton v-if="activeTab === 'errors'" variant="primary" @click="openErrorDialog">
        记录错误
      </AppButton>
    </template>

    <section class="content-panel" aria-label="运维监控概览">
      <div class="detail-note-grid">
        <div class="detail-note-item">
          <span>API</span>
          <strong>{{ getComponentStatus('API') }}</strong>
          <span>{{ getComponentMessage('API') }}</span>
        </div>
        <div class="detail-note-item">
          <span>数据库</span>
          <strong>{{ getComponentStatus('PostgreSQL') }}</strong>
          <span>{{ getComponentMessage('PostgreSQL') }}</span>
        </div>
        <div class="detail-note-item">
          <span>Redis</span>
          <strong>{{ getComponentStatus('Redis') }}</strong>
          <span>{{ getComponentMessage('Redis') }}</span>
        </div>
        <div class="detail-note-item">
          <span>队列</span>
          <strong>{{ overview?.queue.status ?? '-' }}</strong>
          <span>{{ queueHint }}</span>
        </div>
        <div class="detail-note-item">
          <span>最近错误</span>
          <strong>{{ overview?.recentErrors.length ?? '-' }}</strong>
          <span>最近 8 条</span>
        </div>
      </div>
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <div>
          <h3>{{ activeTabMeta.title }}</h3>
          <p>{{ activeTabMeta.description }}</p>
        </div>
        <div class="inline-actions">
          <StatusChip :tone="activeTabMeta.tone" dot>{{ activeTabMeta.badge }}</StatusChip>
        </div>
      </div>

      <el-tabs
        v-model="activeTab"
        class="system-tabs ops-monitor-tabs"
        @tab-change="refreshCurrentTab"
      >
        <el-tab-pane label="总览" name="overview">
          <el-table
            v-loading="overviewLoading"
            class="desktop-data-table"
            :data="overview?.components ?? []"
            row-key="name"
          >
            <el-table-column label="服务" min-width="160" prop="name" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><OpsStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="延迟" width="110">
              <template #default="{ row }">{{ row.latencyMs ?? '-' }} ms</template>
            </el-table-column>
            <el-table-column label="说明" min-width="320" prop="message" />
            <el-table-column label="最近检查" width="180">
              <template #default="{ row }">{{ formatDate(row.checkedAt) }}</template>
            </el-table-column>
          </el-table>
          <div
            v-if="overview?.components?.length"
            class="mobile-record-list"
            aria-label="服务状态移动列表"
          >
            <article
              v-for="component in overview.components"
              :key="component.name"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ component.name }}</strong>
                  <span>{{ component.message }}</span>
                </div>
                <OpsStatusTag :status="component.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>延迟</span>
                  <strong>{{ component.latencyMs ?? '-' }} ms</strong>
                </div>
                <div>
                  <span>最近检查</span>
                  <strong>{{ formatDate(component.checkedAt) }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无服务状态</strong>
              <span>刷新后显示 API、数据库、Redis 和队列检查结果。</span>
            </div>
          </div>
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
            <OpsStatusTag :status="queueResult?.current.status ?? 'unknown'" />
          </div>
          <el-table class="desktop-data-table" :data="queueResult?.logs.items ?? []" row-key="id">
            <el-table-column label="队列" min-width="160" prop="queueName" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><OpsStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="等待" width="90" prop="waitingCount" />
            <el-table-column label="执行中" width="90" prop="activeCount" />
            <el-table-column label="失败" width="90" prop="failedCount" />
            <el-table-column label="延迟" width="90" prop="delayedCount" />
            <el-table-column label="检查时间" width="180">
              <template #default="{ row }">{{ formatDate(row.checkedAt) }}</template>
            </el-table-column>
          </el-table>
          <div
            v-if="queueResult?.logs.items.length"
            class="mobile-record-list"
            aria-label="队列状态移动列表"
          >
            <article v-for="log in queueResult.logs.items" :key="log.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ log.queueName }}</strong>
                  <span>{{ formatDate(log.checkedAt) }}</span>
                </div>
                <OpsStatusTag :status="log.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>等待</span>
                  <strong>{{ log.waitingCount }}</strong>
                </div>
                <div>
                  <span>执行中</span>
                  <strong>{{ log.activeCount }}</strong>
                </div>
                <div>
                  <span>失败</span>
                  <strong>{{ log.failedCount }}</strong>
                </div>
                <div>
                  <span>延迟</span>
                  <strong>{{ log.delayedCount }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无队列日志</strong>
              <span>队列检查后会显示等待、执行、失败和延迟数量。</span>
            </div>
          </div>
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
            <AppButton @click="loadCronJobs">查询</AppButton>
          </div>
          <el-table class="desktop-data-table" :data="cronJobs" row-key="id">
            <el-table-column label="任务" min-width="180" prop="jobName" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><OpsStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="开始" width="180">
              <template #default="{ row }">{{ formatDate(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column label="结束" width="180">
              <template #default="{ row }">{{ formatDate(row.finishedAt) }}</template>
            </el-table-column>
            <el-table-column label="失败原因" min-width="260" prop="errorMessage" />
          </el-table>
          <div v-if="cronJobs.length" class="mobile-record-list" aria-label="定时任务移动列表">
            <article v-for="job in cronJobs" :key="job.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ job.jobName }}</strong>
                  <span>{{ job.errorMessage || '暂无失败原因' }}</span>
                </div>
                <OpsStatusTag :status="job.status" />
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>开始</span>
                  <strong>{{ formatDate(job.startedAt) }}</strong>
                </div>
                <div>
                  <span>结束</span>
                  <strong>{{ formatDate(job.finishedAt) }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无定时任务</strong>
              <span>调整筛选或刷新后查看执行记录。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="cronQuery.page"
            v-model:page-size="cronQuery.pageSize"
            :total="cronTotal"
            @change="loadCronJobs"
          />
        </el-tab-pane>

        <el-tab-pane label="平台同步" name="platforms">
          <el-table
            class="desktop-data-table"
            :data="platformResult?.current ?? []"
            row-key="platform"
          >
            <el-table-column label="平台" width="130">
              <template #default="{ row }">{{ getPlatformLabel(row.platform) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><OpsStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="同步类型" width="120" prop="syncType" />
            <el-table-column label="错误率" width="100" prop="errorRate" />
            <el-table-column label="最近失败" min-width="260" prop="errorMessage" />
            <el-table-column label="最近检查" width="180">
              <template #default="{ row }">{{ formatDate(row.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="table-action-group">
                  <AppButton size="small" variant="ghost" @click="testPlatform(row.platform)">
                    测试
                  </AppButton>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div
            v-if="platformResult?.current.length"
            class="mobile-record-list"
            aria-label="平台状态移动列表"
          >
            <article
              v-for="platform in platformResult.current"
              :key="platform.platform"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getPlatformLabel(platform.platform) }}</strong>
                  <span>{{ platform.errorMessage || '暂无失败信息' }}</span>
                </div>
                <OpsStatusTag :status="platform.status" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>同步类型</span>
                  <strong>{{ platform.syncType || '-' }}</strong>
                </div>
                <div>
                  <span>错误率</span>
                  <strong>{{ platform.errorRate }}</strong>
                </div>
                <div>
                  <span>最近检查</span>
                  <strong>{{ formatDate(platform.lastCheckedAt) }}</strong>
                </div>
              </div>
              <div class="mobile-record-card__actions">
                <AppButton size="small" variant="ghost" @click="testPlatform(platform.platform)">
                  测试连接
                </AppButton>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无平台状态</strong>
              <span>刷新后显示淘宝、闲鱼、Telegram 等接口状态。</span>
            </div>
          </div>

          <h3 class="section-title">平台同步日志</h3>
          <el-table
            class="desktop-data-table"
            :data="platformResult?.logs.items ?? []"
            row-key="id"
          >
            <el-table-column label="平台" width="120">
              <template #default="{ row }">{{ getPlatformLabel(row.platform) }}</template>
            </el-table-column>
            <el-table-column label="类型" width="110" prop="syncType" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <StatusChip :tone="row.status === 'success' ? 'green' : 'red'" dot>
                  {{ row.status === 'success' ? '成功' : '失败' }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="请求数" width="90" prop="requestCount" />
            <el-table-column label="错误率" width="90" prop="errorRate" />
            <el-table-column label="失败原因" min-width="240" prop="errorMessage" />
            <el-table-column label="完成时间" width="180">
              <template #default="{ row }">{{ formatDate(row.finishedAt) }}</template>
            </el-table-column>
          </el-table>
          <div
            v-if="platformResult?.logs.items.length"
            class="mobile-record-list"
            aria-label="平台同步日志移动列表"
          >
            <article
              v-for="log in platformResult.logs.items"
              :key="log.id"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ getPlatformLabel(log.platform) }}</strong>
                  <span>{{ log.syncType }}</span>
                </div>
                <StatusChip :tone="log.status === 'success' ? 'green' : 'red'" dot>
                  {{ log.status === 'success' ? '成功' : '失败' }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>请求数</span>
                  <strong>{{ log.requestCount }}</strong>
                </div>
                <div>
                  <span>错误率</span>
                  <strong>{{ log.errorRate }}</strong>
                </div>
                <div>
                  <span>完成时间</span>
                  <strong>{{ formatDate(log.finishedAt) }}</strong>
                </div>
              </div>
              <div v-if="log.errorMessage" class="mobile-record-card__meta">
                <div>
                  <span>失败原因</span>
                  <strong>{{ log.errorMessage }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无平台同步日志</strong>
              <span>平台同步任务完成后会显示请求数、错误率和失败原因。</span>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="Worker / 存储 / 磁盘" name="resources">
          <el-table class="desktop-data-table" :data="resourceRows" row-key="name">
            <el-table-column label="资源" min-width="160" prop="name" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><OpsStatusTag :status="row.status" /></template>
            </el-table-column>
            <el-table-column label="说明" min-width="320" prop="message" />
            <el-table-column label="指标" min-width="320">
              <template #default="{ row }">
                <code class="json-cell">{{ JSON.stringify(row.metrics ?? {}) }}</code>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="resourceRows.length" class="mobile-record-list" aria-label="资源状态移动列表">
            <article
              v-for="resource in resourceRows"
              :key="resource.name"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ resource.name }}</strong>
                  <span>{{ resource.message }}</span>
                </div>
                <OpsStatusTag :status="resource.status" />
              </div>
              <div class="mobile-record-card__meta">
                <div>
                  <span>指标</span>
                  <strong>{{ JSON.stringify(resource.metrics ?? {}) }}</strong>
                </div>
                <div>
                  <span>最近检查</span>
                  <strong>{{ formatDate(resource.checkedAt) }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无资源状态</strong>
              <span>刷新后显示 Worker、文件存储和磁盘空间指标。</span>
            </div>
          </div>
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
            <AppButton @click="loadErrors">查询</AppButton>
          </div>
          <el-table class="desktop-data-table" :data="errors" row-key="id">
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <StatusChip :tone="getErrorTone(row.level)" dot>
                  {{ row.level }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="模块" width="140" prop="module" />
            <el-table-column label="错误信息" min-width="320" prop="message" />
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ formatDate(row.occurredAt) }}</template>
            </el-table-column>
          </el-table>
          <div v-if="errors.length" class="mobile-record-list" aria-label="错误日志移动列表">
            <article v-for="error in errors" :key="error.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ error.message }}</strong>
                  <span>{{ error.module }} · {{ formatDate(error.occurredAt) }}</span>
                </div>
                <StatusChip :tone="getErrorTone(error.level)" dot>
                  {{ error.level }}
                </StatusChip>
              </div>
              <div v-if="error.stack" class="mobile-record-card__meta">
                <div>
                  <span>堆栈</span>
                  <strong>{{ error.stack }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无错误日志</strong>
              <span>系统运行错误会记录到这里。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="errorQuery.page"
            v-model:page-size="errorQuery.pageSize"
            :total="errorTotal"
            @change="loadErrors"
          />
        </el-tab-pane>

        <el-tab-pane label="健康快照" name="snapshots">
          <el-table class="desktop-data-table" :data="snapshots" row-key="id">
            <el-table-column label="API" width="100">
              <template #default="{ row }"><OpsStatusTag :status="row.apiStatus" /></template>
            </el-table-column>
            <el-table-column label="DB" width="100">
              <template #default="{ row }"><OpsStatusTag :status="row.dbStatus" /></template>
            </el-table-column>
            <el-table-column label="Redis" width="100">
              <template #default="{ row }"><OpsStatusTag :status="row.redisStatus" /></template>
            </el-table-column>
            <el-table-column label="队列" width="100">
              <template #default="{ row }"><OpsStatusTag :status="row.queueStatus" /></template>
            </el-table-column>
            <el-table-column label="Worker" width="110">
              <template #default="{ row }"><OpsStatusTag :status="row.workerStatus" /></template>
            </el-table-column>
            <el-table-column label="磁盘使用率" width="120" prop="diskUsage" />
            <el-table-column label="检查时间" width="180">
              <template #default="{ row }">{{ formatDate(row.checkedAt) }}</template>
            </el-table-column>
          </el-table>
          <div v-if="snapshots.length" class="mobile-record-list" aria-label="健康快照移动列表">
            <article v-for="snapshot in snapshots" :key="snapshot.id" class="mobile-record-card">
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ formatDate(snapshot.checkedAt) }}</strong>
                  <span>磁盘使用率：{{ snapshot.diskUsage || '-' }}</span>
                </div>
                <OpsStatusTag :status="snapshot.apiStatus" />
              </div>
              <div class="mobile-record-card__chips">
                <OpsStatusTag :status="snapshot.apiStatus" />
                <OpsStatusTag :status="snapshot.dbStatus" />
                <OpsStatusTag :status="snapshot.redisStatus" />
                <OpsStatusTag :status="snapshot.queueStatus" />
                <OpsStatusTag :status="snapshot.workerStatus" />
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>API</span>
                  <strong>{{ snapshot.apiStatus }}</strong>
                </div>
                <div>
                  <span>DB</span>
                  <strong>{{ snapshot.dbStatus }}</strong>
                </div>
                <div>
                  <span>Redis</span>
                  <strong>{{ snapshot.redisStatus }}</strong>
                </div>
                <div>
                  <span>队列</span>
                  <strong>{{ snapshot.queueStatus }}</strong>
                </div>
                <div>
                  <span>Worker</span>
                  <strong>{{ snapshot.workerStatus }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无健康快照</strong>
              <span>点击记录快照后会保存关键组件状态。</span>
            </div>
          </div>
          <PaginationBar
            v-model:page="snapshotQuery.page"
            v-model:page-size="snapshotQuery.pageSize"
            :total="snapshotTotal"
            @change="loadSnapshots"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="errorDialogVisible"
      title="记录运维错误"
      width="min(620px, calc(100vw - 24px))"
    >
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
        <AppButton @click="errorDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="savingError" @click="createError">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { opsApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import OpsStatusTag from '@/components/ui/OpsStatusTag.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
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
      title: '服务状态总览',
      description: '统一查看 API、数据库、Redis、队列和基础设施最近检查结果。',
      badge: '总览',
      tone: 'blue'
    },
    queue: {
      title: '队列状态',
      description: '跟踪等待、执行、失败和延迟任务，队列积压需要及时处理。',
      badge: '队列',
      tone: 'orange'
    },
    cron: {
      title: '定时任务',
      description: '查看定时任务执行结果、开始结束时间和失败原因。',
      badge: '定时',
      tone: 'purple'
    },
    platforms: {
      title: '平台同步',
      description: '监控淘宝、闲鱼、Telegram、文件存储和自动化服务接口状态。',
      badge: '接口',
      tone: 'cyan'
    },
    resources: {
      title: 'Worker / 存储 / 磁盘',
      description: '聚合自动化 Worker、文件存储和磁盘空间等资源指标。',
      badge: '资源',
      tone: 'green'
    },
    errors: {
      title: '最近错误',
      description: '记录和排查近期错误日志，Fatal/Error 需要优先处理。',
      badge: '错误',
      tone: 'red'
    },
    snapshots: {
      title: '健康快照',
      description: '保留系统关键组件健康状态快照，方便后续排查趋势。',
      badge: '快照',
      tone: 'neutral'
    }
  };
  return metaMap[activeTab.value] ?? metaMap.overview;
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

function getErrorTone(level: string) {
  if (level === 'fatal' || level === 'error') return 'red';
  if (level === 'warn') return 'orange';
  return 'neutral';
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
