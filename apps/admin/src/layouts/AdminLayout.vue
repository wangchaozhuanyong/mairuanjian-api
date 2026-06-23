<template>
  <div class="app-shell">
    <div
      class="route-progress"
      :class="{ active: isRoutePending || isDataRefreshing }"
      aria-hidden="true"
    >
      <span />
    </div>

    <aside class="app-sidebar" :class="{ 'app-sidebar--open': sidebarOpen }">
      <div class="brand">
        <span class="brand-mark">ID</span>
        <span class="brand-copy">
          <strong>代充业务控制台</strong>
          <small>ID · 自动发货</small>
        </span>
      </div>

      <el-input v-model="menuKeyword" class="menu-search" placeholder="搜索菜单 / 页面" clearable />

      <nav class="sidebar-nav">
        <section v-for="section in filteredSections" :key="section.title" class="nav-section">
          <button
            class="nav-section-toggle"
            :class="{ active: isSectionActive(section) }"
            :aria-label="getSectionToggleLabel(section)"
            :title="getSectionNotificationTitle(section)"
            type="button"
            @focus="prefetchMenuSection(section)"
            @mouseenter="prefetchMenuSection(section)"
            @click="toggleMenuKey(section.key)"
          >
            <span class="nav-section-toggle__label">
              <span class="nav-section-icon" :class="`nav-section-icon--${section.icon}`">
                <el-icon>
                  <component :is="sectionIconMap[section.icon]" />
                </el-icon>
              </span>
              <span>{{ section.title }}</span>
            </span>
            <span
              v-if="getSectionNotificationBadge(section)"
              class="nav-section-alert"
              :class="`is-${getSectionNotificationTone(section)}`"
            >
              {{ getSectionNotificationBadgeLabel(section) }}
            </span>
            <span class="nav-section-toggle__meta">
              <span class="nav-count">{{ getSectionItemCount(section) }}</span>
              <span class="nav-chevron" :class="{ open: isSectionOpen(section) }">›</span>
            </span>
          </button>

          <div v-show="isSectionOpen(section)" class="nav-section-body">
            <RouterLink
              v-for="item in section.items"
              :key="item.key"
              :to="item.route"
              class="nav-link"
              :class="{ active: isItemActive(item) }"
              @pointerdown="prefetchWorkspaceRoute(item.route)"
              @focus="prefetchWorkspaceRoute(item.route)"
              @mouseenter="prefetchWorkspaceRoute(item.route)"
              @click="handleMenuItemClick(item)"
            >
              <span class="nav-mark">{{ item.mark }}</span>
              <span class="nav-title">{{ getMenuItemTitle(item) }}</span>
              <span
                v-if="getMenuItemBadge(item)"
                class="nav-badge"
                :class="`is-${getMenuItemBadgeTone(item)}`"
                :title="getMenuItemBadgeTitle(item)"
              >
                {{ getMenuItemBadgeLabel(item) }}
              </span>
            </RouterLink>
          </div>
        </section>
      </nav>

      <div class="sidebar-operator">
        <span class="avatar">管</span>
        <span>
          <strong>{{ authStore.displayName }}</strong>
          <small>{{ sessionStatusText }}</small>
        </span>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="sidebar-mask" @click="sidebarOpen = false" />

    <section class="app-main">
      <header class="topbar">
        <AppButton
          class="mobile-menu-btn"
          icon-only
          aria-label="打开菜单"
          @click="sidebarOpen = true"
        >
          <el-icon>
            <Menu />
          </el-icon>
        </AppButton>
        <div class="page-head">
          <div class="page-title-row">
            <h2>{{ routeTitle }}</h2>
            <FeatureHelp
              v-if="hasRouteHelp"
              class="page-help-button"
              placement="bottom"
              :title="routeTitle"
              :text="routeHelp"
            />
          </div>
          <div
            class="page-data-status"
            :class="`page-data-status--${dataStatusTone}`"
            :title="dataStatusTitle"
            aria-live="polite"
          >
            <span class="page-data-status__dot" />
            <span>{{ dataStatusText }}</span>
          </div>
        </div>

        <el-popover
          placement="bottom-start"
          width="420"
          trigger="focus"
          popper-class="global-search-popover"
        >
          <template #reference>
            <el-input
              v-model="globalKeyword"
              class="global-search"
              placeholder="搜索客户微信、ID、订单号、兑换码尾号、任务备注"
              clearable
            />
          </template>
          <div class="global-search-panel">
            <div class="global-search-panel__head">
              <span class="global-search-panel__mark">GS</span>
              <div>
                <strong>全局搜索</strong>
                <p>按权限范围检索客户、订单、Apple ID、兑换码和任务备注。</p>
              </div>
            </div>

            <div v-if="globalKeywordTrimmed" class="global-search-query">
              <span>当前关键词</span>
              <strong>{{ globalKeywordTrimmed }}</strong>
            </div>

            <div class="global-search-scope-list">
              <section
                v-for="scope in globalSearchScopes"
                :key="scope.title"
                class="global-search-scope"
              >
                <span class="global-search-scope__icon">{{ scope.mark }}</span>
                <span>
                  <strong>{{ scope.title }}</strong>
                  <small>{{ scope.description }}</small>
                </span>
              </section>
            </div>

            <p v-if="!globalKeywordTrimmed" class="global-search-panel__hint">
              输入关键词后，结果会按模块和权限范围归类展示。
            </p>
            <p v-else class="global-search-panel__hint">
              当前没有展开详细结果，后续可在对应模块内继续筛选。
            </p>
          </div>
        </el-popover>

        <div class="topbar-actions">
          <PageActionsPortal />
          <AppButton
            class="topbar-action topbar-action--refresh"
            icon-only
            title="刷新"
            aria-label="刷新"
            :loading="isPageRefreshBusy"
            :disabled="isPageRefreshBusy"
            @click="showRefresh"
          >
            <el-icon>
              <Refresh />
            </el-icon>
          </AppButton>
          <el-badge
            :value="formatNotificationCount(notificationBadgeTotal)"
            :hidden="notificationBadgeTotal === 0"
            class="notification-badge"
          >
            <AppButton
              class="topbar-action"
              icon-only
              title="通知"
              aria-label="通知"
              @click="notificationDrawerVisible = true"
            >
              <el-icon>
                <Bell />
              </el-icon>
            </AppButton>
          </el-badge>
          <AppButton
            class="topbar-action topbar-action--primary"
            variant="primary"
            @click="goToOrderEntry"
          >
            <el-icon>
              <Plus />
            </el-icon>
            <span>新建订单</span>
          </AppButton>

          <el-dropdown trigger="click" @command="handleCommand">
            <AppButton class="topbar-action topbar-action--user">
              {{ authStore.displayName }}
            </AppButton>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="security">安全中心</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div
        v-if="workspaceTabs.length"
        class="workspace-tabs"
        :class="{
          'workspace-tabs--two-rows': workspaceTabs.length > WORKSPACE_TABS_PER_ROW
        }"
      >
        <div
          class="workspace-tabs__list"
          :class="{
            'workspace-tabs__list--two-rows': workspaceTabs.length > WORKSPACE_TABS_PER_ROW
          }"
          role="tablist"
          aria-label="已打开页面"
        >
          <div
            v-for="tab in workspaceTabs"
            :key="tab.fullPath"
            class="workspace-tab"
            :class="{
              active: isWorkspaceTabActive(tab)
            }"
          >
            <button
              class="workspace-tab__button"
              type="button"
              role="tab"
              :aria-selected="isWorkspaceTabActive(tab)"
              :title="tab.title"
              @pointerdown="prefetchWorkspaceRoute(tab.fullPath)"
              @click="switchWorkspaceTab(tab)"
            >
              <span class="workspace-tab__title">{{ tab.title }}</span>
            </button>
            <button
              class="workspace-tab__close"
              type="button"
              :aria-label="`关闭${tab.title}`"
              @click="closeWorkspaceTab(tab)"
            >
              <el-icon>
                <CloseBold />
              </el-icon>
            </button>
          </div>
        </div>

        <div class="workspace-tabs__actions" aria-label="页签操作">
          <AppButton
            class="workspace-tabs__action workspace-tabs__action--current"
            size="small"
            title="关闭当前页签"
            :disabled="!activeWorkspaceTab"
            @click="closeActiveWorkspaceTab"
          >
            <el-icon class="workspace-tabs__action-icon">
              <Close />
            </el-icon>
            <span>关闭当前</span>
          </AppButton>
          <AppButton
            class="workspace-tabs__action workspace-tabs__action--others"
            size="small"
            title="只保留当前页签"
            :disabled="workspaceTabs.length <= 1 || !activeWorkspaceTab"
            @click="closeOtherWorkspaceTabs"
          >
            <el-icon class="workspace-tabs__action-icon">
              <FolderRemove />
            </el-icon>
            <span>关闭其他</span>
          </AppButton>
          <AppButton
            class="workspace-tabs__action workspace-tabs__action--all"
            size="small"
            title="关闭全部页签"
            variant="danger"
            @click="closeAllWorkspaceTabs"
          >
            <el-icon class="workspace-tabs__action-icon">
              <Delete />
            </el-icon>
            <span>关闭全部</span>
          </AppButton>
        </div>
      </div>

      <main ref="workspaceRef" class="workspace">
        <RouterView v-slot="{ Component: ViewComponent, route: viewRoute }">
          <Suspense :timeout="220">
            <template #default>
              <Transition name="workspace-view">
                <KeepAlive :key="workspaceCacheVersion" :max="WORKSPACE_CACHE_LIMIT">
                  <component :is="ViewComponent" :key="getWorkspaceViewKey(viewRoute)" />
                </KeepAlive>
              </Transition>
            </template>
            <template #fallback>
              <WorkspaceRouteSkeleton :title="String(viewRoute.meta.title ?? '后台页面')" />
            </template>
          </Suspense>
        </RouterView>
      </main>
    </section>

    <AppDrawer
      v-model="notificationDrawerVisible"
      title="通知中心"
      confirm-text="进入通知中心"
      show-confirm
      @confirm="goToNotifications"
    >
      <div class="notification-drawer">
        <div class="notification-summary-grid">
          <section
            v-for="item in notificationSummary"
            :key="item.label"
            class="notification-summary-card"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.description }}</small>
          </section>
        </div>

        <div class="notification-feed">
          <div class="notification-feed__head">
            <strong>最近提醒</strong>
            <span>按主导航模块归类</span>
          </div>

          <template v-if="notificationItems.length">
            <div v-for="item in notificationItems" :key="item.title" class="notification-feed-item">
              <span class="notification-feed-item__mark" :class="`is-${item.tone}`" />
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
              <StatusChip :tone="item.tone" dot>{{ item.level }}</StatusChip>
            </div>
          </template>

          <p v-else class="notification-feed-empty">暂无消息提醒</p>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Bell,
  Close,
  CloseBold,
  DataAnalysis,
  Delete,
  FolderRemove,
  House,
  Iphone,
  Lock,
  Menu,
  Monitor,
  Plus,
  Refresh,
  Setting,
  Ticket,
  UserFilled
} from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FeatureHelp from '@/components/ui/FeatureHelp.vue';
import PageActionsPortal from '@/components/ui/PageActionsPortal.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import WorkspaceRouteSkeleton from '@/components/ui/WorkspaceRouteSkeleton.vue';
import { AUTH_SESSION_EXPIRED_EVENT } from '@/auth/session';
import { providePageActionsHost } from '@/composables/pageActions';
import { providePageRefreshHost } from '@/composables/pageRefresh';
import {
  type AppModuleItem,
  type MenuSection,
  type MenuSectionIcon,
  getModuleDisplayTitle,
  getModulePermission,
  getModuleSearchText,
  menuSections
} from '@/config/modules';
import {
  isRoutePending,
  prefetchReadyRouteComponents,
  prefetchRouteComponent,
  prefetchRouteComponents
} from '@/router';
import { useAuthStore } from '@/stores/auth';
import {
  NAVIGATION_ITEM_BADGES_CHANGED_EVENT,
  NAVIGATION_NOTIFICATION_BADGES_CHANGED_EVENT,
  notificationsApi
} from '@/api/system';
import {
  REALTIME_CONNECTION_STATUS_CHANGED_EVENT,
  getRealtimeSnapshot,
  type RealtimeConnectionStatusDetail
} from '@/realtime/realtimeClient';
import { notifyRealtimeScopesInvalidated } from '@/realtime/realtimeQueryEvents';
import { getRealtimeFallbackScopesForModule } from '@/realtime/realtimeRouteScopes';
import type { NavigationItemBadge, NavigationNotificationBadge } from '@/types/system';
import {
  clearSmartQueryCache,
  subscribeSmartQueryActivity,
  type SmartQueryActivitySnapshot
} from '@/utils/smartQuery';
import { normalizeHelpText } from '@/utils/helpText';

