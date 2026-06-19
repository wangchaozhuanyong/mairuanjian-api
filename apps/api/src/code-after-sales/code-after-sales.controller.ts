import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CodeAfterSalesService } from './code-after-sales.service';
import type { CreateCodeAfterSaleDto } from './dto/create-code-after-sale.dto';
import type { ReissueCodeAfterSaleDto } from './dto/reissue-code-after-sale.dto';

@Controller('codes/after-sales')
export class CodeAfterSalesController {
  constructor(private readonly codeAfterSalesService: CodeAfterSalesService) {}

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
  create(@Body() dto: CreateCodeAfterSaleDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.codeAfterSalesService.create(dto, operator);
  }

  @Post(':id/reissue')
  @RequirePermissions('code.after_sale.manage')
  reissue(
    @Param('id') id: string,
    @Body() dto: ReissueCodeAfterSaleDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.codeAfterSalesService.reissue(id, dto, operator);
  }

  @Post(':id/complete')
  @RequirePermissions('code.after_sale.manage')
  complete(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.codeAfterSalesService.complete(id, operator);
  }
}
