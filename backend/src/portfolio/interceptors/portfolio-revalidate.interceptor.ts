import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { PortfolioRevalidationService } from '../services/portfolio-revalidation.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Publishes the marketing site after any successful content mutation. Lead
 * routes are skipped — moving a lead through the sales pipeline changes nothing
 * the public site renders.
 */
@Injectable()
export class PortfolioRevalidateInterceptor implements NestInterceptor {
  constructor(private readonly revalidation: PortfolioRevalidationService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const isContentMutation =
      !SAFE_METHODS.has(request.method) && !request.path.includes('/leads');

    if (!isContentMutation) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Fire and forget: the response must not wait on the site rebuild.
        void this.revalidation.trigger();
      }),
    );
  }
}
