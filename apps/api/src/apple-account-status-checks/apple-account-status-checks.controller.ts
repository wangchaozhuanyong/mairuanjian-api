import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppleAccountStatusChecksService } from './apple-account-status-checks.service';
import type { CreateAppleAccountStatusCheckDto } from './dto/create-apple-account-status-check.dto';

@Controller('apple/accounts/:accountId/status-checks')
export class AppleAccountStatusChecksController {
  constructor(private readonly statusChecksService: AppleAccountStatusChecksService) {}

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
  create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateAppleAccountStatusCheckDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.statusChecksService.create(accountId, dto, operator);
  }
}
