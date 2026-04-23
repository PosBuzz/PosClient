import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryBatchDto } from '../dto/create-inventory-batch.dto';
import { UpdateInventoryBatchDto } from '../dto/update-inventory-batch.dto';

@Injectable()
export class InventoryBatchService {
  private readonly logger = new Logger(InventoryBatchService.name);
  constructor(private prisma: PrismaService) {}
  async create(consumerId: number, dto: CreateInventoryBatchDto) {
    try {
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
        throw new BadRequestException(
          'Batch number already exists for this variant',
        );
      }

      const batch = await this.prisma.inventoryBatch.create({
        data: {
          variant_id: dto.variant_id,
          branch_id: dto.branch_id,
          batch_number: dto.batch_number,
          quantity: dto.quantity,
          original_quantity: dto.quantity, // locked at creation, never changed
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error creating inventory batch for consumer ${consumerId}`, error.stack);
      throw new HttpException(
        'Failed to create inventory batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findAll(
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      branch_id?: number;
      variant_id?: number;
    } = {},
  ) {
    try {
      const { page = 1, limit, search, branch_id, variant_id } = options;

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
          {
            variant: {
              product: { name: { contains: search, mode: 'insensitive' } },
            },
          },
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error finding all inventory batches for ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to find inventory batches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findOne(id: number, consumerId: number) {
    try {
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error finding inventory batch ${id} for consumer ${consumerId}`, error.stack);
      throw new HttpException(
        'Failed to find inventory batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async update(id: number, consumerId: number, dto: UpdateInventoryBatchDto) {
    try {
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

      return updatedBatch;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error updating inventory batch ${id} for consumer ${consumerId}`, error.stack);
      throw new HttpException(
        'Failed to update inventory batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      const batch = await this.findOne(id, consumerId);

      await this.prisma.inventoryBatch.delete({
        where: { id },
      });

      return { success: true, message: 'Inventory batch deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error deleting inventory batch ${id} for consumer ${consumerId}`, error.stack);
      throw new HttpException(
        'Failed to delete inventory batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
