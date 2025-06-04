import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryTransferDto } from '../dto/create-inventory-transfer.dto';
import { InventoryHelperService } from './inventory-helper.service';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, CACHE_KEYS } from '../../../constants/cache-keys';

@Injectable()
export class InventoryTransferService {
  constructor(
    private prisma: PrismaService,
    private inventoryHelper: InventoryHelperService,
    private cacheService: CacheService,
  ) {}

  async create(consumerId: number, userId: number, dto: CreateInventoryTransferDto) {
    // Validate source branch
    const sourceBranch = await this.prisma.branch.findFirst({
      where: { 
        id: dto.source_branch_id, 
        consumer_id: consumerId 
      },
    });
    if (!sourceBranch) {
      throw new NotFoundException('Source branch not found');
    }

    // Validate destination branch
    const destinationBranch = await this.prisma.branch.findFirst({
      where: { 
        id: dto.destination_branch_id, 
        consumer_id: consumerId 
      },
    });
    if (!destinationBranch) {
      throw new NotFoundException('Destination branch not found');
    }

    // Check if source and destination are the same
    if (dto.source_branch_id === dto.destination_branch_id) {
      throw new BadRequestException('Source and destination branches cannot be the same');
    }

    // Verify all batches exist and have sufficient quantity
    for (const item of dto.items) {
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id: item.batch_id,
          branch_id: dto.source_branch_id,
          variant: {
            product: { consumer_id: consumerId },
          },
        },
      });

      if (!batch) {
        const branchName = this.inventoryHelper.getLocationName(sourceBranch);
        throw new NotFoundException(`Batch with ID ${item.batch_id} not found in ${branchName}`);
      }

      if (batch.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient quantity in batch ${item.batch_id}. Available: ${batch.quantity}, Requested: ${item.quantity}`
        );
      }
    }    // Create transfer with items
    const transfer = await this.prisma.inventoryTransfer.create({
      data: {
        source_branch_id: dto.source_branch_id,
        destination_branch_id: dto.destination_branch_id,
        notes: dto.notes,
        created_by_user_id: userId,
        items: {
          create: dto.items.map(item => ({
            batch_id: item.batch_id,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        source_branch: { select: { id: true, name: true, is_warehouse: true } },
        destination_branch: { select: { id: true, name: true, is_warehouse: true } },
        created_by_user: { select: { id: true, name: true } },
        items: {
          include: {
            batch: {
              include: {
                variant: {
                  include: {
                    product: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Invalidate related caches after successful creation
    await this.invalidateInventoryTransferCaches(consumerId, dto.source_branch_id, dto.destination_branch_id);

    // Invalidate inventory summaries, batch caches, and product caches
    const inventorySummaryPattern = `${CACHE_KEYS.INVENTORY.SUMMARY}:${consumerId}:*`;
    const batchCachePattern = `${CACHE_KEYS.INVENTORY_BATCH.LIST}:${consumerId}:*`;
    const productCachePattern = `${CACHE_KEYS.PRODUCT.DETAIL}:*`;
    await Promise.all([
      this.cacheService.delPattern(inventorySummaryPattern),
      this.cacheService.delPattern(batchCachePattern),
      this.cacheService.delPattern(productCachePattern),
    ]);

    return transfer;
  }
  async findAll(consumerId: number, options: {
    page?: number;
    limit?: number;
    status?: string;
    branch_id?: number;
  } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const cacheKey = generateCacheKey.inventoryTransferList(consumerId, page, limit, options.status, options.branch_id);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      const skip = (page - 1) * limit;

      const where: any = {
        OR: [
          {
            source_branch: {
              consumer_id: consumerId,
            },
          },
          {
            destination_branch: {
              consumer_id: consumerId,
            },
          },
        ],
      };

      if (options.status) {
        where.status = options.status;
      }

      if (options.branch_id !== undefined) {
        where.OR = [
          { source_branch_id: options.branch_id },
          { destination_branch_id: options.branch_id },
        ];
      }

      const [transfers, total] = await Promise.all([
        this.prisma.inventoryTransfer.findMany({
          where,
          include: {
            source_branch: { select: { id: true, name: true, is_warehouse: true } },
            destination_branch: { select: { id: true, name: true, is_warehouse: true } },
            created_by_user: { select: { id: true, name: true } },
            items: {
              include: {
                batch: {
                  include: {
                    variant: {
                      include: {
                        product: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.inventoryTransfer.count({ where }),
      ]);

      return {
        data: transfers,
        meta: {
          current_page: page,
          per_page: limit,
          total,
          last_page: Math.ceil(total / limit),
        },
      };
    });
  }
  async findOne(id: number, consumerId: number) {
    const cacheKey = generateCacheKey.inventoryTransferDetail(id, consumerId);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      const transfer = await this.prisma.inventoryTransfer.findFirst({
        where: {
          id,
          OR: [
            {
              source_branch: {
                consumer_id: consumerId,
              },
            },
            {
              destination_branch: {
                consumer_id: consumerId,
              },
            },
          ],
        },
        include: {
          source_branch: { select: { id: true, name: true, is_warehouse: true } },
          destination_branch: { select: { id: true, name: true, is_warehouse: true } },
          created_by_user: { select: { id: true, name: true } },
          items: {
            include: {
              batch: {
                include: {
                  variant: {
                    include: {
                      product: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!transfer) {
        throw new NotFoundException('Transfer not found');
      }

      return transfer;
    });
  }

  async completeTransfer(id: number, consumerId: number) {
    // Get transfer with items included
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: {
        id,
        OR: [
          {
            source_branch: {
              consumer_id: consumerId,
            },
          },
          {
            destination_branch: {
              consumer_id: consumerId,
            },
          },
        ],
      },
      include: {
        source_branch: { select: { id: true, name: true, is_warehouse: true } },
        destination_branch: { select: { id: true, name: true, is_warehouse: true } },
        created_by_user: { select: { id: true, name: true } },
        items: {
          include: {
            batch: {
              include: {
                variant: {
                  include: {
                    product: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not in pending status');
    }

    // Start transaction to move inventory
    const result = await this.prisma.$transaction(async (prisma) => {
      // Update each batch
      for (const item of transfer.items) {
        // Reduce quantity from source batch
        await prisma.inventoryBatch.update({
          where: { id: item.batch_id },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });

        // Create or update batch in destination
        const existingDestinationBatch = await prisma.inventoryBatch.findFirst({
          where: {
            variant_id: item.batch.variant_id,
            branch_id: transfer.destination_branch_id,
            batch_number: item.batch.batch_number,
            cost_price: item.batch.cost_price,
            expiry_date: item.batch.expiry_date,
            vendor_id: item.batch.vendor_id,
          },
        });

        if (existingDestinationBatch) {
          // Update existing batch
          await prisma.inventoryBatch.update({
            where: { id: existingDestinationBatch.id },
            data: {
              quantity: {
                increment: item.quantity,
              },
            },
          });
        } else {
          // Create new batch in destination
          await prisma.inventoryBatch.create({
            data: {
              variant_id: item.batch.variant_id,
              branch_id: transfer.destination_branch_id,
              batch_number: item.batch.batch_number,
              quantity: item.quantity,
              cost_price: item.batch.cost_price,
              vendor_id: item.batch.vendor_id,
              expiry_date: item.batch.expiry_date,
            },
          });
        }
      }

      // Update transfer status
      return await prisma.inventoryTransfer.update({
        where: { id },
        data: {
          status: 'completed',
          completed_date: new Date(),
        },
        include: {
          source_branch: { select: { id: true, name: true, is_warehouse: true } },
          destination_branch: { select: { id: true, name: true, is_warehouse: true } },
          created_by_user: { select: { id: true, name: true } },
          items: {
            include: {
              batch: {
                include: {
                  variant: {
                    include: {
                      product: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });    });

    // Invalidate related caches after successful completion
    await this.invalidateInventoryTransferCaches(consumerId, transfer.source_branch_id, transfer.destination_branch_id);

    return result;
  }

  async cancelTransfer(id: number, consumerId: number) {
    const transfer = await this.findOne(id, consumerId);

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not in pending status');
    }    const updatedTransfer = await this.prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    });

    // Invalidate related caches after cancellation
    await this.invalidateInventoryTransferCaches(consumerId, transfer.source_branch_id, transfer.destination_branch_id);

    return updatedTransfer;
  }
  // Cache invalidation helper methods
  private async invalidateInventoryTransferCaches(consumerId: number, sourceBranchId?: number, destinationBranchId?: number) {
    try {
      const patterns = [
        // Invalidate all transfer lists for this consumer with a pattern
        `${CACHE_KEYS.INVENTORY_TRANSFER.LIST}:${consumerId}:*`,
      ];
      
      // Find affected batch ids and variant ids to invalidate related caches
      let affectedBatches: { id: number; variant_id: number }[] = [];
      
      // If we're completing or canceling a transfer (both branch IDs provided)
      if (sourceBranchId && destinationBranchId) {
        // Get all transfer items to identify affected batches and variants
        const transferItems = await this.prisma.inventoryTransferItem.findMany({
          where: {
            transfer: {
              OR: [
                { source_branch_id: sourceBranchId },
                { source_branch_id: destinationBranchId },
                { destination_branch_id: sourceBranchId },
                { destination_branch_id: destinationBranchId },
              ],
            },
          },
          select: {
            batch_id: true,
            batch: {
              select: {
                id: true,
                variant_id: true,
                variant: {
                  select: {
                    product_id: true
                  }
                }
              }
            }
          }
        });
        
        // Collect unique batch and variant ids
        affectedBatches = transferItems.map(item => ({
          id: item.batch.id,
          variant_id: item.batch.variant_id
        }));
        
        // Add batch and inventory specific patterns
        if (affectedBatches.length > 0) {
          // Invalidate batch caches for both branches
          patterns.push(`${CACHE_KEYS.INVENTORY_BATCH.BY_BRANCH}:*${sourceBranchId}*`);
          patterns.push(`${CACHE_KEYS.INVENTORY_BATCH.BY_BRANCH}:*${destinationBranchId}*`);
          
          // Get unique variants and products
          const variantIds = [...new Set(affectedBatches.map(b => b.variant_id))];
          const productIds = [...new Set(
            transferItems.filter(i => i.batch.variant?.product_id)
              .map(i => i.batch.variant.product_id)
          )];
          
          // Invalidate variant-specific caches
          for (const variantId of variantIds) {
            patterns.push(`${CACHE_KEYS.INVENTORY.VARIANT_STOCK}:${variantId}:*`);
            patterns.push(`${CACHE_KEYS.INVENTORY.MOVEMENT_HISTORY}:${variantId}:*`);
            patterns.push(`${CACHE_KEYS.INVENTORY_BATCH.BY_VARIANT}:*${variantId}*`);
            patterns.push(`${CACHE_KEYS.PRODUCT_VARIANT.DETAIL}:${variantId}`);
          }
          
          // Invalidate product-specific caches
          for (const productId of productIds) {
            patterns.push(`${CACHE_KEYS.PRODUCT.DETAIL}:${productId}:*`);
          }
        }
      }
      
      // Always invalidate these caches when transfers are affected
      patterns.push(`${CACHE_KEYS.INVENTORY.SUMMARY}:${consumerId}:*`);
      patterns.push(`${CACHE_KEYS.INVENTORY.STOCK_BY_VARIANT}:${consumerId}:*`);
      patterns.push(`${CACHE_KEYS.INVENTORY.LOW_STOCK}:${consumerId}:*`);
      patterns.push(`${CACHE_KEYS.INVENTORY_BATCH.LIST}:${consumerId}:*`);
      
      // If specific branches are involved, invalidate their caches
      if (sourceBranchId) {
        patterns.push(`${CACHE_KEYS.INVENTORY.SUMMARY}:${consumerId}:${sourceBranchId}`);
        patterns.push(`${CACHE_KEYS.INVENTORY.STOCK_BY_VARIANT}:${consumerId}:*:${sourceBranchId}*`);
      }
      
      if (destinationBranchId) {
        patterns.push(`${CACHE_KEYS.INVENTORY.SUMMARY}:${consumerId}:${destinationBranchId}`);
        patterns.push(`${CACHE_KEYS.INVENTORY.STOCK_BY_VARIANT}:${consumerId}:*:${destinationBranchId}*`);
      }
      
      // Delete all patterns in parallel
      await Promise.all(patterns.map(pattern => this.cacheService.delPattern(pattern)));
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}