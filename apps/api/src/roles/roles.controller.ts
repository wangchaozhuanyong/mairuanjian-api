import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { RolesService } from './roles.service';

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

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
  updateRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() operator?: AuthenticatedUser
  ) {
    return this.rolesService.updateRolePermissions(id, dto, operator);
  }
}
