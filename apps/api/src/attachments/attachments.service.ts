import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { getPagination, type PaginationQuery } from '../common/pagination';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateAttachmentMetadataDto } from './dto/create-attachment-metadata.dto';
import type { UploadedFile } from './attachments.types';

interface ListAttachmentsQuery extends PaginationQuery {
  keyword?: string;
  businessModule?: string;
  objectType?: string;
  objectId?: string;
  purpose?: string;
  sortBy?: string;
  sortOrder?: string;
}

const ATTACHMENT_SORT_FIELDS: Record<string, keyof Prisma.AttachmentOrderByWithRelationInput> = {
  originalName: 'originalName',
  mimeType: 'mimeType',
  sizeBytes: 'sizeBytes',
  businessModule: 'businessModule',
  objectType: 'objectType',
  purpose: 'purpose',
  createdAt: 'createdAt'
};

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async list(query: ListAttachmentsQuery) {
    const pagination = getPagination(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.AttachmentWhereInput = {
      businessModule: query.businessModule ? query.businessModule.trim() : undefined,
      objectType: query.objectType ? query.objectType.trim() : undefined,
      objectId: query.objectId ? this.normalizeObjectId(query.objectId) : undefined,
      purpose: query.purpose ? query.purpose.trim() : undefined,
      OR: keyword
        ? [
            { originalName: { contains: keyword, mode: 'insensitive' } },
            { mimeType: { contains: keyword, mode: 'insensitive' } },
            { businessModule: { contains: keyword, mode: 'insensitive' } },
            { objectType: { contains: keyword, mode: 'insensitive' } },
            { purpose: { contains: keyword, mode: 'insensitive' } },
            { remark: { contains: keyword, mode: 'insensitive' } }
          ]
        : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              displayName: true
            }
          }
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: this.buildOrderBy(query)
      }),
      this.prisma.attachment.count({ where })
    ]);

    return {
      items: items.map((attachment) => this.toResponse(attachment)),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize
    };
  }

  async create(file: UploadedFile, operator?: AuthenticatedUser) {
    return this.createWithMetadata(file, {}, operator);
  }

  async createWithMetadata(
    file: UploadedFile,
    metadata: CreateAttachmentMetadataDto = {},
    operator?: AuthenticatedUser
  ) {
    const normalizedMetadata = this.normalizeMetadata(metadata);
    const attachment = await this.prisma.attachment.create({
      data: {
        originalName: file.originalname,
        storageKey: file.filename,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        businessModule: normalizedMetadata.businessModule,
        objectType: normalizedMetadata.objectType,
        objectId: normalizedMetadata.objectId,
        purpose: normalizedMetadata.purpose,
        remark: normalizedMetadata.remark,
        createdByUserId: operator?.id
      }
    });

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'attachment',
      action: 'attachment.upload',
      objectType: 'attachment',
      objectId: attachment.id,
      afterData: {
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes.toString(),
        businessModule: attachment.businessModule,
        objectType: attachment.objectType,
        objectId: attachment.objectId,
        purpose: attachment.purpose
      },
      remark: `Uploaded attachment ${attachment.originalName}`
    });

    return this.toResponse(attachment);
  }

  async recordDownload(id: string, operator?: AuthenticatedUser) {
    const attachment = await this.getRaw(id);

    await this.auditLogsService.create({
      userId: operator?.id,
      module: 'attachment',
      action: 'attachment.download',
      objectType: 'attachment',
      objectId: attachment.id,
      afterData: {
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes.toString(),
        businessModule: attachment.businessModule,
        objectType: attachment.objectType,
        objectId: attachment.objectId,
        purpose: attachment.purpose
      },
      remark: `Downloaded attachment ${attachment.originalName}`
    });

    return attachment;
  }

  async get(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: {
        id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return this.toResponse(attachment);
  }

  private async getRaw(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: {
        id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  private buildOrderBy(query: ListAttachmentsQuery): Prisma.AttachmentOrderByWithRelationInput[] {
    const sortField = query.sortBy ? ATTACHMENT_SORT_FIELDS[query.sortBy] : undefined;
    const sortOrder = this.parseSortOrder(query.sortOrder);

    if (!sortField || !sortOrder) {
      return [{ createdAt: 'desc' }];
    }

    return sortField === 'createdAt'
      ? [{ createdAt: sortOrder }]
      : [{ [sortField]: sortOrder }, { createdAt: 'desc' }];
  }

  private parseSortOrder(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === 'asc' || value === 'desc') {
      return value;
    }

    throw new BadRequestException('sortOrder is invalid');
  }

  private normalizeMetadata(metadata: CreateAttachmentMetadataDto) {
    return {
      businessModule: this.normalizeCodeLike(metadata.businessModule, 'businessModule', 80),
      objectType: this.normalizeCodeLike(metadata.objectType, 'objectType', 120),
      objectId: this.normalizeObjectId(metadata.objectId),
      purpose: this.normalizeNullableString(metadata.purpose, 120),
      remark: this.normalizeNullableString(metadata.remark, 1000)
    };
  }

  private normalizeCodeLike(value: unknown, field: string, maxLength: number) {
    const normalized = this.normalizeNullableString(value, maxLength);
    if (!normalized) {
      return null;
    }

    if (!/^[a-zA-Z0-9_.:-]+$/.test(normalized)) {
      throw new BadRequestException(`${field} format is invalid`);
    }

    return normalized;
  }

  private normalizeObjectId(value: unknown) {
    const normalized = this.normalizeNullableString(value, 36);
    if (!normalized) {
      return null;
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ) {
      throw new BadRequestException('objectId must be a UUID');
    }

    return normalized;
  }

  private normalizeNullableString(value: unknown, maxLength: number) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Attachment metadata must be strings');
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException('Attachment metadata is too long');
    }

    return normalized;
  }

  private toResponse<TAttachment extends { sizeBytes: bigint }>(attachment: TAttachment) {
    return {
      ...attachment,
      sizeBytes: attachment.sizeBytes.toString()
    };
  }
}