const NAV_OPEN_STORAGE_KEY = 'apple_business_sidebar_open_keys';
const WORKSPACE_TABS_STORAGE_KEY = 'apple_business_workspace_tabs';
const NOTIFICATION_BADGE_REFRESH_MS = 45_000;
const REALTIME_FALLBACK_POLL_MS = 24_000;
const WORKSPACE_TABS_PER_ROW = 6;
const WORKSPACE_TABS_ROWS = 2;
const WORKSPACE_TABS_LIMIT = WORKSPACE_TABS_PER_ROW * WORKSPACE_TABS_ROWS;
const WORKSPACE_CACHE_LIMIT = WORKSPACE_TABS_LIMIT;
const STARTUP_BADGE_REFRESH_DELAY_MS = 900;
const STARTUP_ROUTE_PREFETCH_DELAY_MS = 1_800;
const ROUTE_AUTO_REFRESH_DELAY_MS = 80;
const SECURITY_CENTER_ROUTE = '/system/security';
const SYSTEM_CONFIG_ROUTE = '/system/maintenance';
const SOURCE_OPTIONS_ROUTE = '/system/source-platforms';
const SECURITY_CENTER_ROUTES = new Set([
  SECURITY_CENTER_ROUTE,
  '/system/login-logs',
  '/system/sessions',
  '/system/mfa',
  '/system/ip-whitelist',
  '/system/sensitive-approvals'
]);
const SYSTEM_CONFIG_ROUTES = new Set([
  SYSTEM_CONFIG_ROUTE,
  '/system/feature-flags',
  '/system/versions',
  '/system/changelog',
  '/system/parameters'
]);
const SOURCE_OPTIONS_ROUTES = new Set([
  SOURCE_OPTIONS_ROUTE,
  '/system/source-platforms/platforms',
  '/system/source-platforms/customer-tags',
  '/system/source-platforms/apple-service-categories',
  '/system/source-platforms/apple-regions',
  '/system/source-platforms/apple-service-options',
  '/system/source-platforms/code-delivery-methods',
  '/system/source-platforms/code-delivery-modes',
  '/system/source-platforms/notification-options',
  '/system/source-platforms/system-options'
]);

