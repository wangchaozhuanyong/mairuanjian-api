import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserTableViewsService } from './user-table-views.service';

describe('UserTableViewsService', () => {
  const now = new Date('2026-06-18T00:00:00.000Z');
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'admin',
    displayName: '管理员',
    roles: ['admin'],
    permissions: []
  };
  const view = {
    id: '22222222-2222-4222-8222-222222222222',
    userId: user.id,
    tableKey: 'customers',
    viewName: '我的常用视图',
    filters: { status: 'active' },
    sortConfig: { prop: 'updatedAt', order: 'descending' },
    columns: ['name', 'status', 'updatedAt'],
    density: 'compact',
    pageSize: 50,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };

  function createService() {
    const tx = {
      userTableView: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...view,
            ...data,
            id: view.id,
            createdAt: now,
            updatedAt: now
          })
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...view,
            ...data,
            updatedAt: now
          })
        )
      }
    };
    const prisma = {
      $transaction: jest.fn((input: unknown) => {
        if (Array.isArray(input)) return Promise.all(input);
        if (typeof input === 'function') return input(tx);
        throw new Error('Unexpected transaction input');
      }),
      userTableView: {
        findMany: jest.fn().mockResolvedValue([view]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(view),
        delete: jest.fn().mockResolvedValue(view)
      }
    } as unknown as PrismaService;
    const auditLogsService = {
      create: jest.fn().mockResolvedValue({})
    } as unknown as AuditLogsService;

    return {
      service: new UserTableViewsService(prisma, auditLogsService),
      prisma,
      tx,
      auditLogsService
    };
  }

  it('lists only the current user table views', async () => {
    const { service, prisma } = createService();

    const result = await service.listViews(user, {
      page: 1,
      pageSize: 20,
      tableKey: 'customers'
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.tableKey).toBe('customers');
    expect(prisma.userTableView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: user.id,
          tableKey: 'customers'
        })
      })
    );
  });

  it('creates a default view and clears existing defaults for the same table', async () => {
    const { service, tx, auditLogsService } = createService();

    const result = await service.createView(user, {
      tableKey: 'customers',
      viewName: '我的常用视图',
      filters: { status: 'active' },
      sortConfig: { prop: 'updatedAt', order: 'descending' },
      columns: ['name', 'status', 'updatedAt'],
      density: 'compact',
      pageSize: 50,
      isDefault: true
    });

    expect(result.isDefault).toBe(true);
    expect(tx.userTableView.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: user.id,
          tableKey: 'customers'
        },
        data: {
          isDefault: false
        }
      })
    );
    expect(tx.userTableView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          tableKey: 'customers',
          viewName: '我的常用视图',
          density: 'compact',
          pageSize: 50,
          isDefault: true
        })
      })
    );
    expect(auditLogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'table_view',
        action: 'user_table_view.create',
        objectType: 'user_table_view'
      })
    );
  });

  it('sets default view within the current user and table key', async () => {
    const { service, prisma, tx } = createService();

    const result = await service.setDefault(user, view.id);

    expect(result.isDefault).toBe(true);
    expect(prisma.userTableView.findFirst).toHaveBeenCalledWith({
      where: {
        id: view.id,
        userId: user.id
      }
    });
    expect(tx.userTableView.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: user.id,
          tableKey: 'customers',
          id: {
            not: view.id
          }
        },
        data: {
          isDefault: false
        }
      })
    );
  });
});
