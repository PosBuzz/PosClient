import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Enforces the @Throttle limits on login routes. Requests are tracked per client
 * IP *and* login email: the API may sit behind a proxy (no `trust proxy`), where
 * every client shares one IP and an IP-only key would lock out all users at once.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    return `${req.ip}:${email}`;
  }
}
