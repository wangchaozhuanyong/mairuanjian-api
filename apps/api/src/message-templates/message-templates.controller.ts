import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import type { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageTemplatesService } from './message-templates.service';

@Controller('message-templates')
@RequirePermissions('message_template.manage')
export class MessageTemplatesController {
  constructor(private readonly messageTemplatesService: MessageTemplatesService) {}

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
  create(@Body() dto: CreateMessageTemplateDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.messageTemplatesService.create(dto, operator);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMessageTemplateDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.messageTemplatesService.update(id, dto, operator);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.messageTemplatesService.remove(id, operator);
  }
}
