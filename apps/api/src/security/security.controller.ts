import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type {
  CreateSensitiveApprovalInput,
  DecideSensitiveApprovalInput,
  DisableMfaInput,
  SaveIpWhitelistInput,
  VerifyMfaInput
} from './security.service';
import { SecurityService } from './security.service';

interface RequestWithMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('security')
export class SecurityController {
  constructor(
    private readonly securityService: SecurityService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('overview')
  @RequirePermissions('security.overview.view')
  overview() {
    return this.securityService.overview();
  }

  @Get('login-logs')
  @RequirePermissions('security.login_log.view')
  listLoginLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('abnormal') abnormal?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.securityService.listLoginLogs({
      page,
      pageSize,
      keyword,
      status,
      abnormal,
      sortBy,
      sortOrder
    });
  }

  @Get('abnormal-logins')
  @RequirePermissions('security.abnormal_login.view')
  listAbnormalLogins(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string
  ) {
    return this.securityService.listAbnormalLogins({ page, pageSize, keyword, status });
  }

  @Get('active-sessions')
  @RequirePermissions('security.session.view')
  listActiveSessions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('revoked') revoked?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.securityService.listActiveSessions({
      page,
      pageSize,
      keyword,
      revoked,
      sortBy,
      sortOrder
    });
  }

  @Delete('active-sessions/:id')
  @RequirePermissions('security.session.revoke')
  async revokeSession(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const session = await this.securityService.revokeSession(id, operator);
    this.publishSecurityEvent('security.session.revoked', 'active_session', 'revoked', id);
    return session;
  }

  @Get('mfa-settings')
  @RequirePermissions('security.mfa.manage')
  getMfaSettings() {
    return this.securityService.getMfaSettings();
  }

  @Patch('mfa-settings')
  @RequirePermissions('security.mfa.manage')
  async updateMfaSettings(
    @Body() body: Record<string, unknown>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const settings = await this.securityService.updateMfaSettings(body, operator);
    this.publishSecurityEvent('security.mfa_settings.updated', 'mfa_settings', 'updated');
    return settings;
  }

  @Get('mfa/me')
  getMyMfaStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.securityService.getMyMfaStatus(user);
  }

  @Post('mfa/me/setup')
  async setupMyMfa(@CurrentUser() user: AuthenticatedUser) {
    const setup = await this.securityService.setupMyMfa(user);
    this.publishSecurityEvent('security.mfa.setup_started', 'mfa', 'setup_started', user.id);
    return setup;
  }

  @Post('mfa/me/enable')
  async enableMyMfa(@CurrentUser() user: AuthenticatedUser, @Body() body: VerifyMfaInput) {
    const status = await this.securityService.enableMyMfa(user, body);
    this.publishSecurityEvent('security.mfa.enabled', 'mfa', 'enabled', user.id);
    return status;
  }

  @Post('mfa/me/recovery-codes')
  async regenerateMyMfaRecoveryCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: VerifyMfaInput
  ) {
    const status = await this.securityService.regenerateMyMfaRecoveryCodes(user, body);
    this.publishSecurityEvent('security.mfa.recovery_codes_regenerated', 'mfa', 'updated', user.id);
    return status;
  }

  @Post('mfa/me/disable')
  async disableMyMfa(@CurrentUser() user: AuthenticatedUser, @Body() body: DisableMfaInput) {
    const status = await this.securityService.disableMyMfa(user, body);
    this.publishSecurityEvent('security.mfa.disabled', 'mfa', 'disabled', user.id);
    return status;
  }

  @Post('mfa/users/:userId/reset')
  @RequirePermissions('security.mfa.manage')
  async resetUserMfa(@Param('userId') userId: string, @CurrentUser() operator?: AuthenticatedUser) {
    const status = await this.securityService.resetUserMfa(userId, operator);
    this.publishSecurityEvent('security.mfa.reset', 'mfa', 'reset', userId);
    return status;
  }

  @Get('ip-whitelists')
  @RequirePermissions('security.ip_whitelist.manage')
  listIpWhitelists(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('scope') scope?: string,
    @Query('enabled') enabled?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.securityService.listIpWhitelists({
      page,
      pageSize,
      keyword,
      scope,
      enabled,
      sortBy,
      sortOrder
    });
  }

  @Post('ip-whitelists')
  @RequirePermissions('security.ip_whitelist.manage')
  async createIpWhitelist(
    @Body() dto: SaveIpWhitelistInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const rule = await this.securityService.createIpWhitelist(dto, operator);
    this.publishSecurityEvent('security.ip_whitelist.created', 'ip_whitelist', 'created', rule.id);
    return rule;
  }

  @Patch('ip-whitelists/:id')
  @RequirePermissions('security.ip_whitelist.manage')
  async updateIpWhitelist(
    @Param('id') id: string,
    @Body() dto: SaveIpWhitelistInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const rule = await this.securityService.updateIpWhitelist(id, dto, operator);
    this.publishSecurityEvent('security.ip_whitelist.updated', 'ip_whitelist', 'updated', id);
    return rule;
  }

  @Delete('ip-whitelists/:id')
  @RequirePermissions('security.ip_whitelist.manage')
  async removeIpWhitelist(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.securityService.removeIpWhitelist(id, operator);
    this.publishSecurityEvent('security.ip_whitelist.deleted', 'ip_whitelist', 'deleted', id);
    return result;
  }

  @Get('password-policy')
  @RequirePermissions('security.password_policy.manage')
  getPasswordPolicy() {
    return this.securityService.getPasswordPolicy();
  }

  @Patch('password-policy')
  @RequirePermissions('security.password_policy.manage')
  async updatePasswordPolicy(
    @Body() body: Record<string, unknown>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const policy = await this.securityService.updatePasswordPolicy(body, operator);
    this.publishSecurityEvent('security.password_policy.updated', 'password_policy', 'updated');
    return policy;
  }

  @Get('sensitive-access-logs')
  @RequirePermissions('security.sensitive_access_log.view')
  listSensitiveAccessLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('fieldName') fieldName?: string,
    @Query('approved') approved?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.securityService.listSensitiveAccessLogs({
      page,
      pageSize,
      keyword,
      module,
      fieldName,
      approved,
      sortBy,
      sortOrder
    });
  }

  @Get('sensitive-access-approvals')
  @RequirePermissions('security.sensitive_access_approval.manage')
  listSensitiveApprovals(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.securityService.listSensitiveApprovals({
      page,
      pageSize,
      keyword,
      status,
      module,
      sortBy,
      sortOrder
    });
  }

  @Post('sensitive-access-approvals')
  @RequirePermissions('security.sensitive_access_approval.manage')
  async createSensitiveApproval(
    @Body() dto: CreateSensitiveApprovalInput,
    @CurrentUser() operator: AuthenticatedUser,
    @Req() request: RequestWithMeta
  ) {
    const approval = await this.securityService.createSensitiveApproval(
      {
        ...dto,
        reason: dto.reason ?? `申请查看敏感字段，IP：${request.ip ?? '-'}`
      },
      operator
    );
    this.publishSecurityEvent(
      'security.sensitive_access_approval.created',
      'sensitive_access_approval',
      'created',
      approval.id
    );
    return approval;
  }

  @Patch('sensitive-access-approvals/:id/approve')
  @RequirePermissions('security.sensitive_access_approval.manage')
  async approveSensitiveApproval(
    @Param('id') id: string,
    @Body() dto: DecideSensitiveApprovalInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const approval = await this.securityService.approveSensitiveApproval(id, dto, operator);
    this.publishSecurityEvent(
      'security.sensitive_access_approval.approved',
      'sensitive_access_approval',
      'approved',
      id
    );
    return approval;
  }

  @Patch('sensitive-access-approvals/:id/reject')
  @RequirePermissions('security.sensitive_access_approval.manage')
  async rejectSensitiveApproval(
    @Param('id') id: string,
    @Body() dto: DecideSensitiveApprovalInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const approval = await this.securityService.rejectSensitiveApproval(id, dto, operator);
    this.publishSecurityEvent(
      'security.sensitive_access_approval.rejected',
      'sensitive_access_approval',
      'rejected',
      id
    );
    return approval;
  }

  @Get('sensitive-operations')
  @RequirePermissions('security.sensitive_operation.view')
  listSensitiveOperations(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string
  ) {
    return this.securityService.listSensitiveOperations({ page, pageSize, keyword });
  }

  private publishSecurityEvent(
    type: string,
    entity: string,
    action: string,
    resourceId?: string | null
  ) {
    this.realtimeService.publish({
      type,
      module: 'security',
      entity,
      action,
      resourceId
    });
  }
}