interface WorkspaceTab {
  fullPath: string;
  title: string;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
providePageActionsHost();
const pageRefresh = providePageRefreshHost();
const sidebarOpen = ref(false);
const menuKeyword = ref('');
const globalKeyword = ref('');
const notificationDrawerVisible = ref(false);
const workspaceRef = ref<HTMLElement | null>(null);
const activePath = computed(() => route.path);
const openMenuKeys = ref(readStoredOpenMenuKeys());
const workspaceCacheVersion = ref(0);
const navigationNotificationBadges = ref<Record<string, NavigationNotificationBadge>>({});
const navigationItemBadges = ref<Record<string, NavigationItemBadge>>({});
const realtimeStatus = ref(getRealtimeSnapshot().status);
const smartQueryActivity = ref<SmartQueryActivitySnapshot>({
  pendingCount: 0,
  activeKeys: []
});
let notificationBadgeTimer: number | undefined;
let startupBadgeRefreshTimer: number | undefined;
let startupRoutePrefetchTimer: number | undefined;
let routeAutoRefreshTimer: number | undefined;
let realtimeFallbackTimer: number | undefined;
let workspaceScrollRestoreTimer: number | undefined;
let unsubscribeSmartQueryActivity: (() => void) | undefined;
const workspaceScrollPositions = new Map<string, number>();
const globalSearchScopes = [
  {
    mark: 'CU',
    title: '客户资料',
    description: '微信、手机号、来源平台'
  },
  {
    mark: 'ID',
    title: 'Apple ID 业务',
    description: '账号、订单、续费任务'
  },
  {
    mark: 'CD',
    title: '兑换码业务',
    description: '库存、发货、售后补发'
  }
];
const sectionIconMap = {
  workspace: House,
  common: UserFilled,
  id: Iphone,
  codes: Ticket,
  security: Lock,
  data: DataAnalysis,
  ops: Monitor,
  system: Setting
} satisfies Record<MenuSectionIcon, Component>;

const routeTitle = computed(() => String(route.meta.title ?? '后台管理'));
const routeDescription = computed(() => String(route.meta.description ?? ''));
const routeHelp = computed(() => {
  const metaHelp = route.meta.help as string | string[] | undefined;
  return normalizeHelpText(metaHelp ?? routeDescription.value);
});
const routeModuleKey = computed(() => String(route.meta.moduleKey ?? ''));
const hasRouteHelp = computed(() => routeHelp.value.length > 0);
const isPageRefreshBusy = computed(
  () => pageRefresh.refreshing.value || pageRefresh.backgroundRefreshing.value
);
const isDataRefreshing = computed(
  () => isPageRefreshBusy.value || smartQueryActivity.value.pendingCount > 0
);
const hasLatestDataError = computed(() => {
  const { lastErrorAt, lastSuccessAt } = smartQueryActivity.value;
  return Boolean(lastErrorAt && (!lastSuccessAt || lastErrorAt > lastSuccessAt));
});
const dataStatusTone = computed(() => {
  if (isDataRefreshing.value) return 'syncing';
  if (hasLatestDataError.value) return 'error';
  if (smartQueryActivity.value.lastSuccessAt) return 'fresh';
  return 'idle';
});
const dataStatusText = computed(() => {
  if (isDataRefreshing.value) {
    const count = smartQueryActivity.value.pendingCount;
    return count > 1 ? `正在更新 ${count} 项` : '正在更新数据';
  }

  if (hasLatestDataError.value) {
    return '更新失败';
  }

  return formatDataStatusTime(smartQueryActivity.value.lastSuccessAt);
});
const dataStatusTitle = computed(() => {
  if (hasLatestDataError.value) {
    return smartQueryActivity.value.lastErrorMessage ?? '数据更新失败';
  }

  return `${pageRefresh.active.value?.label ?? routeTitle.value}：${dataStatusText.value}`;
});
const activeWorkspaceTabPath = computed(() => route.fullPath);
const globalKeywordTrimmed = computed(() => globalKeyword.value.trim());
const sessionStatusText = computed(() => {
  if (authStore.userRefreshing) {
    return '验证登录中';
  }

  if (realtimeStatus.value === 'connected') {
    return '实时同步';
  }

  if (realtimeStatus.value === 'connecting' || realtimeStatus.value === 'error') {
    return '实时重连中';
  }

  return '在线';
});
const workspaceTabs = ref<WorkspaceTab[]>(readStoredWorkspaceTabs());
const activeWorkspaceTab = computed(() =>
  workspaceTabs.value.find((tab) => tab.fullPath === activeWorkspaceTabPath.value)
);
const navigationNotificationBadgeList = computed(() =>
  Object.values(navigationNotificationBadges.value).sort((left, right) => {
    if (right.todoCount !== left.todoCount) return right.todoCount - left.todoCount;
    return right.count - left.count;
  })
);
const notificationBadgeTotal = computed(() =>
  navigationNotificationBadgeList.value.reduce((sum, item) => sum + item.count, 0)
);
const notificationTodoTotal = computed(() =>
  navigationNotificationBadgeList.value.reduce((sum, item) => sum + item.todoCount, 0)
);
const notificationFailedTotal = computed(() =>
  navigationNotificationBadgeList.value.reduce((sum, item) => sum + item.failedCount, 0)
);
const notificationSummary = computed(() => [
  {
    label: '全部',
    value: formatNotificationCount(notificationBadgeTotal.value),
    description: '未读提醒'
  },
  {
    label: '待处理',
    value: formatNotificationCount(notificationTodoTotal.value),
    description: '需要处理'
  },
  {
    label: '异常',
    value: formatNotificationCount(notificationFailedTotal.value),
    description: '失败提醒'
  }
]);
const notificationItems = computed(() =>
  navigationNotificationBadgeList.value.map((item) => ({
    title: item.label,
    description: getNotificationItemDescription(item),
    level: item.todoCount > 0 ? '待处理' : '未读',
    tone: getNotificationItemTone(item)
  }))
);
const visibleSections = computed(() =>
  menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter(canAccessMenuItem)
    }))
    .filter((section) => section.items.length)
);

