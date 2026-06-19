import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/auth.decorators';
import { CodeOrdersService } from './code-orders.service';

@Controller('codes/deliveries')
export class CodeDeliveriesController {
  constructor(private readonly codeOrdersService: CodeOrdersService) {}

  @Get()
  @RequirePermissions('code.delivery.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('platformId') platformId?: string,
    @Query('orderId') orderId?: string,
    @Query('deliveryStatus') deliveryStatus?: string
  ) {
    return this.codeOrdersService.listDeliveryLogs({
      page,
      pageSize,
      keyword,
      platformId,
      orderId,
      deliveryStatus
    });
  }

  @Get(':id')
  @RequirePermissions('code.delivery.view')
  get(@Param('id') id: string) {
    return this.codeOrdersService.getDeliveryLog(id);
  }
}
