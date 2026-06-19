import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PlatformDeliverDto } from './dto/platform-deliver.dto';
import type { PlatformPollDto } from './dto/platform-poll.dto';
import { PlatformDeliveryService } from './platform-delivery.service';

@Controller('platforms')
export class PlatformDeliveryController {
  constructor(private readonly platformDeliveryService: PlatformDeliveryService) {}

  @Post('taobao/sync-orders')
  @RequirePermissions('code.order.deliver')
  syncTaobaoOrders() {
    return this.platformDeliveryService.syncOrders('taobao');
  }

  @Get('taobao/orders/:externalOrderNo')
  @RequirePermissions('code.order.view')
  getTaobaoOrder(@Param('externalOrderNo') externalOrderNo: string) {
    return this.platformDeliveryService.getOrderByExternalNo('taobao', externalOrderNo);
  }

  @Post('taobao/orders/:id/deliver')
  @RequirePermissions('code.order.deliver')
  deliverTaobaoOrder(
    @Param('id') id: string,
    @Body() dto: PlatformDeliverDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.platformDeliveryService.deliver('taobao', id, dto, operator);
  }

  @Post('taobao/sync-refunds')
  @RequirePermissions('code.order.deliver')
  syncTaobaoRefunds() {
    return this.platformDeliveryService.syncRefunds('taobao');
  }

  @Post('taobao/poll')
  @RequirePermissions('code.order.deliver')
  pollTaobao(@Body() dto: PlatformPollDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.platformDeliveryService.pollPlatform('taobao', dto, operator);
  }

  @Post('xianyu/sync-orders')
  @RequirePermissions('code.order.deliver')
  syncXianyuOrders() {
    return this.platformDeliveryService.syncOrders('xianyu');
  }

  @Get('xianyu/orders/:externalOrderNo')
  @RequirePermissions('code.order.view')
  getXianyuOrder(@Param('externalOrderNo') externalOrderNo: string) {
    return this.platformDeliveryService.getOrderByExternalNo('xianyu', externalOrderNo);
  }

  @Post('xianyu/orders/:id/deliver')
  @RequirePermissions('code.order.deliver')
  deliverXianyuOrder(
    @Param('id') id: string,
    @Body() dto: PlatformDeliverDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.platformDeliveryService.deliver('xianyu', id, dto, operator);
  }

  @Post('xianyu/sync-refunds')
  @RequirePermissions('code.order.deliver')
  syncXianyuRefunds() {
    return this.platformDeliveryService.syncRefunds('xianyu');
  }

  @Post('xianyu/poll')
  @RequirePermissions('code.order.deliver')
  pollXianyu(@Body() dto: PlatformPollDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.platformDeliveryService.pollPlatform('xianyu', dto, operator);
  }

  @Post('poll-all')
  @RequirePermissions('code.order.deliver')
  pollAll(@Body() dto: PlatformPollDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.platformDeliveryService.pollAllPlatforms(dto, operator);
  }

  @Post('manual/orders/:id/deliver')
  @RequirePermissions('code.order.deliver')
  deliverManualOrder(
    @Param('id') id: string,
    @Body() dto: PlatformDeliverDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.platformDeliveryService.deliver('manual', id, dto, operator);
  }
}
