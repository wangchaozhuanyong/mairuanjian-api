import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedeemCodesService } from './redeem-codes.service';

describe('RedeemCodesService import plan', () => {
  function createService() {
    const fieldEncryptionService = {
      hash: jest.fn((value: string | null | undefined) => (value ? `hash:${value.trim()}` : null)),
      encrypt: jest.fn((value: string | null | undefined) =>
        value ? `encrypted:${value.trim()}` : null
      )
    } as unknown as FieldEncryptionService;

    return new RedeemCodesService(
      {} as PrismaService,
      { create: jest.fn() } as unknown as AuditLogsService,
      fieldEncryptionService,
      { triggerEvent: jest.fn() } as unknown as NotificationsService
    );
  }

  it('detects duplicate redeem codes inside the same import', () => {
    const service = createService();
    const plan = service.buildImportPlan(
      [
        { rowNo: 1, code: 'CODE-0001' },
        { rowNo: 2, code: 'CODE-0001' },
        { rowNo: 3, code: 'CODE-0002' }
      ],
      new Set(),
      '10',
      null
    );

    expect(plan.items).toHaveLength(2);
    expect(plan.errors).toEqual([
      {
        rowNo: 2,
        codeTail: '0001',
        reason: '本次导入内重复'
      }
    ]);
  });

  it('detects redeem codes that already exist in database', () => {
    const service = createService();
    const plan = service.buildImportPlan(
      [
        { rowNo: 1, code: 'CODE-0001' },
        { rowNo: 2, code: 'CODE-0002' }
      ],
      new Set(['hash:CODE-0002']),
      '10',
      null
    );

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.codeTail).toBe('0001');
    expect(plan.errors).toEqual([
      {
        rowNo: 2,
        codeTail: '0002',
        reason: '兑换码已存在'
      }
    ]);
  });

  it('applies whitelisted inventory list sorting', async () => {
    const prisma = {
      redeemCode: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as PrismaService;
    const service = new RedeemCodesService(
      prisma,
      { create: jest.fn() } as unknown as AuditLogsService,
      {
        hash: jest.fn(),
        encrypt: jest.fn()
      } as unknown as FieldEncryptionService,
      { triggerEvent: jest.fn() } as unknown as NotificationsService
    );

    await service.listInventory({
      page: '1',
      pageSize: '20',
      sortBy: 'cost',
      sortOrder: 'asc'
    });

    expect(prisma.redeemCode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ cost: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.redeemCode.count).toHaveBeenCalled();
  });

  it('reveals a redeem code and writes audit log without logging plaintext code', async () => {
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      decrypt: jest.fn().mockReturnValue('FULL-CODE-0001'),
      hash: jest.fn(),
      encrypt: jest.fn()
    } as unknown as FieldEncryptionService;
    const prisma = {
      redeemCode: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'code-id',
          serviceId: 'service-id',
          batchId: 'batch-id',
          codeEncrypted: 'encrypted-code',
          codeTail: '0001',
          status: 'unsold'
        })
      },
      sensitiveAccessLog: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;
    const service = new RedeemCodesService(prisma, auditLogsService, fieldEncryptionService, {
      triggerEvent: jest.fn()
    } as unknown as NotificationsService);

    const result = await service.revealRedeemCode(
      'code-id',
      { reason: '发货给客户' },
      {
        id: 'user-id',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      },
      {
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      }
    );

    expect(result.redeemCode).toBe('FULL-CODE-0001');
    expect(fieldEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-code');
    expect(prisma.sensitiveAccessLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        module: 'redeem_code',
        fieldName: 'redeemCode',
        objectType: 'redeem_code',
        objectId: 'code-id',
        accessReason: '发货给客户',
        approved: true,
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      }
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        action: 'redeem_code.reveal',
        objectType: 'redeem_code',
        objectId: 'code-id',
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      })
    );
    const auditPayload = (auditLogsService.create as jest.Mock).mock.calls[0]?.[0];
    expect(JSON.stringify(auditPayload.afterData)).not.toContain('FULL-CODE-0001');
  });
});
