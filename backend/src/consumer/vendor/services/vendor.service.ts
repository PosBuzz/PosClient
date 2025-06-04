import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey } from '../../../constants/cache-keys';

@Injectable()
export class VendorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}
  async create(createVendorDto: CreateVendorDto, consumerId: number) {
    const result = await this.prismaService.vendor.create({
      data: {
        name: createVendorDto.name,
        contact: createVendorDto.contact,
        phone: createVendorDto.phone,
        email: createVendorDto.email,
        address: createVendorDto.address,
        consumer_id: consumerId,
      },
    });

    // Invalidate vendor caches
    await this.invalidateVendorCaches(consumerId);

    return result;
  }
  async findAll(consumerId: number) {
    const cacheKey = generateCacheKey.vendorList(consumerId);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      return this.prismaService.vendor.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    });
  }
  async findOne(id: number, consumerId: number) {
    const cacheKey = generateCacheKey.vendorDetail(id, consumerId);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      const vendor = await this.prismaService.vendor.findFirst({
        where: {
          id,
          consumer_id: consumerId,
        },
      });

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      return vendor;
    });
  }
  async update(
    id: number,
    updateVendorDto: UpdateVendorDto,
    consumerId: number,
  ) {
    // First check if the vendor exists and belongs to this consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.vendor.update({
      where: { id },
      data: {
        name: updateVendorDto.name,
        contact: updateVendorDto.contact,
        phone: updateVendorDto.phone,
        email: updateVendorDto.email,
        address: updateVendorDto.address,
      },
    });

    // Invalidate vendor caches
    await this.invalidateVendorCaches(consumerId);

    return result;
  }

  async remove(id: number, consumerId: number) {
    // First check if the vendor exists and belongs to this consumer
    await this.findOne(id, consumerId);

    // Check if vendor has any batches
    const batchCount = await this.prismaService.inventoryBatch.count({
      where: { vendor_id: id },
    });

    if (batchCount > 0) {
      // Don't delete, just return an error
      throw new Error(
        `Cannot delete vendor with ${batchCount} associated batches`,
      );
    }    await this.prismaService.vendor.delete({
      where: { id },
    });

    // Invalidate vendor caches
    await this.invalidateVendorCaches(consumerId);

    return { success: true };
  }

  private async invalidateVendorCaches(consumerId: number): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.del(generateCacheKey.vendorList(consumerId)),
        // Invalidate vendor details by pattern
        this.cacheService.del(`vendor:detail:*:${consumerId}`),
      ]);
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }
}
