export const CUSTOMER_TAG_DICTIONARY_GROUP = 'customer.tags';
export const APPLE_SERVICE_CATEGORY_DICTIONARY_GROUP = 'apple.service.categories';
export const APPLE_ACCOUNT_REGION_DICTIONARY_GROUP = 'apple.account.regions';
export const APPLE_SERVICE_PERIOD_TYPE_DICTIONARY_GROUP = 'apple.service.period_types';
export const APPLE_SERVICE_EXPIRE_CALC_TYPE_DICTIONARY_GROUP = 'apple.service.expire_calc_types';
export const APPLE_SERVICE_LOCK_RULE_DICTIONARY_GROUP = 'apple.service.lock_rules';
export const APPLE_SERVICE_PLATFORM_FEE_TYPE_DICTIONARY_GROUP = 'apple.service.platform_fee_types';
export const CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP = 'code.service.delivery_modes';
export const CODE_DELIVERY_METHOD_DICTIONARY_GROUP = 'code.delivery.methods';
export const NOTIFICATION_MODULE_DICTIONARY_GROUP = 'notification.modules';
export const NOTIFICATION_LEVEL_DICTIONARY_GROUP = 'notification.levels';
export const NOTIFICATION_CHANNEL_DICTIONARY_GROUP = 'notification.channels';
export const SECURITY_IP_SCOPE_DICTIONARY_GROUP = 'security.ip_scopes';
export const PLATFORM_AUTH_MODE_DICTIONARY_GROUP = 'platform.auth_modes';
export const MAINTENANCE_ANNOUNCEMENT_LEVEL_DICTIONARY_GROUP =
  'maintenance.announcement_levels';
export const MAINTENANCE_VERSION_STATUS_DICTIONARY_GROUP = 'maintenance.version_statuses';
export const DATA_BACKUP_TYPE_DICTIONARY_GROUP = 'data.backup_types';
export const DATA_IMPORT_MODULE_DICTIONARY_GROUP = 'data.import_modules';
export const DATA_EXPORT_MODULE_DICTIONARY_GROUP = 'data.export_modules';
export const OPS_ERROR_LEVEL_DICTIONARY_GROUP = 'ops.error_levels';
export const ATTACHMENT_BUSINESS_MODULE_DICTIONARY_GROUP = 'attachment.business_modules';
export const ATTACHMENT_PURPOSE_DICTIONARY_GROUP = 'attachment.purposes';

export function buildQuickSettingCode(label: string, prefix = 'item') {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  const base = normalized || prefix;
  return `${base}-${Date.now().toString(36)}`.slice(0, 120);
}
