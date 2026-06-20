import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleAccountsService } from './apple-accounts.service';
import type { CreateAppleAccountDto } from './dto/create-apple-account.dto';
import type { ImportAppleAccountsDto } from './dto/import-apple-accounts.dto';
import type { RevealAppleAccountSecretDto } from './dto/reveal-apple-account-secret.dto';
import type { UpdateAppleAccountDto } from './dto/update-apple-account.dto';

interface RequestWithAuditMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('apple/accounts')
export class AppleAccountsController {
  constructor(
    private readonly appleAccountsService: AppleAccountsService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('apple.account.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('currency') currency?: string,
    @Query('region') region?: string,
    @Query('locked') locked?: string,
    @Query('sourcePlatformId') sourcePlatformId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleAccountsService.list({
      page,
      pageSize,
      keyword,
      status,
      currency,
      region,
      locked,
      sourcePlatformId,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('apple.account.view')
  get(@Param('id') id: string) {
    return this.appleAccountsService.get(id);
  }

  @Post()
  @RequirePermissions('apple.account.create')
  async create(@Body() dto: CreateAppleAccountDto, @CurrentUser() operator?: AuthenticatedUser) {
    const account = await this.appleAccountsService.create(dto, operator);
    this.publishAppleAccountEvent('apple.account.created', 'created', account.id);
    return account;
  }

  @Post('import')
  @RequirePermissions('apple.account.import')
  async importAccounts(
    @Body() dto: ImportAppleAccountsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.appleAccountsService.importAccounts(dto, operator);
    this.realtimeService.publish({
      type: 'apple.account.imported',
      module: 'apple',
      entity: 'account',
      action: 'imported',
      scope: {
        successCount: result.successCount,
        failedCount: result.failedCount
      }
    });
    return result;
  }

  @Patch(':id')
  @RequirePermissions('apple.account.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppleAccountDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const account = await this.appleAccountsService.update(id, dto, operator);
    this.publishAppleAccountEvent('apple.account.updated', 'updated', account.id);
    return account;
  }

  @Post(':id/reveal-secret')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('apple.account.view')
  revealSecret(
    @Param('id') id: string,
    @Body() dto: RevealAppleAccountSecretDto,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Req() request: RequestWithAuditMeta
  ) {
    return this.appleAccountsService.revealSecret(id, dto, operator, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
  }

  @Delete(':id')
  @RequirePermissions('apple.account.delete')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.appleAccountsService.remove(id, operator);
    this.publishAppleAccountEvent('apple.account.deleted', 'deleted', id);
    return result;
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.join(', ') : value;
  }

  private publishAppleAccountEvent(type: string, action: string, accountId: string) {
    this.realtimeService.publish({
      type,
      module: 'apple',
      entity: 'account',
      action,
      resourceId: accountId,
      scope: {
        appleAccountId: accountId
      }
    });
  }
}
