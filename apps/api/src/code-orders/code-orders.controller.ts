import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CodeOrdersService } from './code-orders.service';
import type { ConfirmCodeDeliveryDto } from './dto/confirm-code-delivery.dto';
import type { CreateManualCodeOrderDto } from './dto/create-manual-code-order.dto';
import type { GenerateDeliveryContentDto } from './dto/generate-delivery-content.dto';
import type { MarkCodeOrderManualDto } from './dto/mark-code-order-manual.dto';
import { RealtimeService } from '../realtime/realtime.service';

interface RequestWithAuditMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('codes/orders')
export class CodeOrdersController {
  constructor(
    private readonly codeOrdersService: CodeOrdersService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('code.order.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('platformId') platformId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('deliveryStatus') deliveryStatus?: string,
    @Query('refundStatus') refundStatus?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.codeOrdersService.list({
      page,
      pageSize,
      keyword,
      platformId,
      serviceId,
      deliveryStatus,
      refundStatus,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('code.order.view')
  get(@Param('id') id: string) {
    return this.codeOrdersService.get(id);
  }

  @Post('manual')
  @RequirePermissions('code.order.deliver')
  async createManual(
    @Body() dto: CreateManualCodeOrderDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const order = await this.codeOrdersService.createManual(dto, operator);
    this.publishCodeOrderEvent('code.order.created', 'created', order.id);
    return order;
  }

  @Post(':id/match-code')
  @RequirePermissions('code.order.deliver')
  async matchAndLock(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const order = await this.codeOrdersService.matchAndLock(id, operator);
    this.publishCodeOrderEvent('codes.inventory.updated', 'locked', id);
    this.publishCodeOrderEvent('code.order.updated', 'updated', id);
    return order;
  }

  @Post(':id/generate-delivery-content')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('code.order.deliver')
  generateDeliveryContent(
    @Param('id') id: string,
    @Body() dto: GenerateDeliveryContentDto,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Req() request: RequestWithAuditMeta
  ) {
    return this.codeOrdersService.generateDeliveryContent(id, dto, operator, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
  }

  @Post(':id/deliver')
  @RequirePermissions('code.order.deliver')
  async confirmDelivery(
    @Param('id') id: string,
    @Body() dto: ConfirmCodeDeliveryDto,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Req() request: RequestWithAuditMeta
  ) {
    const order = await this.codeOrdersService.confirmDelivery(id, dto, operator, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
    this.publishCodeOrderEvent('codes.delivery.completed', 'delivered', id);
    this.publishCodeOrderEvent('codes.inventory.updated', 'delivered', id);
    return order;
  }

  @Post(':id/mark-manual')
  @RequirePermissions('code.order.deliver')
  async markManual(
    @Param('id') id: string,
    @Body() dto: MarkCodeOrderManualDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const order = await this.codeOrdersService.markManual(id, dto, operator);
    this.publishCodeOrderEvent('code.order.manual_required', 'manual_required', id);
    return order;
  }

  @Get(':id/delivery-logs')
  @RequirePermissions('code.delivery.view')
  listOrderDeliveryLogs(@Param('id') id: string) {
    return this.codeOrdersService.listOrderDeliveryLogs(id);
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.join(', ') : value;
  }

  private publishCodeOrderEvent(type: string, action: string, orderId?: string | null) {
    this.realtimeService.publish({
      type,
      module: 'code',
      entity: 'code_order',
      action,
      resourceId: orderId ?? null,
      scope: {
        orderId: orderId ?? null
      }
    });
  }
}
