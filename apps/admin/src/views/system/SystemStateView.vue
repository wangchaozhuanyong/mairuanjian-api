<template>
  <PageScaffold
    :title="state.title"
    :group="state.group"
    :phase="state.phase"
    :description="state.description"
  >
    <template #actions>
      <StatusChip :tone="state.tone" dot>{{ state.actionTag }}</StatusChip>
      <AppButton @click="router.back()">返回上一页</AppButton>
      <AppButton variant="primary" @click="router.push(state.primaryRoute)">
        {{ state.primaryLabel }}
      </AppButton>
    </template>

    <section class="content-panel" aria-label="系统状态概览">
      <div class="detail-note-grid">
        <div v-for="metric in state.metrics" :key="metric.label" class="detail-note-item">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <span>{{ metric.hint }}</span>
          <StatusChip v-if="metric.tag" :tone="metric.tagTone ?? 'blue'">
            {{ metric.tag }}
          </StatusChip>
        </div>
      </div>
    </section>

    <AppCard :title="state.cardTitle" :subtitle="state.cardSubtitle" :tag="state.actionTag">
      <AppState
        :type="state.stateType"
        :title="state.stateTitle"
        :description="state.stateDescription"
        primary-label="回到首页"
        secondary-label="返回上一页"
        @primary="router.push('/dashboard')"
        @secondary="router.back()"
      />
    </AppCard>

    <AppCard title="建议操作" subtitle="保持当前业务数据不受影响，只处理访问路径或维护窗口。">
      <div class="feature-grid">
        <div v-for="item in state.actions" :key="item.title" class="feature-card">
          <strong>{{ item.title }}</strong>
          <span>{{ item.description }}</span>
        </div>
      </div>
    </AppCard>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppState from '@/components/ui/AppState.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import StatusChip from '@/components/ui/StatusChip.vue';

type StateTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
type AppStateType = 'empty' | 'error' | 'forbidden' | 'info' | 'loading' | 'success' | 'warning';

const route = useRoute();
const router = useRouter();

const stateMap: Record<
  string,
  {
    title: string;
    group: string;
    phase: string;
    description: string;
    tone: StateTone;
    actionTag: string;
    primaryLabel: string;
    primaryRoute: string;
    cardTitle: string;
    cardSubtitle: string;
    stateType: AppStateType;
    stateTitle: string;
    stateDescription: string;
    metrics: Array<{
      label: string;
      value: string;
      hint: string;
      tag?: string;
      tagTone?: StateTone;
    }>;
    actions: Array<{ title: string; description: string }>;
  }
> = {
  forbidden: {
    title: '403 无权限',
    group: '异常页面',
    phase: 'Design',
    description: '当前账号没有访问该页面或操作的权限。',
    tone: 'purple',
    actionTag: '权限限制',
    primaryLabel: '去安全中心',
    primaryRoute: '/system/security',
    cardTitle: '访问被拦截',
    cardSubtitle: '系统已按角色权限和字段权限阻止本次访问。',
    stateType: 'forbidden',
    stateTitle: '没有访问权限',
    stateDescription: '请确认当前员工账号的角色、权限点和敏感字段授权是否已经配置。',
    metrics: [
      { label: '状态码', value: '403', hint: '权限校验未通过', tag: '拦截', tagTone: 'purple' },
      { label: '数据安全', value: '已保护', hint: '不会展示敏感业务数据' },
      { label: '处理建议', value: '申请授权', hint: '由管理员调整角色权限' }
    ],
    actions: [
      { title: '检查角色', description: '进入权限管理确认当前账号是否拥有页面权限。' },
      { title: '申请授权', description: '敏感字段或高风险页面需要管理员审批后再访问。' },
      { title: '返回工作台', description: '回到可访问页面继续处理订单、续费和发货任务。' }
    ]
  },
  'not-found': {
    title: '404 页面',
    group: '异常页面',
    phase: 'Design',
    description: '当前访问地址不存在，或菜单入口已经调整。',
    tone: 'orange',
    actionTag: '路径无效',
    primaryLabel: '回到首页',
    primaryRoute: '/dashboard',
    cardTitle: '页面没有找到',
    cardSubtitle: '可能是旧链接、拼写错误，或该模块尚未进入生产菜单。',
    stateType: 'warning',
    stateTitle: '找不到这个页面',
    stateDescription: '请从左侧菜单重新进入功能模块，或使用顶部搜索定位客户、订单和任务。',
    metrics: [
      { label: '状态码', value: '404', hint: '路由未匹配', tag: '检查路径', tagTone: 'orange' },
      { label: '业务数据', value: '未影响', hint: '没有执行任何写入操作' },
      { label: '建议入口', value: '首页', hint: '从工作台重新导航' }
    ],
    actions: [
      { title: '重新导航', description: '通过左侧菜单进入当前需要处理的业务模块。' },
      { title: '检查链接', description: '确认地址是否来自旧版本页面或复制时被截断。' },
      { title: '回到首页', description: '首页保留常用入口和当前任务状态，可快速回到工作流。' }
    ]
  },
  'maintenance-mode': {
    title: '系统维护模式页',
    group: '系统管理',
    phase: 'Phase 13',
    description: '系统维护期间展示影响范围、恢复时间和可用入口。',
    tone: 'blue',
    actionTag: '维护中',
    primaryLabel: '查看维护配置',
    primaryRoute: '/system/maintenance',
    cardTitle: '系统正在维护',
    cardSubtitle: '维护模式会保护正在迁移或更新的数据，避免员工误操作。',
    stateType: 'info',
    stateTitle: '当前功能暂时不可用',
    stateDescription: '请等待维护窗口结束，管理员角色可进入网站维护页面查看公告和恢复时间。',
    metrics: [
      { label: '维护状态', value: '启用', hint: '访问已按角色范围限制', tag: '保护中' },
      { label: '数据写入', value: '受控', hint: '避免更新期间产生不一致' },
      { label: '管理员入口', value: '维护配置', hint: '查看公告、窗口和功能开关' }
    ],
    actions: [
      { title: '查看公告', description: '维护说明应写清影响模块、开始时间和预计恢复时间。' },
      { title: '等待恢复', description: '普通员工等待维护完成后再继续处理业务。' },
      { title: '管理员处理', description: '管理员可进入网站维护页面关闭维护模式或调整白名单。' }
    ]
  }
};

const state = computed(() => {
  const moduleKey = String(route.meta.moduleKey ?? '');
  return stateMap[moduleKey] ?? stateMap['not-found'];
});
</script>
