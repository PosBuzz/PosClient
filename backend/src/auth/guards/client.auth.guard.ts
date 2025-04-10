import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class ClientAuthGuard extends PassportAuthGuard('jwt-client') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}