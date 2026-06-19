import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CodeServicesService } from './code-services.service';
import type { CreateCodePlatformMappingDto } from './dto/create-code-platform-mapping.dto';
import type { CreateCodeServiceDto } from './dto/create-code-service.dto';
import type { UpdateCodePlatformMappingDto } from './dto/update-code-platform-mapping.dto';
import type { UpdateCodeServiceDto } from './dto/update-code-service.dto';

@Controller('codes/services')
export class CodeServicesController {
  constructor(private readonly codeServicesService: CodeServicesService) {}

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

  @Get(':id')
  @RequirePermissions('code.service.manage')
  get(@Param('id') id: string) {
    return this.codeServicesService.get(id);
  }

  @Post()
  @RequirePermissions('code.service.manage')
  create(@Body() dto: CreateCodeServiceDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.codeServicesService.create(dto, operator);
  }

  @Patch(':id')
  @RequirePermissions('code.service.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCodeServiceDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.codeServicesService.update(id, dto, operator);
  }

  @Delete(':id')
  @RequirePermissions('code.service.manage')
  remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.codeServicesService.remove(id, operator);
  }
}

@Controller('codes/platform-mappings')
export class CodePlatformMappingsController {
  constructor(private readonly codeServicesService: CodeServicesService) {}

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
  create(@Body() dto: CreateCodePlatformMappingDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.codeServicesService.createPlatformMapping(dto, operator);
  }

  @Patch(':id')
  @RequirePermissions('code.service.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCodePlatformMappingDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.codeServicesService.updatePlatformMapping(id, dto, operator);
  }

  @Delete(':id')
  @RequirePermissions('code.service.manage')
  remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.codeServicesService.removePlatformMapping(id, operator);
  }
}
