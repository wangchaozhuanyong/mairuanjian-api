import { http, request, type ApiRequestOptions } from './client';
import type {
  AuditLog,
  Attachment,
  ActiveSession,
  AppleActionPlan,
  AppleActionPlanItem,
  AppleAccount,
  AppleAccountImportResult,
  AppleAccountOwnershipReport,
  AppleAccountOwnershipType,
  AppleAccountSecretField,
  AppleAccountSourceChannel,
  AppleAccountStatusCheck,
  AppleAutomationTask,
  AutomationTaskLog,
  AppleBalanceAdjustment,
  AppleBalanceConsumption,
  AppleBalanceTopup,
  AppleOrder,
  AppleOrderEntryContext,
  AppleProfitReport,
  CodeAfterSale,
  CodeDeliveryLog,
  AppleService,
  AppleBalancePriceRuleType,
  AppleServicePlatformMapping,
  AppleWebGatewayNodeStatus,
  AppleWebGatewayStatus,
  AppleOfficialPriceSource,
  AppleOfficialPriceSnapshot,
  AppleOfficialPriceCheckBatch,
  ApplePriceChangeReview,
  AppleOfficialPriceCollectMethod,
  AppleOfficialPriceSourceStatus,
  ApplePriceChangeReviewStatus,
  ApplePriceChangeType,
  AppAnnouncement,
  AppAnnouncementLevel,
  AppVersion,
  AppVersionStatus,
  AutomationTaskPriority,
  AutomationTaskStatus,
  AutomationTaskType,
  AvailableAppleAccount,
  BackupJob,
  BackupJobType,
  CodePlatformMapping,
  CodePlatformOrder,
  CodeProfitReport,
  CodeService,
  CurrentUser,
  Customer,
  DataCenterOverview,
  DataCleanupJob,
  DataDictionary,
  DataDictionaryStatus,
  DataExportJob,
  DataImportJob,
  DataJobStatus,
  DuplicateMergeJob,
  CronJobLog,
  CronJobLogStatus,
  ErrorLog,
  ErrorLogLevel,
  GeneratedDeliveryContent,
  IpWhitelist,
  IpWhitelistScope,
  LoginLog,
  LoginLogStatus,
  LaunchChecklist,
  LaunchChecklistItem,
  MaintenanceOverview,
  MaintenanceWindow,
  ManagedUser,
  MessageTemplate,
  MyMfaEnableResult,
  MyMfaSetup,
  MyMfaStatus,
  NotificationLevel,
  NotificationLog,
  NotificationLogStatus,
  NavigationItemBadges,
  NavigationNotificationBadges,
  NotificationOverview,
  NotificationRule,
  NotificationTemplate,
  OpsComponentStatus,
  OpsHealthStatus,
  OpsOverview,
  OpsQueueCurrent,
  PlatformAuthorizationConfig,
  PlatformOAuthStartResult,
  PlatformCurrentStatus,
  PlatformInterfaceStatus,
  PlatformSyncLog,
  PlatformSyncLogStatus,
  PageResult,
  PaidCurrency,
  Permission,
  QueueStatusLog,
  RedeemCodeBatch,
  RedeemCodeImportResult,
  RedeemCodeInventoryItem,
  ReissueCodeAfterSaleResult,
  RenewalTask,
  RestoreJob,
  RecycleBinRecord,
  RevealedRedeemCode,
  RevealedAppleAccountSecret,
  RevealedCustomerPhone,
  RevealedGiftCardCode,
  Role,
  SecurityOverview,
  SecuritySetting,
  ServiceActivation,
  SavePlatformAuthorizationPayload,
  SaveAppleWebGatewaySubscriptionPayload,
  StartPlatformOAuthPayload,
  SensitiveAccessApproval,
  SensitiveAccessApprovalStatus,
  SensitiveAccessLog,
  SourcePlatform,
  SystemHealthSnapshot,
  SystemParameter,
  TelegramConfig,
  FeatureFlag,
  UserTableView
} from '@/types/system';
import { createSmartQueryKey, markSmartQueriesStale, refreshSmartQuery } from '@/utils/smartQuery';

export const NAVIGATION_NOTIFICATION_BADGES_CHANGED_EVENT =
  'apple-business:navigation-notification-badges-changed';
export const NAVIGATION_ITEM_BADGES_CHANGED_EVENT = 'apple-business:navigation-item-badges-changed';

const NAVIGATION_MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

interface LoginResponse {
  accessToken: string;
  user: CurrentUser;
}

function notifyNavigationNotificationBadgesChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(NAVIGATION_NOTIFICATION_BADGES_CHANGED_EVENT));
}

function notifyNavigationItemBadgesChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(NAVIGATION_ITEM_BADGES_CHANGED_EVENT));
}

function markMutatedSmartQueriesStale(url?: string) {
  if (!url) {
    return;
  }

  const path = url.split('?')[0] ?? '';
  const scopes = new Set<string>();

  if (path.startsWith('/user-table-views')) {
    scopes.add('user-table-views');
  }

  if (path.startsWith('/source-platforms')) {
    scopes.add('source-platforms');
    scopes.add('customers');
    scopes.add('code-order-dependencies');
    scopes.add('code-service-mappings');
  }

  if (path.startsWith('/customers')) {
    scopes.add('customers');
    scopes.add('dashboard-overview');
  }

  if (path.startsWith('/data/dictionaries')) {
    scopes.add('data-dictionaries');
    scopes.add('customers');
    scopes.add('apple-accounts');
  }

  if (path.startsWith('/message-templates')) {
    scopes.add('message-templates');
    scopes.add('code-service-mappings');
  }

  if (path.startsWith('/roles') || path.startsWith('/permissions')) {
    scopes.add('system-roles');
    scopes.add('system-user-roles');
    scopes.add('system-users');
  }

  if (path.startsWith('/apple-accounts')) {
    scopes.add('apple-accounts');
    scopes.add('dashboard-overview');
  }

  if (path.startsWith('/apple/official-prices')) {
    scopes.add('apple-official-prices');
    scopes.add('apple-services');
    scopes.add('apple-automation-tasks');
    scopes.add('dashboard-overview');
  }

  for (const scope of scopes) {
    markSmartQueriesStale(scope);
  }
}

http.interceptors.response.use((response) => {
  const method = response.config.method?.toLowerCase() ?? '';

  if (NAVIGATION_MUTATION_METHODS.has(method)) {
    markMutatedSmartQueriesStale(response.config.url);
    notifyNavigationNotificationBadgesChanged();
    notifyNavigationItemBadgesChanged();
  }

  return response;
});

export interface UserQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  module?: string;
  action?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface CommonPageQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AttachmentQuery extends CommonPageQuery {
  businessModule?: string;
  objectType?: string;
  objectId?: string;
  purpose?: string;
}

export interface UploadAttachmentPayload {
  businessModule?: string;
  objectType?: string;
  objectId?: string;
  purpose?: string;
  remark?: string;
}

export interface UserTableViewQuery {
  page: number;
  pageSize: number;
  tableKey?: string;
  keyword?: string;
}

export interface SaveUserTableViewPayload {
  tableKey: string;
  viewName: string;
  filters: Record<string, unknown>;
  sortConfig: Record<string, unknown>;
  columns: string[];
  density: UserTableView['density'];
  pageSize: number;
  isDefault?: boolean;
}

export interface CustomerQuery extends CommonPageQuery {
  sourcePlatformId?: string;
}

export type SourcePlatformQuery = CommonPageQuery;

export type AppleAccountSourceChannelQuery = CommonPageQuery;

export interface MessageTemplateQuery extends CommonPageQuery {
  type?: string;
  channel?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface NotificationRuleQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  module?: string;
  level?: NotificationLevel | '';
  enabled?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface NotificationTemplateQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  eventCode?: string;
  channel?: string;
  enabled?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface NotificationLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  module?: string;
  eventCode?: string;
  channel?: string;
  status?: NotificationLogStatus | '';
  unread?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface LoginLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: LoginLogStatus | '';
  abnormal?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface ActiveSessionQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  revoked?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface IpWhitelistQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  scope?: IpWhitelistScope | '';
  enabled?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface SensitiveAccessLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  module?: string;
  fieldName?: string;
  approved?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface SensitiveAccessApprovalQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: SensitiveAccessApprovalStatus | '';
  module?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface DataJobQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: DataJobStatus | '';
  module?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface BackupJobQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: DataJobStatus | '';
  jobType?: BackupJobType | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface RestoreJobQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: DataJobStatus | '';
  backupJobId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface ExportJobQuery extends DataJobQuery {
  containsSensitive?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface RecycleBinQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  module?: string;
  objectType?: string;
  restored?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface DataDictionaryQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  group?: string;
  status?: DataDictionaryStatus | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface SystemParameterQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  group?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface OpsQueueStatusQuery {
  page: number;
  pageSize: number;
  queueName?: string;
  status?: OpsHealthStatus | '';
}

export interface OpsCronJobQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: CronJobLogStatus | '';
}

export interface OpsPlatformSyncQuery {
  page: number;
  pageSize: number;
  platform?: string;
  status?: PlatformSyncLogStatus | '';
}

export type AuditSensitiveAccessQuery = SensitiveAccessLogQuery;

export type AuditLoginQuery = LoginLogQuery;

export type AuditExportQuery = ExportJobQuery;

export interface AuditPermissionChangeQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AuditAutomationTaskLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  level?: AutomationTaskLog['level'] | '';
  taskId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AuditPlatformInterfaceLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  platform?: string;
  status?: PlatformSyncLogStatus | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface OpsErrorLogQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  module?: string;
  level?: ErrorLogLevel | '';
}

export interface OpsHealthSnapshotQuery {
  page: number;
  pageSize: number;
  status?: OpsHealthStatus | '';
}

export interface MaintenanceAnnouncementQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  level?: AppAnnouncementLevel | '';
  enabled?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface MaintenanceFeatureFlagQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  enabled?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface MaintenanceVersionQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: AppVersionStatus | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface MaintenanceParameterQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AppleAccountQuery extends CommonPageQuery {
  currency?: string;
  region?: string;
  ownershipType?: AppleAccountOwnershipType | '';
  locked?: string;
  sourceChannelId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AppleServiceQuery extends CommonPageQuery {
  currency?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AppleOfficialPriceSourceQuery extends CommonPageQuery {
  provider?: string;
  region?: string;
  currency?: string;
  collectMethod?: AppleOfficialPriceCollectMethod | '';
  status?: AppleOfficialPriceSourceStatus | '';
}

export interface AppleOfficialPriceSnapshotQuery extends CommonPageQuery {
  sourceId?: string;
  appleServiceId?: string;
}

export interface ApplePriceChangeReviewQuery extends CommonPageQuery {
  sourceId?: string;
  appleServiceId?: string;
  status?: ApplePriceChangeReviewStatus | '';
  changeType?: ApplePriceChangeType | '';
}

export interface AppleOrderQuery extends CommonPageQuery {
  customerId?: string;
  sourcePlatformId?: string;
  serviceId?: string;
  appleAccountId?: string;
}

export interface ServiceActivationQuery extends CommonPageQuery {
  customerId?: string;
  appleAccountId?: string;
  serviceId?: string;
  sourcePlatformId?: string;
  autoRenewStatus?: string;
  renewalDecision?: string;
  expireFrom?: string;
  expireTo?: string;
}

export interface RenewalTaskQuery extends CommonPageQuery {
  taskType?: string;
  priority?: string;
  customerDecision?: string;
  customerId?: string;
  appleAccountId?: string;
  serviceId?: string;
  activationId?: string;
  assignedToUserId?: string;
  dueFrom?: string;
  dueTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AppleActionPlanQuery extends CommonPageQuery {
  appleAccountId?: string;
  hasWrongChargeRisk?: string;
  planDateFrom?: string;
  planDateTo?: string;
}

export interface AppleAutomationTaskQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  taskType?: AutomationTaskType | '';
  status?: AutomationTaskStatus | '';
  priority?: AutomationTaskPriority | '';
  appleAccountId?: string;
  manualRequired?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface AppleProfitReportQuery {
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  status?: string;
  customerId?: string;
  sourcePlatformId?: string;
  serviceId?: string;
  appleAccountId?: string;
}

export interface CodeServiceQuery extends CommonPageQuery {
  deliveryMode?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc' | '';
}

export interface CodePlatformMappingQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  serviceId?: string;
  platformId?: string;
  enabled?: string;
}

export interface RedeemCodeBatchQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  serviceId?: string;
}

export interface RedeemCodeInventoryQuery extends CommonPageQuery {
  serviceId?: string;
  batchId?: string;
}

export interface CodeOrderQuery extends CommonPageQuery {
  platformId?: string;
  serviceId?: string;
  deliveryStatus?: string;
  refundStatus?: string;
}

export interface CodeDeliveryLogQuery extends CommonPageQuery {
  platformId?: string;
  orderId?: string;
  deliveryStatus?: string;
}

export interface CodeAfterSaleQuery extends CommonPageQuery {
  orderId?: string;
}

export interface CodeProfitReportQuery {
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  platformId?: string;
  serviceId?: string;
  deliveryStatus?: string;
}

export interface SaveUserPayload {
  username?: string;
  password?: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  status?: 'active' | 'disabled';
  roleIds: string[];
}

export interface SaveCustomerPayload {
  name: string;
  phone?: string | null;
  wechat?: string | null;
  sourcePlatformId?: string | null;
  tags?: string[];
  remark?: string | null;
  status?: 'active' | 'disabled';
}

export interface RevealCustomerPhonePayload {
  reason: string;
}

export interface SaveSourcePlatformPayload {
  name: string;
  feeRate?: string;
  feeFixed?: string;
  status?: 'active' | 'disabled';
  remark?: string | null;
}

export interface SaveAppleAccountSourceChannelPayload {
  name: string;
  status?: AppleAccountSourceChannel['status'];
  remark?: string | null;
}

export interface SaveMessageTemplatePayload {
  name: string;
  type?: MessageTemplate['type'];
  channel?: MessageTemplate['channel'];
  content: string;
  variables?: string[];
  status?: 'active' | 'disabled';
  remark?: string | null;
}

export interface SaveNotificationRulePayload {
  name: string;
  eventCode: string;
  module: string;
  level?: NotificationLevel;
  enabled?: boolean;
  channels?: Array<'telegram' | 'system'>;
  recipients?: Record<string, unknown> | null;
  triggerCondition?: Record<string, unknown> | null;
  rateLimit?: Record<string, unknown> | null;
}

export interface SaveNotificationTemplatePayload {
  name: string;
  eventCode: string;
  ruleId?: string | null;
  channel: 'telegram' | 'system';
  title: string;
  content: string;
  variables?: Array<string | Record<string, unknown>>;
  enabled?: boolean;
}

export interface SaveTelegramConfigPayload {
  notificationName: string;
  enabled?: boolean;
  botToken?: string | null;
  chatId: string;
  notificationLevel?: NotificationLevel;
  silentStartTime?: string | null;
  silentEndTime?: string | null;
  retryCount?: number;
}

export interface TestTelegramPayload {
  configId?: string;
  title?: string;
  content?: string;
}

export interface SaveIpWhitelistPayload {
  ipOrCidr: string;
  scope?: IpWhitelistScope;
  enabled?: boolean;
  remark?: string | null;
}

export interface CreateSensitiveApprovalPayload {
  module: string;
  fieldName: string;
  objectType: string;
  objectId?: string | null;
  reason: string;
  expiresAt?: string | null;
}

export interface DecideSensitiveApprovalPayload {
  decisionNote?: string | null;
  expiresAt?: string | null;
}

export interface CreateBackupJobPayload {
  jobType?: BackupJobType;
  status?: DataJobStatus;
  storagePath?: string | null;
  fileSize?: string | number | null;
  remark?: string | null;
}

export interface UpdateBackupJobStatusPayload {
  status: DataJobStatus;
  storagePath?: string | null;
  fileSize?: string | number | null;
  errorMessage?: string | null;
}

export interface CreateRestoreJobPayload {
  backupJobId?: string | null;
  restoreScope: string;
  status?: DataJobStatus;
  approvalNote?: string | null;
}

export interface CreateImportJobPayload {
  module: string;
  filePath?: string | null;
  status?: DataJobStatus;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
  errorReport?: string | null;
  remark?: string | null;
}

export interface CreateExportJobPayload {
  module: string;
  exportScope?: Record<string, unknown> | null;
  fields?: string[];
  containsSensitive?: boolean;
  status?: DataJobStatus;
  filePath?: string | null;
  downloadExpiresAt?: string | null;
}

export interface UpdateGenericDataJobStatusPayload {
  status: DataJobStatus;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
  affectedCount?: number;
  errorMessage?: string | null;
  errorReport?: string | null;
  filePath?: string | null;
  downloadExpiresAt?: string | null;
}

export interface CreateCleanupJobPayload {
  module: string;
  cleanupScope?: Record<string, unknown> | null;
  status?: DataJobStatus;
  affectedCount?: number;
  approvalNote?: string | null;
}

export interface CreateDuplicateMergeJobPayload {
  module: string;
  matchRule?: Record<string, unknown> | null;
  primaryObjectId?: string | null;
  duplicateObjectIds?: string[];
  status?: DataJobStatus;
  affectedCount?: number;
  approvalNote?: string | null;
}

export interface CreateDataDictionaryPayload {
  group: string;
  code: string;
  label: string;
  value?: string | null;
  sortOrder?: number;
  status?: DataDictionaryStatus;
  remark?: string | null;
}

export interface UpdateDataDictionaryPayload {
  label?: string;
  value?: string | null;
  sortOrder?: number;
  status?: DataDictionaryStatus;
  remark?: string | null;
}

export interface SaveSystemParameterPayload {
  value?: Record<string, unknown>;
  group?: string;
  remark?: string | null;
}

export interface CreateOpsErrorLogPayload {
  level?: ErrorLogLevel;
  module: string;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
}

export interface TestPlatformConnectionPayload {
  syncType?: string;
  metadata?: Record<string, unknown> | null;
}

export interface ReauthorizePlatformPayload {
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SaveMaintenanceAnnouncementPayload {
  title: string;
  content: string;
  level?: AppAnnouncementLevel;
  enabled?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export interface SaveMaintenanceModePayload {
  enabled?: boolean;
  reason: string;
  allowedRoles?: string[];
  allowedIps?: string[];
  startAt?: string | null;
  endAt?: string | null;
}

export interface SaveFeatureFlagPayload {
  key?: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown> | null;
  remark?: string | null;
}

export interface SaveAppVersionPayload {
  version: string;
  title: string;
  status?: AppVersionStatus;
  releaseNotes: string;
  impactModules?: string[];
  releasedAt?: string | null;
}

export interface SaveMaintenanceParameterPayload {
  key?: string;
  value?: Record<string, unknown>;
  group?: string;
  remark?: string | null;
}

export interface SaveAppleAccountPayload {
  appleId?: string;
  region?: string;
  currency?: string;
  currentBalance?: string;
  balanceCostAmount?: string;
  ownershipType?: AppleAccountOwnershipType;
  purchaseCost?: string;
  salePrice?: string;
  sourceChannelId?: string | null;
  status?: AppleAccount['status'];
  isManuallyLocked?: boolean;
  manualLockReason?: string | null;
  password?: string | null;
  securityInfo?: string | null;
  phone?: string | null;
  recoveryEmail?: string | null;
  remark?: string | null;
}

export interface ImportAppleAccountsPayload {
  accounts: string[];
  sourceChannelId?: string | null;
}

export interface CreateAppleBalanceTopupPayload {
  faceValue: string;
  costAmount: string;
  giftCardCode?: string | null;
  remark?: string | null;
}

export interface CreateAppleBalanceConsumptionPayload {
  amount: string;
  reason?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  remark?: string | null;
}

export interface CreateAppleBalanceAdjustmentPayload {
  newBalance: string;
  costAdjustMethod: AppleBalanceAdjustment['costAdjustMethod'];
  newCostRmb?: string | null;
  reason: string;
  evidenceAttachmentId?: string | null;
}

export interface CreateAppleAccountStatusCheckPayload {
  checkType?: AppleAccountStatusCheck['checkType'];
  resultStatus: AppleAccountStatusCheck['resultStatus'];
  balanceSnapshot?: string | null;
  remark?: string | null;
  evidenceAttachmentId?: string | null;
}

export interface RevealGiftCardCodePayload {
  reason: string;
}

export interface RevealAppleAccountSecretPayload {
  field: AppleAccountSecretField;
  reason: string;
}

export interface SaveAppleServicePayload {
  name: string;
  category?: string;
  defaultPrice?: string;
  officialBasePrice?: string;
  officialCostValue?: string;
  appleBalancePriceRuleType?: AppleBalancePriceRuleType;
  appleBalancePriceRuleValue?: string | null;
  currency?: string;
  defaultPeriodType?: AppleService['defaultPeriodType'];
  defaultPeriodValue?: number;
  expireCalcType?: AppleService['expireCalcType'];
  requireAppleId?: boolean;
  requireServiceAccount?: boolean;
  autoMatchAppleId?: boolean;
  lockRule?: AppleService['lockRule'];
  allowedRegions?: string[];
  minBalanceRequired?: string;
  status?: AppleService['status'];
  remark?: string | null;
}

export type UpdateAppleServicePayload = Partial<SaveAppleServicePayload>;

export interface AppleBalancePriceRule {
  ruleType: Extract<AppleBalancePriceRuleType, 'percent' | 'fixed_add'>;
  ruleValue: string;
}

export interface SaveAppleServicePlatformMappingPayload {
  sourcePlatformId: string;
  shopName?: string | null;
  platformItemId: string;
  platformSkuId?: string | null;
  skuKeyword?: string | null;
  platformPrice?: string;
  platformFeeType?: AppleServicePlatformMapping['platformFeeType'];
  platformFeeValue?: string;
  allowAutoOrder?: boolean;
  enabled?: boolean;
}

export interface SaveAppleOfficialPriceSourcePayload {
  name: string;
  provider?: string;
  priceSourceType?: string;
  region: string;
  currency: string;
  sourceUrl?: string | null;
  collectMethod?: AppleOfficialPriceCollectMethod;
  checkIntervalHours?: number;
  status?: AppleOfficialPriceSourceStatus;
  remark?: string | null;
}

export interface OfficialPriceCollectedItemPayload {
  appleServiceId?: string | null;
  planCode?: string | null;
  serviceName: string;
  category?: string | null;
  region?: string | null;
  currency?: string | null;
  officialPrice: string;
  periodType?: AppleService['defaultPeriodType'];
  periodValue?: number;
  rawPayload?: Record<string, unknown> | null;
}

export interface CheckOfficialPriceSourcePayload {
  trigger?: 'manual' | 'worker' | 'system';
  items?: OfficialPriceCollectedItemPayload[];
  scanRemovedPlans?: boolean;
  remark?: string | null;
}

export interface CheckOfficialPriceProviderPayload {
  regions?: Array<{
    currency?: string;
    region?: string;
    sourceUrl?: string | null;
  }>;
  scanRemovedPlans?: boolean;
  trigger?: 'manual' | 'worker' | 'system';
}

export interface AppleOfficialPriceProviderCatalogRegion {
  currency: string;
  label: string;
  region: string;
  sourceUrl: string;
  value: string;
}

export interface AppleOfficialPriceProviderCatalogProvider {
  label: string;
  regions: AppleOfficialPriceProviderCatalogRegion[];
  shortLabel: string;
  sourceUrl: string;
  value: string;
}

export interface AppleOfficialPriceProviderCatalog {
  providers: AppleOfficialPriceProviderCatalogProvider[];
  regions: AppleOfficialPriceProviderCatalogRegion[];
}

export interface CheckOfficialPriceProviderResult {
  failedCount: number;
  message: string;
  pendingReviewCount: number;
  provider: string;
  reviewCount: number;
  snapshotCount: number;
  sourceCount: number;
}

export type StartOfficialPriceCheckBatchResult = AppleOfficialPriceCheckBatch & {
  reused?: boolean;
};

export interface SaveCodeServicePayload {
  name: string;
  faceValue: string;
  defaultPrice?: string;
  defaultCost?: string;
  deliveryMode?: CodeService['deliveryMode'];
  exactFaceValueOnly?: boolean;
  allowCombination?: boolean;
  status?: CodeService['status'];
  remark?: string | null;
}

export interface SaveCodePlatformMappingPayload {
  platformId: string;
  shopId?: string | null;
  platformItemId: string;
  platformSkuId?: string | null;
  skuKeyword?: string | null;
  serviceId: string;
  faceValue?: string;
  quantity?: number;
  deliveryTemplateId?: string | null;
  enabled?: boolean;
}

export interface ImportRedeemCodesPayload {
  serviceId: string;
  batchNo?: string | null;
  defaultCost?: string | null;
  expireAt?: string | null;
  remark?: string | null;
  codes: string[];
}

export interface RevealRedeemCodePayload {
  reason: string;
}

export interface CreateManualCodeOrderPayload {
  platformId: string;
  externalOrderNo: string;
  buyerId?: string | null;
  buyerNameMasked?: string | null;
  itemId: string;
  skuId?: string | null;
  itemTitle?: string | null;
  skuName?: string | null;
  serviceId?: string | null;
  faceValue?: string | null;
  quantity?: number;
  paidAmount?: string;
  platformFee?: string;
  orderStatus?: string;
  paidAt?: string | null;
}

export interface GenerateDeliveryContentPayload {
  reason: string;
}

export interface ConfirmCodeDeliveryPayload {
  deliveryMethod?: CodeDeliveryLog['deliveryMethod'];
  deliveryContent: string;
  errorMessage?: string | null;
}

export interface MarkCodeOrderManualPayload {
  reason: string;
}

export interface PlatformDeliverPayload {
  deliveryContent?: string | null;
  deliveryMethod?: CodeDeliveryLog['deliveryMethod'];
  reason?: string | null;
}

export interface PlatformSyncResult {
  platform: 'taobao' | 'xianyu' | 'manual';
  supported: boolean;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string;
}

export interface PlatformDeliverResult {
  platform: 'taobao' | 'xianyu' | 'manual';
  supported: boolean;
  status: 'success' | 'manual_required' | 'unsupported';
  message: string;
  order?: CodePlatformOrder;
}

export interface CreateCodeAfterSalePayload {
  orderId: string;
  originalCodeId?: string | null;
  reason: string;
}

export interface ReissueCodeAfterSalePayload {
  newCodeId?: string | null;
  deliveryMethod?: CodeDeliveryLog['deliveryMethod'];
  deliveryContent?: string | null;
  reason?: string | null;
}

export interface CreateAppleOrderPayload {
  customerId: string;
  sourcePlatformId?: string | null;
  externalOrderNo?: string | null;
  serviceId: string;
  appleAccountId?: string | null;
  serviceAccount?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  startTime?: string | null;
  expireTime?: string | null;
  paidAmount?: string;
  paidCurrency?: PaidCurrency;
  paidExchangeRateToRmb?: string;
  platformFee?: string;
  refundLoss?: string;
  appleCostValue?: string;
  appleAccountOwnershipType?: AppleAccountOwnershipType;
  remark?: string | null;
}

export interface UpdateAppleOrderPayload {
  externalOrderNo?: string | null;
  serviceAccount?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  startTime?: string | null;
  expireTime?: string | null;
  paidAmount?: string;
  paidCurrency?: PaidCurrency;
  paidExchangeRateToRmb?: string;
  platformFee?: string;
  refundLoss?: string;
  status?: AppleOrder['status'];
  remark?: string | null;
}

export interface AvailableAppleAccountQuery {
  serviceId: string;
  amountRequired?: string;
  currency?: string;
  keyword?: string;
  ownershipType?: AppleAccountOwnershipType;
  showUnavailable?: string;
}

export interface CreateRenewalTaskPayload {
  activationId: string;
  taskType: RenewalTask['taskType'];
  title?: string;
  priority?: RenewalTask['priority'];
  customerDecision?: RenewalTask['customerDecision'];
  requiredAction?: string | null;
  assignedToUserId?: string | null;
  note?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
}

export interface UpdateRenewalTaskPayload {
  title?: string;
  status?: RenewalTask['status'];
  priority?: RenewalTask['priority'];
  customerDecision?: RenewalTask['customerDecision'];
  requiredAction?: string | null;
  assignedToUserId?: string | null;
  note?: string | null;
  resultNote?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
  evidenceAttachmentId?: string | null;
}

export interface CompleteRenewalTaskPayload {
  resultNote?: string | null;
  customerDecision?: RenewalTask['customerDecision'];
  evidenceAttachmentId?: string | null;
}

export interface CancelRenewalTaskPayload {
  resultNote?: string | null;
}

export interface PostponeRenewalTaskPayload {
  dueAt: string;
  remindAt?: string | null;
  note?: string | null;
}

export interface GenerateRenewalTasksPayload {
  daysAhead?: number;
  now?: string;
}

export interface GenerateActionPlansPayload {
  daysAhead?: number;
  now?: string;
}

export interface CompleteActionPlanPayload {
  mainNote?: string | null;
}

export interface CreateAppleAutomationTaskPayload {
  taskType: AutomationTaskType;
  appleAccountId?: string | null;
  customerId?: string | null;
  serviceId?: string | null;
  activationId?: string | null;
  priority?: AutomationTaskPriority;
  inputPayload?: Record<string, unknown> | null;
}

export interface BatchAppleStatusCheckPayload {
  appleAccountIds: string[];
  priority?: AutomationTaskPriority;
  gatewayRegion?: string | null;
  note?: string | null;
}

export interface BatchAppleStatusCheckResult {
  createdCount: number;
  queuedCount: number;
  manualRequiredCount: number;
  items: AppleAutomationTask[];
}

export interface AppleWebCheckGatewayCandidate {
  id: string;
  name: string;
  countryCode: string;
  status: AppleWebGatewayNodeStatus;
  protocol?: string | null;
  hasEncryptedConfig: boolean;
  latencyMs?: number | null;
  lastCheckedAt?: string | null;
  failureReason?: string | null;
}

export interface AppleWebCheckGatewayContext {
  taskId: string;
  queueJobId?: string | null;
  accountRegion: string;
  exitCountry: string;
  gatewayConfigured: boolean;
  gatewayProfileCode?: string | null;
  selectedNodeId?: string | null;
  fallbackGatewayProfileCode?: string | null;
  canRunWithSyncedNode: boolean;
  candidates: AppleWebCheckGatewayCandidate[];
}

export interface AppleWebCheckGatewayAttemptPayload {
  nodeId?: string | null;
  status?: 'success' | 'failed';
  exitIp?: string | null;
  exitCountry?: string | null;
  latencyMs?: number | null;
  failureReason?: string | null;
}

export interface AppleWebCheckGatewayAttemptResult {
  task: AppleAutomationTask;
  gatewayAttempt: Record<string, unknown>;
  remainingCandidateIds: string[];
}

export interface WriteAppleAutomationTaskResultPayload {
  status?: Extract<AutomationTaskStatus, 'success' | 'failed' | 'need_review'>;
  resultPayload?: Record<string, unknown> | null;
  screenshotAttachmentId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface MarkAppleAutomationTaskManualPayload {
  reason: string;
}

export const authApi = {
  login(username: string, password: string, mfaCode?: string) {
    return request<LoginResponse>(http.post('/auth/login', { username, password, mfaCode }));
  },
  me() {
    return request<CurrentUser>(http.get('/auth/me'));
  },
  logout() {
    return request<{ loggedOut: boolean }>(http.post('/auth/logout'));
  }
};

export const usersApi = {
  list(params: UserQuery) {
    return request<PageResult<ManagedUser>>(http.get('/users', { params }));
  },
  create(payload: SaveUserPayload) {
    return request<ManagedUser>(http.post('/users', payload));
  },
  update(id: string, payload: SaveUserPayload) {
    return request<ManagedUser>(http.patch(`/users/${id}`, payload));
  }
};

export const rolesApi = {
  listRoles() {
    return request<Role[]>(http.get('/roles'));
  },
  listPermissions() {
    return request<Permission[]>(http.get('/permissions'));
  },
  updatePermissions(roleId: string, permissionIds: string[]) {
    return request<Role>(http.put(`/roles/${roleId}/permissions`, { permissionIds }));
  }
};

export const userTableViewsApi = {
  list(params: UserTableViewQuery) {
    return refreshSmartQuery({
      key: createSmartQueryKey('user-table-views', params),
      fetcher: () => request<PageResult<UserTableView>>(http.get('/user-table-views', { params })),
      force: false
    }).then((result) => result.data);
  },
  create(payload: SaveUserTableViewPayload) {
    return request<UserTableView>(http.post('/user-table-views', payload));
  },
  update(id: string, payload: Partial<SaveUserTableViewPayload>) {
    return request<UserTableView>(http.patch(`/user-table-views/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/user-table-views/${id}`));
  },
  setDefault(id: string) {
    return request<UserTableView>(http.post(`/user-table-views/${id}/set-default`));
  }
};

export const auditLogsApi = {
  list(params: AuditLogQuery) {
    return request<PageResult<AuditLog>>(http.get('/audit-logs', { params }));
  },
  operation(params: AuditLogQuery) {
    return request<PageResult<AuditLog>>(http.get('/audit-logs/operation', { params }));
  },
  sensitiveAccess(params: AuditSensitiveAccessQuery) {
    return request<PageResult<SensitiveAccessLog>>(
      http.get('/audit-logs/sensitive-access', { params })
    );
  },
  login(params: AuditLoginQuery) {
    return request<PageResult<LoginLog>>(http.get('/audit-logs/login', { params }));
  },
  exports(params: AuditExportQuery) {
    return request<PageResult<DataExportJob>>(http.get('/audit-logs/export', { params }));
  },
  permissionChanges(params: AuditPermissionChangeQuery) {
    return request<PageResult<AuditLog>>(http.get('/audit-logs/permission-changes', { params }));
  },
  automationTasks(params: AuditAutomationTaskLogQuery) {
    return request<PageResult<AutomationTaskLog>>(
      http.get('/audit-logs/automation-tasks', { params })
    );
  },
  platformInterfaces(params: AuditPlatformInterfaceLogQuery) {
    return request<PageResult<PlatformSyncLog>>(
      http.get('/audit-logs/platform-interfaces', { params })
    );
  }
};

export const customersApi = {
  list(params: CustomerQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<Customer>>(
      http.get('/customers', { params, signal: options.signal })
    );
  },
  get(id: string) {
    return request<Customer>(http.get(`/customers/${id}`));
  },
  create(payload: SaveCustomerPayload) {
    return request<Customer>(http.post('/customers', payload));
  },
  update(id: string, payload: SaveCustomerPayload) {
    return request<Customer>(http.patch(`/customers/${id}`, payload));
  },
  revealPhone(id: string, payload: RevealCustomerPhonePayload) {
    return request<RevealedCustomerPhone>(http.post(`/customers/${id}/reveal-phone`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/customers/${id}`));
  }
};

export const sourcePlatformsApi = {
  list(params: SourcePlatformQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<SourcePlatform>>(
      http.get('/source-platforms', { params, signal: options.signal })
    );
  },
  create(payload: SaveSourcePlatformPayload) {
    return request<SourcePlatform>(http.post('/source-platforms', payload));
  },
  update(id: string, payload: SaveSourcePlatformPayload) {
    return request<SourcePlatform>(http.patch(`/source-platforms/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/source-platforms/${id}`));
  }
};

export const appleAccountSourceChannelsApi = {
  list(params: AppleAccountSourceChannelQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<AppleAccountSourceChannel>>(
      http.get('/apple/account-source-channels', { params, signal: options.signal })
    );
  },
  create(payload: SaveAppleAccountSourceChannelPayload) {
    return request<AppleAccountSourceChannel>(http.post('/apple/account-source-channels', payload));
  },
  update(id: string, payload: SaveAppleAccountSourceChannelPayload) {
    return request<AppleAccountSourceChannel>(
      http.patch(`/apple/account-source-channels/${id}`, payload)
    );
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/apple/account-source-channels/${id}`));
  }
};

export const messageTemplatesApi = {
  list(params: MessageTemplateQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<MessageTemplate>>(
      http.get('/message-templates', { params, signal: options.signal })
    );
  },
  create(payload: SaveMessageTemplatePayload) {
    return request<MessageTemplate>(http.post('/message-templates', payload));
  },
  update(id: string, payload: SaveMessageTemplatePayload) {
    return request<MessageTemplate>(http.patch(`/message-templates/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/message-templates/${id}`));
  }
};

export const notificationsApi = {
  overview() {
    return request<NotificationOverview>(http.get('/notifications/overview'));
  },
  navBadges() {
    return request<NavigationNotificationBadges>(http.get('/notifications/nav-badges'));
  },
  navItemBadges() {
    return request<NavigationItemBadges>(http.get('/notifications/nav-item-badges'));
  },
  listInApp(params: NotificationLogQuery) {
    return request<PageResult<NotificationLog>>(http.get('/notifications', { params }));
  },
  get(id: string) {
    return request<NotificationLog>(http.get(`/notifications/${id}`));
  },
  markRead(id: string) {
    return request<NotificationLog>(http.patch(`/notifications/${id}/read`));
  },
  markAllRead() {
    return request<{ updatedCount: number }>(http.patch('/notifications/read-all'));
  },
  listRules(params: NotificationRuleQuery) {
    return request<PageResult<NotificationRule>>(http.get('/notifications/rules', { params }));
  },
  createRule(payload: SaveNotificationRulePayload) {
    return request<NotificationRule>(http.post('/notifications/rules', payload));
  },
  updateRule(id: string, payload: Partial<SaveNotificationRulePayload>) {
    return request<NotificationRule>(http.patch(`/notifications/rules/${id}`, payload));
  },
  removeRule(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/notifications/rules/${id}`));
  },
  enableRule(id: string) {
    return request<NotificationRule>(http.patch(`/notifications/rules/${id}/enable`));
  },
  disableRule(id: string) {
    return request<NotificationRule>(http.patch(`/notifications/rules/${id}/disable`));
  },
  listTemplates(params: NotificationTemplateQuery) {
    return request<PageResult<NotificationTemplate>>(
      http.get('/notifications/templates', { params })
    );
  },
  createTemplate(payload: SaveNotificationTemplatePayload) {
    return request<NotificationTemplate>(http.post('/notifications/templates', payload));
  },
  updateTemplate(id: string, payload: Partial<SaveNotificationTemplatePayload>) {
    return request<NotificationTemplate>(http.patch(`/notifications/templates/${id}`, payload));
  },
  removeTemplate(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/notifications/templates/${id}`));
  },
  renderTemplate(id: string, payload: Record<string, unknown>) {
    return request<{ title: string; content: string }>(
      http.post(`/notifications/templates/${id}/render`, payload)
    );
  },
  listLogs(params: NotificationLogQuery) {
    return request<PageResult<NotificationLog>>(http.get('/notifications/logs', { params }));
  },
  retryLog(id: string) {
    return request<NotificationLog>(http.post(`/notifications/logs/${id}/retry`));
  },
  listTelegramConfigs() {
    return request<{ items: TelegramConfig[] }>(http.get('/notifications/telegram'));
  },
  createTelegramConfig(payload: SaveTelegramConfigPayload) {
    return request<TelegramConfig>(http.post('/notifications/telegram', payload));
  },
  updateTelegramConfig(id: string, payload: Partial<SaveTelegramConfigPayload>) {
    return request<TelegramConfig>(http.patch(`/notifications/telegram/${id}`, payload));
  },
  removeTelegramConfig(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/notifications/telegram/${id}`));
  },
  testTelegram(payload: TestTelegramPayload) {
    return request<{ status: 'success' | 'failed'; errorMessage?: string; config: TelegramConfig }>(
      http.post('/notifications/telegram/test', payload)
    );
  }
};

export const securityApi = {
  overview() {
    return request<SecurityOverview>(http.get('/security/overview'));
  },
  listLoginLogs(params: LoginLogQuery) {
    return request<PageResult<LoginLog>>(http.get('/security/login-logs', { params }));
  },
  listAbnormalLogins(params: LoginLogQuery) {
    return request<PageResult<LoginLog>>(http.get('/security/abnormal-logins', { params }));
  },
  listActiveSessions(params: ActiveSessionQuery) {
    return request<PageResult<ActiveSession>>(http.get('/security/active-sessions', { params }));
  },
  revokeSession(id: string) {
    return request<ActiveSession>(http.delete(`/security/active-sessions/${id}`));
  },
  getMfaSettings() {
    return request<SecuritySetting>(http.get('/security/mfa-settings'));
  },
  updateMfaSettings(value: Record<string, unknown>) {
    return request<SecuritySetting>(http.patch('/security/mfa-settings', value));
  },
  getMyMfaStatus() {
    return request<MyMfaStatus>(http.get('/security/mfa/me'));
  },
  setupMyMfa() {
    return request<MyMfaSetup>(http.post('/security/mfa/me/setup'));
  },
  enableMyMfa(code: string) {
    return request<MyMfaEnableResult>(http.post('/security/mfa/me/enable', { code }));
  },
  regenerateMyMfaRecoveryCodes(code: string) {
    return request<MyMfaEnableResult>(http.post('/security/mfa/me/recovery-codes', { code }));
  },
  disableMyMfa(payload: { code: string; reason?: string }) {
    return request<MyMfaStatus>(http.post('/security/mfa/me/disable', payload));
  },
  resetUserMfa(userId: string) {
    return request<MyMfaStatus>(http.post(`/security/mfa/users/${userId}/reset`));
  },
  getPasswordPolicy() {
    return request<SecuritySetting>(http.get('/security/password-policy'));
  },
  updatePasswordPolicy(value: Record<string, unknown>) {
    return request<SecuritySetting>(http.patch('/security/password-policy', value));
  },
  listIpWhitelists(params: IpWhitelistQuery) {
    return request<PageResult<IpWhitelist>>(http.get('/security/ip-whitelists', { params }));
  },
  createIpWhitelist(payload: SaveIpWhitelistPayload) {
    return request<IpWhitelist>(http.post('/security/ip-whitelists', payload));
  },
  updateIpWhitelist(id: string, payload: Partial<SaveIpWhitelistPayload>) {
    return request<IpWhitelist>(http.patch(`/security/ip-whitelists/${id}`, payload));
  },
  removeIpWhitelist(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/security/ip-whitelists/${id}`));
  },
  listSensitiveAccessLogs(params: SensitiveAccessLogQuery) {
    return request<PageResult<SensitiveAccessLog>>(
      http.get('/security/sensitive-access-logs', { params })
    );
  },
  listSensitiveApprovals(params: SensitiveAccessApprovalQuery) {
    return request<PageResult<SensitiveAccessApproval>>(
      http.get('/security/sensitive-access-approvals', { params })
    );
  },
  createSensitiveApproval(payload: CreateSensitiveApprovalPayload) {
    return request<SensitiveAccessApproval>(
      http.post('/security/sensitive-access-approvals', payload)
    );
  },
  approveSensitiveApproval(id: string, payload: DecideSensitiveApprovalPayload) {
    return request<SensitiveAccessApproval>(
      http.patch(`/security/sensitive-access-approvals/${id}/approve`, payload)
    );
  },
  rejectSensitiveApproval(id: string, payload: DecideSensitiveApprovalPayload) {
    return request<SensitiveAccessApproval>(
      http.patch(`/security/sensitive-access-approvals/${id}/reject`, payload)
    );
  },
  listSensitiveOperations(params: CommonPageQuery) {
    return request<PageResult<AuditLog>>(http.get('/security/sensitive-operations', { params }));
  }
};

