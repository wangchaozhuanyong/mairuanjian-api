import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CodeServicesService } from './code-services.service';

describe('CodeServicesService platform mappings', () => {
  function createService(prismaOverrides?: Partial<PrismaService>) {
    const prisma = {
      codeService: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          faceValue: new Prisma.Decimal('100')
        })
      },
      sourcePlatform: {
        findFirst: jest.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' })
      },
      messageTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' })
      },
      codePlatformMapping: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'mapping-id',
          platformId: '22222222-2222-4222-8222-222222222222',
          shopId: 'taobao-main',
          platformItemId: 'item-1',
          platformSkuId: '',
          skuKeyword: '100元',
          serviceId: '11111111-1111-4111-8111-111111111111',
          faceValue: new Prisma.Decimal('100'),
          quantity: 1,
          deliveryTemplateId: '33333333-3333-4333-8333-333333333333',
          enabled: true,
          createdAt: new Date('2026-06-18T00:00:00.000Z'),
          updatedAt: new Date('2026-06-18T00:00:00.000Z'),
          platform: {
            id: '22222222-2222-4222-8222-222222222222',
            name: '淘宝店',
            status: 'active'
          },
          service: {
            id: '11111111-1111-4111-8111-111111111111',
            name: '充值卡100',
            faceValue: new Prisma.Decimal('100'),
            status: 'enabled'
          },
          deliveryTemplate: {
            id: '33333333-3333-4333-8333-333333333333',
            name: '发货模板',
            type: 'delivery',
            channel: 'customer_service',
            status: 'active'
          }
        })
      },
      ...prismaOverrides
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    return {
      service: new CodeServicesService(prisma, auditLogsService),
      prisma,
      auditLogsService
    };
  }

  it('applies whitelisted code service list sorting', async () => {
    const codeService = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '充值卡100',
      faceValue: new Prisma.Decimal('100'),
      defaultPrice: new Prisma.Decimal('108'),
      defaultCost: new Prisma.Decimal('95'),
      deliveryMode: 'semi_auto',
      exactFaceValueOnly: true,
      allowCombination: false,
      status: 'enabled',
      remark: null,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T01:00:00.000Z')
    };
    const findMany = jest.fn().mockResolvedValue([codeService]);
    const count = jest.fn().mockResolvedValue(1);
    const { service } = createService({
      $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries)),
      codeService: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: codeService.id, faceValue: codeService.faceValue }),
        findMany,
        count
      }
    } as unknown as Partial<PrismaService>);

    const result = await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'defaultCost',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ defaultCost: 'desc' }, { createdAt: 'desc' }]
      })
    );
    expect(count).toHaveBeenCalled();
  });

  it('creates a code platform mapping and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.createPlatformMapping(
      {
        platformId: '22222222-2222-4222-8222-222222222222',
        shopId: 'taobao-main',
        platformItemId: 'item-1',
        skuKeyword: '100元',
        serviceId: '11111111-1111-4111-8111-111111111111',
        deliveryTemplateId: '33333333-3333-4333-8333-333333333333'
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.platformSkuId).toBe('');
    expect(result.faceValue).toBe('100');
    expect(result.platform.name).toBe('淘宝店');
    expect(prisma.messageTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: '33333333-3333-4333-8333-333333333333',
          status: 'active',
          type: 'delivery',
          channel: 'customer_service'
        })
      })
    );
    expect(prisma.codePlatformMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platformId: '22222222-2222-4222-8222-222222222222',
          serviceId: '11111111-1111-4111-8111-111111111111',
          platformItemId: 'item-1',
          platformSkuId: '',
          quantity: 1
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '44444444-4444-4444-8444-444444444444',
        action: 'code_platform_mapping.create',
        objectType: 'code_platform_mapping',
        objectId: 'mapping-id'
      })
    );
  });

  it('rejects duplicate code platform mappings', async () => {
    const { service } = createService({
      codePlatformMapping: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-mapping-id' })
      }
    } as unknown as Partial<PrismaService>);

    await expect(
      service.createPlatformMapping({
        platformId: '22222222-2222-4222-8222-222222222222',
        platformItemId: 'item-1',
        serviceId: '11111111-1111-4111-8111-111111111111'
      })
    ).rejects.toThrow(ConflictException);
  });

  it('rejects platform mappings when the template is not an active customer-service delivery template', async () => {
    const { service } = createService({
      messageTemplate: {
        findFirst: jest.fn().mockResolvedValue(null)
      }
    } as unknown as Partial<PrismaService>);

    await expect(
      service.createPlatformMapping({
        platformId: '22222222-2222-4222-8222-222222222222',
        platformItemId: 'item-1',
        serviceId: '11111111-1111-4111-8111-111111111111',
        deliveryTemplateId: '33333333-3333-4333-8333-333333333333'
      })
    ).rejects.toThrow(BadRequestException);
  });
});
