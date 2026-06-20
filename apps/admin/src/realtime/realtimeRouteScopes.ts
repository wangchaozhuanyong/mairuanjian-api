const fallbackScopesByModuleKey: Record<string, string[]> = {
  dashboard: [
    'dashboard-overview',
    'notification-overview',
    'ops-overview',
    'ops-platform-status',
    'apple-renewal-tasks',
    'apple-action-plans',
    'code-delivery-exceptions'
  ],
  renewal: ['apple-renewal-tasks'],
  'renewal-cancel': ['apple-renewal-tasks'],
  'renewal-topup': ['apple-renewal-tasks'],
  'renewal-waiting-auto': ['apple-renewal-tasks'],
  'action-plans': ['apple-action-plans'],
  'launch-audit': ['launch-audit', 'maintenance-parameters'],
  'apple-list': ['apple-accounts'],
  'apple-detail': ['apple-accounts', 'apple-orders', 'apple-activations', 'apple-renewal-tasks'],
  'apple-settings': ['apple-accounts', 'apple-services'],
  'apple-orders': ['apple-orders'],
  'order-entry': ['apple-orders', 'customers', 'source-platforms', 'apple-services'],
  'apple-activations': ['apple-activations'],
  'balance-reconciliation': ['apple-accounts'],
  'finance-center': ['apple-orders', 'apple-activations'],
  'apple-automation': ['apple-automation-tasks'],
  'apple-reports': ['apple-reports', 'apple-orders', 'apple-activations'],
  'code-inventory': ['code-inventory', 'code-services'],
  'code-settings': ['code-services', 'code-service-mappings'],
  'code-orders': ['code-orders', 'code-order-dependencies'],
  'delivery-exceptions': ['code-delivery-exceptions'],
  'after-sales': ['code-after-sales'],
  'taobao-orders': ['platform-code-orders-taobao'],
  'xianyu-orders': ['platform-code-orders-xianyu'],
  'code-reports': ['code-reports'],
  customers: ['customers', 'source-platforms'],
  'source-platforms': ['source-platforms'],
  'message-templates': ['message-templates'],
  attachments: ['attachments'],
  notifications: [
    'notification-overview',
    'notification-rules',
    'notification-templates',
    'notification-telegram',
    'notification-logs'
  ],
  security: ['security-overview'],
  'login-logs': ['security-login-logs'],
  sessions: ['security-sessions'],
  mfa: ['security-settings'],
  'ip-whitelist': ['security-ip-whitelists'],
  'sensitive-approvals': ['security-approvals'],
  'data-center': ['data-overview', 'data-backups', 'data-restores'],
  'data-imports': ['data-overview', 'data-imports'],
  'data-exports': ['data-overview', 'data-exports'],
  'data-dictionaries': ['data-overview', 'data-dictionaries'],
  'recycle-bin': ['data-overview', 'data-recycle-bin'],
  'ops-monitor': ['ops-overview', 'ops-queue-status', 'ops-error-logs'],
  maintenance: ['maintenance-overview', 'maintenance-announcements', 'maintenance-mode'],
  'feature-flags': ['maintenance-overview', 'maintenance-feature-flags'],
  versions: ['maintenance-overview', 'maintenance-versions'],
  changelog: ['maintenance-overview', 'maintenance-changelogs'],
  'system-parameters': ['maintenance-overview', 'maintenance-parameters'],
  users: ['system-users'],
  roles: ['system-roles', 'system-users'],
  'audit-log': [
    'audit-operation-logs',
    'audit-sensitive-logs',
    'audit-login-logs',
    'audit-export-logs',
    'audit-permission-logs',
    'audit-automation-logs',
    'audit-platform-logs'
  ],
  'platform-status': ['ops-platform-status', 'ops-platform-sync'],
  'platform-interface-logs': ['audit-platform-logs'],
  'automation-logs': ['audit-automation-logs']
};

export function getRealtimeFallbackScopesForModule(moduleKey: string | undefined) {
  if (!moduleKey) {
    return [];
  }

  return fallbackScopesByModuleKey[moduleKey] ?? [];
}
