import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryAdjustmentDto } from '../dto/inventory-adjustment.dto';
import { errorStack } from '../../../common/utils/error.util';
import { takeAvailableStock } from '../utils/stock-mutation.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class InventoryAdjustmentService {
  private readonly logger = new Logger(InventoryAdjustmentService.name);
  constructor(private prisma: PrismaService) {}

  async create(
    consumerId: number,
    userId: number,
    dto: CreateInventoryAdjustmentDto,
  ) {
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

      // Start transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // If batch_id is provided, verify it exists and belongs to the correct branch/variant
        const batch = await prisma.inventoryBatch.findFirst({
          where: {
            id: dto.batch_id,
            variant_id: dto.variant_id,
            branch_id: dto.branch_id,
          },
        });

        if (!batch) {
          throw new NotFoundException(
            'Batch not found for the specified variant and branch',
          );
        }

        // For negative adjustments, check if sufficient quantity exists
        if (
          dto.quantity_change < 0 &&
          batch.quantity - batch.reserved_quantity <
            Math.abs(dto.quantity_change)
        ) {
          throw new BadRequestException(
            `Insufficient available quantity in batch. Available: ${batch.quantity - batch.reserved_quantity}, Requested: ${Math.abs(dto.quantity_change)}`,
          );
        }

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

        // Update batch quantity. Removals use an atomic check-and-update: the
        // availability check above can be outdated by a concurrent sale
        const updatedBatch =
          dto.quantity_change < 0
            ? await takeAvailableStock(
                prisma,
                dto.batch_id,
                Math.abs(dto.quantity_change),
              )
            : await prisma.inventoryBatch.update({
                where: { id: dto.batch_id },
                data: {
                  quantity: {
                    increment: dto.quantity_change,
                  },
                },
              });
        if (!updatedBatch) {
          throw new BadRequestException(
            `Insufficient available quantity in batch. Requested: ${Math.abs(dto.quantity_change)}`,
          );
        }

        // Create audit log entry
        await prisma.inventoryAuditLog.create({
          data: {
            consumer_id: consumerId,
            branch_id: dto.branch_id,
            variant_id: dto.variant_id,
            batch_id: dto.batch_id,
            inventoryBatchId: dto.batch_id,
            event_type: 'ADJUSTMENT',
            quantity_delta: dto.quantity_change,
            quantity_after: updatedBatch.quantity,
            reference_id: adjustment.id,
            reference_type: 'inventory_adjustments',
            notes: dto.notes || dto.reason,
            created_by_user_id: userId,
          },
        });

        return adjustment;
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error creating inventory adjustment for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create inventory adjustment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      variant_id?: number;
      branch_id?: number;
      search?: string;
    } = {},
  ) {
    try {
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

      const search = options.search?.trim();
      if (search) {
        const contains = { contains: search, mode: 'insensitive' as const };
        whereClause.OR = [
          { reason: contains },
          { notes: contains },
          { branch: { name: contains } },
          { created_by_user: { name: contains } },
          { batch: { batch_number: contains } },
          { variant: { name: contains } },
          { variant: { sku: contains } },
          { variant: { product: { name: contains } } },
        ];
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
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding all inventory adjustments for ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find inventory adjustments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
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
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding inventory adjustment ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find inventory adjustment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
