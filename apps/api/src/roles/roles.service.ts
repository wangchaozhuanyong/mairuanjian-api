import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TimedMemoryCache } from '../common/cache/timed-memory-cache';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

const ROLE_CACHE_TTL_MS = 120_000;
const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_:-]{1,99}$/;

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly cache = new TimedMemoryCache();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  onModuleInit() {
    void this.prewarmCache();
  }

  private async prewarmCache() {
    try {
      await Promise.all([this.listRoles(), this.listPermissions()]);
    } catch {
      // Best effort only; requests can still load the cache on demand.
    }
  }

  listRoles() {
    return this.cache.getOrSet('roles:list', ROLE_CACHE_TTL_MS, () => this.listRolesUncached());
  }

  private listRolesUncached() {
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
    return this.cache.getOrSet('permissions:list', ROLE_CACHE_TTL_MS, () =>
      this.prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }]
      })
    );
  }

  async createRole(dto: CreateRoleDto, operator?: AuthenticatedUser) {
    const name = this.normalizeRequiredText(dto.name, 'Role name', 100);
    const code = this.normalizeRoleCode(dto.code);
    const description = this.normalizeOptionalText(dto.description, 500);

    const existingRole = await this.prisma.role.findUnique({
      where: {
        code
      }
    });

    if (existingRole) {
      throw new BadRequestException('Role code already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        name,
        code,
        description
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

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'system',
      action: 'role.create',
      objectType: 'role',
      objectId: role.id,
      afterData: {
        name,
        code,
        description
      },
      remark: `Created role ${code}`
    });

    this.cache.clear();

    return role;
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

    this.cache.clear();

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

  private normalizeRequiredText(value: unknown, fieldName: string, maxLength: number) {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`${fieldName} must be at most ${maxLength} characters`);
    }

    return normalized;
  }

  private normalizeRoleCode(value: unknown) {
    const code = this.normalizeRequiredText(value, 'Role code', 100);

    if (!ROLE_CODE_PATTERN.test(code)) {
      throw new BadRequestException(
        'Role code must start with a lowercase letter and contain lowercase letters, numbers, underscores, colons or hyphens'
      );
    }

    return code;
  }

  private normalizeOptionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Description must be a string');
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(`Description must be at most ${maxLength} characters`);
    }

    return normalized;
  }
}
