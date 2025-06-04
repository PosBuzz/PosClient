// Example of how we could use NestJS built-in caching

import { Injectable, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductServiceBuiltIn {
  constructor(private prisma: PrismaService) {}

  // Simple caching with auto-generated key
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600) // 1 hour
  async findAllProducts() {
    return this.prisma.product.findMany();
  }

  // Custom cache key
  @UseInterceptors(CacheInterceptor)
  @CacheKey('product-details')
  @CacheTTL(1800) // 30 minutes
  async findOneProduct(id: number) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  // Problem: How to handle consumer-specific data?
  // ❌ This doesn't work well for multi-tenant apps
  @UseInterceptors(CacheInterceptor)
  async findProductsByConsumer(consumerId: number) {
    // Cache key would be auto-generated based on method name + params
    // But invalidation becomes difficult
    return this.prisma.product.findMany({
      where: { consumer_id: consumerId }
    });
  }

  // Problem: How to handle pagination with different parameters?
  // ❌ Each combination creates a separate cache entry
  @UseInterceptors(CacheInterceptor)
  async findProductsPaginated(page: number, limit: number, search?: string) {
    // Cache keys: method_name_1_10, method_name_1_20, method_name_2_10, etc.
    // Hard to invalidate related caches
    const skip = (page - 1) * limit;
    return this.prisma.product.findMany({
      skip,
      take: limit,
      where: search ? {
        name: { contains: search, mode: 'insensitive' }
      } : {}
    });
  }
}

// Manual approach allows for:
@Injectable()
export class ProductServiceManual {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService
  ) {}

  async findProductsByConsumer(
    consumerId: number, 
    options: { page?: number; limit?: number; search?: string }
  ) {
    // ✅ Structured, predictable cache key
    const cacheKey = `products:consumer:${consumerId}:${options.page || 1}:${options.limit || 10}:${options.search || 'all'}`;
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      // Complex query logic
      return this.prisma.product.findMany({
        where: {
          consumer_id: consumerId,
          ...(options.search && {
            name: { contains: options.search, mode: 'insensitive' }
          })
        },
        skip: ((options.page || 1) - 1) * (options.limit || 10),
        take: options.limit || 10
      });
    });
  }

  async createProduct(consumerId: number, data: any) {
    const result = await this.prisma.product.create({ data });
    
    // ✅ Easy to invalidate related caches
    await this.invalidateProductCaches(consumerId);
    
    return result;
  }

  private async invalidateProductCaches(consumerId: number) {
    // ✅ Invalidate all product list variations for this consumer
    await this.cacheService.del(`products:consumer:${consumerId}:*`);
  }
}
