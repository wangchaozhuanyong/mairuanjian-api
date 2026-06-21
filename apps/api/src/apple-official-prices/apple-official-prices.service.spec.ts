import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleServicesService } from '../apple-services/apple-services.service';
import { AppleOfficialPricesService } from './apple-official-prices.service';

describe('AppleOfficialPricesService', () => {
  const now = new Date('2026-06-21T12:00:00.000Z');
  const sourceId = '11111111-1111-4111-8111-111111111111';
  const serviceId = '22222222-2222-4222-8222-222222222222';
  const taskId = '33333333-3333-4333-8333-333333333333';
  const cronLogId = '44444444-4444-4444-8444-444444444444';
  const snapshotId = '55555555-5555-4555-8555-555555555555';
  const reviewId = '66666666-6666-4666-8666-666666666666';
  const userId = '77777777-7777-4777-8777-777777777777';

  const operator = {
    id: userId,
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };

  const source = {
    id: sourceId,
    name: 'Apple 官方美国价格',
    region: 'US',
    currency: 'USD',
    sourceUrl: 'https://www.apple.com/',
    collectMethod: 'manual',
    checkIntervalHours: 24,
    status: 'enabled',
    lastCheckedAt: null,
    remark: null,
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: {
      id: userId,
      username: 'admin',
      displayName: '管理员'
    },
    updatedBy: {
      id: userId,
      username: 'admin',
      displayName: '管理员'
    }
  };

  const appleService = {
    id: serviceId,
    name: 'ChatGPT Plus 月费',
    category: 'AI 会员',
    defaultPrice: new Prisma.Decimal('88'),
    officialCostValue: new Prisma.Decimal('20'),
    currency: 'USD',
    defaultPeriodType: 'month',
    defaultPeriodValue: 1,
    expireCalcType: 'by_month',
    requireAppleId: true,
    requireServiceAccount: false,
    autoMatchAppleId: true,
    lockRule: 'by_service',
    allowedRegions: ['US'],
    minBalanceRequired: new Prisma.Decimal('0'),
    status: 'enabled',
    remark: null,
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService(
    options: {
      source?: Partial<typeof source>;
      appleService?: Partial<typeof appleService>;
    } = {}
  ) {
    const currentSource = { ...source, ...options.source };
    const currentAppleService = { ...appleService, ...options.appleService };
    const task = {
      id: taskId,
      taskType: 'official_price_check',
      status: 'running',
      queueJobId: 'apple-official_price_check-1',
      createdAt: now,
      updatedAt: now
    };
    const cronLog = {
      id: cronLogId,
      jobName: `apple.official_price.${sourceId}.check`,
      status: 'running',
      startedAt: now
    };
    const snapshot = {
      id: snapshotId,
      sourceId,
      source: {
        id: sourceId,
        name: currentSource.name,
        region: currentSource.region,
        currency: currentSource.currency
      },
      appleServiceId: serviceId,
      appleService: {
        id: serviceId,
        name: currentAppleService.name,
        category: currentAppleService.category,
        currency: currentAppleService.currency
      },
      serviceName: currentAppleService.name,
      category: currentAppleService.category,
      region: 'US',
      currency: 'USD',
      officialPrice: new Prisma.Decimal('22'),
      periodType: 'month',
      periodValue: 1,
      rawPayload: null,
      collectedAt: now
    };
    const pendingReview = {
      id: reviewId,
      sourceId,
      source: {
        id: sourceId,
        name: currentSource.name,
        region: currentSource.region,
        currency: currentSource.currency
      },
      snapshotId,
      snapshot,
      appleServiceId: serviceId,
      appleService: {
        id: serviceId,
        name: currentAppleService.name,
        category: currentAppleService.category,
        currency: currentAppleService.currency,
        officialCostValue: currentAppleService.officialCostValue,
        defaultPeriodType: currentAppleService.defaultPeriodType,
        defaultPeriodValue: currentAppleService.defaultPeriodValue,
        remark: currentAppleService.remark,
        status: currentAppleService.status
      },
      changeType: 'price_changed',
      oldValue: {
        serviceId,
        serviceName: currentAppleService.name,
        officialPrice: '20',
        currency: 'USD',
        periodType: 'month',
        periodValue: 1
      },
      newValue: {
        appleServiceId: serviceId,
        serviceName: currentAppleService.name,
        category: currentAppleService.category,
        region: 'US',
        currency: 'USD',
        officialPrice: '22',
        periodType: 'month',
        periodValue: 1
      },
      status: 'pending',
      reviewedByUserId: null,
      reviewedBy: null,
      reviewedAt: null,
      remark: null,
      createdAt: now,
      updatedAt: now
    };
    const approvedReview = {
      ...pendingReview,
      status: 'approved',
      reviewedByUserId: userId,
      reviewedBy: {
        id: userId,
        username: 'admin',
        displayName: '管理员'
      },
      reviewedAt: now,
      remark: '已确认同步到 Apple ID 业务设置'
    };

    const tx = {
      appleService: {
        findFirst: jest.fn().mockResolvedValue(currentAppleService),
        findMany: jest.fn().mockResolvedValue([currentAppleService])
      },
      appleOfficialPriceSnapshot: {
        create: jest.fn().mockResolvedValue(snapshot)
      },
      applePriceChangeReview: {
        create: jest.fn().mockResolvedValue(pendingReview)
      },
      appleOfficialPriceSource: {
        update: jest.fn().mockResolvedValue({ ...currentSource, lastCheckedAt: now })
      },
      automationTask: {
        update: jest.fn().mockResolvedValue(task)
      },
      automationTaskLog: {
        create: jest.fn().mockResolvedValue({})
      },
      cronJobLog: {
        update: jest.fn().mockResolvedValue(cronLog)
      }
    };

    const prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (typeof input === 'function') {
          return input(tx);
        }

        return Promise.all(input as Promise<unknown>[]);
      }),
      appleOfficialPriceSource: {
        findFirst: jest.fn().mockResolvedValue(currentSource),
        create: jest.fn().mockResolvedValue(currentSource),
        update: jest.fn().mockResolvedValue({ ...currentSource, lastCheckedAt: now })
      },
      automationTask: {
        create: jest.fn().mockResolvedValue(task),
        update: jest.fn().mockResolvedValue(task)
      },
      automationTaskLog: {
        create: jest.fn().mockResolvedValue({})
      },
      cronJobLog: {
        create: jest.fn().mockResolvedValue(cronLog),
        update: jest.fn().mockResolvedValue(cronLog)
      },
      applePriceChangeReview: {
        findUnique: jest.fn().mockResolvedValue(pendingReview),
        update: jest.fn().mockResolvedValue(approvedReview),
        count: jest.fn().mockResolvedValue(1)
      }
    } as unknown as PrismaService;

    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    const appleServicesService = {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({})
    } as unknown as AppleServicesService;

    const realtimeService = {
      publish: jest.fn()
    } as unknown as RealtimeService;

    return {
      service: new AppleOfficialPricesService(
        prisma,
        auditLogsService,
        appleServicesService,
        realtimeService
      ),
      prisma,
      tx,
      auditLogsService,
      appleServicesService,
      realtimeService,
      pendingReview
    };
  }

  function mockFetchResponse(body: string, contentType: string) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn().mockReturnValue(contentType)
      },
      text: jest.fn().mockResolvedValue(body)
    } as unknown as Response);
  }

  it('marks source checks without collected items as manual verification', async () => {
    const { service, prisma, realtimeService } = createService();

    const result = await service.checkSource(sourceId, {}, operator);

    expect(result.status).toBe('manual_required');
    expect(result.reviewCount).toBe(0);
    expect(prisma.automationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: taskId },
        data: expect.objectContaining({
          status: 'waiting_manual_verify',
          manualRequired: true,
          errorCode: 'official_price_collector_not_configured'
        })
      })
    );
    expect(prisma.cronJobLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: cronLogId },
        data: expect.objectContaining({ status: 'skipped' })
      })
    );
    expect(realtimeService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'apple.official_price.check_manual_required',
        entity: 'official_price_check',
        action: 'manual_required'
      })
    );
  });

  it('collects API source items from sourceUrl when manual items are omitted', async () => {
    const { service, tx } = createService({
      source: {
        collectMethod: 'api',
        sourceUrl: 'https://example.test/apple-prices.json'
      }
    });
    const fetchMock = mockFetchResponse(
      JSON.stringify({
        items: [
          {
            serviceName: appleService.name,
            category: appleService.category,
            officialPrice: '22',
            currency: 'USD',
            periodType: 'month',
            periodValue: 1
          }
        ]
      }),
      'application/json'
    );

    const result = await service.checkSource(sourceId, {}, operator);

    expect(result.status).toBe('checked');
    expect(result.reviewCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/apple-prices.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: expect.stringContaining('application/json')
        })
      })
    );
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceName: appleService.name,
          officialPrice: '22'
        })
      })
    );
  });

  it('collects webpage structured price data from sourceUrl when manual items are omitted', async () => {
    const { service, tx } = createService({
      source: {
        collectMethod: 'webpage',
        sourceUrl: 'https://example.test/apple-price-page'
      }
    });
    mockFetchResponse(
      `<html>
        <head>
          <title>${appleService.name}</title>
          <script type="application/ld+json">
            {"@type":"Product","name":"${appleService.name}","offers":{"price":"22","priceCurrency":"USD"}}
          </script>
        </head>
      </html>`,
      'text/html'
    );

    const result = await service.checkSource(sourceId, {}, operator);

    expect(result.status).toBe('checked');
    expect(result.reviewCount).toBe(1);
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceName: appleService.name,
          officialPrice: '22'
        })
      })
    );
  });

  it('creates pending reviews when collected official price changes', async () => {
    const { service, tx, auditLogsService, appleServicesService } = createService();

    const result = await service.checkSource(
      sourceId,
      {
        items: [
          {
            appleServiceId: serviceId,
            serviceName: appleService.name,
            category: appleService.category,
            region: 'US',
            currency: 'USD',
            officialPrice: '22',
            periodType: 'month',
            periodValue: 1
          }
        ]
      },
      operator
    );

    expect(result.status).toBe('checked');
    expect(result.reviewCount).toBe(1);
    expect(tx.applePriceChangeReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appleServiceId: serviceId,
          changeType: 'price_changed',
          status: 'pending'
        })
      })
    );
    expect(appleServicesService.update).not.toHaveBeenCalled();
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'apple_official_price.check',
        objectType: 'apple_official_price_source',
        objectId: sourceId
      })
    );
  });

  it('only updates Apple service official cost after a pending review is approved', async () => {
    const { service, prisma, appleServicesService, realtimeService } = createService();

    const result = await service.approveReview(reviewId, operator);

    expect(result.status).toBe('approved');
    expect(appleServicesService.update).toHaveBeenCalledWith(
      serviceId,
      expect.objectContaining({
        officialCostValue: '22',
        currency: 'USD',
        defaultPeriodType: 'month',
        defaultPeriodValue: 1
      }),
      operator
    );
    expect(prisma.applePriceChangeReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: reviewId },
        data: expect.objectContaining({
          status: 'approved',
          reviewedByUserId: userId,
          appleServiceId: serviceId
        })
      })
    );
    expect(realtimeService.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'apple.official_price.review_approved',
        entity: 'price_change_review',
        action: 'approved'
      })
    );
  });
});
