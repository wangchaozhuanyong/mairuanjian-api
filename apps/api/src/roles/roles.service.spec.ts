import { BadRequestException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  function createService(prismaOverrides?: Partial<PrismaService>) {
    const role = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '售后主管',
      code: 'after_sale_manager',
      description: '负责售后补发和异常处理',
      createdAt: new Date('2026-06-27T00:00:00.000Z'),
      updatedAt: new Date('2026-06-27T00:00:00.000Z'),
      rolePermissions: [],
      _count: {
        userRoles: 0
      }
    };
    const prisma = {
      role: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(role)
      },
      ...prismaOverrides
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    return {
      service: new RolesService(prisma, auditLogsService),
      prisma,
      auditLogsService
    };
  }

  it('creates a role and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.createRole(
      {
        name: ' 售后主管 ',
        code: 'after_sale_manager',
        description: ' 负责售后补发和异常处理 '
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.code).toBe('after_sale_manager');
    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: '售后主管',
          code: 'after_sale_manager',
          description: '负责售后补发和异常处理'
        },
        include: expect.objectContaining({
          rolePermissions: {
            include: {
              permission: true
            }
          }
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '22222222-2222-4222-8222-222222222222',
        action: 'role.create',
        objectType: 'role',
        objectId: '11111111-1111-4111-8111-111111111111'
      })
    );
  });

  it('rejects duplicate role code', async () => {
    const { service } = createService({
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'existing-role-id' })
      }
    } as unknown as Partial<PrismaService>);

    await expect(
      service.createRole({
        name: '售后主管',
        code: 'after_sale_manager'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsafe role code', async () => {
    const { service } = createService();

    await expect(
      service.createRole({
        name: '售后主管',
        code: 'After Sale'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
