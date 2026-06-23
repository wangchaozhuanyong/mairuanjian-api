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
      systemParameter: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({})
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
