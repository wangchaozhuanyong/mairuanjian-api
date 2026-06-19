import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type {
  CreateErrorLogInput,
  ReauthorizePlatformInput,
  SavePlatformAuthorizationInput,
  StartPlatformOAuthInput,
  TestPlatformConnectionInput
} from './ops.service';
import { OpsService } from './ops.service';

@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('overview')
  @RequirePermissions('ops.overview.view')
  overview() {
    return this.opsService.overview();
  }

  @Get('api-status')
  @RequirePermissions('ops.api_status.view')
  apiStatus() {
    return this.opsService.apiStatus();
  }

  @Get('database-status')
  @RequirePermissions('ops.database_status.view')
  databaseStatus() {
    return this.opsService.databaseStatus();
  }

  @Get('redis-status')
  @RequirePermissions('ops.redis_status.view')
  redisStatus() {
    return this.opsService.redisStatus();
  }

  @Get('queue-status')
  @RequirePermissions('ops.queue_status.view')
  queueStatus(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('queueName') queueName?: string,
    @Query('status') status?: string
  ) {
    return this.opsService.queueStatus({ page, pageSize, queueName, status });
  }

  @Get('cron-jobs')
  @RequirePermissions('ops.cron_job.view')
  cronJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string
  ) {
    return this.opsService.cronJobs({ page, pageSize, keyword, status });
  }

  @Get('platform-sync-status')
  @RequirePermissions('ops.platform_sync.view')
  platformSyncStatus(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string
  ) {
    return this.opsService.platformSyncStatus({ page, pageSize, platform, status });
  }

  @Get('automation-workers')
  @RequirePermissions('ops.worker_status.view')
  automationWorkers() {
    return this.opsService.automationWorkers();
  }

  @Get('file-storage-status')
  @RequirePermissions('ops.storage_status.view')
  fileStorageStatus() {
    return this.opsService.fileStorageStatus();
  }

  @Get('disk-space')
  @RequirePermissions('ops.disk_status.view')
  diskSpace() {
    return this.opsService.diskSpace();
  }

  @Get('error-logs')
  @RequirePermissions('ops.error_log.view')
  errorLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('level') level?: string
  ) {
    return this.opsService.errorLogs({ page, pageSize, keyword, module, level });
  }

  @Post('error-logs')
  @RequirePermissions('ops.error_log.create')
  createErrorLog(@Body() dto: CreateErrorLogInput, @CurrentUser() operator?: AuthenticatedUser) {
    return this.opsService.createErrorLog(dto, operator);
  }

  @Get('health-snapshots')
  @RequirePermissions('ops.overview.view')
  healthSnapshots(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string
  ) {
    return this.opsService.healthSnapshots({ page, pageSize, status });
  }

  @Post('health-snapshots')
  @RequirePermissions('ops.health_snapshot.create')
  captureHealthSnapshot(@CurrentUser() operator?: AuthenticatedUser) {
    return this.opsService.captureHealthSnapshot(operator);
  }

  @Post('platforms/:platform/test-connection')
  @RequirePermissions('ops.platform.test_connection')
  testPlatformConnection(
    @Param('platform') platform: string,
    @Body() dto: TestPlatformConnectionInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.opsService.testPlatformConnection(platform, dto, operator);
  }

  @Get('platforms')
  @RequirePermissions('ops.platform_sync.view')
  platforms() {
    return this.opsService.platformStatuses();
  }

  @Get('platforms/:platform')
  @RequirePermissions('ops.platform_sync.view')
  platform(@Param('platform') platform: string) {
    return this.opsService.platformStatus(platform);
  }

  @Get('platforms/:platform/authorization')
  @RequirePermissions('ops.platform_sync.view')
  platformAuthorization(@Param('platform') platform: string) {
    return this.opsService.getPlatformAuthorization(platform);
  }

  @Post('platforms/:platform/authorization')
  @RequirePermissions('ops.platform.reauthorize')
  savePlatformAuthorization(
    @Param('platform') platform: string,
    @Body() dto: SavePlatformAuthorizationInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.opsService.savePlatformAuthorization(platform, dto, operator);
  }

  @Post('platforms/:platform/oauth/start')
  @RequirePermissions('ops.platform.reauthorize')
  startPlatformOAuth(
    @Param('platform') platform: string,
    @Body() dto: StartPlatformOAuthInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.opsService.startPlatformOAuth(platform, dto, operator);
  }

  @Get('platforms/:platform/oauth/callback')
  @Public()
  handlePlatformOAuthCallback(
    @Param('platform') platform: string,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string
  ) {
    return this.opsService.handlePlatformOAuthCallback(platform, {
      code,
      state,
      error,
      errorDescription
    });
  }

  @Post('platforms/:platform/reauthorize')
  @RequirePermissions('ops.platform.reauthorize')
  reauthorizePlatform(
    @Param('platform') platform: string,
    @Body() dto: ReauthorizePlatformInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.opsService.reauthorizePlatform(platform, dto, operator);
  }
}
