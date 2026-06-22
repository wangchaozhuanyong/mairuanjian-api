import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleAccountSourceChannelsService } from './apple-account-source-channels.service';
import type { CreateAppleAccountSourceChannelDto } from './dto/create-apple-account-source-channel.dto';
import type { UpdateAppleAccountSourceChannelDto } from './dto/update-apple-account-source-channel.dto';

@Controller('apple/account-source-channels')
export class AppleAccountSourceChannelsController {
  constructor(
    private readonly appleAccountSourceChannelsService: AppleAccountSourceChannelsService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  @RequirePermissions('apple.account.view')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.appleAccountSourceChannelsService.list({
      page,
      pageSize,
      keyword,
      status,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  @RequirePermissions('apple.account.view')
  get(@Param('id') id: string) {
    return this.appleAccountSourceChannelsService.get(id);
  }

  @Post()
  @RequirePermissions('apple.account.update')
  async create(
    @Body() dto: CreateAppleAccountSourceChannelDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const channel = await this.appleAccountSourceChannelsService.create(dto, operator);
    this.publishSourceChannelEvent('apple.account_source_channel.created', 'created', channel.id);
    return channel;
  }

  @Patch(':id')
  @RequirePermissions('apple.account.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppleAccountSourceChannelDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const channel = await this.appleAccountSourceChannelsService.update(id, dto, operator);
    this.publishSourceChannelEvent('apple.account_source_channel.updated', 'updated', channel.id);
    return channel;
  }

  @Delete(':id')
  @RequirePermissions('apple.account.update')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.appleAccountSourceChannelsService.remove(id, operator);
    this.publishSourceChannelEvent('apple.account_source_channel.deleted', 'deleted', id);
    return result;
  }

  private publishSourceChannelEvent(type: string, action: string, channelId: string) {
    this.realtimeService.publish({
      type,
      module: 'apple',
      entity: 'account_source_channel',
      action,
      resourceId: channelId,
      scope: {
        channelId
      }
    });
  }
}
