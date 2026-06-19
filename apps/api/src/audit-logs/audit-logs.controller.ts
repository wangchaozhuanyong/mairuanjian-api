import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@RequirePermissions('audit_log.view')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.list({
      page,
      pageSize,
      module,
      action,
      userId,
      keyword,
      sortBy,
      sortOrder
    });
  }

  @Get('operation')
  operationLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listOperationLogs({
      page,
      pageSize,
      module,
      action,
      userId,
      keyword,
      sortBy,
      sortOrder
    });
  }

  @Get('sensitive-access')
  sensitiveAccessLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('fieldName') fieldName?: string,
    @Query('approved') approved?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listSensitiveAccessLogs({
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

  @Get('login')
  loginLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('abnormal') abnormal?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listLoginLogs({
      page,
      pageSize,
      keyword,
      status,
      abnormal,
      sortBy,
      sortOrder
    });
  }

  @Get('export')
  exportLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('status') status?: string,
    @Query('containsSensitive') containsSensitive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listExportLogs({
      page,
      pageSize,
      keyword,
      module,
      status,
      containsSensitive,
      sortBy,
      sortOrder
    });
  }

  @Get('permission-changes')
  permissionChangeLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('userId') userId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listPermissionChangeLogs({
      page,
      pageSize,
      keyword,
      userId,
      sortBy,
      sortOrder
    });
  }

  @Get('automation-tasks')
  automationTaskLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('level') level?: string,
    @Query('taskId') taskId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listAutomationTaskLogs({
      page,
      pageSize,
      keyword,
      level,
      taskId,
      sortBy,
      sortOrder
    });
  }

  @Get('platform-interfaces')
  platformInterfaceLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.auditLogsService.listPlatformInterfaceLogs({
      page,
      pageSize,
      keyword,
      platform,
      status,
      sortBy,
      sortOrder
    });
  }
}
