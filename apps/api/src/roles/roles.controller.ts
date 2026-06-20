import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolesService } from './roles.service';

@Controller()
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly realtimeService: RealtimeService
  ) {}

  @Get('roles')
  @RequirePermissions('system.role_manage')
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  @RequirePermissions('system.permission_manage')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('system.role_manage', 'system.permission_manage')
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    const role = await this.rolesService.updateRolePermissions(id, dto, operator);
    this.realtimeService.publish({
      type: 'system.role.permissions_updated',
      module: 'system',
      entity: 'role',
      action: 'permissions_updated',
      resourceId: id
    });
    return role;
  }
}
