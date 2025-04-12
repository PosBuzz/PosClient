import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<Role[]>('roles', context.getHandler()) ||
      this.reflector.get<Role[]>('roles', context.getClass());

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Roles are not specified');
    }

    // Retrieve the current user from the request (assuming user is attached via a previous guard)
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Assuming user object contains the role (e.g., from JWT payload)

    console.log(user);
    

    // Check if the user's role is in the list of required roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