export const dataCenterApi = {
  overview() {
    return request<DataCenterOverview>(http.get('/data/overview'));
  },
  listBackupJobs(params: BackupJobQuery) {
    return request<PageResult<BackupJob>>(http.get('/data/backup-jobs', { params }));
  },
  createBackupJob(payload: CreateBackupJobPayload) {
    return request<BackupJob>(http.post('/data/backup-jobs', payload));
  },
  updateBackupJobStatus(id: string, payload: UpdateBackupJobStatusPayload) {
    return request<BackupJob>(http.patch(`/data/backup-jobs/${id}/status`, payload));
  },
  executeBackupJob(id: string) {
    return request<BackupJob>(http.post(`/data/backup-jobs/${id}/execute`));
  },
  listRestoreJobs(params: RestoreJobQuery) {
    return request<PageResult<RestoreJob>>(http.get('/data/restore-jobs', { params }));
  },
  createRestoreJob(payload: CreateRestoreJobPayload) {
    return request<RestoreJob>(http.post('/data/restore-jobs', payload));
  },
  updateRestoreJobStatus(id: string, payload: UpdateGenericDataJobStatusPayload) {
    return request<RestoreJob>(http.patch(`/data/restore-jobs/${id}/status`, payload));
  },
  executeRestoreJob(id: string, confirmText: string) {
    return request<RestoreJob>(http.post(`/data/restore-jobs/${id}/execute`, { confirmText }));
  },
  listImportJobs(params: DataJobQuery) {
    return request<PageResult<DataImportJob>>(http.get('/data/import-jobs', { params }));
  },
  createImportJob(payload: CreateImportJobPayload) {
    return request<DataImportJob>(http.post('/data/import-jobs', payload));
  },
  updateImportJobStatus(id: string, payload: UpdateGenericDataJobStatusPayload) {
    return request<DataImportJob>(http.patch(`/data/import-jobs/${id}/status`, payload));
  },
  executeImportJob(id: string) {
    return request<DataImportJob>(http.post(`/data/import-jobs/${id}/execute`));
  },
  downloadImportErrorReport(id: string) {
    return http.get<Blob>(`/data/import-jobs/${id}/error-report`, {
      responseType: 'blob'
    });
  },
  listExportJobs(params: ExportJobQuery) {
    return request<PageResult<DataExportJob>>(http.get('/data/export-jobs', { params }));
  },
  createExportJob(payload: CreateExportJobPayload) {
    return request<DataExportJob>(http.post('/data/export-jobs', payload));
  },
  updateExportJobStatus(id: string, payload: UpdateGenericDataJobStatusPayload) {
    return request<DataExportJob>(http.patch(`/data/export-jobs/${id}/status`, payload));
  },
  executeExportJob(id: string) {
    return request<DataExportJob>(http.post(`/data/export-jobs/${id}/execute`));
  },
  getExportDownload(id: string) {
    return request<
      Pick<DataExportJob, 'id' | 'filePath' | 'downloadExpiresAt' | 'containsSensitive'>
    >(http.get(`/data/export-jobs/${id}/download`));
  },
  downloadExportJob(id: string) {
    return http.get<Blob>(`/data/export-jobs/${id}/download`, {
      responseType: 'blob'
    });
  },
  listRecycleBin(params: RecycleBinQuery) {
    return request<PageResult<RecycleBinRecord>>(http.get('/data/recycle-bin', { params }));
  },
  restoreRecycleBinRecord(id: string) {
    return request<RecycleBinRecord>(http.post(`/data/recycle-bin/${id}/restore`));
  },
  purgeRecycleBinRecord(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/data/recycle-bin/${id}`));
  },
  listCleanupJobs(params: DataJobQuery) {
    return request<PageResult<DataCleanupJob>>(http.get('/data/cleanup-jobs', { params }));
  },
  createCleanupJob(payload: CreateCleanupJobPayload) {
    return request<DataCleanupJob>(http.post('/data/cleanup-jobs', payload));
  },
  updateCleanupJobStatus(id: string, payload: UpdateGenericDataJobStatusPayload) {
    return request<DataCleanupJob>(http.patch(`/data/cleanup-jobs/${id}/status`, payload));
  },
  listDuplicateMergeJobs(params: DataJobQuery) {
    return request<PageResult<DuplicateMergeJob>>(
      http.get('/data/duplicate-merge-jobs', { params })
    );
  },
  createDuplicateMergeJob(payload: CreateDuplicateMergeJobPayload) {
    return request<DuplicateMergeJob>(http.post('/data/duplicate-merge-jobs', payload));
  },
  updateDuplicateMergeJobStatus(id: string, payload: UpdateGenericDataJobStatusPayload) {
    return request<DuplicateMergeJob>(
      http.patch(`/data/duplicate-merge-jobs/${id}/status`, payload)
    );
  },
  listDictionaries(params: DataDictionaryQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<DataDictionary>>(
      http.get('/data/dictionaries', { params, signal: options.signal })
    );
  },
  createDictionary(payload: CreateDataDictionaryPayload) {
    return request<DataDictionary>(http.post('/data/dictionaries', payload));
  },
  updateDictionary(id: string, payload: UpdateDataDictionaryPayload) {
    return request<DataDictionary>(http.patch(`/data/dictionaries/${id}`, payload));
  },
  removeDictionary(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/data/dictionaries/${id}`));
  },
  listSystemParameters(params: SystemParameterQuery) {
    return request<PageResult<SystemParameter>>(http.get('/data/system-parameters', { params }));
  },
  saveSystemParameter(key: string, payload: SaveSystemParameterPayload) {
    return request<SystemParameter>(http.patch(`/data/system-parameters/${key}`, payload));
  }
};

