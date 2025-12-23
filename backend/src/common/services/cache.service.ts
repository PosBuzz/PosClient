import { Injectable } from '@nestjs/common';
import { RedisCacheService } from 'nest-redis-cache';
import { ConfigService } from '../../config/config.service';
import { generateCachePatterns } from '../../constants/cache-keys';

@Injectable()
export class CacheService {
  private keyPrefix: string;

  constructor(
    private configService: ConfigService,
    private readonly cache: RedisCacheService,
  ) {
    this.keyPrefix = `${this.configService.redisPrefix}:`;
  }

  // ==========================================
  // BASIC CACHE OPERATIONS (Pass-through)
  // ==========================================

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  /**
   * Set cached value with TTL (in seconds)
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.cache.set(key, value, ttl);
  }

  /**
   * Get from cache or compute and cache
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param ttl - Time to live in seconds (optional)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    return this.cache.getOrSet(key, factory, ttl);
  }

  /**
   * Delete single key
   */
  async del(key: string): Promise<void> {
    await this.cache.delKey(key);
  }

  /**
   * Delete multiple keys
   */
  async delKeys(keys: string[]): Promise<void> {
    await this.cache.delKeys(keys);
  }

  /**
   * Delete keys by pattern using SCAN
   */
  async delPattern(pattern: string): Promise<void> {
    await this.cache.delPattern(pattern);
  }

  /**
   * Delete multiple patterns
   */
  async delPatterns(patterns: string[]): Promise<void> {
    await this.cache.delPatterns(patterns);
  }

   /**
   * Get multiple keys by pattern (for debugging/monitoring)
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    return await this.cache.getKeysByPattern(pattern);
  }

  /**
   * Clear all cache (FLUSHDB)
   */
  async reset(): Promise<void> {
    return await this.cache.reset();
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return await this.cache.getStats();
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
  }

  /**
   * Invalidate global consumer-related caches (subdomain validation, consumer details, etc.)
   * This is used when consumer data changes (create, update, delete) in admin
   */
  async invalidateGlobalConsumerCaches(): Promise<void> {
    const pattern = generateCachePatterns.allConsumerRelated();
    await this.delPattern(pattern);
  }

  /**
   * Invalidate all plan-related caches
   */
  async invalidateGlobalPlanCaches(): Promise<void> {
    const pattern = generateCachePatterns.allPlanRelated();
    await this.delPattern(pattern);
  }

  /**
   * Invalidate ALL admin-related caches (consumers, plans, admin CRUD)
   */
  async invalidateAllAdminCaches(): Promise<void> {
    const patterns = generateCachePatterns.allAdminRelated();
    await this.delPatterns(patterns);
  }

  /**
   * Invalidate ALL inventory-related caches for a specific consumer
   * This is used for any inventory operation to ensure complete cache consistency
   */
  async invalidateAllInventoryCaches(consumerId: number): Promise<void> {
    const patterns = generateCachePatterns.allInventoryRelated(consumerId);
    await this.delPatterns(patterns);
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
        return;
      case 'roles':
        await this.delPatterns([
          generateCachePatterns.allUsers(consumerId),
          generateCachePatterns.allRoles(consumerId),
        ]);
        return;
    }

    await this.delPattern(pattern);
  }
}
