import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto, consumerId: number) {
    const result = await this.prismaService.category.create({
      data: {
        name: createCategoryDto.name,
        consumer_id: consumerId,
      },
    });

    // Invalidate category caches
    await this.invalidateCategoryCaches(consumerId);

    return result;
  }

  async findAll(consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.categoryList(consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return this.prismaService.category.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    });
  }

  async findOne(id: number, consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.categoryDetail(id, consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      const category = await this.prismaService.category.findFirst({
        where: { 
          id,
          consumer_id: consumerId
        },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      return category;
    });
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto, consumerId: number) {
    // First check if the category exists and belongs to this consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.category.update({
      where: { id },
      data: { name: updateCategoryDto.name },
    });    // Invalidate category caches
    await this.invalidateCategoryCaches(consumerId);

    return result;
  }

  async remove(id: number, consumerId: number) {
    // First check if the category exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.category.delete({
      where: { id },
    });
    
    // Invalidate category caches
    await this.invalidateCategoryCaches(consumerId);
    
    return { success: true };
  }
  // Cache invalidation helper method
  private async invalidateCategoryCaches(consumerId: number) {
    try {
      // Invalidate all category-related caches for this consumer
      await this.cacheService.delPattern(generateCachePatterns.allCategories(consumerId));
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Cache invalidation error:', error);
    }
  }
}