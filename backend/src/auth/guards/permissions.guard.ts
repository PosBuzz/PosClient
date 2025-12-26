import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminPermission } from '../enums/adminPermissions.enum';
import { ConsumerPermission } from '../enums/consumerPermissions.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.get<AdminPermission[] | ConsumerPermission[]>(
        'permissions',
        context.getHandler(),
      ) ||
      this.reflector.get<AdminPermission[] | ConsumerPermission[]>(
        'permissions',
        context.getClass(),
      );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    return requiredPermissions.every((perm) =>
      user?.permissions?.includes(perm),
    );
  }
}
