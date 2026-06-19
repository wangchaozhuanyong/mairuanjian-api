import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma, UserStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { hashPassword } from '../auth/password-hasher';
import { getPagination, type PaginationQuery } from '../common/pagination';
import type { CreateUserDto } from './dto/create-user.dto';
import { SecurityService } from '../security/security.service';
import type { UpdateUserDto } from './dto/update-user.dto';

interface ListUsersQuery extends PaginationQuery {
  keyword?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

const USER_SORT_FIELDS: Record<string, keyof Prisma.UserOrderByWithRelationInput> = {
  username: 'username',
  displayName: 'displayName',
  status: 'status',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

const userSelect = {
  id: true,
  username: true,
  displayName: true,
  phone: true,
  email: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    include: {
      role: true
    }
  }
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly securityService: SecurityService
  ) {}

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'active',
        deletedAt: null
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.userRoles.map((userRole) => userRole.role.code);
    const permissions = user.userRoles.flatMap((userRole) =>
      userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code)
    );

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: [...new Set(roles)],
      permissions: [...new Set(permissions)]
    };
  }

  async listUsers(query: ListUsersQuery) {
    const pagination = getPagination(query);
    const status = this.parseStatus(query.status, false);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: status ?? undefined,
      OR: query.keyword
        ? [
            {
              username: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            },
            {
              displayName: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            },
            {
              email: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            },
            {
              phone: {
                contains: query.keyword,
                mode: 'insensitive'
              }
            }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.user.count({
        where
      })
    ]);

    return {
      items: items.map((user) => this.toUserResponse(user)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: userSelect
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserResponse(user);
  }

  async createUser(dto: CreateUserDto, operator?: AuthenticatedUser) {
    this.assertRequiredString(dto.username, 'username');
    this.assertRequiredString(dto.password, 'password');
    this.assertRequiredString(dto.displayName, 'displayName');
    await this.assertPasswordMatchesPolicy(dto.password);

    const username = dto.username.trim();
    const existingUser = await this.prisma.user.findUnique({
      where: {
        username
      }
    });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const roleIds = await this.resolveRoleIds(dto.roleIds);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username,
          passwordHash: await hashPassword(dto.password),
          displayName: dto.displayName.trim(),
          phone: this.normalizeNullableString(dto.phone),
          email: this.normalizeNullableString(dto.email)
        }
      });

      if (roleIds.length) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: createdUser.id,
            roleId
          })),
          skipDuplicates: true
        });
      }

      return createdUser;
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'system',
      action: 'user.create',
      objectType: 'user',
      objectId: user.id,
      afterData: {
        username,
        displayName: dto.displayName,
        roleIds
      },
      remark: `Created user ${username}`
    });

    return this.getUserDetail(user.id);
  }

  async updateUser(userId: string, dto: UpdateUserDto, operator?: AuthenticatedUser) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: userSelect
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const status = this.parseStatus(dto.status, true);
    const roleIds = dto.roleIds === undefined ? undefined : await this.resolveRoleIds(dto.roleIds);
    const data: Prisma.UserUpdateInput = {};

    if (dto.displayName !== undefined) {
      this.assertRequiredString(dto.displayName, 'displayName');
      data.displayName = dto.displayName.trim();
    }

    if (dto.phone !== undefined) {
      data.phone = this.normalizeNullableString(dto.phone);
    }

    if (dto.email !== undefined) {
      data.email = this.normalizeNullableString(dto.email);
    }

    if (status !== undefined) {
      data.status = status;
    }

    if (dto.password !== undefined && dto.password !== '') {
      await this.assertPasswordMatchesPolicy(dto.password);
      data.passwordHash = await hashPassword(dto.password);
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.user.update({
          where: {
            id: userId
          },
          data
        });
      }

      if (roleIds !== undefined) {
        await tx.userRole.deleteMany({
          where: {
            userId
          }
        });

        if (roleIds.length) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({
              userId,
              roleId
            })),
            skipDuplicates: true
          });
        }
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'system',
      action: 'user.update',
      objectType: 'user',
      objectId: userId,
      beforeData: this.toUserResponse(existingUser),
      afterData: {
        ...dto,
        password: dto.password ? '[updated]' : undefined
      },
      remark: `Updated user ${existingUser.username}`
    });

    return this.getUserDetail(userId);
  }

  private async resolveRoleIds(roleIds?: string[]) {
    const uniqueRoleIds = [...new Set(roleIds ?? [])];
    if (!uniqueRoleIds.length) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: {
          in: uniqueRoleIds
        }
      }
    });

    if (roles.length !== uniqueRoleIds.length) {
      throw new BadRequestException('Some roles do not exist');
    }

    return uniqueRoleIds;
  }

  private parseStatus(value: unknown, optional: boolean) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'active' || value === 'disabled') {
      return value satisfies UserStatus;
    }

    if (optional) {
      throw new BadRequestException('Invalid user status');
    }

    return undefined;
  }

  private async assertPasswordMatchesPolicy(password: string) {
    const setting = await this.securityService.getPasswordPolicy();
    const policy = setting.value as Record<string, unknown>;
    const minLength = this.getPolicyNumber(policy.minLength, 8);
    const failures: string[] = [];

    if (password.length < minLength) {
      failures.push(`at least ${minLength} characters`);
    }

    if (this.getPolicyBoolean(policy.requireUppercase, true) && !/[A-Z]/.test(password)) {
      failures.push('one uppercase letter');
    }

    if (this.getPolicyBoolean(policy.requireLowercase, true) && !/[a-z]/.test(password)) {
      failures.push('one lowercase letter');
    }

    if (this.getPolicyBoolean(policy.requireNumber, true) && !/\d/.test(password)) {
      failures.push('one number');
    }

    if (this.getPolicyBoolean(policy.requireSymbol, false) && !/[^A-Za-z0-9]/.test(password)) {
      failures.push('one symbol');
    }

    if (failures.length) {
      throw new BadRequestException(`Password must contain ${failures.join(', ')}`);
    }
  }

  private getPolicyNumber(value: unknown, fallback: number) {
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
  }

  private getPolicyBoolean(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
  }

  private buildOrderBy(query: ListUsersQuery): Prisma.UserOrderByWithRelationInput[] {
    const sortField = query.sortBy ? USER_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private parseSortOrder(value?: string): Prisma.SortOrder | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'asc' || value === 'desc') {
      return value;
    }

    throw new BadRequestException('sortOrder is invalid');
  }

  private assertRequiredString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
  }

  private normalizeNullableString(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private toUserResponse(user: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      phone: user.phone,
      email: user.email,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((userRole) => userRole.role),
      roleIds: user.userRoles.map((userRole) => userRole.roleId)
    };
  }
}
