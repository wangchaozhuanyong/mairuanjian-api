import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  it('rejects blank customer name before writing data', async () => {
    const service = new CustomersService({} as PrismaService, {} as AuditLogsService);

    await expect(service.create({ name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies whitelisted customer list sorting', async () => {
    const prisma = {
      customer: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as PrismaService;
    const service = new CustomersService(prisma, {} as AuditLogsService);

    await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'updatedAt',
      sortOrder: 'asc'
    });

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.customer.count).toHaveBeenCalled();
  });

  it('reveals customer phone with permission and writes redacted logs', async () => {
    const customer = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '测试客户',
      phone: '13800001111',
      phoneTail: '1111',
      wechat: null,
      sourcePlatformId: null,
      tags: [],
      remark: null,
      status: 'active',
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T00:00:00.000Z'),
      deletedAt: null
    };
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(customer)
      },
      sensitiveAccessLog: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const service = new CustomersService(prisma, auditLogsService);

    const result = await service.revealPhone(
      customer.id,
      {
        reason: '售后联系'
      },
      {
        id: 'operator-id',
        username: 'staff',
        displayName: '客服',
        roles: [],
        permissions: ['customer.view_phone']
      },
      {
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      }
    );

    expect(result.phone).toBe('13800001111');
    expect(prisma.sensitiveAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'operator-id',
          module: 'customer',
          fieldName: 'phone',
          objectType: 'customer',
          objectId: customer.id,
          accessReason: '售后联系',
          approved: true,
          ip: '127.0.0.1',
          userAgent: 'unit-test'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'customer',
        action: 'customer.phone.reveal',
        objectType: 'customer',
        objectId: customer.id,
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      '13800001111'
    );
  });

  it('denies customer phone reveal without permission', async () => {
    const service = new CustomersService({} as PrismaService, {} as AuditLogsService);

    await expect(
      service.revealPhone(
        'customer-id',
        {
          reason: '售后联系'
        },
        {
          id: 'operator-id',
          username: 'staff',
          displayName: '客服',
          roles: [],
          permissions: ['customer.view']
        }
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a reason before revealing customer phone', async () => {
    const service = new CustomersService({} as PrismaService, {} as AuditLogsService);

    await expect(
      service.revealPhone(
        'customer-id',
        {
          reason: ' '
        },
        {
          id: 'operator-id',
          username: 'admin',
          displayName: '管理员',
          roles: ['admin'],
          permissions: []
        }
      )
    ).rejects.toThrow(BadRequestException);
  });
});
