import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';
import { PermissionsGuard } from './permissions.guard';

function createGuard(requiredPermissions: string[]) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return requiredPermissions;
      return undefined;
    })
  } as unknown as Reflector;

  return new PermissionsGuard(reflector);
}

function createContext(user: { roles: string[]; permissions: string[] }) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user
      })
    })
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows existing delivery roles to access manual code order creation', () => {
    const guard = createGuard(['code.order.create']);
    const context = createContext({
      roles: [],
      permissions: ['code.order.deliver']
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the new manual code order creation permission directly', () => {
    const guard = createGuard(['code.order.create']);
    const context = createContext({
      roles: [],
      permissions: ['code.order.create']
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows manual code order creators to access code order read pages', () => {
    const guard = createGuard(['code.order.view']);
    const context = createContext({
      roles: [],
      permissions: ['code.order.create']
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows code delivery users to access code order read pages', () => {
    const guard = createGuard(['code.order.view']);
    const context = createContext({
      roles: [],
      permissions: ['code.order.deliver']
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows order creators to read source platform options without platform management access', () => {
    const guard = createGuard(['source_platform.view']);
    const context = createContext({
      roles: [],
      permissions: ['code.order.create']
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects view-only users from manual code order creation', () => {
    const guard = createGuard(['code.order.create']);
    const context = createContext({
      roles: [],
      permissions: ['code.order.view']
    });

    expect(() => guard.canActivate(context)).toThrow(new ForbiddenException('Permission denied'));
  });

  it('allows existing after-sale managers to access after-sale read pages', () => {
    const guard = createGuard(['code.after_sale.view']);
    const context = createContext({
      roles: [],
      permissions: ['code.after_sale.manage']
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