export const opsApi = {
  overview() {
    return request<OpsOverview>(http.get('/ops/overview'));
  },
  apiStatus() {
    return request<OpsComponentStatus>(http.get('/ops/api-status'));
  },
  databaseStatus() {
    return request<OpsComponentStatus>(http.get('/ops/database-status'));
  },
  redisStatus() {
    return request<OpsComponentStatus>(http.get('/ops/redis-status'));
  },
  queueStatus(params: OpsQueueStatusQuery) {
    return request<{
      current: OpsQueueCurrent;
      logs: PageResult<QueueStatusLog>;
    }>(http.get('/ops/queue-status', { params }));
  },
  cronJobs(params: OpsCronJobQuery) {
    return request<PageResult<CronJobLog>>(http.get('/ops/cron-jobs', { params }));
  },
  platformSyncStatus(params: OpsPlatformSyncQuery) {
    return request<{
      current: PlatformCurrentStatus[];
      logs: PageResult<PlatformSyncLog>;
    }>(http.get('/ops/platform-sync-status', { params }));
  },
  automationWorkers() {
    return request<OpsComponentStatus>(http.get('/ops/automation-workers'));
  },
  fileStorageStatus() {
    return request<OpsComponentStatus>(http.get('/ops/file-storage-status'));
  },
  diskSpace() {
    return request<OpsComponentStatus>(http.get('/ops/disk-space'));
  },
  errorLogs(params: OpsErrorLogQuery) {
    return request<PageResult<ErrorLog>>(http.get('/ops/error-logs', { params }));
  },
  createErrorLog(payload: CreateOpsErrorLogPayload) {
    return request<ErrorLog>(http.post('/ops/error-logs', payload));
  },
  healthSnapshots(params: OpsHealthSnapshotQuery) {
    return request<PageResult<SystemHealthSnapshot>>(http.get('/ops/health-snapshots', { params }));
  },
  captureHealthSnapshot() {
    return request<{
      snapshot: SystemHealthSnapshot;
      queueLog: QueueStatusLog;
    }>(http.post('/ops/health-snapshots'));
  },
  testPlatformConnection(platform: string, payload: TestPlatformConnectionPayload = {}) {
    return request<{
      platform: string;
      syncType: string;
      status: OpsHealthStatus;
      message: string;
      log: PlatformSyncLog;
    }>(http.post(`/ops/platforms/${platform}/test-connection`, payload));
  },
  platforms() {
    return request<{ items: PlatformInterfaceStatus[] }>(http.get('/ops/platforms'));
  },
  platform(platform: string) {
    return request<PlatformInterfaceStatus>(http.get(`/ops/platforms/${platform}`));
  },
  appleWebGateways() {
    return request<AppleWebGatewayStatus>(http.get('/ops/apple-web-gateways'));
  },
  saveAppleWebGatewaySubscription(payload: SaveAppleWebGatewaySubscriptionPayload) {
    return request<AppleWebGatewayStatus>(
      http.post('/ops/apple-web-gateways/subscription', payload)
    );
  },
  syncAppleWebGateways() {
    return request<AppleWebGatewayStatus>(http.post('/ops/apple-web-gateways/sync'));
  },
  platformAuthorization(platform: string) {
    return request<PlatformAuthorizationConfig>(
      http.get(`/ops/platforms/${platform}/authorization`)
    );
  },
  savePlatformAuthorization(platform: string, payload: SavePlatformAuthorizationPayload) {
    return request<PlatformAuthorizationConfig>(
      http.post(`/ops/platforms/${platform}/authorization`, payload)
    );
  },
  startPlatformOAuth(platform: string, payload: StartPlatformOAuthPayload = {}) {
    return request<PlatformOAuthStartResult>(
      http.post(`/ops/platforms/${platform}/oauth/start`, payload)
    );
  },
  reauthorizePlatform(platform: string, payload: ReauthorizePlatformPayload = {}) {
    return request<{
      platform: string;
      supported: boolean;
      status: 'manual_required';
      message: string;
      log: PlatformSyncLog;
    }>(http.post(`/ops/platforms/${platform}/reauthorize`, payload));
  }
};

