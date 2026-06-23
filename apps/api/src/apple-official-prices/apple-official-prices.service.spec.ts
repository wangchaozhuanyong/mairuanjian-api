import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AppleServicesService } from '../apple-services/apple-services.service';
import { AppleOfficialPricesService } from './apple-official-prices.service';
import {
  OFFICIAL_PRICE_PROVIDER_KEYS,
  OFFICIAL_PRICE_PROVIDER_PROFILES
} from './official-price-provider-catalog';

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
    provider: 'chatgpt',
    priceSourceType: 'official_web',
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
    officialBasePrice: new Prisma.Decimal('20'),
    officialCostValue: new Prisma.Decimal('20'),
    appleBalancePriceRuleType: 'inherit',
    appleBalancePriceRuleValue: null,
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
        provider: currentSource.provider,
        region: currentSource.region,
        currency: currentSource.currency
      },
      appleServiceId: serviceId,
      provider: currentSource.provider,
      planCode: null,
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
      appleBalancePrice: new Prisma.Decimal('22'),
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
        provider: currentSource.provider,
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
        officialBasePrice: currentAppleService.officialBasePrice,
        officialCostValue: currentAppleService.officialCostValue,
        appleBalancePriceRuleType: currentAppleService.appleBalancePriceRuleType,
        appleBalancePriceRuleValue: currentAppleService.appleBalancePriceRuleValue,
        defaultPeriodType: currentAppleService.defaultPeriodType,
        defaultPeriodValue: currentAppleService.defaultPeriodValue,
        remark: currentAppleService.remark,
        status: currentAppleService.status
      },
      changeType: 'price_changed',
      oldValue: {
        serviceId,
        serviceName: currentAppleService.name,
        officialBasePrice: '20',
        officialPrice: '20',
        appleBalancePrice: '20',
        currency: 'USD',
        periodType: 'month',
        periodValue: 1
      },
      newValue: {
        appleServiceId: serviceId,
        provider: currentSource.provider,
        serviceName: currentAppleService.name,
        category: currentAppleService.category,
        region: 'US',
        currency: 'USD',
        officialBasePrice: '22',
        officialPrice: '22',
        appleBalancePrice: '22',
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
    const categoryDictionary = {
      id: '88888888-8888-4888-8888-888888888888',
      group: 'apple.service.categories',
      code: 'chatgpt',
      label: currentAppleService.category,
      value: currentAppleService.category,
      sortOrder: 0,
      status: 'active',
      remark: null,
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: now,
      updatedAt: now
    };

    const tx = {
      dataDictionary: {
        findFirst: jest.fn().mockResolvedValue(categoryDictionary),
        create: jest.fn().mockResolvedValue(categoryDictionary),
        update: jest.fn().mockResolvedValue(categoryDictionary)
      },
      appleService: {
        findFirst: jest.fn().mockResolvedValue(currentAppleService),
        findMany: jest.fn().mockResolvedValue([currentAppleService])
      },
      appleOfficialPriceSnapshot: {
        create: jest.fn().mockResolvedValue(snapshot)
      },
      appleServiceRegionPrice: {
        upsert: jest.fn().mockResolvedValue({})
      },
      applePriceChangeReview: {
        create: jest.fn().mockResolvedValue(pendingReview)
      },
      appleOfficialPriceSource: {
        update: jest.fn().mockResolvedValue({ ...currentSource, lastCheckedAt: now })
      },
      systemParameter: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({})
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
        findMany: jest.fn().mockResolvedValue([currentSource]),
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
      },
      dataDictionary: {
        findFirst: jest.fn().mockResolvedValue(categoryDictionary),
        create: jest.fn().mockResolvedValue(categoryDictionary),
        update: jest.fn().mockResolvedValue(categoryDictionary)
      },
      systemParameter: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({})
      }
    } as unknown as PrismaService;

    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    const appleServicesService = {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      upsertRegionPriceFromOfficial: jest.fn().mockResolvedValue({}),
      getBalancePriceRule: jest.fn().mockResolvedValue({ ruleType: 'percent', ruleValue: '1' })
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

  function mockFetchBlockedResponse(status = 403) {
    return jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status,
      headers: {
        get: jest.fn().mockReturnValue('text/html')
      },
      text: jest.fn().mockResolvedValue('')
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
          accept: expect.stringContaining('application/json'),
          'user-agent': expect.stringContaining('Mozilla/5.0')
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

  it('runs the built-in ChatGPT provider collector without manual price items', async () => {
    const { service, tx } = createService({
      source: {
        name: 'ChatGPT 官方价格 US/USD',
        provider: 'chatgpt',
        collectMethod: 'webpage',
        sourceUrl: 'https://chatgpt.com/pricing'
      },
      appleService: {
        name: 'ChatGPT Plus 1个月'
      }
    });
    mockFetchResponse(
      '<html><body>ChatGPT Go $8 / month ChatGPT Plus $22 / month ChatGPT Pro $200 / month</body></html>',
      'text/html'
    );

    const result = await service.checkProvider('chatgpt', {}, operator);

    expect(result.provider).toBe('chatgpt');
    expect(result.snapshotCount).toBeGreaterThan(0);
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planCode: 'chatgpt_plus_monthly',
          serviceName: 'ChatGPT Plus 1个月',
          officialPrice: '22'
        })
      })
    );
  });

  it('falls back to the official provider catalog when the public page blocks server fetch', async () => {
    const { service, tx } = createService({
      source: {
        name: 'ChatGPT 官方价格 US/USD',
        provider: 'chatgpt',
        collectMethod: 'webpage',
        sourceUrl: 'https://chatgpt.com/pricing'
      },
      appleService: {
        name: 'ChatGPT Plus 1个月'
      }
    });
    mockFetchBlockedResponse();

    const result = await service.checkProvider('chatgpt', {}, operator);

    expect(result.provider).toBe('chatgpt');
    expect(result.failedCount).toBe(0);
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planCode: 'chatgpt_plus_monthly',
          serviceName: 'ChatGPT Plus 1个月',
          officialPrice: '20',
          rawPayload: expect.objectContaining({
            parser: 'provider_catalog_fallback'
          })
        })
      })
    );
  });

  it('uses localized provider catalog prices when the page is blocked', async () => {
    const { service, tx } = createService({
      source: {
        name: 'Gemini 官方价格 MY/MYR',
        provider: 'gemini',
        region: 'MY',
        currency: 'MYR',
        collectMethod: 'webpage',
        sourceUrl: 'https://one.google.com/intl/en_my/about/google-ai-plans/'
      },
      appleService: {
        name: 'Google AI Pro 1个月',
        currency: 'MYR'
      }
    });
    mockFetchBlockedResponse();

    const result = await service.checkProvider(
      'gemini',
      { regions: [{ region: 'MY', currency: 'MYR' }] },
      operator
    );

    expect(result.provider).toBe('gemini');
    expect(result.failedCount).toBe(0);
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planCode: 'google_ai_pro_monthly',
          region: 'MY',
          currency: 'MYR',
          officialPrice: '97.99',
          rawPayload: expect.objectContaining({
            parser: 'provider_catalog_fallback',
            requestedCurrency: 'MYR',
            catalogCurrency: 'MYR'
          })
        })
      })
    );
  });

  it('requires manual verification when the requested catalog currency is missing', async () => {
    const { service, prisma, tx } = createService({
      source: {
        name: 'ChatGPT 官方价格 SG/SGD',
        provider: 'chatgpt',
        region: 'SG',
        currency: 'SGD',
        collectMethod: 'webpage',
        sourceUrl: 'https://chatgpt.com/pricing'
      },
      appleService: {
        name: 'ChatGPT Plus 1个月',
        currency: 'USD'
      }
    });
    mockFetchBlockedResponse();

    const result = await service.checkProvider(
      'chatgpt',
      { regions: [{ region: 'SG', currency: 'SGD' }] },
      operator
    );

    expect(result.provider).toBe('chatgpt');
    expect(result.failedCount).toBe(0);
    expect(result.snapshotCount).toBe(0);
    expect(result.results[0]?.status).toBe('manual_required');
    expect(tx.appleOfficialPriceSnapshot.create).not.toHaveBeenCalled();
    expect(prisma.automationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'waiting_manual_verify',
          manualRequired: true
        })
      })
    );
  });

  it('creates and checks explicit provider regions instead of only the default region', async () => {
    const { service, prisma } = createService({
      source: {
        name: 'Gemini 官方价格 MY/MYR',
        provider: 'gemini',
        region: 'MY',
        currency: 'MYR',
        collectMethod: 'webpage',
        sourceUrl: 'https://one.google.com/intl/en_my/about/google-ai-plans/'
      }
    });
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('blocked'));

    const result = await service.checkProvider(
      'gemini',
      {
        regions: [
          { region: 'MY', currency: 'MYR' },
          { region: 'MY', currency: 'MYR' },
          { region: 'SG', currency: 'SGD' }
        ]
      },
      operator
    );

    expect(result.sourceCount).toBe(2);
    expect(prisma.appleOfficialPriceSource.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'gemini',
          region: 'MY',
          currency: 'MYR'
        })
      })
    );
    expect(prisma.appleOfficialPriceSource.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'gemini',
          region: 'SG',
          currency: 'SGD'
        })
      })
    );
  });

  it('bootstraps default provider sources for the background polling worker', async () => {
    const { service, prisma } = createService();
    const sourceModel = prisma.appleOfficialPriceSource as unknown as {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    sourceModel.findFirst.mockResolvedValue(null);
    sourceModel.findMany.mockResolvedValue([]);

    const result = await service.runDueSourceChecks('worker', { bootstrapProviders: true });
    const expectedSourceCount = OFFICIAL_PRICE_PROVIDER_KEYS.reduce(
      (sum, provider) => sum + OFFICIAL_PRICE_PROVIDER_PROFILES[provider].defaultRegions.length,
      0
    );

    expect(result.bootstrappedSourceCount).toBe(expectedSourceCount);
    expect(result.scannedCount).toBe(0);
    expect(sourceModel.create).toHaveBeenCalledTimes(expectedSourceCount);
    expect(sourceModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'chatgpt',
          priceSourceType: 'official_web',
          region: 'US',
          currency: 'USD',
          collectMethod: 'webpage',
          status: 'enabled'
        })
      })
    );
  });

  it('returns the provider catalog used by the automated collection UI', () => {
    const { service } = createService();

    const catalog = service.listProviderCatalog();

    expect(catalog.providers.map((provider) => provider.value)).toEqual([
      'chatgpt',
      'gemini',
      'claude'
    ]);
    expect(catalog.providers.find((provider) => provider.value === 'chatgpt')?.sourceUrl).toBe(
      'https://chatgpt.com/pricing'
    );
    expect(catalog.regions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '美国 USD',
          region: 'US',
          currency: 'USD',
          value: 'US:USD'
        }),
        expect.objectContaining({
          label: '马来西亚 MYR',
          region: 'MY',
          currency: 'MYR',
          value: 'MY:MYR'
        }),
        expect.objectContaining({
          label: '德国 EUR',
          region: 'DE',
          currency: 'EUR',
          value: 'DE:EUR'
        }),
        expect.objectContaining({
          label: '法国 EUR',
          region: 'FR',
          currency: 'EUR',
          value: 'FR:EUR'
        }),
        expect.objectContaining({
          label: '尼日利亚 NGN',
          region: 'NG',
          currency: 'NGN',
          value: 'NG:NGN'
        }),
        expect.objectContaining({
          label: '加纳 GHS',
          region: 'GH',
          currency: 'GHS',
          value: 'GH:GHS'
        }),
        expect.objectContaining({
          label: '巴西 BRL',
          region: 'BR',
          currency: 'BRL',
          value: 'BR:BRL'
        })
      ])
    );
  });

  it('parses localized currency prices from provider pages', async () => {
    const { service, tx } = createService({
      source: {
        name: 'Gemini 官方价格 MY/MYR',
        provider: 'gemini',
        region: 'MY',
        currency: 'MYR',
        collectMethod: 'webpage',
        sourceUrl: 'https://one.google.com/intl/en_my/about/google-ai-plans/'
      },
      appleService: {
        name: 'Google AI Pro 1个月',
        currency: 'MYR'
      }
    });
    mockFetchResponse(
      '<html><body>Google AI Pro RM 97.99 / month Google AI Ultra RM 1,299.99 / month</body></html>',
      'text/html'
    );

    const result = await service.checkProvider(
      'gemini',
      { regions: [{ region: 'MY', currency: 'MYR' }] },
      operator
    );

    expect(result.provider).toBe('gemini');
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planCode: 'google_ai_pro_monthly',
          region: 'MY',
          currency: 'MYR',
          officialPrice: '97.99'
        })
      })
    );
  });

  it('parses Google AI Ultra tier prices when localized prices appear before tier text', async () => {
    const { service, tx } = createService({
      source: {
        name: 'Gemini 官方价格 SG/SGD',
        provider: 'gemini',
        region: 'SG',
        currency: 'SGD',
        collectMethod: 'webpage',
        sourceUrl: 'https://gemini.google/subscriptions/'
      },
      appleService: {
        name: 'Google AI Ultra 20x 1个月',
        currency: 'SGD'
      }
    });
    mockFetchResponse(
      '<html><body>Google AI Ultra Starting at: SGD 139.99/ month SGD 139.99/ month: 5x higher usage limits vs. AI Pro SGD 289.98 / month: 20x higher usage limits vs. AI Pro</body></html>',
      'text/html'
    );

    const result = await service.checkProvider(
      'gemini',
      {
        regions: [
          { region: 'SG', currency: 'SGD', sourceUrl: 'https://gemini.google/subscriptions/' }
        ]
      },
      operator
    );

    expect(result.provider).toBe('gemini');
    expect(tx.appleOfficialPriceSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planCode: 'google_ai_ultra_20x_monthly',
          region: 'SG',
          currency: 'SGD',
          officialPrice: '289.98'
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
        officialBasePrice: '22',
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

  it('blocks approving a collected plan when its category is disabled', async () => {
    const { service, prisma, appleServicesService } = createService();
    const dictionaryModel = prisma.dataDictionary as unknown as {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    dictionaryModel.findFirst.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      group: 'apple.service.categories',
      code: 'chatgpt',
      label: 'ChatGPT',
      value: 'ChatGPT',
      sortOrder: 0,
      status: 'disabled',
      remark: null,
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: now,
      updatedAt: now
    });

    await expect(service.approveReview(reviewId, operator)).rejects.toThrow('已停用');
    expect(dictionaryModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          remark: expect.stringContaining('官方价格采集发现但当前停用')
        })
      })
    );
    expect(appleServicesService.update).not.toHaveBeenCalled();
  });
});
