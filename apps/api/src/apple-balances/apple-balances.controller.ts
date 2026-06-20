import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleBalancesService } from './apple-balances.service';
import type { CreateAppleBalanceAdjustmentDto } from './dto/create-apple-balance-adjustment.dto';
import type { CreateAppleBalanceConsumptionDto } from './dto/create-apple-balance-consumption.dto';
import type { CreateAppleBalanceTopupDto } from './dto/create-apple-balance-topup.dto';
import type { RevealGiftCardCodeDto } from './dto/reveal-gift-card-code.dto';

interface RequestWithAuditMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('apple/accounts/:accountId')
export class AppleBalancesController {
  constructor(
    private readonly appleBalancesService: AppleBalancesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('topups')
  @RequirePermissions('apple.balance.view')
  listTopups(
    @Param('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.appleBalancesService.listTopups(accountId, { page, pageSize });
  }

  @Post('topups')
  @RequirePermissions('apple.balance.topup')
  async createTopup(
    @Param('accountId') accountId: string,
    @Body() dto: CreateAppleBalanceTopupDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const topup = await this.appleBalancesService.createTopup(accountId, dto, operator);
    this.publishAppleBalanceEvent('apple.topup.created', 'topup', 'created', accountId, topup.id);
    return topup;
  }

  @Get('consumptions')
  @RequirePermissions('apple.balance.view')
  listConsumptions(
    @Param('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.appleBalancesService.listConsumptions(accountId, { page, pageSize });
  }

  @Post('consumptions')
  @RequirePermissions('apple.balance.adjust')
  async createConsumption(
    @Param('accountId') accountId: string,
    @Body() dto: CreateAppleBalanceConsumptionDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const consumption = await this.appleBalancesService.createConsumption(accountId, dto, operator);
    this.publishAppleBalanceEvent(
      'apple.consumption.created',
      'consumption',
      'created',
      accountId,
      consumption.id
    );
    return consumption;
  }

  @Get('balance-adjustments')
  @RequirePermissions('apple.balance.view')
  listBalanceAdjustments(
    @Param('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.appleBalancesService.listBalanceAdjustments(accountId, { page, pageSize });
  }

  @Post('balance-adjustments')
  @RequirePermissions('apple.balance.adjust')
  async createBalanceAdjustment(
    @Param('accountId') accountId: string,
    @Body() dto: CreateAppleBalanceAdjustmentDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const adjustment = await this.appleBalancesService.createBalanceAdjustment(
      accountId,
      dto,
      operator
    );
    this.publishAppleBalanceEvent(
      'apple.balance_adjustment.created',
      'balance_adjustment',
      'created',
      accountId,
      adjustment.id
    );
    return adjustment;
  }

  private publishAppleBalanceEvent(
    type: string,
    entity: string,
    action: string,
    accountId: string,
    recordId: string
  ) {
    this.realtimeService.publish({
      type,
      module: 'apple',
      entity,
      action,
      resourceId: recordId,
      scope: {
        appleAccountId: accountId
      }
    });
  }
}

@Controller('apple/topups')
export class AppleTopupsController {
  constructor(private readonly appleBalancesService: AppleBalancesService) {}

  @Post(':id/reveal-gift-card-code')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('apple.topup.gift_code.view_full')
  revealGiftCardCode(
    @Param('id') id: string,
    @Body() dto: RevealGiftCardCodeDto,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Req() request: RequestWithAuditMeta
  ) {
    return this.appleBalancesService.revealGiftCardCode(id, dto, operator, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.join(', ') : value;
  }
}
