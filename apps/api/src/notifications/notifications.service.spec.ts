import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const user = {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };

  const telegramConfig = {
    id: '11111111-1111-4111-8111-111111111111',
    notificationName: '主群通知',
    enabled: true,
    botTokenEncrypted: 'encrypted-token',
    botTokenTail: '1234',
    chatId: '-100100100',
    notificationLevel: 'warning',
    silentStartTime: null,
    silentEndTime: null,
    retryCount: 3,
    lastTestStatus: 'not_tested',
    lastTestError: null,
    lastTestAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };

  const notificationLog = {
    id: '22222222-2222-4222-8222-222222222222',
    ruleId: null,
    eventCode: 'apple.balance.low',
    module: 'apple',
    channel: 'system',
    recipient: null,
    recipientUserId: user.id,
    title: 'Apple ID 余额不足',
    contentDigest: 'Apple ID 余额不足，请处理',
    payload: Prisma.JsonNull,
    status: 'failed',
    errorMessage: 'manual failure',
    retryCount: 0,
    triggeredAt: now,
    sentAt: null,
    readAt: null,
    readByUserId: null,
    createdAt: now
  };
  const notificationTemplate = {
    id: '44444444-4444-4444-8444-444444444444',
    name: '余额不足模板',
    eventCode: 'apple.balance.low',
    ruleId: 'rule-id',
    channel: 'system',
    title: 'Apple ID 余额不足',
    content: '请及时处理 {{detail}}',
    variables: ['detail'],
    enabled: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rule: {
      id: 'rule-id',
      name: '余额不足',
      eventCode: 'apple.balance.low',
      module: 'apple',
      level: 'warning',
      enabled: true
    }
  };

  function createService() {
    const prisma = {
      telegramConfig: {
        create: jest.fn().mockResolvedValue(telegramConfig),
        findFirst: jest.fn().mockResolvedValue(telegramConfig),
        update: jest.fn().mockResolvedValue(telegramConfig),
        findMany: jest.fn().mockResolvedValue([telegramConfig]),
        count: jest.fn().mockResolvedValue(1)
      },
      notificationLog: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...notificationLog,
            ...data,
            id: notificationLog.id,
            triggeredAt: data.triggeredAt ?? now,
            createdAt: now
          })
        ),
        findUnique: jest.fn().mockResolvedValue(notificationLog),
        update: jest.fn().mockResolvedValue({
          ...notificationLog,
          status: 'sent',
          errorMessage: null,
          retryCount: 1,
          sentAt: now
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([notificationLog]),
        count: jest.fn().mockResolvedValue(1)
      },
      notificationRule: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rule-id',
          name: '余额不足',
          eventCode: 'apple.balance.low',
          module: 'apple',
          level: 'warning',
          enabled: true,
          channels: ['system'],
          recipients: null,
          triggerCondition: null,
          rateLimit: null,
          lastTriggeredAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          templates: []
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'rule-id',
          name: '余额不足',
          eventCode: 'apple.balance.low',
          module: 'apple',
          level: 'warning',
          enabled: true,
          channels: ['system'],
          recipients: null,
          triggerCondition: null,
          rateLimit: null,
          lastTriggeredAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          templates: []
        }),
        update: jest.fn().mockResolvedValue({
          id: 'rule-id',
          eventCode: 'apple.balance.low',
          enabled: false
        }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([])
      },
      notificationTemplate: {
        findMany: jest.fn().mockResolvedValue([notificationTemplate]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(notificationTemplate),
        create: jest.fn().mockResolvedValue(notificationTemplate),
        update: jest.fn().mockResolvedValue(notificationTemplate)
      },
      notificationChannel: {
        upsert: jest.fn()
      },
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        throw new Error('Unexpected transaction input');
      })
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const fieldEncryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-token'),
      decrypt: jest.fn().mockReturnValue('123456789:telegram-token-1234')
    } as unknown as FieldEncryptionService;

    return {
      service: new NotificationsService(prisma, auditLogsService, fieldEncryptionService),
      prisma,
      auditLogsService,
      fieldEncryptionService
    };
  }

  it('encrypts Telegram Bot Token and keeps plaintext out of audit log', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();

    const result = await service.createTelegramConfig(
      {
        notificationName: '主群通知',
        enabled: true,
        botToken: '123456789:telegram-token-1234',
        chatId: '-100100100',
        notificationLevel: 'warning',
        retryCount: 3
      },
      user
    );

    expect(result.hasBotToken).toBe(true);
    expect(result.botTokenTail).toBe('1234');
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith('123456789:telegram-token-1234');
    expect(prisma.telegramConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          botTokenEncrypted: 'encrypted-token',
          botTokenTail: '1234'
        })
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      'telegram-token'
    );
  });

  it('creates an in-app notification log', async () => {
    const { service, prisma } = createService();

    const result = await service.createInApp({
      eventCode: 'apple.balance.low',
      module: 'apple',
      title: 'Apple ID 余额不足',
      content: 'Apple ID 余额不足，请处理',
      recipientUserId: user.id
    });

    expect(result.channel).toBe('system');
    expect(result.status).toBe('sent');
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventCode: 'apple.balance.low',
          module: 'apple',
          channel: 'system',
          recipientUserId: user.id,
          contentDigest: 'Apple ID 余额不足，请处理',
          status: 'sent'
        })
      })
    );
  });

  it('triggers a configured event and renders its template', async () => {
    const { service, prisma } = createService();

    (prisma.notificationRule.findUnique as jest.Mock).mockResolvedValue({
      id: 'rule-id',
      name: '余额不足',
      eventCode: 'apple.balance.low',
      module: 'apple',
      level: 'warning',
      enabled: true,
      channels: ['system'],
      recipients: null,
      triggerCondition: null,
      rateLimit: null,
      lastTriggeredAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      templates: [
        {
          id: 'template-id',
          eventCode: 'apple.balance.low',
          ruleId: 'rule-id',
          channel: 'system',
          name: '余额不足模板',
          title: '{{title}}',
          content: '{{summary}} {{detail}}',
          variables: ['title', 'summary', 'detail'],
          enabled: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        }
      ]
    });

    const result = await service.triggerEvent({
      eventCode: 'apple.balance.low',
      module: 'apple',
      title: 'Apple ID 余额不足',
      content: '当前余额不足以续费',
      payload: {
        detail: '请进入续费任务中心处理'
      }
    });

    expect(result.status).toBe('sent');
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ruleId: 'rule-id',
          eventCode: 'apple.balance.low',
          module: 'apple',
          channel: 'system',
          title: 'Apple ID 余额不足',
          contentDigest: '当前余额不足以续费 请进入续费任务中心处理',
          status: 'sent'
        })
      })
    );
    expect(prisma.notificationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rule-id' },
        data: expect.objectContaining({
          lastTriggeredAt: expect.any(Date)
        })
      })
    );
  });

  it('records skipped logs when event rule is disabled', async () => {
    const { service, prisma } = createService();

    (prisma.notificationRule.findUnique as jest.Mock).mockResolvedValue({
      id: 'rule-id',
      name: '自动发货失败',
      eventCode: 'code.delivery.failed',
      module: 'code',
      level: 'error',
      enabled: false,
      channels: ['system'],
      recipients: null,
      triggerCondition: null,
      rateLimit: null,
      lastTriggeredAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      templates: []
    });

    const result = await service.triggerEvent({
      eventCode: 'code.delivery.failed',
      module: 'code',
      title: '自动发货失败',
      content: '订单已转人工'
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('rule_disabled');
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventCode: 'code.delivery.failed',
          status: 'skipped',
          errorMessage: 'Notification rule is disabled'
        })
      })
    );
  });

  it('disables notification rule and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    await service.setRuleEnabled('rule-id', false, user);

    expect(prisma.notificationRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-id' },
      data: { enabled: false }
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'notification.rule.disable',
        objectType: 'notification_rule'
      })
    );
  });

  it('applies whitelisted notification rule sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listRules({
      page: 1,
      pageSize: 20,
      module: 'apple',
      sortBy: 'module',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(prisma.notificationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: 'apple'
        }),
        orderBy: [{ module: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.notificationRule.count).toHaveBeenCalled();
  });

  it('applies whitelisted notification template sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listTemplates({
      page: 1,
      pageSize: 20,
      channel: 'system',
      sortBy: 'title',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.title).toBe('Apple ID 余额不足');
    expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channel: 'system'
        }),
        orderBy: [{ title: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.notificationTemplate.count).toHaveBeenCalled();
  });

  it('applies whitelisted notification log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listLogs({
      page: 1,
      pageSize: 20,
      status: 'failed',
      sortBy: 'status',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.status).toBe('failed');
    expect(prisma.notificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'failed'
        }),
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.notificationLog.count).toHaveBeenCalled();
  });

  it('retries system notification log without external sender', async () => {
    const { service, prisma } = createService();

    const result = await service.retryLog(notificationLog.id, user);

    expect(result.status).toBe('sent');
    expect(prisma.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notificationLog.id },
        data: expect.objectContaining({
          status: 'sent',
          errorMessage: null,
          retryCount: { increment: 1 }
        })
      })
    );
  });
});
