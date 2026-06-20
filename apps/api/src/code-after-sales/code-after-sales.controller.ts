import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { CodeAfterSalesService } from './code-after-sales.service';
import type { CreateCodeAfterSaleDto } from './dto/create-code-after-sale.dto';
import type { ReissueCodeAfterSaleDto } from './dto/reissue-code-after-sale.dto';

@Controller('codes/after-sales')
export class CodeAfterSalesController {
  constructor(
    private readonly codeAfterSalesService: CodeAfterSalesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('code.after_sale.manage')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.codeAfterSalesService.list({
      page,
      pageSize,
      keyword,
      status,
      orderId,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('code.after_sale.manage')
  get(@Param('id') id: string) {
    return this.codeAfterSalesService.get(id);
  }

  @Post()
  @RequirePermissions('code.after_sale.manage')
  async create(@Body() dto: CreateCodeAfterSaleDto, @CurrentUser() operator?: AuthenticatedUser) {
    const afterSale = await this.codeAfterSalesService.create(dto, operator);
    this.publishAfterSaleEvent('codes.after_sale.created', 'created', afterSale.id);
    return afterSale;
  }

  @Post(':id/reissue')
  @RequirePermissions('code.after_sale.manage')
  async reissue(
    @Param('id') id: string,
    @Body() dto: ReissueCodeAfterSaleDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.codeAfterSalesService.reissue(id, dto, operator);
    this.publishAfterSaleEvent('codes.after_sale.reissued', 'reissued', id);
    return result;
  }

  @Post(':id/complete')
  @RequirePermissions('code.after_sale.manage')
  async complete(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const afterSale = await this.codeAfterSalesService.complete(id, operator);
    this.publishAfterSaleEvent('codes.after_sale.completed', 'completed', afterSale.id);
    return afterSale;
  }

  private publishAfterSaleEvent(type: string, action: string, afterSaleId: string) {
    this.realtimeService.publish({
      type,
      module: 'code',
      entity: 'after_sale',
      action,
      resourceId: afterSaleId
    });
  }
}
