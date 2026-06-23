import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleServicesService } from './apple-services.service';

describe('AppleServicesService platform mappings', () => {
  function createService(prismaOverrides?: Partial<PrismaService>) {
    const prisma = {
      appleService: {
        findFirst: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' })
      },
      sourcePlatform: {
        findFirst: jest.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' })
      },
      appleServicePlatformMapping: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'mapping-id',
          serviceId: '11111111-1111-4111-8111-111111111111',
          sourcePlatformId: '22222222-2222-4222-8222-222222222222',
          shopName: '微信渠道',
          platformItemId: 'item-1',
          platformSkuId: '',
          skuKeyword: 'GPT Plus',
          platformPrice: new Prisma.Decimal('88'),
          platformFeeType: 'rate',
          platformFeeValue: new Prisma.Decimal('0.05'),
          allowAutoOrder: true,
          enabled: true,
          createdAt: new Date('2026-06-18T00:00:00.000Z'),
          updatedAt: new Date('2026-06-18T00:00:00.000Z'),
          sourcePlatform: {
            id: '22222222-2222-4222-8222-222222222222',
            name: '微信渠道',
            feeRate: new Prisma.Decimal('0.05'),
            feeFixed: new Prisma.Decimal('0'),
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
      service: new AppleServicesService(prisma, auditLogsService),
      prisma,
      auditLogsService
    };
  }

  it('applies whitelisted Apple service list sorting', async () => {
    const appleService = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'GPT Plus',
      category: 'streaming',
      defaultPrice: new Prisma.Decimal('88'),
      officialBasePrice: new Prisma.Decimal('20'),
      officialCostValue: new Prisma.Decimal('20'),
      appleBalancePriceRuleType: 'manual',
      appleBalancePriceRuleValue: null,
      currency: 'USD',
      defaultPeriodType: 'month',
      defaultPeriodValue: 1,
      expireCalcType: 'by_month',
      requireAppleId: true,
      requireServiceAccount: true,
      autoMatchAppleId: true,
      lockRule: 'by_service',
      allowedRegions: ['US'],
      minBalanceRequired: new Prisma.Decimal('0'),
      status: 'enabled',
      remark: null,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T01:00:00.000Z')
    };
    const findMany = jest.fn().mockResolvedValue([appleService]);
    const count = jest.fn().mockResolvedValue(1);
    const { service } = createService({
      $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries)),
      appleService: {
        findFirst: jest.fn().mockResolvedValue({ id: appleService.id }),
        findMany,
        count
      }
    } as unknown as Partial<PrismaService>);

    const result = await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'defaultPrice',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ defaultPrice: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(count).toHaveBeenCalled();
  });

  it('orders enabled Apple services first by default', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const { service } = createService({
      $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries)),
      appleService: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany,
        count
      }
    } as unknown as Partial<PrismaService>);

    await service.list({
      page: '1',
      pageSize: '20'
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('calculates Apple balance price from global percent rule when creating service', async () => {
    const createdAt = new Date('2026-06-18T00:00:00.000Z');
    const createdService = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'ChatGPT Plus',
      category: 'chatgpt',
      defaultPrice: new Prisma.Decimal('0'),
      officialBasePrice: new Prisma.Decimal('20'),
      officialCostValue: new Prisma.Decimal('25'),
      appleBalancePriceRuleType: 'inherit',
      appleBalancePriceRuleValue: null,
      currency: 'USD',
      defaultPeriodType: 'month',
      defaultPeriodValue: 1,
      expireCalcType: 'by_month',
      requireAppleId: true,
      requireServiceAccount: false,
      autoMatchAppleId: true,
      lockRule: 'by_service',
      allowedRegions: [],
      minBalanceRequired: new Prisma.Decimal('0'),
      status: 'paused',
      remark: null,
      createdAt,
      updatedAt: createdAt
    };
    const create = jest.fn().mockResolvedValue(createdService);
    const { service } = createService({
      systemParameter: {
        findUnique: jest.fn().mockResolvedValue({
          key: 'apple_balance_price_rule',
          value: { ruleType: 'percent', ruleValue: '1.25' }
        })
      },
      appleService: {
        create,
        findFirst: jest.fn().mockResolvedValue(createdService)
      }
    } as unknown as Partial<PrismaService>);

    const result = await service.create({
      name: 'ChatGPT Plus',
      category: 'chatgpt',
      officialBasePrice: '20',
      appleBalancePriceRuleType: 'inherit',
      currency: 'USD',
      status: 'paused'
    });

    expect(result.officialCostValue).toBe('25');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          officialBasePrice: '20',
          officialCostValue: '25',
          appleBalancePriceRuleType: 'inherit',
          requireServiceAccount: true
        })
      })
    );
  });

  it('creates an Apple service platform mapping and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.createPlatformMapping(
      '11111111-1111-4111-8111-111111111111',
      {
        sourcePlatformId: '22222222-2222-4222-8222-222222222222',
        shopName: '微信渠道',
        platformItemId: 'item-1',
        skuKeyword: 'GPT Plus',
        platformPrice: '88',
        platformFeeType: 'rate',
        platformFeeValue: '0.05',
        allowAutoOrder: true,
        enabled: true
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.platformSkuId).toBe('');
    expect(result.platformPrice).toBe('88');
    expect(result.sourcePlatform.name).toBe('微信渠道');
    expect(prisma.appleServicePlatformMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceId: '11111111-1111-4111-8111-111111111111',
          sourcePlatformId: '22222222-2222-4222-8222-222222222222',
          platformItemId: 'item-1',
          platformSkuId: '',
          platformFeeType: 'rate',
          allowAutoOrder: true
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '33333333-3333-4333-8333-333333333333',
        action: 'apple_service.platform_mapping.create',
        objectType: 'apple_service_platform_mapping',
        objectId: 'mapping-id'
      })
    );
  });

  it('rejects duplicate Apple service platform mappings', async () => {
    const { service } = createService({
      appleServicePlatformMapping: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-mapping-id' })
      }
    } as unknown as Partial<PrismaService>);

    await expect(
      service.createPlatformMapping('11111111-1111-4111-8111-111111111111', {
        sourcePlatformId: '22222222-2222-4222-8222-222222222222',
        platformItemId: 'item-1'
      })
    ).rejects.toThrow(ConflictException);
  });
});
