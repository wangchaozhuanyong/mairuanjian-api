import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessageTemplatesService } from './message-templates.service';

describe('MessageTemplatesService', () => {
  it('applies whitelisted message template list sorting', async () => {
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
        orderBy: [{ channel: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(count).toHaveBeenCalled();
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
