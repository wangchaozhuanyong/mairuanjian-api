import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PlatformDeliverDto } from './dto/platform-deliver.dto';
import type { PlatformPollDto } from './dto/platform-poll.dto';
import { PlatformDeliveryService } from './platform-delivery.service';
import { RealtimeService } from '../realtime/realtime.service';

@Controller('platforms')
export class PlatformDeliveryController {
  constructor(
    private readonly platformDeliveryService: PlatformDeliveryService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Post('taobao/sync-orders')
  @RequirePermissions('code.order.deliver')
  async syncTaobaoOrders() {
    const result = await this.platformDeliveryService.syncOrders('taobao');
    this.publishPlatformEvent('codes.order.synced', 'taobao', 'synced');
    return result;
  }

  @Get('taobao/orders/:externalOrderNo')
  @RequirePermissions('code.order.view')
  getTaobaoOrder(@Param('externalOrderNo') externalOrderNo: string) {
    return this.platformDeliveryService.getOrderByExternalNo('taobao', externalOrderNo);
  }

  @Post('taobao/orders/:id/deliver')
  @RequirePermissions('code.order.deliver')
  async deliverTaobaoOrder(
    @Param('id') id: string,
    @Body() dto: PlatformDeliverDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.platformDeliveryService.deliver('taobao', id, dto, operator);
    this.publishPlatformEvent('codes.delivery.completed', 'taobao', 'delivered', id);
    return result;
  }

  @Post('taobao/sync-refunds')
  @RequirePermissions('code.order.deliver')
  async syncTaobaoRefunds() {
    const result = await this.platformDeliveryService.syncRefunds('taobao');
    this.publishPlatformEvent('code.order.refunds_synced', 'taobao', 'refunds_synced');
    return result;
  }

  @Post('taobao/poll')
  @RequirePermissions('code.order.deliver')
  async pollTaobao(@Body() dto: PlatformPollDto, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.platformDeliveryService.pollPlatform('taobao', dto, operator);
    this.publishPlatformEvent('codes.order.synced', 'taobao', 'polled');
    return result;
  }

  @Post('xianyu/sync-orders')
  @RequirePermissions('code.order.deliver')
  async syncXianyuOrders() {
    const result = await this.platformDeliveryService.syncOrders('xianyu');
    this.publishPlatformEvent('codes.order.synced', 'xianyu', 'synced');
    return result;
  }

  @Get('xianyu/orders/:externalOrderNo')
  @RequirePermissions('code.order.view')
  getXianyuOrder(@Param('externalOrderNo') externalOrderNo: string) {
    return this.platformDeliveryService.getOrderByExternalNo('xianyu', externalOrderNo);
  }

  @Post('xianyu/orders/:id/deliver')
  @RequirePermissions('code.order.deliver')
  async deliverXianyuOrder(
    @Param('id') id: string,
    @Body() dto: PlatformDeliverDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.platformDeliveryService.deliver('xianyu', id, dto, operator);
    this.publishPlatformEvent('codes.delivery.completed', 'xianyu', 'delivered', id);
    return result;
  }

  @Post('xianyu/sync-refunds')
  @RequirePermissions('code.order.deliver')
  async syncXianyuRefunds() {
    const result = await this.platformDeliveryService.syncRefunds('xianyu');
    this.publishPlatformEvent('code.order.refunds_synced', 'xianyu', 'refunds_synced');
    return result;
  }

  @Post('xianyu/poll')
  @RequirePermissions('code.order.deliver')
  async pollXianyu(@Body() dto: PlatformPollDto, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.platformDeliveryService.pollPlatform('xianyu', dto, operator);
    this.publishPlatformEvent('codes.order.synced', 'xianyu', 'polled');
    return result;
  }

  @Post('poll-all')
  @RequirePermissions('code.order.deliver')
  async pollAll(@Body() dto: PlatformPollDto, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.platformDeliveryService.pollAllPlatforms(dto, operator);
    this.publishPlatformEvent('codes.order.synced', 'taobao', 'polled');
    this.publishPlatformEvent('codes.order.synced', 'xianyu', 'polled');
    return result;
  }

  @Post('manual/orders/:id/deliver')
  @RequirePermissions('code.order.deliver')
  async deliverManualOrder(
    @Param('id') id: string,
    @Body() dto: PlatformDeliverDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.platformDeliveryService.deliver('manual', id, dto, operator);
    this.publishPlatformEvent('codes.delivery.completed', 'manual', 'delivered', id);
    return result;
  }

  private publishPlatformEvent(
    type: string,
    platform: 'taobao' | 'xianyu' | 'manual',
    action: string,
    orderId?: string | null
  ) {
    this.realtimeService.publish({
      type,
      module: platform === 'manual' ? 'code' : 'platform',
      entity: 'platform_code_order',
      action,
      resourceId: orderId ?? null,
      scope: {
        platform,
        orderId: orderId ?? null
      }
    });
  }
}
