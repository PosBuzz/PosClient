import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryAdjustmentDto } from '../dto/inventory-adjustment.dto';

@Injectable()
export class InventoryAdjustmentService {
  constructor(private prisma: PrismaService) {}

  async create(consumerId: number, userId: number, dto: CreateInventoryAdjustmentDto) {
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

    // If batch_id is provided, verify it exists and belongs to the correct branch/variant
    if (dto.batch_id) {
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id: dto.batch_id,
          variant_id: dto.variant_id,
          branch_id: dto.branch_id,
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found for the specified variant and branch');
      }

      // For negative adjustments, check if sufficient quantity exists
      if (dto.quantity_change < 0 && batch.quantity < Math.abs(dto.quantity_change)) {
        throw new NotFoundException(
          `Insufficient quantity in batch. Available: ${batch.quantity}, Requested: ${Math.abs(dto.quantity_change)}`
        );
      }
    }

    // Start transaction
    return await this.prisma.$transaction(async (prisma) => {
      // Create adjustment record
      const adjustment = await prisma.inventoryAdjustment.create({
        data: {
          variant_id: dto.variant_id,
          branch_id: dto.branch_id,
          batch_id: dto.batch_id,
          quantity_change: dto.quantity_change,
          reason: dto.reason,
          notes: dto.notes,
          created_by_user_id: userId,
        },
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
          branch: { select: { id: true, name: true } },
          created_by_user: { select: { id: true, name: true } },
        },
      });

      // Update batch quantity if batch_id is provided
      if (dto.batch_id) {
        await prisma.inventoryBatch.update({
          where: { id: dto.batch_id },
          data: {
            quantity: {
              increment: dto.quantity_change,
            },
          },
        });
      }

      return adjustment;
    });
  }

  async findAll(consumerId: number, options: {
    page?: number;
    limit?: number;
    variant_id?: number;
    branch_id?: number;
  } = {}) {
    const { page = 1, limit = 10, variant_id, branch_id } = options;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      batch: {
        variant: {
          product: {
            consumer_id: consumerId,
          },
        },
      },
    };

    if (variant_id) {
      whereClause.variant_id = variant_id;
    }

    if (branch_id) {
      whereClause.branch_id = branch_id;
    }

    const [adjustments, total] = await Promise.all([
      this.prisma.inventoryAdjustment.findMany({
        where: whereClause,
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
          branch: { select: { id: true, name: true } },
          created_by_user: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.inventoryAdjustment.count({ where: whereClause }),
    ]);

    return {
      data: adjustments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, consumerId: number) {
    const adjustment = await this.prisma.inventoryAdjustment.findFirst({
      where: {
        id,
        batch: {
          variant: {
            product: {
              consumer_id: consumerId,
            },
          },
        },
      },
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
        branch: { select: { id: true, name: true } },
        created_by_user: { select: { id: true, name: true } },
      },
    });

    if (!adjustment) {
      throw new NotFoundException(`Adjustment with ID ${id} not found`);
    }

    return adjustment;
  }
}