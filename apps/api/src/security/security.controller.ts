import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
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
  constructor(private readonly securityService: SecurityService) {}

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
  revokeSession(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.securityService.revokeSession(id, operator);
  }

  @Get('mfa-settings')
  @RequirePermissions('security.mfa.manage')
  getMfaSettings() {
    return this.securityService.getMfaSettings();
  }

  @Patch('mfa-settings')
  @RequirePermissions('security.mfa.manage')
  updateMfaSettings(
    @Body() body: Record<string, unknown>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.securityService.updateMfaSettings(body, operator);
  }

  @Get('mfa/me')
  getMyMfaStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.securityService.getMyMfaStatus(user);
  }

  @Post('mfa/me/setup')
  setupMyMfa(@CurrentUser() user: AuthenticatedUser) {
    return this.securityService.setupMyMfa(user);
  }

  @Post('mfa/me/enable')
  enableMyMfa(@CurrentUser() user: AuthenticatedUser, @Body() body: VerifyMfaInput) {
    return this.securityService.enableMyMfa(user, body);
  }

  @Post('mfa/me/recovery-codes')
  regenerateMyMfaRecoveryCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: VerifyMfaInput
  ) {
    return this.securityService.regenerateMyMfaRecoveryCodes(user, body);
  }

  @Post('mfa/me/disable')
  disableMyMfa(@CurrentUser() user: AuthenticatedUser, @Body() body: DisableMfaInput) {
    return this.securityService.disableMyMfa(user, body);
  }

  @Post('mfa/users/:userId/reset')
  @RequirePermissions('security.mfa.manage')
  resetUserMfa(@Param('userId') userId: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.securityService.resetUserMfa(userId, operator);
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
  createIpWhitelist(
    @Body() dto: SaveIpWhitelistInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.securityService.createIpWhitelist(dto, operator);
  }

  @Patch('ip-whitelists/:id')
  @RequirePermissions('security.ip_whitelist.manage')
  updateIpWhitelist(
    @Param('id') id: string,
    @Body() dto: SaveIpWhitelistInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.securityService.updateIpWhitelist(id, dto, operator);
  }

  @Delete('ip-whitelists/:id')
  @RequirePermissions('security.ip_whitelist.manage')
  removeIpWhitelist(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.securityService.removeIpWhitelist(id, operator);
  }

  @Get('password-policy')
  @RequirePermissions('security.password_policy.manage')
  getPasswordPolicy() {
    return this.securityService.getPasswordPolicy();
  }

  @Patch('password-policy')
  @RequirePermissions('security.password_policy.manage')
  updatePasswordPolicy(
    @Body() body: Record<string, unknown>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.securityService.updatePasswordPolicy(body, operator);
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
  createSensitiveApproval(
    @Body() dto: CreateSensitiveApprovalInput,
    @CurrentUser() operator: AuthenticatedUser,
    @Req() request: RequestWithMeta
  ) {
    return this.securityService.createSensitiveApproval(
      {
        ...dto,
        reason: dto.reason ?? `申请查看敏感字段，IP：${request.ip ?? '-'}`
      },
      operator
    );
  }

  @Patch('sensitive-access-approvals/:id/approve')
  @RequirePermissions('security.sensitive_access_approval.manage')
  approveSensitiveApproval(
    @Param('id') id: string,
    @Body() dto: DecideSensitiveApprovalInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.securityService.approveSensitiveApproval(id, dto, operator);
  }

  @Patch('sensitive-access-approvals/:id/reject')
  @RequirePermissions('security.sensitive_access_approval.manage')
  rejectSensitiveApproval(
    @Param('id') id: string,
    @Body() dto: DecideSensitiveApprovalInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.securityService.rejectSensitiveApproval(id, dto, operator);
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
}
