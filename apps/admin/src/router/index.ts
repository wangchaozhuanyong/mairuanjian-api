import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { maintenanceApi } from '@/api/system';
import type { CurrentUser } from '@/types/system';
import {
  allModules,
  getModuleDisplayDescription,
  getModuleDisplayGroup,
  getModulePermission,
  getModuleDisplayTitle
} from '@/config/modules';

const AdminLayout = () => import('@/layouts/AdminLayout.vue');
const LoginView = () => import('@/views/auth/LoginView.vue');
const ModulePlaceholderView = () => import('@/views/modules/ModulePlaceholderView.vue');
const CustomerDetailView = () => import('@/views/common/CustomerDetailView.vue');
const DashboardView = () => import('@/views/system/DashboardView.vue');
const LaunchAuditView = () => import('@/views/system/LaunchAuditView.vue');
const CustomersView = () => import('@/views/common/CustomersView.vue');
const SourcePlatformsView = () => import('@/views/common/SourcePlatformsView.vue');
const MessageTemplatesView = () => import('@/views/common/MessageTemplatesView.vue');
const AttachmentsView = () => import('@/views/common/AttachmentsView.vue');
const AppleAccountsView = () => import('@/views/apple/AppleAccountsView.vue');
const AppleAccountDetailView = () => import('@/views/apple/AppleAccountDetailView.vue');
const AppleServicesView = () => import('@/views/apple/AppleServicesView.vue');
const AppleOrdersView = () => import('@/views/apple/AppleOrdersView.vue');
const AppleOrderEntryView = () => import('@/views/apple/AppleOrderEntryView.vue');
const AppleActivationsView = () => import('@/views/apple/AppleActivationsView.vue');
const AppleBalanceReconciliationView = () =>
  import('@/views/apple/AppleBalanceReconciliationView.vue');
const AppleFinanceView = () => import('@/views/apple/AppleFinanceView.vue');
const AppleRenewalTasksView = () => import('@/views/apple/AppleRenewalTasksView.vue');
const AppleActionPlansView = () => import('@/views/apple/AppleActionPlansView.vue');
const AppleAutomationTasksView = () => import('@/views/apple/AppleAutomationTasksView.vue');
const AppleReportsView = () => import('@/views/apple/AppleReportsView.vue');
const CodeInventoryView = () => import('@/views/codes/CodeInventoryView.vue');
const CodeServicesView = () => import('@/views/codes/CodeServicesView.vue');
const CodeOrdersView = () => import('@/views/codes/CodeOrdersView.vue');
const CodeAfterSalesView = () => import('@/views/codes/CodeAfterSalesView.vue');
const TaobaoOrdersView = () => import('@/views/codes/TaobaoOrdersView.vue');
const XianyuOrdersView = () => import('@/views/codes/XianyuOrdersView.vue');
const CodeReportsView = () => import('@/views/codes/CodeReportsView.vue');
const NotificationsView = () => import('@/views/system/NotificationsView.vue');
const SecurityView = () => import('@/views/system/SecurityView.vue');
const DataCenterView = () => import('@/views/system/DataCenterView.vue');
const OpsMonitorView = () => import('@/views/system/OpsMonitorView.vue');
const MaintenanceView = () => import('@/views/system/MaintenanceView.vue');
const UsersView = () => import('@/views/system/UsersView.vue');
const RolesView = () => import('@/views/system/RolesView.vue');
const AuditLogsView = () => import('@/views/system/AuditLogsView.vue');
const PlatformStatusView = () => import('@/views/system/PlatformStatusView.vue');

export const isRoutePending = ref(false);

