import { AttachmentsService } from './attachments.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('AttachmentsService', () => {
  it('applies whitelisted list sorting', async () => {
    const prisma = {
      attachment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const service = new AttachmentsService(prisma, auditLogsService);

    await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'sizeBytes',
      sortOrder: 'desc'
    });

    expect(prisma.attachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sizeBytes: 'desc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.attachment.count).toHaveBeenCalled();
  });

  it('stores business metadata when uploading an attachment', async () => {
    const createdAttachment = {
      id: '11111111-1111-4111-8111-111111111111',
      originalName: 'evidence.png',
      storageKey: 'stored-file-key',
      mimeType: 'image/png',
      sizeBytes: BigInt(1024),
      businessModule: 'apple',
      objectType: 'renewal_task',
      objectId: '22222222-2222-4222-8222-222222222222',
      purpose: 'evidence',
      remark: '续费凭证',
      createdByUserId: 'operator-id',
      createdAt: new Date('2026-06-18T00:00:00.000Z')
    };
    const prisma = {
      attachment: {
        create: jest.fn().mockResolvedValue(createdAttachment)
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const service = new AttachmentsService(prisma, auditLogsService);

    const result = await service.createWithMetadata(
      {
        originalname: 'evidence.png',
        filename: 'stored-file-key',
        mimetype: 'image/png',
        size: 1024,
        path: '/tmp/stored-file-key'
      },
      {
        businessModule: 'apple',
        objectType: 'renewal_task',
        objectId: '22222222-2222-4222-8222-222222222222',
        purpose: 'evidence',
        remark: '续费凭证'
      },
      {
        id: 'operator-id',
        username: 'admin',
        displayName: '管理员',
        roles: ['admin'],
        permissions: []
      }
    );

    expect(result.sizeBytes).toBe('1024');
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessModule: 'apple',
          objectType: 'renewal_task',
          objectId: '22222222-2222-4222-8222-222222222222',
          purpose: 'evidence',
          remark: '续费凭证',
          createdByUserId: 'operator-id'
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'attachment',
        action: 'attachment.upload',
        objectType: 'attachment',
        objectId: createdAttachment.id
      })
    );
  });

  it('writes an audit log when downloading an attachment', async () => {
    const attachment = {
      id: '11111111-1111-4111-8111-111111111111',
      originalName: 'evidence.png',
      storageKey: 'stored-file-key',
      mimeType: 'image/png',
      sizeBytes: BigInt(1024),
      businessModule: 'apple',
      objectType: 'renewal_task',
      objectId: '22222222-2222-4222-8222-222222222222',
      purpose: 'evidence',
      remark: '续费凭证',
      createdByUserId: 'operator-id',
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      createdBy: null
    };
    const prisma = {
      attachment: {
        findUnique: jest.fn().mockResolvedValue(attachment)
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const service = new AttachmentsService(prisma, auditLogsService);

    const result = await service.recordDownload(attachment.id, {
      id: 'operator-id',
      username: 'admin',
      displayName: '管理员',
      roles: ['admin'],
      permissions: []
    });

    expect(result.id).toBe(attachment.id);
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'operator-id',
        module: 'attachment',
        action: 'attachment.download',
        objectType: 'attachment',
        objectId: attachment.id
      })
    );
  });
});
