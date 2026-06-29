<template>
  <PageScaffold
    title="上线检查清单"
    group="工作台"
    phase="Phase 16"
    description="跟踪正式上线前的 P0 验收项、责任人、证据和处理状态。"
  >
    <template #actions>
      <StatusChip tone="blue" dot>真实验收清单</StatusChip>
      <AppButton @click="() => loadChecklist()">刷新</AppButton>
      <AppButton variant="primary" :loading="saving" :disabled="!dirty" @click="saveChecklist">
        保存清单
      </AppButton>
    </template>

    <div class="launch-audit-hero">
      <section class="launch-audit-score">
        <h3>上线前设计审计总分 <span>V3 Final Audit</span></h3>
        <div class="launch-audit-score__big">{{ auditScore }}</div>
        <p>
          已通过 {{ passedCount }} 项，阻塞 {{ blockedCount }} 项，待处理 {{ openCount }} 项，
          Telegram 后补 {{ deferredCount }} 项，证据缺口 {{ evidenceMissingCount }}
          项。上线前必须逐项确认生产配置、备份恢复、敏感字段和手工门禁。
        </p>
        <div class="launch-audit-meters">
          <div v-for="meter in auditMeters" :key="meter.label" class="launch-audit-meter">
            <span>{{ meter.label }}</span>
            <strong>{{ meter.value }}%</strong>
          </div>
        </div>
      </section>

      <AppCard
        title="上线阻塞项"
        subtitle="P0 门禁和未完成高风险项优先处理。"
        :tag="launchReadinessLabel"
        :tag-tone="launchReadinessTone"
      >
        <div class="launch-audit-checklist">
          <button
            v-for="item in priorityGateItems"
            :key="item.id"
            class="launch-check-item"
            type="button"
            @click="focusItem(item)"
          >
            <span class="launch-check-item__icon" :class="`is-${getEffectiveStatusTone(item)}`">
              {{ getEffectiveStatusMark(item) }}
            </span>
            <span class="launch-check-item__main">
              <strong>{{ item.title }}</strong>
              <em>{{ item.category }} · {{ item.owner || '未分配负责人' }}</em>
            </span>
            <StatusChip :tone="getEffectiveStatusTone(item)">
              {{ getEffectiveStatusLabel(item) }}
            </StatusChip>
          </button>

          <div v-if="!loading && priorityGateItems.length === 0" class="launch-check-empty">
            <strong>暂无阻塞项</strong>
            <span>继续确认待处理项目和证据，所有 P0 通过后再进入发布动作。</span>
          </div>
        </div>
      </AppCard>
    </div>

    <div class="launch-audit-grid">
      <AppCard
        v-for="summary in categoryProgress.slice(0, 3)"
        :key="summary.category"
        :title="summary.category"
        subtitle="按分类查看上线检查状态。"
        :tag="summary.label"
        :tag-tone="summary.tone"
      >
        <div class="mini-list">
          <div class="mini-row">
            <span>检查项</span>
            <strong>{{ summary.total }}</strong>
          </div>
          <div class="mini-row">
            <span>已通过</span>
            <strong>{{ summary.passed }}</strong>
          </div>
          <div class="mini-row">
            <span>待处理 / 阻塞</span>
            <strong>{{ summary.open }} / {{ summary.blocked }}</strong>
          </div>
        </div>
      </AppCard>
    </div>

    <section class="content-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="上线门禁清单"
          help="发布前一项项确认：生产配置有没有配好、真实测试有没有过、备份能不能恢复、敏感字段有没有保护、还有没有阻塞问题。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>上线检查</StatusChip>
          <StatusChip :tone="blockedCount > 0 ? 'red' : 'green'" dot>
            {{ blockedCount > 0 ? `阻塞 ${blockedCount}` : '无阻塞' }}
          </StatusChip>
        </div>
      </div>

      <div class="toolbar">
        <el-input
          v-model="keyword"
          class="toolbar-search"
          placeholder="搜索检查项、负责人、证据、备注"
          clearable
        />
        <el-select v-model="statusFilter" class="toolbar-select" placeholder="状态" clearable>
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-select v-model="categoryFilter" class="toolbar-select" placeholder="分类" clearable>
          <el-option
            v-for="category in categories"
            :key="category"
            :label="category"
            :value="category"
          />
        </el-select>
        <AppButton @click="resetFilters">清空筛选</AppButton>
      </div>

      <div v-if="dirty" class="apple-core-alert apple-core-alert--orange">
        <StatusChip tone="orange">未保存</StatusChip>
        <div>
          <strong>清单有未保存修改</strong>
          <p>保存前这些改动只存在于当前页面状态，刷新后可能丢失。</p>
        </div>
      </div>

      <ListRequestError
        v-if="launchAuditLoadError && filteredItems.length"
        title="上线检查清单刷新失败"
        :message="launchAuditLoadError"
        @retry="() => loadChecklist({ force: true })"
      />

      <el-table v-loading="loading" class="desktop-data-table" :data="filteredItems" row-key="id">
        <template #empty>
          <ListRequestError
            v-if="launchAuditLoadError"
            title="上线检查清单加载失败"
            :message="launchAuditLoadError"
            @retry="() => loadChecklist({ force: true })"
          />
          <div v-else class="apple-core-empty-state">
            <strong>暂无检查项</strong>
            <span>调整筛选或刷新清单后查看上线门禁。</span>
          </div>
        </template>
        <el-table-column label="检查项" min-width="280">
          <template #default="{ row }">
            <strong>{{ row.title }}</strong>
            <div class="muted-block">{{ row.category }}</div>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <StatusChip :tone="getPriorityTone(row.priority)" dot>
              {{ row.priority }}
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="160">
          <template #default="{ row }">
            <el-select v-model="row.status" size="small" @change="markItemUpdated(row)">
              <el-option
                v-for="option in getStatusOptions(row)"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="150">
          <template #default="{ row }">
            <el-input v-model="row.owner" size="small" @change="markItemUpdated(row)" />
          </template>
        </el-table-column>
        <el-table-column label="证据" min-width="220">
          <template #default="{ row }">
            <el-input
              v-model="row.evidence"
              size="small"
              placeholder="命令、链接、验收记录"
              @change="markItemUpdated(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="260">
          <template #default="{ row }">
            <el-input
              v-model="row.remark"
              size="small"
              placeholder="风险、延期原因、处理说明"
              @change="markItemUpdated(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton size="small" variant="success" @click="setStatus(row, 'passed')">
                通过
              </AppButton>
              <AppButton size="small" variant="danger" @click="setStatus(row, 'blocked')">
                阻塞
              </AppButton>
              <AppButton
                v-if="canWaive(row)"
                size="small"
                variant="ghost"
                @click="setStatus(row, 'waived')"
              >
                豁免
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="filteredItems.length" class="mobile-record-list" aria-label="上线检查移动列表">
        <article v-for="item in filteredItems" :key="item.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ item.title }}</strong>
              <span>{{ item.category }}</span>
            </div>
            <StatusChip :tone="getPriorityTone(item.priority)" dot>
              {{ item.priority }}
            </StatusChip>
          </div>
          <div class="mobile-record-card__chips">
            <StatusChip :tone="getEffectiveStatusTone(item)" dot>
              {{ getEffectiveStatusLabel(item) }}
            </StatusChip>
          </div>
          <div class="mobile-record-card__meta">
            <div>
              <span>状态</span>
              <el-select v-model="item.status" size="small" @change="markItemUpdated(item)">
                <el-option
                  v-for="option in getStatusOptions(item)"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </div>
            <div>
              <span>负责人</span>
              <el-input v-model="item.owner" size="small" @change="markItemUpdated(item)" />
            </div>
            <div>
              <span>证据</span>
              <el-input
                v-model="item.evidence"
                size="small"
                placeholder="命令、链接、验收记录"
                @change="markItemUpdated(item)"
              />
            </div>
            <div>
              <span>备注</span>
              <el-input
                v-model="item.remark"
                size="small"
                placeholder="风险、延期原因、处理说明"
                @change="markItemUpdated(item)"
              />
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(item.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="success" @click="setStatus(item, 'passed')">
              通过
            </AppButton>
            <AppButton size="small" variant="danger" @click="setStatus(item, 'blocked')">
              阻塞
            </AppButton>
            <AppButton
              v-if="canWaive(item)"
              size="small"
              variant="ghost"
              @click="setStatus(item, 'waived')"
            >
              豁免
            </AppButton>
          </div>
        </article>
      </div>
      <div
        v-else-if="!loading && launchAuditLoadError"
        class="mobile-record-list"
        aria-label="上线检查清单加载失败"
      >
        <ListRequestError
          title="上线检查清单加载失败"
          :message="launchAuditLoadError"
          @retry="() => loadChecklist({ force: true })"
        />
      </div>
      <div v-else-if="!loading" class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无检查项</strong>
          <span>调整筛选或刷新清单后查看上线门禁。</span>
        </div>
      </div>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { maintenanceApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import ListRequestError from '@/components/ui/ListRequestError.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { usePageRefresh } from '@/composables/pageRefresh';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type { LaunchChecklistItem, LaunchChecklistStatus } from '@/types/system';
import { getLoadErrorMessage } from '@/utils/loadErrorMessage';
import { createSmartQueryKey, invalidateSmartQueries, refreshSmartQuery } from '@/utils/smartQuery';

const LAUNCH_AUDIT_SCOPE = 'launch-audit';
const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);
const items = ref<LaunchChecklistItem[]>([]);
const launchAuditLoadError = ref('');
const keyword = ref('');
const statusFilter = ref('');
const categoryFilter = ref('');
const requiredManualGateIds = new Set(['prod_env', 'git_baseline']);
const deferredManualGateIds = new Set(['telegram_test']);
const nonWaivableManualGateIds = new Set(['telegram_test', 'prod_env', 'git_baseline']);
type ChipTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';

const statusOptions: Array<{ label: string; value: LaunchChecklistStatus }> = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已通过', value: 'passed' },
  { label: '阻塞', value: 'blocked' },
  { label: '豁免', value: 'waived' }
];

