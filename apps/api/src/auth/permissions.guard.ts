import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from './auth.types';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './auth.decorators';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

const LEGACY_PERMISSION_ALIASES: Record<string, string[]> = {
  'code.order.view': ['code.order.create', 'code.order.deliver'],
  'code.order.create': ['code.order.deliver'],
  'code.after_sale.view': ['code.after_sale.manage'],
  'code.delivery_template.manage': ['message_template.manage'],
  'source_platform.view': [
    'customer.view',
    'customer.create',
    'apple.order.view',
    'apple.order.create',
    'code.order.view',
    'code.order.create',
    'code.order.deliver'
  ]
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Permission check requires authenticated user');
    }

    if (user.roles.includes('admin')) {
      return true;
    }

    const permissionSet = new Set(user.permissions);
    const allowed = requiredPermissions.every((permission) =>
      this.hasPermission(permissionSet, permission)
    );

    if (!allowed) {
      throw new ForbiddenException('Permission denied');
    }

    return true;
  }

  private hasPermission(permissionSet: Set<string>, permission: string) {
    if (permissionSet.has(permission)) {
      return true;
    }

    return LEGACY_PERMISSION_ALIASES[permission]?.some((legacy) => permissionSet.has(legacy));
  }
}
