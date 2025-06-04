import { Injectable, Inject } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheManager.get<string>(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set item in cache with TTL from config
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const cacheValue = JSON.stringify(value);
      const cacheTtl = ttl || this.configService.cacheTtl;
      await this.cacheManager.set(key, cacheValue, cacheTtl * 1000); // Convert to milliseconds
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete item from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple items from cache using pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      // This is a simplified approach - in production you might want to use Redis SCAN
      // For now, this method signature is for future implementation
      console.warn(`Pattern deletion not implemented for pattern: ${pattern}`);
    } catch (error) {
      console.error(
        `Cache pattern delete error for pattern ${pattern}:`,
        error,
      );
    }
  }

  /**
   * Get or set pattern - if cache miss, execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Cache miss - execute function
      const result = await fetchFunction();

      // Cache the result
      await this.set(key, result, ttl);

      return result;
    } catch (error) {
      console.error(`Cache getOrSet error for key ${key}:`, error);
      // If caching fails, still return the result from the function
      return await fetchFunction();
    }
  }

  /**
   * Invalidate related cache keys
   */
  async invalidateRelated(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.del(key)));
    } catch (error) {
      console.error(`Cache invalidate related error:`, error);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined && value !== null;
    } catch (error) {
      console.error(`Cache exists check error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get TTL for debugging
   */
  getTtl(): number {
    return this.configService.cacheTtl;
  }
}
