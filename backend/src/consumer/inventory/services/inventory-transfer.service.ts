import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryTransferDto } from '../dto/create-inventory-transfer.dto';

@Injectable()
export class InventoryTransferService {
  constructor(private prisma: PrismaService) {}

  async create(consumerId: number, userId: number, dto: CreateInventoryTransferDto) {
    // Verify both branches belong to consumer
    const [sourceBranch, destinationBranch] = await Promise.all([
      this.prisma.branch.findFirst({
        where: { id: dto.source_branch_id, consumer_id: consumerId },
      }),
      this.prisma.branch.findFirst({
        where: { id: dto.destination_branch_id, consumer_id: consumerId },
      }),
    ]);

    if (!sourceBranch) {
      throw new NotFoundException('Source branch not found');
    }
    if (!destinationBranch) {
      throw new NotFoundException('Destination branch not found');
    }

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
        throw new NotFoundException(`Batch with ID ${item.batch_id} not found in source branch`);
      }

      if (batch.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient quantity in batch ${item.batch_id}. Available: ${batch.quantity}, Requested: ${item.quantity}`
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
          create: dto.items.map(item => ({
            batch_id: item.batch_id,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        source_branch: { select: { id: true, name: true } },
        destination_branch: { select: { id: true, name: true } },
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
  }

  async findAll(consumerId: number, options: {
    page?: number;
    limit?: number;
    status?: string;
    branch_id?: number;
  } = {}) {
    const { page = 1, limit = 10, status, branch_id } = options;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      OR: [
        { source_branch: { consumer_id: consumerId } },
        { destination_branch: { consumer_id: consumerId } },
      ],
    };

    if (status) {
      whereClause.status = status;
    }

    if (branch_id) {
      whereClause.OR = [
        { source_branch_id: branch_id, source_branch: { consumer_id: consumerId } },
        { destination_branch_id: branch_id, destination_branch: { consumer_id: consumerId } },
      ];
    }

    const [transfers, total] = await Promise.all([
      this.prisma.inventoryTransfer.findMany({
        where: whereClause,
        include: {
          source_branch: { select: { id: true, name: true } },
          destination_branch: { select: { id: true, name: true } },
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
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.inventoryTransfer.count({ where: whereClause }),
    ]);

    return {
      data: transfers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, consumerId: number) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: {
        id,
        OR: [
          { source_branch: { consumer_id: consumerId } },
          { destination_branch: { consumer_id: consumerId } },
        ],
      },
      include: {
        source_branch: { select: { id: true, name: true } },
        destination_branch: { select: { id: true, name: true } },
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
      throw new NotFoundException(`Transfer with ID ${id} not found`);
    }

    return transfer;
  }

  async completeTransfer(id: number, consumerId: number) {
    const transfer = await this.findOne(id, consumerId);

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not in pending status');
    }

    // Start transaction
    return await this.prisma.$transaction(async (prisma) => {
      // Update source batches (reduce quantity)
      for (const item of transfer.items) {
        await prisma.inventoryBatch.update({
          where: { id: item.batch_id },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        });

        // Create new batch in destination branch
        await prisma.inventoryBatch.create({
          data: {
            variant_id: item.batch.variant_id,
            branch_id: transfer.destination_branch_id,
            batch_number: `${item.batch.batch_number}-TRF-${transfer.id}`,
            quantity: item.quantity,
            cost_price: item.batch.cost_price,
            vendor_id: item.batch.vendor_id,
            expiry_date: item.batch.expiry_date,
          },
        });
      }

      // Update transfer status
      const updatedTransfer = await prisma.inventoryTransfer.update({
        where: { id },
        data: {
          status: 'completed',
          completed_date: new Date(),
        },
        include: {
          source_branch: { select: { id: true, name: true } },
          destination_branch: { select: { id: true, name: true } },
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

      return updatedTransfer;
    });
  }

  async cancelTransfer(id: number, consumerId: number) {
    const transfer = await this.findOne(id, consumerId);

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Only pending transfers can be cancelled');
    }

    const updatedTransfer = await this.prisma.inventoryTransfer.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        source_branch: { select: { id: true, name: true } },
        destination_branch: { select: { id: true, name: true } },
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

    return updatedTransfer;
  }
}