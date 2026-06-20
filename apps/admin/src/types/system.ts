export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  rolePermissions?: Array<{
    permission: Permission;
  }>;
  _count?: {
    userRoles: number;
  };
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  action: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  status: 'active' | 'disabled';
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Role[];
  roleIds: string[];
}

export interface AuditLog {
  id: string;
  module: string;
  action: string;
  objectType?: string | null;
  objectId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  remark?: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}

export interface SourcePlatform {
  id: string;
  name: string;
  code: string;
  type: 'taobao' | 'xianyu' | 'wechat' | 'manual' | 'other';
  feeRate: string;
  feeFixed: string;
  syncEnabled: boolean;
  deliveryEnabled: boolean;
  status: 'active' | 'disabled';
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  contactName?: string | null;
  maskedPhone?: string | null;
  phoneTail?: string | null;
  wechat?: string | null;
  sourcePlatformId?: string | null;
  sourcePlatform?: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'> | null;
  tags: string[];
  remark?: string | null;
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface RevealedCustomerPhone {
  customerId: string;
  phone: string;
  revealedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: 'renewal' | 'delivery' | 'after_sale' | 'notification' | 'custom';
  channel: 'internal' | 'telegram' | 'customer_service';
  content: string;
  variables: string[];
  status: 'active' | 'disabled';
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationLevel = 'info' | 'warning' | 'error' | 'critical';
export type NotificationLogStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type TelegramTestStatus = 'not_tested' | 'success' | 'failed';

export interface NotificationRule {
  id: string;
  name: string;
  eventCode: string;
  module: string;
  level: NotificationLevel;
  enabled: boolean;
  channels: Array<'telegram' | 'system'>;
  recipients?: Record<string, unknown> | null;
  triggerCondition?: Record<string, unknown> | null;
  rateLimit?: Record<string, unknown> | null;
  lastTriggeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  templates?: NotificationTemplate[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  eventCode: string;
  ruleId?: string | null;
  channel: 'telegram' | 'system';
  title: string;
  content: string;
  variables: Array<string | Record<string, unknown>>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  rule?: Pick<
    NotificationRule,
    'id' | 'name' | 'eventCode' | 'module' | 'level' | 'enabled'
  > | null;
}

export interface NotificationLog {
  id: string;
  ruleId?: string | null;
  eventCode: string;
  module: string;
  channel: 'telegram' | 'system';
  recipient?: string | null;
  recipientUserId?: string | null;
  title: string;
  contentDigest: string;
  payload?: Record<string, unknown> | null;
  status: NotificationLogStatus;
  errorMessage?: string | null;
  retryCount: number;
  triggeredAt: string;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NavigationNotificationBadge {
  sectionKey: string;
  label: string;
  count: number;
  todoCount: number;
  failedCount: number;
}

export interface NavigationNotificationBadges {
  totalCount: number;
  todoCount: number;
  failedCount: number;
  items: NavigationNotificationBadge[];
  generatedAt: string;
}

export type NavigationItemBadgeTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'cyan'
  | 'neutral';

export interface NavigationItemBadge {
  itemKey: string;
  label: string;
  count: number;
  tone: NavigationItemBadgeTone;
  description: string;
}

export interface NavigationItemBadges {
  totalCount: number;
  items: NavigationItemBadge[];
  generatedAt: string;
}

export interface TelegramConfig {
  id: string;
  notificationName: string;
  enabled: boolean;
  hasBotToken: boolean;
  botTokenTail?: string | null;
  chatId: string;
  notificationLevel: NotificationLevel;
  silentStartTime?: string | null;
  silentEndTime?: string | null;
  retryCount: number;
  lastTestStatus: TelegramTestStatus;
  lastTestError?: string | null;
  lastTestAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationOverview {
  enabledRuleCount: number;
  failedLogCount: number;
  unreadCount: number;
  telegramCount: number;
  recentLogs: NotificationLog[];
}

export type LoginLogStatus = 'success' | 'failed' | 'blocked';
export type IpWhitelistScope = 'admin' | 'api' | 'automation';
export type SensitiveAccessApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface SecurityUserSnapshot {
  id: string;
  username: string;
  displayName: string;
}

export interface LoginLog {
  id: string;
  userId?: string | null;
  user?: SecurityUserSnapshot | null;
  username: string;
  status: LoginLogStatus;
  failureReason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  location?: string | null;
  abnormal: boolean;
  createdAt: string;
}

export interface ActiveSession {
  id: string;
  userId: string;
  user: SecurityUserSnapshot;
  ip?: string | null;
  userAgent?: string | null;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
}

export interface SecuritySetting {
  id?: string | null;
  key: string;
  value: Record<string, unknown>;
  remark?: string | null;
  updatedByUserId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MyMfaStatus {
  enabled: boolean;
  configured: boolean;
  recoveryCodeCount: number;
  enabledAt?: string | null;
  lastUsedAt?: string | null;
  disabledAt?: string | null;
}

export interface MyMfaSetup extends MyMfaStatus {
  secret: string;
  otpauthUrl: string;
}

export interface MyMfaEnableResult extends MyMfaStatus {
  recoveryCodes: string[];
}

export interface IpWhitelist {
  id: string;
  ipOrCidr: string;
  scope: IpWhitelistScope;
  enabled: boolean;
  remark?: string | null;
  createdByUserId?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface SensitiveAccessLog {
  id: string;
  userId?: string | null;
  user?: SecurityUserSnapshot | null;
  module: string;
  fieldName: string;
  objectType: string;
  objectId?: string | null;
  accessReason?: string | null;
  approved: boolean;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface SensitiveAccessApproval {
  id: string;
  requesterId: string;
  requester: SecurityUserSnapshot;
  approverId?: string | null;
  approver?: SecurityUserSnapshot | null;
  module: string;
  fieldName: string;
  objectType: string;
  objectId?: string | null;
  reason: string;
  status: SensitiveAccessApprovalStatus;
  decisionNote?: string | null;
  approvedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityOverview {
  failedLoginCount: number;
  abnormalLoginCount: number;
  activeSessionCount: number;
  pendingApprovalCount: number;
  enabledWhitelistCount: number;
  recentLoginLogs: LoginLog[];
}

export type DataJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type BackupJobType = 'database' | 'files' | 'config';
export type DataDictionaryStatus = 'active' | 'disabled';

export interface BackupJob {
  id: string;
  jobType: BackupJobType;
  status: DataJobStatus;
  storagePath?: string | null;
  fileSize?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  remark?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
}

export interface RestoreJob {
  id: string;
  backupJobId?: string | null;
  backupJob?: Pick<BackupJob, 'id' | 'jobType' | 'status' | 'storagePath' | 'createdAt'> | null;
  status: DataJobStatus;
  restoreScope: string;
  approvalNote?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
}

export interface DataImportJob {
  id: string;
  module: string;
  filePath?: string | null;
  status: DataJobStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  errorReport?: string | null;
  remark?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
  finishedAt?: string | null;
}

export interface DataExportJob {
  id: string;
  module: string;
  exportScope?: Record<string, unknown> | null;
  fields: string[];
  containsSensitive: boolean;
  status: DataJobStatus;
  filePath?: string | null;
  downloadExpiresAt?: string | null;
  errorMessage?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
  finishedAt?: string | null;
}

export interface RecycleBinRecord {
  id: string;
  module: string;
  objectType: string;
  objectId?: string | null;
  objectLabel: string;
  snapshotData?: Record<string, unknown> | null;
  deletedById?: string | null;
  deletedBy?: SecurityUserSnapshot | null;
  deletedAt: string;
  restoredById?: string | null;
  restoredBy?: SecurityUserSnapshot | null;
  restoredAt?: string | null;
}

export interface DataCleanupJob {
  id: string;
  module: string;
  cleanupScope?: Record<string, unknown> | null;
  status: DataJobStatus;
  affectedCount: number;
  approvalNote?: string | null;
  errorMessage?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
  finishedAt?: string | null;
}

export interface DuplicateMergeJob {
  id: string;
  module: string;
  matchRule?: Record<string, unknown> | null;
  primaryObjectId?: string | null;
  duplicateObjectIds: string[];
  status: DataJobStatus;
  affectedCount: number;
  approvalNote?: string | null;
  errorMessage?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
  finishedAt?: string | null;
}

export interface DataDictionary {
  id: string;
  group: string;
  code: string;
  label: string;
  value?: string | null;
  sortOrder: number;
  status: DataDictionaryStatus;
  remark?: string | null;
  createdByUserId?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  updatedByUserId?: string | null;
  updatedBy?: SecurityUserSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemParameter {
  id: string | null;
  key: string;
  value: Record<string, unknown>;
  group: string;
  remark?: string | null;
  updatedByUserId?: string | null;
  updatedBy?: SecurityUserSnapshot | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DataCenterOverview {
  failedBackupCount: number;
  runningImportCount: number;
  runningExportCount: number;
  recycleBinCount: number;
  dictionaryCount: number;
  recentBackupJobs: BackupJob[];
  recentImportJobs: DataImportJob[];
  recentExportJobs: DataExportJob[];
}

export type OpsHealthStatus = 'normal' | 'warning' | 'error' | 'critical' | 'unknown';
export type CronJobLogStatus = 'running' | 'success' | 'failed' | 'skipped';
export type PlatformSyncLogStatus = 'success' | 'failed';
export type ErrorLogLevel = 'info' | 'warn' | 'error' | 'fatal';

export interface OpsComponentStatus {
  name: string;
  status: OpsHealthStatus;
  latencyMs?: number | null;
  message: string;
  checkedAt: string;
  metrics?: Record<string, unknown>;
}

export interface OpsQueueCurrent {
  queueName: string;
  waitingCount: number;
  activeCount: number;
  failedCount: number;
  delayedCount: number;
  status: OpsHealthStatus;
  checkedAt: string;
}

export interface QueueStatusLog {
  id: string;
  queueName: string;
  waitingCount: number;
  activeCount: number;
  failedCount: number;
  delayedCount: number;
  status: OpsHealthStatus;
  checkedAt: string;
}

export interface CronJobLog {
  id: string;
  jobName: string;
  status: CronJobLogStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PlatformCurrentStatus {
  platform: string;
  status: OpsHealthStatus;
  syncType?: string | null;
  lastCheckedAt?: string | null;
  requestCount: number;
  failedRequestCount?: number;
  failureLogCount?: number;
  lastFailureAt?: string | null;
  retryLogCount?: number;
  lastRetryAt?: string | null;
  errorRate: string;
  errorMessage?: string | null;
}

export interface PlatformSyncLog {
  id: string;
  platform: string;
  syncType: string;
  status: PlatformSyncLogStatus;
  requestCount: number;
  errorRate: string;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type PlatformAuthorizationStatus =
  | 'configured'
  | 'expiring'
  | 'expired'
  | 'not_configured'
  | 'not_required'
  | 'unknown';

export interface PlatformInterfaceStatus {
  platform: string;
  displayName: string;
  status: OpsHealthStatus;
  authorizationStatus: PlatformAuthorizationStatus;
  tokenExpiresAt?: string | null;
  lastSyncAt?: string | null;
  lastFailureReason?: string | null;
  requestCount: number;
  failedRequestCount: number;
  failureLogCount: number;
  lastFailureAt?: string | null;
  retryLogCount: number;
  lastRetryAt?: string | null;
  errorRate: string;
  canReauthorize: boolean;
  canTestConnection: boolean;
  latestLog?: PlatformSyncLog | null;
  message: string;
}

export type PlatformAuthMode = 'oauth' | 'manual_token' | 'app_credentials';

export interface PlatformAuthorizationConfig {
  platform: string;
  displayName: string;
  configured: boolean;
  authMode: PlatformAuthMode;
  hasAppKey: boolean;
  appKeyTail?: string | null;
  hasAppSecret: boolean;
  hasAccessToken: boolean;
  accessTokenTail?: string | null;
  hasRefreshToken: boolean;
  refreshTokenTail?: string | null;
  tokenExpiresAt?: string | null;
  shopName?: string | null;
  scopes: string[];
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  redirectUri?: string | null;
  clientIdParam: string;
  updatedAt?: string | null;
}

export interface SavePlatformAuthorizationPayload {
  authMode?: PlatformAuthMode;
  appKey?: string | null;
  appSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  shopName?: string | null;
  scopes?: string[];
  authorizationUrl?: string | null;
  tokenUrl?: string | null;
  redirectUri?: string | null;
  clientIdParam?: string | null;
  clearSecrets?: boolean;
}

export interface StartPlatformOAuthPayload {
  authorizationUrl?: string | null;
  redirectUri?: string | null;
  scopes?: string[];
  clientIdParam?: string | null;
}

export interface PlatformOAuthStartResult {
  platform: string;
  displayName: string;
  authorizationUrl: string;
  redirectUri: string;
  stateExpiresAt: string;
}

export interface ErrorLog {
  id: string;
  level: ErrorLogLevel;
  module: string;
  message: string;
  stack?: string | null;
  context?: Record<string, unknown> | null;
  occurredAt: string;
}

export interface SystemHealthSnapshot {
  id: string;
  apiStatus: OpsHealthStatus;
  dbStatus: OpsHealthStatus;
  redisStatus: OpsHealthStatus;
  storageStatus: OpsHealthStatus;
  queueStatus: OpsHealthStatus;
  workerStatus: OpsHealthStatus;
  diskUsage?: string | null;
  metrics?: Record<string, unknown> | null;
  checkedAt: string;
}

export interface OpsOverview {
  components: OpsComponentStatus[];
  queue: OpsQueueCurrent;
  workers: OpsComponentStatus;
  cronJobs: CronJobLog[];
  platformSync: PlatformCurrentStatus[];
  recentErrors: ErrorLog[];
}

export type AppAnnouncementLevel = 'info' | 'warning' | 'error';
export type AppVersionStatus = 'draft' | 'released' | 'deprecated';

export interface AppAnnouncement {
  id: string;
  title: string;
  content: string;
  level: AppAnnouncementLevel;
  enabled: boolean;
  startAt?: string | null;
  endAt?: string | null;
  createdById?: string | null;
  updatedByUserId?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  updatedBy?: SecurityUserSnapshot | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface MaintenanceWindow {
  id?: string | null;
  enabled: boolean;
  reason: string;
  allowedRoles: string[];
  allowedIps: string[];
  startAt?: string | null;
  endAt?: string | null;
  createdById?: string | null;
  updatedByUserId?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  updatedBy?: SecurityUserSnapshot | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  config?: Record<string, unknown> | null;
  remark?: string | null;
  updatedByUserId?: string | null;
  updatedBy?: SecurityUserSnapshot | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AppVersion {
  id: string;
  version: string;
  title: string;
  status: AppVersionStatus;
  releaseNotes: string;
  impactModules: string[];
  releasedAt?: string | null;
  createdById?: string | null;
  createdBy?: SecurityUserSnapshot | null;
  createdAt: string;
}

export interface MaintenanceOverview {
  enabledAnnouncementCount: number;
  maintenanceModeEnabled: boolean;
  activeMaintenanceWindow: MaintenanceWindow;
  enabledFeatureFlagCount: number;
  latestVersion?: AppVersion | null;
  recentAnnouncements: AppAnnouncement[];
  recentVersions: AppVersion[];
}

export type LaunchChecklistStatus = 'pending' | 'in_progress' | 'passed' | 'blocked' | 'waived';
export type LaunchChecklistPriority = 'P0' | 'P1' | 'P2';

export interface LaunchChecklistItem {
  id: string;
  category: string;
  title: string;
  priority: LaunchChecklistPriority;
  status: LaunchChecklistStatus;
  owner?: string | null;
  evidence?: string | null;
  remark?: string | null;
  updatedAt?: string | null;
}

export interface LaunchChecklist {
  items: LaunchChecklistItem[];
  updatedAt?: string | null;
  updatedBy?: SecurityUserSnapshot | null;
}

export interface Attachment {
  id: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: string;
  businessModule?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  purpose?: string | null;
  remark?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}

export interface AppleAccount {
  id: string;
  appleIdMasked: string;
  appleIdTail: string;
  region: string;
  currency: string;
  currentBalance: string;
  balanceCostAmount: string;
  averageCost: string;
  status: 'normal' | 'need_verify' | 'locked' | 'password_error' | 'risk' | 'unknown';
  isManuallyLocked: boolean;
  manualLockReason?: string | null;
  hasPassword: boolean;
  hasSecurityInfo: boolean;
  hasPhone: boolean;
  hasRecoveryEmail: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AppleAccountSecretField =
  | 'appleId'
  | 'password'
  | 'securityInfo'
  | 'phone'
  | 'recoveryEmail';

export interface RevealedAppleAccountSecret {
  accountId: string;
  field: AppleAccountSecretField;
  label: string;
  value: string;
  revealedAt: string;
}

export interface AppleAccountImportError {
  rowNo: number;
  appleId?: string | null;
  reason: string;
}

export interface AppleAccountImportResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  accounts: Array<AppleAccount & { rowNo?: number }>;
  errors: AppleAccountImportError[];
}

export interface AppleBalanceTopup {
  id: string;
  appleAccountId: string;
  faceValue: string;
  costAmount: string;
  balanceBefore: string;
  balanceAfter: string;
  costBefore: string;
  costAfter: string;
  avgCostBefore: string;
  avgCostAfter: string;
  hasGiftCardCode: boolean;
  giftCardCodeTail?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface RevealedGiftCardCode {
  topupId: string;
  appleAccountId: string;
  giftCardCode: string;
  giftCardCodeTail?: string | null;
  revealedAt: string;
}

export interface AppleBalanceConsumption {
  id: string;
  appleAccountId: string;
  amount: string;
  costAmount: string;
  avgUnitCost: string;
  balanceBefore: string;
  balanceAfter: string;
  costBefore: string;
  costAfter: string;
  reason?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface AppleBalanceAdjustment {
  id: string;
  appleAccountId: string;
  oldBalance: string;
  newBalance: string;
  difference: string;
  oldCostRmb: string;
  newCostRmb: string;
  costAdjustMethod: 'none' | 'current_avg' | 'manual';
  costRmbChange: string;
  reason: string;
  evidenceAttachmentId?: string | null;
  evidenceAttachment?: Pick<
    Attachment,
    'id' | 'originalName' | 'mimeType' | 'sizeBytes' | 'createdAt'
  > | null;
  operator?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  createdAt: string;
}

export interface AppleAccountStatusCheck {
  id: string;
  appleAccountId: string;
  checkType: 'manual' | 'automation';
  resultStatus: AppleAccount['status'];
  balanceSnapshot?: string | null;
  remark?: string | null;
  evidenceAttachmentId?: string | null;
  evidenceAttachment?: Pick<
    Attachment,
    'id' | 'originalName' | 'mimeType' | 'sizeBytes' | 'createdAt'
  > | null;
  operator?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  createdAt: string;
}

export interface AppleService {
  id: string;
  name: string;
  category: string;
  defaultPrice: string;
  officialCostValue: string;
  currency: string;
  defaultPeriodType: 'month' | 'day' | 'manual';
  defaultPeriodValue: number;
  expireCalcType: 'by_month' | 'by_day' | 'manual';
  requireAppleId: boolean;
  requireServiceAccount: boolean;
  autoMatchAppleId: boolean;
  lockRule: 'by_service' | 'global';
  allowedRegions: string[];
  minBalanceRequired: string;
  status: 'enabled' | 'paused' | 'disabled';
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppleServicePlatformMapping {
  id: string;
  serviceId: string;
  sourcePlatformId: string;
  sourcePlatform: Pick<
    SourcePlatform,
    'id' | 'name' | 'code' | 'type' | 'feeRate' | 'feeFixed' | 'status'
  >;
  shopName?: string | null;
  platformItemId: string;
  platformSkuId: string;
  skuKeyword?: string | null;
  platformPrice: string;
  platformFeeType: 'none' | 'rate' | 'fixed' | 'mixed';
  platformFeeValue: string;
  allowAutoOrder: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableAppleAccount {
  appleAccountId: string;
  accountMasked: string;
  region: string;
  currency: string;
  balance: string;
  balanceCostAmount: string;
  avgUnitCost: string;
  status: AppleAccount['status'];
  isManuallyLocked: boolean;
  availability: 'available' | 'unavailable' | 'need_confirm';
  reason?: string | null;
}

export interface AppleOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customer: Pick<Customer, 'id' | 'name' | 'contactName' | 'wechat'>;
  sourcePlatformId?: string | null;
  sourcePlatform?: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'> | null;
  externalOrderNo?: string | null;
  serviceId: string;
  service: Pick<AppleService, 'id' | 'name' | 'category' | 'currency' | 'officialCostValue'>;
  appleAccountId?: string | null;
  appleAccount?: {
    id: string;
    appleIdMasked: string;
    region: string;
    currency: string;
    currentBalance: string;
    averageCost: string;
  } | null;
  serviceAccount?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  startTime?: string | null;
  expireTime?: string | null;
  paidAmount: string;
  platformFee: string;
  refundLoss: string;
  appleCostValue: string;
  appleCostRmb: string;
  profitAmount: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'abnormal';
  remark?: string | null;
  activationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceActivation {
  id: string;
  orderId: string;
  order: Pick<AppleOrder, 'id' | 'orderNo' | 'status'>;
  customerId: string;
  customer: Pick<Customer, 'id' | 'name' | 'contactName' | 'wechat'>;
  appleAccountId?: string | null;
  appleAccount?: {
    id: string;
    appleIdMasked: string;
    region: string;
    currency: string;
    currentBalance: string;
    averageCost: string;
  } | null;
  serviceId: string;
  service: Pick<AppleService, 'id' | 'name' | 'category' | 'currency'>;
  currentPlan?: string | null;
  targetPlan?: string | null;
  startTime?: string | null;
  expireTime?: string | null;
  daysUntilExpire?: number | null;
  consumedValue: string;
  currency: string;
  avgUnitCost: string;
  costRmb: string;
  paidAmount: string;
  platformFee: string;
  refundLoss: string;
  profitAmount: string;
  sourcePlatformId?: string | null;
  sourcePlatform?: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'> | null;
  externalOrderNo?: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'abnormal';
  autoRenewStatus: 'enabled' | 'disabled' | 'unknown';
  renewalDecision: 'unconfirmed' | 'renew' | 'no_renew' | 'change_plan';
  renewalNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RenewalTask {
  id: string;
  taskType:
    | 'contact_customer'
    | 'remind_customer_reply'
    | 'confirm_payment'
    | 'topup_apple_balance'
    | 'check_balance'
    | 'cancel_subscription'
    | 'change_plan'
    | 'wait_auto_renewal'
    | 'check_renewal_result'
    | 'notify_customer'
    | 'handle_abnormal'
    | 'after_sale';
  title: string;
  status:
    | 'pending'
    | 'processing'
    | 'waiting_customer'
    | 'waiting_payment'
    | 'waiting_auto_renewal'
    | 'waiting_manual_verify'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'abnormal'
    | 'postponed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customerId: string;
  customer: Pick<Customer, 'id' | 'name' | 'contactName' | 'wechat'>;
  appleAccountId?: string | null;
  appleAccount?: {
    id: string;
    appleIdMasked: string;
    region: string;
    currency: string;
    currentBalance: string;
    averageCost: string;
  } | null;
  serviceId: string;
  service: Pick<AppleService, 'id' | 'name' | 'category' | 'currency' | 'officialCostValue'>;
  activationId: string;
  activation: Pick<
    ServiceActivation,
    'id' | 'expireTime' | 'status' | 'autoRenewStatus' | 'renewalDecision' | 'renewalNote'
  > & {
    daysUntilExpire?: number | null;
  };
  orderId: string;
  order: Pick<AppleOrder, 'id' | 'orderNo' | 'status'>;
  currentPlan?: string | null;
  targetPlan?: string | null;
  customerDecision:
    | 'not_contacted'
    | 'contacted_waiting_reply'
    | 'confirmed_renewal'
    | 'confirmed_no_renewal'
    | 'change_plan'
    | 'considering'
    | 'paid'
    | 'unpaid'
    | 'cancelled'
    | 'renewed_success'
    | 'abnormal';
  requiredAction?: string | null;
  currentBalance: string;
  expectedChargeAmount: string;
  suggestedTopupAmount: string;
  expectedChargeTime?: string | null;
  cancelDeadline?: string | null;
  remindAt?: string | null;
  dueAt?: string | null;
  assignedToUserId?: string | null;
  assignedTo?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  note?: string | null;
  resultNote?: string | null;
  evidenceAttachmentId?: string | null;
  evidenceAttachment?: Pick<
    Attachment,
    'id' | 'originalName' | 'mimeType' | 'sizeBytes' | 'createdAt'
  > | null;
  completedByUserId?: string | null;
  completedBy?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface AppleActionPlanItem {
  id: string;
  planId: string;
  activationId: string;
  customerId: string;
  customer: Pick<Customer, 'id' | 'name' | 'contactName' | 'wechat'>;
  serviceId: string;
  service: Pick<AppleService, 'id' | 'name' | 'category' | 'currency' | 'officialCostValue'>;
  activation: Pick<
    ServiceActivation,
    'id' | 'expireTime' | 'status' | 'autoRenewStatus' | 'renewalDecision' | 'renewalNote'
  > & {
    daysUntilExpire?: number | null;
  };
  currentPlan?: string | null;
  targetPlan?: string | null;
  expireTime?: string | null;
  customerDecision: 'unconfirmed' | 'renew' | 'no_renew' | 'change_plan';
  actionType: 'renew' | 'cancel' | 'change_plan' | 'wait_customer';
  expectedChargeAmount: string;
  cancelDeadline?: string | null;
  taskId?: string | null;
  task?: Pick<RenewalTask, 'id' | 'taskType' | 'title' | 'status' | 'priority' | 'dueAt'> | null;
  status: 'pending' | 'completed' | 'abnormal';
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppleActionPlan {
  id: string;
  appleAccountId: string;
  appleAccount: {
    id: string;
    appleIdMasked: string;
    region: string;
    currency: string;
    currentBalance: string;
    averageCost: string;
    status: AppleAccount['status'];
  };
  planDate: string;
  currentBalance: string;
  avgUnitCost: string;
  activeServiceCount: number;
  renewServicesCount: number;
  cancelServicesCount: number;
  pendingCustomerCount: number;
  requiredRenewalAmount: string;
  suggestedTopupAmount: string;
  hasWrongChargeRisk: boolean;
  status: 'pending' | 'processing' | 'completed' | 'abnormal';
  mainNote?: string | null;
  itemCount: number;
  createdBy?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  completedBy?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  items?: AppleActionPlanItem[];
}

export type AutomationTaskType =
  | 'check_status'
  | 'check_balance'
  | 'topup'
  | 'cancel_subscription'
  | 'change_phone'
  | 'change_security'
  | 'check_renewal';

export type AutomationTaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_manual_verify'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'need_review';

export type AutomationTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AutomationTaskAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
}

export interface AutomationTaskLog {
  id: string;
  taskId: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  payload?: Record<string, unknown> | null;
  screenshotAttachmentId?: string | null;
  screenshotAttachment?: AutomationTaskAttachment | null;
  task?: Pick<
    AppleAutomationTask,
    | 'id'
    | 'taskType'
    | 'status'
    | 'priority'
    | 'manualRequired'
    | 'queueJobId'
    | 'errorCode'
    | 'errorMessage'
    | 'createdAt'
  > | null;
  createdAt: string;
}

export interface AppleAutomationTask {
  id: string;
  taskType: AutomationTaskType;
  appleAccountId: string;
  appleAccount: {
    id: string;
    appleIdMasked: string;
    region: string;
    currency: string;
    currentBalance: string;
    status: AppleAccount['status'];
  };
  customerId?: string | null;
  customer?: Pick<Customer, 'id' | 'name' | 'contactName' | 'wechat'> | null;
  serviceId?: string | null;
  service?: Pick<AppleService, 'id' | 'name' | 'category' | 'currency'> | null;
  activationId?: string | null;
  activation?: Pick<
    ServiceActivation,
    'id' | 'expireTime' | 'status' | 'autoRenewStatus' | 'renewalDecision'
  > | null;
  priority: AutomationTaskPriority;
  status: AutomationTaskStatus;
  hasInputPayload: boolean;
  resultPayload?: Record<string, unknown> | null;
  screenshotAttachmentId?: string | null;
  screenshotAttachment?: AutomationTaskAttachment | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdBy?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  retryCount: number;
  manualRequired: boolean;
  queueJobId?: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: AutomationTaskLog[];
}

export interface AppleProfitSummary {
  orderCount: number;
  paidAmount: string;
  platformFee: string;
  refundLoss: string;
  appleCostRmb: string;
  profitAmount: string;
  grossMarginRate: string;
  averageOrderProfit: string;
}

export interface AppleProfitGroup extends AppleProfitSummary {
  key: string;
  label: string;
  meta?: Record<string, string | null>;
}

export interface AppleProfitRecentOrder {
  id: string;
  orderNo: string;
  status: AppleOrder['status'];
  paidAmount: string;
  platformFee: string;
  refundLoss: string;
  appleCostRmb: string;
  profitAmount: string;
  serviceName?: string | null;
  sourcePlatformName?: string | null;
  appleAccountMasked?: string | null;
  createdAt: string;
}

export interface AppleProfitReport {
  summary: AppleProfitSummary;
  daily: AppleProfitGroup[];
  byService: AppleProfitGroup[];
  bySourcePlatform: AppleProfitGroup[];
  byAppleAccount: AppleProfitGroup[];
  recentOrders: AppleProfitRecentOrder[];
}

export interface CodeService {
  id: string;
  name: string;
  faceValue: string;
  defaultPrice: string;
  defaultCost: string;
  deliveryMode: 'auto' | 'semi_auto' | 'manual';
  exactFaceValueOnly: boolean;
  allowCombination: boolean;
  status: 'enabled' | 'paused' | 'disabled';
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodePlatformMapping {
  id: string;
  platformId: string;
  platform: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type' | 'status'>;
  shopId?: string | null;
  platformItemId: string;
  platformSkuId: string;
  skuKeyword?: string | null;
  serviceId: string;
  service: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'status'>;
  faceValue: string;
  quantity: number;
  deliveryTemplateId?: string | null;
  deliveryTemplate?: Pick<MessageTemplate, 'id' | 'name' | 'type' | 'channel' | 'status'> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RedeemCodeBatch {
  id: string;
  batchNo: string;
  serviceId: string;
  service: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'>;
  faceValue: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  defaultCost: string;
  remark?: string | null;
  importedBy?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  createdAt: string;
}

export interface RedeemCodeInventoryItem {
  id: string;
  serviceId: string;
  service: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'>;
  batchId: string;
  batch: Pick<RedeemCodeBatch, 'id' | 'batchNo' | 'createdAt'>;
  codeTail: string;
  hasCode: boolean;
  faceValue: string;
  cost: string;
  status:
    | 'unsold'
    | 'locked'
    | 'delivered'
    | 'delivery_failed'
    | 'after_sale'
    | 'reissued'
    | 'voided'
    | 'refunded';
  lockedOrderId?: string | null;
  deliveredOrderId?: string | null;
  deliveredPlatformId?: string | null;
  deliveredPlatform?: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'> | null;
  deliveredAt?: string | null;
  expireAt?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RedeemCodeImportError {
  rowNo: number;
  codeTail?: string | null;
  reason: string;
}

export interface RedeemCodeImportResult {
  batch: RedeemCodeBatch;
  successCount: number;
  failedCount: number;
  errors: RedeemCodeImportError[];
}

export interface RevealedRedeemCode {
  id: string;
  serviceId: string;
  batchId: string;
  redeemCode: string;
  codeTail: string;
  revealedAt: string;
}

export interface CodePlatformOrder {
  id: string;
  platformId: string;
  platform: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type' | 'status'>;
  externalOrderNo: string;
  buyerId?: string | null;
  buyerNameMasked?: string | null;
  itemId: string;
  skuId: string;
  itemTitle?: string | null;
  skuName?: string | null;
  serviceId?: string | null;
  service?: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'defaultCost' | 'status'> | null;
  faceValue?: string | null;
  quantity: number;
  paidAmount: string;
  platformFee: string;
  costAmount: string;
  profitAmount: string;
  orderStatus: string;
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'manual';
  refundStatus: 'none' | 'refunding' | 'refunded';
  lockedCodeCount: number;
  deliveredCodeCount: number;
  lockedCodes: Array<{
    id: string;
    codeTail: string;
    faceValue: string;
    cost: string;
    status: RedeemCodeInventoryItem['status'];
  }>;
  deliveredCodes: Array<{
    id: string;
    codeTail: string;
    faceValue: string;
    cost: string;
    status: RedeemCodeInventoryItem['status'];
  }>;
  paidAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDeliveryContent {
  orderId: string;
  externalOrderNo: string;
  deliveryContent: string;
  codeCount: number;
  codeTails: string[];
  generatedAt: string;
}

export interface CodeDeliveryLog {
  id: string;
  orderId: string;
  order: Pick<CodePlatformOrder, 'id' | 'externalOrderNo' | 'deliveryStatus'>;
  platformId: string;
  platform: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'>;
  externalOrderNo: string;
  codeId: string;
  code: {
    id: string;
    codeTail: string;
    status: RedeemCodeInventoryItem['status'];
  };
  faceValue: string;
  deliveryMethod: 'eticket' | 'dummy_send' | 'message_card' | 'manual';
  deliveryContentSnapshot: string;
  deliveryStatus: 'success' | 'failed' | 'pending';
  errorMessage?: string | null;
  cost: string;
  paidAmount: string;
  profit: string;
  createdAt: string;
}

export interface CodeAfterSale {
  id: string;
  orderId: string;
  order: {
    id: string;
    externalOrderNo: string;
    itemTitle?: string | null;
    skuName?: string | null;
    deliveryStatus: CodePlatformOrder['deliveryStatus'];
    refundStatus: CodePlatformOrder['refundStatus'];
    paidAmount: string;
    platformFee: string;
    costAmount: string;
    profitAmount: string;
    platform: Pick<SourcePlatform, 'id' | 'name' | 'code' | 'type'>;
    service?: Pick<CodeService, 'id' | 'name' | 'faceValue' | 'status'> | null;
  };
  originalCodeId: string;
  originalCode: {
    id: string;
    codeTail: string;
    faceValue: string;
    cost: string;
    status: RedeemCodeInventoryItem['status'];
  };
  newCodeId?: string | null;
  newCode?: {
    id: string;
    codeTail: string;
    faceValue: string;
    cost: string;
    status: RedeemCodeInventoryItem['status'];
  } | null;
  reason: string;
  status: 'pending' | 'completed' | 'rejected';
  handledBy?: Pick<ManagedUser, 'id' | 'username' | 'displayName'> | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface ReissueCodeAfterSaleResult {
  afterSale: CodeAfterSale;
  deliveryContent: string;
  codeTail: string;
}

export interface CodeProfitSummary {
  orderCount: number;
  codeCount: number;
  afterSaleCount: number;
  paidAmount: string;
  platformFee: string;
  costAmount: string;
  refundAmount: string;
  profitAmount: string;
  netProfitAmount: string;
  grossMarginRate: string;
  averageOrderProfit: string;
}

export interface CodeProfitGroup extends CodeProfitSummary {
  key: string;
  label: string;
  meta?: Record<string, string | null>;
}

export interface CodeProfitRecentOrder {
  id: string;
  externalOrderNo: string;
  deliveryStatus: CodePlatformOrder['deliveryStatus'];
  refundStatus: CodePlatformOrder['refundStatus'];
  itemTitle?: string | null;
  skuName?: string | null;
  serviceName?: string | null;
  platformName: string;
  paidAmount: string;
  platformFee: string;
  costAmount: string;
  refundAmount: string;
  profitAmount: string;
  netProfitAmount: string;
  codeCount: number;
  afterSaleCount: number;
  createdAt: string;
  deliveredAt?: string | null;
}

export interface CodeProfitReport {
  summary: CodeProfitSummary;
  daily: CodeProfitGroup[];
  byService: CodeProfitGroup[];
  byPlatform: CodeProfitGroup[];
  recentOrders: CodeProfitRecentOrder[];
}

export interface PageResult<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type TableDensity = 'compact' | 'default' | 'loose';

export interface UserTableView {
  id: string;
  userId: string;
  tableKey: string;
  viewName: string;
  filters: Record<string, unknown>;
  sortConfig: Record<string, unknown>;
  columns: string[];
  density: TableDensity;
  pageSize: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
