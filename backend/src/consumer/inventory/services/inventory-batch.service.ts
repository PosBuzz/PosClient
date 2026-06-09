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

  async create(
    consumerId: number,
    userId: number,
    dto: CreateInventoryBatchDto,
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

      // Check if batch number already exists for this variant
      const existingBatch = await this.prisma.inventoryBatch.findFirst({
        where: {
          batch_number: dto.batch_number,
          variant_id: dto.variant_id,
        },
      });

      if (existingBatch) {
        // Helper function to normalize dates to YYYY-MM-DD for accurate comparison
        const formatDate = (
          date: Date | string | null | undefined,
        ): string | null => {
          if (!date) return null;
          return new Date(date).toISOString().split('T')[0];
        };

        const existingExpiry = formatDate(existingBatch.expiry_date);
        const newExpiry = formatDate(dto.expiry_date);

        if (existingExpiry !== newExpiry) {
          // Batch number matches, but expiry date does NOT match
          throw new BadRequestException(
            `Batch number "${dto.batch_number}" already exists for this variant, but the expiry date does not match the existing record.`,
          );
        }

        // Batch number AND expiry date both match (Exact duplicate)
        throw new BadRequestException(
          `Batch number "${dto.batch_number}" already exists for this variant with the same expiry date.`,
        );
      }

      // Create batch and audit log in transaction
      const batch = await this.prisma.$transaction(async (prisma) => {
        // Determine payment status and paid amount
        const totalCost = Number(dto.cost_price) * dto.quantity;
        let paidAmount = 0;
        let paymentStatus = 'paid';

        if (dto.payments && dto.payments.length > 0) {
          paidAmount = dto.payments.reduce(
            (sum, p) => sum + Number(p.amount),
            0,
          );
          if (paidAmount >= totalCost) {
            paymentStatus = 'paid';
          } else if (paidAmount > 0) {
            paymentStatus = 'partial';
          } else {
            paymentStatus = 'due';
          }
        }
        // If no payments provided, default to fully paid (backward compatible)

        const newBatch = await prisma.inventoryBatch.create({
          data: {
            variant_id: dto.variant_id,
            branch_id: dto.branch_id,
            batch_number: dto.batch_number,
            quantity: dto.quantity,
            cost_price: dto.cost_price,
            vendor_id: dto.vendor_id,
            expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
            payment_status: paymentStatus,
            paid_amount: paymentStatus === 'paid' && !dto.payments?.length
              ? totalCost
              : paidAmount,
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

        // Create audit log for purchase in
        if (dto.quantity > 0) {
          await prisma.inventoryAuditLog.create({
            data: {
              consumer_id: consumerId,
              branch_id: dto.branch_id,
              variant_id: dto.variant_id,
              batch_id: newBatch.id,
              inventoryBatchId: newBatch.id,
              event_type: 'PURCHASE_IN',
              quantity_delta: dto.quantity,
              quantity_after: newBatch.quantity,
              reference_id: newBatch.id,
              reference_type: 'inventory_batches',
              notes: `Purchase batch ${dto.batch_number} - Qty: ${dto.quantity}`,
              created_by_user_id: userId,
            },
          });
        }

        // Create purchase payment records if provided
        if (dto.payments && dto.payments.length > 0) {
          await Promise.all(
            dto.payments.map((payment) =>
              prisma.purchasePayment.create({
                data: {
                  batch_id: newBatch.id,
                  payment_method: payment.payment_method,
                  payment_type: (payment.payment_type as any) || null,
                  amount: payment.amount,
                  reference: payment.reference || null,
                },
              }),
            ),
          );
        }

        return newBatch;
      });

      return batch;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error creating inventory batch for consumer ${consumerId}`,
        error.stack,
      );
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
            purchasePayments: {
              orderBy: { created_at: 'desc' },
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
          limit: limit || total,
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
          purchasePayments: {
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException(`Inventory batch with ID ${id} not found`);
      }

      return batch;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error finding inventory batch ${id} for consumer ${consumerId}`,
        error.stack,
      );
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
      this.logger.error(
        `Error updating inventory batch ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to update inventory batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      const batch = await this.findOne(id, consumerId);

      if (batch.quantity > 0) {
        throw new BadRequestException(
          'Cannot delete batch with remaining quantity. Use inventory adjustment to reduce quantity to 0 first.',
        );
      }

      await this.prisma.inventoryBatch.delete({
        where: { id },
      });

      return { success: true, message: 'Inventory batch deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error deleting inventory batch ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to delete inventory batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