const filteredSections = computed(() => {
  const keyword = menuKeyword.value.trim().toLowerCase();

  if (!keyword) {
    return visibleSections.value;
  }

  return visibleSections.value
    .map((section) => ({
      ...section,
      items: filterMenuItems(section.items, keyword)
    }))
    .filter((section) => section.items.length);
});

watch(openMenuKeys, (keys) => {
  window.localStorage.setItem(NAV_OPEN_STORAGE_KEY, JSON.stringify([...keys]));
});

watch(activePath, () => {
  const activeSectionKey = getActiveSectionKey();

  if (activeSectionKey && !menuKeyword.value.trim()) {
    openMenuKeys.value = new Set([activeSectionKey]);
  }
});

watch(activeWorkspaceTabPath, () => addCurrentWorkspaceTab(), { immediate: true });

watch(activeWorkspaceTabPath, (nextPath, previousPath) => {
  if (previousPath) {
    saveWorkspaceScroll(previousPath);
  }

  restoreWorkspaceScroll(nextPath);
});

watch(
  [activeWorkspaceTabPath, () => pageRefresh.activeVersion.value],
  () => {
    scheduleActivePageRefresh();
  },
  { flush: 'post' }
);

watch(
  [realtimeStatus, routeModuleKey, () => authStore.isAuthenticated],
  () => {
    syncRealtimeFallbackPolling();
  },
  { immediate: true }
);

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      startAuthenticatedLayoutTimers();
      return;
    }

    stopAuthenticatedLayoutTimers();
    clearNavigationBadges();
  }
);

