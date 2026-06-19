import { Prisma as PrismaNamespace } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');

  function createService() {
    const platformLog = {
      id: '11111111-1111-4111-8111-111111111111',
      platform: 'taobao',
      syncType: 'test',
      status: 'failed',
      requestCount: 1,
      errorRate: new PrismaNamespace.Decimal(1),
      errorMessage: 'not configured',
      startedAt: now,
      finishedAt: now,
      metadata: {},
      createdAt: now
    };
    const sensitiveLog = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: null,
      module: 'apple',
      fieldName: 'gift_card_code',
      objectType: 'apple_balance_topup',
      objectId: null,
      accessReason: 'unit test',
      approved: true,
      ip: null,
      userAgent: null,
      createdAt: now,
      user: null
    };
    const auditLog = {
      id: '33333333-3333-4333-8333-333333333333',
      userId: null,
      module: 'system',
      action: 'user.update',
      objectType: 'user',
      objectId: 'user-id',
      beforeData: null,
      afterData: null,
      ip: null,
      userAgent: null,
      remark: 'updated user',
      createdAt: now,
      user: null
    };
    const loginLog = {
      id: '44444444-4444-4444-8444-444444444444',
      userId: null,
      username: 'admin',
      status: 'failed',
      failureReason: 'bad password',
      ip: '127.0.0.1',
      userAgent: null,
      location: null,
      abnormal: true,
      createdAt: now,
      user: null
    };
    const exportLog = {
      id: '55555555-5555-4555-8555-555555555555',
      module: 'apple',
      exportScope: {},
      fields: ['appleId', 'maskedPhone'],
      containsSensitive: true,
      status: 'failed',
      filePath: null,
      downloadExpiresAt: null,
      errorMessage: 'export failed',
      createdById: null,
      createdAt: now,
      finishedAt: now,
      createdBy: null
    };
    const automationTaskLog = {
      id: '66666666-6666-4666-8666-666666666666',
      taskId: '77777777-7777-4777-8777-777777777777',
      level: 'error',
      message: 'automation failed',
      payload: {},
      screenshotAttachmentId: null,
      createdAt: now,
      task: {
        id: '77777777-7777-4777-8777-777777777777',
        taskType: 'balance_check',
        status: 'failed',
        priority: 'high',
        manualRequired: true,
        queueJobId: 'job-001',
        errorCode: 'AUTO_FAILED',
        errorMessage: 'worker failed',
        createdAt: now
      },
      screenshotAttachment: null
    };
    const prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        throw new Error('Unexpected transaction input');
      }),
      auditLog: {
        findMany: jest.fn().mockResolvedValue([auditLog]),
        count: jest.fn().mockResolvedValue(1)
      },
      platformSyncLog: {
        findMany: jest.fn().mockResolvedValue([platformLog]),
        count: jest.fn().mockResolvedValue(1)
      },
      sensitiveAccessLog: {
        findMany: jest.fn().mockResolvedValue([sensitiveLog]),
        count: jest.fn().mockResolvedValue(1)
      },
      loginLog: {
        findMany: jest.fn().mockResolvedValue([loginLog]),
        count: jest.fn().mockResolvedValue(1)
      },
      dataExportJob: {
        findMany: jest.fn().mockResolvedValue([exportLog]),
        count: jest.fn().mockResolvedValue(1)
      },
      automationTaskLog: {
        findMany: jest.fn().mockResolvedValue([automationTaskLog]),
        count: jest.fn().mockResolvedValue(1)
      }
    } as unknown as PrismaService;

    return {
      service: new AuditLogsService(prisma),
      prisma
    };
  }

  it('lists platform interface logs with decimal error rate as string', async () => {
    const { service, prisma } = createService();

    const result = await service.listPlatformInterfaceLogs({
      page: 1,
      pageSize: 20,
      platform: 'taobao',
      status: 'failed'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.errorRate).toBe('1');
    expect(prisma.platformSyncLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: 'taobao',
          status: 'failed'
        })
      })
    );
  });

  it('applies whitelisted platform interface log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listPlatformInterfaceLogs({
      page: 1,
      pageSize: 20,
      platform: 'taobao',
      status: 'failed',
      sortBy: 'syncType',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.errorRate).toBe('1');
    expect(prisma.platformSyncLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: 'taobao',
          status: 'failed'
        }),
        orderBy: [{ syncType: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.platformSyncLog.count).toHaveBeenCalled();
  });

  it('lists sensitive access logs with approved filter', async () => {
    const { service, prisma } = createService();

    const result = await service.listSensitiveAccessLogs({
      page: 1,
      pageSize: 20,
      module: 'apple',
      approved: 'true'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.fieldName).toBe('gift_card_code');
    expect(prisma.sensitiveAccessLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: 'apple',
          approved: true
        })
      })
    );
  });

  it('applies whitelisted sensitive access log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listSensitiveAccessLogs({
      page: 1,
      pageSize: 20,
      sortBy: 'fieldName',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(prisma.sensitiveAccessLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ fieldName: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.sensitiveAccessLog.count).toHaveBeenCalled();
  });

  it('applies whitelisted operation audit log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listOperationLogs({
      page: 1,
      pageSize: 20,
      sortBy: 'module',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ module: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.auditLog.count).toHaveBeenCalled();
  });

  it('applies whitelisted login log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listLoginLogs({
      page: 1,
      pageSize: 20,
      status: 'failed',
      abnormal: 'true',
      sortBy: 'username',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.username).toBe('admin');
    expect(prisma.loginLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'failed',
          abnormal: true
        }),
        orderBy: [{ username: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.loginLog.count).toHaveBeenCalled();
  });

  it('applies whitelisted export log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listExportLogs({
      page: 1,
      pageSize: 20,
      module: 'apple',
      status: 'failed',
      containsSensitive: 'true',
      sortBy: 'module',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.module).toBe('apple');
    expect(prisma.dataExportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: 'apple',
          status: 'failed',
          containsSensitive: true
        }),
        orderBy: [{ module: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.dataExportJob.count).toHaveBeenCalled();
  });

  it('applies whitelisted permission change log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listPermissionChangeLogs({
      page: 1,
      pageSize: 20,
      keyword: 'role',
      sortBy: 'action',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ action: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.auditLog.count).toHaveBeenCalled();
  });

  it('applies whitelisted automation task log sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listAutomationTaskLogs({
      page: 1,
      pageSize: 20,
      level: 'error',
      sortBy: 'level',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.level).toBe('error');
    expect(prisma.automationTaskLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          level: 'error'
        }),
        orderBy: [{ level: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.automationTaskLog.count).toHaveBeenCalled();
  });
});
