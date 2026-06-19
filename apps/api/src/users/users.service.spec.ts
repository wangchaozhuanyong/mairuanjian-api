import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  it('applies whitelisted user list sorting', async () => {
    const user = {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'admin',
      displayName: '管理员',
      phone: null,
      email: null,
      status: 'active',
      lastLoginAt: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T01:00:00.000Z'),
      userRoles: []
    };
    const findMany = jest.fn().mockResolvedValue([user]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      $transaction: jest.fn(async (queries: Array<Promise<unknown>>) => Promise.all(queries)),
      user: {
        findMany,
        count
      }
    } as unknown as PrismaService;
    const service = new UsersService(prisma, {} as AuditLogsService);

    const result = await service.listUsers({
      page: '1',
      pageSize: '20',
      sortBy: 'updatedAt',
      sortOrder: 'asc'
    });

    expect(result.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'asc' }, { createdAt: 'desc' }]
      })
    );
    expect(count).toHaveBeenCalled();
  });
});
