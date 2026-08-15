import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { collectBatchLocations } from '../utils/batch-location.util';
import { InventoryHelperService } from './inventory-helper.service';
import { errorStack } from '../../../common/utils/error.util';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(
    private prisma: PrismaService,
    private inventoryHelper: InventoryHelperService,
  ) {}
  async getInventorySummary(consumerId: number, branchId?: number) {
    try {
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
            _sum: { quantity: true, reserved_quantity: true },
          }), // Low stock variants (where branch-specific quantity <= alert_quantity)
          this.prisma.productVariant
            .findMany({
              where: {
                product: { consumer_id: consumerId },
                alert_quantity: { gt: 0 },
              },
              include: {
                inventory_items: {
                  where: branchId ? { branch_id: branchId } : {},
                  select: {
                    quantity: true,
                    reserved_quantity: true,
                    branch_id: true,
                  },
                },
                product: { select: { id: true, name: true } },
              },
            })
            .then((variants) => {
              let lowStockCount = 0;
              variants.forEach((variant) => {
                if (branchId) {
                  // If checking specific branch, count variant if that branch's stock is low
                  const branchStock = variant.inventory_items.reduce(
                    (sum, item) => sum + item.quantity - item.reserved_quantity,
                    0,
                  );
                  if (branchStock <= (variant.alert_quantity || 0)) {
                    lowStockCount++;
                  }
                } else {
                  // If checking all branches, count how many branches have low stock for this variant
                  const branchStockMap = variant.inventory_items.reduce(
                    (acc, item) => {
                      acc[item.branch_id] =
                        (acc[item.branch_id] || 0) +
                        item.quantity -
                        item.reserved_quantity;
                      return acc;
                    },
                    {} as Record<number, number>,
                  );

                  const lowStockBranches = Object.values(branchStockMap).filter(
                    (stock) => stock <= (variant.alert_quantity || 0),
                  );

                  if (lowStockBranches.length > 0) {
                    lowStockCount += lowStockBranches.length;
                  }
                }
              });
              return lowStockCount;
            }),

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
        total_quantity:
          (totalQuantity._sum.quantity || 0) -
          (totalQuantity._sum.reserved_quantity || 0),
        physical_quantity: totalQuantity._sum.quantity || 0,
        reserved_quantity: totalQuantity._sum.reserved_quantity || 0,
        low_stock_variants: lowStockVariants,
        expiring_soon: expiringSoon,
      };
    } catch (error) {
      this.logger.error(
        `Error getting inventory summary with branch ID ${branchId} for ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get inventory summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const {
        page = 1,
        limit = 10,
        branch_id,
        search,
        low_stock_only,
      } = options;

      const skip = (page - 1) * limit;

      const whereClause: any = {
        product: { consumer_id: consumerId },
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { code: { contains: search, mode: 'insensitive' } } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          {
            inventory_items: {
              some: { location: { contains: search, mode: 'insensitive' } },
            },
          },
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
              reserved_quantity: true,
              branch_id: true,
              location: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }); // Calculate stock levels and filter if needed
      const enrichedVariants = variants
        .map((variant) => {
          const totalStock = variant.inventory_items.reduce(
            (sum, item) => sum + item.quantity - item.reserved_quantity,
            0,
          );

          let isLowStock = false;

          if (branch_id) {
            // If filtering by branch, check only that branch's stock
            isLowStock = !!(
              variant.alert_quantity &&
              variant.alert_quantity > 0 &&
              totalStock <= variant.alert_quantity
            );
          } else {
            // If not filtering by branch, check if any branch has low stock
            const branchStockMap = variant.inventory_items.reduce(
              (acc, item) => {
                acc[item.branch_id] =
                  (acc[item.branch_id] || 0) +
                  item.quantity -
                  item.reserved_quantity;
                return acc;
              },
              {} as Record<number, number>,
            );

            isLowStock = !!(
              variant.alert_quantity &&
              variant.alert_quantity > 0 &&
              Object.values(branchStockMap).some(
                (branchStock) => branchStock <= (variant.alert_quantity || 0),
              )
            );
          }

          return {
            ...variant,
            total_stock: totalStock,
            is_low_stock: isLowStock,
            // Surfaced on the list itself so no drill-down is needed
            locations: collectBatchLocations(variant.inventory_items),
            locations_by_branch: variant.inventory_items.reduce(
              (acc, item) => {
                const location = item.location?.trim();
                if (!location) return acc;
                const branchName = item.branch?.name || 'Central';
                acc[branchName] = acc[branchName] || [];
                if (!acc[branchName].includes(location)) {
                  acc[branchName].push(location);
                }
                return acc;
              },
              {} as Record<string, string[]>,
            ),
            stock_by_branch: variant.inventory_items.reduce(
              (acc, item) => {
                const branchName = item.branch?.name || 'Central';
                acc[branchName] =
                  (acc[branchName] || 0) +
                  item.quantity -
                  item.reserved_quantity;
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
    } catch (error) {
      this.logger.error(
        `Error getting stock by variant for ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get stock by variant',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getExpiringBatches(consumerId: number, days: number = 30) {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error getting expiring batches for ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get expiring batches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // New methods for inventory management
  async getProductsForInventory(consumerId: number) {
    try {
      return await this.prisma.product.findMany({
        where: {
          consumer_id: consumerId,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting products for inventory for ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get products for inventory',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductVariants(productId: number) {
    try {
      // Get the product to verify ownership and get consumerId for cache key
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { consumer_id: true },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      return await this.prisma.productVariant.findMany({
        where: {
          product_id: productId,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting product variants for ${productId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get product variants',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getVariantStock(
    variantId: number,
    consumerId: number,
    branchId?: number,
  ) {
    try {
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
      const totalStock = batches.reduce(
        (sum, batch) => sum + batch.quantity - batch.reserved_quantity,
        0,
      );
      const stockByBranch = batches.reduce(
        (acc, batch) => {
          const branchName = batch.branch?.name || 'Central';
          acc[branchName] =
            (acc[branchName] || 0) + batch.quantity - batch.reserved_quantity;
          return acc;
        },
        {} as Record<string, number>,
      );

      // Calculate low stock status based on branch
      let isLowStock = false;
      if (branchId) {
        // If checking specific branch, use that branch's stock
        isLowStock = !!(
          variant.alert_quantity &&
          variant.alert_quantity > 0 &&
          totalStock <= variant.alert_quantity
        );
      } else {
        // If checking all branches, see if any branch has low stock
        const branchStockMap = batches.reduce(
          (acc, batch) => {
            acc[batch.branch?.id || 0] =
              (acc[batch.branch?.id || 0] || 0) +
              batch.quantity -
              batch.reserved_quantity;
            return acc;
          },
          {} as Record<number, number>,
        );

        isLowStock = !!(
          variant.alert_quantity &&
          variant.alert_quantity > 0 &&
          Object.values(branchStockMap).some(
            (branchStock) => branchStock <= (variant.alert_quantity || 0),
          )
        );
      }

      return {
        variant: {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          product: variant.product,
          alert_quantity: variant.alert_quantity,
        },
        total_stock: totalStock,
        is_low_stock: isLowStock,
        stock_by_branch: stockByBranch,
        batches,
      };
    } catch (error) {
      this.logger.error(
        `Error getting variant stock with ID ${variantId} for consumer ${consumerId} branch ${branchId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get variant stock',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getLowStockItems(consumerId: number, branchId?: number) {
    try {
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
              reserved_quantity: true,
              branch_id: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
      });

      const lowStockItems: any[] = [];

      variants.forEach((variant) => {
        if (branchId) {
          // If filtering by branch, check only that branch's stock
          const branchStock = variant.inventory_items.reduce(
            (sum, item) => sum + item.quantity - item.reserved_quantity,
            0,
          );

          if (branchStock <= (variant.alert_quantity || 0)) {
            const stockByBranch = variant.inventory_items.reduce(
              (acc, item) => {
                const branchName = item.branch?.name || 'Central';
                acc[branchName] =
                  (acc[branchName] || 0) +
                  item.quantity -
                  item.reserved_quantity;
                return acc;
              },
              {} as Record<string, number>,
            );

            lowStockItems.push({
              ...variant,
              total_stock: branchStock,
              stock_by_branch: stockByBranch,
              shortage: (variant.alert_quantity || 0) - branchStock,
              affected_branch_id: branchId,
              affected_branch_name:
                variant.inventory_items[0]?.branch?.name || 'Central',
            });
          }
        } else {
          // If not filtering by branch, check each branch separately
          const stockByBranch = variant.inventory_items.reduce(
            (acc, item) => {
              const branchName = item.branch?.name || 'Central';
              acc[branchName] =
                (acc[branchName] || 0) + item.quantity - item.reserved_quantity;
              return acc;
            },
            {} as Record<string, number>,
          );

          // Check each branch for low stock
          const branchStockMap = variant.inventory_items.reduce(
            (acc, item) => {
              acc[item.branch_id] =
                (acc[item.branch_id] || 0) +
                item.quantity -
                item.reserved_quantity;
              return acc;
            },
            {} as Record<number, number>,
          );

          // Find branches with low stock
          const lowStockBranches = Object.entries(branchStockMap).filter(
            ([, stock]) => stock <= (variant.alert_quantity || 0),
          );

          if (lowStockBranches.length > 0) {
            // If multiple branches have low stock, create separate entries for each
            lowStockBranches.forEach(([lowStockBranchId, branchStock]) => {
              const branchName =
                variant.inventory_items.find(
                  (item) => item.branch_id === parseInt(lowStockBranchId),
                )?.branch?.name || 'Central';

              lowStockItems.push({
                ...variant,
                total_stock: branchStock,
                stock_by_branch: stockByBranch,
                shortage: (variant.alert_quantity || 0) - branchStock,
                affected_branch_id: parseInt(lowStockBranchId),
                affected_branch_name: branchName,
                // Add a unique key for frontend to handle multiple entries for same variant
                unique_key: `${variant.id}-${lowStockBranchId}`,
              });
            });
          }
        }
      });

      return lowStockItems;
    } catch (error) {
      this.logger.error(
        `Error fetching low stock items for consumer ${consumerId} branch ${branchId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch low stock items',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
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

      const [adjustments, transfersOut, transfersIn, total] = await Promise.all(
        [
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
        ],
      );

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
          location: this.inventoryHelper.getLocationName(
            transfer.transfer.source_branch,
          ),
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
          location: this.inventoryHelper.getLocationName(
            transfer.transfer.destination_branch,
          ),
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
    } catch (error) {
      this.logger.error(
        `Error finding inventory movements with variant ID ${variantId} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find inventory movements',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
