import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type {
  SaveAnnouncementInput,
  SaveAppVersionInput,
  SaveFeatureFlagInput,
  SaveLaunchChecklistInput,
  SaveMaintenanceModeInput,
  SaveMaintenanceParameterInput
} from './maintenance.service';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('overview')
  @RequirePermissions('maintenance.announcement.view')
  overview() {
    return this.maintenanceService.overview();
  }

  @Get('announcements')
  @RequirePermissions('maintenance.announcement.view')
  listAnnouncements(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('level') level?: string,
    @Query('enabled') enabled?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.maintenanceService.listAnnouncements({
      page,
      pageSize,
      keyword,
      level,
      enabled,
      sortBy,
      sortOrder
    });
  }

  @Post('announcements')
  @RequirePermissions('maintenance.announcement.manage')
  async createAnnouncement(
    @Body() dto: SaveAnnouncementInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const announcement = await this.maintenanceService.createAnnouncement(dto, operator);
    this.publishMaintenanceEvent(
      'maintenance.announcement.created',
      'announcement',
      'created',
      announcement.id
    );
    return announcement;
  }

  @Patch('announcements/:id')
  @RequirePermissions('maintenance.announcement.manage')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: Partial<SaveAnnouncementInput>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const announcement = await this.maintenanceService.updateAnnouncement(id, dto, operator);
    this.publishMaintenanceEvent('maintenance.announcement.updated', 'announcement', 'updated', id);
    return announcement;
  }

  @Delete('announcements/:id')
  @RequirePermissions('maintenance.announcement.manage')
  async removeAnnouncement(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    const result = await this.maintenanceService.removeAnnouncement(id, operator);
    this.publishMaintenanceEvent('maintenance.announcement.deleted', 'announcement', 'deleted', id);
    return result;
  }

  @Get('mode')
  @RequirePermissions('maintenance.mode.view')
  getMode() {
    return this.maintenanceService.getMaintenanceMode();
  }

  @Public()
  @Get('mode/public')
  getPublicMode() {
    return this.maintenanceService.getPublicMaintenanceMode();
  }

  @Patch('mode')
  @RequirePermissions('maintenance.mode.manage')
  async saveMode(
    @Body() dto: SaveMaintenanceModeInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const mode = await this.maintenanceService.saveMaintenanceMode(dto, operator);
    this.publishMaintenanceEvent('maintenance.mode.updated', 'maintenance_mode', 'updated');
    return mode;
  }

  @Get('app-versions')
  @RequirePermissions('maintenance.version.view')
  listAppVersions(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.maintenanceService.listAppVersions({
      page,
      pageSize,
      keyword,
      status,
      sortBy,
      sortOrder
    });
  }

  @Post('app-versions')
  @RequirePermissions('maintenance.version.manage')
  async createAppVersion(
    @Body() dto: SaveAppVersionInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const version = await this.maintenanceService.createAppVersion(dto, operator);
    this.publishMaintenanceEvent(
      'maintenance.app_version.created',
      'app_version',
      'created',
      version.id
    );
    return version;
  }

  @Get('changelogs')
  @RequirePermissions('maintenance.version.view')
  listChangelogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.maintenanceService.listAppVersions({
      page,
      pageSize,
      keyword,
      status,
      sortBy,
      sortOrder
    });
  }

  @Get('feature-flags')
  @RequirePermissions('maintenance.feature_flag.view')
  listFeatureFlags(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('enabled') enabled?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.maintenanceService.listFeatureFlags({
      page,
      pageSize,
      keyword,
      enabled,
      sortBy,
      sortOrder
    });
  }

  @Post('feature-flags')
  @RequirePermissions('maintenance.feature_flag.manage')
  async createFeatureFlag(
    @Body() dto: SaveFeatureFlagInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const flag = await this.maintenanceService.createFeatureFlag(dto, operator);
    this.publishMaintenanceEvent(
      'maintenance.feature_flag.created',
      'feature_flag',
      'created',
      flag.id
    );
    return flag;
  }

  @Patch('feature-flags/:id')
  @RequirePermissions('maintenance.feature_flag.manage')
  async updateFeatureFlag(
    @Param('id') id: string,
    @Body() dto: Partial<SaveFeatureFlagInput>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const flag = await this.maintenanceService.updateFeatureFlag(id, dto, operator);
    this.publishMaintenanceEvent('maintenance.feature_flag.updated', 'feature_flag', 'updated', id);
    return flag;
  }

  @Get('menu-config')
  @RequirePermissions('maintenance.menu_config.manage')
  getMenuConfig() {
    return this.maintenanceService.getConfig('maintenance_menu_config');
  }

  @Patch('menu-config')
  @RequirePermissions('maintenance.menu_config.manage')
  async saveMenuConfig(
    @Body() dto: SaveMaintenanceParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const config = await this.maintenanceService.saveConfig(
      'maintenance_menu_config',
      dto,
      operator
    );
    this.publishMaintenanceEvent('maintenance.menu_config.updated', 'menu_config', 'updated');
    return config;
  }

  @Get('theme-config')
  @RequirePermissions('maintenance.theme_config.manage')
  getThemeConfig() {
    return this.maintenanceService.getConfig('maintenance_theme_config');
  }

  @Patch('theme-config')
  @RequirePermissions('maintenance.theme_config.manage')
  async saveThemeConfig(
    @Body() dto: SaveMaintenanceParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const config = await this.maintenanceService.saveConfig(
      'maintenance_theme_config',
      dto,
      operator
    );
    this.publishMaintenanceEvent('maintenance.theme_config.updated', 'theme_config', 'updated');
    return config;
  }

  @Get('launch-checklist')
  @RequirePermissions('maintenance.system_parameter.manage')
  getLaunchChecklist() {
    return this.maintenanceService.getLaunchChecklist();
  }

  @Patch('launch-checklist')
  @RequirePermissions('maintenance.system_parameter.manage')
  async saveLaunchChecklist(
    @Body() dto: SaveLaunchChecklistInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const checklist = await this.maintenanceService.saveLaunchChecklist(dto, operator);
    this.publishMaintenanceEvent(
      'maintenance.launch_checklist.updated',
      'launch_checklist',
      'updated'
    );
    return checklist;
  }

  @Get('system-parameters')
  @RequirePermissions('maintenance.system_parameter.manage')
  listSystemParameters(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ) {
    return this.maintenanceService.listSystemParameters({
      page,
      pageSize,
      keyword,
      sortBy,
      sortOrder
    });
  }

  @Post('system-parameters')
  @RequirePermissions('maintenance.system_parameter.manage')
  async createSystemParameter(
    @Body() dto: SaveMaintenanceParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const parameter = await this.maintenanceService.createSystemParameter(dto, operator);
    this.publishMaintenanceEvent(
      'maintenance.system_parameter.created',
      'system_parameter',
      'created',
      parameter.id
    );
    return parameter;
  }

  @Patch('system-parameters/:id')
  @RequirePermissions('maintenance.system_parameter.manage')
  async updateSystemParameter(
    @Param('id') id: string,
    @Body() dto: Partial<SaveMaintenanceParameterInput>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const parameter = await this.maintenanceService.updateSystemParameter(id, dto, operator);
    this.publishMaintenanceEvent(
      'maintenance.system_parameter.updated',
      'system_parameter',
      'updated',
      id
    );
    return parameter;
  }

  private publishMaintenanceEvent(
    type: string,
    entity: string,
    action: string,
    resourceId?: string | null
  ) {
    this.realtimeService.publish({
      type,
      module: 'maintenance',
      entity,
      action,
      resourceId: resourceId ?? null
    });
  }
}
