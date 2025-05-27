import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryBatchDto } from '../dto/create-inventory-batch.dto';
import { UpdateInventoryBatchDto } from '../dto/update-inventory-batch.dto';

@Injectable()
export class InventoryBatchService {
  constructor(private prisma: PrismaService) {}

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
    });

    return batch;
  }

  async findAll(consumerId: number, options: {
    page?: number;
    limit?: number;
    search?: string;
    branch_id?: number;
    variant_id?: number;
  } = {}) {
    const { page = 1, limit = 10, search, branch_id, variant_id } = options;
    const skip = (page - 1) * limit;

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
    }

    const [batches, total] = await Promise.all([
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
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.inventoryBatch.count({ where: whereClause }),
    ]);

    return {
      data: batches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, consumerId: number) {
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
  }

  async update(id: number, consumerId: number, dto: UpdateInventoryBatchDto) {
    await this.findOne(id, consumerId);

    const updatedBatch = await this.prisma.inventoryBatch.update({
      where: { id },
      data: {
        batch_number: dto.batch_number,
        quantity: dto.quantity,
        cost_price: dto.cost_price,
        vendor_id: dto.vendor_id,
        expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : undefined,
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

    return updatedBatch;
  }

  async remove(id: number, consumerId: number) {
    await this.findOne(id, consumerId);

    await this.prisma.inventoryBatch.delete({
      where: { id },
    });

    return { success: true, message: 'Inventory batch deleted successfully' };
  }
}