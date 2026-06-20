import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type { CreateSourcePlatformDto } from './dto/create-source-platform.dto';
import type { UpdateSourcePlatformDto } from './dto/update-source-platform.dto';
import { SourcePlatformsService } from './source-platforms.service';

@Controller('source-platforms')
export class SourcePlatformsController {
  constructor(
    private readonly sourcePlatformsService: SourcePlatformsService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('source_platform.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.sourcePlatformsService.list({
      page,
      pageSize,
      keyword,
      type,
      status,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('source_platform.view')
  get(@Param('id') id: string) {
    return this.sourcePlatformsService.get(id);
  }

  @Post()
  @RequirePermissions('source_platform.manage')
  async create(@Body() dto: CreateSourcePlatformDto, @CurrentUser() operator?: AuthenticatedUser) {
    const platform = await this.sourcePlatformsService.create(dto, operator);
    this.publishSourcePlatformEvent('common.source_platform.created', 'created', platform.id);
    return platform;
  }

  @Patch(':id')
  @RequirePermissions('source_platform.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSourcePlatformDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const platform = await this.sourcePlatformsService.update(id, dto, operator);
    this.publishSourcePlatformEvent('common.source_platform.updated', 'updated', platform.id);
    return platform;
  }

  @Delete(':id')
  @RequirePermissions('source_platform.manage')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.sourcePlatformsService.remove(id, operator);
    this.publishSourcePlatformEvent('common.source_platform.deleted', 'deleted', id);
    return result;
  }

  private publishSourcePlatformEvent(type: string, action: string, platformId: string) {
    this.realtimeService.publish({
      type,
      module: 'common',
      entity: 'source_platform',
      action,
      resourceId: platformId,
      scope: {
        platformId
      }
    });
  }
}
