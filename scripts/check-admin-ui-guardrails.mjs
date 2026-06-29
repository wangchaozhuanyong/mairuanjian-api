import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const adminSrcDir = path.join(rootDir, 'apps/admin/src');
const viewsDir = path.join(adminSrcDir, 'views');

function walkVueFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkVueFiles(filePath);
    }

    return filePath.endsWith('.vue') ? [filePath] : [];
  });
}

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function toProjectPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function missingSnippets(source, snippets) {
  return snippets.filter((snippet) => !source.includes(snippet));
}

function createSourceCheck(name, sourceChecks) {
  const details = sourceChecks.flatMap(({ label, source, snippets }) =>
    missingSnippets(source, snippets).map((snippet) => `${label}: ${snippet}`)
  );

  return {
    name,
    ok: details.length === 0,
    details
  };
}

const viewFiles = walkVueFiles(viewsDir).sort((a, b) =>
  toProjectPath(a).localeCompare(toProjectPath(b))
);

const riskyToastOnlyViews = [];

for (const filePath of viewFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  const hasListSurface = source.includes('<el-table') || source.includes('mobile-record-list');
  const hasToastOnlyLoadCatch = /catch \(error\)[\s\S]{0,240}ElMessage\.error/.test(source);
  const hasPersistentErrorState =
    source.includes('ListRequestError') ||
    source.includes('<AppState') ||
    source.includes('AppState from') ||
    /<AppCard[\s\S]{0,160}(?:error|:error)=/.test(source);

  if (hasListSurface && hasToastOnlyLoadCatch && !hasPersistentErrorState) {
    riskyToastOnlyViews.push(toProjectPath(filePath));
  }
}

const tableToolbarSource = readProjectFile('apps/admin/src/components/ui/TableToolbar.vue');
const mainCssSource = readProjectFile('apps/admin/src/styles/main.css');
const mainSource = readProjectFile('apps/admin/src/main.ts');
const appSource = readProjectFile('apps/admin/src/App.vue');
const routerSource = readProjectFile('apps/admin/src/router/index.ts');
const layoutSource = readProjectFile('apps/admin/src/layouts/AdminLayout.vue');
const modulesSource = readProjectFile('apps/admin/src/config/modules.ts');
const permissionsSource = readProjectFile('apps/admin/src/utils/permissions.ts');
const loginSource = readProjectFile('apps/admin/src/views/auth/LoginView.vue');
const sourcePlatformsSource = readProjectFile(
  'apps/admin/src/views/common/SourcePlatformsView.vue'
);
const apiClientSource = readProjectFile('apps/admin/src/api/client.ts');
const authSessionSource = readProjectFile('apps/admin/src/auth/session.ts');
const featureHelpSource = readProjectFile('apps/admin/src/components/ui/FeatureHelp.vue');
const appButtonSource = readProjectFile('apps/admin/src/components/ui/AppButton.vue');

