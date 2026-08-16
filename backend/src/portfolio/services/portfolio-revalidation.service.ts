import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';

const TIMEOUT_MS = 5000;

@Injectable()
export class PortfolioRevalidationService {
  private readonly logger = new Logger(PortfolioRevalidationService.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured() {
    return !!(
      this.config.portfolioRevalidateUrl &&
      this.config.portfolioRevalidateSecret
    );
  }

  /**
   * Tells the marketing site to drop its cached CMS content so an edit is live
   * immediately. Failures are logged and swallowed: a publish hook that is down
   * must never fail the admin's save — the site still refreshes on its own ISR
   * schedule.
   */
  async trigger(): Promise<{ revalidated: boolean; reason?: string }> {
    const url = this.config.portfolioRevalidateUrl;
    const secret = this.config.portfolioRevalidateSecret;

    if (!url || !secret) {
      this.logger.debug(
        'Portfolio publish hook is not configured; skipping revalidation',
      );
      return { revalidated: false, reason: 'not_configured' };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ source: 'admin-portfolio' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          `Portfolio revalidation responded with ${response.status}`,
        );
        return { revalidated: false, reason: `status_${response.status}` };
      }

      this.logger.log('Portfolio site revalidated');
      return { revalidated: true };
    } catch (error) {
      this.logger.warn(
        `Portfolio revalidation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { revalidated: false, reason: 'request_failed' };
    }
  }
}
