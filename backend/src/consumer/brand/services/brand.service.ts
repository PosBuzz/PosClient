import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';

@Injectable()
export class BrandService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createBrandDto: CreateBrandDto, consumerId: number) {
    const result = await this.prismaService.brand.create({
      data: {
        name: createBrandDto.name,
        logo: createBrandDto.logo,
        website: createBrandDto.website,
        consumer_id: consumerId,
      },
    });

    // Invalidate brand caches
    await this.invalidateBrandCaches(consumerId);

    return result;
  }

  async findAll(consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.brandList(consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return this.prismaService.brand.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    });
  }

  async findOne(id: number, consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.brandDetail(id, consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      const brand = await this.prismaService.brand.findFirst({
        where: { 
          id,
          consumer_id: consumerId
        },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${id} not found`);
      }

      return brand;
    });
  }

  async update(id: number, updateBrandDto: UpdateBrandDto, consumerId: number) {
    // First check if the brand exists and belongs to this consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.brand.update({
      where: { id },
      data: {
        name: updateBrandDto.name,
        website: updateBrandDto.website,
        logo: updateBrandDto.logo,
      },
    });    // Invalidate brand caches
    await this.invalidateBrandCaches(consumerId);

    return result;
  }

  async remove(id: number, consumerId: number) {
    // First check if the brand exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.brand.delete({
      where: { id },
    });
    
    // Invalidate brand caches
    await this.invalidateBrandCaches(consumerId);
    
    return { success: true };
  }
  // Cache invalidation helper method
  private async invalidateBrandCaches(consumerId: number) {
    try {
      // Invalidate all brand-related caches for this consumer
      await this.cacheService.delPattern(generateCachePatterns.allBrands(consumerId));
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Cache invalidation error:', error);
    }
  }
}