watch(
  workspaceTabs,
  (tabs) => {
    window.localStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, JSON.stringify(tabs));
  },
  { deep: true }
);

onMounted(() => {
  unsubscribeSmartQueryActivity = subscribeSmartQueryActivity((snapshot) => {
    smartQueryActivity.value = snapshot;
  });

  startAuthenticatedLayoutTimers();
  window.addEventListener(
    NAVIGATION_NOTIFICATION_BADGES_CHANGED_EVENT,
    handleNavigationNotificationBadgesChanged
  );
  window.addEventListener(NAVIGATION_ITEM_BADGES_CHANGED_EVENT, handleNavigationItemBadgesChanged);
  window.addEventListener(REALTIME_CONNECTION_STATUS_CHANGED_EVENT, handleRealtimeStatusChanged);
  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);
});

onBeforeUnmount(() => {
  saveWorkspaceScroll(activeWorkspaceTabPath.value);
  stopAuthenticatedLayoutTimers();
  window.clearTimeout(workspaceScrollRestoreTimer);
  unsubscribeSmartQueryActivity?.();

  window.removeEventListener(
    NAVIGATION_NOTIFICATION_BADGES_CHANGED_EVENT,
    handleNavigationNotificationBadgesChanged
  );
  window.removeEventListener(
    NAVIGATION_ITEM_BADGES_CHANGED_EVENT,
    handleNavigationItemBadgesChanged
  );
  window.removeEventListener(REALTIME_CONNECTION_STATUS_CHANGED_EVENT, handleRealtimeStatusChanged);
  window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleAuthSessionExpired);
});

function startAuthenticatedLayoutTimers() {
  if (!authStore.isAuthenticated) {
    return;
  }

  if (!startupRoutePrefetchTimer) {
    startupRoutePrefetchTimer = window.setTimeout(() => {
      startupRoutePrefetchTimer = undefined;

      if (authStore.isAuthenticated) {
        prefetchReadyRouteComponents(getInitialPrefetchRoutes());
      }
    }, STARTUP_ROUTE_PREFETCH_DELAY_MS);
  }

  if (!startupBadgeRefreshTimer) {
    startupBadgeRefreshTimer = window.setTimeout(() => {
      startupBadgeRefreshTimer = undefined;
      void refreshNavigationBadges();
    }, STARTUP_BADGE_REFRESH_DELAY_MS);
  }

  if (!notificationBadgeTimer) {
    notificationBadgeTimer = window.setInterval(
      () => void refreshNavigationBadges({ silent: true }),
      NOTIFICATION_BADGE_REFRESH_MS
    );
  }
}

function stopAuthenticatedLayoutTimers() {
  window.clearTimeout(startupBadgeRefreshTimer);
  window.clearTimeout(startupRoutePrefetchTimer);
  window.clearTimeout(routeAutoRefreshTimer);
  startupBadgeRefreshTimer = undefined;
  startupRoutePrefetchTimer = undefined;
  routeAutoRefreshTimer = undefined;

  if (notificationBadgeTimer) {
    window.clearInterval(notificationBadgeTimer);
    notificationBadgeTimer = undefined;
  }

  stopRealtimeFallbackPolling();
}

function handleAuthSessionExpired() {
  stopAuthenticatedLayoutTimers();
  clearNavigationBadges();
  notificationDrawerVisible.value = false;
  closeAllWorkspaceTabs();
  clearSmartQueryCache();
}

function clearNavigationBadges() {
  navigationNotificationBadges.value = {};
  navigationItemBadges.value = {};
}

function readStoredOpenMenuKeys() {
  const activeSectionKey = getActiveSectionKey();

  if (activeSectionKey) {
    return new Set([activeSectionKey]);
  }

  const defaultKey = menuSections.find((section) => section.defaultOpen)?.key;

  try {
    const stored = window.localStorage.getItem(NAV_OPEN_STORAGE_KEY);
    const storedKeys = stored ? (JSON.parse(stored) as string[]) : [];
    const storedKey = storedKeys.find(isMenuSectionKey);

    return new Set([storedKey ?? defaultKey].filter((key): key is string => Boolean(key)));
  } catch {
    return new Set([defaultKey].filter((key): key is string => Boolean(key)));
  }
}

