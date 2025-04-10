import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminAuthGuard extends PassportAuthGuard('jwt-admin') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}