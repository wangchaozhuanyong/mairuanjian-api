import { BadRequestException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessageTemplatesService } from './message-templates.service';

describe('MessageTemplatesService', () => {
  const template = {
    id: '11111111-1111-4111-8111-111111111111',
    name: '发货模板',
    type: 'delivery',
    channel: 'customer_service',
    content: '订单 {{ order_no }} 已发货',
    variables: ['order_no'],
    status: 'active',
    remark: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: new Date('2026-06-18T01:00:00.000Z')
  };

  it('applies whitelisted message template list sorting', async () => {
    const findMany = jest.fn().mockResolvedValue([template]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries)),
      messageTemplate: {
        findMany,
        count
      }
    } as unknown as PrismaService;
    const service = new MessageTemplatesService(prisma, {} as AuditLogsService);

    const result = await service.list({
      page: '1',
      pageSize: '20',
      sortBy: 'channel',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'delivery',
          channel: 'customer_service'
        }),
        orderBy: [{ channel: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(count).toHaveBeenCalled();
  });

  it('always creates delivery customer-service templates from the delivery template endpoint', async () => {
    const create = jest.fn().mockResolvedValue(template);
    const findFirst = jest.fn().mockResolvedValue(template);
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;
    const prisma = {
      messageTemplate: {
        create,
        findFirst
      }
    } as unknown as PrismaService;
    const service = new MessageTemplatesService(prisma, auditLogsService);

    const result = await service.create({
      name: '发货模板',
      content: '订单 {{ order_no }} 已发货'
    });

    expect(result).toBe(template);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'delivery',
          channel: 'customer_service'
        })
      })
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: template.id,
          type: 'delivery',
          channel: 'customer_service'
        })
      })
    );
  });

  it('rejects notification or telegram templates on the delivery template endpoint', async () => {
    const service = new MessageTemplatesService({} as PrismaService, {} as AuditLogsService);

    await expect(
      service.create({
        name: '通知模板',
        type: 'notification' as never,
        channel: 'telegram' as never,
        content: '后台提醒'
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('extracts template variables from content and removes duplicates', () => {
    const service = new MessageTemplatesService({} as PrismaService, {} as AuditLogsService);

    expect(
      service.normalizeVariables('客户 {{ customer_name }} 的订单 {{order_no}} 已处理', [
        'order_no',
        'operator'
      ])
    ).toEqual(['customer_name', 'operator', 'order_no']);
  });
});
