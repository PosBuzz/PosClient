import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';

@Injectable()
export class TagService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}
  async create(createTagDto: CreateTagDto, consumerId: number) {
    const result = await this.prismaService.tag.create({      data: {
        name: createTagDto.name,
        consumer_id: consumerId,
      },
    });

    // Invalidate only tag caches
    await this.cacheService.invalidateEntityCaches(consumerId, 'tags');

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
    await this.findOne(id, consumerId);    const result = await this.prismaService.tag.update({
      where: { id },
      data: { name: updateTagDto.name },
    });

    // Invalidate only tag caches
    await this.cacheService.invalidateEntityCaches(consumerId, 'tags');

    return result;
  }
  async remove(id: number, consumerId: number) {
    // First check if the tag exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.tag.delete({
      where: { id },
    });
    
    // Invalidate only tag caches
    await this.cacheService.invalidateEntityCaches(consumerId, 'tags');
    
    return { success: true };
  }
}