import {
  ATTACHMENT_BUSINESS_MODULE_DICTIONARY_GROUP,
  ATTACHMENT_PURPOSE_DICTIONARY_GROUP,
  DATA_BACKUP_TYPE_DICTIONARY_GROUP,
  DATA_EXPORT_MODULE_DICTIONARY_GROUP,
  DATA_IMPORT_MODULE_DICTIONARY_GROUP,
  MAINTENANCE_ANNOUNCEMENT_LEVEL_DICTIONARY_GROUP,
  MAINTENANCE_VERSION_STATUS_DICTIONARY_GROUP,
  OPS_ERROR_LEVEL_DICTIONARY_GROUP,
  PLATFORM_AUTH_MODE_DICTIONARY_GROUP,
  SECURITY_IP_SCOPE_DICTIONARY_GROUP
} from '@/config/quickSettings';
import type {
  AppAnnouncementLevel,
  AppVersionStatus,
  BackupJobType,
  DataDictionary,
  ErrorLogLevel,
  IpWhitelistScope,
  PlatformAuthMode
} from '@/types/system';

export type SecurityIpScopeOption = {
  value: IpWhitelistScope;
  label: string;
};

export type PlatformAuthModeOption = {
  value: PlatformAuthMode;
  label: string;
};

export type MaintenanceAnnouncementLevelOption = {
  value: AppAnnouncementLevel;
  label: string;
};

export type MaintenanceVersionStatusOption = {
  value: AppVersionStatus;
  label: string;
};

export type DataBackupTypeOption = {
  value: BackupJobType;
  label: string;
};

export type DataModuleOption = {
  value: string;
  label: string;
};

export type OpsErrorLevelOption = {
  value: ErrorLogLevel;
  label: string;
};

export type SystemQuickOptionGroupKey =
  | 'ipScope'
  | 'platformAuthMode'
  | 'announcementLevel'
  | 'versionStatus'
  | 'backupType'
  | 'importModule'
  | 'exportModule'
  | 'opsErrorLevel'
  | 'attachmentBusinessModule'
  | 'attachmentPurpose';

export type SystemQuickOptionGroupConfig = {
  key: SystemQuickOptionGroupKey;
  title: string;
  group: string;
  help: string[];
};

