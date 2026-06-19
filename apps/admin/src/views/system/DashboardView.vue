<template>
  <PageScaffold
    title="首页仪表盘"
    group="工作台"
    phase="Design"
    description="用于预览后台整体信息架构、模块接入状态、基础设施和统一交互体验。真实业务指标会在对应模块开发时接入。"
  >
    <template #actions>
      <el-tag type="success" effect="light">Phase 1 已接入</el-tag>
      <el-button @click="previewDrawerVisible = true">查看设计说明</el-button>
      <el-button type="primary" @click="showReadyMessage">开始模块验收</el-button>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard
        label="当前账号"
        :value="authStore.displayName"
        hint="已接入真实登录态"
        tone="blue"
      />
      <MetricCard
        label="已接入页面"
        :value="readyCount"
        hint="登录、用户、权限、审计日志"
        tone="green"
      />
      <MetricCard
        label="规划页面"
        :value="plannedCount"
        hint="Apple ID、兑换码、通知、安全、运维"
        tone="orange"
      />
      <MetricCard
        label="权限数量"
        :value="authStore.user?.permissions.length ?? 0"
        hint="来自当前登录用户"
        tone="purple"
      />
    </div>

    <section class="content-panel">
      <div class="panel-title-row">
        <div>
          <h3>模块接入状态</h3>
          <p>菜单已覆盖最终后台页面，未开发模块显示待接入接口状态。</p>
        </div>
        <el-tag type="info" effect="plain">菜单配置驱动</el-tag>
      </div>

      <el-table :data="moduleRows" row-key="key">
        <el-table-column prop="title" label="页面" min-width="180" />
        <el-table-column prop="group" label="业务区" min-width="150" />
        <el-table-column prop="phase" label="阶段" width="110" />
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="260" show-overflow-tooltip />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="goTo(row.route)">进入</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <div>
          <h3>基础设施</h3>
          <p>设计层保持和后端基础工程一致，后续模块按文档逐步接入。</p>
        </div>
      </div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="后端">NestJS + Prisma</el-descriptions-item>
        <el-descriptions-item label="前端">Vue 3 + Element Plus</el-descriptions-item>
        <el-descriptions-item label="数据库">PostgreSQL</el-descriptions-item>
        <el-descriptions-item label="队列">Redis + BullMQ</el-descriptions-item>
      </el-descriptions>
    </section>

    <ExperiencePreview />

    <AppDrawer v-model="previewDrawerVisible" title="首页仪表盘 · 设计说明" confirm-text="我知道了">
      <el-alert
        title="本阶段只做设计和体验底座"
        description="页面会预留真实后台需要的筛选、表格、抽屉、弹窗、加载、空状态、错误状态和权限状态；不会接入 Apple ID 或兑换码业务逻辑。"
        type="info"
        show-icon
        :closable="false"
      />
      <el-divider />
      <div class="mini-list">
        <div class="mini-row">
          <span>Apple ID 代充业务</span>
          <el-tag type="warning" size="small">待接入</el-tag>
        </div>
        <div class="mini-row">
          <span>兑换码自动发货</span>
          <el-tag type="warning" size="small">待接入</el-tag>
        </div>
        <div class="mini-row">
          <span>权限和审计日志</span>
          <el-tag type="success" size="small">已接入</el-tag>
        </div>
      </div>
    </AppDrawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import ExperiencePreview from '@/components/ui/ExperiencePreview.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import { allModules, getStatusText, getStatusType } from '@/config/modules';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const previewDrawerVisible = ref(false);

const moduleRows = computed(() => allModules.filter((item) => item.group !== '异常页面'));
const readyCount = computed(
  () => moduleRows.value.filter((item) => item.status === 'ready').length
);
const plannedCount = computed(
  () =>
    moduleRows.value.filter((item) => item.status === 'planned' || item.status === 'later').length
);

function showReadyMessage() {
  ElMessage.success('设计页面已准备好逐页验收');
}

async function goTo(route: string) {
  await router.push(route);
}
</script>
