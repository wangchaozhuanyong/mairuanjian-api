import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleAccountStatusChecksService } from './apple-account-status-checks.service';
import type { CreateAppleAccountStatusCheckDto } from './dto/create-apple-account-status-check.dto';

@Controller('apple/accounts/:accountId/status-checks')
export class AppleAccountStatusChecksController {
  constructor(
    private readonly statusChecksService: AppleAccountStatusChecksService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('apple.account.view')
  list(
    @Param('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.statusChecksService.list(accountId, { page, pageSize });
  }

  @Post()
  @RequirePermissions('apple.account.update')
  async create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateAppleAccountStatusCheckDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const statusCheck = await this.statusChecksService.create(accountId, dto, operator);
    this.realtimeService.publish({
      type: 'apple.account.status_checked',
      module: 'apple',
      entity: 'account_status_check',
      action: 'created',
      resourceId: statusCheck.id,
      scope: {
        appleAccountId: accountId
      }
    });
    return statusCheck;
  }
}