const categories = computed(() => [...new Set(items.value.map((item) => item.category))]);
const passedCount = computed(() => items.value.filter((item) => item.status === 'passed').length);
const blockedCount = computed(
  () =>
    items.value.filter((item) => item.status === 'blocked' && !isDeferredManualGate(item)).length
);
const openCount = computed(
  () =>
    items.value.filter(
      (item) => ['pending', 'in_progress'].includes(item.status) && !isDeferredManualGate(item)
    ).length
);
const deferredCount = computed(() => items.value.filter(isDeferredManualGate).length);
const manualGateOpenCount = computed(
  () =>
    items.value.filter((item) => requiredManualGateIds.has(item.id) && item.status !== 'passed')
      .length
);
const evidenceMissingCount = computed(
  () => items.value.filter((item) => item.status === 'passed' && !item.evidence?.trim()).length
);
const auditScore = computed(() => {
  if (items.value.length === 0) return 0;
  return Math.round((passedCount.value / items.value.length) * 100);
});
const auditMeters = computed(() => [
  { label: '业务闭环', value: getCategoryScore(['Apple', '兑换码', '订单', '发货']) },
  { label: '安全审计', value: getCategoryScore(['安全', '权限', '敏感']) },
  { label: '财务可追溯', value: getCategoryScore(['财务', '成本', '利润', '对账']) },
  { label: '移动端可用', value: getCategoryScore(['移动', '前端', '设计']) }
]);
const priorityGateItems = computed(() =>
  [...items.value]
    .filter(
      (item) =>
        !isDeferredManualGate(item) &&
        (item.status === 'blocked' || item.priority === 'P0' || requiredManualGateIds.has(item.id))
    )
    .sort((left, right) => getLaunchItemRank(right) - getLaunchItemRank(left))
    .slice(0, 4)
);
const launchReadinessTone = computed(() => {
  if (blockedCount.value > 0) return 'red';
  if (manualGateOpenCount.value > 0 || dirty.value) return 'orange';
  if (items.value.length > 0 && openCount.value === 0) return 'green';
  return 'blue';
});
const launchReadinessLabel = computed(() => {
  if (blockedCount.value > 0) return '不可上线';
  if (manualGateOpenCount.value > 0) return 'P0 未完成';
  if (dirty.value) return '待保存';
  if (items.value.length > 0 && openCount.value === 0) return '可进入发布前复核';
  return '检查中';
});
const categoryProgress = computed(() =>
  categories.value.map((category) => {
    const categoryItems = items.value.filter((item) => item.category === category);
    const passed = categoryItems.filter((item) => item.status === 'passed').length;
    const blocked = categoryItems.filter(
      (item) => item.status === 'blocked' && !isDeferredManualGate(item)
    ).length;
    const open = categoryItems.filter(
      (item) => ['pending', 'in_progress'].includes(item.status) && !isDeferredManualGate(item)
    ).length;
    const tone: ChipTone = blocked > 0 ? 'red' : open > 0 ? 'orange' : 'green';

    return {
      category,
      total: categoryItems.length,
      passed,
      blocked,
      open,
      tone,
      label: blocked > 0 ? '有阻塞' : open > 0 ? '处理中' : '已完成'
    };
  })
);

