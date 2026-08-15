import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryTransferDto } from '../dto/create-inventory-transfer.dto';
import { InventoryHelperService } from './inventory-helper.service';
import { errorStack } from '../../../common/utils/error.util';

@Injectable()
export class InventoryTransferService {
  private readonly logger = new Logger(InventoryTransferService.name);
  constructor(
    private prisma: PrismaService,
    private inventoryHelper: InventoryHelperService,
  ) {}

  async create(
    consumerId: number,
    userId: number,
    dto: CreateInventoryTransferDto,
  ) {
    try {
      // Validate source branch
      const sourceBranch = await this.prisma.branch.findFirst({
        where: {
          id: dto.source_branch_id,
          consumer_id: consumerId,
        },
      });
      if (!sourceBranch) {
        throw new NotFoundException('Source branch not found');
      }

      // Validate destination branch
      const destinationBranch = await this.prisma.branch.findFirst({
        where: {
          id: dto.destination_branch_id,
          consumer_id: consumerId,
        },
      });
      if (!destinationBranch) {
        throw new NotFoundException('Destination branch not found');
      }

      // Check if source and destination are the same
      if (dto.source_branch_id === dto.destination_branch_id) {
        throw new BadRequestException(
          'Source and destination branches cannot be the same',
        );
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
          throw new NotFoundException(
            `Batch with ID ${item.batch_id} not found in ${branchName}`,
          );
        }

        const availableQuantity = batch.quantity - batch.reserved_quantity;
        if (availableQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient available quantity in batch ${item.batch_id}. Available: ${availableQuantity}, Requested: ${item.quantity}`,
          );
        }
      }

      // Create transfer with items
      const transfer = await this.prisma.inventoryTransfer.create({
        data: {
          source_branch_id: dto.source_branch_id,
          destination_branch_id: dto.destination_branch_id,
          notes: dto.notes,
          created_by_user_id: userId,
          items: {
            create: dto.items.map((item) => ({
              batch_id: item.batch_id,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          source_branch: {
            select: { id: true, name: true, is_warehouse: true },
          },
          destination_branch: {
            select: { id: true, name: true, is_warehouse: true },
          },
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

      return transfer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error creating inventory transfer for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create inventory transfer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      branch_id?: number;
    } = {},
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;

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
            source_branch: {
              select: { id: true, name: true, is_warehouse: true },
            },
            destination_branch: {
              select: { id: true, name: true, is_warehouse: true },
            },
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error finding all inventory transfers for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find all inventory transfers',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
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
          source_branch: {
            select: { id: true, name: true, is_warehouse: true },
          },
          destination_branch: {
            select: { id: true, name: true, is_warehouse: true },
          },
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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error finding inventory transfer ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find inventory transfer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async completeTransfer(id: number, consumerId: number) {
    try {
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
          source_branch: {
            select: { id: true, name: true, is_warehouse: true },
          },
          destination_branch: {
            select: { id: true, name: true, is_warehouse: true },
          },
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
          const updatedSourceBatch = await prisma.inventoryBatch.update({
            where: { id: item.batch_id },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          });

          // Create TRANSFER_OUT audit log for source batch
          await prisma.inventoryAuditLog.create({
            data: {
              consumer_id: consumerId,
              branch_id: transfer.source_branch_id,
              variant_id: item.batch.variant_id,
              batch_id: item.batch_id,
              inventoryBatchId: item.batch_id,
              event_type: 'TRANSFER_OUT',
              quantity_delta: -item.quantity,
              quantity_after: updatedSourceBatch.quantity,
              reference_id: item.id,
              reference_type: 'inventory_transfer_items',
              notes: `Transfer #${id} to ${this.inventoryHelper.getLocationName(transfer.destination_branch)}`,
              created_by_user_id: transfer.created_by_user_id,
            },
          });

          // Create or update batch in destination
          const existingDestinationBatch =
            await prisma.inventoryBatch.findFirst({
              where: {
                variant_id: item.batch.variant_id,
                branch_id: transfer.destination_branch_id,
                batch_number: item.batch.batch_number,
                cost_price: item.batch.cost_price,
                expiry_date: item.batch.expiry_date,
                vendor_id: item.batch.vendor_id,
              },
            });

          let destBatchId: number;

          if (existingDestinationBatch) {
            const updatedDestBatch = await prisma.inventoryBatch.update({
              where: { id: existingDestinationBatch.id },
              data: {
                quantity: { increment: item.quantity },
              },
            });
            destBatchId = updatedDestBatch.id;

            // Create TRANSFER_IN audit log for destination batch (existing)
            await prisma.inventoryAuditLog.create({
              data: {
                consumer_id: consumerId,
                branch_id: transfer.destination_branch_id,
                variant_id: item.batch.variant_id,
                batch_id: destBatchId,
                inventoryBatchId: destBatchId,
                event_type: 'TRANSFER_IN',
                quantity_delta: item.quantity,
                quantity_after: updatedDestBatch.quantity,
                reference_id: item.id,
                reference_type: 'inventory_transfer_items',
                notes: `Transfer #${id} from ${this.inventoryHelper.getLocationName(transfer.source_branch)}`,
                created_by_user_id: transfer.created_by_user_id,
              },
            });
          } else {
            // Create new batch in destination
            const createdDestBatch = await prisma.inventoryBatch.create({
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
            destBatchId = createdDestBatch.id;

            // Create TRANSFER_IN audit log for destination batch (new)
            await prisma.inventoryAuditLog.create({
              data: {
                consumer_id: consumerId,
                branch_id: transfer.destination_branch_id,
                variant_id: item.batch.variant_id,
                batch_id: destBatchId,
                inventoryBatchId: destBatchId,
                event_type: 'TRANSFER_IN',
                quantity_delta: item.quantity,
                quantity_after: createdDestBatch.quantity,
                reference_id: item.id,
                reference_type: 'inventory_transfer_items',
                notes: `Transfer #${id} from ${this.inventoryHelper.getLocationName(transfer.source_branch)} - New batch created`,
                created_by_user_id: transfer.created_by_user_id,
              },
            });
          }

          // Record the destination batch on the transfer item for audit traceability
          await prisma.inventoryTransferItem.update({
            where: { id: item.id },
            data: { dest_batch_id: destBatchId },
          });
        }

        // Update transfer status
        return await prisma.inventoryTransfer.update({
          where: { id },
          data: {
            status: 'completed',
            completed_date: new Date(),
          },
          include: {
            source_branch: {
              select: { id: true, name: true, is_warehouse: true },
            },
            destination_branch: {
              select: { id: true, name: true, is_warehouse: true },
            },
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
      });

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error completing transfer with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to complete transfer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async cancelTransfer(id: number, consumerId: number) {
    try {
      const transfer = await this.findOne(id, consumerId);

      if (transfer.status !== 'pending') {
        throw new BadRequestException('Transfer is not in pending status');
      }

      const updatedTransfer = await this.prisma.inventoryTransfer.update({
        where: { id },
        data: {
          status: 'cancelled',
        },
      });

      return updatedTransfer;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error cancelling transfer with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to cancel transfer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
