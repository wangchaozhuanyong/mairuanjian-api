import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { maintenanceApi } from '@/api/system';
import { allModules } from '@/config/modules';

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

const moduleRoutes = allModules.map((module) => ({
  path: module.route.replace(/^\//, ''),
  name: module.key,
  component:
    readyPageComponents[module.key as keyof typeof readyPageComponents] ?? ModulePlaceholderView,
  meta: {
    title: module.title,
    group: module.group,
    moduleKey: module.key,
    permission: module.permission,
    status: module.status
  }
}));

const MAINTENANCE_MODE_ROUTE = '/system/maintenance-mode';

async function shouldRedirectToMaintenanceMode(userRoles: string[], targetPath: string) {
  if (targetPath === MAINTENANCE_MODE_ROUTE) {
    return false;
  }

  try {
    const mode = await maintenanceApi.getPublicMode();

    if (!mode.enabled) {
      return false;
    }

    const allowedRoles = new Set(mode.allowedRoles?.length ? mode.allowedRoles : ['admin']);
    return !userRoles.some((role) => allowedRoles.has(role));
  } catch {
    return false;
  }
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

router.beforeEach(async (to) => {
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

  if (await shouldRedirectToMaintenanceMode(authStore.user?.roles ?? [], to.path)) {
    return MAINTENANCE_MODE_ROUTE;
  }

  return true;
});