const readyPageComponents = {
  dashboard: DashboardView,
  'launch-audit': LaunchAuditView,
  customers: CustomersView,
  'source-platforms': SourcePlatformsView,
  'message-templates': MessageTemplatesView,
  attachments: AttachmentsView,
  'apple-list': AppleAccountsView,
  'apple-detail': AppleAccountDetailView,
  'apple-settings': AppleServicesView,
  'apple-orders': AppleOrdersView,
  'order-entry': AppleOrderEntryView,
  'apple-activations': AppleActivationsView,
  'balance-reconciliation': AppleBalanceReconciliationView,
  'finance-center': AppleFinanceView,
  renewal: AppleRenewalTasksView,
  'renewal-cancel': AppleRenewalTasksView,
  'renewal-topup': AppleRenewalTasksView,
  'renewal-waiting-auto': AppleRenewalTasksView,
  'action-plans': AppleActionPlansView,
  'apple-automation': AppleAutomationTasksView,
  'apple-reports': AppleReportsView,
  'code-inventory': CodeInventoryView,
  'code-settings': CodeServicesView,
  'code-orders': CodeOrdersView,
  'after-sales': CodeAfterSalesView,
  'taobao-orders': TaobaoOrdersView,
  'xianyu-orders': XianyuOrdersView,
  'code-reports': CodeReportsView,
  notifications: NotificationsView,
  security: SecurityView,
  'login-logs': SecurityView,
  sessions: SecurityView,
  mfa: SecurityView,
  'ip-whitelist': SecurityView,
  'sensitive-approvals': SecurityView,
  'data-center': DataCenterView,
  'data-imports': DataCenterView,
  'data-exports': DataCenterView,
  'data-dictionaries': DataCenterView,
  'recycle-bin': DataCenterView,
  'ops-monitor': OpsMonitorView,
  maintenance: MaintenanceView,
  'feature-flags': MaintenanceView,
  versions: MaintenanceView,
  changelog: MaintenanceView,
  'system-parameters': MaintenanceView,
  users: UsersView,
  roles: RolesView,
  'audit-log': AuditLogsView,
  'platform-status': PlatformStatusView,
  'platform-interface-logs': AuditLogsView,
  'automation-logs': AuditLogsView
} as const;

type RouteComponentLoader = () => Promise<unknown>;

const prefetchedRouteLoaders = new Set<RouteComponentLoader>();
const routeComponentLoaders = new Map<string, RouteComponentLoader>();

for (const module of allModules) {
  const loader = readyPageComponents[module.key as keyof typeof readyPageComponents];

  if (loader) {
    routeComponentLoaders.set(module.route, loader as RouteComponentLoader);
  }
}

function prefetchRouteLoader(loader: RouteComponentLoader) {
  if (prefetchedRouteLoaders.has(loader)) {
    return;
  }

  prefetchedRouteLoaders.add(loader);
  void loader().catch(() => {
    prefetchedRouteLoaders.delete(loader);
  });
}

function scheduleRoutePrefetch(callback: () => void, delay = 220) {
  const requestIdle = (
    window as Window & {
      requestIdleCallback?: (handler: () => void, options?: { timeout?: number }) => number;
    }
  ).requestIdleCallback;

  if (requestIdle) {
    requestIdle(callback, { timeout: 1800 });
    return;
  }

  window.setTimeout(callback, delay);
}

export function prefetchRouteComponent(routePath: string) {
  const loader = routeComponentLoaders.get(routePath);

  if (loader) {
    prefetchRouteLoader(loader);
  }
}

export function prefetchReadyRouteComponents() {
  const loaders = [...new Set(routeComponentLoaders.values())];
  let cursor = 0;

  const prefetchNextBatch = () => {
    for (let batchCount = 0; batchCount < 3 && cursor < loaders.length; batchCount += 1) {
      const loader = loaders[cursor];
      cursor += 1;

      if (loader) {
        prefetchRouteLoader(loader);
      }
    }

    if (cursor < loaders.length) {
      scheduleRoutePrefetch(prefetchNextBatch, 450);
    }
  };

  scheduleRoutePrefetch(prefetchNextBatch);
}

