import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey } from '../../../constants/cache-keys';

@Injectable()
export class TagService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}
  async create(createTagDto: CreateTagDto, consumerId: number) {
    const result = await this.prismaService.tag.create({
      data: {
        name: createTagDto.name,
        consumer_id: consumerId,
      },
    });

    // Invalidate tag caches
    await this.invalidateTagCaches(consumerId);

    return result;
  }
  async findAll(consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.tagList(consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return this.prismaService.tag.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    });
  }
  async findOne(id: number, consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.tagDetail(id, consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      const tag = await this.prismaService.tag.findFirst({
        where: { 
          id,
          consumer_id: consumerId
        },
      });

      if (!tag) {
        throw new NotFoundException(`Tag with ID ${id} not found`);
      }

      return tag;
    });
  }
  async update(id: number, updateTagDto: UpdateTagDto, consumerId: number) {
    // First check if the tag exists and belongs to this consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.tag.update({
      where: { id },
      data: { name: updateTagDto.name },
    });

    // Invalidate tag caches
    await this.invalidateTagCaches(consumerId, id);

    return result;
  }
  async remove(id: number, consumerId: number) {
    // First check if the tag exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.tag.delete({
      where: { id },
    });
    
    // Invalidate tag caches
    await this.invalidateTagCaches(consumerId, id);
    
    return { success: true };
  }

  // Cache invalidation helper method
  private async invalidateTagCaches(consumerId: number, tagId?: number) {
    try {
      // Invalidate tag list cache
      const listKey = generateCacheKey.tagList(consumerId);
      await this.cacheService.del(listKey);
      
      // If tagId is provided, invalidate specific tag cache
      if (tagId) {
        const detailKey = generateCacheKey.tagDetail(tagId, consumerId);
        await this.cacheService.del(detailKey);
      }
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Cache invalidation error:', error);
    }
  }
}