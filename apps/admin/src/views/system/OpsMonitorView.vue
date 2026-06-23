<template>
  <PageScaffold
    title="运维监控"
    group="运维与平台"
    phase="Phase 12"
    description="监控 API、数据库、Redis、队列、定时任务、平台同步、Worker、文件存储、磁盘空间和最近错误。"
  >
    <template #actions>
      <AppButton @click="() => refreshCurrentTab()">刷新</AppButton>
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
        <PanelTitleHelp :title="activeTabMeta.title" :help="activeTabMeta.description" />
        <div class="inline-actions">
          <StatusChip :tone="activeTabMeta.tone" dot>{{ activeTabMeta.badge }}</StatusChip>
        </div>
      </div>

      <el-tabs
        v-model="activeTab"
        class="system-tabs ops-monitor-tabs"
        @tab-change="() => refreshCurrentTab()"
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
            @change="() => loadQueueStatus()"
          />
        </el-tab-pane>

        <el-tab-pane label="定时任务" name="cron">
          <div class="toolbar">
            <el-input
              v-model="cronQuery.keyword"
              class="toolbar-search"
              placeholder="搜索任务名或失败原因"
              clearable
              @keyup.enter="() => loadCronJobs()"
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
            <AppButton @click="() => loadCronJobs()">查询</AppButton>
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
            @change="() => loadCronJobs()"
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
              <span>刷新后显示 Telegram、文件存储、自动化服务等接口状态。</span>
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

        <el-tab-pane label="Apple 节点" name="gateways">
          <div class="toolbar">
            <AppButton variant="primary" @click="openGatewayDialog">配置订阅</AppButton>
            <AppButton
              :disabled="!appleGatewayStatus?.configured || gatewaySaving"
              :loading="gatewaySyncing"
              @click="() => syncAppleGateways()"
            >
              同步节点
            </AppButton>
          </div>
          <div class="current-box">
            <div>
              <span>订阅来源</span>
              <strong>{{ appleGatewayStatus?.subscriptionHost ?? '-' }}</strong>
            </div>
            <div>
              <span>可用 / 总节点</span>
              <strong>{{ appleGatewayAvailability }}</strong>
            </div>
            <div>
              <span>国家分组</span>
              <strong>{{ appleGatewayCountryText }}</strong>
            </div>
            <StatusChip :tone="appleGatewayStatus?.configured ? 'green' : 'orange'" dot>
              {{ appleGatewayStatus?.configured ? '已配置' : '未配置' }}
            </StatusChip>
          </div>
          <el-table
            v-loading="gatewayLoading"
            class="desktop-data-table"
            :data="appleGatewayStatus?.nodes ?? []"
            row-key="id"
          >
            <el-table-column label="节点" min-width="220" prop="name" />
            <el-table-column label="国家" width="90" prop="countryCode" />
            <el-table-column label="协议" width="110" prop="protocol" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <StatusChip :tone="getGatewayStatusTone(row.status)" dot>
                  {{ formatGatewayStatus(row.status) }}
                </StatusChip>
              </template>
            </el-table-column>
            <el-table-column label="延迟" width="100">
              <template #default="{ row }">{{ row.latencyMs ?? '-' }} ms</template>
            </el-table-column>
            <el-table-column label="最近检测" width="180">
              <template #default="{ row }">{{ formatDate(row.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column label="失败原因" min-width="220" prop="failureReason" />
          </el-table>
          <div
            v-if="appleGatewayStatus?.nodes.length"
            class="mobile-record-list"
            aria-label="Apple 节点移动列表"
          >
            <article
              v-for="node in appleGatewayStatus.nodes"
              :key="node.id"
              class="mobile-record-card"
            >
              <div class="mobile-record-card__head">
                <div class="mobile-record-card__title">
                  <strong>{{ node.name }}</strong>
                  <span>{{ node.countryCode }} · {{ node.protocol }}</span>
                </div>
                <StatusChip :tone="getGatewayStatusTone(node.status)" dot>
                  {{ formatGatewayStatus(node.status) }}
                </StatusChip>
              </div>
              <div class="mobile-record-card__stats">
                <div>
                  <span>延迟</span>
                  <strong>{{ node.latencyMs ?? '-' }} ms</strong>
                </div>
                <div>
                  <span>最近检测</span>
                  <strong>{{ formatDate(node.lastCheckedAt) }}</strong>
                </div>
              </div>
              <div v-if="node.failureReason" class="mobile-record-card__meta">
                <div>
                  <span>失败原因</span>
                  <strong>{{ node.failureReason }}</strong>
                </div>
              </div>
            </article>
          </div>
          <div v-else class="mobile-record-list">
            <div class="apple-core-empty-state">
              <strong>暂无 Apple 检查节点</strong>
              <span>{{ appleGatewayEmptyText }}</span>
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
              @keyup.enter="() => loadErrors()"
            />
            <el-select
              v-model="errorQuery.level"
              class="toolbar-select"
              placeholder="级别"
              clearable
            >
              <el-option
                v-for="option in errorLevelOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <AppButton @click="() => loadErrors()">查询</AppButton>
          </div>
          <el-table class="desktop-data-table" :data="errors" row-key="id">
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <StatusChip :tone="getErrorTone(row.level)" dot>
                  {{ formatErrorLevel(row.level) }}
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
                  {{ formatErrorLevel(error.level) }}
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
            @change="() => loadErrors()"
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
            @change="() => loadSnapshots()"
          />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-dialog
      v-model="gatewayDialogVisible"
      title="Apple 检查节点订阅"
      width="min(640px, calc(100vw - 24px))"
    >
      <el-form label-width="110px">
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="订阅 URL"
              purpose="保存 Apple 官网检查 Worker 使用的节点订阅，后台会加密保存。"
              example="粘贴节点平台提供的订阅链接，保存后列表只显示脱敏摘要。"
            />
          </template>
          <el-input
            v-model="gatewayForm.subscriptionUrl"
            type="password"
            show-password
            placeholder="https://example.com/sub?token=..."
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="gatewayForm.clearSubscription">清空当前订阅和节点</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="gatewayDialogVisible = false">取消</AppButton>
        <AppButton
          variant="primary"
          :loading="gatewaySaving || gatewaySyncing"
          @click="saveGatewaySubscription"
        >
          {{ gatewayForm.clearSubscription ? '清空' : '保存并同步' }}
        </AppButton>
      </template>
    </el-dialog>

    <el-dialog
      v-model="errorDialogVisible"
      title="记录运维错误"
      width="min(620px, calc(100vw - 24px))"
    >
      <el-form label-width="90px">
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="级别"
              purpose="标记这条运维错误的严重程度，便于排序和排查。"
              example="普通记录选 Info，影响功能选 Error，系统不可用选 Fatal。"
            />
          </template>
          <el-select v-model="errorForm.level">
            <el-option
              v-for="option in errorLevelOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="模块"
              purpose="错误发生的模块或服务名称。"
              example="可以填 api、admin、worker、platform-sync。"
            />
          </template>
          <el-input v-model="errorForm.module" />
        </el-form-item>
        <el-form-item required>
          <template #label>
            <FieldHelpLabel
              label="信息"
              purpose="错误的简短描述，方便列表中快速判断问题。"
              example="可以写平台同步失败、数据库连接异常、队列积压。"
            />
          </template>
          <el-input v-model="errorForm.message" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="上下文 JSON"
              purpose="补充错误上下文，必须是合法 JSON，便于后续排查。"
              example='可以填 {"platform":"telegram","reason":"发送失败"}；没有上下文可留空。'
            />
          </template>
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
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { getApiErrorMessage } from '@/api/client';
import { dataCenterApi, opsApi, type DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import OpsStatusTag from '@/components/ui/OpsStatusTag.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { OPS_ERROR_LEVEL_DICTIONARY_GROUP } from '@/config/quickSettings';
import type {
  AppleWebGatewayStatus,
  CronJobLog,
  CronJobLogStatus,
  DataDictionary,
  ErrorLog,
  ErrorLogLevel,
  OpsComponentStatus,
  OpsHealthStatus,
  OpsOverview,
  PlatformSyncLogStatus,
  SystemHealthSnapshot
} from '@/types/system';
import {
  createSmartQueryKey,
  getSmartQueryData,
  invalidateSmartQueries,
  refreshSmartQuery
} from '@/utils/smartQuery';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import {
  buildOpsErrorLevelOptions,
  getOpsErrorLevelLabel,
  isOpsErrorLevel
} from '@/utils/systemQuickOptions';

const overview = ref<OpsOverview | null>(null);
const overviewLoading = ref(false);
const activeTab = ref('overview');
const capturing = ref(false);
const activeOverviewQueryKey = ref('');
const activeQueueQueryKey = ref('');
const activeCronQueryKey = ref('');
const activePlatformQueryKey = ref('');
const activeGatewayQueryKey = ref('');
const activeResourcesQueryKey = ref('');
const activeErrorsQueryKey = ref('');
const activeSnapshotsQueryKey = ref('');
const activatedOnce = ref(false);
const errorLevelDictionaries = ref<DataDictionary[]>([]);

type OpsQueueStatusResult = Awaited<ReturnType<typeof opsApi.queueStatus>>;
type OpsCronJobsPage = Awaited<ReturnType<typeof opsApi.cronJobs>>;
type OpsPlatformSyncResult = Awaited<ReturnType<typeof opsApi.platformSyncStatus>>;
type OpsAppleWebGatewayStatus = Awaited<ReturnType<typeof opsApi.appleWebGateways>>;
type OpsResourcesResult = OpsComponentStatus[];
type OpsErrorLogsPage = Awaited<ReturnType<typeof opsApi.errorLogs>>;
type OpsHealthSnapshotsPage = Awaited<ReturnType<typeof opsApi.healthSnapshots>>;

const queueResult = ref<OpsQueueStatusResult | null>(null);
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

const platformResult = ref<OpsPlatformSyncResult | null>(null);
const platformQuery = reactive({
  page: 1,
  pageSize: 10,
  platform: '',
  status: '' as PlatformSyncLogStatus | ''
});

const appleGatewayStatus = ref<AppleWebGatewayStatus | null>(null);
const gatewayLoading = ref(false);
const gatewaySyncing = ref(false);
const gatewayDialogVisible = ref(false);
const gatewaySaving = ref(false);
const gatewayForm = reactive({
  subscriptionUrl: '',
  clearSubscription: false
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

const errorLevelOptions = computed(() => buildOpsErrorLevelOptions(errorLevelDictionaries.value));

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
const appleGatewayAvailability = computed(() => {
  const status = appleGatewayStatus.value;
  if (!status) return '-';
  return `${status.availableNodeCount} / ${status.nodeCount}`;
});
const appleGatewayCountryText = computed(() => {
  const summary = appleGatewayStatus.value?.countrySummary ?? [];
  if (!summary.length) return '-';
  return summary.map((item) => `${item.countryCode} ${item.available}/${item.total}`).join(' · ');
});
const appleGatewayEmptyText = computed(() =>
  appleGatewayStatus.value?.configured
    ? '订阅已保存但还没有同步出节点，请点击同步节点；保存新订阅会自动同步。'
    : '保存订阅并同步后显示按国家识别的节点。'
);
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
      description: '监控 Telegram、文件存储和自动化服务接口状态。',
      badge: '接口',
      tone: 'cyan'
    },
    gateways: {
      title: 'Apple 检查节点',
      description: '管理 Apple 官网检查 Worker 使用的节点订阅、国家分组和可用状态。',
      badge: '节点',
      tone: 'green'
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
  void refreshCurrentTab({ force: false });
});

onActivated(() => {
  if (!activatedOnce.value) {
    activatedOnce.value = true;
    return;
  }

  void refreshCurrentTab({
    background: true,
    force: false
  });
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  [
    'ops-overview',
    'ops-queue-status',
    'ops-cron-jobs',
    'ops-platform-sync',
    'ops-apple-web-gateways',
    'ops-resources',
    'ops-error-logs',
    'ops-health-snapshots',
    'data-dictionaries'
  ],
  ({ scopes }) => {
    const scopeSet = new Set(scopes);
    const requests: Array<Promise<void>> = [];

    if (scopeSet.has('data-dictionaries')) {
      requests.push(loadOpsOptions({ background: true, force: true }));
    }

    if (scopeSet.has('ops-overview')) {
      requests.push(loadOverview({ background: Boolean(overview.value), force: true }));
    }

    if (activeTab.value === 'queue' && scopeSet.has('ops-queue-status')) {
      requests.push(loadQueueStatus({ background: Boolean(queueResult.value), force: true }));
    }

    if (activeTab.value === 'cron' && scopeSet.has('ops-cron-jobs')) {
      requests.push(loadCronJobs({ background: cronJobs.value.length > 0, force: true }));
    }

    if (activeTab.value === 'platforms' && scopeSet.has('ops-platform-sync')) {
      requests.push(loadPlatformSync({ background: Boolean(platformResult.value), force: true }));
    }

    if (activeTab.value === 'gateways' && scopeSet.has('ops-apple-web-gateways')) {
      requests.push(
        loadAppleWebGateways({ background: Boolean(appleGatewayStatus.value), force: true })
      );
    }

    if (activeTab.value === 'resources' && scopeSet.has('ops-resources')) {
      requests.push(loadResources({ background: resourceRows.value.length > 0, force: true }));
    }

    if (activeTab.value === 'errors' && scopeSet.has('ops-error-logs')) {
      requests.push(loadErrors({ background: errors.value.length > 0, force: true }));
    }

    if (activeTab.value === 'snapshots' && scopeSet.has('ops-health-snapshots')) {
      requests.push(loadSnapshots({ background: snapshots.value.length > 0, force: true }));
    }

    void Promise.all(requests);
  }
);

onBeforeUnmount(stopRealtimeRefresh);

async function refreshCurrentTab(options: { background?: boolean; force?: boolean } = {}) {
  await loadOpsOptions(options);
  await loadOverview({ background: options.background, force: options.force ?? true });
  if (activeTab.value === 'queue') {
    await loadQueueStatus({ background: options.background, force: options.force ?? true });
  }
  if (activeTab.value === 'cron') {
    await loadCronJobs({ background: options.background, force: options.force ?? true });
  }
  if (activeTab.value === 'platforms') {
    await loadPlatformSync({ background: options.background, force: options.force ?? true });
  }
  if (activeTab.value === 'gateways') {
    await loadAppleWebGateways({ background: options.background, force: options.force ?? true });
  }
  if (activeTab.value === 'resources') {
    await loadResources({ background: options.background, force: options.force ?? true });
  }
  if (activeTab.value === 'errors') {
    await loadErrors({ background: options.background, force: options.force ?? true });
  }
  if (activeTab.value === 'snapshots') {
    await loadSnapshots({ background: options.background, force: options.force ?? true });
  }
}

function buildOpsOptionParams(group: string): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 50,
    group,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

async function loadOpsOptions(options: { background?: boolean; force?: boolean } = {}) {
  try {
    const errorLevels = await dataCenterApi.listDictionaries(
      buildOpsOptionParams(OPS_ERROR_LEVEL_DICTIONARY_GROUP)
    );
    errorLevelDictionaries.value = errorLevels.items;
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载运维选项失败');
    }
  }
}

async function loadOverview(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('ops-overview');
  const cached = getSmartQueryData<OpsOverview>(key);

  activeOverviewQueryKey.value = key;

  if (cached) {
    overview.value = cached;
  }

  overviewLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => opsApi.overview(),
      force: options.force ?? true
    });

    if (activeOverviewQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      overview.value = result.data;
    }
  } finally {
    if (activeOverviewQueryKey.value === key) {
      overviewLoading.value = false;
    }
  }
}