function readStoredWorkspaceTabs() {
  try {
    const stored = window.localStorage.getItem(WORKSPACE_TABS_STORAGE_KEY);
    const storedTabs = stored ? (JSON.parse(stored) as unknown[]) : [];
    const seenPaths = new Set<string>();

    const validTabs = storedTabs.filter((tab): tab is WorkspaceTab => {
      if (!isWorkspaceTab(tab) || seenPaths.has(tab.fullPath)) {
        return false;
      }

      seenPaths.add(tab.fullPath);
      return true;
    });

    return limitWorkspaceTabs(validTabs);
  } catch {
    return [];
  }
}

function isWorkspaceTab(tab: unknown): tab is WorkspaceTab {
  if (!tab || typeof tab !== 'object') {
    return false;
  }

  const item = tab as WorkspaceTab;
  return typeof item.fullPath === 'string' && typeof item.title === 'string';
}

function getCurrentWorkspaceTitle() {
  return String(route.meta.title ?? route.name ?? '未命名页面');
}

function addCurrentWorkspaceTab() {
  if (route.meta.public || route.path === '/login') {
    return;
  }

  const fullPath = route.fullPath;
  const title = getCurrentWorkspaceTitle();
  const existingIndex = workspaceTabs.value.findIndex((tab) => tab.fullPath === fullPath);

  if (existingIndex >= 0) {
    const existingTab = workspaceTabs.value[existingIndex];

    if (existingTab.title !== title) {
      workspaceTabs.value = workspaceTabs.value.map((tab, index) =>
        index === existingIndex ? { ...tab, title } : tab
      );
    }

    return;
  }

  workspaceTabs.value = limitWorkspaceTabs([...workspaceTabs.value, { fullPath, title }]);
}

function isWorkspaceTabActive(tab: WorkspaceTab) {
  return tab.fullPath === activeWorkspaceTabPath.value;
}

function limitWorkspaceTabs(tabs: WorkspaceTab[]) {
  if (tabs.length <= WORKSPACE_TABS_LIMIT) {
    return tabs;
  }

  return tabs.slice(-WORKSPACE_TABS_LIMIT);
}

async function switchWorkspaceTab(tab: WorkspaceTab) {
  if (isWorkspaceTabActive(tab)) {
    return;
  }

  prefetchWorkspaceRoute(tab.fullPath);
  await router.push(tab.fullPath);
}

async function closeWorkspaceTab(tab: WorkspaceTab) {
  workspaceScrollPositions.delete(tab.fullPath);
  const closedIndex = workspaceTabs.value.findIndex((item) => item.fullPath === tab.fullPath);

  if (closedIndex < 0) {
    return;
  }

  const nextTabs = workspaceTabs.value.filter((item) => item.fullPath !== tab.fullPath);
  workspaceTabs.value = nextTabs;

  if (tab.fullPath === activeWorkspaceTabPath.value) {
    const nextTab = nextTabs[closedIndex - 1] ?? nextTabs[closedIndex] ?? nextTabs[0];

    if (nextTab) {
      await router.push(nextTab.fullPath);
    }
  }
}

async function closeActiveWorkspaceTab() {
  if (!activeWorkspaceTab.value) {
    return;
  }

  await closeWorkspaceTab(activeWorkspaceTab.value);
}

function closeOtherWorkspaceTabs() {
  if (!activeWorkspaceTab.value) {
    return;
  }

  const activeFullPath = activeWorkspaceTab.value.fullPath;
  workspaceTabs.value = [activeWorkspaceTab.value];
  for (const fullPath of workspaceScrollPositions.keys()) {
    if (fullPath !== activeFullPath) {
      workspaceScrollPositions.delete(fullPath);
    }
  }
}

function closeAllWorkspaceTabs() {
  workspaceTabs.value = [];
  workspaceScrollPositions.clear();
  workspaceCacheVersion.value += 1;
}

function filterMenuItems(items: AppModuleItem[], keyword: string) {
  return items.filter((item) => getModuleSearchText(item).toLowerCase().includes(keyword));
}

function canAccessMenuItem(item: AppModuleItem) {
  const permission = getModulePermission(item);
  if (!permission) {
    return true;
  }

  return Boolean(
    authStore.user?.roles.includes('admin') || authStore.user?.permissions.includes(permission)
  );
}

function getMenuItemTitle(item: AppModuleItem) {
  return getModuleDisplayTitle(item);
}

function getMenuItemBadge(item: AppModuleItem) {
  return navigationItemBadges.value[item.key];
}

function getMenuItemBadgeLabel(item: AppModuleItem) {
  const badge = getMenuItemBadge(item);
  return badge ? formatNotificationCount(badge.count) : '';
}

function getMenuItemBadgeTone(item: AppModuleItem) {
  return getMenuItemBadge(item)?.tone ?? 'orange';
}

function getMenuItemBadgeTitle(item: AppModuleItem) {
  const badge = getMenuItemBadge(item);

  if (!badge) {
    return getMenuItemTitle(item);
  }

  return `${getMenuItemTitle(item)}，${badge.count} 条待处理：${badge.description}`;
}

function handleMenuItemClick(item: AppModuleItem) {
  sidebarOpen.value = false;
  prefetchWorkspaceRoute(item.route);

  if (item.route === route.path) {
    addCurrentWorkspaceTab();
  }
}

