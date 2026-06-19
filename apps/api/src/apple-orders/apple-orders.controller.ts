import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppleOrdersService } from './apple-orders.service';
import type { CreateAppleOrderDto } from './dto/create-apple-order.dto';

@Controller('apple/orders')
export class AppleOrdersController {
  constructor(private readonly appleOrdersService: AppleOrdersService) {}

  @Get()
  @RequirePermissions('apple.order.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('sourcePlatformId') sourcePlatformId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('appleAccountId') appleAccountId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleOrdersService.list({
      page,
      pageSize,
      keyword,
      status,
      customerId,
      sourcePlatformId,
      serviceId,
      appleAccountId,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('apple.order.view')
  get(@Param('id') id: string) {
    return this.appleOrdersService.get(id);
  }

  @Post()
  @RequirePermissions('apple.order.create')
  create(@Body() dto: CreateAppleOrderDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleOrdersService.create(dto, operator);
  }
}

@Controller('apple/matching')
export class AppleMatchingController {
  constructor(private readonly appleOrdersService: AppleOrdersService) {}

  @Get('available-accounts')
  @RequirePermissions('apple.order.create')
  listAvailableAccounts(
    @Query('serviceId') serviceId?: string,
    @Query('amountRequired') amountRequired?: string,
    @Query('currency') currency?: string,
    @Query('keyword') keyword?: string,
    @Query('showUnavailable') showUnavailable?: string
  ) {
    return this.appleOrdersService.listAvailableAccounts({
      serviceId,
      amountRequired,
      currency,
      keyword,
      showUnavailable
    });
  }
}
