import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryHelperService } from './inventory-helper.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private inventoryHelper: InventoryHelperService
  ) {}

  async getInventorySummary(consumerId: number, branchId?: number) {
    const whereClause: any = {
      variant: {
        product: {
          consumer_id: consumerId,
        },
      },
    };

    if (branchId) {
      whereClause.branch_id = branchId;
    }

    const [totalBatches, totalQuantity, lowStockVariants, expiringSoon] =
      await Promise.all([
        // Total batches count
        this.prisma.inventoryBatch.count({ where: whereClause }),

        // Total quantity across all batches
        this.prisma.inventoryBatch.aggregate({
          where: whereClause,
          _sum: { quantity: true },
        }),

        // Low stock variants (where total quantity <= alert_quantity)
        this.prisma.productVariant
          .findMany({
            where: {
              product: { consumer_id: consumerId },
              alert_quantity: { gt: 0 },
            },
            include: {
              inventory_items: {
                where: branchId ? { branch_id: branchId } : {},
                select: { quantity: true },
              },
              product: { select: { id: true, name: true } },
            },
          })
          .then((variants) =>
            variants.filter((variant) => {
              const totalStock = variant.inventory_items.reduce(
                (sum, item) => sum + item.quantity,
                0,
              );
              return totalStock <= (variant.alert_quantity || 0);
            }),
          ),

        // Batches expiring in next 30 days
        this.prisma.inventoryBatch.count({
          where: {
            ...whereClause,
            expiry_date: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              gte: new Date(),
            },
          },
        }),
      ]);

    return {
      total_batches: totalBatches,
      total_quantity: totalQuantity._sum.quantity || 0,
      low_stock_variants: lowStockVariants.length,
      expiring_soon: expiringSoon,
    };
  }

  async getStockByVariant(
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      branch_id?: number;
      search?: string;
      low_stock_only?: boolean;
    } = {},
  ) {
    const { page = 1, limit = 10, branch_id, search, low_stock_only } = options;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      product: { consumer_id: consumerId },
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const variants = await this.prisma.productVariant.findMany({
      where: whereClause,
      include: {
        product: { select: { id: true, name: true } },
        inventory_items: {
          where: branch_id ? { branch_id } : {},
          select: {
            quantity: true,
            branch_id: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    });

    // Calculate stock levels and filter if needed
    const enrichedVariants = variants
      .map((variant) => {
        const totalStock = variant.inventory_items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const isLowStock =
          variant.alert_quantity &&
          variant.alert_quantity > 0 &&
          totalStock <= variant.alert_quantity;

        return {
          ...variant,
          total_stock: totalStock,
          is_low_stock: isLowStock,
          stock_by_branch: variant.inventory_items.reduce(
            (acc, item) => {
              const branchName = item.branch?.name || 'Central';
              acc[branchName] = (acc[branchName] || 0) + item.quantity;
              return acc;
            },
            {} as Record<string, number>,
          ),
        };
      })
      .filter((variant) => !low_stock_only || variant.is_low_stock);

    const total = await this.prisma.productVariant.count({
      where: whereClause,
    });

    return {
      data: enrichedVariants,
      meta: {
        total: low_stock_only ? enrichedVariants.length : total,
        page,
        limit,
        totalPages: Math.ceil(
          (low_stock_only ? enrichedVariants.length : total) / limit,
        ),
      },
    };
  }

  async getExpiringBatches(consumerId: number, days: number = 30) {
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        variant: {
          product: { consumer_id: consumerId },
        },
        expiry_date: {
          lte: expiryDate,
          gte: new Date(),
        },
        quantity: { gt: 0 },
      },
      include: {
        variant: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { expiry_date: 'asc' },
    });

    return batches;
  }

  // New methods for inventory management
  async getProductsForInventory(consumerId: number) {
    return await this.prisma.product.findMany({
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getProductVariants(productId: number) {
    return await this.prisma.productVariant.findMany({
      where: {
        product_id: productId,
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async getVariantStock(
    variantId: number,
    consumerId: number,
    branchId?: number,
  ) {
    // Verify variant belongs to consumer
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        product: { consumer_id: consumerId },
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const whereClause: any = {
      variant_id: variantId,
    };

    if (branchId) {
      whereClause.branch_id = branchId;
    }

    const batches = await this.prisma.inventoryBatch.findMany({
      where: whereClause,
      include: {
        branch: { select: { id: true, name: true, is_main: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const totalStock = batches.reduce((sum, batch) => sum + batch.quantity, 0);
    const stockByBranch = batches.reduce(
      (acc, batch) => {
        const branchName = batch.branch?.name || 'Central';
        acc[branchName] = (acc[branchName] || 0) + batch.quantity;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      variant: {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        product: variant.product,
        alert_quantity: variant.alert_quantity,
      },
      total_stock: totalStock,
      is_low_stock:
        variant.alert_quantity &&
        variant.alert_quantity > 0 &&
        totalStock <= variant.alert_quantity,
      stock_by_branch: stockByBranch,
      batches,
    };
  }

  async getLowStockItems(consumerId: number, branchId?: number) {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        product: { consumer_id: consumerId },
        alert_quantity: { gt: 0 },
      },
      include: {
        product: { select: { id: true, name: true } },
        inventory_items: {
          where: branchId ? { branch_id: branchId } : {},
          select: {
            quantity: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    const lowStockItems = variants
      .filter((variant) => {
        const totalStock = variant.inventory_items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        return totalStock <= (variant.alert_quantity || 0);
      })
      .map((variant) => {
        const totalStock = variant.inventory_items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const stockByBranch = variant.inventory_items.reduce(
          (acc, item) => {
            const branchName = item.branch?.name || 'Central';
            acc[branchName] = (acc[branchName] || 0) + item.quantity;
            return acc;
          },
          {} as Record<string, number>,
        );

        return {
          ...variant,
          total_stock: totalStock,
          stock_by_branch: stockByBranch,
          shortage: (variant.alert_quantity || 0) - totalStock,
        };
      });

    return lowStockItems;
  }

  async getInventoryMovementHistory(
    variantId: number,
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      branch_id?: number;
    } = {},
  ) {
    const { page = 1, limit = 20, branch_id } = options;
    const skip = (page - 1) * limit;

    // Verify variant belongs to consumer
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        product: { consumer_id: consumerId },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    // Get inventory adjustments
    const adjustmentWhere: any = {
      variant_id: variantId,
    };

    if (branch_id) {
      adjustmentWhere.branch_id = branch_id;
    }

    const [adjustments, transfersOut, transfersIn, total] = await Promise.all([
      // Adjustments
      this.prisma.inventoryAdjustment.findMany({
        where: adjustmentWhere,
        include: {
          batch: {
            select: {
              id: true,
              batch_number: true,
            },
          },
          branch: { select: { id: true, name: true } },
          created_by_user: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),

      // Transfers out (source branch)
      this.prisma.inventoryTransferItem.findMany({
        where: {
          batch: {
            variant_id: variantId,
            ...(branch_id ? { branch_id } : {}),
          },
        },
        include: {
          transfer: {
            include: {
              source_branch: { select: { id: true, name: true } },
              destination_branch: { select: { id: true, name: true } },
              created_by_user: { select: { id: true, name: true } },
            },
          },
          batch: {
            select: {
              id: true,
              batch_number: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { transfer: { created_at: 'desc' } },
      }),

      // Transfers in (destination branch)
      this.prisma.inventoryTransferItem.findMany({
        where: {
          transfer: {
            destination_branch_id: branch_id,
          },
          batch: {
            variant_id: variantId,
          },
        },
        include: {
          transfer: {
            include: {
              source_branch: { select: { id: true, name: true } },
              destination_branch: { select: { id: true, name: true } },
              created_by_user: { select: { id: true, name: true } },
            },
          },
          batch: {
            select: {
              id: true,
              batch_number: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { transfer: { created_at: 'desc' } },
      }),

      // Total count
      this.prisma.inventoryAdjustment.count({ where: adjustmentWhere }),
    ]);

    // Combine and format movements
    const movements = [
      ...adjustments.map((adj) => ({
        type: 'adjustment',
        id: adj.id,
        date: adj.created_at,
        quantity_change: adj.quantity_change,
        reason: adj.reason,
        notes: adj.notes,
        batch_number: adj.batch?.batch_number,
        location: this.inventoryHelper.getLocationName(adj.branch),
        user: adj.created_by_user,
      })),
      ...transfersOut.map((transfer) => ({
        type: 'transfer_out',
        id: transfer.transfer.id,
        date: transfer.transfer.created_at,
        quantity_change: -transfer.quantity,
        reason: `Transfer to ${this.inventoryHelper.getLocationName(transfer.transfer.destination_branch)}`,
        notes: transfer.transfer.notes,
        batch_number: transfer.batch.batch_number,
        location: this.inventoryHelper.getLocationName(transfer.transfer.source_branch),
        user: transfer.transfer.created_by_user,
      })),
      ...transfersIn.map((transfer) => ({
        type: 'transfer_in',
        id: transfer.transfer.id,
        date: transfer.transfer.created_at,
        quantity_change: transfer.quantity,
        reason: `Transfer from ${this.inventoryHelper.getLocationName(transfer.transfer.source_branch)}`,
        notes: transfer.transfer.notes,
        batch_number: transfer.batch.batch_number,
        location: this.inventoryHelper.getLocationName(transfer.transfer.destination_branch),
        user: transfer.transfer.created_by_user,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