const filteredItems = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase();

  return items.value.filter((item) => {
    const text = `${item.title} ${item.category} ${item.owner ?? ''} ${item.evidence ?? ''} ${
      item.remark ?? ''
    }`.toLowerCase();
    return (
      (!normalizedKeyword || text.includes(normalizedKeyword)) &&
      (!statusFilter.value || item.status === statusFilter.value) &&
      (!categoryFilter.value || item.category === categoryFilter.value)
    );
  });
});

const stopRealtimeRefresh = onRealtimeQueryInvalidated([LAUNCH_AUDIT_SCOPE], () => {
  void loadChecklist({ silent: true, dedupeMs: 0 });
});

onMounted(() => loadChecklist({ force: false }));

usePageRefresh(
  (options) =>
    loadChecklist({
      silent: options.background,
      dedupeMs: options.force ? 0 : undefined,
      force: options.force ?? true
    }),
  { label: '上线检查清单' }
);

onBeforeUnmount(() => {
  stopRealtimeRefresh();
});

async function loadChecklist(
  options: { silent?: boolean; dedupeMs?: number; force?: boolean } = {}
) {
  if (!options.silent || !items.value.length) {
    loading.value = true;
  }
  try {
    const result = await refreshSmartQuery({
      key: createSmartQueryKey(LAUNCH_AUDIT_SCOPE),
      fetcher: () => maintenanceApi.getLaunchChecklist(),
      force: options.force ?? true,
      dedupeMs: options.dedupeMs ?? 1_200
    });
    items.value = result.data.items;
    launchAuditLoadError.value = '';
    dirty.value = false;
  } catch (error) {
    launchAuditLoadError.value = getLoadErrorMessage(error, '加载上线检查清单失败');
    ElMessage.error(launchAuditLoadError.value);
  } finally {
    loading.value = false;
  }
}

