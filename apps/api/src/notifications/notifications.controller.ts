import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateInAppNotificationDto } from './dto/create-in-app-notification.dto';
import type { SaveNotificationRuleDto } from './dto/save-notification-rule.dto';
import type { SaveNotificationTemplateDto } from './dto/save-notification-template.dto';
import type { SaveTelegramConfigDto } from './dto/save-telegram-config.dto';
import type { TestTelegramDto } from './dto/test-telegram.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('overview')
  @RequirePermissions('notification.view')
  overview(@CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.overview(operator);
  }

  @Get()
  @RequirePermissions('notification.view')
  listInApp(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('unread') unread?: string,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.notificationsService.listInApp(
      { page, pageSize, keyword, status, unread },
      operator
    );
  }

  @Get('rules')
  @RequirePermissions('notification.rule.view')
  listRules(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('level') level?: string,
    @Query('enabled') enabled?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.notificationsService.listRules({
      page,
      pageSize,
      keyword,
      module,
      level,
      enabled,
      sortBy,
      sortOrder
    });
  }

  @Post('rules')
  @RequirePermissions('notification.rule.manage')
  createRule(@Body() dto: SaveNotificationRuleDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.createRule(dto, operator);
  }

  @Get('rules/:id')
  @RequirePermissions('notification.rule.view')
  getRule(@Param('id') id: string) {
    return this.notificationsService.getRule(id);
  }

  @Patch('rules/:id')
  @RequirePermissions('notification.rule.manage')
  updateRule(
    @Param('id') id: string,
    @Body() dto: Partial<SaveNotificationRuleDto>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.notificationsService.updateRule(id, dto, operator);
  }

  @Delete('rules/:id')
  @RequirePermissions('notification.rule.manage')
  removeRule(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.removeRule(id, operator);
  }

  @Patch('rules/:id/enable')
  @RequirePermissions('notification.rule.manage')
  enableRule(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.setRuleEnabled(id, true, operator);
  }

  @Patch('rules/:id/disable')
  @RequirePermissions('notification.rule.manage')
  disableRule(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.setRuleEnabled(id, false, operator);
  }

  @Get('templates')
  @RequirePermissions('notification.template.view')
  listTemplates(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('eventCode') eventCode?: string,
    @Query('channel') channel?: string,
    @Query('enabled') enabled?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.notificationsService.listTemplates({
      page,
      pageSize,
      keyword,
      eventCode,
      channel,
      enabled,
      sortBy,
      sortOrder
    });
  }

  @Post('templates')
  @RequirePermissions('notification.template.manage')
  createTemplate(
    @Body() dto: SaveNotificationTemplateDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.notificationsService.createTemplate(dto, operator);
  }

  @Get('templates/:id')
  @RequirePermissions('notification.template.view')
  getTemplate(@Param('id') id: string) {
    return this.notificationsService.getTemplate(id);
  }

  @Patch('templates/:id')
  @RequirePermissions('notification.template.manage')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: Partial<SaveNotificationTemplateDto>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.notificationsService.updateTemplate(id, dto, operator);
  }

  @Delete('templates/:id')
  @RequirePermissions('notification.template.manage')
  removeTemplate(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.removeTemplate(id, operator);
  }

  @Post('templates/:id/render')
  @RequirePermissions('notification.template.view')
  renderTemplate(@Param('id') id: string, @Body() payload: Record<string, unknown>) {
    return this.notificationsService.renderTemplate(id, payload);
  }

  @Get('logs')
  @RequirePermissions('notification.log.view')
  listLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('module') module?: string,
    @Query('eventCode') eventCode?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.notificationsService.listLogs({
      page,
      pageSize,
      keyword,
      module,
      eventCode,
      channel,
      status,
      sortBy,
      sortOrder
    });
  }

  @Get('logs/:id')
  @RequirePermissions('notification.log.view')
  getLog(@Param('id') id: string) {
    return this.notificationsService.getLog(id);
  }

  @Post('logs/:id/retry')
  @RequirePermissions('notification.log.view')
  retryLog(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.retryLog(id, operator);
  }

  @Get('telegram')
  @RequirePermissions('notification.telegram.view')
  listTelegramConfigs() {
    return this.notificationsService.listTelegramConfigs();
  }

  @Post('telegram')
  @RequirePermissions('notification.telegram.manage')
  createTelegramConfig(
    @Body() dto: SaveTelegramConfigDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.notificationsService.createTelegramConfig(dto, operator);
  }

  @Patch('telegram/:id')
  @RequirePermissions('notification.telegram.manage')
  updateTelegramConfig(
    @Param('id') id: string,
    @Body() dto: Partial<SaveTelegramConfigDto>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.notificationsService.updateTelegramConfig(id, dto, operator);
  }

  @Delete('telegram/:id')
  @RequirePermissions('notification.telegram.manage')
  removeTelegramConfig(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.removeTelegramConfig(id, operator);
  }

  @Post('telegram/test')
  @RequirePermissions('notification.telegram.test')
  testTelegram(@Body() dto: TestTelegramDto, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.testTelegram(dto, operator);
  }

  @Get(':id')
  @RequirePermissions('notification.view')
  getNotification(@Param('id') id: string) {
    return this.notificationsService.getNotification(id);
  }

  @Patch(':id/read')
  @RequirePermissions('notification.view')
  markRead(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.markRead(id, operator);
  }

  @Patch('read-all')
  @RequirePermissions('notification.view')
  markAllRead(@CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.markAllRead(operator);
  }

  @Post('system')
  @RequirePermissions('notification.rule.manage')
  createInApp(@Body() dto: CreateInAppNotificationDto) {
    return this.notificationsService.createInApp(dto);
  }
}
