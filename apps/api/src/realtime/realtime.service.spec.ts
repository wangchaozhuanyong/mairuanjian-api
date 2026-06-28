import { firstValueFrom, filter, take } from 'rxjs';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RealtimeService } from './realtime.service';

function createUser(permissions: string[]): AuthenticatedUser {
  return {
    id: 'user-1',
    username: 'operator',
    displayName: 'Operator',
    roles: [],
    permissions
  };
}

describe('RealtimeService', () => {
  it('allows action plan viewers to receive apple module events', async () => {
    const service = new RealtimeService();
    const messagePromise = firstValueFrom(
      service.streamFor(createUser(['apple.action_plan.view'])).pipe(
        filter((message) => message.data.type === 'apple.action_plan.generated'),
        take(1)
      )
    );

    service.publish({
      type: 'apple.action_plan.generated',
      module: 'apple',
      entity: 'action_plan',
      action: 'generated',
      resourceId: 'action-plan-1'
    });

    await expect(messagePromise).resolves.toMatchObject({
      data: {
        type: 'apple.action_plan.generated',
        module: 'apple',
        entity: 'action_plan',
        action: 'generated',
        resourceId: 'action-plan-1'
      }
    });
  });

  it('allows after-sale viewers to receive code module events', async () => {
    const service = new RealtimeService();
    const messagePromise = firstValueFrom(
      service.streamFor(createUser(['code.after_sale.view'])).pipe(
        filter((message) => message.data.type === 'code.after_sale.created'),
        take(1)
      )
    );

    service.publish({
      type: 'code.after_sale.created',
      module: 'code',
      entity: 'after_sale',
      action: 'created',
      resourceId: 'after-sale-1'
    });

    await expect(messagePromise).resolves.toMatchObject({
      data: {
        type: 'code.after_sale.created',
        module: 'code',
        entity: 'after_sale',
        action: 'created',
        resourceId: 'after-sale-1'
      }
    });
  });

  it('allows manual code order creators to receive code module events', async () => {
    const service = new RealtimeService();
    const messagePromise = firstValueFrom(
      service.streamFor(createUser(['code.order.create'])).pipe(
        filter((message) => message.data.type === 'code.order.created'),
        take(1)
      )
    );

    service.publish({
      type: 'code.order.created',
      module: 'code',
      entity: 'order',
      action: 'created',
      resourceId: 'order-1'
    });

    await expect(messagePromise).resolves.toMatchObject({
      data: {
        type: 'code.order.created',
        module: 'code',
        entity: 'order',
        action: 'created',
        resourceId: 'order-1'
      }
    });
  });
});