export const maintenanceApi = {
  overview() {
    return request<MaintenanceOverview>(http.get('/maintenance/overview'));
  },
  listAnnouncements(params: MaintenanceAnnouncementQuery) {
    return request<PageResult<AppAnnouncement>>(http.get('/maintenance/announcements', { params }));
  },
  createAnnouncement(payload: SaveMaintenanceAnnouncementPayload) {
    return request<AppAnnouncement>(http.post('/maintenance/announcements', payload));
  },
  updateAnnouncement(id: string, payload: Partial<SaveMaintenanceAnnouncementPayload>) {
    return request<AppAnnouncement>(http.patch(`/maintenance/announcements/${id}`, payload));
  },
  removeAnnouncement(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/maintenance/announcements/${id}`));
  },
  getMode() {
    return request<MaintenanceWindow>(http.get('/maintenance/mode'));
  },
  getPublicMode() {
    return request<
      Pick<MaintenanceWindow, 'enabled' | 'reason' | 'allowedRoles' | 'startAt' | 'endAt'>
    >(http.get('/maintenance/mode/public'));
  },
  saveMode(payload: SaveMaintenanceModePayload) {
    return request<MaintenanceWindow>(http.patch('/maintenance/mode', payload));
  },
  getLaunchChecklist() {
    return request<LaunchChecklist>(http.get('/maintenance/launch-checklist'));
  },
  saveLaunchChecklist(items: LaunchChecklistItem[]) {
    return request<LaunchChecklist>(http.patch('/maintenance/launch-checklist', { items }));
  },
  listFeatureFlags(params: MaintenanceFeatureFlagQuery) {
    return request<PageResult<FeatureFlag>>(http.get('/maintenance/feature-flags', { params }));
  },
  createFeatureFlag(payload: SaveFeatureFlagPayload) {
    return request<FeatureFlag>(http.post('/maintenance/feature-flags', payload));
  },
  updateFeatureFlag(id: string, payload: Partial<SaveFeatureFlagPayload>) {
    return request<FeatureFlag>(http.patch(`/maintenance/feature-flags/${id}`, payload));
  },
  listAppVersions(params: MaintenanceVersionQuery) {
    return request<PageResult<AppVersion>>(http.get('/maintenance/app-versions', { params }));
  },
  createAppVersion(payload: SaveAppVersionPayload) {
    return request<AppVersion>(http.post('/maintenance/app-versions', payload));
  },
  listChangelogs(params: MaintenanceVersionQuery) {
    return request<PageResult<AppVersion>>(http.get('/maintenance/changelogs', { params }));
  },
  getMenuConfig() {
    return request<SystemParameter>(http.get('/maintenance/menu-config'));
  },
  saveMenuConfig(payload: SaveMaintenanceParameterPayload) {
    return request<SystemParameter>(http.patch('/maintenance/menu-config', payload));
  },
  getThemeConfig() {
    return request<SystemParameter>(http.get('/maintenance/theme-config'));
  },
  saveThemeConfig(payload: SaveMaintenanceParameterPayload) {
    return request<SystemParameter>(http.patch('/maintenance/theme-config', payload));
  },
  listSystemParameters(params: MaintenanceParameterQuery) {
    return request<PageResult<SystemParameter>>(
      http.get('/maintenance/system-parameters', { params })
    );
  },
  createSystemParameter(payload: SaveMaintenanceParameterPayload) {
    return request<SystemParameter>(http.post('/maintenance/system-parameters', payload));
  },
  updateSystemParameter(id: string, payload: Partial<SaveMaintenanceParameterPayload>) {
    return request<SystemParameter>(http.patch(`/maintenance/system-parameters/${id}`, payload));
  }
};

export const attachmentsApi = {
  list(params: AttachmentQuery) {
    return request<PageResult<Attachment>>(http.get('/attachments', { params }));
  },
  upload(file: File, payload: UploadAttachmentPayload = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(payload).forEach(([key, value]) => {
      if (value) {
        formData.append(key, value);
      }
    });

    return request<Attachment>(
      http.post('/attachments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    );
  },
  download(id: string) {
    return http.get<Blob>(`/attachments/${id}/download`, {
      responseType: 'blob'
    });
  }
};

export const appleAccountsApi = {
  list(params: AppleAccountQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<AppleAccount>>(
      http.get('/apple/accounts', { params, signal: options.signal })
    );
  },
  ownershipReport() {
    return request<AppleAccountOwnershipReport>(http.get('/apple/accounts/ownership-report'));
  },
  get(id: string) {
    return request<AppleAccount>(http.get(`/apple/accounts/${id}`));
  },
  create(payload: SaveAppleAccountPayload) {
    return request<AppleAccount>(http.post('/apple/accounts', payload));
  },
  update(id: string, payload: SaveAppleAccountPayload) {
    return request<AppleAccount>(http.patch(`/apple/accounts/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/apple/accounts/${id}`));
  },
  importAccounts(payload: ImportAppleAccountsPayload) {
    return request<AppleAccountImportResult>(http.post('/apple/accounts/import', payload));
  },
  revealSecret(id: string, payload: RevealAppleAccountSecretPayload) {
    return request<RevealedAppleAccountSecret>(
      http.post(`/apple/accounts/${id}/reveal-secret`, payload)
    );
  },
  listTopups(accountId: string, params: Pick<CommonPageQuery, 'page' | 'pageSize'>) {
    return request<PageResult<AppleBalanceTopup>>(
      http.get(`/apple/accounts/${accountId}/topups`, { params })
    );
  },
  createTopup(accountId: string, payload: CreateAppleBalanceTopupPayload) {
    return request<AppleBalanceTopup>(http.post(`/apple/accounts/${accountId}/topups`, payload));
  },
  revealGiftCardCode(topupId: string, payload: RevealGiftCardCodePayload) {
    return request<RevealedGiftCardCode>(
      http.post(`/apple/topups/${topupId}/reveal-gift-card-code`, payload)
    );
  },
  listConsumptions(accountId: string, params: Pick<CommonPageQuery, 'page' | 'pageSize'>) {
    return request<PageResult<AppleBalanceConsumption>>(
      http.get(`/apple/accounts/${accountId}/consumptions`, { params })
    );
  },
  createConsumption(accountId: string, payload: CreateAppleBalanceConsumptionPayload) {
    return request<AppleBalanceConsumption>(
      http.post(`/apple/accounts/${accountId}/consumptions`, payload)
    );
  },
  listBalanceAdjustments(accountId: string, params: Pick<CommonPageQuery, 'page' | 'pageSize'>) {
    return request<PageResult<AppleBalanceAdjustment>>(
      http.get(`/apple/accounts/${accountId}/balance-adjustments`, { params })
    );
  },
  createBalanceAdjustment(accountId: string, payload: CreateAppleBalanceAdjustmentPayload) {
    return request<AppleBalanceAdjustment>(
      http.post(`/apple/accounts/${accountId}/balance-adjustments`, payload)
    );
  },
  listStatusChecks(accountId: string, params: Pick<CommonPageQuery, 'page' | 'pageSize'>) {
    return request<PageResult<AppleAccountStatusCheck>>(
      http.get(`/apple/accounts/${accountId}/status-checks`, { params })
    );
  },
  createStatusCheck(accountId: string, payload: CreateAppleAccountStatusCheckPayload) {
    return request<AppleAccountStatusCheck>(
      http.post(`/apple/accounts/${accountId}/status-checks`, payload)
    );
  }
};

export const appleServicesApi = {
  list(params: AppleServiceQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<AppleService>>(
      http.get('/apple/services', { params, signal: options.signal })
    );
  },
  getBalancePriceRule() {
    return request<AppleBalancePriceRule>(http.get('/apple/services/balance-price-rule'));
  },
  updateBalancePriceRule(payload: AppleBalancePriceRule) {
    return request<AppleBalancePriceRule>(
      http.patch('/apple/services/balance-price-rule', payload)
    );
  },
  create(payload: SaveAppleServicePayload) {
    return request<AppleService>(http.post('/apple/services', payload));
  },
  update(id: string, payload: UpdateAppleServicePayload) {
    return request<AppleService>(http.patch(`/apple/services/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/apple/services/${id}`));
  },
  listPlatformMappings(serviceId: string) {
    return request<{ items: AppleServicePlatformMapping[] }>(
      http.get(`/apple/services/${serviceId}/platform-mappings`)
    );
  },
  createPlatformMapping(serviceId: string, payload: SaveAppleServicePlatformMappingPayload) {
    return request<AppleServicePlatformMapping>(
      http.post(`/apple/services/${serviceId}/platform-mappings`, payload)
    );
  },
  updatePlatformMapping(id: string, payload: SaveAppleServicePlatformMappingPayload) {
    return request<AppleServicePlatformMapping>(
      http.patch(`/apple/service-platform-mappings/${id}`, payload)
    );
  },
  removePlatformMapping(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/apple/service-platform-mappings/${id}`));
  }
};

