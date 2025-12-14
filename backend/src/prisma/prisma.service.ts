import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    // Log all queries in development (optional - can be removed in production)
    // @ts-ignore - Prisma event types
    this.$on('query', (e: any) => {
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
      }
      // Log slow queries even in production
      if (e.duration > 1000) {
        this.logger.warn(`🐌 SLOW QUERY (${e.duration}ms): ${e.query}`);
      }
    });

    // @ts-ignore - Prisma event types
    this.$on('error', (e: any) => {
      this.logger.error(`🔴 Database Error: ${e.message}`, e.target);
    });

    // @ts-ignore - Prisma event types
    this.$on('warn', (e: any) => {
      this.logger.warn(`⚠️ Database Warning: ${e.message}`);
    });

    // @ts-ignore - Prisma event types
    this.$on('info', (e: any) => {
      this.logger.log(`ℹ️ Database Info: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      this.logger.log('🔌 Connecting to database...');
      await this.$connect();
      this.logger.log('✅ Successfully connected to database');
      
      // Test the connection
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Database connection test successful');
    } catch (error) {
      this.logger.error(`❌ Failed to connect to database: ${error.message}`, error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('🔌 Disconnecting from database...');
      await this.$disconnect();
      this.logger.log('✅ Successfully disconnected from database');
    } catch (error) {
      this.logger.warn(`⚠️ Error during database disconnect: ${error.message}`);
    }
  }

  /**
   * Execute a query with timeout and error handling
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000,
    operationName: string = 'Database operation',
  ): Promise<T> {
    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        ),
      ]);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ ${operationName} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get database connection pool metrics
   */
  async getPoolMetrics() {
    try {
      // Get database statistics
      const stats = await this.$queryRaw<Array<{ 
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
      }>>`
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
      const longQueries = await this.$queryRaw<Array<{
        pid: number;
        duration: string;
        query: string;
        state: string;
      }>>`
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

      return {
        stats: stats[0],
        activeConnections: Number(connections[0]?.count || 0),
        longRunningQueries: longQueries,
      };
    } catch (error) {
      this.logger.error(`Failed to get pool metrics: ${error.message}`);
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
      this.logger.error(`❌ Database health check failed: ${error.message}`);
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}
