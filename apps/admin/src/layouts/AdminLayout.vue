<template>
  <div class="app-shell">
    <div class="route-progress" :class="{ active: isRoutePending }" aria-hidden="true">
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
            type="button"
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
              @focus="prefetchWorkspaceRoute(item.route)"
              @mouseenter="prefetchWorkspaceRoute(item.route)"
              @click="handleMenuItemClick(item)"
            >
              <span class="nav-mark">{{ item.mark }}</span>
              <span class="nav-title">{{ getMenuItemTitle(item) }}</span>
              <el-tag v-if="item.badge" size="small" effect="dark">{{ item.badge }}</el-tag>
            </RouterLink>
          </div>
        </section>
      </nav>

      <div class="sidebar-operator">
        <span class="avatar">管</span>
        <span>
          <strong>{{ authStore.displayName }}</strong>
          <small>在线 · 本地开发</small>
        </span>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="sidebar-mask" @click="sidebarOpen = false" />

    <section class="app-main">
      <header class="topbar">
        <el-button class="mobile-menu-btn" @click="sidebarOpen = true">菜单</el-button>
        <div class="page-head">
          <div class="page-title-row">
            <h2>{{ routeTitle }}</h2>
            <el-popover v-if="hasRouteHelp" placement="bottom-start" trigger="click" width="360">
              <template #reference>
                <el-button
                  class="page-help-button"
                  :icon="QuestionFilled"
                  circle
                  size="small"
                  title="查看页面说明"
                  aria-label="查看页面说明"
                />
              </template>
              <div class="page-help-popover">
                <strong>{{ routeTitle }}</strong>
                <p v-if="routeDescription">{{ routeDescription }}</p>
              </div>
            </el-popover>
          </div>
        </div>

        <el-popover placement="bottom-start" width="420" trigger="focus">
          <template #reference>
            <el-input
              v-model="globalKeyword"
              class="global-search"
              placeholder="搜索客户微信、ID、订单号、兑换码尾号、任务备注"
              clearable
            />
          </template>
          <div class="global-search-panel">
            <strong>全局搜索预览</strong>
            <p>设计已预留入口，后续接入客户、订单、ID、兑换码和任务搜索。</p>
            <el-empty v-if="!globalKeyword" description="输入关键词后显示结果" :image-size="64" />
            <el-alert v-else title="接口待接入" type="info" show-icon :closable="false" />
          </div>
        </el-popover>

        <div class="topbar-actions">
          <el-button class="topbar-action topbar-action--refresh" @click="showRefresh">
            刷新
          </el-button>
          <el-badge value="6" class="notification-badge">
            <el-button class="topbar-action" @click="notificationDrawerVisible = true">
              通知
            </el-button>
          </el-badge>

          <el-dropdown trigger="click" @command="handleCommand">
            <el-button class="topbar-action topbar-action--user">
              {{ authStore.displayName }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="security">安全中心</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <div v-if="workspaceTabs.length" class="workspace-tabs">
        <div class="workspace-tabs__list" role="tablist" aria-label="已打开页面">
          <div
            v-for="tab in workspaceTabs"
            :key="tab.fullPath"
            class="workspace-tab"
            :class="{ active: isWorkspaceTabActive(tab) }"
          >
            <button
              class="workspace-tab__button"
              type="button"
              role="tab"
              :aria-selected="isWorkspaceTabActive(tab)"
              :title="tab.title"
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
          <el-button size="small" :disabled="!activeWorkspaceTab" @click="closeActiveWorkspaceTab">
            关闭当前
          </el-button>
          <el-button
            size="small"
            :disabled="workspaceTabs.length <= 1 || !activeWorkspaceTab"
            @click="closeOtherWorkspaceTabs"
          >
            关闭其他
          </el-button>
          <el-button size="small" plain type="danger" @click="closeAllWorkspaceTabs">
            关闭全部
          </el-button>
        </div>
      </div>

      <main class="workspace">
        <RouterView v-slot="{ Component: ViewComponent, route: viewRoute }">
          <Transition name="workspace-view" mode="out-in">
            <KeepAlive :key="workspaceCacheVersion" :max="WORKSPACE_CACHE_LIMIT">
              <component :is="ViewComponent" :key="viewRoute.fullPath" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </main>
    </section>

    <AppDrawer v-model="notificationDrawerVisible" title="通知中心预览" confirm-text="进入通知中心">
      <div class="mini-list">
        <div class="mini-row">
          <span>ID 余额不足</span>
          <el-tag type="warning" size="small">重要</el-tag>
        </div>
        <div class="mini-row">
          <span>兑换码低库存</span>
          <el-tag type="danger" size="small">紧急</el-tag>
        </div>
        <div class="mini-row">
          <span>平台接口异常</span>
          <el-tag type="info" size="small">待处理</el-tag>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { ElMessage } from 'element-plus';
import {
  CloseBold,
  DataAnalysis,
  House,
  Iphone,
  Lock,
  Monitor,
  QuestionFilled,
  Setting,
  Ticket,
  UserFilled
} from '@element-plus/icons-vue';
import { useRoute, useRouter } from 'vue-router';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import {
  type AppModuleItem,
  type MenuSection,
  type MenuSectionIcon,
  getModuleDisplayTitle,
  getModulePermission,
  getModuleSearchText,
  menuSections
} from '@/config/modules';
import { isRoutePending, prefetchReadyRouteComponents, prefetchRouteComponent } from '@/router';
import { useAuthStore } from '@/stores/auth';

const NAV_OPEN_STORAGE_KEY = 'apple_business_sidebar_open_keys';
const WORKSPACE_TABS_STORAGE_KEY = 'apple_business_workspace_tabs';
const WORKSPACE_TABS_LIMIT = 12;
const WORKSPACE_CACHE_LIMIT = WORKSPACE_TABS_LIMIT;

interface WorkspaceTab {
  fullPath: string;
  title: string;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const sidebarOpen = ref(false);
const menuKeyword = ref('');
const globalKeyword = ref('');
const notificationDrawerVisible = ref(false);
const openMenuKeys = ref(readStoredOpenMenuKeys());
const workspaceCacheVersion = ref(0);
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

const activePath = computed(() => route.path);
const routeTitle = computed(() => String(route.meta.title ?? '后台管理'));
const routeDescription = computed(() => String(route.meta.description ?? ''));
const hasRouteHelp = computed(() => Boolean(routeDescription.value));
const activeWorkspaceTabPath = computed(() => route.fullPath);
const workspaceTabs = ref<WorkspaceTab[]>(readStoredWorkspaceTabs());
const activeWorkspaceTab = computed(() =>
  workspaceTabs.value.find((tab) => tab.fullPath === activeWorkspaceTabPath.value)
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

watch(
  workspaceTabs,
  (tabs) => {
    window.localStorage.setItem(WORKSPACE_TABS_STORAGE_KEY, JSON.stringify(tabs));
  },
  { deep: true }
);

onMounted(() => {
  prefetchReadyRouteComponents();
});

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

    return storedTabs
      .filter((tab): tab is WorkspaceTab => {
        if (!isWorkspaceTab(tab) || seenPaths.has(tab.fullPath)) {
          return false;
        }

        seenPaths.add(tab.fullPath);
        return true;
      })
      .slice(0, WORKSPACE_TABS_LIMIT);
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
      const nextTabs = [...workspaceTabs.value];
      nextTabs[existingIndex] = { ...existingTab, title };
      workspaceTabs.value = nextTabs;
    }

    return;
  }

  if (workspaceTabs.value.length >= WORKSPACE_TABS_LIMIT) {
    workspaceTabs.value = [
      ...workspaceTabs.value.slice(0, WORKSPACE_TABS_LIMIT - 1),
      { fullPath, title }
    ];
    return;
  }

  workspaceTabs.value = [...workspaceTabs.value, { fullPath, title }];
}

function isWorkspaceTabActive(tab: WorkspaceTab) {
  return tab.fullPath === activeWorkspaceTabPath.value;
}

async function switchWorkspaceTab(tab: WorkspaceTab) {
  if (isWorkspaceTabActive(tab)) {
    return;
  }

  await router.push(tab.fullPath);
}

async function closeWorkspaceTab(tab: WorkspaceTab) {
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

  workspaceTabs.value = [activeWorkspaceTab.value];
}

function closeAllWorkspaceTabs() {
  workspaceTabs.value = [];
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

function getSectionItemCount(section: MenuSection) {
  return section.items.length;
}

function isMenuSectionKey(key: unknown) {
  return typeof key === 'string' && menuSections.some((section) => section.key === key);
}

function getActiveSectionKey() {
  return menuSections.find((section) => section.items.some((item) => item.route === route.path))
    ?.key;
}

function isItemActive(item: AppModuleItem) {
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

function showRefresh() {
  ElMessage.success('页面状态已刷新');
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