export const appleOfficialPricesApi = {
  listProviders() {
    return request<AppleOfficialPriceProviderCatalog>(http.get('/apple/official-prices/providers'));
  },
  listSources(params: AppleOfficialPriceSourceQuery) {
    return request<PageResult<AppleOfficialPriceSource>>(
      http.get('/apple/official-prices/sources', { params })
    );
  },
  createSource(payload: SaveAppleOfficialPriceSourcePayload) {
    return request<AppleOfficialPriceSource>(http.post('/apple/official-prices/sources', payload));
  },
  updateSource(id: string, payload: Partial<SaveAppleOfficialPriceSourcePayload>) {
    return request<AppleOfficialPriceSource>(
      http.patch(`/apple/official-prices/sources/${id}`, payload)
    );
  },
  removeSource(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/apple/official-prices/sources/${id}`));
  },
  checkSource(id: string, payload: CheckOfficialPriceSourcePayload = {}) {
    return request<{
      status: 'checked' | 'manual_required';
      taskId: string;
      source: AppleOfficialPriceSource;
      snapshotCount: number;
      reviewCount: number;
      pendingReviewCount?: number;
      message: string;
    }>(http.post(`/apple/official-prices/sources/${id}/check`, payload));
  },
  checkProvider(provider: string, payload: CheckOfficialPriceProviderPayload = {}) {
    return request<CheckOfficialPriceProviderResult>(
      http.post(`/apple/official-prices/providers/${provider}/check`, payload)
    );
  },
  checkAllProviders(payload: CheckOfficialPriceProviderPayload = {}) {
    return request<CheckOfficialPriceProviderResult>(
      http.post('/apple/official-prices/providers/check-all', payload)
    );
  },
  startProviderCheckBatch(provider: string, payload: CheckOfficialPriceProviderPayload = {}) {
    return request<StartOfficialPriceCheckBatchResult>(
      http.post(`/apple/official-prices/providers/${provider}/check-batch`, payload)
    );
  },
  startAllProvidersCheckBatch(payload: CheckOfficialPriceProviderPayload = {}) {
    return request<StartOfficialPriceCheckBatchResult>(
      http.post('/apple/official-prices/providers/check-all-batch', payload)
    );
  },
  getLatestCheckBatch() {
    return request<AppleOfficialPriceCheckBatch | null>(
      http.get('/apple/official-prices/check-batches/latest')
    );
  },
  getCheckBatch(id: string) {
    return request<AppleOfficialPriceCheckBatch>(
      http.get(`/apple/official-prices/check-batches/${id}`)
    );
  },
  listSnapshots(params: AppleOfficialPriceSnapshotQuery) {
    return request<PageResult<AppleOfficialPriceSnapshot>>(
      http.get('/apple/official-prices/snapshots', { params })
    );
  },
  listReviews(params: ApplePriceChangeReviewQuery) {
    return request<PageResult<ApplePriceChangeReview>>(
      http.get('/apple/official-prices/reviews', { params })
    );
  },
  approveReview(id: string) {
    return request<ApplePriceChangeReview>(
      http.post(`/apple/official-prices/reviews/${id}/approve`)
    );
  },
  ignoreReview(id: string, remark?: string | null) {
    return request<ApplePriceChangeReview>(
      http.post(`/apple/official-prices/reviews/${id}/ignore`, { remark })
    );
  }
};

export const codeServicesApi = {
  list(params: CodeServiceQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<CodeService>>(
      http.get('/codes/services', { params, signal: options.signal })
    );
  },
  get(id: string) {
    return request<CodeService>(http.get(`/codes/services/${id}`));
  },
  create(payload: SaveCodeServicePayload) {
    return request<CodeService>(http.post('/codes/services', payload));
  },
  update(id: string, payload: SaveCodeServicePayload) {
    return request<CodeService>(http.patch(`/codes/services/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/codes/services/${id}`));
  },
  listPlatformMappings(params: CodePlatformMappingQuery) {
    return request<PageResult<CodePlatformMapping>>(
      http.get('/codes/platform-mappings', { params })
    );
  },
  createPlatformMapping(payload: SaveCodePlatformMappingPayload) {
    return request<CodePlatformMapping>(http.post('/codes/platform-mappings', payload));
  },
  updatePlatformMapping(id: string, payload: SaveCodePlatformMappingPayload) {
    return request<CodePlatformMapping>(http.patch(`/codes/platform-mappings/${id}`, payload));
  },
  removePlatformMapping(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/codes/platform-mappings/${id}`));
  }
};

