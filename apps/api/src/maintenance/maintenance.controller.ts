import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Public, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
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
  constructor(private readonly maintenanceService: MaintenanceService) {}

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
  createAnnouncement(
    @Body() dto: SaveAnnouncementInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.createAnnouncement(dto, operator);
  }

  @Patch('announcements/:id')
  @RequirePermissions('maintenance.announcement.manage')
  updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: Partial<SaveAnnouncementInput>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.updateAnnouncement(id, dto, operator);
  }

  @Delete('announcements/:id')
  @RequirePermissions('maintenance.announcement.manage')
  removeAnnouncement(@Param('id') id: string, @CurrentUser() operator?: AuthenticatedUser) {
    return this.maintenanceService.removeAnnouncement(id, operator);
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
  saveMode(@Body() dto: SaveMaintenanceModeInput, @CurrentUser() operator?: AuthenticatedUser) {
    return this.maintenanceService.saveMaintenanceMode(dto, operator);
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
  createAppVersion(@Body() dto: SaveAppVersionInput, @CurrentUser() operator?: AuthenticatedUser) {
    return this.maintenanceService.createAppVersion(dto, operator);
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
  createFeatureFlag(
    @Body() dto: SaveFeatureFlagInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.createFeatureFlag(dto, operator);
  }

  @Patch('feature-flags/:id')
  @RequirePermissions('maintenance.feature_flag.manage')
  updateFeatureFlag(
    @Param('id') id: string,
    @Body() dto: Partial<SaveFeatureFlagInput>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.updateFeatureFlag(id, dto, operator);
  }

  @Get('menu-config')
  @RequirePermissions('maintenance.menu_config.manage')
  getMenuConfig() {
    return this.maintenanceService.getConfig('maintenance_menu_config');
  }

  @Patch('menu-config')
  @RequirePermissions('maintenance.menu_config.manage')
  saveMenuConfig(
    @Body() dto: SaveMaintenanceParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.saveConfig('maintenance_menu_config', dto, operator);
  }

  @Get('theme-config')
  @RequirePermissions('maintenance.theme_config.manage')
  getThemeConfig() {
    return this.maintenanceService.getConfig('maintenance_theme_config');
  }

  @Patch('theme-config')
  @RequirePermissions('maintenance.theme_config.manage')
  saveThemeConfig(
    @Body() dto: SaveMaintenanceParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.saveConfig('maintenance_theme_config', dto, operator);
  }

  @Get('launch-checklist')
  @RequirePermissions('maintenance.system_parameter.manage')
  getLaunchChecklist() {
    return this.maintenanceService.getLaunchChecklist();
  }

  @Patch('launch-checklist')
  @RequirePermissions('maintenance.system_parameter.manage')
  saveLaunchChecklist(
    @Body() dto: SaveLaunchChecklistInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.saveLaunchChecklist(dto, operator);
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
  createSystemParameter(
    @Body() dto: SaveMaintenanceParameterInput,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.createSystemParameter(dto, operator);
  }

  @Patch('system-parameters/:id')
  @RequirePermissions('maintenance.system_parameter.manage')
  updateSystemParameter(
    @Param('id') id: string,
    @Body() dto: Partial<SaveMaintenanceParameterInput>,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.maintenanceService.updateSystemParameter(id, dto, operator);
  }
}
