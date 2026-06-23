import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const user = {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };
  const userSnapshot = {
    id: user.id,
    username: user.username,
    displayName: user.displayName
  };
  const announcement = {
    id: '11111111-1111-4111-8111-111111111111',
    title: '维护公告',
    content: '今晚维护',
    level: 'warning',
    enabled: true,
    startAt: null,
    endAt: null,
    createdById: user.id,
    updatedByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: userSnapshot,
    updatedBy: userSnapshot
  };
  const featureFlag = {
    id: '22222222-2222-4222-8222-222222222222',
    key: 'sensitive_export',
    name: '敏感数据导出',
    enabled: false,
    config: {},
    remark: '默认关闭',
    updatedByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    updatedBy: userSnapshot
  };
  const maintenanceWindow = {
    id: '44444444-4444-4444-8444-444444444444',
    enabled: true,
    reason: '系统升级维护',
    allowedRoles: ['admin', 'technician'],
    allowedIps: [],
    startAt: now,
    endAt: null,
    createdById: user.id,
    updatedByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    createdBy: userSnapshot,
    updatedBy: userSnapshot
  };
  const appVersion = {
    id: '66666666-6666-4666-8666-666666666666',
    version: '0.1.0',
    title: '第一版上线准备',
    status: 'released',
    releaseNotes: '完成后台第一版能力',
    impactModules: ['maintenance'],
    releasedAt: now,
    createdById: user.id,
    createdAt: now,
    createdBy: userSnapshot
  };
  const systemParameter = {
    id: '77777777-7777-4777-8777-777777777777',
    key: 'maintenance_theme_config',
    value: {},
    group: 'maintenance',
    remark: '主题配置',
    updatedByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    updatedBy: userSnapshot
  };

  function createService() {
    const prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        throw new Error('Unexpected transaction input');
      }),
      appAnnouncement: {
        findMany: jest.fn().mockResolvedValue([announcement]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...announcement,
            ...data,
            createdBy: userSnapshot,
            updatedBy: userSnapshot
          })
        )
      },
      featureFlag: {
        findUnique: jest.fn().mockResolvedValue(featureFlag),
        findMany: jest.fn().mockResolvedValue([featureFlag]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...featureFlag,
            ...data,
            updatedBy: userSnapshot
          })
        )
      },
      maintenanceWindow: {
        findFirst: jest.fn().mockResolvedValue(maintenanceWindow)
      },
      appVersion: {
        findMany: jest.fn().mockResolvedValue([appVersion]),
        count: jest.fn().mockResolvedValue(1)
      },
      systemParameter: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([systemParameter]),
        count: jest.fn().mockResolvedValue(1),
        upsert: jest.fn().mockImplementation(({ create, update, where }) =>
          Promise.resolve({
            id: '55555555-5555-4555-8555-555555555555',
            key: where.key,
            value: update.value ?? create.value,
            group: update.group ?? create.group,
            remark: update.remark ?? create.remark,
            updatedByUserId: user.id,
            createdAt: now,
            updatedAt: now,
            updatedBy: userSnapshot
          })
        )
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    return {
      service: new MaintenanceService(prisma, auditLogsService),
      prisma,
      auditLogsService
    };
  }

  it('creates an announcement and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.createAnnouncement(
      {
        title: '维护公告',
        content: '今晚维护',
        level: 'warning'
      },
      user
    );

    expect(result.title).toBe('维护公告');
    expect(prisma.appAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '维护公告',
          content: '今晚维护',
          level: 'warning',
          enabled: true,
          createdById: user.id,
          updatedByUserId: user.id
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'maintenance',
        action: 'maintenance.announcement.create',
        objectType: 'app_announcement'
      })
    );
  });

  it('updates a feature flag and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.updateFeatureFlag(
      featureFlag.id,
      {
        enabled: true,
        remark: '已准备联调'
      },
      user
    );

    expect(result.enabled).toBe(true);
    expect(prisma.featureFlag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enabled: true,
          remark: '已准备联调',
          updatedByUserId: user.id
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'maintenance',
        action: 'maintenance.feature_flag.update',
        objectType: 'feature_flag'
      })
    );
  });

  it('applies whitelisted announcement sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listAnnouncements({
      page: 1,
      pageSize: 20,
      level: 'warning',
      sortBy: 'title',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.title).toBe('维护公告');
    expect(prisma.appAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          level: 'warning'
        }),
        orderBy: [{ title: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.appAnnouncement.count).toHaveBeenCalled();
  });

  it('applies whitelisted feature flag sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listFeatureFlags({
      page: 1,
      pageSize: 20,
      enabled: 'false',
      sortBy: 'name',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.key).toBe('sensitive_export');
    expect(prisma.featureFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enabled: false
        }),
        orderBy: [{ name: 'desc' }, { key: 'asc' }]
      })
    );
    expect(prisma.featureFlag.count).toHaveBeenCalled();
  });

  it('applies whitelisted app version sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listAppVersions({
      page: 1,
      pageSize: 20,
      status: 'released',
      sortBy: 'version',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.version).toBe('0.1.0');
    expect(prisma.appVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'released'
        }),
        orderBy: [{ version: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.appVersion.count).toHaveBeenCalled();
  });

  it('applies whitelisted system parameter sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listSystemParameters({
      page: 1,
      pageSize: 20,
      keyword: 'theme',
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.key).toBe('maintenance_theme_config');
    expect(prisma.systemParameter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          group: 'maintenance'
        }),
        orderBy: [{ updatedAt: 'desc' }, { key: 'asc' }]
      })
    );
    expect(prisma.systemParameter.count).toHaveBeenCalled();
  });

  it('returns a public maintenance mode snapshot for frontend guard', async () => {
    const { service } = createService();

    const result = await service.getPublicMaintenanceMode();

    expect(result).toEqual({
      enabled: true,
      reason: '系统升级维护',
      allowedRoles: ['admin', 'technician'],
      startAt: now,
      endAt: null
    });
  });

  it('returns default launch checklist items', async () => {
    const { service } = createService();

    const result = await service.getLaunchChecklist();

    expect(result.items.length).toBeGreaterThan(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'quality_gate',
        priority: 'P0',
        status: 'passed'
      })
    );
  });

  it('accepts legacy launch checklist object with items array', async () => {
    const { service, prisma } = createService();
    (prisma.systemParameter.findUnique as jest.Mock).mockResolvedValueOnce({
      id: '55555555-5555-4555-8555-555555555555',
      key: 'maintenance_launch_checklist',
      value: {
        items: [
          {
            id: 'backup_restore',
            category: '数据',
            title: '数据库备份和恢复演练完成',
            priority: 'P0',
            status: 'passed',
            owner: '技术',
            evidence: 'restore drill',
            remark: '兼容旧格式'
          }
        ]
      },
      group: 'maintenance',
      remark: '上线检查清单',
      updatedByUserId: user.id,
      createdAt: now,
      updatedAt: now,
      updatedBy: userSnapshot
    });

    const result = await service.getLaunchChecklist();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'backup_restore',
        status: 'passed',
        evidence: 'restore drill'
      })
    );
  });

  it('saves launch checklist and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.saveLaunchChecklist(
      {
        items: [
          {
            id: 'apple_e2e',
            category: 'Apple ID',
            title: 'Apple ID 端到端验收',
            priority: 'P0',
            status: 'in_progress',
            owner: '业务',
            evidence: '验收记录',
            remark: '进行中'
          }
        ]
      },
      user
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe('in_progress');
    expect(prisma.systemParameter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'maintenance_launch_checklist' }
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'maintenance',
        action: 'maintenance.launch_checklist.update',
        objectType: 'system_parameter'
      })
    );
  });

  it('rejects waived status for first-release P0 manual gates', async () => {
    const { service } = createService();

    await expect(
      service.saveLaunchChecklist(
        {
          items: [
            {
              id: 'telegram_test',
              category: '通知',
              title: 'Telegram 真实测试发送通过',
              priority: 'P0',
              status: 'waived',
              owner: '运营',
              evidence: 'skip',
              remark: '不允许豁免'
            }
          ]
        },
        user
      )
    ).rejects.toThrow('telegram_test is a first-release P0 gate and cannot be waived');
  });
});
