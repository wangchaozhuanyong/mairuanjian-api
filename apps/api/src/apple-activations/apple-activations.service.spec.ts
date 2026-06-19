import { PrismaService } from '../common/prisma/prisma.service';
import { AppleActivationsService } from './apple-activations.service';

describe('AppleActivationsService', () => {
  const service = new AppleActivationsService({} as PrismaService);

  it('applies whitelisted activation list sorting', async () => {
    const prisma = {
      serviceActivation: {
        findMany: jest.fn().mockReturnValue([]),
        count: jest.fn().mockReturnValue(0)
      },
      $transaction: jest.fn().mockResolvedValue([[], 0])
    } as unknown as PrismaService;
    const serviceWithPrisma = new AppleActivationsService(prisma);

    await serviceWithPrisma.list({
      page: '1',
      pageSize: '20',
      sortBy: 'expireTime',
      sortOrder: 'desc'
    });

    expect(prisma.serviceActivation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ expireTime: 'desc' }, { createdAt: 'desc' }]
      })
    );
    expect(prisma.serviceActivation.count).toHaveBeenCalled();
  });

  it('returns null days until expire when expire time is empty', () => {
    expect(service.calculateDaysUntilExpire(null)).toBeNull();
  });

  it('calculates days until expire using ceiling days', () => {
    const now = new Date('2026-07-01T12:00:00.000Z');
    const expireTime = new Date('2026-07-04T00:00:00.000Z');

    expect(service.calculateDaysUntilExpire(expireTime, now)).toBe(3);
  });

  it('returns negative days for expired activation', () => {
    const now = new Date('2026-07-05T00:00:00.000Z');
    const expireTime = new Date('2026-07-04T00:00:00.000Z');

    expect(service.calculateDaysUntilExpire(expireTime, now)).toBe(-1);
  });
});
