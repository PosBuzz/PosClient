import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly ttl: number;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.ttl = this.configService.cacheTtl;
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.cacheManager.get<T>(key);
      if (result !== null && result !== undefined) {
        this.logger.log(`✅ CACHE HIT: ${key}`);
        return result;
      } else {
        this.logger.log(`❌ CACHE MISS: ${key}`);
        return undefined;
      }
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set item in cache with TTL from config
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, (ttl || this.ttl) * 1000);
      this.logger.log(`💾 CACHE SET: ${key} (TTL: ${ttl || this.ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete item from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.log(`🗑️ CACHE DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Get or set pattern - if cache miss, execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    this.logger.log(`🔄 CACHE FACTORY: Executing factory for ${key}`);
    const result = await factory();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Clear all cache (if supported by the cache store)
   */
  async reset(): Promise<void> {
    try {
      // Check if reset method exists on the cache manager
      if ('reset' in this.cacheManager && typeof this.cacheManager.reset === 'function') {
        await (this.cacheManager as any).reset();
        this.logger.log('🧹 CACHE RESET: All cache cleared');
      } else {
        this.logger.warn('🧹 CACHE RESET: Reset method not supported by cache store');
      }
    } catch (error) {
      this.logger.error('Cache reset error:', error);
    }
  }

  /**
   * Delete multiple keys by pattern (if supported)
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // For Redis-based stores, you might have pattern deletion
      if ('del' in this.cacheManager) {
        await this.cacheManager.del(pattern);
        this.logger.log(`🗑️ CACHE DEL PATTERN: ${pattern}`);
      } else {
        this.logger.warn(`Pattern deletion not supported for: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache pattern delete error for ${pattern}:`, error);
    }
  }
}