function prefetchWorkspaceRoute(routePath: string) {
  prefetchRouteComponent(routePath);
}

function scheduleActivePageRefresh() {
  window.clearTimeout(routeAutoRefreshTimer);

  if (!authStore.isAuthenticated || route.meta.public) {
    return;
  }

  const hasRegisteredPageRefresh = Boolean(pageRefresh.active.value);
  const scopes = getRealtimeFallbackScopesForModule(routeModuleKey.value);

  if (!hasRegisteredPageRefresh && !scopes.length) {
    return;
  }

  const targetFullPath = route.fullPath;

  routeAutoRefreshTimer = window.setTimeout(() => {
    routeAutoRefreshTimer = undefined;

    if (
      route.fullPath !== targetFullPath ||
      !authStore.isAuthenticated ||
      document.visibilityState !== 'visible'
    ) {
      return;
    }

    if (hasRegisteredPageRefresh) {
      void pageRefresh
        .run({
          background: true,
          force: false,
          reason: 'route-enter'
        })
        .then((refreshed) => {
          if (refreshed) {
            void refreshNavigationBadges({ silent: true });
          }
        });
      return;
    }

    notifyRealtimeScopesInvalidated(scopes, 'route-enter');
    void refreshNavigationBadges({ silent: true });
  }, ROUTE_AUTO_REFRESH_DELAY_MS);
}

function prefetchMenuSection(section: MenuSection) {
  prefetchRouteComponents(section.items.map((item) => item.route));
}

function getSectionRoutes(sectionKey: string | undefined) {
  return (
    menuSections.find((section) => section.key === sectionKey)?.items.map((item) => item.route) ??
    []
  );
}

function getInitialPrefetchRoutes() {
  const activeSectionRoutes = getSectionRoutes(getActiveSectionKey()).filter(
    (routePath) => routePath !== route.path
  );

  return [route.path, ...activeSectionRoutes.slice(0, 2)];
}

function getSectionItemCount(section: MenuSection) {
  return section.items.length;
}

function getSectionNotificationBadge(section: MenuSection) {
  return navigationNotificationBadges.value[section.key];
}

function getSectionNotificationBadgeLabel(section: MenuSection) {
  const badge = getSectionNotificationBadge(section);

  if (!badge) {
    return '';
  }

  const count = badge.todoCount || badge.count;
  const suffix = badge.todoCount ? '待办' : '条';
  return `${formatNotificationCount(count)}${suffix}`;
}

function getSectionNotificationTone(section: MenuSection) {
  const badge = getSectionNotificationBadge(section);

  if (!badge) {
    return 'orange';
  }

  return badge.failedCount > 0 || badge.todoCount > 0 ? 'red' : 'orange';
}

function getSectionNotificationTitle(section: MenuSection) {
  const badge = getSectionNotificationBadge(section);
  const base = `${section.title}，${getSectionItemCount(section)} 个子导航`;

  if (!badge) {
    return base;
  }

  return `${base}，有 ${badge.count} 条消息提醒，其中 ${badge.todoCount} 条需要处理`;
}

function getSectionToggleLabel(section: MenuSection) {
  const badge = getSectionNotificationBadge(section);

  if (!badge) {
    return `${section.title}，${getSectionItemCount(section)} 个子导航`;
  }

  return `${section.title}，${getSectionItemCount(section)} 个子导航，${badge.count} 条消息提醒`;
}

function formatNotificationCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

function formatDataStatusTime(timestamp?: number) {
  if (!timestamp) {
    return '数据待同步';
  }

  const elapsedMs = Date.now() - timestamp;

  if (elapsedMs < 15_000) {
    return '刚刚更新';
  }

  if (elapsedMs < 60_000) {
    return `${Math.max(1, Math.floor(elapsedMs / 1_000))} 秒前更新`;
  }

  if (elapsedMs < 60 * 60_000) {
    return `${Math.floor(elapsedMs / 60_000)} 分钟前更新`;
  }

  return `${new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })} 更新`;
}

function getNotificationItemDescription(item: NavigationNotificationBadge) {
  if (item.todoCount > 0) {
    return `${item.count} 条未读提醒，其中 ${item.todoCount} 条需要处理。`;
  }

  return `${item.count} 条未读提醒。`;
}

function getNotificationItemTone(
  item: NavigationNotificationBadge
): 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral' {
  if (item.failedCount > 0 || item.todoCount > 0) {
    return 'red';
  }

  return 'orange';
}

async function loadNavigationNotificationBadges(options: { silent?: boolean } = {}) {
  if (!authStore.isAuthenticated) {
    navigationNotificationBadges.value = {};
    return;
  }

  try {
    const data = await notificationsApi.navBadges();
    navigationNotificationBadges.value = Object.fromEntries(
      data.items.map((item) => [item.sectionKey, item])
    );
  } catch {
    if (!options.silent) {
      navigationNotificationBadges.value = {};
    }
  }
}

async function loadNavigationItemBadges(options: { silent?: boolean } = {}) {
  if (!authStore.isAuthenticated) {
    navigationItemBadges.value = {};
    return;
  }

  try {
    const data = await notificationsApi.navItemBadges();
    navigationItemBadges.value = Object.fromEntries(data.items.map((item) => [item.itemKey, item]));
  } catch {
    if (!options.silent) {
      navigationItemBadges.value = {};
    }
  }
}

