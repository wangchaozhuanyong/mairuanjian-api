<template>
  <PageScaffold
    title="首页仪表盘"
    group="工作台"
    phase="Phase 16"
    description="汇总后台模块接入、核心闭环、上线门禁和后续自动化增强状态。"
  >
    <template #actions>
      <el-button @click="previewDrawerVisible = true">查看当前状态</el-button>
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
        hint="可进入真实业务或系统页面"
        tone="green"
      />
      <MetricCard
        label="待完善页面"
        :value="notReadyCount"
        hint="设计完成、规划中或后期增强"
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
          <p>已接入模块可直接进入；自动化和平台类模块按当前上线策略分阶段增强。</p>
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
          <p>当前工程底座和本地验收脚本保持一致，正式发布仍受手工门禁控制。</p>
        </div>
      </div>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="后端">NestJS + Prisma</el-descriptions-item>
        <el-descriptions-item label="前端">Vue 3 + Element Plus</el-descriptions-item>
        <el-descriptions-item label="数据库">PostgreSQL</el-descriptions-item>
        <el-descriptions-item label="队列">Redis + BullMQ</el-descriptions-item>
      </el-descriptions>
    </section>

    <section class="content-panel">
      <div class="panel-title-row">
        <div>
          <h3>闭环状态</h3>
          <p>半自动运营主流程已具备验收入口，外部平台和真实 Worker 仍按路线图推进。</p>
        </div>
      </div>
      <div class="status-grid">
        <div v-for="item in workflowStatus" :key="item.title" class="status-card">
          <span>{{ item.title }}</span>
          <el-tag :type="item.type" size="small" effect="light">{{ item.status }}</el-tag>
          <p>{{ item.description }}</p>
        </div>
      </div>
    </section>

    <AppDrawer v-model="previewDrawerVisible" title="首页仪表盘 · 当前状态" confirm-text="我知道了">
      <el-alert
        title="当前首版策略为半自动可运营优先"
        description="Apple ID 主流程、兑换码半自动发货和敏感字段审计已具备模拟验收入口；淘宝/闲鱼真实开放平台、Apple ID 真实自动化 Worker 和 Telegram 真实测试仍需要单独完成。"
        type="success"
        show-icon
        :closable="false"
      />
      <el-divider />
      <div class="mini-list">
        <div class="mini-row">
          <span>Apple ID 代充业务</span>
          <el-tag type="success" size="small">主流程已接入</el-tag>
        </div>
        <div class="mini-row">
          <span>兑换码自动发货</span>
          <el-tag type="success" size="small">半自动已接入</el-tag>
        </div>
        <div class="mini-row">
          <span>淘宝/闲鱼真实自动化</span>
          <el-tag type="warning" size="small">后续接入</el-tag>
        </div>
        <div class="mini-row">
          <span>权限、审计和敏感查看</span>
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
const notReadyCount = computed(
  () => moduleRows.value.filter((item) => item.status !== 'ready').length
);
const workflowStatus: Array<{
  title: string;
  status: string;
  description: string;
  type: 'success' | 'warning' | 'info';
}> = [
  {
    title: 'Apple ID 代充主流程',
    status: '可验收',
    description: '账号、充值、匹配、订单、开通、扣费、续费任务和利润计算已形成半自动闭环。',
    type: 'success'
  },
  {
    title: '兑换码半自动发货',
    status: '可验收',
    description: '批量导入、去重、锁码、生成发货内容、发货记录和防重复发货已接入。',
    type: 'success'
  },
  {
    title: '外部平台自动化',
    status: '后续接入',
    description: '淘宝/闲鱼真实 OAuth、签名、订单同步、发货和退款仍依赖开放平台配置。',
    type: 'warning'
  },
  {
    title: 'Apple ID 自动化 Worker',
    status: '人工兜底',
    description: '自动充值、取消订阅、资料变更等真实执行器未接入前会转人工验证。',
    type: 'warning'
  },
  {
    title: '发布手工门禁',
    status: '需人工确认',
    description: 'Telegram 真实测试、生产环境证据记录和 Git 基线确认必须真实完成后才能放行。',
    type: 'info'
  }
];

function showReadyMessage() {
  ElMessage.success('已进入模块验收模式，请按上线清单逐项确认');
}

async function goTo(route: string) {
  await router.push(route);
}
</script>
