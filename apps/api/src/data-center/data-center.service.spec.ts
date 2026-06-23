import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DataCenterService } from './data-center.service';

type CommandRunner = {
  runCommand: (
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv
  ) => Promise<{ stdout: string; stderr: string }>;
};

describe('DataCenterService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const user = {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };
  const backupJob = {
    id: '11111111-1111-4111-8111-111111111111',
    jobType: 'database',
    status: 'pending',
    storagePath: null,
    fileSize: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    remark: 'unit test backup',
    createdById: user.id,
    createdAt: now,
    createdBy: {
      id: user.id,
      username: user.username,
      displayName: user.displayName
    }
  };
  const restoreJob = {
    id: '22222222-2222-4222-8222-222222222222',
    backupJobId: backupJob.id,
    restoreScope: 'database',
    status: 'pending',
    approvalNote: 'unit test restore',
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    createdById: user.id,
    createdAt: now,
    backupJob: {
      id: backupJob.id,
      jobType: backupJob.jobType,
      status: backupJob.status,
      storagePath: backupJob.storagePath,
      createdAt: backupJob.createdAt
    },
    createdBy: backupJob.createdBy
  };
  const importJob = {
    id: '33333333-3333-4333-8333-333333333333',
    module: 'customers',
    filePath: 'imports/customers.xlsx',
    status: 'pending',
    totalCount: 10,
    successCount: 8,
    failedCount: 2,
    errorReport: 'reports/customers-errors.xlsx',
    remark: 'unit test import',
    startedAt: null,
    finishedAt: null,
    createdById: user.id,
    createdAt: now,
    createdBy: backupJob.createdBy
  };
  const exportJob = {
    id: '44444444-4444-4444-8444-444444444444',
    module: 'orders',
    exportScope: {},
    fields: ['orderNo'],
    containsSensitive: true,
    status: 'pending',
    filePath: 'exports/orders.xlsx',
    downloadExpiresAt: now,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
    createdById: user.id,
    createdAt: now,
    createdBy: backupJob.createdBy
  };
  const recycleRecord = {
    id: '55555555-5555-4555-8555-555555555555',
    module: 'customers',
    objectType: 'customer',
    objectId: null,
    objectLabel: '测试客户',
    snapshotData: {},
    deletedById: user.id,
    deletedAt: now,
    restoredById: null,
    restoredAt: null,
    deletedBy: backupJob.createdBy,
    restoredBy: null
  };
  const cleanupJob = {
    id: '66666666-6666-4666-8666-666666666666',
    module: 'orders',
    cleanupScope: {},
    status: 'pending',
    affectedCount: 3,
    approvalNote: 'cleanup approval',
    errorMessage: null,
    createdById: user.id,
    createdAt: now,
    finishedAt: null,
    createdBy: backupJob.createdBy
  };
  const duplicateJob = {
    id: '77777777-7777-4777-8777-777777777777',
    module: 'customers',
    matchRule: {},
    primaryObjectId: null,
    duplicateObjectIds: [],
    status: 'pending',
    affectedCount: 2,
    approvalNote: 'duplicate approval',
    errorMessage: null,
    createdById: user.id,
    createdAt: now,
    finishedAt: null,
    createdBy: backupJob.createdBy
  };
  const dictionary = {
    id: '88888888-8888-4888-8888-888888888888',
    group: 'order_status',
    code: 'pending',
    label: '待处理',
    value: 'pending',
    sortOrder: 1,
    status: 'active',
    remark: null,
    createdByUserId: user.id,
    updatedByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    createdBy: backupJob.createdBy,
    updatedBy: backupJob.createdBy
  };
  const systemParameter = {
    id: '99999999-9999-4999-8999-999999999999',
    key: 'data.retention_days',
    value: { days: 180 },
    group: 'data',
    remark: 'retention',
    updatedByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    updatedBy: backupJob.createdBy
  };

  function createService() {
    const prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        throw new Error('Unexpected transaction input');
      }),
      backupJob: {
        findMany: jest.fn().mockResolvedValue([backupJob]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...backupJob,
            ...data,
            id: backupJob.id,
            createdAt: now,
            createdBy: backupJob.createdBy
          })
        ),
        findUnique: jest.fn().mockResolvedValue(backupJob),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...backupJob,
            ...data,
            createdBy: backupJob.createdBy
          })
        )
      },
      restoreJob: {
        findMany: jest.fn().mockResolvedValue([restoreJob]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(restoreJob),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...restoreJob,
            ...data,
            createdBy: backupJob.createdBy
          })
        )
      },
      dataImportJob: {
        findMany: jest.fn().mockResolvedValue([importJob]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...importJob,
            ...data,
            id: importJob.id,
            createdAt: now,
            createdBy: backupJob.createdBy
          })
        ),
        findUnique: jest.fn().mockResolvedValue(importJob),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...importJob,
            ...data,
            createdBy: backupJob.createdBy
          })
        )
      },
      dataExportJob: {
        findMany: jest.fn().mockResolvedValue([exportJob]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...exportJob,
            ...data,
            id: exportJob.id,
            createdAt: now,
            createdBy: backupJob.createdBy
          })
        ),
        findUnique: jest.fn().mockResolvedValue(exportJob),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...exportJob,
            ...data,
            createdBy: backupJob.createdBy
          })
        )
      },
      customer: {
        create: jest.fn().mockResolvedValue({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            name: '测试客户',
            phoneTail: '1234',
            wechat: 'wechat-id',
            tags: ['vip'],
            status: 'active',
            remark: 'unit customer',
            createdAt: now,
            updatedAt: now,
            sourcePlatform: { name: '微信渠道' }
          }
        ])
      },
      sourcePlatform: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
        create: jest.fn().mockResolvedValue({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        })
      },
      appleAccount: {
        findMany: jest.fn().mockResolvedValue([])
      },
      appleOrder: {
        findMany: jest.fn().mockResolvedValue([])
      },
      appleService: {
        count: jest.fn().mockResolvedValue(0)
      },
      redeemCode: {
        findMany: jest.fn().mockResolvedValue([])
      },
      codePlatformOrder: {
        findMany: jest.fn().mockResolvedValue([])
      },
      recycleBinRecord: {
        findMany: jest.fn().mockResolvedValue([recycleRecord]),
        count: jest.fn().mockResolvedValue(1)
      },
      dataCleanupJob: {
        findMany: jest.fn().mockResolvedValue([cleanupJob]),
        count: jest.fn().mockResolvedValue(1)
      },
      duplicateMergeJob: {
        findMany: jest.fn().mockResolvedValue([duplicateJob]),
        count: jest.fn().mockResolvedValue(1)
      },
      dataDictionary: {
        findMany: jest.fn().mockResolvedValue([dictionary]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(dictionary),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...dictionary,
            ...data,
            id: dictionary.id,
            createdAt: now,
            updatedAt: now,
            createdBy: backupJob.createdBy,
            updatedBy: backupJob.createdBy
          })
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...dictionary,
            ...data,
            updatedBy: backupJob.createdBy
          })
        ),
        delete: jest.fn().mockResolvedValue(dictionary)
      },
      systemParameter: {
        findMany: jest.fn().mockResolvedValue([systemParameter]),
        count: jest.fn().mockResolvedValue(1)
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const notificationsService = {
      triggerEvent: jest.fn().mockResolvedValue({})
    } as unknown as NotificationsService;

    return {
      service: new DataCenterService(prisma, auditLogsService, notificationsService),
      prisma,
      auditLogsService,
      notificationsService
    };
  }

  it('creates a backup job and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.createBackupJob(
      {
        jobType: 'database',
        remark: 'unit test backup'
      },
      user
    );

    expect(result.status).toBe('pending');
    expect(prisma.backupJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobType: 'database',
          status: 'pending',
          remark: 'unit test backup',
          createdById: user.id
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'data',
        action: 'data.backup.create',
        objectType: 'backup_job'
      })
    );
  });

  it('applies whitelisted backup job sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listBackupJobs({
      page: 1,
      pageSize: 20,
      status: 'pending',
      jobType: 'database',
      sortBy: 'fileSize',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(backupJob.id);
    expect(prisma.backupJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          jobType: 'database'
        }),
        orderBy: [{ fileSize: 'desc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('executes database backup job through backup script', async () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'data-backup-'));
    const previousBackupDir = process.env.DATA_BACKUP_DIR;
    process.env.DATA_BACKUP_DIR = backupDir;
    const backupFilePath = join(backupDir, 'apple_business-test.dump');
    writeFileSync(backupFilePath, 'postgres backup');
    const { service, prisma, auditLogsService } = createService();
    jest.spyOn(service as unknown as CommandRunner, 'runCommand').mockResolvedValue({
      stdout: `Backup written to ${backupFilePath}\n`,
      stderr: ''
    });

    try {
      const result = await service.executeBackupJob(backupJob.id, user);

      expect(result.status).toBe('success');
      expect(result.storagePath).toBe(backupFilePath);
      expect(result.fileSize).toBe(String(Buffer.byteLength('postgres backup')));
      expect(prisma.backupJob.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'success',
            storagePath: backupFilePath,
            fileSize: BigInt(Buffer.byteLength('postgres backup')),
            finishedAt: expect.any(Date)
          })
        })
      );
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'data',
          action: 'data.backup.execute.success',
          objectType: 'backup_job'
        })
      );
    } finally {
      if (previousBackupDir === undefined) {
        delete process.env.DATA_BACKUP_DIR;
      } else {
        process.env.DATA_BACKUP_DIR = previousBackupDir;
      }
      rmSync(backupDir, { recursive: true, force: true });
    }
  });

  it('applies whitelisted restore job sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listRestoreJobs({
      page: 1,
      pageSize: 20,
      status: 'pending',
      sortBy: 'restoreScope',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(restoreJob.id);
    expect(prisma.restoreJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending'
        }),
        orderBy: [{ restoreScope: 'asc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('executes restore drill with strong confirmation', async () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'data-backup-'));
    const previousBackupDir = process.env.DATA_BACKUP_DIR;
    process.env.DATA_BACKUP_DIR = backupDir;
    const backupFilePath = join(backupDir, 'apple_business-test.dump');
    writeFileSync(backupFilePath, 'postgres backup');
    const { service, prisma, auditLogsService } = createService();
    const executableRestoreJob = {
      ...restoreJob,
      status: 'pending',
      backupJob: {
        ...restoreJob.backupJob,
        status: 'success',
        storagePath: backupFilePath
      }
    };
    (prisma.restoreJob.findUnique as jest.Mock).mockResolvedValue(executableRestoreJob);
    (prisma.restoreJob.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...executableRestoreJob,
        ...data,
        createdBy: backupJob.createdBy
      })
    );
    const runCommandSpy = jest
      .spyOn(service as unknown as CommandRunner, 'runCommand')
      .mockResolvedValue({
        stdout: 'Restore drill completed successfully\n',
        stderr: ''
      });

    try {
      const result = await service.executeRestoreJob(
        restoreJob.id,
        { confirmText: `CONFIRM_RESTORE_DRILL ${restoreJob.id.slice(0, 8)}` },
        user
      );

      expect(result.status).toBe('success');
      expect(runCommandSpy).toHaveBeenCalledWith(
        'bash',
        [expect.stringContaining('scripts/verify-postgres-restore.sh'), backupFilePath],
        expect.objectContaining({
          DATA_BACKUP_DIR: backupDir,
          BACKUP_DIR: backupDir
        })
      );
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'data',
          action: 'data.restore.execute.success',
          objectType: 'restore_job'
        })
      );
    } finally {
      if (previousBackupDir === undefined) {
        delete process.env.DATA_BACKUP_DIR;
      } else {
        process.env.DATA_BACKUP_DIR = previousBackupDir;
      }
      rmSync(backupDir, { recursive: true, force: true });
    }
  });

  it('rejects restore execution when confirmation text does not match', async () => {
    const { service, prisma } = createService();
    (prisma.restoreJob.findUnique as jest.Mock).mockResolvedValue({
      ...restoreJob,
      backupJob: {
        ...restoreJob.backupJob,
        status: 'success',
        storagePath: 'apple_business-test.dump'
      }
    });

    await expect(
      service.executeRestoreJob(restoreJob.id, { confirmText: 'wrong-confirmation' }, user)
    ).rejects.toThrow('confirmText must be CONFIRM_RESTORE_DRILL 22222222');
  });

  it('applies whitelisted import job sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listImportJobs({
      page: 1,
      pageSize: 20,
      module: 'customers',
      sortBy: 'failedCount',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(importJob.id);
    expect(prisma.dataImportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: 'customers'
        }),
        orderBy: [{ failedCount: 'desc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('executes customer import and writes error report for invalid rows', async () => {
    const importDir = mkdtempSync(join(tmpdir(), 'data-import-'));
    const errorDir = mkdtempSync(join(tmpdir(), 'data-import-errors-'));
    const previousImportDir = process.env.DATA_IMPORT_DIR;
    const previousErrorDir = process.env.DATA_IMPORT_ERROR_DIR;
    process.env.DATA_IMPORT_DIR = importDir;
    process.env.DATA_IMPORT_ERROR_DIR = errorDir;
    const { service, prisma, auditLogsService } = createService();
    const fileName = 'customers.csv';
    writeFileSync(
      join(importDir, fileName),
      'name,phone,sourcePlatformName,tags,status\n测试客户,18800001234,微信渠道,"vip|paid",active\n,18800005678,微信渠道,,active\n'
    );
    const executableImportJob = {
      ...importJob,
      module: 'customers',
      filePath: fileName,
      status: 'pending',
      errorReport: null
    };
    (prisma.dataImportJob.findUnique as jest.Mock).mockResolvedValue(executableImportJob);
    (prisma.dataImportJob.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...executableImportJob,
        ...data,
        createdBy: backupJob.createdBy
      })
    );

    try {
      const result = await service.executeImportJob(importJob.id, user);

      expect(result.status).toBe('success');
      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errorReport).toContain('import-errors-');
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: '测试客户',
            phoneTail: '1234',
            tags: ['vip', 'paid'],
            createdByUserId: user.id
          })
        })
      );
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'data',
          action: 'data.import.execute.success',
          objectType: 'data_import_job'
        })
      );
      const reportPath = join(errorDir, result.errorReport ?? '');
      expect(existsSync(reportPath)).toBe(true);
      expect(readFileSync(reportPath, 'utf8')).toContain('name is required');
    } finally {
      if (previousImportDir === undefined) {
        delete process.env.DATA_IMPORT_DIR;
      } else {
        process.env.DATA_IMPORT_DIR = previousImportDir;
      }
      if (previousErrorDir === undefined) {
        delete process.env.DATA_IMPORT_ERROR_DIR;
      } else {
        process.env.DATA_IMPORT_ERROR_DIR = previousErrorDir;
      }
      rmSync(importDir, { recursive: true, force: true });
      rmSync(errorDir, { recursive: true, force: true });
    }
  });

  it('records audit log when downloading import error report', async () => {
    const errorDir = mkdtempSync(join(tmpdir(), 'data-import-errors-'));
    const previousErrorDir = process.env.DATA_IMPORT_ERROR_DIR;
    process.env.DATA_IMPORT_ERROR_DIR = errorDir;
    const { service, prisma, auditLogsService } = createService();
    const fileName = 'import-errors-test.csv';
    const absolutePath = join(errorDir, fileName);
    writeFileSync(absolutePath, 'lineNumber,message\n2,name is required\n');
    (prisma.dataImportJob.findUnique as jest.Mock).mockResolvedValue({
      ...importJob,
      errorReport: fileName
    });

    try {
      const result = await service.getImportErrorReport(importJob.id, user);

      expect(result.fileName).toBe(fileName);
      expect(result.absolutePath).toBe(absolutePath);
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'data',
          action: 'data.import.error_report.download',
          objectType: 'data_import_job'
        })
      );
    } finally {
      if (previousErrorDir === undefined) {
        delete process.env.DATA_IMPORT_ERROR_DIR;
      } else {
        process.env.DATA_IMPORT_ERROR_DIR = previousErrorDir;
      }
      rmSync(errorDir, { recursive: true, force: true });
    }
  });

  it('applies whitelisted export job sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listExportJobs({
      page: 1,
      pageSize: 20,
      containsSensitive: 'true',
      sortBy: 'downloadExpiresAt',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(exportJob.id);
    expect(prisma.dataExportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          containsSensitive: true
        }),
        orderBy: [{ downloadExpiresAt: 'asc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('executes export job and writes a downloadable csv file', async () => {
    const exportDir = mkdtempSync(join(tmpdir(), 'data-export-'));
    const previousExportDir = process.env.DATA_EXPORT_DIR;
    process.env.DATA_EXPORT_DIR = exportDir;
    const { service, prisma, auditLogsService } = createService();
    const executableExportJob = {
      ...exportJob,
      module: 'customers',
      fields: ['name', 'phoneMasked', 'sourcePlatform'],
      status: 'pending'
    };
    (prisma.dataExportJob.findUnique as jest.Mock).mockResolvedValue(executableExportJob);
    (prisma.dataExportJob.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...executableExportJob,
        ...data,
        createdBy: backupJob.createdBy
      })
    );

    try {
      const result = await service.executeExportJob(exportJob.id, user);

      expect(result.status).toBe('success');
      expect(result.filePath).toContain('customers-');
      expect(prisma.customer.findMany).toHaveBeenCalled();
      expect(prisma.dataExportJob.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'success',
            filePath: expect.stringContaining('customers-'),
            downloadExpiresAt: expect.any(Date),
            finishedAt: expect.any(Date)
          })
        })
      );
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'data',
          action: 'data.export.execute.success',
          objectType: 'data_export_job'
        })
      );
      const filePath = join(exportDir, result.filePath ?? '');
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf8')).toContain('测试客户');
    } finally {
      if (previousExportDir === undefined) {
        delete process.env.DATA_EXPORT_DIR;
      } else {
        process.env.DATA_EXPORT_DIR = previousExportDir;
      }
      rmSync(exportDir, { recursive: true, force: true });
    }
  });

  it('records audit log when downloading export file', async () => {
    const exportDir = mkdtempSync(join(tmpdir(), 'data-export-'));
    const previousExportDir = process.env.DATA_EXPORT_DIR;
    process.env.DATA_EXPORT_DIR = exportDir;
    const { service, prisma, auditLogsService } = createService();
    const fileName = 'customers-test.csv';
    const absolutePath = join(exportDir, fileName);
    writeFileSync(absolutePath, 'id,name\n1,测试客户\n');
    (prisma.dataExportJob.findUnique as jest.Mock).mockResolvedValue({
      ...exportJob,
      status: 'success',
      filePath: fileName,
      downloadExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    try {
      const result = await service.getExportDownload(exportJob.id, user);

      expect(result.fileName).toBe(fileName);
      expect(result.absolutePath).toBe(absolutePath);
      expect(auditLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'data',
          action: 'data.export.download',
          objectType: 'data_export_job'
        })
      );
    } finally {
      if (previousExportDir === undefined) {
        delete process.env.DATA_EXPORT_DIR;
      } else {
        process.env.DATA_EXPORT_DIR = previousExportDir;
      }
      rmSync(exportDir, { recursive: true, force: true });
    }
  });

  it('applies whitelisted recycle bin sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listRecycleBin({
      page: 1,
      pageSize: 20,
      module: 'customers',
      restored: 'false',
      sortBy: 'objectLabel',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(recycleRecord.id);
    expect(prisma.recycleBinRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: 'customers',
          restoredAt: null
        }),
        orderBy: [{ objectLabel: 'asc' }, { deletedAt: 'desc' }]
      })
    );
  });

  it('applies whitelisted cleanup job sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listCleanupJobs({
      page: 1,
      pageSize: 20,
      status: 'pending',
      sortBy: 'affectedCount',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(cleanupJob.id);
    expect(prisma.dataCleanupJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending'
        }),
        orderBy: [{ affectedCount: 'desc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('applies whitelisted duplicate merge job sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listDuplicateMergeJobs({
      page: 1,
      pageSize: 20,
      module: 'customers',
      sortBy: 'primaryObjectId',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(duplicateJob.id);
    expect(prisma.duplicateMergeJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: 'customers'
        }),
        orderBy: [{ primaryObjectId: 'asc' }, { createdAt: 'desc' }]
      })
    );
  });

  it('applies whitelisted dictionary sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listDictionaries({
      page: 1,
      pageSize: 20,
      status: 'active',
      sortBy: 'label',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(dictionary.id);
    expect(prisma.dataDictionary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active'
        }),
        orderBy: [{ label: 'desc' }, { group: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }]
      })
    );
  });

  it('deletes a dictionary and writes audit log', async () => {
    const { service, prisma, auditLogsService } = createService();

    const result = await service.deleteDictionary(dictionary.id, user);

    expect(result).toEqual({ deleted: true });
    expect(prisma.dataDictionary.delete).toHaveBeenCalledWith({
      where: { id: dictionary.id }
    });
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'data',
        action: 'data.dictionary.delete',
        objectType: 'data_dictionary',
        objectId: dictionary.id,
        afterData: undefined
      })
    );
  });

  it('blocks deleting an Apple service category while services still use it', async () => {
    const { service, prisma } = createService();
    const categoryDictionary = {
      ...dictionary,
      group: 'apple.service.categories',
      code: 'chatgpt',
      label: 'ChatGPT',
      value: 'ChatGPT'
    };
    prisma.dataDictionary.findUnique = jest.fn().mockResolvedValue(categoryDictionary);
    prisma.appleService.count = jest.fn().mockResolvedValue(2);

    await expect(service.deleteDictionary(categoryDictionary.id, user)).rejects.toThrow(
      'Apple ID 业务分类已被业务使用'
    );
    expect(prisma.dataDictionary.delete).not.toHaveBeenCalled();
  });

  it('applies whitelisted system parameter sorting', async () => {
    const { service, prisma } = createService();

    const result = await service.listSystemParameters({
      page: 1,
      pageSize: 20,
      group: 'data',
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(systemParameter.id);
    expect(prisma.systemParameter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          group: 'data'
        }),
        orderBy: [{ updatedAt: 'desc' }, { group: 'asc' }, { key: 'asc' }]
      })
    );
  });

  it('triggers backup failure notification when backup status becomes failed', async () => {
    const { service, prisma, notificationsService } = createService();

    const result = await service.updateBackupJobStatus(
      backupJob.id,
      {
        status: 'failed',
        errorMessage: 'disk full'
      },
      user
    );

    expect(result.status).toBe('failed');
    expect(prisma.backupJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'disk full',
          finishedAt: expect.any(Date)
        })
      })
    );
    expect(notificationsService.triggerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'ops.backup.failed',
        module: 'ops',
        title: '备份失败'
      })
    );
  });
});