async function refreshNavigationBadges(options: { silent?: boolean } = {}) {
  if (!authStore.isAuthenticated) {
    clearNavigationBadges();
    return;
  }

  await Promise.all([loadNavigationNotificationBadges(options), loadNavigationItemBadges(options)]);
}

function handleNavigationNotificationBadgesChanged() {
  if (!authStore.isAuthenticated) {
    return;
  }

  void loadNavigationNotificationBadges({ silent: true });
}

function handleNavigationItemBadgesChanged() {
  if (!authStore.isAuthenticated) {
    return;
  }

  void loadNavigationItemBadges({ silent: true });
}

function handleRealtimeStatusChanged(rawEvent: Event) {
  const event = rawEvent as CustomEvent<RealtimeConnectionStatusDetail>;
  realtimeStatus.value = event.detail.status;
}

function syncRealtimeFallbackPolling() {
  stopRealtimeFallbackPolling();

  if (!authStore.isAuthenticated || realtimeStatus.value === 'connected') {
    return;
  }

  const scopes = getRealtimeFallbackScopesForModule(routeModuleKey.value);
  if (!scopes.length) {
    return;
  }

  realtimeFallbackTimer = window.setInterval(() => {
    if (!authStore.isAuthenticated) {
      stopRealtimeFallbackPolling();
      return;
    }

    if (document.visibilityState !== 'visible') {
      return;
    }

    notifyRealtimeScopesInvalidated(scopes, 'fallback-poll');
  }, REALTIME_FALLBACK_POLL_MS);
}

function stopRealtimeFallbackPolling() {
  if (!realtimeFallbackTimer) {
    return;
  }

  window.clearInterval(realtimeFallbackTimer);
  realtimeFallbackTimer = undefined;
}

function isMenuSectionKey(key: unknown) {
  return typeof key === 'string' && menuSections.some((section) => section.key === key);
}

function getActiveSectionKey() {
  return menuSections.find((section) => section.items.some(isItemActive))?.key;
}

function isItemActive(item: AppModuleItem) {
  if (item.route === SECURITY_CENTER_ROUTE) {
    return SECURITY_CENTER_ROUTES.has(activePath.value);
  }

  if (item.route === SYSTEM_CONFIG_ROUTE) {
    return SYSTEM_CONFIG_ROUTES.has(activePath.value);
  }

  if (item.route === SOURCE_OPTIONS_ROUTE) {
    return SOURCE_OPTIONS_ROUTES.has(activePath.value);
  }

  return activePath.value === item.route;
}

function hasActiveItem(items: AppModuleItem[] | undefined) {
  return Boolean(items?.some(isItemActive));
}

function isSectionActive(section: MenuSection) {
  return hasActiveItem(section.items);
}

function isSectionOpen(section: MenuSection) {
  return Boolean(menuKeyword.value.trim()) || openMenuKeys.value.has(section.key);
}

function toggleMenuKey(key: string) {
  if (openMenuKeys.value.has(key)) {
    openMenuKeys.value = new Set();
  } else {
    openMenuKeys.value = new Set([key]);
  }
}

async function showRefresh() {
  if (!authStore.isAuthenticated) {
    return;
  }

  if (isPageRefreshBusy.value) {
    return;
  }

  try {
    const refreshed = await pageRefresh.run({
      background: false,
      force: true,
      reason: 'manual'
    });

    if (refreshed) {
      void refreshNavigationBadges({ silent: true });
      ElMessage.success(`${pageRefresh.active.value?.label ?? routeTitle.value}已刷新`);
      return;
    }

    const scopes = getRealtimeFallbackScopesForModule(routeModuleKey.value);

    if (scopes.length) {
      notifyRealtimeScopesInvalidated(scopes, 'manual');
      void refreshNavigationBadges({ silent: true });
      ElMessage.success('已请求当前页面后台刷新');
      return;
    }

    ElMessage.info('当前页面暂无可刷新的数据');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新当前页面失败');
  }
}

function getWorkspaceViewKey(viewRoute: { path: string; fullPath: string }) {
  if (SOURCE_OPTIONS_ROUTES.has(viewRoute.path)) {
    return SOURCE_OPTIONS_ROUTE;
  }

  return viewRoute.path;
}

function saveWorkspaceScroll(fullPath: string) {
  const workspace = workspaceRef.value;

  if (!workspace) {
    return;
  }

  workspaceScrollPositions.set(fullPath, workspace.scrollTop);
}

function restoreWorkspaceScroll(fullPath: string) {
  window.clearTimeout(workspaceScrollRestoreTimer);

  void nextTick(() => {
    window.requestAnimationFrame(() => {
      applyWorkspaceScroll(fullPath);
      workspaceScrollRestoreTimer = window.setTimeout(() => {
        applyWorkspaceScroll(fullPath);
      }, 120);
    });
  });
}

function applyWorkspaceScroll(fullPath: string) {
  const workspace = workspaceRef.value;

  if (!workspace || route.fullPath !== fullPath) {
    return;
  }

  workspace.scrollTop = workspaceScrollPositions.get(fullPath) ?? 0;
}

async function goToOrderEntry() {
  await router.push('/apple/order-entry');
}

async function goToNotifications() {
  notificationDrawerVisible.value = false;
  await router.push('/system/notifications');
}

async function handleCommand(command: string) {
  if (command === 'logout') {
    await authStore.logout();
    await router.push('/login');
    return;
  }

  if (command === 'security') {
    await router.push('/system/security');
  }
}
</script>
