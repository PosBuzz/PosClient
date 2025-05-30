import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInventoryTransferDto } from '../dto/create-inventory-transfer.dto';
import { InventoryHelperService } from './inventory-helper.service';

@Injectable()
export class InventoryTransferService {
  constructor(
    private prisma: PrismaService,
    private inventoryHelper: InventoryHelperService
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
  }

  async findOne(id: number, consumerId: number) {
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
      });
    });

    return result;
  }

  async cancelTransfer(id: number, consumerId: number) {
    const transfer = await this.findOne(id, consumerId);

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not in pending status');
    }

    const updatedTransfer = await this.prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: 'cancelled',
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

    return updatedTransfer;
  }
}