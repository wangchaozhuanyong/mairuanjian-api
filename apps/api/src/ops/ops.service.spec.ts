import { Prisma as PrismaNamespace } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OpsService } from './ops.service';

describe('OpsService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const user = {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };

  function createService() {
    const healthSnapshot = {
      id: '11111111-1111-4111-8111-111111111111',
      apiStatus: 'normal',
      dbStatus: 'normal',
      redisStatus: 'normal',
      storageStatus: 'normal',
      queueStatus: 'warning',
      workerStatus: 'normal',
      diskUsage: null,
      metrics: {},
      checkedAt: now
    };
    const queueLog = {
      id: '22222222-2222-4222-8222-222222222222',
      queueName: 'apple_automation',
      waitingCount: 100,
      activeCount: 0,
      failedCount: 0,
      delayedCount: 0,
      status: 'warning',
      checkedAt: now
    };
    const platformLog = {
      id: '44444444-4444-4444-8444-444444444444',
      platform: 'telegram',
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
    const platformSuccessLog = {
      id: '44444444-4444-4444-8444-555555555555',
      platform: 'telegram',
      syncType: 'send_message',
      status: 'success',
      requestCount: 4,
      errorRate: new PrismaNamespace.Decimal(0),
      errorMessage: null,
      startedAt: now,
      finishedAt: now,
      metadata: {},
      createdAt: now
    };
    const platformRetryLog = {
      id: '44444444-4444-4444-8444-666666666666',
      platform: 'telegram',
      syncType: 'delivery_retry',
      status: 'failed',
      requestCount: 2,
      errorRate: new PrismaNamespace.Decimal(1),
      errorMessage: 'retry failed',
      startedAt: now,
      finishedAt: now,
      metadata: { retryCount: 1 },
      createdAt: now
    };
    const systemParameters = new Map<string, Record<string, unknown>>();
    systemParameters.set('platform_auth_telegram', {
      id: '77777777-7777-4777-8777-777777777777',
      key: 'platform_auth_telegram',
      value: {
        authMode: 'oauth',
        appKeyEncrypted: 'encrypted:telegram-client-id',
        appSecretEncrypted: 'encrypted:telegram-client-secret',
        accessTokenEncrypted: 'encrypted:access-token-123456'
      },
      group: 'platform_auth',
      remark: 'Telegram 授权配置',
      updatedByUserId: user.id,
      createdAt: now,
      updatedAt: now
    });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        throw new Error('Unexpected transaction input');
      }),
      automationTask: {
        count: jest
          .fn()
          .mockResolvedValueOnce(100)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0)
      },
      systemHealthSnapshot: {
        create: jest.fn().mockResolvedValue(healthSnapshot)
      },
      queueStatusLog: {
        create: jest.fn().mockResolvedValue(queueLog)
      },
      platformSyncLog: {
        findFirst: jest.fn().mockResolvedValue(platformLog),
        findMany: jest.fn().mockResolvedValue([platformLog, platformSuccessLog, platformRetryLog]),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { requestCount: 3 },
          _avg: { errorRate: new PrismaNamespace.Decimal('0.33') }
        }),
        create: jest.fn().mockResolvedValue(platformLog)
      },
      telegramConfig: {
        count: jest.fn().mockResolvedValue(0)
      },
      notificationRule: {
        findUnique: jest.fn().mockResolvedValue({ lastTriggeredAt: null })
      },
      systemParameter: {
        findUnique: jest.fn(async (args: { where?: { key?: string } }) => {
          return args.where?.key ? (systemParameters.get(args.where.key) ?? null) : null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({
          id: '77777777-7777-4777-8777-777777777777',
          key: 'platform_oauth_state_telegram_hash-state-123',
          value: {},
          group: 'platform_oauth_state',
          remark: 'Telegram OAuth state',
          updatedByUserId: null,
          createdAt: now,
          updatedAt: now
        }),
        upsert: jest.fn(
          async (args: {
            where: { key: string };
            update: Record<string, unknown>;
            create: Record<string, unknown>;
          }) => {
            const existing = systemParameters.get(args.where.key);
            const parameter = {
              id:
                typeof existing?.id === 'string'
                  ? existing.id
                  : '77777777-7777-4777-8777-777777777777',
              ...(existing ?? {}),
              ...(existing ? args.update : args.create),
              key: args.where.key,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now
            };
            systemParameters.set(args.where.key, parameter);
            return parameter;
          }
        )
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const notificationsService = {
      triggerEvent: jest.fn().mockResolvedValue({})
    } as unknown as NotificationsService;
    const fieldEncryptionService = {
      encrypt: jest.fn((value: string | null | undefined) => (value ? `encrypted:${value}` : null)),
      decrypt: jest.fn((value: string | null | undefined) =>
        value ? value.replace(/^encrypted:/, '') : null
      ),
      hash: jest.fn((value: string | null | undefined) => (value ? `hash-${value}` : null))
    } as unknown as FieldEncryptionService;

    return {
      service: new OpsService(
        prisma,
        auditLogsService,
        notificationsService,
        fieldEncryptionService
      ),
      prisma,
      auditLogsService,
      notificationsService,
      fieldEncryptionService
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports API process as normal', () => {
    const { service } = createService();

    const status = service.apiStatus();

    expect(status.status).toBe('normal');
    expect(status.metrics?.pid).toBe(process.pid);
  });

  it('captures health snapshot and triggers queue backlog notification', async () => {
    const { service, prisma, auditLogsService, notificationsService } = createService();

    jest.spyOn(service, 'databaseStatus').mockResolvedValue({
      name: 'PostgreSQL',
      status: 'normal',
      latencyMs: 1,
      message: 'ok',
      checkedAt: now.toISOString()
    });
    jest.spyOn(service, 'redisStatus').mockResolvedValue({
      name: 'Redis',
      status: 'normal',
      latencyMs: 1,
      message: 'ok',
      checkedAt: now.toISOString()
    });
    jest.spyOn(service, 'fileStorageStatus').mockResolvedValue({
      name: '文件存储',
      status: 'normal',
      latencyMs: 1,
      message: 'ok',
      checkedAt: now.toISOString()
    });
    jest.spyOn(service, 'diskSpace').mockResolvedValue({
      name: '磁盘空间',
      status: 'normal',
      latencyMs: 1,
      message: 'ok',
      checkedAt: now.toISOString(),
      metrics: { usagePercent: 20 }
    });
    jest.spyOn(service, 'automationWorkers').mockResolvedValue({
      name: '自动化 Worker',
      status: 'normal',
      latencyMs: null,
      message: 'ok',
      checkedAt: now.toISOString()
    });

    const result = await service.captureHealthSnapshot(user);

    expect(result.snapshot.queueStatus).toBe('warning');
    expect(prisma.systemHealthSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueStatus: 'warning',
          diskUsage: expect.anything()
        })
      })
    );
    expect(prisma.queueStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueName: 'apple_automation',
          waitingCount: 100,
          status: 'warning'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'ops',
        action: 'ops.health_snapshot.create'
      })
    );
    expect(notificationsService.triggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'ops.queue.backlog',
        module: 'ops'
      })
    );
  });

  it('builds platform interface status from latest logs and authorization config', async () => {
    const { service, prisma } = createService();
    jest.spyOn(prisma.telegramConfig, 'count').mockResolvedValue(1);

    const result = await service.platformStatus('telegram');

    expect(result.platform).toBe('telegram');
    expect(result.authorizationStatus).toBe('configured');
    expect(result.requestCount).toBe(7);
    expect(result.failedRequestCount).toBe(3);
    expect(result.failureLogCount).toBe(2);
    expect(result.retryLogCount).toBe(1);
    expect(result.lastFailureAt).toEqual(now);
    expect(result.lastRetryAt).toEqual(now);
    expect(result.errorRate).toBe('0.4286');
    expect(prisma.platformSyncLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: { in: ['telegram'] }
        })
      })
    );
    expect(prisma.platformSyncLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          platform: { in: ['telegram'] },
          createdAt: expect.objectContaining({ gte: expect.any(Date) })
        })
      })
    );
  });

  it('records reauthorization placeholder request and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.reauthorizePlatform(
      'telegram',
      {
        reason: 'unit test'
      },
      user
    );

    expect(result.status).toBe('manual_required');
    expect(prisma.platformSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'telegram',
          syncType: 'reauthorize',
          status: 'failed'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'ops',
        action: 'ops.platform.reauthorize'
      })
    );
  });

  it('saves platform authorization with encrypted secrets and redacted audit data', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();

    const result = await service.savePlatformAuthorization(
      'telegram',
      {
        authMode: 'manual_token',
        appKey: 'telegram-app-key',
        appSecret: 'telegram-client-secret',
        accessToken: 'access-token-123456',
        refreshToken: 'refresh-token-654321',
        tokenExpiresAt: '2026-07-01T00:00:00.000Z',
        shopName: '通知服务账号',
        scopes: ['message.send']
      },
      user
    );

    expect(result.configured).toBe(true);
    expect(result.appKeyTail).toBe('-key');
    expect(result.accessTokenTail).toBe('3456');
    expect(result.refreshTokenTail).toBe('4321');
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith('telegram-client-secret');
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'platform_auth_telegram',
          group: 'platform_auth',
          value: expect.objectContaining({
            appSecretEncrypted: 'encrypted:telegram-client-secret',
            accessTokenEncrypted: 'encrypted:access-token-123456',
            refreshTokenEncrypted: 'encrypted:refresh-token-654321'
          })
        })
      })
    );
    const auditPayload = JSON.stringify((auditLogsService.create as jest.Mock).mock.calls);
    expect(auditPayload).not.toContain('telegram-client-secret');
    expect(auditPayload).not.toContain('access-token-123456');
    expect(auditPayload).not.toContain('refresh-token-654321');
  });

  it('saves Apple web gateway subscription encrypted and returns only masked URL', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();
    const subscriptionUrl = 'https://app.example.com/?sid=197974&token=secret-token';

    const result = await service.saveAppleWebGatewaySubscription({ subscriptionUrl }, user);

    expect(result.configured).toBe(true);
    expect(result.subscriptionHost).toBe('app.example.com');
    expect(result.subscriptionUrlMasked).toBe('https://app.example.com/?sid=***&token=***');
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith(subscriptionUrl);
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'apple_web_gateway_subscription',
          group: 'apple_web_gateway',
          value: expect.objectContaining({
            subscriptionUrlEncrypted: `encrypted:${subscriptionUrl}`,
            subscriptionUrlMasked: 'https://app.example.com/?sid=***&token=***'
          })
        })
      })
    );
    const auditPayload = JSON.stringify((auditLogsService.create as jest.Mock).mock.calls);
    expect(auditPayload).not.toContain('secret-token');
    expect(auditPayload).not.toContain(subscriptionUrl);
  });

  it('syncs Apple web gateway nodes from subscription without exposing raw node secrets', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();
    const subscriptionUrl = 'https://app.example.com/?sid=197974&token=secret-token';
    const subscriptionBody = Buffer.from(
      [
        'trojan://password@us.example.com:443#US%20Los%20Angeles',
        'vless://uuid@my.example.com:443#MY%20Kuala%20Lumpur'
      ].join('\n')
    ).toString('base64');
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(subscriptionBody)
    } as unknown as Response);

    await service.saveAppleWebGatewaySubscription({ subscriptionUrl }, user);
    const result = await service.syncAppleWebGateways(user);

    expect(fetchMock).toHaveBeenCalledWith(
      subscriptionUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': 'AppleBusinessGatewaySync/1.0'
        })
      })
    );
    expect(result.nodeCount).toBe(2);
    expect(result.countrySummary.map((item) => item.countryCode)).toEqual(['MY', 'US']);
    expect(result.nodes.every((node) => node.status === 'available')).toBe(true);
    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith(
      'trojan://password@us.example.com:443#US%20Los%20Angeles'
    );
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'apple_web_gateway_nodes',
          value: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                countryCode: 'US',
                rawEncrypted: 'encrypted:trojan://password@us.example.com:443#US%20Los%20Angeles'
              })
            ])
          })
        })
      })
    );
    const apiPayload = JSON.stringify(result);
    const auditPayload = JSON.stringify((auditLogsService.create as jest.Mock).mock.calls);
    expect(apiPayload).not.toContain('password@us.example.com');
    expect(apiPayload).not.toContain('secret-token');
    expect(auditPayload).not.toContain('password@us.example.com');
    expect(auditPayload).not.toContain('secret-token');
    fetchMock.mockRestore();
  });

  it('starts platform OAuth with encrypted app key and stores state', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    jest.spyOn(prisma.systemParameter, 'findUnique').mockResolvedValueOnce({
      id: '88888888-8888-4888-8888-888888888888',
      key: 'platform_auth_telegram',
      value: {
        authMode: 'oauth',
        appKeyEncrypted: 'encrypted:telegram-client-id',
        authorizationUrl: 'https://auth.example.com/oauth',
        redirectUri: 'https://admin.example.com/api/ops/platforms/telegram/oauth/callback',
        scopes: ['message.send'],
        clientIdParam: 'client_id'
      },
      group: 'platform_auth',
      remark: 'Telegram 授权配置',
      updatedByUserId: user.id,
      createdAt: now,
      updatedAt: now
    });

    const result = await service.startPlatformOAuth('telegram', {}, user);
    const authorizationUrl = new URL(result.authorizationUrl);

    expect(result.platform).toBe('telegram');
    expect(result.redirectUri).toBe(
      'https://admin.example.com/api/ops/platforms/telegram/oauth/callback'
    );
    expect(authorizationUrl.origin).toBe('https://auth.example.com');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('telegram-client-id');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(result.redirectUri);
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('scope')).toBe('message.send');
    expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
    expect(fieldEncryptionService.decrypt).toHaveBeenCalledWith('encrypted:telegram-client-id');
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          group: 'platform_oauth_state',
          value: expect.objectContaining({
            platform: 'telegram',
            status: 'pending',
            expiresAt: '2026-06-18T00:10:00.000Z'
          })
        })
      })
    );
    expect(prisma.platformSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'telegram',
          syncType: 'oauth_start',
          status: 'success'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'ops',
        action: 'ops.platform.oauth.start'
      })
    );
  });

  it('handles platform OAuth callback with valid state and encrypted authorization code', async () => {
    const { service, prisma, auditLogsService, fieldEncryptionService } = createService();
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    jest.spyOn(prisma.systemParameter, 'findUnique').mockResolvedValueOnce({
      id: '99999999-9999-4999-8999-999999999999',
      key: 'platform_oauth_state_telegram_hash-state-123',
      value: {
        platform: 'telegram',
        stateHash: 'hash-state-123',
        redirectUri: 'https://admin.example.com/api/ops/platforms/telegram/oauth/callback',
        scopes: ['message.send'],
        status: 'pending',
        expiresAt: '2026-06-18T00:10:00.000Z'
      },
      group: 'platform_oauth_state',
      remark: 'Telegram OAuth state',
      updatedByUserId: user.id,
      createdAt: now,
      updatedAt: now
    });

    const result = await service.handlePlatformOAuthCallback('telegram', {
      state: 'state-123',
      code: 'auth-code-abc123'
    });

    expect(result.status).toBe('received');
    expect(result.stateValid).toBe(true);
    expect(result.codeReceived).toBe(true);
    expect(fieldEncryptionService.hash).toHaveBeenCalledWith('state-123');
    expect(prisma.systemParameter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '99999999-9999-4999-8999-999999999999' },
        data: expect.objectContaining({
          value: expect.objectContaining({
            status: 'received',
            authorizationCodeEncrypted: 'encrypted:auth-code-abc123',
            authorizationCodeTail: 'c123'
          })
        })
      })
    );
    expect(prisma.platformSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'telegram',
          syncType: 'oauth_callback',
          status: 'success'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'ops',
        action: 'ops.platform.oauth.callback'
      })
    );
  });

  it('triggers platform authorization invalid notification for required unconfigured platform', async () => {
    const { service, prisma, notificationsService } = createService();
    jest.spyOn(prisma.systemParameter, 'findUnique').mockResolvedValue(null);

    const result = await service.platformStatus('telegram');
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.authorizationStatus).toBe('not_configured');
    expect(notificationsService.triggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'platform.auth.invalid',
        module: 'platform'
      })
    );
  });

  it('triggers platform authorization expiring notification when token expires within 7 days', async () => {
    const { service, prisma, notificationsService } = createService();
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    jest.spyOn(prisma.platformSyncLog, 'findFirst').mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      platform: 'telegram',
      syncType: 'test',
      status: 'success',
      requestCount: 1,
      errorRate: new PrismaNamespace.Decimal(0),
      errorMessage: null,
      startedAt: now,
      finishedAt: now,
      metadata: {
        tokenExpiresAt: '2026-06-22T00:00:00.000Z'
      },
      createdAt: now
    });

    jest.spyOn(prisma.telegramConfig, 'count').mockResolvedValue(1);

    const result = await service.platformStatus('telegram');
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.authorizationStatus).toBe('expiring');
    expect(result.tokenExpiresAt).toBe('2026-06-22T00:00:00.000Z');
    expect(notificationsService.triggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'platform.auth.expiring',
        module: 'platform'
      })
    );
  });
});
