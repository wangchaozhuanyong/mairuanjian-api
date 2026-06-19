import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppleAutomationTasksService } from './apple-automation-tasks.service';

describe('AppleAutomationTasksService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const taskId = '11111111-1111-4111-8111-111111111111';
  const appleAccountId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';

  const operator = {
    id: userId,
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };

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
        update: jest.fn().mockResolvedValue(task)
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
        update: jest.fn().mockResolvedValue(task)
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
        update: jest.fn().mockResolvedValue({})
      },
      appleAccountStatusCheck: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;

    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    const fieldEncryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-input-payload'),
      decrypt: jest.fn()
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

    const result = await service.runPlaceholder(taskId, operator);

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
          message: '查询余额占位任务已使用系统当前余额快照完成'
        })
      })
    );
  });

  it('moves real worker tasks to manual verification during placeholder run', async () => {
    const manualTask = {
      ...taskBase,
      taskType: 'topup',
      status: 'waiting_manual_verify',
      manualRequired: true,
      errorCode: 'worker_not_configured',
      errorMessage: '真实 Apple ID 自动化 Worker 尚未接入，需要人工验证',
      resultPayload: {
        source: 'placeholder_worker',
        taskType: 'topup'
      },
      finishedAt: now
    };
    const { service, prisma } = createService({ taskType: 'topup' });
    (prisma.automationTask.update as jest.Mock)
      .mockResolvedValueOnce({ ...taskBase, taskType: 'topup', status: 'running' })
      .mockResolvedValueOnce(manualTask);

    const result = await service.runPlaceholder(taskId, operator);

    expect(result.status).toBe('waiting_manual_verify');
    expect(result.manualRequired).toBe(true);
    expect(result.errorCode).toBe('worker_not_configured');
    expect(prisma.automationTaskLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          level: 'warning',
          message: '该任务类型需要真实自动化 Worker，当前已转人工验证'
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

  it('rejects retry while task is already running', async () => {
    const { service } = createService({ status: 'running' });

    await expect(service.retry(taskId, operator)).rejects.toThrow(ConflictException);
  });
});
