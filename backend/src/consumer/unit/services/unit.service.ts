import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey } from '../../../constants/cache-keys';

@Injectable()
export class UnitService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}
  async create(createUnitDto: CreateUnitDto, consumerId: number) {
    const result = await this.prismaService.unit.create({      data: {
        name: createUnitDto.name,
        consumer_id: consumerId,
      },
    });

    // Invalidate caches since units affect products and inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);

    return result;
  }
  async findAll(consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.unitList(consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return this.prismaService.unit.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    });
  }
  async findOne(id: number, consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.unitDetail(id, consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      const unit = await this.prismaService.unit.findFirst({
        where: { 
          id,
          consumer_id: consumerId
        },
      });

      if (!unit) {
        throw new NotFoundException(`Unit with ID ${id} not found`);
      }

      return unit;
    });
  }
  async update(id: number, updateUnitDto: UpdateUnitDto, consumerId: number) {
    // First check if the unit exists and belongs to this consumer
    await this.findOne(id, consumerId);    const result = await this.prismaService.unit.update({
      where: { id },
      data: { name: updateUnitDto.name },
    });

    // Invalidate caches since units affect products and inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);

    return result;
  }
  async remove(id: number, consumerId: number) {
    // First check if the unit exists and belongs to this consumer
    await this.findOne(id, consumerId);    await this.prismaService.unit.delete({
      where: { id },
    });
    
    // Invalidate caches since units affect products and inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);
    
    return { success: true };
  }
}