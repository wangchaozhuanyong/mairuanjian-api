import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
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
const DeliveryTemplatesView = () => import('@/views/common/MessageTemplatesView.vue');
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
const CodeDeliveryExceptionsView = () => import('@/views/codes/CodeDeliveryExceptionsView.vue');
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
const SystemStateView = () => import('@/views/system/SystemStateView.vue');

export const isRoutePending = ref(false);

const readyPageComponents = {
  dashboard: DashboardView,
  'launch-audit': LaunchAuditView,
  customers: CustomersView,
  'source-platforms': SourcePlatformsView,
  'delivery-templates': DeliveryTemplatesView,
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
  'delivery-exceptions': CodeDeliveryExceptionsView,
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
  'automation-logs': AuditLogsView,
  forbidden: SystemStateView,
  'not-found': SystemStateView,
  'maintenance-mode': SystemStateView
} as const;

type RouteComponentLoader = () => Promise<unknown>;
type NavigatorConnectionLike = {
  effectiveType?: string;
  saveData?: boolean;
};

const prefetchedRouteLoaders = new Set<RouteComponentLoader>();
const pendingRouteLoaderPromises = new Map<RouteComponentLoader, Promise<unknown>>();
const routeComponentLoaders = new Map<string, RouteComponentLoader>();
let readyRoutePrefetchStarted = false;
const SECURITY_CENTER_MODULE_KEYS = new Set([
  'login-logs',
  'sessions',
  'mfa',
  'ip-whitelist',
  'sensitive-approvals'
]);
const SYSTEM_CONFIG_MODULE_KEYS = new Set([
  'feature-flags',
  'versions',
  'changelog',
  'system-parameters'
]);
const LEGACY_RENEWAL_VIEW_BY_MODULE_KEY: Record<string, string> = {
  'renewal-cancel': 'cancel',
  'renewal-topup': 'topup',
  'renewal-waiting-auto': 'auto'
};

for (const module of allModules) {
  const loader = readyPageComponents[module.key as keyof typeof readyPageComponents];

  if (loader) {
    routeComponentLoaders.set(module.route, loader as RouteComponentLoader);
  }
}

routeComponentLoaders.set('/login', LoginView as RouteComponentLoader);
routeComponentLoaders.set('/system/customers/detail', CustomerDetailView as RouteComponentLoader);

