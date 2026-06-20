import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateInAppNotificationDto } from './dto/create-in-app-notification.dto';
import type { SaveNotificationRuleDto } from './dto/save-notification-rule.dto';
import type { SaveNotificationTemplateDto } from './dto/save-notification-template.dto';
import type { SaveTelegramConfigDto } from './dto/save-telegram-config.dto';
import type { TestTelegramDto } from './dto/test-telegram.dto';
import { NotificationsService } from './notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('overview')
  @RequirePermissions('notification.view')
  overview(@CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.overview(operator);
  }

  @Get('nav-badges')
  @RequirePermissions('notification.view')
  navBadges(@CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.navBadges(operator);
  }

  @Get('nav-item-badges')
  navItemBadges(@CurrentUser() operator?: AuthenticatedUser) {
    return this.notificationsService.navItemBadges(operator);
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
  async createRule(
    @Body() dto: SaveNotificationRuleDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const rule = await this.notificationsService.createRule(dto, operator);
    this.publishNotificationEvent('notification.rule.created', 'rule', 'created', rule.id);
    return rule;
  }

  @Get('rules/:id')
  @RequirePermissions('notification.rule.view')
  getRule(@Param('id') id: string) {
    return this.notificationsService.getRule(id);
  }

  @Patch('rules/:id')
  @RequirePermissions('notification.rule.manage')
  async updateRule(
    @Param('id') id: string,
    @Body() dto: Partial<SaveNotificationRuleDto>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const rule = await this.notificationsService.updateRule(id, dto, operator);
    this.publishNotificationEvent('notification.rule.updated', 'rule', 'updated', id);
    return rule;
  }

  @Delete('rules/:id')
  @RequirePermissions('notification.rule.manage')
  async removeRule(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.notificationsService.removeRule(id, operator);
    this.publishNotificationEvent('notification.rule.deleted', 'rule', 'deleted', id);
    return result;
  }

  @Patch('rules/:id/enable')
  @RequirePermissions('notification.rule.manage')
  async enableRule(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const rule = await this.notificationsService.setRuleEnabled(id, true, operator);
    this.publishNotificationEvent('notification.rule.enabled', 'rule', 'enabled', id);
    return rule;
  }

  @Patch('rules/:id/disable')
  @RequirePermissions('notification.rule.manage')
  async disableRule(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const rule = await this.notificationsService.setRuleEnabled(id, false, operator);
    this.publishNotificationEvent('notification.rule.disabled', 'rule', 'disabled', id);
    return rule;
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
  async createTemplate(
    @Body() dto: SaveNotificationTemplateDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const template = await this.notificationsService.createTemplate(dto, operator);
    this.publishNotificationEvent(
      'notification.template.created',
      'template',
      'created',
      template.id
    );
    return template;
  }

  @Get('templates/:id')
  @RequirePermissions('notification.template.view')
  getTemplate(@Param('id') id: string) {
    return this.notificationsService.getTemplate(id);
  }

  @Patch('templates/:id')
  @RequirePermissions('notification.template.manage')
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: Partial<SaveNotificationTemplateDto>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const template = await this.notificationsService.updateTemplate(id, dto, operator);
    this.publishNotificationEvent('notification.template.updated', 'template', 'updated', id);
    return template;
  }

  @Delete('templates/:id')
  @RequirePermissions('notification.template.manage')
  async removeTemplate(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.notificationsService.removeTemplate(id, operator);
    this.publishNotificationEvent('notification.template.deleted', 'template', 'deleted', id);
    return result;
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
  async retryLog(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const log = await this.notificationsService.retryLog(id, operator);
    this.publishNotificationEvent('notification.log.retried', 'log', 'retried', id);
    return log;
  }

  @Get('telegram')
  @RequirePermissions('notification.telegram.view')
  listTelegramConfigs() {
    return this.notificationsService.listTelegramConfigs();
  }

  @Post('telegram')
  @RequirePermissions('notification.telegram.manage')
  async createTelegramConfig(
    @Body() dto: SaveTelegramConfigDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const config = await this.notificationsService.createTelegramConfig(dto, operator);
    this.publishNotificationEvent(
      'notification.telegram_config.created',
      'telegram_config',
      'created',
      config.id
    );
    return config;
  }

  @Patch('telegram/:id')
  @RequirePermissions('notification.telegram.manage')
  async updateTelegramConfig(
    @Param('id') id: string,
    @Body() dto: Partial<SaveTelegramConfigDto>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const config = await this.notificationsService.updateTelegramConfig(id, dto, operator);
    this.publishNotificationEvent(
      'notification.telegram_config.updated',
      'telegram_config',
      'updated',
      id
    );
    return config;
  }

  @Delete('telegram/:id')
  @RequirePermissions('notification.telegram.manage')
  async removeTelegramConfig(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.notificationsService.removeTelegramConfig(id, operator);
    this.publishNotificationEvent(
      'notification.telegram_config.deleted',
      'telegram_config',
      'deleted',
      id
    );
    return result;
  }

  @Post('telegram/test')
  @RequirePermissions('notification.telegram.test')
  async testTelegram(@Body() dto: TestTelegramDto, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.notificationsService.testTelegram(dto, operator);
    this.publishNotificationEvent('notification.telegram.tested', 'telegram_config', 'tested');
    return result;
  }

  @Get(':id')
  @RequirePermissions('notification.view')
  getNotification(@Param('id') id: string) {
    return this.notificationsService.getNotification(id);
  }

  @Patch(':id/read')
  @RequirePermissions('notification.view')
  async markRead(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const log = await this.notificationsService.markRead(id, operator);
    this.publishNotificationEvent('notification.message.read', 'log', 'read', id);
    return log;
  }

  @Patch('read-all')
  @RequirePermissions('notification.view')
  async markAllRead(@CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.notificationsService.markAllRead(operator);
    this.publishNotificationEvent('notification.message.read_all', 'log', 'read_all');
    return result;
  }

  @Post('system')
  @RequirePermissions('notification.rule.manage')
  async createInApp(@Body() dto: CreateInAppNotificationDto) {
    const log = await this.notificationsService.createInApp(dto);
    this.publishNotificationEvent('notification.message.created', 'log', 'created', log.id);
    return log;
  }

  private publishNotificationEvent(
    type: string,
    entity: string,
    action: string,
    resourceId?: string
  ) {
    this.realtimeService.publish({
      type,
      module: 'notification',
      entity,
      action,
      resourceId: resourceId ?? null
    });
  }
}
