<template>
  <PageScaffold
    title="上线检查清单"
    group="工作台"
    phase="Phase 16"
    description="跟踪正式上线前的 P0 验收项、责任人、证据和处理状态。"
  >
    <template #actions>
      <el-tag type="primary" effect="light">真实验收清单</el-tag>
      <el-button @click="loadChecklist">刷新</el-button>
      <el-button type="primary" :loading="saving" :disabled="!dirty" @click="saveChecklist">
        保存清单
      </el-button>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="检查项"
        :value="String(items.length)"
        hint="上线前必须逐项确认"
        tone="blue"
      />
      <MetricCard label="已通过" :value="String(passedCount)" hint="可作为上线证据" tone="green" />
      <MetricCard label="阻塞项" :value="String(blockedCount)" hint="上线前必须处理" tone="red" />
      <MetricCard label="待处理" :value="String(openCount)" hint="未完成或处理中" tone="orange" />
    </div>

    <section class="content-panel">
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
        <el-button @click="resetFilters">清空筛选</el-button>
      </div>

      <el-alert v-if="dirty" title="清单有未保存修改" type="warning" show-icon :closable="false" />

      <el-table v-loading="loading" :data="filteredItems" row-key="id">
        <el-table-column label="检查项" min-width="280">
          <template #default="{ row }">
            <strong>{{ row.title }}</strong>
            <div class="muted-block">{{ row.category }}</div>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="90">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" effect="light" size="small">
              {{ row.priority }}
            </el-tag>
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
            <el-button text type="success" @click="setStatus(row, 'passed')">通过</el-button>
            <el-button text type="danger" @click="setStatus(row, 'blocked')">阻塞</el-button>
            <el-button v-if="canWaive(row)" text @click="setStatus(row, 'waived')">
              豁免
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { maintenanceApi } from '@/api/system';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import type { LaunchChecklistItem, LaunchChecklistStatus } from '@/types/system';

const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);
const items = ref<LaunchChecklistItem[]>([]);
const keyword = ref('');
const statusFilter = ref('');
const categoryFilter = ref('');
const requiredManualGateIds = new Set(['telegram_test', 'prod_env', 'git_baseline']);

const statusOptions: Array<{ label: string; value: LaunchChecklistStatus }> = [
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已通过', value: 'passed' },
  { label: '阻塞', value: 'blocked' },
  { label: '豁免', value: 'waived' }
];

const categories = computed(() => [...new Set(items.value.map((item) => item.category))]);
const passedCount = computed(() => items.value.filter((item) => item.status === 'passed').length);
const blockedCount = computed(() => items.value.filter((item) => item.status === 'blocked').length);
const openCount = computed(
  () => items.value.filter((item) => ['pending', 'in_progress'].includes(item.status)).length
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

onMounted(loadChecklist);

async function loadChecklist() {
  loading.value = true;
  try {
    const result = await maintenanceApi.getLaunchChecklist();
    items.value = result.items;
    dirty.value = false;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载上线检查清单失败');
  } finally {
    loading.value = false;
  }
}

async function saveChecklist() {
  saving.value = true;
  try {
    const result = await maintenanceApi.saveLaunchChecklist(items.value);
    items.value = result.items;
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
    ElMessage.warning('首版 P0 手工门禁不能豁免');
    return;
  }
  item.status = status;
  markItemUpdated(item);
}

function canWaive(item: LaunchChecklistItem) {
  return !requiredManualGateIds.has(item.id);
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

function getPriorityType(priority: string) {
  if (priority === 'P0') return 'danger';
  if (priority === 'P1') return 'warning';
  return 'info';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
</script>