async function loadQueueStatus(options: { background?: boolean; force?: boolean } = {}) {
  const params = {
    ...queueQuery,
    queueName: queueQuery.queueName || undefined,
    status: queueQuery.status || undefined
  };
  const key = createSmartQueryKey('ops-queue-status', params);
  const cached = getSmartQueryData<OpsQueueStatusResult>(key);

  activeQueueQueryKey.value = key;

  if (cached) {
    queueResult.value = cached;
  }

  const result = await refreshSmartQuery({
    key,
    fetcher: () => opsApi.queueStatus(params),
    force: options.force ?? true
  });

  if (activeQueueQueryKey.value === key && (result.changed || !cached)) {
    queueResult.value = result.data;
  }
}

async function loadCronJobs(options: { background?: boolean; force?: boolean } = {}) {
  const params = {
    ...cronQuery,
    keyword: cronQuery.keyword || undefined,
    status: cronQuery.status || undefined
  };
  const key = createSmartQueryKey('ops-cron-jobs', params);
  const cached = getSmartQueryData<OpsCronJobsPage>(key);

  activeCronQueryKey.value = key;

  if (cached) {
    applyCronJobsResult(cached);
  }

  const result = await refreshSmartQuery({
    key,
    fetcher: () => opsApi.cronJobs(params),
    force: options.force ?? true
  });

  if (activeCronQueryKey.value === key && (result.changed || !cached)) {
    applyCronJobsResult(result.data);
  }
}

