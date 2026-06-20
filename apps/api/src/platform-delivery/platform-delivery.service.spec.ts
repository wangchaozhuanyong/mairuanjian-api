import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManualDeliveryAdapter } from './adapters/manual-delivery.adapter';
import {
  TaobaoDeliveryAdapter,
  XianyuDeliveryAdapter
} from './adapters/unsupported-platform-delivery.adapter';
import { PlatformDeliveryService } from './platform-delivery.service';

describe('PlatformDeliveryService', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const user = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };

  function createService() {
    const cronLog = {
      id: '33333333-3333-4333-8333-333333333333',
      jobName: 'platform.taobao.poll',
      status: 'running',
      startedAt: new Date('2026-06-18T00:00:00.000Z'),
      finishedAt: null,
      errorMessage: null,
      metadata: {},
      createdAt: new Date('2026-06-18T00:00:00.000Z')
    };
    const updatedCronLog = {
      ...cronLog,
      status: 'failed',
      finishedAt: new Date('2026-06-18T00:01:00.000Z'),
      errorMessage: 'orders: placeholder'
    };
    const prisma = {
      codePlatformOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: orderId
        }),
        findFirst: jest.fn()
      },
      cronJobLog: {
        create: jest.fn().mockResolvedValue(cronLog),
        update: jest.fn().mockResolvedValue(updatedCronLog)
      },
      platformSyncLog: {
        create: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;
    const manualAdapter = {
      platform: 'manual',
      syncOrders: jest.fn(),
      deliver: jest.fn().mockResolvedValue({
        platform: 'manual',
        supported: true,
        status: 'success',
        message: 'Manual delivery confirmed'
      }),
      syncRefunds: jest.fn()
    } as unknown as ManualDeliveryAdapter;
    const taobaoAdapter = {
      platform: 'taobao',
      syncOrders: jest.fn().mockResolvedValue({
        platform: 'taobao',
        supported: false,
        syncedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        message: 'placeholder'
      }),
      deliver: jest.fn().mockResolvedValue({
        platform: 'taobao',
        supported: false,
        status: 'manual_required',
        message: '淘宝自动发货接口尚未接入，订单已转入人工处理'
      }),
      syncRefunds: jest.fn()
    } as unknown as TaobaoDeliveryAdapter;
    const xianyuAdapter = {
      platform: 'xianyu',
      syncOrders: jest.fn(),
      deliver: jest.fn().mockResolvedValue({
        platform: 'xianyu',
        supported: false,
        status: 'manual_required',
        message: '闲鱼自动发货接口尚未接入，订单已转入人工处理'
      }),
      syncRefunds: jest.fn()
    } as unknown as XianyuDeliveryAdapter;
    const notificationsService = {
      triggerEvent: jest.fn().mockResolvedValue({})
    } as unknown as NotificationsService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    return {
      service: new PlatformDeliveryService(
        prisma,
        notificationsService,
        auditLogsService,
        manualAdapter,
        taobaoAdapter,
        xianyuAdapter
      ),
      prisma,
      notificationsService,
      auditLogsService,
      manualAdapter,
      taobaoAdapter,
      xianyuAdapter
    };
  }

  it('delegates manual delivery to ManualDeliveryAdapter', async () => {
    const { service, manualAdapter } = createService();

    const result = await service.deliver('manual', orderId, {
      deliveryContent: 'CODE-1',
      deliveryMethod: 'manual'
    });

    expect(result.status).toBe('success');
    expect(manualAdapter.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId,
        deliveryContent: 'CODE-1',
        deliveryMethod: 'manual'
      })
    );
  });

  it('routes unsupported Taobao delivery to manual-required adapter result', async () => {
    const { service, taobaoAdapter } = createService();

    const result = await service.deliver('taobao', orderId, {});

    expect(result.status).toBe('manual_required');
    expect(result.supported).toBe(false);
    expect(taobaoAdapter.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId
      })
    );
  });

  it('records platform sync log for unsupported Taobao order sync', async () => {
    const { service, prisma, notificationsService } = createService();

    const result = await service.syncOrders('taobao');

    expect(result.supported).toBe(false);
    expect(prisma.platformSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'taobao',
          syncType: 'sync_orders',
          status: 'failed',
          requestCount: 1,
          errorMessage: 'placeholder'
        })
      })
    );
    expect(notificationsService.triggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'platform.taobao.sync_failed',
        module: 'platform'
      })
    );
  });

  it('executes platform polling with cron log, platform log and audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.pollPlatform(
      'taobao',
      {
        includeOrders: true,
        includeRefunds: false,
        trigger: 'cron'
      },
      user
    );

    expect(result.status).toBe('failed');
    expect(result.results).toHaveLength(1);
    expect(prisma.cronJobLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobName: 'platform.taobao.poll',
          status: 'running'
        })
      })
    );
    expect(prisma.cronJobLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '33333333-3333-4333-8333-333333333333' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'orders: placeholder'
        })
      })
    );
    expect(prisma.platformSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: 'taobao',
          syncType: 'sync_orders'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        module: 'platform',
        action: 'platform.poll.execute',
        objectType: 'cron_job_log'
      })
    );
  });
});
