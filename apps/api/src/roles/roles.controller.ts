import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from '../realtime/realtime.service';
import type { CreateRoleDto } from './dto/create-role.dto';
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

  @Post('roles')
  @RequirePermissions('system.role_manage')
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() operator?: AuthenticatedUser) {
    const role = await this.rolesService.createRole(dto, operator);
    this.realtimeService.publish({
      type: 'system.role.created',
      module: 'system',
      entity: 'role',
      action: 'created',
      resourceId: role.id
    });
    return role;
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
