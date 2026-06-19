import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateSourcePlatformDto } from './dto/create-source-platform.dto';
import type { UpdateSourcePlatformDto } from './dto/update-source-platform.dto';
import { SourcePlatformsService } from './source-platforms.service';

@Controller('source-platforms')
export class SourcePlatformsController {
  constructor(private readonly sourcePlatformsService: SourcePlatformsService) {}

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
  create(@Body() dto: CreateSourcePlatformDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.sourcePlatformsService.create(dto, operator);
  }

  @Patch(':id')
  @RequirePermissions('source_platform.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSourcePlatformDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.sourcePlatformsService.update(id, dto, operator);
  }

  @Delete(':id')
  @RequirePermissions('source_platform.manage')
  remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.sourcePlatformsService.remove(id, operator);
  }
}
