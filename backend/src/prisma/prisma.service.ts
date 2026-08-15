import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { errorMessage } from '../common/utils/error.util';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'minimal',
    });

    // @ts-expect-error - Prisma event types are not exposed for $on
    this.$on('error', (e: any) => {
      this.logger.error(`🔴 Database Error: ${e.message}`, e.target);
    });

    // @ts-expect-error - Prisma event types are not exposed for $on
    this.$on('warn', (e: any) => {
      this.logger.warn(`⚠️ Database Warning: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected');
    } catch (error) {
      this.logger.error(
        `❌ Database connection failed: ${errorMessage(error)}`,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('✅ Database disconnected');
    } catch (error) {
      this.logger.warn(`⚠️ Error disconnecting: ${errorMessage(error)}`);
    }
  }

  /**
   * Get database connection pool metrics
   */
  async getPoolMetrics() {
    try {
      // Get database statistics
      const stats = await this.$queryRaw<
        Array<{
          numbackends: number;
          xact_commit: bigint;
          xact_rollback: bigint;
          blks_read: bigint;
          blks_hit: bigint;
          tup_returned: bigint;
          tup_fetched: bigint;
          tup_inserted: bigint;
          tup_updated: bigint;
          tup_deleted: bigint;
        }>
      >`
        SELECT 
          numbackends,
          xact_commit,
          xact_rollback,
          blks_read,
          blks_hit,
          tup_returned,
          tup_fetched,
          tup_inserted,
          tup_updated,
          tup_deleted
        FROM pg_stat_database
        WHERE datname = current_database()
      `;

      // Get active connections
      const connections = await this.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      // Get long-running queries
      const longQueries = await this.$queryRaw<
        Array<{
          pid: number;
          duration: string;
          query: string;
          state: string;
        }>
      >`
        SELECT 
          pid,
          now() - query_start as duration,
          query,
          state
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query NOT ILIKE '%pg_stat_activity%'
          AND now() - query_start > interval '5 seconds'
        ORDER BY query_start
      `;

      const statsData = stats[0];

      return {
        stats: {
          numbackends: statsData.numbackends,
          xact_commit: Number(statsData.xact_commit),
          xact_rollback: Number(statsData.xact_rollback),
          blks_read: Number(statsData.blks_read),
          blks_hit: Number(statsData.blks_hit),
          tup_returned: Number(statsData.tup_returned),
          tup_fetched: Number(statsData.tup_fetched),
          tup_inserted: Number(statsData.tup_inserted),
          tup_updated: Number(statsData.tup_updated),
          tup_deleted: Number(statsData.tup_deleted),
        },
        activeConnections: Number(connections[0]?.count || 0),
        longRunningQueries: longQueries,
      };
    } catch (error) {
      this.logger.error(`Failed to get pool metrics: ${errorMessage(error)}`);
      return null;
    }
  }

  /**
   * Health check for database
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
    connections?: number;
  }> {
    const startTime = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;

      // Get connection count
      const connections = await this.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      const connectionCount = Number(connections[0]?.count || 0);

      // Warn if connections are high
      if (connectionCount > 80) {
        this.logger.warn(
          `⚠️ High number of database connections: ${connectionCount}`,
        );
      }

      return {
        healthy: true,
        latency,
        connections: connectionCount,
      };
    } catch (error) {
      this.logger.error(
        `❌ Database health check failed: ${errorMessage(error)}`,
      );
      return {
        healthy: false,
        error: errorMessage(error),
      };
    }
  }
}