function normalizeRoutePath(routePath: string) {
  return routePath.split(/[?#]/)[0] || routePath;
}

function loadRouteLoader(loader: RouteComponentLoader) {
  if (prefetchedRouteLoaders.has(loader)) {
    return Promise.resolve();
  }

  const pending = pendingRouteLoaderPromises.get(loader);

  if (pending) {
    return pending;
  }

  const promise = loader()
    .then((result) => {
      prefetchedRouteLoaders.add(loader);
      return result;
    })
    .finally(() => {
      pendingRouteLoaderPromises.delete(loader);
    });

  pendingRouteLoaderPromises.set(loader, promise);
  return promise;
}

function prefetchRouteLoader(loader: RouteComponentLoader) {
  void loadRouteLoader(loader).catch(() => undefined);
}

function isRouteComponentReady(routePath: string) {
  const loader = routeComponentLoaders.get(normalizeRoutePath(routePath));
  return !loader || prefetchedRouteLoaders.has(loader);
}

export async function loadRouteComponent(routePath: string) {
  const loader = routeComponentLoaders.get(normalizeRoutePath(routePath));

  if (!loader) {
    return false;
  }

  try {
    await loadRouteLoader(loader);
    return true;
  } catch {
    return false;
  }
}

function getNavigatorConnection() {
  return (navigator as Navigator & { connection?: NavigatorConnectionLike }).connection;
}

function canRunBackgroundRoutePrefetch() {
  const connection = getNavigatorConnection();

  if (document.visibilityState !== 'visible') {
    return false;
  }

  if (connection?.saveData) {
    return false;
  }

  return !['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
}

function scheduleRoutePrefetch(callback: () => void, delay = 220) {
  const requestIdle = (
    window as Window & {
      requestIdleCallback?: (handler: () => void, options?: { timeout?: number }) => number;
    }
  ).requestIdleCallback;

  window.setTimeout(() => {
    if (!canRunBackgroundRoutePrefetch()) {
      return;
    }

    if (requestIdle) {
      requestIdle(callback, { timeout: ROUTE_PREFETCH_IDLE_TIMEOUT_MS });
      return;
    }

    callback();
  }, delay);
}

export function prefetchRouteComponent(routePath: string) {
  const loader = routeComponentLoaders.get(normalizeRoutePath(routePath));

  if (loader) {
    prefetchRouteLoader(loader);
  }
}

export function prefetchRouteComponents(routePaths: string[]) {
  for (const routePath of routePaths) {
    prefetchRouteComponent(routePath);
  }
}

export function prefetchReadyRouteComponents(priorityRoutePaths: string[] = []) {
  const priorityLoaders = priorityRoutePaths
    .map((routePath) => routeComponentLoaders.get(normalizeRoutePath(routePath)))
    .filter((loader): loader is RouteComponentLoader => Boolean(loader));
  const priorityLoaderSet = new Set(priorityLoaders);

  for (const loader of priorityLoaderSet) {
    prefetchRouteLoader(loader);
  }

  if (readyRoutePrefetchStarted) {
    return;
  }

  readyRoutePrefetchStarted = true;

  const loaders = [...new Set(routeComponentLoaders.values())]
    .filter((loader) => !priorityLoaderSet.has(loader))
    .slice(0, ROUTE_BACKGROUND_PREFETCH_LIMIT);
  let cursor = 0;

  const prefetchNextBatch = () => {
    for (
      let batchCount = 0;
      batchCount < ROUTE_PREFETCH_BATCH_SIZE && cursor < loaders.length;
      batchCount += 1
    ) {
      const loader = loaders[cursor];
      cursor += 1;

      if (loader) {
        prefetchRouteLoader(loader);
      }
    }

    if (cursor < loaders.length) {
      scheduleRoutePrefetch(prefetchNextBatch, ROUTE_PREFETCH_NEXT_DELAY_MS);
    }
  };

  scheduleRoutePrefetch(prefetchNextBatch, ROUTE_PREFETCH_INITIAL_DELAY_MS);
}

const moduleRoutes = allModules.map((module) => {
  const displayModule = getCanonicalDisplayModule(module);
  const legacyRenewalView = LEGACY_RENEWAL_VIEW_BY_MODULE_KEY[module.key];
  const meta = {
    title: getModuleDisplayTitle(displayModule),
    group: getModuleDisplayGroup(displayModule),
    phase: module.phase,
    description: getModuleDisplayDescription(displayModule),
    moduleKey: module.key,
    permission: getModulePermission(module),
    status: module.status
  };

  if (legacyRenewalView) {
    return {
      path: module.route.replace(/^\//, ''),
      name: module.key,
      redirect: {
        path: '/workspace/renewal',
        query: {
          view: legacyRenewalView
        }
      },
      meta
    };
  }

  return {
    path: module.route.replace(/^\//, ''),
    name: module.key,
    component:
      readyPageComponents[module.key as keyof typeof readyPageComponents] ?? ModulePlaceholderView,
    meta
  };
});

function getCanonicalDisplayModule(module: (typeof allModules)[number]) {
  if (SECURITY_CENTER_MODULE_KEYS.has(module.key)) {
    return allModules.find((item) => item.key === 'security') ?? module;
  }

  if (SYSTEM_CONFIG_MODULE_KEYS.has(module.key)) {
    return allModules.find((item) => item.key === 'maintenance') ?? module;
  }

  return module;
}

const MAINTENANCE_MODE_ROUTE = '/system/maintenance-mode';
const MAINTENANCE_MODE_CACHE_MS = 60_000;
const MAINTENANCE_MODE_RETRY_FLOOR_MS = 10_000;
const ROUTE_PREFETCH_BATCH_SIZE = 1;
const ROUTE_PREFETCH_INITIAL_DELAY_MS = 6_000;
const ROUTE_PREFETCH_NEXT_DELAY_MS = 2_500;
const ROUTE_PREFETCH_IDLE_TIMEOUT_MS = 2_000;
const ROUTE_BACKGROUND_PREFETCH_LIMIT = 8;
const ROUTE_PENDING_DELAY_MS = 180;
const ROUTE_PENDING_SETTLE_MS = 120;

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

let routePendingStartTimer: number | undefined;
let routePendingFinishTimer: number | undefined;

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
  window.clearTimeout(routePendingStartTimer);
  window.clearTimeout(routePendingFinishTimer);
  routePendingStartTimer = window.setTimeout(() => {
    isRoutePending.value = true;
  }, ROUTE_PENDING_DELAY_MS);
}

function finishRoutePending() {
  window.clearTimeout(routePendingStartTimer);
  window.clearTimeout(routePendingFinishTimer);

  if (!isRoutePending.value) {
    return;
  }

  routePendingFinishTimer = window.setTimeout(() => {
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
        {
          path: 'system/message-templates',
          redirect: '/codes/delivery-templates'
        },
        {
          path: 'system/work-orders',
          redirect: '/workspace/work-orders'
        },
        ...moduleRoutes,
        {
          path: 'system/customers/detail',
          name: 'customer-detail',
          component: CustomerDetailView,
          meta: {
            title: '客户详情',
            group: '客户与来源',
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

const rawRouterPush = router.push.bind(router);
const rawRouterReplace = router.replace.bind(router);

router.push = (async (to) => {
  const target = router.resolve(to);
  await loadRouteComponent(target.path);
  return rawRouterPush(to);
}) as typeof router.push;

router.replace = (async (to) => {
  const target = router.resolve(to);
  await loadRouteComponent(target.path);
  return rawRouterReplace(to);
}) as typeof router.replace;

function redirectToLogin(targetFullPath: string) {
  return {
    path: '/login',
    query: targetFullPath === '/login' ? undefined : { redirect: targetFullPath }
  };
}

function refreshCurrentUserForRoute(targetRoute: RouteLocationNormalized) {
  const authStore = useAuthStore();
  const targetFullPath = targetRoute.fullPath;

  if (!authStore.isAuthenticated) {
    return;
  }

  void authStore
    .loadCurrentUser()
    .then(() => {
      const currentRoute = router.currentRoute.value;

      if (
        currentRoute.fullPath !== targetFullPath ||
        currentRoute.meta.public ||
        !authStore.isAuthenticated
      ) {
        return;
      }

      if (!authStore.user) {
        return;
      }

      if (!hasRoutePermission(authStore.user, currentRoute.meta.permission)) {
        void router.replace('/403');
        return;
      }

      const userRoles = authStore.user.roles ?? [];
      void refreshPublicMaintenanceMode(userRoles, currentRoute.path).then((mode) => {
        if (
          router.currentRoute.value.fullPath === targetFullPath &&
          shouldRedirectToMaintenanceMode(userRoles, currentRoute.path, mode)
        ) {
          void router.replace(MAINTENANCE_MODE_ROUTE);
        }
      });
    })
    .catch(() => {
      const isStillOnTarget = router.currentRoute.value.fullPath === targetFullPath;
      authStore.clearLocalSession();

      if (isStillOnTarget) {
        void router.replace(redirectToLogin(targetFullPath));
      }
    });
}

router.beforeEach((to, from) => {
  if (to.fullPath !== from.fullPath && !isRouteComponentReady(to.path)) {
    startRoutePending();
  }

  prefetchRouteComponent(to.path);

  const authStore = useAuthStore();

  if (to.meta.public) {
    return authStore.isAuthenticated ? '/dashboard' : true;
  }

  if (!authStore.isAuthenticated) {
    return redirectToLogin(to.fullPath);
  }

  if (!authStore.user) {
    refreshCurrentUserForRoute(to);
    return true;
  }

  if (!hasRoutePermission(authStore.user, to.meta.permission)) {
    return '/403';
  }

  if (authStore.shouldRefreshCurrentUser) {
    refreshCurrentUserForRoute(to);
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
