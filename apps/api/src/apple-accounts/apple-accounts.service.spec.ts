import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleAccountsService } from './apple-accounts.service';

describe('AppleAccountsService', () => {
  const service = new AppleAccountsService(
    {} as PrismaService,
    {} as AuditLogsService,
    {} as FieldEncryptionService
  );

  it('calculates average cost from balance and total cost', () => {
    expect(service.calculateAverageCost('100', '650')).toBe('6.50000000');
  });

  it('returns zero average cost when balance and cost are zero', () => {
    expect(service.calculateAverageCost('0', '0')).toBe('0.00000000');
  });

  it('lists Apple ID accounts with filters, pagination and custom sorting', async () => {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const account = {
      id: '11111111-1111-4111-8111-111111111111',
      appleId: 'sorted@example.com',
      appleIdNormalized: 'sorted@example.com',
      region: 'US',
      currency: 'USD',
      currentBalance: new Prisma.Decimal(100),
      balanceCostAmount: new Prisma.Decimal(80),
      averageCost: new Prisma.Decimal('0.8'),
      status: 'normal',
      isManuallyLocked: false,
      manualLockReason: null,
      lockedAt: null,
      lockedByUserId: null,
      passwordEncrypted: null,
      securityInfoEncrypted: null,
      phoneEncrypted: null,
      recoveryEmailEncrypted: null,
      remark: 'primary',
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    const prisma = {
      appleAccount: {
        findMany: jest.fn().mockResolvedValue([account]),
        count: jest.fn().mockResolvedValue(1)
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) => Promise.all(operations))
    } as unknown as PrismaService;
    const listService = new AppleAccountsService(
      prisma,
      {} as AuditLogsService,
      {} as FieldEncryptionService
    );

    const result = await listService.list({
      page: '2',
      pageSize: '10',
      keyword: 'sorted',
      status: 'normal',
      currency: 'usd',
      region: 'us',
      locked: 'false',
      sortBy: 'currentBalance',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(prisma.appleAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ currentBalance: 'asc' }, { createdAt: 'desc' }],
        where: expect.objectContaining({
          deletedAt: null,
          status: 'normal',
          currency: 'USD',
          region: 'US',
          isManuallyLocked: false
        })
      })
    );
  });

  it('reveals encrypted Apple ID secret and writes redacted logs', async () => {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const account = {
      id: '11111111-1111-4111-8111-111111111111',
      appleId: 'test@example.com',
      appleIdNormalized: 'test@example.com',
      region: 'US',
      currency: 'USD',
      currentBalance: new Prisma.Decimal(0),
      balanceCostAmount: new Prisma.Decimal(0),
      averageCost: new Prisma.Decimal(0),
      status: 'normal',
      isManuallyLocked: false,
      manualLockReason: null,
      lockedAt: null,
      lockedByUserId: null,
      passwordEncrypted: 'encrypted-password',
      securityInfoEncrypted: null,
      phoneEncrypted: null,
      recoveryEmailEncrypted: null,
      remark: null,
      createdByUserId: null,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    const prisma = {
      appleAccount: {
        findFirst: jest.fn().mockResolvedValue(account)
      },
      sensitiveAccessLog: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      decrypt: jest.fn().mockReturnValue('FULL-PASSWORD')
    } as unknown as FieldEncryptionService;
    const revealService = new AppleAccountsService(
      prisma,
      auditLogsService,
      fieldEncryptionService
    );

    const result = await revealService.revealSecret(
      account.id,
      {
        field: 'password',
        reason: '售后登录核对'
      },
      {
        id: 'operator-id',
        username: 'admin',
        displayName: '管理员',
        roles: [],
        permissions: ['apple.secret.view_password']
      },
      {
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      }
    );

    expect(result.value).toBe('FULL-PASSWORD');
    expect(fieldEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-password');
    expect(prisma.sensitiveAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'operator-id',
          module: 'apple_account',
          fieldName: 'password',
          objectType: 'apple_account',
          objectId: account.id,
          accessReason: '售后登录核对',
          approved: true,
          ip: '127.0.0.1',
          userAgent: 'unit-test'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'apple_account',
        action: 'apple_account.secret.reveal',
        objectType: 'apple_account',
        objectId: account.id,
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      'FULL-PASSWORD'
    );
  });

  it('denies Apple ID secret reveal without field permission', async () => {
    await expect(
      service.revealSecret(
        'account-id',
        {
          field: 'phone',
          reason: '售后联系'
        },
        {
          id: 'operator-id',
          username: 'staff',
          displayName: '客服',
          roles: [],
          permissions: ['apple.account.view']
        }
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a reason before revealing Apple ID secret', async () => {
    await expect(
      service.revealSecret(
        'account-id',
        {
          field: 'password',
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

  it('normalizes region currency and phone when creating Apple ID accounts', async () => {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const prisma = {
      appleAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'created-account-id',
            ...data,
            currentBalance: new Prisma.Decimal(data.currentBalance),
            balanceCostAmount: new Prisma.Decimal(data.balanceCostAmount),
            averageCost: new Prisma.Decimal(data.averageCost),
            lockedAt: null,
            lockedByUserId: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          })
        ),
        findFirst: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'created-account-id',
            appleId: 'phone@example.com',
            appleIdNormalized: 'phone@example.com',
            region: 'CN',
            currency: 'CNY',
            currentBalance: new Prisma.Decimal(0),
            balanceCostAmount: new Prisma.Decimal(0),
            averageCost: new Prisma.Decimal(0),
            status: 'normal',
            isManuallyLocked: false,
            manualLockReason: null,
            lockedAt: null,
            lockedByUserId: null,
            passwordEncrypted: null,
            securityInfoEncrypted: null,
            phoneEncrypted: 'encrypted:+8613800138000',
            recoveryEmailEncrypted: null,
            remark: null,
            createdByUserId: null,
            updatedByUserId: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          })
        )
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      encrypt: jest.fn((value?: string | null) => (value ? `encrypted:${value}` : null))
    } as unknown as FieldEncryptionService;
    const createService = new AppleAccountsService(
      prisma,
      auditLogsService,
      fieldEncryptionService
    );

    await createService.create({
      appleId: 'phone@example.com',
      region: 'cn',
      currency: 'cny',
      phone: '138 0013 8000'
    });

    expect(prisma.appleAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          region: 'CN',
          currency: 'CNY',
          phoneEncrypted: 'encrypted:+8613800138000'
        })
      })
    );
  });

  it('defaults new Apple ID accounts to China region and CNY when omitted', async () => {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const prisma = {
      appleAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'created-cn-default-id',
            ...data,
            currentBalance: new Prisma.Decimal(data.currentBalance),
            balanceCostAmount: new Prisma.Decimal(data.balanceCostAmount),
            averageCost: new Prisma.Decimal(data.averageCost),
            lockedAt: null,
            lockedByUserId: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          })
        ),
        findFirst: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'created-cn-default-id',
            appleId: 'default-cn@example.com',
            appleIdNormalized: 'default-cn@example.com',
            region: 'CN',
            currency: 'CNY',
            currentBalance: new Prisma.Decimal(0),
            balanceCostAmount: new Prisma.Decimal(0),
            averageCost: new Prisma.Decimal(0),
            status: 'normal',
            isManuallyLocked: false,
            manualLockReason: null,
            lockedAt: null,
            lockedByUserId: null,
            passwordEncrypted: null,
            securityInfoEncrypted: null,
            phoneEncrypted: null,
            recoveryEmailEncrypted: null,
            remark: null,
            createdByUserId: null,
            updatedByUserId: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          })
        )
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      encrypt: jest.fn((value?: string | null) => (value ? `encrypted:${value}` : null))
    } as unknown as FieldEncryptionService;
    const createService = new AppleAccountsService(
      prisma,
      auditLogsService,
      fieldEncryptionService
    );

    await createService.create({
      appleId: 'default-cn@example.com'
    });

    expect(prisma.appleAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          region: 'CN',
          currency: 'CNY'
        })
      })
    );
  });

  it('rejects mismatched Apple ID region and currency', async () => {
    const prisma = {
      appleAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn()
      }
    } as unknown as PrismaService;
    const createService = new AppleAccountsService(
      prisma,
      {} as AuditLogsService,
      {} as FieldEncryptionService
    );

    await expect(
      createService.create({
        appleId: 'currency@example.com',
        region: 'CN',
        currency: 'USD'
      })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appleAccount.create).not.toHaveBeenCalled();
  });

  it('rejects phone numbers that do not match the selected region', async () => {
    const prisma = {
      appleAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn()
      }
    } as unknown as PrismaService;
    const createService = new AppleAccountsService(
      prisma,
      {} as AuditLogsService,
      {} as FieldEncryptionService
    );

    await expect(
      createService.create({
        appleId: 'phone-error@example.com',
        region: 'US',
        currency: 'USD',
        phone: '+86 138 0013 8000'
      })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.appleAccount.create).not.toHaveBeenCalled();
  });

  it('imports Apple ID accounts with encrypted fields and row-level errors', async () => {
    const now = new Date('2026-06-18T00:00:00.000Z');
    const createdAccounts: unknown[] = [];
    const prisma = {
      appleAccount: {
        findMany: jest.fn().mockResolvedValue([{ appleIdNormalized: 'exists@example.com' }]),
        create: jest.fn().mockImplementation(({ data }) => {
          const account = {
            id: `${createdAccounts.length + 1}`,
            ...data,
            currentBalance: new Prisma.Decimal(data.currentBalance),
            balanceCostAmount: new Prisma.Decimal(data.balanceCostAmount),
            averageCost: new Prisma.Decimal(data.averageCost),
            lockedAt: null,
            lockedByUserId: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null
          };
          createdAccounts.push(account);
          return Promise.resolve(account);
        })
      },
      $transaction: jest.fn((handler: unknown) => {
        if (typeof handler === 'function') {
          return handler(prisma);
        }

        throw new Error('Unexpected transaction input');
      })
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      encrypt: jest.fn((value?: string | null) => (value ? `encrypted:${value}` : null))
    } as unknown as FieldEncryptionService;
    const importService = new AppleAccountsService(
      prisma,
      auditLogsService,
      fieldEncryptionService
    );

    const result = await importService.importAccounts(
      {
        accounts: [
          'appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark',
          'one@example.com,pass-one,CN,CNY,100,650,18800000000,backup@example.com,主账号',
          'exists@example.com,pass-two,US,USD,0,0',
          'one@example.com,pass-three,US,USD,0,0'
        ]
      },
      {
        id: 'operator-id',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.totalCount).toBe(3);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNo: 3,
          reason: 'Apple ID 已存在'
        }),
        expect.objectContaining({
          rowNo: 4,
          reason: '本批次内 Apple ID 重复'
        })
      ])
    );
    expect(prisma.appleAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appleId: 'one@example.com',
          appleIdNormalized: 'one@example.com',
          currentBalance: '100',
          balanceCostAmount: '650',
          averageCost: '6.50000000',
          region: 'CN',
          currency: 'CNY',
          passwordEncrypted: 'encrypted:pass-one',
          phoneEncrypted: 'encrypted:+8618800000000',
          recoveryEmailEncrypted: 'encrypted:backup@example.com'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'apple_account',
        action: 'apple_account.batch_import',
        objectType: 'apple_account'
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      'pass-one'
    );
  });
});
