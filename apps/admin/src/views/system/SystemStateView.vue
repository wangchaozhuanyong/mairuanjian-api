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
      <AppButton v-if="isRouteError" @click="reloadPage">刷新页面</AppButton>
      <AppButton variant="primary" @click="router.push(primaryAction.route)">
        {{ primaryAction.label }}
      </AppButton>
    </template>

    <section class="content-panel" aria-label="系统状态概览">
      <div class="panel-title-row">
        <PanelTitleHelp :title="`${state.title}概览`" :help="stateOverviewHelp" />
      </div>
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

    <AppCard
      :title="state.cardTitle"
      :subtitle="state.cardSubtitle"
      :help="stateCardHelp"
      :tag="state.actionTag"
    >
      <AppState
        :type="state.stateType"
        :title="state.stateTitle"
        :description="state.stateDescription"
        :primary-label="isRouteError ? '刷新页面' : '回到首页'"
        secondary-label="返回上一页"
        @primary="handleStatePrimary"
        @secondary="router.back()"
      />
    </AppCard>

    <AppCard
      title="建议操作"
      subtitle="保持当前业务数据不受影响，只处理访问路径或维护窗口。"
      :help="stateActionHelp"
    >
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
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useAuthStore } from '@/stores/auth';
import { buildHelpText } from '@/utils/helpText';
import { hasUserRoutePermission } from '@/utils/permissions';

type StateTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
type AppStateType = 'empty' | 'error' | 'forbidden' | 'info' | 'loading' | 'success' | 'warning';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

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
    primaryLabel: '回到首页',
    primaryRoute: '/dashboard',
    cardTitle: '访问被拦截',
    cardSubtitle: '当前账号不能访问这个页面，系统已停止本次访问以保护业务数据。',
    stateType: 'forbidden',
    stateTitle: '没有访问权限',
    stateDescription: '请回到工作台继续处理可访问业务；确实需要该页面时，请联系管理员开通。',
    metrics: [
      {
        label: '访问状态',
        value: '已拦截',
        hint: '当前账号不可访问',
        tag: '受限',
        tagTone: 'purple'
      },
      { label: '数据安全', value: '已保护', hint: '不会展示敏感业务数据' },
      { label: '处理建议', value: '联系管理员', hint: '确认是否需要开通该页面' }
    ],
    actions: [
      { title: '联系管理员', description: '说明要访问的页面和业务原因，由管理员判断是否开通。' },
      { title: '重新导航', description: '从左侧菜单进入当前账号已经开通的业务页面。' },
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
    title: '系统维护中',
    group: '服务状态',
    phase: 'Phase 13',
    description: '系统维护期间展示影响范围、恢复时间和可用入口。',
    tone: 'blue',
    actionTag: '维护中',
    primaryLabel: '回到首页',
    primaryRoute: '/dashboard',
    cardTitle: '系统正在维护',
    cardSubtitle: '维护期间部分功能会暂停，避免更新中的业务数据出错。',
    stateType: 'info',
    stateTitle: '当前功能暂时不可用',
    stateDescription: '请稍后再试，或先回到首页处理仍可访问的业务。',
    metrics: [
      { label: '维护状态', value: '进行中', hint: '部分页面暂不可用', tag: '保护中' },
      { label: '业务数据', value: '已保护', hint: '避免更新期间产生不一致' },
      { label: '建议操作', value: '稍后重试', hint: '恢复后继续处理业务' }
    ],
    actions: [
      { title: '等待恢复', description: '维护完成后再继续处理当前页面的业务。' },
      { title: '回到首页', description: '先查看首页里仍可处理的订单、续费和发货任务。' },
      { title: '联系管理员', description: '如果维护时间影响业务处理，请联系管理员确认恢复安排。' }
    ]
  },
  'route-error': {
    title: '页面加载失败',
    group: '异常页面',
    phase: 'Design',
    description: '页面资源或运行状态加载失败，系统已停止继续渲染当前页面。',
    tone: 'red',
    actionTag: '加载失败',
    primaryLabel: '回到首页',
    primaryRoute: '/dashboard',
    cardTitle: '当前页面暂时不可用',
    cardSubtitle: '可能是网络中断、前端资源更新，或页面运行时加载异常。',
    stateType: 'error',
    stateTitle: '页面没有成功加载',
    stateDescription:
      '当前业务数据没有被修改。请先刷新页面；如果仍失败，再返回首页重新进入功能模块。',
    metrics: [
      {
        label: '页面状态',
        value: '加载失败',
        hint: '已停止继续渲染',
        tag: '可重试',
        tagTone: 'red'
      },
      { label: '业务数据', value: '未写入', hint: '本次异常不会提交表单或订单' },
      { label: '建议操作', value: '刷新页面', hint: '重新获取页面资源后再继续' }
    ],
    actions: [
      { title: '刷新页面', description: '重新加载前端资源，适合系统刚更新或网络短暂中断。' },
      { title: '返回首页', description: '从工作台重新进入业务模块，避免停留在失败页面。' },
      { title: '记录现象', description: '如果多次失败，请记录页面路径和操作步骤交给管理员排查。' }
    ]
  }
};

const state = computed(() => {
  const moduleKey = String(route.meta.moduleKey ?? '');
  return stateMap[moduleKey] ?? stateMap['not-found'];
});
const isRouteError = computed(() => String(route.meta.moduleKey ?? '') === 'route-error');
const primaryAction = computed(() => {
  if (canAccessRoute(state.value.primaryRoute)) {
    return {
      label: state.value.primaryLabel,
      route: state.value.primaryRoute
    };
  }

  return {
    label: '回到首页',
    route: '/dashboard'
  };
});
const stateOverviewHelp = computed(() =>
  buildHelpText({
    description: `${state.value.title}概览会说明当前访问为什么被限制，以及业务数据是否受影响。`,
    suggestion: '先看访问状态和处理建议，再决定返回上一页、回首页或联系管理员。',
    example: '例如遇到 403，先回到工作台继续处理可访问业务；遇到维护中，等待恢复后再进入。'
  })
);
const stateCardHelp = computed(() =>
  buildHelpText({
    description: state.value.cardSubtitle,
    suggestion: '不要在异常页反复刷新写入型操作，先回到首页确认当前可处理任务。',
    example: `例如看到“${state.value.stateTitle}”，可以用下方按钮回到首页或返回上一页。`
  })
);
const stateActionHelp = computed(() =>
  buildHelpText({
    description: '这里给出当前状态下最稳的下一步，不直接改业务数据。',
    suggestion: '按建议先检查路径、权限或维护窗口，确认后再回到业务页面继续处理。',
    example: '例如旧链接打不开时，从左侧菜单重新进入页面，比手动改地址更稳。'
  })
);

function canAccessRoute(path: string) {
  const targetRoute = router.resolve(path);

  if (targetRoute.matched.some((record) => Boolean(record.meta.adminOnly))) {
    return Boolean(authStore.user?.roles.includes('admin'));
  }

  return hasUserRoutePermission(authStore.user, targetRoute.meta.permission);
}

function reloadPage() {
  window.location.reload();
}

function handleStatePrimary() {
  if (isRouteError.value) {
    reloadPage();
    return;
  }

  void router.push('/dashboard');
}
</script>
