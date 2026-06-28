import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { CodeServicesService } from './code-services.service';
import type { CreateCodePlatformMappingDto } from './dto/create-code-platform-mapping.dto';
import type { CreateCodeServiceDto } from './dto/create-code-service.dto';
import type { UpdateCodePlatformMappingDto } from './dto/update-code-platform-mapping.dto';
import type { UpdateCodeServiceDto } from './dto/update-code-service.dto';

@Controller('codes/services')
export class CodeServicesController {
  constructor(
    private readonly codeServicesService: CodeServicesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('code.service.manage')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('deliveryMode') deliveryMode?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.codeServicesService.list({
      page,
      pageSize,
      keyword,
      status,
      deliveryMode,
      sortBy,
      sortOrder
    });
  }

  @Get('order-options')
  @RequirePermissions('code.order.view')
  listOrderOptions() {
    return this.codeServicesService.listOperationOptions();
  }

  @Get('inventory-options')
  @RequirePermissions('code.inventory.view')
  listInventoryOptions() {
    return this.codeServicesService.listOperationOptions();
  }

  @Get(':id')
  @RequirePermissions('code.service.manage')
  get(@Param('id') id: string) {
    return this.codeServicesService.get(id);
  }

  @Post()
  @RequirePermissions('code.service.manage')
  async create(@Body() dto: CreateCodeServiceDto, @CurrentUser() operator?: AuthenticatedUser) {
    const service = await this.codeServicesService.create(dto, operator);
    this.publishCodeServiceEvent('code.service.created', 'service', 'created', service.id);
    return service;
  }

  @Patch(':id')
  @RequirePermissions('code.service.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCodeServiceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const service = await this.codeServicesService.update(id, dto, operator);
    this.publishCodeServiceEvent('code.service.updated', 'service', 'updated', service.id);
    return service;
  }

  @Delete(':id')
  @RequirePermissions('code.service.manage')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.codeServicesService.remove(id, operator);
    this.publishCodeServiceEvent('code.service.deleted', 'service', 'deleted', id);
    return result;
  }

  private publishCodeServiceEvent(
    type: string,
    entity: string,
    action: string,
    resourceId?: string | null
  ) {
    this.realtimeService.publish({
      type,
      module: 'code',
      entity,
      action,
      resourceId
    });
  }
}

@Controller('codes/platform-mappings')
export class CodePlatformMappingsController {
  constructor(
    private readonly codeServicesService: CodeServicesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('code.service.manage')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('serviceId') serviceId?: string,
    @Query('platformId') platformId?: string,
    @Query('enabled') enabled?: string
  ) {
    return this.codeServicesService.listPlatformMappings({
      page,
      pageSize,
      keyword,
      serviceId,
      platformId,
      enabled
    });
  }

  @Post()
  @RequirePermissions('code.service.manage')
  async create(
    @Body() dto: CreateCodePlatformMappingDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const mapping = await this.codeServicesService.createPlatformMapping(dto, operator);
    this.publishCodeMappingEvent(
      'code.platform_mapping.created',
      'created',
      mapping.id,
      mapping.serviceId
    );
    return mapping;
  }

  @Patch(':id')
  @RequirePermissions('code.service.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCodePlatformMappingDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const mapping = await this.codeServicesService.updatePlatformMapping(id, dto, operator);
    this.publishCodeMappingEvent(
      'code.platform_mapping.updated',
      'updated',
      mapping.id,
      mapping.serviceId
    );
    return mapping;
  }

  @Delete(':id')
  @RequirePermissions('code.service.manage')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.codeServicesService.removePlatformMapping(id, operator);
    this.publishCodeMappingEvent('code.platform_mapping.deleted', 'deleted', id);
    return result;
  }

  private publishCodeMappingEvent(
    type: string,
    action: string,
    resourceId?: string | null,
    serviceId?: string | null
  ) {
    this.realtimeService.publish({
      type,
      module: 'code',
      entity: 'platform_mapping',
      action,
      resourceId,
      scope: {
        serviceId
      }
    });
  }
}
