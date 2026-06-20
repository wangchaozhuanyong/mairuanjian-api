import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import type { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageTemplatesService } from './message-templates.service';

@Controller('message-templates')
@RequirePermissions('code.delivery_template.manage')
export class MessageTemplatesController {
  constructor(
    private readonly messageTemplatesService: MessageTemplatesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('type') type?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.messageTemplatesService.list({
      page,
      pageSize,
      keyword,
      type,
      channel,
      status,
      sortBy,
      sortOrder
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.messageTemplatesService.get(id);
  }

  @Post()
  async create(@Body() dto: CreateMessageTemplateDto, @CurrentUser() operator?: AuthenticatedUser) {
    const template = await this.messageTemplatesService.create(dto, operator);
    this.publishMessageTemplateEvent('code.delivery_template.created', 'created', template.id);
    return template;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const template = await this.messageTemplatesService.update(id, dto, operator);
    this.publishMessageTemplateEvent('code.delivery_template.updated', 'updated', template.id);
    return template;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.messageTemplatesService.remove(id, operator);
    this.publishMessageTemplateEvent('code.delivery_template.deleted', 'deleted', id);
    return result;
  }

  private publishMessageTemplateEvent(type: string, action: string, templateId: string) {
    this.realtimeService.publish({
      type,
      module: 'code',
      entity: 'delivery_template',
      action,
      resourceId: templateId
    });
  }
}
