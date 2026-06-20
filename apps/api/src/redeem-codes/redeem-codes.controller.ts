import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type { ImportRedeemCodesDto } from './dto/import-redeem-codes.dto';
import type { RevealRedeemCodeDto } from './dto/reveal-redeem-code.dto';
import { RedeemCodesService } from './redeem-codes.service';

interface RequestWithAuditMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('codes')
export class RedeemCodesController {
  constructor(
    private readonly redeemCodesService: RedeemCodesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('batches')
  @RequirePermissions('code.inventory.view')
  listBatches(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('serviceId') serviceId?: string
  ) {
    return this.redeemCodesService.listBatches({
      page,
      pageSize,
      keyword,
      serviceId
    });
  }

  @Post('batches/import')
  @RequirePermissions('code.batch.import')
  async importBatch(
    @Body() dto: ImportRedeemCodesDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const result = await this.redeemCodesService.importBatch(dto, operator);
    this.realtimeService.publish({
      type: 'codes.batch.imported',
      module: 'code',
      entity: 'redeem_code_batch',
      action: 'imported',
      resourceId: result.batch.id,
      scope: {
        successCount: result.successCount,
        failedCount: result.failedCount
      }
    });
    return result;
  }

  @Get('inventory')
  @RequirePermissions('code.inventory.view')
  listInventory(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('serviceId') serviceId?: string,
    @Query('batchId') batchId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.redeemCodesService.listInventory({
      page,
      pageSize,
      keyword,
      status,
      serviceId,
      batchId,
      sortBy,
      sortOrder
    });
  }

  @Get('inventory/:id')
  @RequirePermissions('code.inventory.view')
  getInventoryItem(@Param('id') id: string) {
    return this.redeemCodesService.getInventoryItem(id);
  }

  @Post('inventory/:id/reveal')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @RequirePermissions('code.inventory.view_full')
  revealRedeemCode(
    @Param('id') id: string,
    @Body() dto: RevealRedeemCodeDto,
    @CurrentUser() operator: AuthenticatedUser | undefined,
    @Req() request: RequestWithAuditMeta
  ) {
    return this.redeemCodesService.revealRedeemCode(id, dto, operator, {
      ip: request.ip,
      userAgent: this.getHeaderValue(request.headers['user-agent'])
    });
  }

  private getHeaderValue(value: string | string[] | undefined) {
    return Array.isArray(value) ? value.join(', ') : value;
  }
}