const checks = [
  {
    name: 'persistent-list-load-errors',
    ok: riskyToastOnlyViews.length === 0,
    details: riskyToastOnlyViews
  },
  {
    name: 'mobile-toolbar-collapses-secondary-filters',
    ok:
      tableToolbarSource.includes('table-toolbar__filter-toggle') &&
      tableToolbarSource.includes('table-toolbar__filters') &&
      tableToolbarSource.includes('table-toolbar__mobile-more') &&
      mainCssSource.includes('.table-toolbar__filters.is-open') &&
      mainCssSource.includes('.table-toolbar__desktop-ops') &&
      mainCssSource.includes('.table-toolbar__mobile-more')
  },
  {
    name: 'route-and-runtime-error-boundaries',
    ok:
      mainSource.includes('app.config.errorHandler') &&
      mainSource.includes("window.addEventListener('error'") &&
      mainSource.includes("window.addEventListener('unhandledrejection'") &&
      appSource.includes('currentRouteLoadError') &&
      appSource.includes('currentRuntimeError') &&
      routerSource.includes('router.onError')
  },
  {
    name: 'help-and-icon-accessibility',
    ok:
      featureHelpSource.includes('type="button"') &&
      featureHelpSource.includes('@keydown.enter.prevent') &&
      featureHelpSource.includes('@keydown.space.prevent') &&
      appButtonSource.includes('aria-label') &&
      appButtonSource.includes('iconOnly')
  },
  createSourceCheck('route-permission-gates', [
    {
      label: 'router',
      source: routerSource,
      snippets: [
        'permission: getModulePermission(module)',
        'adminOnly: isModuleAdminOnly(module.key)',
        'if (!authStore.isAuthenticated)',
        'return redirectToLogin(to.fullPath)',
        'hasRoutePermission(authStore.user, to.meta.permission)',
        'isAdminOnlyRoute(to) && !canAccessAdminOnlyRoute(authStore.user)',
        "return '/403'"
      ]
    },
    {
      label: 'layout',
      source: layoutSource,
      snippets: [
        '.filter((section) => !section.adminOnly || canUseManagementSections.value)',
        'items: section.items.filter(canAccessMenuItem)',
        'function canAccessWorkspaceTab(tab: WorkspaceTab)',
        'return canAccessRoutePermission(targetRoute.meta.permission)'
      ]
    },
    {
      label: 'modules',
      source: modulesSource,
      snippets: [
        'export function getModulePermission(item: AppModuleItem)',
        'export function getModuleRequiredPermissions(key: string)',
        'adminOnly: true'
      ]
    },
    {
      label: 'permissions',
      source: permissionsSource,
      snippets: [
        "user?.roles.includes('admin')",
        'permission.every((item) => hasUserRoutePermission(user, item))',
        'PERMISSION_ALIASES'
      ]
    }
  ]),
  createSourceCheck('responsive-layout-followups', [
    {
      label: 'main-css',
      source: mainCssSource,
      snippets: [
        '@media (max-width: 1100px) and (min-width: 841px)',
        '.topbar:has(.topbar-page-actions) .global-search',
        '.el-tabs__nav-wrap::before',
        '.el-tabs__nav-wrap::after',
        'max-height: calc(100dvh - 164px)',
        'padding-bottom: calc(12px + env(safe-area-inset-bottom))'
      ]
    },
    {
      label: 'source-platforms',
      source: sourcePlatformsSource,
      snippets: ['.source-options-nav::after', 'linear-gradient(270deg']
    }
  ]),
  createSourceCheck('login-mfa-session-flow', [
    {
      label: 'login',
      source: loginSource,
      snippets: [
        'prop="mfaCode"',
        'autocomplete="one-time-code"',
        'role="alert"',
        'aria-live="assertive"',
        'await authStore.login(form.username, form.password, form.mfaCode || undefined)',
        'function getLoginRedirectPath()',
        "redirect.startsWith('/')",
        "!redirect.startsWith('//')",
        "redirect !== '/login'",
        'function getLoginErrorMessage(error: unknown)'
      ]
    },
    {
      label: 'api-client',
      source: apiClientSource,
      snippets: [
        "'MFA code is required'",
        "'MFA code is invalid'",
        'notifyAuthSessionExpired({',
        'axiosError.response?.status === 401',
        'isAuthGateBypassRequest(requestUrl)'
      ]
    },
    {
      label: 'auth-session',
      source: authSessionSource,
      snippets: [
        'clearStoredAuthSession()',
        'authSessionAbortController.abort',
        'window.dispatchEvent(',
        'AUTH_SESSION_EXPIRED_EVENT'
      ]
    },
    {
      label: 'app',
      source: appSource,
      snippets: [
        'AUTH_SESSION_EXPIRED_EVENT',
        'authStore.clearLocalSession()',
        'ElMessage.warning',
        "path: '/login'",
        'redirect: currentRoute.fullPath'
      ]
    },
    {
      label: 'layout',
      source: layoutSource,
      snippets: [
        'AUTH_SESSION_EXPIRED_EVENT',
        'handleAuthSessionExpired',
        'closeAllWorkspaceTabs()',
        'clearSmartQueryCache()'
      ]
    }
  ])
];

const failed = checks.filter((check) => !check.ok);

if (failed.length) {
  console.error('Admin UI guardrail check failed:');

  for (const check of failed) {
    console.error(`- ${check.name}`);
    if (Array.isArray(check.details) && check.details.length) {
      for (const detail of check.details) {
        console.error(`  - ${detail}`);
      }
    }
  }

  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: checks.map((check) => ({
          name: check.name,
          ok: check.ok,
          count: Array.isArray(check.details) ? check.details.length : undefined
        }))
      },
      null,
      2
    )
  );
}