export const systemQuickOptionGroups: SystemQuickOptionGroupConfig[] = [
  {
    key: 'ipScope',
    title: 'IP 白名单范围',
    group: SECURITY_IP_SCOPE_DICTIONARY_GROUP,
    help: [
      '这里管 IP 白名单规则作用到哪里，比如后台、API、自动化。',
      '这些范围和安全逻辑绑定，只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'platformAuthMode',
    title: '平台授权方式',
    group: PLATFORM_AUTH_MODE_DICTIONARY_GROUP,
    help: [
      '这里管平台接口授权配置里的授权方式，比如 OAuth、手工 Token、应用凭据。',
      '授权方式会影响平台接口怎么保存凭据，所以只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'announcementLevel',
    title: '公告级别',
    group: MAINTENANCE_ANNOUNCEMENT_LEVEL_DICTIONARY_GROUP,
    help: [
      '这里管系统公告的重要程度，比如信息、警告、错误。',
      '级别会影响公告颜色和关注度，所以只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'versionStatus',
    title: '版本状态',
    group: MAINTENANCE_VERSION_STATUS_DICTIONARY_GROUP,
    help: [
      '这里管版本信息里的状态，比如草稿、已发布、已废弃。',
      '状态和版本发布流程绑定，只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'backupType',
    title: '备份类型',
    group: DATA_BACKUP_TYPE_DICTIONARY_GROUP,
    help: [
      '这里管数据中心创建备份时可以选择的备份范围，比如数据库、文件、配置。',
      '备份类型和后端任务能力绑定，只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'importModule',
    title: '导入模块',
    group: DATA_IMPORT_MODULE_DICTIONARY_GROUP,
    help: [
      '这里管数据中心创建导入任务时可以选择写入哪个模块。',
      '导入模块和后端导入能力绑定，只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'exportModule',
    title: '导出模块',
    group: DATA_EXPORT_MODULE_DICTIONARY_GROUP,
    help: [
      '这里管数据中心创建导出任务时可以选择导出哪个模块。',
      '导出模块和后端导出能力绑定，只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'opsErrorLevel',
    title: '运维错误级别',
    group: OPS_ERROR_LEVEL_DICTIONARY_GROUP,
    help: [
      '这里管运维监控里手动记录错误时的严重程度，比如信息、警告、错误、严重。',
      '级别和后端错误日志绑定，只支持改显示名称、排序和启停。'
    ]
  },
  {
    key: 'attachmentBusinessModule',
    title: '附件业务模块',
    group: ATTACHMENT_BUSINESS_MODULE_DICTIONARY_GROUP,
    help: [
      '这里管附件上传时“这个文件属于哪个业务区”的下拉。',
      '模块代码会写进附件记录，方便后面按 Apple ID、兑换码、系统资料等筛选。'
    ]
  },
  {
    key: 'attachmentPurpose',
    title: '附件用途',
    group: ATTACHMENT_PURPOSE_DICTIONARY_GROUP,
    help: [
      '这里管附件上传时“这个文件是做什么用”的下拉，比如凭证、截图、导入文件。',
      '用途会写进附件记录，方便后续搜索、审计和售后回查。'
    ]
  }
];

export const defaultSecurityIpScopes: SecurityIpScopeOption[] = [
  { value: 'admin', label: '后台' },
  { value: 'api', label: 'API' },
  { value: 'automation', label: '自动化' }
];

export const defaultPlatformAuthModes: PlatformAuthModeOption[] = [
  { value: 'oauth', label: 'OAuth' },
  { value: 'manual_token', label: '手工 Token' },
  { value: 'app_credentials', label: '应用凭据' }
];

export const defaultMaintenanceAnnouncementLevels: MaintenanceAnnouncementLevelOption[] = [
  { value: 'info', label: '信息' },
  { value: 'warning', label: '警告' },
  { value: 'error', label: '错误' }
];

export const defaultMaintenanceVersionStatuses: MaintenanceVersionStatusOption[] = [
  { value: 'draft', label: '草稿' },
  { value: 'released', label: '已发布' },
  { value: 'deprecated', label: '已废弃' }
];

export const defaultDataBackupTypes: DataBackupTypeOption[] = [
  { value: 'database', label: '数据库' },
  { value: 'files', label: '文件' },
  { value: 'config', label: '配置' }
];

export const defaultDataImportModules: DataModuleOption[] = [
  { value: 'customers', label: '客户' },
  { value: 'source_platforms', label: '来源平台' }
];

export const defaultDataExportModules: DataModuleOption[] = [
  { value: 'customers', label: '客户' },
  { value: 'source_platforms', label: '来源平台' },
  { value: 'apple_accounts', label: 'Apple ID 账号概览' },
  { value: 'apple_orders', label: 'Apple ID 订单' },
  { value: 'redeem_codes', label: '兑换码库存概览' },
  { value: 'code_orders', label: '兑换码订单' }
];

export const defaultOpsErrorLevels: OpsErrorLevelOption[] = [
  { value: 'info', label: '信息' },
  { value: 'warn', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'fatal', label: '严重' }
];

export const defaultAttachmentBusinessModules: DataModuleOption[] = [
  { value: 'apple', label: 'Apple ID' },
  { value: 'code', label: '兑换码' },
  { value: 'customer', label: '客户资料' },
  { value: 'system', label: '系统配置' },
  { value: 'data', label: '数据与审计' },
  { value: 'ops', label: '运维平台' }
];

export const defaultAttachmentPurposes: DataModuleOption[] = [
  { value: 'evidence', label: '凭证' },
  { value: 'screenshot', label: '截图' },
  { value: 'import', label: '导入文件' },
  { value: 'export', label: '导出文件' },
  { value: 'after_sale', label: '售后材料' },
  { value: 'audit', label: '审计材料' }
];

const supportedSecurityIpScopes = new Set<IpWhitelistScope>(
  defaultSecurityIpScopes.map((item) => item.value)
);
const supportedPlatformAuthModes = new Set<PlatformAuthMode>(
  defaultPlatformAuthModes.map((item) => item.value)
);
const supportedMaintenanceAnnouncementLevels = new Set<AppAnnouncementLevel>(
  defaultMaintenanceAnnouncementLevels.map((item) => item.value)
);
const supportedMaintenanceVersionStatuses = new Set<AppVersionStatus>(
  defaultMaintenanceVersionStatuses.map((item) => item.value)
);
const supportedDataBackupTypes = new Set<BackupJobType>(
  defaultDataBackupTypes.map((item) => item.value)
);
const supportedDataImportModules = new Set(defaultDataImportModules.map((item) => item.value));
const supportedDataExportModules = new Set(defaultDataExportModules.map((item) => item.value));
const supportedOpsErrorLevels = new Set<ErrorLogLevel>(
  defaultOpsErrorLevels.map((item) => item.value)
);
const supportedAttachmentBusinessModules = new Set(
  defaultAttachmentBusinessModules.map((item) => item.value)
);
const supportedAttachmentPurposes = new Set(defaultAttachmentPurposes.map((item) => item.value));

function buildDefaultDictionaries<T extends string>(
  group: string,
  options: Array<{ value: T; label: string }>,
  remark: string
) {
  return options.map((option, index) => ({
    group,
    code: option.value,
    label: option.label,
    value: option.value,
    sortOrder: index,
    status: 'active' as const,
    remark
  }));
}

function buildFixedOptions<T extends string>(
  dictionaries: DataDictionary[],
  isSupported: (value: string) => value is T,
  defaults: Array<{ value: T; label: string }>
) {
  const configured = dictionaries.filter((item): item is DataDictionary & { code: T } =>
    isSupported(item.code)
  );

  if (!configured.length) {
    return defaults;
  }

  return configured
    .filter((item) => item.status === 'active')
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      value: item.code,
      label: item.label
    }));
}

function getFixedLabel<T extends string>(
  value: T,
  dictionaries: DataDictionary[],
  defaults: Array<{ value: T; label: string }>
) {
  const dictionary = dictionaries.find((item) => item.code === value);
  return dictionary?.label || defaults.find((item) => item.value === value)?.label || value;
}

export function isSecurityIpScope(value: string): value is IpWhitelistScope {
  return supportedSecurityIpScopes.has(value as IpWhitelistScope);
}

export function isPlatformAuthMode(value: string): value is PlatformAuthMode {
  return supportedPlatformAuthModes.has(value as PlatformAuthMode);
}

export function isMaintenanceAnnouncementLevel(value: string): value is AppAnnouncementLevel {
  return supportedMaintenanceAnnouncementLevels.has(value as AppAnnouncementLevel);
}

export function isMaintenanceVersionStatus(value: string): value is AppVersionStatus {
  return supportedMaintenanceVersionStatuses.has(value as AppVersionStatus);
}

export function isDataBackupType(value: string): value is BackupJobType {
  return supportedDataBackupTypes.has(value as BackupJobType);
}

export function isDataImportModule(value: string) {
  return supportedDataImportModules.has(value);
}

export function isDataExportModule(value: string) {
  return supportedDataExportModules.has(value);
}

export function isOpsErrorLevel(value: string): value is ErrorLogLevel {
  return supportedOpsErrorLevels.has(value as ErrorLogLevel);
}

export function isAttachmentBusinessModule(value: string) {
  return supportedAttachmentBusinessModules.has(value);
}

export function isAttachmentPurpose(value: string) {
  return supportedAttachmentPurposes.has(value);
}

export function getDefaultSecurityIpScopeDictionaries() {
  return buildDefaultDictionaries(
    SECURITY_IP_SCOPE_DICTIONARY_GROUP,
    defaultSecurityIpScopes,
    '系统支持的 IP 白名单范围，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultPlatformAuthModeDictionaries() {
  return buildDefaultDictionaries(
    PLATFORM_AUTH_MODE_DICTIONARY_GROUP,
    defaultPlatformAuthModes,
    '系统支持的平台接口授权方式，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultMaintenanceAnnouncementLevelDictionaries() {
  return buildDefaultDictionaries(
    MAINTENANCE_ANNOUNCEMENT_LEVEL_DICTIONARY_GROUP,
    defaultMaintenanceAnnouncementLevels,
    '系统支持的公告级别，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultMaintenanceVersionStatusDictionaries() {
  return buildDefaultDictionaries(
    MAINTENANCE_VERSION_STATUS_DICTIONARY_GROUP,
    defaultMaintenanceVersionStatuses,
    '系统支持的版本状态，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultDataBackupTypeDictionaries() {
  return buildDefaultDictionaries(
    DATA_BACKUP_TYPE_DICTIONARY_GROUP,
    defaultDataBackupTypes,
    '系统支持的数据备份类型，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultDataImportModuleDictionaries() {
  return buildDefaultDictionaries(
    DATA_IMPORT_MODULE_DICTIONARY_GROUP,
    defaultDataImportModules,
    '系统支持的数据导入模块，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultDataExportModuleDictionaries() {
  return buildDefaultDictionaries(
    DATA_EXPORT_MODULE_DICTIONARY_GROUP,
    defaultDataExportModules,
    '系统支持的数据导出模块，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultOpsErrorLevelDictionaries() {
  return buildDefaultDictionaries(
    OPS_ERROR_LEVEL_DICTIONARY_GROUP,
    defaultOpsErrorLevels,
    '系统支持的运维错误级别，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultAttachmentBusinessModuleDictionaries() {
  return buildDefaultDictionaries(
    ATTACHMENT_BUSINESS_MODULE_DICTIONARY_GROUP,
    defaultAttachmentBusinessModules,
    '系统支持的附件业务模块，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultAttachmentPurposeDictionaries() {
  return buildDefaultDictionaries(
    ATTACHMENT_PURPOSE_DICTIONARY_GROUP,
    defaultAttachmentPurposes,
    '系统支持的附件用途，可在快捷设置里改名称、排序和启停'
  );
}

export function getDefaultSystemQuickOptionDictionaries(key: SystemQuickOptionGroupKey) {
  if (key === 'ipScope') return getDefaultSecurityIpScopeDictionaries();
  if (key === 'platformAuthMode') return getDefaultPlatformAuthModeDictionaries();
  if (key === 'announcementLevel') return getDefaultMaintenanceAnnouncementLevelDictionaries();
  if (key === 'versionStatus') return getDefaultMaintenanceVersionStatusDictionaries();
  if (key === 'backupType') return getDefaultDataBackupTypeDictionaries();
  if (key === 'importModule') return getDefaultDataImportModuleDictionaries();
  if (key === 'exportModule') return getDefaultDataExportModuleDictionaries();
  if (key === 'opsErrorLevel') return getDefaultOpsErrorLevelDictionaries();
  if (key === 'attachmentBusinessModule') {
    return getDefaultAttachmentBusinessModuleDictionaries();
  }
  return getDefaultAttachmentPurposeDictionaries();
}

export function isSystemQuickOptionCode(key: SystemQuickOptionGroupKey, value: string) {
  if (key === 'ipScope') return isSecurityIpScope(value);
  if (key === 'platformAuthMode') return isPlatformAuthMode(value);
  if (key === 'announcementLevel') return isMaintenanceAnnouncementLevel(value);
  if (key === 'versionStatus') return isMaintenanceVersionStatus(value);
  if (key === 'backupType') return isDataBackupType(value);
  if (key === 'importModule') return isDataImportModule(value);
  if (key === 'exportModule') return isDataExportModule(value);
  if (key === 'opsErrorLevel') return isOpsErrorLevel(value);
  if (key === 'attachmentBusinessModule') return isAttachmentBusinessModule(value);
  return isAttachmentPurpose(value);
}

export function buildSecurityIpScopeOptions(
  dictionaries: DataDictionary[]
): SecurityIpScopeOption[] {
  return buildFixedOptions(dictionaries, isSecurityIpScope, defaultSecurityIpScopes);
}

export function buildPlatformAuthModeOptions(
  dictionaries: DataDictionary[]
): PlatformAuthModeOption[] {
  return buildFixedOptions(dictionaries, isPlatformAuthMode, defaultPlatformAuthModes);
}

export function buildMaintenanceAnnouncementLevelOptions(
  dictionaries: DataDictionary[]
): MaintenanceAnnouncementLevelOption[] {
  return buildFixedOptions(
    dictionaries,
    isMaintenanceAnnouncementLevel,
    defaultMaintenanceAnnouncementLevels
  );
}

export function buildMaintenanceVersionStatusOptions(
  dictionaries: DataDictionary[]
): MaintenanceVersionStatusOption[] {
  return buildFixedOptions(
    dictionaries,
    isMaintenanceVersionStatus,
    defaultMaintenanceVersionStatuses
  );
}

export function buildDataBackupTypeOptions(dictionaries: DataDictionary[]): DataBackupTypeOption[] {
  return buildFixedOptions(dictionaries, isDataBackupType, defaultDataBackupTypes);
}

export function buildDataImportModuleOptions(dictionaries: DataDictionary[]): DataModuleOption[] {
  return buildFixedOptions(
    dictionaries,
    (value): value is string => isDataImportModule(value),
    defaultDataImportModules
  );
}

export function buildDataExportModuleOptions(dictionaries: DataDictionary[]): DataModuleOption[] {
  return buildFixedOptions(
    dictionaries,
    (value): value is string => isDataExportModule(value),
    defaultDataExportModules
  );
}

export function buildOpsErrorLevelOptions(dictionaries: DataDictionary[]): OpsErrorLevelOption[] {
  return buildFixedOptions(dictionaries, isOpsErrorLevel, defaultOpsErrorLevels);
}

export function buildAttachmentBusinessModuleOptions(
  dictionaries: DataDictionary[]
): DataModuleOption[] {
  return buildFixedOptions(
    dictionaries,
    (value): value is string => isAttachmentBusinessModule(value),
    defaultAttachmentBusinessModules
  );
}

export function buildAttachmentPurposeOptions(dictionaries: DataDictionary[]): DataModuleOption[] {
  return buildFixedOptions(
    dictionaries,
    (value): value is string => isAttachmentPurpose(value),
    defaultAttachmentPurposes
  );
}

export function getSecurityIpScopeLabel(value: string, dictionaries: DataDictionary[]) {
  if (!isSecurityIpScope(value)) {
    return value;
  }
  return getFixedLabel(value, dictionaries, defaultSecurityIpScopes);
}

export function getPlatformAuthModeLabel(value: PlatformAuthMode, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultPlatformAuthModes);
}

export function getMaintenanceAnnouncementLevelLabel(
  value: AppAnnouncementLevel,
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultMaintenanceAnnouncementLevels);
}

export function getMaintenanceVersionStatusLabel(
  value: AppVersionStatus,
  dictionaries: DataDictionary[]
) {
  return getFixedLabel(value, dictionaries, defaultMaintenanceVersionStatuses);
}

export function getDataBackupTypeLabel(value: BackupJobType, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultDataBackupTypes);
}

export function getDataImportModuleLabel(value: string, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultDataImportModules);
}

export function getDataExportModuleLabel(value: string, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultDataExportModules);
}

export function getOpsErrorLevelLabel(value: ErrorLogLevel, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultOpsErrorLevels);
}

export function getAttachmentBusinessModuleLabel(value: string, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultAttachmentBusinessModules);
}

export function getAttachmentPurposeLabel(value: string, dictionaries: DataDictionary[]) {
  return getFixedLabel(value, dictionaries, defaultAttachmentPurposes);
}