async function loadPlatformSync(options: { background?: boolean; force?: boolean } = {}) {
  const params = {
    ...platformQuery,
    platform: platformQuery.platform || undefined,
    status: platformQuery.status || undefined
  };
  const key = createSmartQueryKey('ops-platform-sync', params);
  const cached = getSmartQueryData<OpsPlatformSyncResult>(key);

  activePlatformQueryKey.value = key;

  if (cached) {
    platformResult.value = cached;
  }

  const result = await refreshSmartQuery({
    key,
    fetcher: () => opsApi.platformSyncStatus(params),
    force: options.force ?? true
  });

  if (activePlatformQueryKey.value === key && (result.changed || !cached)) {
    platformResult.value = result.data;
  }
}

async function loadAppleWebGateways(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('ops-apple-web-gateways');
  const cached = getSmartQueryData<OpsAppleWebGatewayStatus>(key);

  activeGatewayQueryKey.value = key;

  if (cached) {
    appleGatewayStatus.value = cached;
  }

  gatewayLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => opsApi.appleWebGateways(),
      force: options.force ?? true
    });

    if (activeGatewayQueryKey.value === key && (result.changed || !cached)) {
      appleGatewayStatus.value = result.data;
    }
  } finally {
    if (activeGatewayQueryKey.value === key) {
      gatewayLoading.value = false;
    }
  }
}

