import { markSmartQueriesStale } from '@/utils/smartQuery';
import { notifyRealtimeQueryInvalidated } from './realtimeQueryEvents';
import type { RealtimeEvent } from './realtimeTypes';

export function handleRealtimeEvent(event: RealtimeEvent) {
  if (event.module === 'system' && event.entity === 'connection') {
    return;
  }

  const scopes = getRealtimeSmartQueryScopes(event);

  if (!scopes.length) {
    return;
  }

  for (const scope of scopes) {
    markSmartQueriesStale(scope);
  }

  notifyRealtimeQueryInvalidated(event, scopes);
}

function getRealtimeSmartQueryScopes(event: RealtimeEvent) {
  const scopes = new Set<string>();

  if (event.module !== 'system') {
    scopes.add('audit-operation-logs');
  }

  if (event.module === 'apple') {
    scopes.add('dashboard-overview');
    scopes.add('apple-account-source-channels');
    scopes.add('apple-accounts');
    scopes.add('apple-orders');
    scopes.add('apple-services');
    scopes.add('apple-activations');
    scopes.add('apple-renewal-tasks');
    scopes.add('apple-action-plans');
    scopes.add('apple-automation-tasks');
    scopes.add('apple-reports');

    if (event.entity === 'automation_task') {
      scopes.add('audit-automation-logs');
    }
  }

  if (event.module === 'code') {
    scopes.add('dashboard-overview');
    scopes.add('code-services');
    scopes.add('code-service-mappings');
    scopes.add('message-templates');
    scopes.add('code-order-dependencies');
    scopes.add('code-inventory');
    scopes.add('code-orders');
    scopes.add('code-after-sales');
    scopes.add('code-delivery-exceptions');
    scopes.add('code-reports');
  }

  if (event.module === 'platform') {
    scopes.add('dashboard-overview');
    scopes.add('ops-platform-status');
    scopes.add('ops-platform-sync');
    scopes.add('audit-platform-logs');
  }

  if (event.module === 'common') {
    if (event.entity === 'customer') {
      scopes.add('customers');
    }

    if (event.entity === 'source_platform') {
      scopes.add('source-platforms');
      scopes.add('customers');
      scopes.add('code-order-dependencies');
      scopes.add('code-service-mappings');
    }

    if (event.entity === 'message_template') {
      scopes.add('message-templates');
      scopes.add('code-service-mappings');
    }

    if (event.entity === 'attachment') {
      scopes.add('attachments');
    }
  }

  if (event.module === 'system') {
    if (event.entity === 'user') {
      scopes.add('system-users');
      scopes.add('audit-operation-logs');
    }

    if (event.entity === 'role' || event.entity === 'permission') {
      scopes.add('system-roles');
      scopes.add('system-user-roles');
      scopes.add('system-users');
      scopes.add('audit-operation-logs');
      scopes.add('audit-permission-logs');
    }
  }

  if (event.module === 'notification') {
    scopes.add('dashboard-overview');
    scopes.add('notification-overview');
    scopes.add('notification-logs');

    if (event.entity === 'rule') {
      scopes.add('notification-rules');
    }

    if (event.entity === 'template') {
      scopes.add('notification-templates');
    }

    if (event.entity === 'telegram_config') {
      scopes.add('notification-telegram');
    }
  }

  if (event.module === 'ops') {
    scopes.add('dashboard-overview');
    scopes.add('ops-overview');

    if (event.entity === 'apple_web_gateway') {
      scopes.add('ops-apple-web-gateways');
      scopes.add('ops-platform-sync');
    }

    if (event.entity === 'health_snapshot') {
      scopes.add('ops-health-snapshots');
      scopes.add('ops-queue-status');
    }

    if (event.entity === 'error_log') {
      scopes.add('ops-error-logs');
    }
  }

  if (event.module === 'data') {
    scopes.add('data-overview');
    scopes.add('notification-overview');

    if (event.entity === 'backup_job') {
      scopes.add('data-backups');
    }

    if (event.entity === 'restore_job') {
      scopes.add('data-restores');
    }

    if (event.entity === 'import_job') {
      scopes.add('data-imports');
    }

    if (event.entity === 'export_job') {
      scopes.add('data-exports');
    }

    if (event.entity === 'recycle_bin_record') {
      scopes.add('data-recycle-bin');
    }

    if (event.entity === 'cleanup_job') {
      scopes.add('data-cleanup-jobs');
    }

    if (event.entity === 'duplicate_merge_job') {
      scopes.add('data-duplicate-merge-jobs');
    }

    if (event.entity === 'dictionary') {
      scopes.add('data-dictionaries');
    }

    if (event.entity === 'system_parameter') {
      scopes.add('data-parameters');
    }
  }

  if (event.module === 'maintenance') {
    scopes.add('maintenance-overview');
    scopes.add('notification-overview');

    if (event.entity === 'announcement') {
      scopes.add('maintenance-announcements');
    }

    if (event.entity === 'maintenance_mode') {
      scopes.add('maintenance-mode');
    }

    if (event.entity === 'feature_flag') {
      scopes.add('maintenance-feature-flags');
    }

    if (event.entity === 'app_version') {
      scopes.add('maintenance-versions');
      scopes.add('maintenance-changelogs');
    }

    if (event.entity === 'menu_config') {
      scopes.add('maintenance-menu-config');
    }

    if (event.entity === 'theme_config') {
      scopes.add('maintenance-theme-config');
    }

    if (event.entity === 'system_parameter' || event.entity === 'launch_checklist') {
      scopes.add('launch-audit');
      scopes.add('maintenance-parameters');
    }
  }

  if (event.module === 'security') {
    scopes.add('security-overview');
    scopes.add('notification-overview');
    scopes.add('audit-login-logs');
    scopes.add('audit-sensitive-logs');

    if (event.entity === 'login_log') {
      scopes.add('security-login-logs');
    }

    if (event.entity === 'active_session') {
      scopes.add('security-sessions');
    }

    if (
      event.entity === 'mfa' ||
      event.entity === 'mfa_settings' ||
      event.entity === 'password_policy'
    ) {
      scopes.add('security-settings');
    }

    if (event.entity === 'ip_whitelist') {
      scopes.add('security-ip-whitelists');
    }

    if (event.entity === 'sensitive_access_approval') {
      scopes.add('security-approvals');
    }

    if (event.entity === 'sensitive_access_log') {
      scopes.add('security-access-logs');
    }
  }

  return Array.from(scopes);
}
