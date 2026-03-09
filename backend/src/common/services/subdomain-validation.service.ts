import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from './cache.service';
import { SubdomainUtilService } from './subdomain-util.service';
import * as dayjs from 'dayjs';

export interface SubdomainValidationResult {
  exists: boolean;
  consumerId?: number;
  isActive?: boolean;
  message?: string;
}

@Injectable()
export class SubdomainValidationService {
  private readonly logger = new Logger(SubdomainValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly subdomainUtil: SubdomainUtilService,
  ) {}

  /**
   * Validate if a subdomain exists and is active
   * This is called BEFORE authentication to check tenant validity
   * Results are cached for performance
   */
  async validateSubdomain(
    subdomain: string,
  ): Promise<SubdomainValidationResult> {
    if (!subdomain || subdomain.trim() === '') {
      return {
        exists: false,
        message: 'Subdomain is required',
      };
    }

    const normalizedSubdomain = subdomain.toLowerCase().trim();

    try {
        
          
            const consumer = await this.prisma.consumer.findUnique({
              where: { subdomain: normalizedSubdomain },
              select: {
                id: true,
                subdomain: true,
                billing_logs: {
                  where: {
                    billing_date: {
                      gte: dayjs().subtract(1, 'month').startOf('day').toDate(),
                      lte: dayjs().endOf('day').toDate(),
                    },
                  },
                  select: { id: true },
                  take: 1,
                  orderBy: { billing_date: 'desc' },
                },
              },
            });

            if (!consumer) {
              return {
                exists: false,
                message: 'Subdomain not found',
              };
            }

            const isActive = consumer.billing_logs.length > 0;

            if (!isActive) {
              return {
                exists: true,
                consumerId: consumer.id,
                isActive: false,
                message: 'Subscription expired or billing failed',
              };
            }

            return {
              exists: true,
              consumerId: consumer.id,
              isActive: true,
              message: 'Subdomain is valid',
            };
              
        
    } catch (error) {
      this.logger.error(
        `❌ Subdomain validation error '${normalizedSubdomain}': ${error.message}`,
      );
      return {
        exists: false,
        message: 'Error validating subdomain',
      };
    }
  }

  /**
   * Extract subdomain from a full URL or hostname
   * Delegates to SubdomainUtilService for consistency
   */
  extractSubdomainFromUrl(urlOrHost: string): string | null {
    return this.subdomainUtil.extractSubdomainFromUrl(urlOrHost);
  }
}
