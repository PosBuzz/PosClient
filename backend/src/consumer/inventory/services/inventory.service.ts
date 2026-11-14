import { availableByBranch, stockStatus } from '../utils/stock-status.util';
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { collectBatchLocations } from '../utils/batch-location.util';
import { InventoryHelperService } from './inventory-helper.service';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

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

      const [totalBatches, totalQuantity, stockAlerts, expiringSoon] =
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
                    expiry_date: true,
                  },
                },
                product: { select: { id: true, name: true } },
              },
            })
            .then((variants) => {
              let lowStockCount = 0;
              let outOfStockCount = 0;
              variants.forEach((variant) => {
                const { status, lowBranchIds } = stockStatus(
                  variant.inventory_items,
                  variant.alert_quantity,
                );
                // One per low branch; a single branch when one is selected
                lowStockCount += lowBranchIds.length;
                if (status === 'out') outOfStockCount++;
              });
              return { lowStockCount, outOfStockCount };
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
      const [valueGroups, branches] = await Promise.all([
        this.prisma.inventoryBatch.groupBy({
          by: ['branch_id', 'cost_price'],
          where: whereClause,
          _sum: { quantity: true },
        }),
        this.prisma.branch.findMany({
          where: {
            consumer_id: consumerId,
            ...(branchId ? { id: branchId } : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ]);
      const values = new Map<number, Prisma.Decimal>();
      for (const row of valueGroups) {
        values.set(
          row.branch_id,
          (values.get(row.branch_id) ?? new Prisma.Decimal(0)).plus(
            new Prisma.Decimal(row.cost_price).times(row._sum.quantity ?? 0),
          ),
        );
      }
      const branchValues = branches.map((branch) => ({
        branch_id: branch.id,
        branch_name: branch.name,
        inventory_value: (
          values.get(branch.id) ?? new Prisma.Decimal(0)
        ).toNumber(),
      }));
      return {
        total_inventory_value: [...values.values()]
          .reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0))
          .toNumber(),
        branch_values: branchValues,
        total_batches: totalBatches,
        total_quantity:
          (totalQuantity._sum.quantity || 0) -
          (totalQuantity._sum.reserved_quantity || 0),
        physical_quantity: totalQuantity._sum.quantity || 0,
        reserved_quantity: totalQuantity._sum.reserved_quantity || 0,
        low_stock_variants: stockAlerts.lowStockCount,
        out_of_stock_variants: stockAlerts.outOfStockCount,
        expiring_soon: expiringSoon,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
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
              expiry_date: true,
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
          const pendingDelivery = variant.inventory_items.reduce(
            (sum, item) => sum + item.reserved_quantity,
            0,
          );

          const { status } = stockStatus(
            variant.inventory_items,
            variant.alert_quantity,
          );
          const isLowStock = status === 'low';
          const isOutOfStock = status === 'out';

          return {
            ...variant,
            total_stock: totalStock,
            pending_delivery: pendingDelivery,
            is_low_stock: isLowStock,
            is_out_of_stock: isOutOfStock,
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
      if (isClientError(error)) {
        throw error;
      }
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
      if (isClientError(error)) {
        throw error;
      }
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
      if (isClientError(error)) {
        throw error;
      }
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

  async getProductVariants(productId: number, consumerId: number) {
    try {
      // The product must belong to the caller's shop
      const product = await this.prisma.product.findFirst({
        where: { id: productId, consumer_id: consumerId },
        select: { id: true },
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
          regular_price: true,
          wholesale_price: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
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

      const { status } = stockStatus(batches, variant.alert_quantity);
      const isLowStock = status === 'low';

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
        is_out_of_stock: status === 'out',
        stock_by_branch: stockByBranch,
        batches,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
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
  /** Variants tracked for restocking (alert level above 0) with nothing sellable left. */
  async getOutOfStockCount(consumerId: number, branchId?: number) {
    try {
      const variants = await this.prisma.productVariant.findMany({
        where: {
          product: { consumer_id: consumerId },
          alert_quantity: { gt: 0 },
        },
        select: {
          alert_quantity: true,
          inventory_items: {
            where: branchId ? { branch_id: branchId } : {},
            select: {
              quantity: true,
              reserved_quantity: true,
              branch_id: true,
              expiry_date: true,
            },
          },
        },
      });
      return variants.filter(
        (variant) =>
          stockStatus(variant.inventory_items, variant.alert_quantity)
            .status === 'out',
      ).length;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error counting out of stock items for consumer ${consumerId} branch ${branchId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to count out of stock items',
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
              expiry_date: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
      });

      const lowStockItems: any[] = [];

      variants.forEach((variant) => {
        const alert = variant.alert_quantity || 0;
        const { lowBranchIds } = stockStatus(variant.inventory_items, alert);
        if (!lowBranchIds.length) return;

        const branchStock = availableByBranch(variant.inventory_items);
        const stockByBranch = variant.inventory_items.reduce(
          (acc, item) => {
            const branchName = item.branch?.name || 'Central';
            acc[branchName] =
              (acc[branchName] || 0) + item.quantity - item.reserved_quantity;
            return acc;
          },
          {} as Record<string, number>,
        );

        lowBranchIds.forEach((lowBranchId) => {
          const stock = branchStock.get(lowBranchId) ?? 0;
          const branchName =
            variant.inventory_items.find(
              (item) => item.branch_id === lowBranchId,
            )?.branch?.name || 'Central';
          lowStockItems.push({
            ...variant,
            total_stock: stock,
            stock_by_branch: stockByBranch,
            shortage: alert - stock,
            affected_branch_id: lowBranchId,
            affected_branch_name: branchName,
            ...(branchId ? {} : { unique_key: `${variant.id}-${lowBranchId}` }),
          });
        });
      });

      return lowStockItems;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
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
      if (isClientError(error)) {
        throw error;
      }
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
