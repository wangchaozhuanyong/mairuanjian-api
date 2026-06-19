import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleBalancesService } from './apple-balances.service';

describe('AppleBalancesService', () => {
  const service = new AppleBalancesService(
    {} as PrismaService,
    {} as AuditLogsService,
    {} as FieldEncryptionService
  );

  const account = {
    currentBalance: new Prisma.Decimal('50'),
    balanceCostAmount: new Prisma.Decimal('270'),
    averageCost: new Prisma.Decimal('5.4')
  };

  it('calculates moving weighted average cost after topup', () => {
    const snapshot = service.calculateTopupSnapshot(account, '100', '570');

    expect(snapshot.balanceAfter.toString()).toBe('150');
    expect(snapshot.costAfter.toString()).toBe('840');
    expect(snapshot.avgCostAfter.toFixed(8)).toBe('5.60000000');
  });

  it('calculates consumption cost using current average cost', () => {
    const snapshot = service.calculateConsumptionSnapshot(
      {
        currentBalance: new Prisma.Decimal('150'),
        balanceCostAmount: new Prisma.Decimal('840'),
        averageCost: new Prisma.Decimal('5.6')
      },
      '20'
    );

    expect(snapshot.costAmount.toString()).toBe('112');
    expect(snapshot.balanceAfter.toString()).toBe('130');
    expect(snapshot.costAfter.toString()).toBe('728');
    expect(snapshot.avgCostAfter.toFixed(8)).toBe('5.60000000');
  });

  it('rejects consumption larger than balance', () => {
    expect(() => service.calculateConsumptionSnapshot(account, '60')).toThrow(BadRequestException);
  });

  it('calculates balance adjustment without changing cost', () => {
    const snapshot = service.calculateAdjustmentSnapshot(account, '60', 'none');

    expect(snapshot.difference.toString()).toBe('10');
    expect(snapshot.newCostRmb.toString()).toBe('270');
    expect(snapshot.costRmbChange.toString()).toBe('0');
    expect(snapshot.avgCostAfter.toFixed(8)).toBe('4.50000000');
  });

  it('calculates balance adjustment using current average cost', () => {
    const snapshot = service.calculateAdjustmentSnapshot(account, '60', 'current_avg');

    expect(snapshot.difference.toString()).toBe('10');
    expect(snapshot.newCostRmb.toString()).toBe('324');
    expect(snapshot.costRmbChange.toString()).toBe('54');
    expect(snapshot.avgCostAfter.toFixed(8)).toBe('5.40000000');
  });

  it('calculates manual balance cost adjustment', () => {
    const snapshot = service.calculateAdjustmentSnapshot(account, '60', 'manual', '300');

    expect(snapshot.newCostRmb.toString()).toBe('300');
    expect(snapshot.costRmbChange.toString()).toBe('30');
    expect(snapshot.avgCostAfter.toFixed(8)).toBe('5.00000000');
  });

  it('rejects zero balance adjustment with remaining cost', () => {
    expect(() => service.calculateAdjustmentSnapshot(account, '0', 'none')).toThrow(
      BadRequestException
    );
  });

  it('reveals gift card code and writes a redacted audit log', async () => {
    const prisma = {
      appleBalanceTopup: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'topup-id',
          appleAccountId: 'apple-account-id',
          giftCardCodeEncrypted: 'encrypted-code',
          giftCardCodeTail: '1234'
        })
      },
      sensitiveAccessLog: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      decrypt: jest.fn().mockReturnValue('FULL-GIFT-CODE-1234')
    } as unknown as FieldEncryptionService;
    const revealService = new AppleBalancesService(
      prisma,
      auditLogsService,
      fieldEncryptionService
    );

    const result = await revealService.revealGiftCardCode(
      'topup-id',
      { reason: '售后核对充值代码' },
      {
        id: 'operator-id',
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

    expect(result.giftCardCode).toBe('FULL-GIFT-CODE-1234');
    expect(fieldEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-code');
    expect(prisma.sensitiveAccessLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'operator-id',
        module: 'apple_balance',
        fieldName: 'giftCardCode',
        objectType: 'apple_balance_topup',
        objectId: 'topup-id',
        accessReason: '售后核对充值代码',
        approved: true,
        ip: '127.0.0.1',
        userAgent: 'unit-test'
      }
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'operator-id',
        module: 'apple_balance',
        action: 'apple_topup.gift_card_code.reveal',
        objectType: 'apple_balance_topup',
        objectId: 'topup-id',
        ip: '127.0.0.1',
        userAgent: 'unit-test',
        afterData: {
          appleAccountId: 'apple-account-id',
          field: 'giftCardCode',
          giftCardCodeTail: '1234',
          reason: '售后核对充值代码'
        }
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      'FULL-GIFT-CODE-1234'
    );
  });

  it('requires a reason before revealing gift card code', async () => {
    await expect(service.revealGiftCardCode('topup-id', { reason: ' ' })).rejects.toThrow(
      BadRequestException
    );
  });
});
