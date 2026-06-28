import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppleOfficialPricesService } from './apple-official-prices.service';
import type { BulkDeleteOfficialPriceRecordsDto } from './dto/bulk-delete-official-price-records.dto';
import type { CheckOfficialPriceProviderDto } from './dto/check-official-price-provider.dto';
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

  @Post('sources/bulk-delete')
  bulkRemoveSources(
    @Body() dto: BulkDeleteOfficialPriceRecordsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.bulkRemoveSources(dto, operator);
  }

  @Post('sources/:id/check')
  checkSource(
    @Param('id') id: string,
    @Body() dto: CheckOfficialPriceSourceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.checkSource(id, dto, operator);
  }

  @Get('providers')
  listProviders() {
    return this.officialPricesService.listProviderCatalog();
  }

  @Post('providers/:provider/check')
  checkProvider(
    @Param('provider') provider: string,
    @Body() dto: CheckOfficialPriceProviderDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.checkProvider(provider, dto, operator);
  }

  @Post('providers/check-all')
  checkAllProviders(
    @Body() dto: CheckOfficialPriceProviderDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.checkAllProviders(dto, operator);
  }

  @Post('providers/:provider/check-batch')
  startProviderCheckBatch(
    @Param('provider') provider: string,
    @Body() dto: CheckOfficialPriceProviderDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.startProviderCheckBatch(provider, dto, operator);
  }

  @Post('providers/check-all-batch')
  startAllProvidersCheckBatch(
    @Body() dto: CheckOfficialPriceProviderDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.startAllProvidersCheckBatch(dto, operator);
  }

  @Get('check-batches/latest')
  getLatestCheckBatch() {
    return this.officialPricesService.getLatestCheckBatch();
  }

  @Get('check-batches/:id')
  getCheckBatch(@Param('id') id: string) {
    return this.officialPricesService.getCheckBatch(id);
  }

  @Get('check-batches/:id/results')
  getCheckBatchResults(@Param('id') id: string) {
    return this.officialPricesService.getCheckBatchResults(id);
  }

  @Delete('check-batch-items/:id')
  removeCheckBatchItem(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.officialPricesService.removeCheckBatchItem(id, operator);
  }

  @Post('check-batch-items/bulk-delete')
  bulkRemoveCheckBatchItems(
    @Body() dto: BulkDeleteOfficialPriceRecordsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.bulkRemoveCheckBatchItems(dto, operator);
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

  @Delete('snapshots/:id')
  removeSnapshot(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.officialPricesService.removeSnapshot(id, operator);
  }

  @Post('snapshots/bulk-delete')
  bulkRemoveSnapshots(
    @Body() dto: BulkDeleteOfficialPriceRecordsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.bulkRemoveSnapshots(dto, operator);
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

  @Delete('reviews/:id')
  removeReview(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.officialPricesService.removeReview(id, operator);
  }

  @Post('reviews/bulk-delete')
  bulkRemoveReviews(
    @Body() dto: BulkDeleteOfficialPriceRecordsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.officialPricesService.bulkRemoveReviews(dto, operator);
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
