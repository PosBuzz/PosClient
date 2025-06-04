import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryBatchDto } from '../dto/create-inventory-batch.dto';
import { UpdateInventoryBatchDto } from '../dto/update-inventory-batch.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey } from '../../../constants/cache-keys';

@Injectable()
export class InventoryBatchService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}
  async create(consumerId: number, dto: CreateInventoryBatchDto) {
    // Verify variant belongs to consumer
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: dto.variant_id,
        product: { consumer_id: consumerId },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Verify branch belongs to consumer (if provided)
    if (dto.branch_id) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branch_id,
          consumer_id: consumerId,
        },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    }

    // Check if batch number already exists for this variant
    const existingBatch = await this.prisma.inventoryBatch.findFirst({
      where: {
        batch_number: dto.batch_number,
        variant_id: dto.variant_id,
      },
    });

    if (existingBatch) {
      throw new BadRequestException('Batch number already exists for this variant');
    }

    const batch = await this.prisma.inventoryBatch.create({
      data: {
        variant_id: dto.variant_id,
        branch_id: dto.branch_id,
        batch_number: dto.batch_number,
        quantity: dto.quantity,
        cost_price: dto.cost_price,
        vendor_id: dto.vendor_id,
        expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
      },
      include: {
        variant: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
        branch: {
          select: { id: true, name: true },
        },
        vendor: {
          select: { id: true, name: true },
        },
      },
    });    // Invalidate related caches
    await this.invalidateInventoryBatchCaches(consumerId, dto.variant_id, dto.branch_id);

    return batch;
  }  async findAll(consumerId: number, options: {
    page?: number;
    limit?: number;
    search?: string;
    branch_id?: number;
    variant_id?: number;
  } = {}) {
    const { page = 1, limit, search, branch_id, variant_id } = options;
    const cacheKey = generateCacheKey.inventoryBatchList(consumerId, page, limit, search, branch_id, variant_id);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      // Only apply pagination if limit is specified
      const skip = limit ? (page - 1) * limit : undefined;

      const whereClause: any = {
        variant: {
          product: {
            consumer_id: consumerId,
          },
        },
      };

      if (search) {
        whereClause.OR = [
          { batch_number: { contains: search, mode: 'insensitive' } },
          { variant: { name: { contains: search, mode: 'insensitive' } } },
          { variant: { product: { name: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      if (branch_id) {
        whereClause.branch_id = branch_id;
      }

      if (variant_id) {
        whereClause.variant_id = variant_id;
      }      const [batches, total] = await Promise.all([
        this.prisma.inventoryBatch.findMany({
          where: whereClause,
          include: {
            variant: {
              include: {
                product: {
                  select: { id: true, name: true },
                },
              },
            },
            branch: {
              select: { id: true, name: true },
            },
            vendor: {
              select: { id: true, name: true },
            },
          },
          skip,
          take: limit, // Will be undefined if no limit specified
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.inventoryBatch.count({ where: whereClause }),
      ]);

      return {
        data: batches,
        meta: {
          total,
          page,
          limit: limit || total, // Use total count if no limit specified
          totalPages: limit ? Math.ceil(total / limit) : 1,
        },
      };
    });
  }
  async findOne(id: number, consumerId: number) {
    const cacheKey = generateCacheKey.inventoryBatchDetail(id, consumerId);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id,
          variant: {
            product: {
              consumer_id: consumerId,
            },
          },
        },
        include: {
          variant: {
            include: {
              product: {
                select: { id: true, name: true },
              },
            },
          },
          branch: {
            select: { id: true, name: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException(`Inventory batch with ID ${id} not found`);
      }

      return batch;
    });
  }
  async update(id: number, consumerId: number, dto: UpdateInventoryBatchDto) {
    const batch = await this.findOne(id, consumerId);

    const updatedBatch = await this.prisma.inventoryBatch.update({
      where: { id },
      data: {
        cost_price: dto.cost_price,
        branch_id: dto.branch_id,
        vendor_id: dto.vendor_id,
        expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
      },
    });

    // Invalidate related caches
    await this.invalidateInventoryBatchCaches(consumerId, batch.variant_id, batch.branch_id);

    return updatedBatch;
  }

  async remove(id: number, consumerId: number) {
    const batch = await this.findOne(id, consumerId);

    await this.prisma.inventoryBatch.delete({
      where: { id },
    });

    // Invalidate related caches
    await this.invalidateInventoryBatchCaches(consumerId, batch.variant_id, batch.branch_id);

    return { success: true, message: 'Inventory batch deleted successfully' };
  }
  // Cache invalidation helper methods
  private async invalidateInventoryBatchCaches(consumerId: number, variantId?: number, branchId?: number) {
    const cacheKeysToInvalidate: string[] = [];

    // Invalidate batch list cache with different pagination options
    for (let page = 1; page <= 10; page++) {
      for (const limit of [10, 25, 50]) {
        cacheKeysToInvalidate.push(
          generateCacheKey.inventoryBatchList(consumerId, page, limit),
          generateCacheKey.inventoryBatchList(consumerId, page, limit, undefined, branchId, variantId),
        );
      }
    }    // Invalidate specific batch detail cache if we had the batch ID
    // This will be handled by the caller methods

    await Promise.all(
      cacheKeysToInvalidate.map(key => this.cacheService.del(key))
    );
  }
}