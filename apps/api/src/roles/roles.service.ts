import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../common/prisma/prisma.service';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        },
        _count: {
          select: {
            userRoles: true
          }
        }
      }
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }]
    });
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    operator?: AuthenticatedUser
  ) {
    if (!Array.isArray(dto.permissionIds)) {
      throw new BadRequestException('permissionIds must be an array');
    }

    const permissionIds = [...new Set(dto.permissionIds)];
    const role = await this.prisma.role.findUnique({
      where: {
        id: roleId
      },
      include: {
        rolePermissions: true
      }
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        id: {
          in: permissionIds
        }
      }
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Some permissions do not exist');
    }

    const beforePermissionIds = role.rolePermissions.map((item) => item.permissionId).sort();

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: {
          roleId
        }
      }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId
        })),
        skipDuplicates: true
      })
    ]);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'system',
      action: 'role_permissions.update',
      objectType: 'role',
      objectId: roleId,
      beforeData: {
        permissionIds: beforePermissionIds
      },
      afterData: {
        permissionIds: permissionIds.sort()
      },
      remark: `Updated permissions for role ${role.code}`
    });

    return this.prisma.role.findUnique({
      where: {
        id: roleId
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }
}
