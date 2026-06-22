import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppleOfficialPricesService } from './apple-official-prices.service';
import type { CheckOfficialPriceSourceDto } from './dto/check-official-price-source.dto';
import type { CreateOfficialPriceSourceDto } from './dto/create-official-price-source.dto';
import type { UpdateOfficialPriceSourceDto } from './dto/update-official-price-source.dto';

@Controller('apple/official-prices')
@RequirePermissions('apple.service.manage')
export class AppleOfficialPricesController {
  constructor(private readonly officialPricesService: AppleOfficialPricesService) {}

  @Get('sources')
  listSources(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('provider') provider?: string,
    @Query('region') region?: string,
    @Query('currency') currency?: string,
    @Query('collectMethod') collectMethod?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.officialPricesService.listSources({
      page,
      pageSize,
      keyword,
      provider,
      region,
      currency,
      collectMethod,
      status,
      sortBy,
      sortOrder
    });
  }

  @Post('sources')
  createSource(
    @Body() dto: CreateOfficialPriceSourceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.createSource(dto, operator);
  }

  @Patch('sources/:id')
  updateSource(
    @Param('id') id: string,
    @Body() dto: UpdateOfficialPriceSourceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.updateSource(id, dto, operator);
  }

  @Delete('sources/:id')
  removeSource(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.officialPricesService.removeSource(id, operator);
  }

  @Post('sources/:id/check')
  checkSource(
    @Param('id') id: string,
    @Body() dto: CheckOfficialPriceSourceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.checkSource(id, dto, operator);
  }

  @Get('snapshots')
  listSnapshots(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sourceId') sourceId?: string,
    @Query('appleServiceId') appleServiceId?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.officialPricesService.listSnapshots({
      page,
      pageSize,
      sourceId,
      appleServiceId,
      keyword,
      sortBy,
      sortOrder
    });
  }

  @Get('reviews')
  listReviews(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sourceId') sourceId?: string,
    @Query('appleServiceId') appleServiceId?: string,
    @Query('status') status?: string,
    @Query('changeType') changeType?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.officialPricesService.listReviews({
      page,
      pageSize,
      sourceId,
      appleServiceId,
      status,
      changeType,
      keyword,
      sortBy,
      sortOrder
    });
  }

  @Post('reviews/:id/approve')
  approveReview(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.officialPricesService.approveReview(id, operator);
  }

  @Post('reviews/:id/ignore')
  ignoreReview(
    @Param('id') id: string,
    @Body('remark') remark?: string | null,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.ignoreReview(id, remark, operator);
  }
}