async function loadResources(options: { background?: boolean; force?: boolean } = {}) {
  const key = createSmartQueryKey('ops-resources');
  const cached = getSmartQueryData<OpsResourcesResult>(key);

  activeResourcesQueryKey.value = key;

  if (cached) {
    resourceRows.value = cached;
  }

  const result = await refreshSmartQuery({
    key,
    fetcher: () =>
      Promise.all([opsApi.automationWorkers(), opsApi.fileStorageStatus(), opsApi.diskSpace()]),
    force: options.force ?? true
  });

  if (activeResourcesQueryKey.value === key && (result.changed || !cached)) {
    resourceRows.value = result.data;
  }
}

async function loadErrors(options: { background?: boolean; force?: boolean } = {}) {
  const params = {
    ...errorQuery,
    keyword: errorQuery.keyword || undefined,
    module: errorQuery.module || undefined,
    level: errorQuery.level || undefined
  };
  const key = createSmartQueryKey('ops-error-logs', params);
  const cached = getSmartQueryData<OpsErrorLogsPage>(key);

  activeErrorsQueryKey.value = key;

  if (cached) {
    applyErrorLogsResult(cached);
  }

  const result = await refreshSmartQuery({
    key,
    fetcher: () => opsApi.errorLogs(params),
    force: options.force ?? true
  });

  if (activeErrorsQueryKey.value === key && (result.changed || !cached)) {
    applyErrorLogsResult(result.data);
  }
}