async function saveChecklist() {
  saving.value = true;
  try {
    const result = await maintenanceApi.saveLaunchChecklist(items.value);
    items.value = result.items;
    invalidateSmartQueries(LAUNCH_AUDIT_SCOPE);
    dirty.value = false;
    ElMessage.success('上线检查清单已保存');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存上线检查清单失败');
  } finally {
    saving.value = false;
  }
}

function setStatus(item: LaunchChecklistItem, status: LaunchChecklistStatus) {
  if (status === 'waived' && !canWaive(item)) {
    ElMessage.warning('首版手工门禁不能豁免；Telegram 半自动首发可保持待处理');
    return;
  }
  item.status = status;
  markItemUpdated(item);
}

function canWaive(item: LaunchChecklistItem) {
  return !nonWaivableManualGateIds.has(item.id);
}

function isDeferredManualGate(item: LaunchChecklistItem) {
  return deferredManualGateIds.has(item.id) && item.status !== 'passed';
}

function getStatusOptions(item: LaunchChecklistItem) {
  return canWaive(item)
    ? statusOptions
    : statusOptions.filter((option) => option.value !== 'waived');
}

function markItemUpdated(item: LaunchChecklistItem) {
  item.updatedAt = new Date().toISOString();
  dirty.value = true;
}

function resetFilters() {
  keyword.value = '';
  statusFilter.value = '';
  categoryFilter.value = '';
}

function focusItem(item: LaunchChecklistItem) {
  keyword.value = item.title;
  categoryFilter.value = item.category;
  statusFilter.value = '';
}

function getPriorityTone(priority: string) {
  if (priority === 'P0') return 'red';
  if (priority === 'P1') return 'orange';
  return 'neutral';
}

