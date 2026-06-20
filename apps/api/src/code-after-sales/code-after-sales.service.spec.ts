import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CodeAfterSalesService } from './code-after-sales.service';

describe('CodeAfterSalesService', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const platformId = '22222222-2222-4222-8222-222222222222';
  const serviceId = '33333333-3333-4333-8333-333333333333';
  const originalCodeId = '44444444-4444-4444-8444-444444444444';
  const newCodeId = '55555555-5555-4555-8555-555555555555';
  const afterSaleId = '66666666-6666-4666-8666-666666666666';

  const orderBase = {
    id: orderId,
    platformId,
    externalOrderNo: 'CODE-ORDER-1',
    itemTitle: '100元兑换码',
    skuName: '100元',
    deliveryStatus: 'delivered',
    refundStatus: 'none',
    paidAmount: new Prisma.Decimal('120'),
    platformFee: new Prisma.Decimal('2'),
    costAmount: new Prisma.Decimal('90'),
    profitAmount: new Prisma.Decimal('28'),
    platform: {
      id: platformId,
      name: '淘宝店'
    },
    service: {
      id: serviceId,
      name: '充值卡100',
      faceValue: new Prisma.Decimal('100'),
      status: 'enabled'
    }
  };

  const originalCode = {
    id: originalCodeId,
    serviceId,
    codeTail: '0001',
    faceValue: new Prisma.Decimal('100'),
    cost: new Prisma.Decimal('90'),
    status: 'delivered'
  };

  const reissueCode = {
    id: newCodeId,
    serviceId,
    codeEncrypted: 'encrypted-code',
    codeTail: '0002',
    faceValue: new Prisma.Decimal('100'),
    cost: new Prisma.Decimal('91'),
    status: 'unsold'
  };

  const afterSaleBase = {
    id: afterSaleId,
    orderId,
    originalCodeId,
    newCodeId: null,
    reason: '客户反馈兑换失败',
    status: 'pending',
    handledByUserId: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    completedAt: null,
    order: orderBase,
    originalCode,
    newCode: null,
    handledBy: null
  };

  function createService(prismaOverrides?: Partial<PrismaService>) {
    const prisma = {
      codeAfterSale: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(afterSaleBase),
        create: jest.fn().mockResolvedValue(afterSaleBase),
        update: jest.fn().mockResolvedValue(afterSaleBase)
      },
      redeemCode: {
        findFirst: jest.fn().mockResolvedValue(reissueCode),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      codeDeliveryLog: {
        create: jest.fn()
      },
      codePlatformOrder: {
        findUnique: jest.fn().mockResolvedValue({
          ...orderBase,
          deliveredCodes: [originalCode]
        }),
        update: jest.fn()
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 })
          },
          codeAfterSale: {
            create: jest.fn().mockResolvedValue(afterSaleBase),
            update: jest.fn().mockResolvedValue({
              ...afterSaleBase,
              newCodeId
            })
          },
          codeDeliveryLog: {
            create: jest.fn()
          },
          codePlatformOrder: {
            update: jest.fn()
          }
        })
      ),
      ...prismaOverrides
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      decrypt: jest.fn().mockReturnValue('FULL-CODE-0002')
    } as unknown as FieldEncryptionService;

    return {
      service: new CodeAfterSalesService(prisma, auditLogsService, fieldEncryptionService),
      prisma,
      auditLogsService,
      fieldEncryptionService
    };
  }

  it('creates an after-sale record and marks original delivered code as after_sale', async () => {
    const txRedeemCode = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    };
    const txAfterSale = {
      create: jest.fn().mockResolvedValue(afterSaleBase)
    };
    const { service, auditLogsService } = createService({
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: txRedeemCode,
          codeAfterSale: txAfterSale
        })
      )
    } as unknown as Partial<PrismaService>);

    const result = await service.create(
      {
        orderId,
        reason: '客户反馈兑换失败'
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.originalCode.codeTail).toBe('0001');
    expect(txRedeemCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: originalCodeId,
          deliveredOrderId: orderId,
          status: 'delivered'
        },
        data: {
          status: 'after_sale'
        }
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'code_after_sale.create'
      })
    );
  });

  it('applies whitelisted list sorting', async () => {
    const { service, prisma } = createService({
      codeAfterSale: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as Partial<PrismaService>);

    await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'status',
      sortOrder: 'asc'
    });

    expect(prisma.codeAfterSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.codeAfterSale.count).toHaveBeenCalled();
  });

  it('reissues an unsold code, writes delivery log, and increases order cost', async () => {
    const afterSaleAfterReissue = {
      ...afterSaleBase,
      newCodeId,
      newCode: {
        ...reissueCode,
        codeEncrypted: undefined,
        status: 'reissued'
      }
    };
    const txRedeemCode = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    };
    const txAfterSale = {
      update: jest.fn().mockResolvedValue(afterSaleAfterReissue)
    };
    const txDeliveryLog = {
      create: jest.fn()
    };
    const txOrder = {
      update: jest.fn()
    };
    const { service, prisma, fieldEncryptionService } = createService({
      codeAfterSale: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(afterSaleBase)
          .mockResolvedValueOnce(afterSaleAfterReissue)
      },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          redeemCode: txRedeemCode,
          codeAfterSale: txAfterSale,
          codeDeliveryLog: txDeliveryLog,
          codePlatformOrder: txOrder
        })
      )
    } as unknown as Partial<PrismaService>);

    const result = await service.reissue(afterSaleId, {
      deliveryMethod: 'manual'
    });

    expect(result.codeTail).toBe('0002');
    expect(result.deliveryContent).toContain('FULL-CODE-0002');
    expect(fieldEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-code');
    expect(prisma.redeemCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceId,
          faceValue: new Prisma.Decimal('100'),
          status: 'unsold'
        })
      })
    );
    expect(txRedeemCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: newCodeId,
          status: 'unsold'
        },
        data: expect.objectContaining({
          status: 'reissued',
          deliveredOrderId: orderId,
          deliveredPlatformId: platformId
        })
      })
    );
    expect(txDeliveryLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId,
          codeId: newCodeId,
          deliveryStatus: 'success',
          paidAmount: new Prisma.Decimal(0),
          profit: new Prisma.Decimal(-91)
        })
      })
    );
    expect(txOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: orderId },
        data: {
          costAmount: new Prisma.Decimal('181'),
          profitAmount: new Prisma.Decimal('-63')
        }
      })
    );
  });

  it('rejects duplicate reissue when after-sale already has a new code', async () => {
    const { service } = createService({
      codeAfterSale: {
        findUnique: jest.fn().mockResolvedValue({
          ...afterSaleBase,
          newCodeId,
          newCode: {
            ...reissueCode,
            codeEncrypted: undefined,
            status: 'reissued'
          }
        })
      }
    } as unknown as Partial<PrismaService>);

    await expect(service.reissue(afterSaleId, {})).rejects.toThrow(ConflictException);
  });
});