const moduleRoutes = allModules.map((module) => ({
  path: module.route.replace(/^\//, ''),
  name: module.key,
  component:
    readyPageComponents[module.key as keyof typeof readyPageComponents] ?? ModulePlaceholderView,
  meta: {
    title: getModuleDisplayTitle(module),
    group: getModuleDisplayGroup(module),
    phase: module.phase,
    description: getModuleDisplayDescription(module),
    moduleKey: module.key,
    permission: getModulePermission(module),
    status: module.status
  }
}));

const MAINTENANCE_MODE_ROUTE = '/system/maintenance-mode';
const MAINTENANCE_MODE_CACHE_MS = 60_000;
const MAINTENANCE_MODE_RETRY_FLOOR_MS = 10_000;
const ROUTE_PENDING_SETTLE_MS = 140;

type PublicMaintenanceMode = Awaited<ReturnType<typeof maintenanceApi.getPublicMode>>;

const maintenanceModeCache: {
  expiresAt: number;
  lastAttemptAt: number;
  pending: Promise<PublicMaintenanceMode | null> | null;
  value: PublicMaintenanceMode | null;
} = {
  expiresAt: 0,
  lastAttemptAt: 0,
  pending: null,
  value: null
};

let routePendingTimer: number | undefined;

function refreshPublicMaintenanceMode(userRoles?: string[], targetPath?: string) {
  const now = Date.now();

  if (maintenanceModeCache.pending) {
    return maintenanceModeCache.pending;
  }

  if (now - maintenanceModeCache.lastAttemptAt < MAINTENANCE_MODE_RETRY_FLOOR_MS) {
    return Promise.resolve(maintenanceModeCache.value);
  }

  maintenanceModeCache.lastAttemptAt = now;
  maintenanceModeCache.pending = maintenanceApi
    .getPublicMode()
    .then((mode) => {
      maintenanceModeCache.value = mode;
      maintenanceModeCache.expiresAt = Date.now() + MAINTENANCE_MODE_CACHE_MS;

      if (
        userRoles &&
        targetPath &&
        shouldRedirectToMaintenanceMode(userRoles, targetPath, mode) &&
        router.currentRoute.value.path === targetPath
      ) {
        void router.replace(MAINTENANCE_MODE_ROUTE);
      }

      return mode;
    })
    .catch(() => maintenanceModeCache.value)
    .finally(() => {
      maintenanceModeCache.pending = null;
    });

  return maintenanceModeCache.pending;
}

function getMaintenanceModeSnapshot(userRoles: string[], targetPath: string) {
  const now = Date.now();

  if (maintenanceModeCache.value && maintenanceModeCache.expiresAt > now) {
    return maintenanceModeCache.value;
  }

  void refreshPublicMaintenanceMode(userRoles, targetPath);
  return null;
}

function shouldRedirectToMaintenanceMode(
  userRoles: string[],
  targetPath: string,
  mode: PublicMaintenanceMode | null
) {
  if (targetPath === MAINTENANCE_MODE_ROUTE) {
    return false;
  }

  if (!mode?.enabled) {
    return false;
  }

  const allowedRoles = new Set(mode.allowedRoles?.length ? mode.allowedRoles : ['admin']);
  return !userRoles.some((role) => allowedRoles.has(role));
}

function hasRoutePermission(user: CurrentUser | null, permission: unknown) {
  if (typeof permission !== 'string' || !permission) {
    return true;
  }

  return Boolean(user?.roles.includes('admin') || user?.permissions.includes(permission));
}

function startRoutePending() {
  window.clearTimeout(routePendingTimer);
  isRoutePending.value = true;
}

function finishRoutePending() {
  window.clearTimeout(routePendingTimer);
  routePendingTimer = window.setTimeout(() => {
    isRoutePending.value = false;
  }, ROUTE_PENDING_SETTLE_MS);
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        public: true,
        title: '登录'
      }
    },
    {
      path: '/',
      component: AdminLayout,
      children: [
        ...moduleRoutes,
        {
          path: 'system/customers/detail',
          name: 'customer-detail',
          component: CustomerDetailView,
          meta: {
            title: '客户详情',
            group: '系统管理',
            phase: 'Phase 2',
            description: '聚合客户基础资料、来源平台、ID 订单、开通记录和续费任务。',
            permission: 'customer.view',
            status: 'ready'
          }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/404'
    }
  ]
});

router.beforeEach(async (to, from) => {
  if (to.fullPath !== from.fullPath) {
    startRoutePending();
  }

  const authStore = useAuthStore();

  if (to.meta.public) {
    return authStore.isAuthenticated ? '/dashboard' : true;
  }

  if (!authStore.isAuthenticated) {
    return '/login';
  }

  if (!authStore.user) {
    try {
      await authStore.loadCurrentUser();
    } catch {
      await authStore.logout();
      return '/login';
    }
  }

  if (!hasRoutePermission(authStore.user, to.meta.permission)) {
    return '/403';
  }

  const userRoles = authStore.user?.roles ?? [];
  const maintenanceMode = getMaintenanceModeSnapshot(userRoles, to.path);

  if (shouldRedirectToMaintenanceMode(userRoles, to.path, maintenanceMode)) {
    return MAINTENANCE_MODE_ROUTE;
  }

  return true;
});

router.afterEach(() => {
  finishRoutePending();
});

router.onError(() => {
  finishRoutePending();
});