export const redeemCodesApi = {
  listBatches(params: RedeemCodeBatchQuery) {
    return request<PageResult<RedeemCodeBatch>>(http.get('/codes/batches', { params }));
  },
  importBatch(payload: ImportRedeemCodesPayload) {
    return request<RedeemCodeImportResult>(http.post('/codes/batches/import', payload));
  },
  listInventory(params: RedeemCodeInventoryQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<RedeemCodeInventoryItem>>(
      http.get('/codes/inventory', { params, signal: options.signal })
    );
  },
  getInventoryItem(id: string) {
    return request<RedeemCodeInventoryItem>(http.get(`/codes/inventory/${id}`));
  },
  reveal(id: string, payload: RevealRedeemCodePayload) {
    return request<RevealedRedeemCode>(http.post(`/codes/inventory/${id}/reveal`, payload));
  }
};

export const codeOrdersApi = {
  list(params: CodeOrderQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<CodePlatformOrder>>(
      http.get('/codes/orders', { params, signal: options.signal })
    );
  },
  get(id: string) {
    return request<CodePlatformOrder>(http.get(`/codes/orders/${id}`));
  },
  createManual(payload: CreateManualCodeOrderPayload) {
    return request<CodePlatformOrder>(http.post('/codes/orders/manual', payload));
  },
  matchCode(id: string) {
    return request<CodePlatformOrder>(http.post(`/codes/orders/${id}/match-code`));
  },
  generateDeliveryContent(id: string, payload: GenerateDeliveryContentPayload) {
    return request<GeneratedDeliveryContent>(
      http.post(`/codes/orders/${id}/generate-delivery-content`, payload)
    );
  },
  confirmDelivery(id: string, payload: ConfirmCodeDeliveryPayload) {
    return request<CodePlatformOrder>(http.post(`/codes/orders/${id}/deliver`, payload));
  },
  markManual(id: string, payload: MarkCodeOrderManualPayload) {
    return request<CodePlatformOrder>(http.post(`/codes/orders/${id}/mark-manual`, payload));
  },
  listOrderDeliveryLogs(id: string) {
    return request<{ items: CodeDeliveryLog[] }>(http.get(`/codes/orders/${id}/delivery-logs`));
  },
  listDeliveryLogs(params: CodeDeliveryLogQuery) {
    return request<PageResult<CodeDeliveryLog>>(http.get('/codes/deliveries', { params }));
  },
  getDeliveryLog(id: string) {
    return request<CodeDeliveryLog>(http.get(`/codes/deliveries/${id}`));
  }
};

