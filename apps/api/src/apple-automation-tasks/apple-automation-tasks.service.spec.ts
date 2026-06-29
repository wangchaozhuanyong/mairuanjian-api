import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';

describe('AppleAutomationTasksService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const taskId = '11111111-1111-4111-8111-111111111111';
  const secondTaskId = '44444444-4444-4444-8444-444444444444';
  const batchId = '55555555-5555-4555-8555-555555555555';
  const appleAccountId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';
  const attachmentId = '66666666-6666-4666-8666-666666666666';
  const giftCardRunId = '77777777-7777-4777-8777-777777777777';
  const giftCardRowId = '88888888-8888-4888-8888-888888888888';

  const operator = {
    id: userId,
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };

  function restoreEnvValue(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
      return;
    }

    process.env[key] = value;
  }

  const accountRelation = {
    id: appleAccountId,
    appleId: 'apple.user@example.com',
    region: 'US',
    currency: 'USD',
    currentBalance: new Prisma.Decimal('50'),
    status: 'normal'
  };

  const taskBase = {
    id: taskId,
    batchId: null,
    taskType: 'check_balance',
    appleAccountId,
    customerId: null,
    serviceId: null,
    activationId: null,
    priority: 'medium',
    status: 'queued',
    inputPayloadEncrypted: null,
    resultPayload: null,
    screenshotAttachmentId: null,
    errorCode: null,
    errorMessage: null,
    createdByUserId: userId,
    startedAt: null,
    finishedAt: null,
    retryCount: 0,
    manualRequired: false,
    queueJobId: 'apple-check_balance-1',
    createdAt: now,
    updatedAt: now,
    appleAccount: accountRelation,
    customer: null,
    service: null,
    activation: null,
    screenshotAttachment: null,
    createdBy: {
      id: userId,
      username: 'admin',
      displayName: '管理员'
    },
    logs: []
  };

  function createService(taskOverrides: Record<string, unknown> = {}) {
    const appleAccountOverrides =
      typeof taskOverrides.appleAccount === 'object' && taskOverrides.appleAccount
        ? taskOverrides.appleAccount
        : {};
    const task = {
      ...taskBase,
      ...taskOverrides,
      appleAccount: {
        ...accountRelation,
        ...appleAccountOverrides
      }
    };

    const tx = {
      appleAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: appleAccountId }),
        update: jest.fn().mockResolvedValue({})
      },
      automationTask: {
        create: jest.fn().mockResolvedValue(task),
        update: jest.fn().mockResolvedValue(task),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      appleOfficialPriceSnapshot: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      applePriceChangeReview: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      automationTaskLog: {
        create: jest.fn().mockResolvedValue({
          id: 'log-id',
          taskId,
          level: 'info',
          message: 'log',
          payload: null,
          screenshotAttachmentId: null,
          createdAt: now,
          screenshotAttachment: null
        })
      },
      appleAccountStatusCheck: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (typeof input === 'function') {
          return input(tx);
        }

        return Promise.all(input as Promise<unknown>[]);
      }),
      automationTask: {
        findUnique: jest.fn().mockResolvedValue(task),
        findMany: jest.fn().mockResolvedValue([task]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([
          { taskType: 'check_status', status: 'queued', _count: { _all: 1 } },
          { taskType: 'check_balance', status: 'failed', _count: { _all: 1 } }
        ]),
        update: jest.fn().mockResolvedValue(task),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      automationTaskBatch: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({})
      },
      automationTaskLog: {
        create: jest.fn().mockResolvedValue({
          id: 'log-id',
          taskId,
          level: 'info',
          message: 'log',
          payload: null,
          screenshotAttachmentId: null,
          createdAt: now,
          screenshotAttachment: null
        }),
        findMany: jest.fn().mockResolvedValue([])
      },
      appleAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: appleAccountId,
          currentBalance: new Prisma.Decimal('50'),
          currency: 'USD',
          status: 'normal'
        }),
        findMany: jest.fn().mockResolvedValue([{ id: appleAccountId, region: 'US' }]),
        update: jest.fn().mockResolvedValue({})
      },
      appleAccountStatusCheck: {
        create: jest.fn().mockResolvedValue({})
      },
      attachment: {
        findMany: jest.fn().mockResolvedValue([])
      },
      systemParameter: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({
            id: 'system-parameter-id',
            key: create?.key ?? 'system-parameter-key',
            value: create?.value ?? update?.value ?? {},
            group: create?.group ?? update?.group ?? 'default',
            remark: create?.remark ?? update?.remark ?? null,
            updatedByUserId: create?.updatedByUserId ?? update?.updatedByUserId ?? null,
            createdAt: now,
            updatedAt: now
          })
        )
      }
    } as unknown as PrismaService;

    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    const fieldEncryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-input-payload'),
      decrypt: jest.fn(),
      hash: jest.fn((value: string | null | undefined) =>
        value ? `hash-${value.trim().length}` : null
      )
    } as unknown as FieldEncryptionService;

    return {
      service: new AppleAutomationTasksService(prisma, auditLogsService, fieldEncryptionService),
      prisma,
      tx,
      auditLogsService,
      fieldEncryptionService,
      task
    };
  }

  it('applies whitelisted automation task list sorting', async () => {
    const { service, prisma } = createService();

    await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'finishedAt',
      sortOrder: 'asc'
    });

    expect(prisma.automationTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ finishedAt: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.automationTask.count).toHaveBeenCalled();
  });

  it('caches workbench status briefly and invalidates it after task creation', async () => {
    const { service, prisma } = createService();

    const first = await service.workbenchStatus();
    const second = await service.workbenchStatus();

    expect(second).toBe(first);
    expect(prisma.automationTask.groupBy).toHaveBeenCalledTimes(1);

    await service.create(
      {
        taskType: 'check_balance',
        appleAccountId,
        priority: 'medium'
      },
      operator
    );

    const refreshed = await service.workbenchStatus();

    expect(refreshed).not.toBe(first);
    expect(prisma.automationTask.groupBy).toHaveBeenCalledTimes(2);
  });

  it('creates a queued automation task with encrypted input payload and audit log', async () => {
    const { service, tx, auditLogsService, fieldEncryptionService } = createService();

    const result = await service.create(
      {
        taskType: 'check_balance',
        appleAccountId,
        priority: 'high',
        inputPayload: {
          verificationCode: '123456'
        }
      },
      operator
    );

    expect(result.status).toBe('queued');
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith(
      JSON.stringify({ verificationCode: '123456' })
    );
    expect(tx.automationTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskType: 'check_balance',
          appleAccountId,
          priority: 'high',
          status: 'queued',
          inputPayloadEncrypted: 'encrypted-input-payload',
          createdByUserId: userId
        })
      })
    );
    expect(tx.automationTaskLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          level: 'info',
          message: '自动化任务已创建并进入队列'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.create',
        objectType: 'automation_task',
        objectId: taskId
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      '123456'
    );
  });

  it('saves gift card query accounts with encrypted credentials and sanitized audit logs', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();

    const result = await service.saveGiftCardQueryAccounts(
      {
        accounts: [
          {
            appleId: 'apple.user@example.com',
            password: 'secret-pass',
            status: 'ready',
            remark: '主查询账号'
          }
        ]
      },
      operator
    );

    expect(result.maxAccounts).toBe(5);
    expect(result.items).toEqual([
      expect.objectContaining({
        appleIdMasked: 'ap********@example.com',
        passwordSaved: true,
        status: 'ready',
        remark: '主查询账号'
      })
    ]);
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith('apple.user@example.com');
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith('secret-pass');
    expect(fieldEncryptionService.hash).toHaveBeenCalledWith('apple.user@example.com');
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'apple_gift_card_query_accounts' },
        update: expect.objectContaining({
          group: 'apple_gift_card_automation',
          updatedByUserId: userId
        }),
        create: expect.objectContaining({
          key: 'apple_gift_card_query_accounts',
          group: 'apple_gift_card_automation',
          updatedByUserId: userId
        })
      })
    );
    const upsertPayload = JSON.stringify(
      (prisma.systemParameter.upsert as jest.Mock).mock.calls[0][0]
    );
    const auditPayload = JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0]);
    expect(upsertPayload).not.toContain('secret-pass');
    expect(upsertPayload).not.toContain('apple.user@example.com');
    expect(auditPayload).not.toContain('secret-pass');
    expect(auditPayload).not.toContain('apple.user@example.com');
  });

  it('rejects more than five gift card query accounts', async () => {
    const { service, prisma } = createService();

    await expect(
      service.saveGiftCardQueryAccounts({
        accounts: Array.from({ length: 6 }, (_, index) => ({
          appleId: `apple${index}@example.com`,
          password: 'secret-pass'
        }))
      })
    ).rejects.toThrow('accounts cannot exceed 5 items');
    expect(prisma.systemParameter.upsert).not.toHaveBeenCalled();
  });

  it('lists gift card query accounts without exposing encrypted credentials', async () => {
    const { service, prisma } = createService();
    (prisma.systemParameter.findUnique as jest.Mock).mockResolvedValue({
      id: 'gift-card-query-accounts',
      key: 'apple_gift_card_query_accounts',
      value: {
        version: 1,
        accounts: [
          {
            id: 'gift-card-account-1',
            appleIdEncrypted: 'encrypted-apple-id',
            appleIdHash: 'hash-22',
            appleIdMasked: 'ap********@example.com',
            passwordEncrypted: 'encrypted-password',
            status: 'ready',
            remark: '主查询账号',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        ]
      },
      group: 'apple_gift_card_automation',
      remark: 'Apple 礼品卡余额查询长期登录账号池',
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now
    });

    const result = await service.listGiftCardQueryAccounts();

    expect(result).toEqual({
      maxAccounts: 5,
      updatedAt: now.toISOString(),
      items: [
        {
          id: 'gift-card-account-1',
          appleIdMasked: 'ap********@example.com',
          passwordSaved: true,
          status: 'ready',
          remark: '主查询账号',
          updatedAt: now.toISOString()
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain('encrypted-password');
    expect(JSON.stringify(result)).not.toContain('encrypted-apple-id');
  });

  it('creates a gift card balance check run from uploaded image attachments', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();
    (fieldEncryptionService.decrypt as jest.Mock).mockImplementation((value: string | null) => {
      if (value === 'encrypted-input-payload') return 'XABC123456789';
      if (value === 'encrypted-apple-id') return 'apple.user@example.com';
      if (value === 'encrypted-password') return 'secret-pass';
      return null;
    });
    (prisma.systemParameter.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.key === 'apple_gift_card_query_accounts') {
        return Promise.resolve({
          id: 'gift-card-query-accounts',
          key: 'apple_gift_card_query_accounts',
          value: {
            version: 1,
            accounts: [
              {
                id: 'gift-card-account-1',
                appleIdEncrypted: 'encrypted-apple-id',
                appleIdHash: 'hash-22',
                appleIdMasked: 'ap********@example.com',
                passwordEncrypted: 'encrypted-password',
                status: 'ready',
                remark: '主查询账号',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
              }
            ]
          },
          group: 'apple_gift_card_automation',
          remark: 'Apple 礼品卡余额查询长期登录账号池',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      return Promise.resolve(null);
    });
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue([
      {
        id: attachmentId,
        originalName: 'XABC123456789.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'gift-card-photo.jpg'
      }
    ]);

    const result = await service.createGiftCardBalanceCheck(
      {
        attachmentIds: [attachmentId]
      },
      operator
    );

    expect(result.accountCount).toBe(1);
    expect(result.imageCount).toBe(1);
    expect(result.status).toBe('manual_required');
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        attachmentId,
        fileName: '****6789.jpg',
        extractedCode: '****6789',
        assignedAppleId: 'ap********@example.com',
        status: 'manual_required',
        message: '礼品卡余额查询执行器未配置；已识别卡码和查询账号，请配置执行器后在本页重试'
      })
    );
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith('XABC123456789');
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'apple_gift_card_balance_check_runs' },
        update: expect.objectContaining({
          group: 'apple_gift_card_automation',
          updatedByUserId: userId
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.gift_card_balance_check.create',
        objectType: 'system_parameter'
      })
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls[0][0])).not.toContain(
      'encrypted-password'
    );
    expect(
      JSON.stringify((prisma.systemParameter.upsert as jest.Mock).mock.calls[0][0])
    ).not.toContain('XABC123456789');
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.gift_card_balance_check.run_skipped'
      })
    );
  });

  it('runs the configured gift card balance query command and stores sanitized results', async () => {
    const previousCommand = process.env.APPLE_GIFT_CARD_BALANCE_QUERY_COMMAND;
    const previousArgs = process.env.APPLE_GIFT_CARD_BALANCE_QUERY_ARGS;
    process.env.APPLE_GIFT_CARD_BALANCE_QUERY_COMMAND = process.execPath;
    process.env.APPLE_GIFT_CARD_BALANCE_QUERY_ARGS = JSON.stringify([
      '-e',
      [
        "let input = '';",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', () => {",
        'const data = JSON.parse(input);',
        'const row = data.rows[0];',
        'const account = data.accounts[0];',
        'process.stdout.write(JSON.stringify({ rows: [{ rowId: row.id, status: "success", balance: "25.00", currency: "usd", message: `ok ${row.giftCardCode} ${account.appleId}` }] }));',
        '});'
      ].join('')
    ]);
    const { service, prisma, fieldEncryptionService } = createService();
    (fieldEncryptionService.decrypt as jest.Mock).mockImplementation((value: string | null) => {
      if (value === 'encrypted-input-payload') return 'XABC123456789';
      if (value === 'encrypted-apple-id') return 'apple.user@example.com';
      if (value === 'encrypted-password') return 'secret-pass';
      return null;
    });
    (prisma.systemParameter.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.key === 'apple_gift_card_query_accounts') {
        return Promise.resolve({
          id: 'gift-card-query-accounts',
          key: 'apple_gift_card_query_accounts',
          value: {
            version: 1,
            accounts: [
              {
                id: 'gift-card-account-1',
                appleIdEncrypted: 'encrypted-apple-id',
                appleIdHash: 'hash-22',
                appleIdMasked: 'ap********@example.com',
                passwordEncrypted: 'encrypted-password',
                status: 'ready',
                remark: '主查询账号',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
              }
            ]
          },
          group: 'apple_gift_card_automation',
          remark: 'Apple 礼品卡余额查询长期登录账号池',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      return Promise.resolve(null);
    });
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue([
      {
        id: attachmentId,
        originalName: 'XABC123456789.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'gift-card-photo.jpg'
      }
    ]);

    try {
      const result = await service.createGiftCardBalanceCheck(
        {
          attachmentIds: [attachmentId]
        },
        operator
      );

      expect(result.status).toBe('completed');
      expect(result.rows[0]).toEqual(
        expect.objectContaining({
          extractedCode: '****6789',
          status: 'success',
          balance: '25.00',
          currency: 'USD',
          message: 'ok [已脱敏] [已脱敏]'
        })
      );
      expect(JSON.stringify((prisma.systemParameter.upsert as jest.Mock).mock.calls)).not.toContain(
        'XABC123456789'
      );
      expect(JSON.stringify((prisma.systemParameter.upsert as jest.Mock).mock.calls)).not.toContain(
        'apple.user@example.com'
      );
    } finally {
      restoreEnvValue('APPLE_GIFT_CARD_BALANCE_QUERY_COMMAND', previousCommand);
      restoreEnvValue('APPLE_GIFT_CARD_BALANCE_QUERY_ARGS', previousArgs);
    }
  });

  it('keeps gift card image rows pending when OCR is disabled and no code is found', async () => {
    const previousOcrEnabled = process.env.APPLE_GIFT_CARD_OCR_ENABLED;
    process.env.APPLE_GIFT_CARD_OCR_ENABLED = 'false';
    const { service, prisma } = createService();
    (prisma.systemParameter.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.key === 'apple_gift_card_query_accounts') {
        return Promise.resolve({
          id: 'gift-card-query-accounts',
          key: 'apple_gift_card_query_accounts',
          value: {
            version: 1,
            accounts: [
              {
                id: 'gift-card-account-1',
                appleIdEncrypted: 'encrypted-apple-id',
                appleIdHash: 'hash-22',
                appleIdMasked: 'ap********@example.com',
                passwordEncrypted: 'encrypted-password',
                status: 'ready',
                remark: '主查询账号',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
              }
            ]
          },
          group: 'apple_gift_card_automation',
          remark: 'Apple 礼品卡余额查询长期登录账号池',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      return Promise.resolve(null);
    });
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue([
      {
        id: attachmentId,
        originalName: 'gift-card-photo.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'gift-card-photo.jpg'
      }
    ]);

    try {
      const result = await service.createGiftCardBalanceCheck(
        {
          attachmentIds: [attachmentId]
        },
        operator
      );

      expect(result.status).toBe('manual_required');
      expect(result.rows[0]).toEqual(
        expect.objectContaining({
          fileName: 'gift-card-photo.jpg',
          extractedCode: '待识别',
          status: 'pending_ocr',
          message: '图片已保存并分配查询账号，OCR 未启用，请在结果表补录礼品卡代码'
        })
      );
    } finally {
      restoreEnvValue('APPLE_GIFT_CARD_OCR_ENABLED', previousOcrEnabled);
    }
  });

  it('tries gift card image OCR by default when no explicit OCR switch is set', async () => {
    const previousOcrEnabled = process.env.APPLE_GIFT_CARD_OCR_ENABLED;
    delete process.env.APPLE_GIFT_CARD_OCR_ENABLED;
    const { service, prisma } = createService();
    (prisma.systemParameter.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.key === 'apple_gift_card_query_accounts') {
        return Promise.resolve({
          id: 'gift-card-query-accounts',
          key: 'apple_gift_card_query_accounts',
          value: {
            version: 1,
            accounts: [
              {
                id: 'gift-card-account-1',
                appleIdEncrypted: 'encrypted-apple-id',
                appleIdHash: 'hash-22',
                appleIdMasked: 'ap********@example.com',
                passwordEncrypted: 'encrypted-password',
                status: 'ready',
                remark: '主查询账号',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
              }
            ]
          },
          group: 'apple_gift_card_automation',
          remark: 'Apple 礼品卡余额查询长期登录账号池',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      return Promise.resolve(null);
    });
    (prisma.attachment.findMany as jest.Mock).mockResolvedValue([
      {
        id: attachmentId,
        originalName: 'gift-card-photo.jpg',
        mimeType: 'image/jpeg',
        storageKey: 'missing-gift-card-photo.jpg'
      }
    ]);

    try {
      const result = await service.createGiftCardBalanceCheck(
        {
          attachmentIds: [attachmentId]
        },
        operator
      );

      expect(result.rows[0]).toEqual(
        expect.objectContaining({
          status: 'pending_ocr',
          message:
            '图片已保存并分配查询账号，OCR 找不到图片文件，请检查附件存储或在结果表补录礼品卡代码'
        })
      );
    } finally {
      restoreEnvValue('APPLE_GIFT_CARD_OCR_ENABLED', previousOcrEnabled);
    }
  });

  it('updates a gift card balance check row with an encrypted manually entered code', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();
    (fieldEncryptionService.decrypt as jest.Mock).mockImplementation((value: string | null) => {
      if (value === 'encrypted-input-payload') return 'XABC1234567890';
      if (value === 'encrypted-apple-id') return 'apple.user@example.com';
      if (value === 'encrypted-password') return 'secret-pass';
      return null;
    });
    (prisma.systemParameter.findUnique as jest.Mock).mockImplementation(({ where }) => {
      if (where.key === 'apple_gift_card_balance_check_runs') {
        return Promise.resolve({
          id: 'gift-card-balance-check-runs',
          key: 'apple_gift_card_balance_check_runs',
          value: {
            version: 1,
            runs: [
              {
                id: giftCardRunId,
                status: 'manual_required',
                accountCount: 1,
                imageCount: 1,
                rows: [
                  {
                    id: giftCardRowId,
                    attachmentId,
                    fileName: 'gift-card-photo.jpg',
                    extractedCode: '待识别',
                    giftCardCodeEncrypted: null,
                    giftCardCodeHash: null,
                    giftCardCodeTail: null,
                    assignedAccountId: 'gift-card-account-1',
                    assignedAppleIdMasked: 'ap********@example.com',
                    status: 'pending_ocr',
                    balance: '-',
                    currency: '-',
                    message: '图片已保存并分配查询账号，OCR 未启用，请在结果表补录礼品卡代码'
                  }
                ],
                createdAt: now.toISOString(),
                createdByUserId: userId
              }
            ]
          },
          group: 'apple_gift_card_automation',
          remark: 'Apple 礼品卡余额查询批次记录',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      if (where.key === 'apple_gift_card_query_accounts') {
        return Promise.resolve({
          id: 'gift-card-query-accounts',
          key: 'apple_gift_card_query_accounts',
          value: {
            version: 1,
            accounts: [
              {
                id: 'gift-card-account-1',
                appleIdEncrypted: 'encrypted-apple-id',
                appleIdHash: 'hash-22',
                appleIdMasked: 'ap********@example.com',
                passwordEncrypted: 'encrypted-password',
                status: 'ready',
                remark: '主查询账号',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
              }
            ]
          },
          group: 'apple_gift_card_automation',
          remark: 'Apple 礼品卡余额查询长期登录账号池',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        });
      }

      return Promise.resolve(null);
    });

    const result = await service.updateGiftCardBalanceCheckRow(
      giftCardRunId,
      giftCardRowId,
      {
        extractedCode: 'xabc 1234 567890'
      },
      operator
    );

    expect(result.status).toBe('manual_required');
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        extractedCode: '****7890',
        status: 'manual_required',
        message: '礼品卡余额查询执行器未配置；已识别卡码和查询账号，请配置执行器后在本页重试'
      })
    );
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith('XABC1234567890');
    expect(fieldEncryptionService.hash).toHaveBeenCalledWith('XABC1234567890');
    expect(
      JSON.stringify((prisma.systemParameter.upsert as jest.Mock).mock.calls[0][0])
    ).not.toContain('XABC1234567890');
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls)).not.toContain(
      'XABC1234567890'
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.gift_card_balance_check.row.update_code',
        afterData: expect.objectContaining({
          giftCardCodeTail: '7890'
        })
      })
    );
  });

  it('rejects gift card balance checks when the query account pool is empty', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createGiftCardBalanceCheck({ attachmentIds: [attachmentId] }, operator)
    ).rejects.toThrow('Gift card query accounts are not configured');
    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it('creates batch Apple web status check tasks with matching region gateway plan', async () => {
    const previousGatewayRegions = process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS;
    process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS = 'US';
    const { service, tx, auditLogsService, fieldEncryptionService } = createService();

    (tx.automationTask.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...taskBase,
        ...data,
        resultPayload: data.resultPayload,
        appleAccount: accountRelation
      })
    );

    try {
      const result = await service.batchStatusCheck(
        {
          appleAccountIds: [appleAccountId],
          priority: 'high',
          note: '日常批量检查'
        },
        operator
      );

      expect(result.createdCount).toBe(1);
      expect(result.queuedCount).toBe(1);
      expect(result.manualRequiredCount).toBe(0);
      expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith(
        expect.stringContaining('apple_web_status_check')
      );
      expect(tx.automationTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskType: 'check_status',
            appleAccountId,
            priority: 'high',
            status: 'queued',
            manualRequired: false,
            errorCode: null
          })
        })
      );
      expect(tx.automationTaskLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            level: 'info',
            message: 'Apple 官网状态检查任务已按账号地区进入队列'
          })
        })
      );
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'apple_automation_task.batch_status_check'
        })
      );
    } finally {
      restoreEnvValue('APPLE_WEB_CHECK_GATEWAY_REGIONS', previousGatewayRegions);
    }
  });

  it('moves batch Apple web status checks to manual verification when region gateway is missing', async () => {
    const previousGatewayRegions = process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS;
    process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS = '';
    const { service, tx } = createService();

    (tx.automationTask.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...taskBase,
        ...data,
        resultPayload: data.resultPayload,
        appleAccount: accountRelation
      })
    );

    try {
      const result = await service.batchStatusCheck(
        {
          appleAccountIds: [appleAccountId],
          priority: 'medium'
        },
        operator
      );

      expect(result.createdCount).toBe(1);
      expect(result.queuedCount).toBe(0);
      expect(result.manualRequiredCount).toBe(1);
      expect(tx.automationTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'waiting_manual_verify',
            manualRequired: true,
            errorCode: 'gateway_region_not_configured'
          })
        })
      );
      expect(tx.automationTaskLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            level: 'warning',
            message: 'Apple 官网状态检查缺少同国家出口 IP，已转人工验证'
          })
        })
      );
    } finally {
      restoreEnvValue('APPLE_WEB_CHECK_GATEWAY_REGIONS', previousGatewayRegions);
    }
  });

  it('uses synced Apple web gateway nodes before environment fallback', async () => {
    const previousGatewayRegions = process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS;
    process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS = '';
    const { service, prisma, tx } = createService();

    (prisma.systemParameter.findUnique as jest.Mock).mockResolvedValue({
      id: 'gateway-nodes',
      key: 'apple_web_gateway_nodes',
      value: {
        items: [
          {
            id: 'awg_us_1',
            name: 'US Los Angeles',
            countryCode: 'US',
            protocol: 'trojan',
            status: 'available',
            rawEncrypted: 'encrypted-node'
          }
        ],
        syncedAt: '2026-06-18T00:00:00.000Z',
        sourceHash: 'hash'
      },
      group: 'apple_web_gateway',
      remark: 'Apple 官网检查 Worker 节点池',
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now
    });
    (tx.automationTask.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...taskBase,
        ...data,
        resultPayload: data.resultPayload,
        appleAccount: accountRelation
      })
    );

    try {
      const result = await service.batchStatusCheck(
        {
          appleAccountIds: [appleAccountId],
          priority: 'medium',
          gatewayRegion: 'US'
        },
        operator
      );

      expect(result.queuedCount).toBe(1);
      expect(result.manualRequiredCount).toBe(0);
      expect(tx.automationTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'queued',
            manualRequired: false,
            resultPayload: expect.objectContaining({
              executionPlan: expect.objectContaining({
                gatewayConfigured: true,
                gatewayProfileCode: 'awg_us_1',
                gatewayNodeId: 'awg_us_1',
                gatewayNodeName: 'US Los Angeles',
                gatewayNodeCandidates: [
                  {
                    id: 'awg_us_1',
                    name: 'US Los Angeles',
                    countryCode: 'US',
                    status: 'available'
                  }
                ]
              })
            })
          })
        })
      );
    } finally {
      restoreEnvValue('APPLE_WEB_CHECK_GATEWAY_REGIONS', previousGatewayRegions);
    }
  });

  it('returns web check gateway candidates without exposing encrypted proxy config', async () => {
    const { service, prisma, fieldEncryptionService } = createService({
      taskType: 'check_status',
      inputPayloadEncrypted: 'encrypted-web-check-input'
    });
    (fieldEncryptionService.decrypt as jest.Mock).mockReturnValue(
      JSON.stringify({
        executionPlan: {
          adapterVersion: 'apple-web-v1',
          accountRegion: 'US',
          exitCountry: 'US',
          countryCode: 'US',
          locale: 'en-US',
          timezone: 'America/Los_Angeles',
          appleCountryUrl: 'https://www.apple.com/',
          appleAccountSignInUrl: 'https://account.apple.com/sign-in',
          gatewayProfileCode: 'awg_us_1',
          gatewayNodeId: 'awg_us_1',
          gatewayNodeName: 'US Los Angeles',
          gatewayNodeCandidates: [
            {
              id: 'awg_us_1',
              name: 'US Los Angeles',
              countryCode: 'US',
              status: 'available'
            }
          ],
          gatewayConfigured: true,
          regionMatched: true,
          manualChallengeMode: 'operator_prompt'
        }
      })
    );
    (prisma.systemParameter.findUnique as jest.Mock).mockResolvedValue({
      id: 'gateway-nodes',
      key: 'apple_web_gateway_nodes',
      value: {
        items: [
          {
            id: 'awg_us_1',
            name: 'US Los Angeles',
            countryCode: 'US',
            protocol: 'trojan',
            status: 'available',
            rawEncrypted: 'encrypted:trojan://secret@us.example.com:443#US'
          }
        ]
      },
      group: 'apple_web_gateway',
      remark: 'Apple 官网检查 Worker 节点池',
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now
    });

    const result = await service.webCheckGateways(taskId);

    expect(result.canRunWithSyncedNode).toBe(true);
    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: 'awg_us_1',
        countryCode: 'US',
        protocol: 'trojan',
        hasEncryptedConfig: true
      })
    ]);
    expect(JSON.stringify(result)).not.toContain('trojan://secret');
    expect(JSON.stringify(result)).not.toContain('rawEncrypted');
  });

  it('marks gateway node unavailable and moves task to manual verification on exit country mismatch', async () => {
    const { service, prisma, tx, auditLogsService, fieldEncryptionService } = createService({
      taskType: 'check_status',
      inputPayloadEncrypted: 'encrypted-web-check-input',
      status: 'running'
    });
    (fieldEncryptionService.decrypt as jest.Mock).mockReturnValue(
      JSON.stringify({
        executionPlan: {
          adapterVersion: 'apple-web-v1',
          accountRegion: 'US',
          exitCountry: 'US',
          countryCode: 'US',
          locale: 'en-US',
          timezone: 'America/Los_Angeles',
          appleCountryUrl: 'https://www.apple.com/',
          appleAccountSignInUrl: 'https://account.apple.com/sign-in',
          gatewayProfileCode: 'awg_us_1',
          gatewayNodeId: 'awg_us_1',
          gatewayNodeName: 'US Los Angeles',
          gatewayNodeCandidates: [
            {
              id: 'awg_us_1',
              name: 'US Los Angeles',
              countryCode: 'US',
              status: 'available'
            }
          ],
          gatewayConfigured: true,
          regionMatched: true,
          manualChallengeMode: 'operator_prompt'
        }
      })
    );
    (prisma.systemParameter.findUnique as jest.Mock).mockResolvedValue({
      id: 'gateway-nodes',
      key: 'apple_web_gateway_nodes',
      value: {
        items: [
          {
            id: 'awg_us_1',
            name: 'US Los Angeles',
            countryCode: 'US',
            protocol: 'trojan',
            status: 'available',
            rawEncrypted: 'encrypted-node'
          }
        ]
      },
      group: 'apple_web_gateway',
      remark: 'Apple 官网检查 Worker 节点池',
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now
    });
    (tx.automationTask.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...taskBase,
        ...data,
        appleAccount: accountRelation,
        logs: []
      })
    );

    const result = await service.recordWebCheckGatewayAttempt(
      taskId,
      {
        nodeId: 'awg_us_1',
        status: 'success',
        exitIp: '203.0.113.10',
        exitCountry: 'SG',
        latencyMs: 120
      },
      operator
    );

    expect(result.task.status).toBe('waiting_manual_verify');
    expect(result.gatewayAttempt).toEqual(
      expect.objectContaining({
        nodeId: 'awg_us_1',
        status: 'failed',
        expectedExitCountry: 'US',
        detectedExitCountry: 'SG',
        exitCountryMatched: false,
        exitIpProvided: true
      })
    );
    expect(JSON.stringify(result.gatewayAttempt)).not.toContain('203.0.113.10');
    expect(prisma.systemParameter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'apple_web_gateway_nodes' },
        data: expect.objectContaining({
          value: expect.objectContaining({
            items: [
              expect.objectContaining({
                id: 'awg_us_1',
                status: 'unavailable',
                latencyMs: 120,
                failureReason: '出口国家不匹配：期望 US，实际 SG'
              })
            ]
          })
        })
      })
    );
    expect(tx.automationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'waiting_manual_verify',
          manualRequired: true,
          errorCode: 'gateway_exit_check_failed'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.web_check_gateway_attempt'
      })
    );
  });

  it('allows batch Apple web status checks to use a stable gateway country different from account region', async () => {
    const previousGatewayRegions = process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS;
    process.env.APPLE_WEB_CHECK_GATEWAY_REGIONS = 'US';
    const { service, prisma, tx } = createService({
      appleAccount: {
        region: 'MY'
      }
    });

    (prisma.appleAccount.findMany as jest.Mock).mockResolvedValue([
      { id: appleAccountId, region: 'MY' }
    ]);
    (tx.automationTask.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...taskBase,
        ...data,
        resultPayload: data.resultPayload,
        appleAccount: {
          ...accountRelation,
          region: 'MY'
        }
      })
    );

    try {
      const result = await service.batchStatusCheck(
        {
          appleAccountIds: [appleAccountId],
          gatewayRegion: 'US'
        },
        operator
      );

      expect(result.queuedCount).toBe(1);
      expect(result.manualRequiredCount).toBe(0);
      expect(tx.automationTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'queued',
            manualRequired: false,
            resultPayload: expect.objectContaining({
              executionPlan: expect.objectContaining({
                accountRegion: 'MY',
                exitCountry: 'US',
                regionMatched: false,
                gatewayConfigured: true
              })
            })
          })
        })
      );
    } finally {
      restoreEnvValue('APPLE_WEB_CHECK_GATEWAY_REGIONS', previousGatewayRegions);
    }
  });

  it('runs check balance placeholder with system balance snapshot', async () => {
    const successTask = {
      ...taskBase,
      status: 'success',
      resultPayload: {
        balanceSnapshot: '50',
        currency: 'USD',
        source: 'system_snapshot'
      },
      finishedAt: now
    };
    const { service, prisma } = createService();
    (prisma.automationTask.update as jest.Mock)
      .mockResolvedValueOnce({ ...taskBase, status: 'running' })
      .mockResolvedValueOnce(successTask);

    const result = await service.runManualReview(taskId, operator);

    expect(result.status).toBe('success');
    expect(result.manualRequired).toBe(false);
    expect(result.resultPayload).toEqual({
      balanceSnapshot: '50',
      currency: 'USD',
      source: 'system_snapshot'
    });
    expect(prisma.automationTaskLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          level: 'success',
          message: '余额查询已按系统当前余额快照完成'
        })
      })
    );
  });

  it('moves manual-review tasks to manual verification when direct execution is unavailable', async () => {
    const manualTask = {
      ...taskBase,
      taskType: 'topup',
      status: 'waiting_manual_verify',
      manualRequired: true,
      errorCode: 'worker_not_configured',
      errorMessage: '该任务类型当前需要人工验证',
      resultPayload: {
        source: 'manual_verification',
        taskType: 'topup'
      },
      finishedAt: now
    };
    const { service, prisma } = createService({ taskType: 'topup' });
    (prisma.automationTask.update as jest.Mock)
      .mockResolvedValueOnce({ ...taskBase, taskType: 'topup', status: 'running' })
      .mockResolvedValueOnce(manualTask);

    const result = await service.runManualReview(taskId, operator);

    expect(result.status).toBe('waiting_manual_verify');
    expect(result.manualRequired).toBe(true);
    expect(result.errorCode).toBe('worker_not_configured');
    expect(prisma.automationTaskLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          level: 'warning',
          message: '该任务类型当前已转人工验证'
        })
      })
    );
  });

  it('requeues manual verification task on retry', async () => {
    const { service, prisma } = createService({
      status: 'waiting_manual_verify',
      manualRequired: true,
      errorCode: 'worker_not_configured'
    });
    (prisma.automationTask.update as jest.Mock).mockResolvedValueOnce({
      ...taskBase,
      status: 'queued',
      manualRequired: false,
      errorCode: null,
      retryCount: 1
    });

    const result = await service.retry(taskId, operator);

    expect(result.status).toBe('queued');
    expect(prisma.automationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'queued',
          retryCount: { increment: 1 },
          manualRequired: false,
          errorCode: null,
          errorMessage: null
        })
      })
    );
  });

  it('submits encrypted manual input and requeues the task without logging the code', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService({
      status: 'waiting_manual_verify',
      manualRequired: true,
      inputPayloadEncrypted: 'encrypted-existing-input',
      errorCode: 'manual_required',
      errorMessage: 'Apple 要求人工验证码'
    });
    (fieldEncryptionService.decrypt as jest.Mock).mockReturnValue(
      JSON.stringify({
        executionPlan: {
          countryCode: 'US'
        }
      })
    );
    (prisma.automationTask.update as jest.Mock).mockResolvedValueOnce({
      ...taskBase,
      status: 'queued',
      manualRequired: false,
      inputPayloadEncrypted: 'encrypted-input-payload',
      retryCount: 1,
      errorCode: null,
      errorMessage: null
    });

    const result = await service.submitManualInput(
      taskId,
      {
        inputType: 'verification_code',
        value: '123456',
        note: 'Apple 要求验证码'
      },
      operator
    );

    expect(result.status).toBe('queued');
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith(expect.stringContaining('123456'));
    expect(prisma.automationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'queued',
          retryCount: { increment: 1 },
          inputPayloadEncrypted: 'encrypted-input-payload',
          manualRequired: false,
          errorCode: null,
          errorMessage: null
        })
      })
    );
    expect(JSON.stringify((prisma.automationTaskLog.create as jest.Mock).mock.calls)).not.toContain(
      '123456'
    );
    expect(JSON.stringify((auditLogsService.create as jest.Mock).mock.calls)).not.toContain(
      '123456'
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.manual_input.submit',
        afterData: expect.objectContaining({
          inputType: 'verification_code',
          valueLength: 6
        })
      })
    );
  });

  it('rejects retry while task is already running', async () => {
    const { service } = createService({ status: 'running' });

    await expect(service.retry(taskId, operator)).rejects.toThrow(ConflictException);
  });

  it('bulk deletes selected automation task records and writes an audit log', async () => {
    const { service, prisma, tx, auditLogsService } = createService({
      batchId,
      status: 'success'
    });
    const secondTask = {
      ...taskBase,
      id: secondTaskId,
      batchId,
      status: 'failed',
      createdAt: new Date('2026-06-18T00:01:00.000Z')
    };
    (prisma.automationTask.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: taskId,
          batchId,
          taskType: 'check_balance',
          status: 'success',
          appleAccountId,
          createdAt: now
        },
        {
          id: secondTaskId,
          batchId,
          taskType: 'check_status',
          status: 'failed',
          appleAccountId,
          createdAt: secondTask.createdAt
        }
      ])
      .mockResolvedValueOnce([]);

    const result = await service.bulkDelete({ ids: [taskId, secondTaskId] }, operator);

    expect(result).toEqual({ deleted: true, count: 2, ids: [taskId, secondTaskId] });
    expect(tx.appleOfficialPriceSnapshot.updateMany).toHaveBeenCalledWith({
      where: { automationTaskId: { in: [taskId, secondTaskId] } },
      data: { automationTaskId: null }
    });
    expect(tx.applePriceChangeReview.updateMany).toHaveBeenCalledWith({
      where: { automationTaskId: { in: [taskId, secondTaskId] } },
      data: { automationTaskId: null }
    });
    expect(tx.automationTask.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [taskId, secondTaskId] } }
    });
    expect(prisma.automationTaskBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: batchId },
        data: expect.objectContaining({ totalCount: 0 })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_automation_task.bulk_delete',
        objectId: taskId
      })
    );
  });
});
