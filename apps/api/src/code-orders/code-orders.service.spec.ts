import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CodeOrdersService } from './code-orders.service';

describe('CodeOrdersService', () => {
  const orderBase = {
    id: 'order-id',
    platformId: '22222222-2222-4222-8222-222222222222',
    externalOrderNo: 'MANUAL-1',
    buyerId: 'buyer-1',
    buyerNameMasked: '买家***',
    itemId: 'item-1',
    skuId: '',
    itemTitle: '100元兑换码',
    skuName: '100元',
    serviceId: '11111111-1111-4111-8111-111111111111',
    faceValue: new Prisma.Decimal('100'),
    quantity: 1,
    paidAmount: new Prisma.Decimal('120'),
    platformFee: new Prisma.Decimal('2'),
    costAmount: new Prisma.Decimal('0'),
    profitAmount: new Prisma.Decimal('118'),
    orderStatus: 'paid',
    deliveryStatus: 'pending',
    refundStatus: 'none',
    paidAt: new Date('2026-06-18T00:00:00.000Z'),
    deliveredAt: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: new Date('2026-06-18T00:00:00.000Z'),
    platform: {
      id: '22222222-2222-4222-8222-222222222222',
      name: '微信渠道',
      status: 'active'
    },
    service: {
      id: '11111111-1111-4111-8111-111111111111',
      name: '充值卡100',
      faceValue: new Prisma.Decimal('100'),
      defaultCost: new Prisma.Decimal('90'),
      status: 'enabled'
    },
    lockedCodes: [],
    deliveredCodes: []
  };

  function createService(prismaOverrides?: Partial<PrismaService>) {
    const prisma = {
      sourcePlatform: {
        findFirst: jest.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' })
      },
      codePlatformOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(orderBase),
        update: jest.fn().mockResolvedValue(orderBase),
        findMany: jest.fn(),
        count: jest.fn()
      },
      codeDeliveryLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn()
      },
      codePlatformMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mapping-id',
            platformId: '22222222-2222-4222-8222-222222222222',
            platformItemId: 'item-1',
            platformSkuId: '',
            skuKeyword: '100元',
            serviceId: '11111111-1111-4111-8111-111111111111',
            faceValue: new Prisma.Decimal('100'),
            quantity: 1,
            enabled: true,
            createdAt: new Date('2026-06-18T00:00:00.000Z'),
            updatedAt: new Date('2026-06-18T00:00:00.000Z'),
            service: orderBase.service
          }
        ])
      },
      codeService: {
        findFirst: jest.fn().mockResolvedValue(orderBase.service),
        findUnique: jest.fn().mockResolvedValue(orderBase.service)
      },
      redeemCode: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'code-id',
            codeTail: '0001',
            cost: new Prisma.Decimal('90'),
            faceValue: new Prisma.Decimal('100')
          }
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(10)
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 })
          },
          codePlatformOrder: {
            update: jest.fn().mockResolvedValue(orderBase)
          }
        })
      ),
      ...prismaOverrides
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      decrypt: jest.fn().mockReturnValue('FULL-CODE-0001')
    } as unknown as FieldEncryptionService;
    const notificationsService = {
      triggerEvent: jest.fn().mockResolvedValue({})
    } as unknown as NotificationsService;

    return {
      service: new CodeOrdersService(
        prisma,
        auditLogsService,
        fieldEncryptionService,
        notificationsService
      ),
      prisma,
      auditLogsService,
      fieldEncryptionService,
      notificationsService
    };
  }

  it('creates a manual order and resolves code service from platform mapping', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.createManual(
      {
        platformId: '22222222-2222-4222-8222-222222222222',
        externalOrderNo: 'MANUAL-1',
        itemId: 'item-1',
        skuName: '100元',
        paidAmount: '120',
        platformFee: '2'
      },
      {
        id: 'user-id',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.serviceId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.faceValue).toBe('100');
    expect(prisma.codePlatformOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceId: '11111111-1111-4111-8111-111111111111',
          faceValue: '100',
          profitAmount: '118'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'code_order.manual_create',
        objectType: 'code_platform_order'
      })
    );
  });

  it('applies whitelisted list sorting', async () => {
    const { service, prisma } = createService({
      codePlatformOrder: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as Partial<PrismaService>);

    await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'profitAmount',
      sortOrder: 'asc'
    });

    expect(prisma.codePlatformOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ profitAmount: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.codePlatformOrder.count).toHaveBeenCalled();
  });

  it('lists delivered code orders for after-sale option pickers', async () => {
    const deliveredOrder = {
      ...orderBase,
      deliveryStatus: 'delivered',
      deliveredAt: new Date('2026-06-18T01:00:00.000Z'),
      deliveredCodes: [
        {
          id: 'delivered-code-id',
          codeTail: '0001',
          faceValue: new Prisma.Decimal('100'),
          cost: new Prisma.Decimal('90'),
          status: 'delivered'
        }
      ]
    };
    const findMany = jest.fn().mockResolvedValue([deliveredOrder]);
    const count = jest.fn().mockResolvedValue(1);
    const { service } = createService({
      codePlatformOrder: {
        findMany,
        count
      }
    } as unknown as Partial<PrismaService>);

    const result = await service.listAfterSaleOrderOptions({
      page: '1',
      pageSize: '20',
      keyword: 'MANUAL'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: deliveredOrder.id,
        externalOrderNo: deliveredOrder.externalOrderNo,
        deliveryStatus: 'delivered',
        deliveredCodeCount: 1
      })
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryStatus: 'delivered',
          OR: expect.any(Array)
        }),
        orderBy: [{ deliveredAt: 'desc' }, { createdAt: 'desc' }]
      })
    );
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryStatus: 'delivered'
        })
      })
    );
  });

  it('locks unsold redeem code for a matched order and calculates profit', async () => {
    const orderAfterLock = {
      ...orderBase,
      costAmount: new Prisma.Decimal('90'),
      profitAmount: new Prisma.Decimal('28'),
      lockedCodes: [
        {
          id: 'code-id',
          codeTail: '0001',
          faceValue: new Prisma.Decimal('100'),
          cost: new Prisma.Decimal('90'),
          status: 'locked'
        }
      ]
    };
    const txRedeemCode = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    };
    const txOrder = {
      update: jest.fn().mockResolvedValue(orderAfterLock)
    };
    const { service, prisma } = createService({
      codePlatformOrder: {
        findUnique: jest.fn().mockResolvedValueOnce(orderBase).mockResolvedValueOnce(orderAfterLock)
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: txRedeemCode,
          codePlatformOrder: txOrder
        })
      )
    } as unknown as Partial<PrismaService>);

    const result = await service.matchAndLock('order-id');

    expect(result.lockedCodeCount).toBe(1);
    expect(result.costAmount).toBe('90');
    expect(result.profitAmount).toBe('28');
    expect(txRedeemCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'code-id',
          status: 'unsold'
        },
        data: {
          status: 'locked',
          lockedOrderId: 'order-id'
        }
      })
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects locking when the selected redeem code is no longer unsold', async () => {
    const txRedeemCode = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    };
    const { service } = createService({
      codePlatformOrder: {
        findUnique: jest.fn().mockResolvedValue(orderBase)
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: txRedeemCode,
          codePlatformOrder: {
            update: jest.fn()
          }
        })
      )
    } as unknown as Partial<PrismaService>);

    await expect(service.matchAndLock('order-id')).rejects.toThrow(ConflictException);
  });

  it('confirms delivery, records delivery log, and prevents code reuse by status check', async () => {
    const lockedOrder = {
      ...orderBase,
      lockedCodes: [
        {
          id: 'code-id',
          codeTail: '0001',
          faceValue: new Prisma.Decimal('100'),
          cost: new Prisma.Decimal('90'),
          status: 'locked'
        }
      ]
    };
    const deliveredOrder = {
      ...lockedOrder,
      deliveryStatus: 'delivered',
      deliveredAt: new Date('2026-06-18T01:00:00.000Z'),
      costAmount: new Prisma.Decimal('90'),
      profitAmount: new Prisma.Decimal('28'),
      lockedCodes: [],
      deliveredCodes: [
        {
          id: 'code-id',
          codeTail: '0001',
          faceValue: new Prisma.Decimal('100'),
          cost: new Prisma.Decimal('90'),
          status: 'delivered'
        }
      ]
    };
    const txRedeemCode = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    };
    const txDeliveryLog = {
      create: jest.fn().mockResolvedValue({})
    };
    const txOrder = {
      update: jest.fn().mockResolvedValue(deliveredOrder)
    };
    const { service, auditLogsService } = createService({
      codePlatformOrder: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(lockedOrder)
          .mockResolvedValueOnce(deliveredOrder)
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: txRedeemCode,
          codeDeliveryLog: txDeliveryLog,
          codePlatformOrder: txOrder
        })
      )
    } as unknown as Partial<PrismaService>);

    const result = await service.confirmDelivery(
      'order-id',
      {
        deliveryMethod: 'manual',
        deliveryContent: 'FULL-CODE-0001'
      },
      {
        id: 'user-id',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.deliveryStatus).toBe('delivered');
    expect(result.deliveredCodeCount).toBe(1);
    expect(txRedeemCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'code-id',
          status: 'locked',
          lockedOrderId: 'order-id'
        },
        data: expect.objectContaining({
          status: 'delivered',
          deliveredOrderId: 'order-id',
          deliveredPlatformId: orderBase.platformId
        })
      })
    );
    expect(txDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-id',
          codeId: 'code-id',
          deliveryMethod: 'manual',
          deliveryContentSnapshot: 'FULL-CODE-0001',
          deliveryStatus: 'success',
          paidAmount: new Prisma.Decimal('120'),
          profit: new Prisma.Decimal('28')
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'code_order.deliver',
        afterData: expect.objectContaining({
          deliveryContentLength: 14
        })
      })
    );
  });

  it('rejects duplicate delivery for an already delivered order', async () => {
    const deliveredOrder = {
      ...orderBase,
      deliveryStatus: 'delivered',
      lockedCodes: [],
      deliveredCodes: [
        {
          id: 'code-id',
          codeTail: '0001',
          faceValue: new Prisma.Decimal('100'),
          cost: new Prisma.Decimal('90'),
          status: 'delivered'
        }
      ]
    };
    const { service } = createService({
      codePlatformOrder: {
        findUnique: jest.fn().mockResolvedValue(deliveredOrder)
      }
    } as unknown as Partial<PrismaService>);

    await expect(
      service.confirmDelivery('order-id', {
        deliveryMethod: 'manual',
        deliveryContent: 'FULL-CODE-0001'
      })
    ).rejects.toThrow(ConflictException);
  });
});
