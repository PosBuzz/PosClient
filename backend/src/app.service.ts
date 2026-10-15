import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisCacheService } from 'nest-cache-redis';
import { errorMessage } from './common/utils/error.util';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    // Absent when REDIS_ENABLED is off
    @Optional() private readonly cache?: RedisCacheService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'unknown',
          latency: 0,
          connections: 0,
        },
        redis: {
          status: 'unknown',
        },
      },
    };

    // Check database
    try {
      const dbHealth = await this.prisma.healthCheck();
      if (dbHealth.healthy) {
        health.services.database = {
          status: 'healthy',
          latency: dbHealth.latency || 0,
          connections: dbHealth.connections || 0,
        };
      } else {
        health.services.database = {
          status: `unhealthy: ${dbHealth.error}`,
          latency: 0,
          connections: 0,
        };
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.database = {
        status: `unhealthy: ${errorMessage(error)}`,
        latency: 0,
        connections: 0,
      };
      health.status = 'degraded';
    }

    // Check Redis (optional infrastructure)
    if (!this.cache) {
      health.services.redis = { status: 'disabled' };
      return health;
    }
    try {
      await this.cache.set('health_check', { timestamp: Date.now() }, 10);
      const result = await this.cache.get('health_check');
      if (result) {
        health.services.redis = { status: 'healthy' };
      } else {
        health.services.redis = { status: 'unhealthy: cannot read/write' };
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.redis = { status: `unhealthy: ${errorMessage(error)}` };
      health.status = 'degraded';
    }

    return health;
  }

  async getMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      database: null as any,
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    try {
      const dbMetrics = await this.prisma.getPoolMetrics();
      metrics.database = dbMetrics;
    } catch (error) {
      metrics.database = {
        error: errorMessage(error),
      };
    }

    return metrics;
  }
}
