<template>
  <PageScaffold
    title="Apple ID 来源渠道"
    group="Apple ID 业务"
    phase="Phase 3"
    description="单独维护 Apple ID 从哪里获得，不和客户来源平台、订单销售平台混用。"
  >
    <section class="content-panel common-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="来源渠道列表"
          :help="[
            '这里专门给 Apple ID 账号资料使用，比如供应商、内部自建、闲鱼采购。',
            '停用后不会再出现在新增和编辑 Apple ID 的下拉里，历史账号已经选过的来源渠道会继续显示。'
          ]"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>来源渠道 {{ total }}</StatusChip>
          <StatusChip tone="green">启用 {{ activeChannelCount }}</StatusChip>
        </div>
      </div>

      <div class="quick-settings-toolbar">
        <el-input
          v-model.trim="query.keyword"
          class="quick-settings-toolbar__search"
          clearable
          placeholder="搜索来源渠道名称、备注"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-select
          v-model="query.status"
          class="quick-settings-toolbar__select"
          clearable
          placeholder="状态"
          @change="handleSearch"
        >
          <el-option
            v-for="option in statusOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <AppButton variant="soft" @click="() => loadChannels()">刷新</AppButton>
        <AppButton variant="primary" @click="openCreate">新增来源渠道</AppButton>
      </div>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="channels"
        row-key="id"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无 Apple ID 来源渠道</strong>
            <span>可以新增来源渠道，或清空筛选后重新查看。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增来源渠道</AppButton>
            </div>
          </div>
        </template>
        <el-table-column prop="name" label="来源渠道名称" min-width="180" sortable="custom" />
        <el-table-column prop="status" label="状态" width="100" sortable="custom">
          <template #default="{ row }">
            <StatusTag :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="220">
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="170" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group">
              <AppButton size="small" variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton
                size="small"
                variant="danger"
                :loading="deletingChannelId === row.id"
                @click="deleteChannel(row)"
              >
                删除
              </AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="channels.length" class="mobile-record-list">
        <article v-for="channel in channels" :key="channel.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ channel.name }}</strong>
              <span>{{ channel.remark || '无备注' }}</span>
            </div>
            <StatusTag :status="channel.status" />
          </div>
          <div class="mobile-record-card__meta">
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(channel.updatedAt) }}</strong>
            </div>
          </div>
          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEdit(channel)">编辑</AppButton>
            <AppButton
              size="small"
              variant="danger"
              :loading="deletingChannelId === channel.id"
              @click="deleteChannel(channel)"
            >
              删除
            </AppButton>
          </div>
        </article>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadChannels()"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingChannel ? '编辑来源渠道' : '新增来源渠道'"
      width="min(560px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="来源渠道名称" prop="name">
          <el-input v-model.trim="form.name" placeholder="例如 供应商A / 闲鱼采购 / 内部自建" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" class="full-input">
            <el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            placeholder="可记录供应商说明、采购注意事项或内部备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveChannel">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { appleAccountSourceChannelsApi } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import StatusTag from '@/components/ui/StatusTag.vue';
import type { AppleAccountSourceChannel } from '@/types/system';
import { invalidateSmartQueries } from '@/utils/smartQuery';

const statusOptions: Array<{ label: string; value: AppleAccountSourceChannel['status'] }> = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' }
];

const loading = ref(false);
const saving = ref(false);
const deletingChannelId = ref('');
const dialogVisible = ref(false);
const editingChannel = ref<AppleAccountSourceChannel | null>(null);
const formRef = ref<FormInstance>();
const channels = ref<AppleAccountSourceChannel[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  sortBy: '',
  sortOrder: '' as '' | 'asc' | 'desc'
});

const form = reactive({
  name: '',
  status: 'active' as AppleAccountSourceChannel['status'],
  remark: ''
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入来源渠道名称', trigger: 'blur' }]
};

const activeChannelCount = computed(
  () => channels.value.filter((channel) => channel.status === 'active').length
);

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

async function loadChannels() {
  loading.value = true;
  try {
    const data = await appleAccountSourceChannelsApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    channels.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载来源渠道失败');
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  query.page = 1;
  void loadChannels();
}

function clearFilters() {
  query.keyword = '';
  query.status = '';
  query.sortBy = '';
  query.sortOrder = '';
  query.page = 1;
  void loadChannels();
}

function handleSortChange({
  prop,
  order
}: {
  prop: string;
  order: 'ascending' | 'descending' | null;
}) {
  query.sortBy = prop || '';
  query.sortOrder = order === 'ascending' ? 'asc' : order === 'descending' ? 'desc' : '';
  void loadChannels();
}

function resetForm() {
  form.name = '';
  form.status = 'active';
  form.remark = '';
}

function openCreate() {
  editingChannel.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(channel: AppleAccountSourceChannel) {
  editingChannel.value = channel;
  form.name = channel.name;
  form.status = channel.status;
  form.remark = channel.remark ?? '';
  dialogVisible.value = true;
}

async function saveChannel() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      status: form.status,
      remark: form.remark || null
    };

    if (editingChannel.value) {
      await appleAccountSourceChannelsApi.update(editingChannel.value.id, payload);
    } else {
      await appleAccountSourceChannelsApi.create(payload);
    }

    ElMessage.success('来源渠道已保存');
    dialogVisible.value = false;
    invalidateSmartQueries('apple-account-source-channels');
    invalidateSmartQueries('apple-accounts');
    await loadChannels();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存来源渠道失败');
  } finally {
    saving.value = false;
  }
}

async function deleteChannel(channel: AppleAccountSourceChannel) {
  try {
    await ElMessageBox.confirm(`确认删除来源渠道「${channel.name}」？`, '删除来源渠道', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }

  deletingChannelId.value = channel.id;
  try {
    await appleAccountSourceChannelsApi.remove(channel.id);
    ElMessage.success('来源渠道已删除');
    invalidateSmartQueries('apple-account-source-channels');
    invalidateSmartQueries('apple-accounts');
    await loadChannels();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除来源渠道失败');
  } finally {
    deletingChannelId.value = '';
  }
}

onMounted(loadChannels);
</script>
