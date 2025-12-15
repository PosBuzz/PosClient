import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { generateCachePatterns } from '../../constants/cache-keys';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly ttl: number;
  private redisClient: Redis | null = null;
  private keyPrefix: string;

  constructor(private configService: ConfigService) {
    this.ttl = this.configService.cacheTtl;
    this.keyPrefix = `${this.configService.redisPrefix}:`;
  }

  async onModuleInit() {
    // Initialize Redis connection
    try {
      this.redisClient = new Redis({
        host: this.configService.redisHost,
        port: this.configService.redisPort,
        password: this.configService.redisPassword,
        keyPrefix: this.keyPrefix,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        reconnectOnError: (err) => {
          this.logger.error(`🔴 Redis connection error: ${err.message}`);
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true; // Reconnect on READONLY errors
          }
          return false;
        },
      });

      // Add error handler to prevent unhandled errors
      this.redisClient.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      this.redisClient.on('close', () => {
        this.logger.warn('Redis connection closed');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger.log('Redis reconnecting');
      });

      await this.redisClient.connect();
      this.logger.log(`✅ Redis connected: ${this.configService.redisHost}:${this.configService.redisPort}`);
    } catch (error) {
      this.logger.error(`❌ Redis connection failed: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      try {
        await this.redisClient.disconnect();
        this.logger.log('✅ Redis disconnected');
      } catch (error) {
        this.logger.warn(`Redis disconnect error: ${error.message}`);
      }
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.redisClient) {
      return undefined;
    }

    try {
      const result = await Promise.race([
        this.redisClient.get(key),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Redis GET timeout')), 8000)
        ),
      ]);

      if (result !== null) {
        return JSON.parse(result) as T;
      }
      return undefined;
    } catch (error) {
      this.logger.error(`Cache GET error (${key}): ${error.message}`);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.ttl;
      
      await Promise.race([
        this.redisClient.setex(key, expiry, serialized),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Redis SET timeout')), 8000)
        ),
      ]);
    } catch (error) {
      this.logger.error(`Cache SET error (${key}): ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Cache DEL error (${key}): ${error.message}`);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }

      const result = await factory();
      
      // Fire and forget cache set
      this.set(key, result, ttl).catch((err) => {
        this.logger.error(`Failed to cache ${key}: ${err.message}`);
      });
      
      return result;
    } catch (error) {
      this.logger.error(`getOrSet error (${key}): ${error.message}`);
      return await factory();
    }
  }

  /**
   * Clear all cache
   */
  async reset(): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn(`❌ Redis not available for RESET`);
      return;
    }

    try {
      await this.redisClient.flushdb();
      this.logger.log('🧹 CACHE RESET: All cache cleared');
    } catch (error) {
      this.logger.error('Cache reset error:', error);
    }
  }
  /**
   * Delete multiple keys by pattern using Redis SCAN
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn(`❌ Redis not available for DEL PATTERN: ${pattern}`);
      return;
    }

    try {
      let cursor = '0';
      let deletedCount = 0;

      // Add the prefix to the pattern since SCAN searches the actual Redis keys
      const fullPattern = `${this.keyPrefix}${pattern}`;

      do {
        const reply = await this.redisClient.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          '100',
        );
        cursor = reply[0];
        const keys = reply[1];

        if (keys.length > 0) {
          // Remove the keyPrefix from keys since our Redis client expects keys without prefix
          const keysWithoutPrefix = keys.map((key) =>
            key.replace(this.keyPrefix, ''),
          );

          // Use batch deletion for better performance
          if (keysWithoutPrefix.length === 1) {
            await this.redisClient.del(keysWithoutPrefix[0]);
          } else {
            await this.redisClient.del(...keysWithoutPrefix);
          }
          deletedCount += keysWithoutPrefix.length;
        }
      } while (cursor !== '0');

      this.logger.log(
        `🗑️ CACHE DEL PATTERN: ${pattern} -> ${fullPattern} (${deletedCount} keys deleted)`,
      );
    } catch (error) {
      this.logger.error(`Cache pattern delete error for ${pattern}:`, error);
    }
  }

  /**
   * Delete multiple patterns efficiently
   */
  async delPatterns(patterns: string[]): Promise<void> {
    await Promise.all(patterns.map((pattern) => this.delPattern(pattern)));
  }

  /**
   * Invalidate cache for a specific user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.delPattern(`user:${userId}:*`);
  }
  /**
   * Invalidate cache for a specific entity type
   */
  async invalidateEntityCache(
    entityType: string,
    entityId?: string,
  ): Promise<void> {
    const pattern = entityId
      ? `${entityType}:${entityId}:*`
      : `${entityType}:*`;
    await this.delPattern(pattern);
  }
  
  /**
   * Invalidate ALL cache for a specific consumer
   * This is the most efficient way since all keys start with consumerId
   */
  async invalidateConsumerCache(consumerId: number): Promise<void> {
    const pattern = generateCachePatterns.allForConsumer(consumerId);
    await this.delPattern(pattern);
    this.logger.log(`🧹 INVALIDATED ALL CACHE for consumer ${consumerId}`);
  }

  /**
   * Invalidate global consumer-related caches (subdomain validation, consumer details, etc.)
   * This is used when consumer data changes (create, update, delete) in admin
   */
  async invalidateGlobalConsumerCaches(): Promise<void> {
    const pattern = generateCachePatterns.allConsumerRelated();
    await this.delPattern(pattern);
    this.logger.log(`🧹 INVALIDATED ALL GLOBAL CONSUMER CACHES`);
  }

  /**
   * Invalidate all plan-related caches
   */
  async invalidateGlobalPlanCaches(): Promise<void> {
    const pattern = generateCachePatterns.allPlanRelated();
    await this.delPattern(pattern);
    this.logger.log(`🧹 INVALIDATED ALL GLOBAL PLAN CACHES`);
  }

  /**
   * Invalidate ALL admin-related caches (consumers, plans, admin CRUD)
   */
  async invalidateAllAdminCaches(): Promise<void> {
    const patterns = generateCachePatterns.allAdminRelated();
    await this.delPatterns(patterns);
    this.logger.log(`🧹 INVALIDATED ALL ADMIN CACHES`);
  }

  /**
   * Delete multiple specific keys (not patterns)
   * Useful for invalidating specific cache entries by exact keys
   */
  async delKeys(keys: string[]): Promise<void> {
    if (!this.redisClient || keys.length === 0) {
      this.logger.warn(`❌ Redis not available or no keys provided for DEL KEYS`);
      return;
    }

    try {
      if (keys.length === 1) {
        await this.redisClient.del(keys[0]);
      } else {
        await this.redisClient.del(...keys);
      }
      this.logger.log(`🗑️ CACHE DEL KEYS: ${keys.length} keys deleted`);
    } catch (error) {
      this.logger.error(`Cache delete keys error:`, error);
    }
  }

  /**
   * Invalidate ALL inventory-related caches for a specific consumer
   * This is used for any inventory operation to ensure complete cache consistency
   */
  async invalidateAllInventoryCaches(consumerId: number): Promise<void> {
    const patterns = generateCachePatterns.allInventoryRelated(consumerId);
    await this.delPatterns(patterns);
    this.logger.log(
      `🧹 INVALIDATED ALL INVENTORY CACHES for consumer ${consumerId}`,
    );
  }
  /**
   * Invalidate specific entity caches for a consumer
   * Use this for entities that don't directly affect inventory
   */
  async invalidateEntityCaches(
    consumerId: number,
    entityType:
      | 'units'
      | 'vendors'
      | 'categories'
      | 'brands'
      | 'tags'
      | 'users'
      | 'roles'
      | 'branches'
      | 'customers',
  ): Promise<void> {
    let pattern: string;

    switch (entityType) {
      case 'units':
        pattern = generateCachePatterns.allUnits(consumerId);
        break;
      case 'vendors':
        pattern = generateCachePatterns.allVendors(consumerId);
        break;
      case 'customers':
        pattern = generateCachePatterns.allCustomers(consumerId);
        break;
      case 'categories':
        pattern = generateCachePatterns.allCategories(consumerId);
        break;
      case 'brands':
        pattern = generateCachePatterns.allBrands(consumerId);
        break;
      case 'tags':
        pattern = generateCachePatterns.allTags(consumerId);
        break;
      case 'branches':
        pattern = generateCachePatterns.allBranches(consumerId);
        break;
      case 'users':
        await this.delPatterns([
          generateCachePatterns.allUsers(consumerId),
          generateCachePatterns.allRoles(consumerId),
        ]);
        this.logger.log(
          `🧹 INVALIDATED ${entityType.toUpperCase()} CACHES for consumer ${consumerId}`,
        );
        return;
      case 'roles':
        await this.delPatterns([
          generateCachePatterns.allUsers(consumerId),
          generateCachePatterns.allRoles(consumerId),
        ]);
        this.logger.log(
          `🧹 INVALIDATED ${entityType.toUpperCase()} CACHES for consumer ${consumerId}`,
        );
        return;
    }

    await this.delPattern(pattern);
    this.logger.log(
      `🧹 INVALIDATED ${entityType.toUpperCase()} CACHES for consumer ${consumerId}`,
    );
  }

  /**
   * Get multiple keys by pattern (for debugging/monitoring)
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    if (!this.redisClient) {
      this.logger.warn(
        `❌ Redis not available for KEYS BY PATTERN: ${pattern}`,
      );
      return [];
    }

    try {
      let cursor = '0';
      const allKeys: string[] = [];

      // Add the prefix to the pattern since SCAN searches the actual Redis keys
      const fullPattern = `${this.keyPrefix}${pattern}`;

      do {
        const reply = await this.redisClient.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          '100',
        );
        cursor = reply[0];
        const keys = reply[1];
        allKeys.push(...keys);
      } while (cursor !== '0');

      this.logger.log(
        `🔍 CACHE KEYS FOUND: ${allKeys.length} keys for pattern ${pattern} -> ${fullPattern}`,
      );
      return allKeys;
    } catch (error) {
      this.logger.error(`Cache pattern search error for ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.redisClient) {
      return { error: 'Redis not available' };
    }

    try {
      const info = await this.redisClient.info('memory');
      const keyCount = await this.redisClient.dbsize();

      return {
        keyCount,
        memory: info,
        connected: this.redisClient.status === 'ready',
        prefix: this.keyPrefix,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { error: error.message };
    }
  }
}