async function loadSnapshots(options: { background?: boolean; force?: boolean } = {}) {
  const params = {
    ...snapshotQuery,
    status: snapshotQuery.status || undefined
  };
  const key = createSmartQueryKey('ops-health-snapshots', params);
  const cached = getSmartQueryData<OpsHealthSnapshotsPage>(key);

  activeSnapshotsQueryKey.value = key;

  if (cached) {
    applyHealthSnapshotsResult(cached);
  }

  const result = await refreshSmartQuery({
    key,
    fetcher: () => opsApi.healthSnapshots(params),
    force: options.force ?? true
  });

  if (activeSnapshotsQueryKey.value === key && (result.changed || !cached)) {
    applyHealthSnapshotsResult(result.data);
  }
}

function applyCronJobsResult(result: OpsCronJobsPage) {
  cronJobs.value = result.items;
  cronTotal.value = result.total;
}

function applyErrorLogsResult(result: OpsErrorLogsPage) {
  errors.value = result.items;
  errorTotal.value = result.total;
}

function applyHealthSnapshotsResult(result: OpsHealthSnapshotsPage) {
  snapshots.value = result.items;
  snapshotTotal.value = result.total;
}

async function captureSnapshot() {
  capturing.value = true;
  try {
    await opsApi.captureHealthSnapshot();
    ElMessage.success('健康快照已记录');
    invalidateSmartQueries('ops-overview');
    invalidateSmartQueries('ops-health-snapshots');
    invalidateSmartQueries('ops-queue-status');
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
  invalidateSmartQueries('ops-platform-sync');
  await loadPlatformSync();
}

function openGatewayDialog() {
  Object.assign(gatewayForm, {
    subscriptionUrl: '',
    clearSubscription: false
  });
  gatewayDialogVisible.value = true;
}

async function saveGatewaySubscription() {
  if (!gatewayForm.clearSubscription && !gatewayForm.subscriptionUrl.trim()) {
    ElMessage.error('请输入订阅 URL');
    return;
  }

  gatewaySaving.value = true;
  try {
    appleGatewayStatus.value = await opsApi.saveAppleWebGatewaySubscription({
      subscriptionUrl: gatewayForm.clearSubscription ? undefined : gatewayForm.subscriptionUrl,
      clearSubscription: gatewayForm.clearSubscription
    });
    invalidateSmartQueries('ops-apple-web-gateways');

    if (gatewayForm.clearSubscription) {
      ElMessage.success('节点订阅已清空');
      gatewayDialogVisible.value = false;
      return;
    }

    gatewayDialogVisible.value = false;
    await syncAppleGateways({
      successMessagePrefix: '节点订阅已保存并同步',
      savedSubscription: true
    });
  } finally {
    gatewaySaving.value = false;
  }
}

async function syncAppleGateways(
  options: { successMessagePrefix?: string; savedSubscription?: boolean } = {}
) {
  gatewaySyncing.value = true;
  try {
    appleGatewayStatus.value = await opsApi.syncAppleWebGateways();
    const prefix = options.successMessagePrefix ?? 'Apple 检查节点已同步';
    const nodeCount = appleGatewayStatus.value.nodeCount;
    ElMessage.success(nodeCount ? `${prefix}，识别到 ${nodeCount} 个节点` : `${prefix}，暂无节点`);
    invalidateSmartQueries('ops-apple-web-gateways');
    invalidateSmartQueries('ops-platform-sync');
  } catch (error) {
    const message = getApiErrorMessage(error);
    if (options.savedSubscription) {
      ElMessage.warning(`订阅已保存，但同步节点失败：${message}`);
      return;
    }
    ElMessage.error(message);
  } finally {
    gatewaySyncing.value = false;
  }
}

function openErrorDialog() {
  Object.assign(errorForm, {
    level: getDefaultErrorLevel(),
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
    invalidateSmartQueries('ops-error-logs');
    invalidateSmartQueries('ops-overview');
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

function formatErrorLevel(level: string) {
  if (!isOpsErrorLevel(level)) {
    return level;
  }
  return getOpsErrorLevelLabel(level, errorLevelDictionaries.value);
}

function getDefaultErrorLevel() {
  return (
    errorLevelOptions.value.find((option) => option.value === 'error')?.value ??
    errorLevelOptions.value[0]?.value ??
    'error'
  );
}

function getPlatformLabel(platform: string) {
  return (
    {
      telegram: 'Telegram',
      storage: '文件存储',
      automation: '自动化'
    }[platform] ?? platform
  );
}

function getGatewayStatusTone(status: string) {
  if (status === 'available') return 'green';
  if (status === 'unavailable') return 'red';
  return 'neutral';
}

function formatGatewayStatus(status: string) {
  if (status === 'available') return '可用';
  if (status === 'unavailable') return '不可用';
  return '未知';
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}
</script>
