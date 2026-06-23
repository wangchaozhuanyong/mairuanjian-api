import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AppleServicesService } from './apple-services.service';
import type {
  CreateAppleServiceDto,
  SaveAppleBalancePriceRuleDto
} from './dto/create-apple-service.dto';
import type { CreateAppleServicePlatformMappingDto } from './dto/create-apple-service-platform-mapping.dto';
import type { UpdateAppleServiceDto } from './dto/update-apple-service.dto';
import type { UpdateAppleServicePlatformMappingDto } from './dto/update-apple-service-platform-mapping.dto';

@Controller('apple/services')
export class AppleServicesController {
  constructor(private readonly appleServicesService: AppleServicesService) {}

  @Get()
  @RequirePermissions('apple.service.manage')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('currency') currency?: string,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleServicesService.list({
      page,
      pageSize,
      keyword,
      status,
      currency,
      category,
      sortBy,
      sortOrder
    });
  }

  @Get('balance-price-rule')
  @RequirePermissions('apple.service.manage')
  getBalancePriceRule() {
    return this.appleServicesService.getBalancePriceRule();
  }

  @Get('order-options')
  @RequirePermissions('apple.order.create')
  listOrderOptions() {
    return this.appleServicesService.listOrderOptions();
  }

  @Get('region-prices')
  @RequirePermissions('apple.service.manage')
  listRegionPrices(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('region') region?: string,
    @Query('category') category?: string,
    @Query('serviceId') serviceId?: string,
    @Query('status') status?: string,
    @Query('orderEntryOnly') orderEntryOnly?: string
  ) {
    return this.appleServicesService.listRegionPrices({
      page,
      pageSize,
      region,
      category,
      serviceId,
      status,
      orderEntryOnly
    });
  }

  @Delete('region-prices/:id')
  @RequirePermissions('apple.service.manage')
  removeRegionPrice(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleServicesService.removeRegionPrice(id, operator);
  }

  @Get(':id')
  @RequirePermissions('apple.service.manage')
  get(@Param('id') id: string) {
    return this.appleServicesService.get(id);
  }

  @Get(':id/platform-mappings')
  @RequirePermissions('apple.service.manage')
  listPlatformMappings(@Param('id') id: string) {
    return this.appleServicesService.listPlatformMappings(id);
  }

  @Post()
  @RequirePermissions('apple.service.manage')
  create(@Body() dto: CreateAppleServiceDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleServicesService.create(dto, operator);
  }

  @Patch('balance-price-rule')
  @RequirePermissions('apple.service.manage')
  updateBalancePriceRule(
    @Body() dto: SaveAppleBalancePriceRuleDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleServicesService.updateBalancePriceRule(dto, operator);
  }

  @Post(':id/platform-mappings')
  @RequirePermissions('apple.service.manage')
  createPlatformMapping(
    @Param('id') id: string,
    @Body() dto: CreateAppleServicePlatformMappingDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleServicesService.createPlatformMapping(id, dto, operator);
  }

  @Patch(':id')
  @RequirePermissions('apple.service.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppleServiceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleServicesService.update(id, dto, operator);
  }

  @Delete(':id')
  @RequirePermissions('apple.service.manage')
  remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleServicesService.remove(id, operator);
  }
}

@Controller('apple/service-platform-mappings')
export class AppleServicePlatformMappingsController {
  constructor(private readonly appleServicesService: AppleServicesService) {}

  @Patch(':id')
  @RequirePermissions('apple.service.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppleServicePlatformMappingDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.appleServicesService.updatePlatformMapping(id, dto, operator);
  }

  @Delete(':id')
  @RequirePermissions('apple.service.manage')
  remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.appleServicesService.removePlatformMapping(id, operator);
  }
}