export const platformDeliveryApi = {
  syncOrders(platform: 'taobao' | 'xianyu') {
    return request<PlatformSyncResult>(http.post(`/platforms/${platform}/sync-orders`));
  },
  getOrder(platform: 'taobao' | 'xianyu', externalOrderNo: string) {
    return request<CodePlatformOrder>(http.get(`/platforms/${platform}/orders/${externalOrderNo}`));
  },
  deliver(platform: 'taobao' | 'xianyu', id: string, payload: PlatformDeliverPayload = {}) {
    return request<PlatformDeliverResult>(
      http.post(`/platforms/${platform}/orders/${id}/deliver`, payload)
    );
  },
  syncRefunds(platform: 'taobao' | 'xianyu') {
    return request<PlatformSyncResult>(http.post(`/platforms/${platform}/sync-refunds`));
  },
  deliverManual(id: string, payload: PlatformDeliverPayload) {
    return request<PlatformDeliverResult>(
      http.post(`/platforms/manual/orders/${id}/deliver`, payload)
    );
  }
};

export const codeAfterSalesApi = {
  list(params: CodeAfterSaleQuery) {
    return request<PageResult<CodeAfterSale>>(http.get('/codes/after-sales', { params }));
  },
  get(id: string) {
    return request<CodeAfterSale>(http.get(`/codes/after-sales/${id}`));
  },
  create(payload: CreateCodeAfterSalePayload) {
    return request<CodeAfterSale>(http.post('/codes/after-sales', payload));
  },
  reissue(id: string, payload: ReissueCodeAfterSalePayload) {
    return request<ReissueCodeAfterSaleResult>(
      http.post(`/codes/after-sales/${id}/reissue`, payload)
    );
  },
  complete(id: string) {
    return request<CodeAfterSale>(http.post(`/codes/after-sales/${id}/complete`));
  }
};

export const codeReportsApi = {
  profit(params: CodeProfitReportQuery) {
    return request<CodeProfitReport>(http.get('/codes/reports/profit', { params }));
  },
  platformProfit(params: CodeProfitReportQuery) {
    return request<CodeProfitReport>(http.get('/codes/reports/platform-profit', { params }));
  }
};

export const appleOrdersApi = {
  list(params: AppleOrderQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<AppleOrder>>(
      http.get('/apple/orders', { params, signal: options.signal })
    );
  },
  entryContext(params: { customerId: string; serviceId?: string; serviceAccount?: string }) {
    return request<AppleOrderEntryContext>(http.get('/apple/orders/entry-context', { params }));
  },
  get(id: string) {
    return request<AppleOrder>(http.get(`/apple/orders/${id}`));
  },
  create(payload: CreateAppleOrderPayload) {
    return request<AppleOrder>(http.post('/apple/orders', payload));
  },
  update(id: string, payload: UpdateAppleOrderPayload) {
    return request<AppleOrder>(http.patch(`/apple/orders/${id}`, payload));
  },
  remove(id: string) {
    return request<{ deleted: boolean }>(http.delete(`/apple/orders/${id}`));
  }
};

export const appleMatchingApi = {
  listAvailableAccounts(params: AvailableAppleAccountQuery) {
    return request<{ items: AvailableAppleAccount[] }>(
      http.get('/apple/matching/available-accounts', { params })
    );
  }
};

export const appleActivationsApi = {
  list(params: ServiceActivationQuery) {
    return request<PageResult<ServiceActivation>>(http.get('/apple/activations', { params }));
  },
  get(id: string) {
    return request<ServiceActivation>(http.get(`/apple/activations/${id}`));
  }
};

export const appleRenewalTasksApi = {
  list(params: RenewalTaskQuery, options: ApiRequestOptions = {}) {
    return request<PageResult<RenewalTask>>(
      http.get('/apple/renewal-tasks', { params, signal: options.signal })
    );
  },
  get(id: string) {
    return request<RenewalTask>(http.get(`/apple/renewal-tasks/${id}`));
  },
  create(payload: CreateRenewalTaskPayload) {
    return request<RenewalTask>(http.post('/apple/renewal-tasks', payload));
  },
  update(id: string, payload: UpdateRenewalTaskPayload) {
    return request<RenewalTask>(http.patch(`/apple/renewal-tasks/${id}`, payload));
  },
  complete(id: string, payload: CompleteRenewalTaskPayload) {
    return request<RenewalTask>(http.post(`/apple/renewal-tasks/${id}/complete`, payload));
  },
  cancel(id: string, payload: CancelRenewalTaskPayload) {
    return request<RenewalTask>(http.post(`/apple/renewal-tasks/${id}/cancel`, payload));
  },
  postpone(id: string, payload: PostponeRenewalTaskPayload) {
    return request<RenewalTask>(http.post(`/apple/renewal-tasks/${id}/postpone`, payload));
  },
  generateDueTasks(payload: GenerateRenewalTasksPayload) {
    return request<{
      scannedActivations: number;
      createdCount: number;
      updatedCount: number;
      daysAhead: number;
      rangeEnd: string;
    }>(http.post('/apple/renewal-tasks/generate-due-tasks', payload));
  }
};

export const appleActionPlansApi = {
  list(params: AppleActionPlanQuery) {
    return request<PageResult<AppleActionPlan>>(http.get('/apple/action-plans', { params }));
  },
  get(id: string) {
    return request<AppleActionPlan>(http.get(`/apple/action-plans/${id}`));
  },
  listItems(id: string) {
    return request<{ items: AppleActionPlanItem[] }>(http.get(`/apple/action-plans/${id}/items`));
  },
  generate(payload: GenerateActionPlansPayload) {
    return request<{
      scannedActivations: number;
      accountCount: number;
      createdCount: number;
      updatedCount: number;
      itemCount: number;
      daysAhead: number;
      planDate: string;
      rangeEnd: string;
    }>(http.post('/apple/action-plans/generate', payload));
  },
  complete(id: string, payload: CompleteActionPlanPayload) {
    return request<AppleActionPlan>(http.post(`/apple/action-plans/${id}/complete`, payload));
  }
};

export const appleAutomationTasksApi = {
  list(params: AppleAutomationTaskQuery) {
    return request<PageResult<AppleAutomationTask>>(
      http.get('/apple/automation-tasks', { params })
    );
  },
  get(id: string) {
    return request<AppleAutomationTask>(http.get(`/apple/automation-tasks/${id}`));
  },
  create(payload: CreateAppleAutomationTaskPayload) {
    return request<AppleAutomationTask>(http.post('/apple/automation-tasks', payload));
  },
  batchStatusCheck(payload: BatchAppleStatusCheckPayload) {
    return request<BatchAppleStatusCheckResult>(
      http.post('/apple/automation-tasks/batch-status-check', payload)
    );
  },
  listLogs(id: string) {
    return request<{ items: NonNullable<AppleAutomationTask['logs']> }>(
      http.get(`/apple/automation-tasks/${id}/logs`)
    );
  },
  webCheckGateways(id: string) {
    return request<AppleWebCheckGatewayContext>(
      http.get(`/apple/automation-tasks/${id}/web-check-gateways`)
    );
  },
  recordWebCheckGatewayAttempt(id: string, payload: AppleWebCheckGatewayAttemptPayload) {
    return request<AppleWebCheckGatewayAttemptResult>(
      http.post(`/apple/automation-tasks/${id}/web-check-gateway-attempt`, payload)
    );
  },
  runPlaceholder(id: string) {
    return request<AppleAutomationTask>(http.post(`/apple/automation-tasks/${id}/run-placeholder`));
  },
  cancel(id: string) {
    return request<AppleAutomationTask>(http.post(`/apple/automation-tasks/${id}/cancel`));
  },
  retry(id: string) {
    return request<AppleAutomationTask>(http.post(`/apple/automation-tasks/${id}/retry`));
  },
  markManual(id: string, payload: MarkAppleAutomationTaskManualPayload) {
    return request<AppleAutomationTask>(
      http.post(`/apple/automation-tasks/${id}/mark-manual`, payload)
    );
  },
  writeResult(id: string, payload: WriteAppleAutomationTaskResultPayload) {
    return request<AppleAutomationTask>(http.post(`/apple/automation-tasks/${id}/result`, payload));
  }
};

export const appleReportsApi = {
  profit(params: AppleProfitReportQuery) {
    return request<AppleProfitReport>(http.get('/apple/reports/profit', { params }));
  }
};