function getStatusLabel(status: LaunchChecklistStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function getStatusTone(status: LaunchChecklistStatus) {
  if (status === 'passed') return 'green';
  if (status === 'blocked') return 'red';
  if (status === 'in_progress') return 'blue';
  if (status === 'waived') return 'neutral';
  return 'orange';
}

function getStatusMark(status: LaunchChecklistStatus) {
  if (status === 'passed') return '✓';
  if (status === 'blocked') return '!';
  if (status === 'waived') return '-';
  return '!';
}

function getEffectiveStatusLabel(item: LaunchChecklistItem) {
  if (isDeferredManualGate(item)) return '后补';
  return getStatusLabel(item.status);
}

function getEffectiveStatusTone(item: LaunchChecklistItem) {
  if (isDeferredManualGate(item)) return 'blue';
  return getStatusTone(item.status);
}

function getEffectiveStatusMark(item: LaunchChecklistItem) {
  if (isDeferredManualGate(item)) return '-';
  return getStatusMark(item.status);
}

function getLaunchItemRank(item: LaunchChecklistItem) {
  const statusRank: Record<LaunchChecklistStatus, number> = {
    blocked: 5,
    in_progress: 4,
    pending: 3,
    waived: 2,
    passed: 1
  };
  const priorityRank = item.priority === 'P0' ? 3 : item.priority === 'P1' ? 2 : 1;
  const manualRank = requiredManualGateIds.has(item.id) ? 2 : 0;
  return statusRank[item.status] + priorityRank + manualRank;
}

function getCategoryScore(keywords: string[]) {
  const matchedItems = items.value.filter((item) =>
    keywords.some((keyword) => `${item.category} ${item.title}`.includes(keyword))
  );
  if (!matchedItems.length) return auditScore.value;
  return Math.round(
    (matchedItems.filter((item) => item.status === 'passed').length / matchedItems.length) * 100
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
</script>

<style scoped>
.launch-audit-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  gap: var(--v3-gap);
  align-items: stretch;
}

.launch-audit-score {
  position: relative;
  min-height: 320px;
  padding: 24px;
  border: 1px solid rgba(228, 234, 243, 0.92);
  border-radius: var(--v3-radius-lg);
  background: var(--v3-surface);
  box-shadow: var(--v3-shadow-xs);
}

.launch-audit-score::after {
  display: none;
  content: none;
}

.launch-audit-score h3 {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--v3-text);
  font-size: 18px;
  font-weight: 900;
}

.launch-audit-score h3 span {
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--v3-primary-soft);
  color: var(--v3-primary);
  font-size: 11px;
  font-weight: 900;
}

.launch-audit-score__big {
  position: relative;
  z-index: 1;
  margin-top: 28px;
  color: var(--v3-primary);
  font-size: 88px;
  font-weight: 950;
  line-height: 0.9;
}

.launch-audit-score p {
  position: relative;
  z-index: 1;
  max-width: 680px;
  margin: 18px 0 0;
  color: var(--v3-text-soft);
  font-size: 13px;
  line-height: 1.7;
}

.launch-audit-meters {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}

.launch-audit-meter {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--v3-border);
  border-radius: 14px;
  background: var(--v3-surface-2);
}

.launch-audit-meter span {
  color: var(--v3-text-soft);
  font-size: 12px;
}

.launch-audit-meter strong {
  color: var(--v3-text);
  font-size: 20px;
  font-weight: 950;
}

.launch-audit-hero :deep(.app-card) {
  min-height: 320px;
}

.launch-audit-checklist {
  display: grid;
  gap: 10px;
}

.launch-check-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--v3-border);
  border-radius: 16px;
  background: var(--v3-surface-2);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s var(--v3-ease),
    border-color 0.18s var(--v3-ease),
    box-shadow 0.18s var(--v3-ease);
}

.launch-check-item:hover {
  transform: translateY(-1px);
  border-color: var(--v3-primary-soft);
  box-shadow: var(--v3-shadow-sm);
}

.launch-check-item__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 999px;
  background: var(--v3-orange-soft);
  color: var(--v3-orange);
  font-size: 15px;
  font-weight: 950;
}

.launch-check-item__icon.is-red {
  background: var(--v3-red-soft);
  color: var(--v3-red);
}

.launch-check-item__icon.is-green {
  background: var(--v3-green-soft);
  color: var(--v3-green);
}

.launch-check-item__icon.is-blue {
  background: var(--v3-primary-soft);
  color: var(--v3-primary);
}

.launch-check-item__icon.is-neutral {
  background: var(--v3-surface-2);
  color: var(--v3-muted);
}

.launch-check-item__main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.launch-check-item__main strong {
  overflow: hidden;
  color: var(--v3-text);
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-check-item__main em {
  overflow: hidden;
  color: var(--v3-text-soft);
  font-size: 12px;
  font-style: normal;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-check-empty {
  display: grid;
  min-height: 150px;
  align-content: center;
  justify-items: center;
  gap: 7px;
  padding: 18px;
  border: 1px dashed var(--v3-border);
  border-radius: 16px;
  background: var(--v3-surface-2);
  color: var(--v3-text-soft);
  text-align: center;
}

.launch-check-empty strong {
  color: var(--v3-text);
  font-size: 14px;
  font-weight: 900;
}

.launch-check-empty span {
  font-size: 12px;
  line-height: 1.5;
}

.launch-audit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--v3-gap);
}

@media (max-width: 840px) {
  .launch-audit-hero,
  .launch-audit-grid,
  .launch-audit-meters,
  .launch-check-item {
    grid-template-columns: 1fr;
  }

  .launch-audit-score {
    min-height: auto;
    padding: 18px;
  }

  .launch-audit-score__big {
    font-size: 56px;
  }

  .launch-audit-hero :deep(.app-card) {
    min-height: auto;
  }
}
</style>
