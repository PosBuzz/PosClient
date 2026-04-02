import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DashboardAnalyticsDto,
  DashboardAnalyticsResponse,
  SalesTrendPoint,
} from '../dto/dashboard-analytics.dto';
import { InventoryService } from '../../inventory/services/inventory.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getAnalytics(
    consumerId: number,
    query: DashboardAnalyticsDto,
  ): Promise<DashboardAnalyticsResponse> {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
      const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
      );
      weekStart.setHours(0, 0, 0, 0);

      const expiringUntil = new Date(todayEnd);
      expiringUntil.setDate(expiringUntil.getDate() + 30);

      const baseWhere: any = {
        consumer_id: consumerId,
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
      };

      const weeklyWhere = {
        ...baseWhere,
        sale_date: {
          gte: weekStart,
          lte: todayEnd,
        },
      };

      const todayWhere = {
        ...baseWhere,
        sale_date: {
          gte: todayStart,
          lte: todayEnd,
        },
      };

      if (query.branch_id) {
        baseWhere.branch_id = query.branch_id;
        weeklyWhere.branch_id = query.branch_id;
        todayWhere.branch_id = query.branch_id;
      }

      const [
        weeklyAgg,
        todayAgg,
        weeklySalesRows,
        paymentBreakdown,
        topProductsGrouped,
        lowStockItems,
        expiringBatches,
      ] = await Promise.all([
        this.prisma.sale.aggregate({
          where: weeklyWhere,
          _count: { id: true },
          _sum: { total_amount: true },
        }),
        this.prisma.sale.aggregate({
          where: todayWhere,
          _count: { id: true },
          _sum: { total_amount: true },
        }),
        this.prisma.sale.findMany({
          where: weeklyWhere,
          select: {
            sale_date: true,
            total_amount: true,
          },
          orderBy: {
            sale_date: 'asc',
          },
        }),
        this.prisma.salePayment.groupBy({
          by: ['payment_method'],
          where: {
            sale: weeklyWhere,
          },
          _sum: {
            amount: true,
          },
          _count: {
            _all: true,
          },
        }),
        this.prisma.saleItem.groupBy({
          by: ['variant_id'],
          where: {
            sale: weeklyWhere,
          },
          _sum: {
            quantity: true,
            line_total: true,
          },
          orderBy: {
            _sum: {
              quantity: 'desc',
            },
          },
          take: 5,
        }),
        this.inventoryService.getLowStockItems(consumerId, query.branch_id),
        this.prisma.inventoryBatch.findMany({
          where: {
            variant: {
              product: { consumer_id: consumerId },
            },
            expiry_date: {
              gte: todayStart,
              lte: expiringUntil,
            },
            quantity: { gt: 0 },
            ...(query.branch_id ? { branch_id: query.branch_id } : {}),
          },
          include: {
            variant: {
              select: {
                name: true,
                product: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            branch: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { expiry_date: 'asc' },
          take: 5,
        }),
      ]);

      const trendMap = new Map<string, SalesTrendPoint>();
      weeklySalesRows.forEach((sale) => {
        const date = sale.sale_date.toISOString().slice(0, 10);
        const existing = trendMap.get(date);
        const amount = Number(sale.total_amount || 0);
        if (!existing) {
          trendMap.set(date, {
            date,
            sales_count: 1,
            total_amount: amount,
          });
          return;
        }
        existing.sales_count += 1;
        existing.total_amount += amount;
      });

      const weeklySalesTrend = Array.from(trendMap.values());

      const variantIds = topProductsGrouped.map((item) => item.variant_id);
      const variants = variantIds.length
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              name: true,
              sku: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          })
        : [];
      const variantMap = new Map(
        variants.map((variant) => [variant.id, variant]),
      );

      const topProducts = topProductsGrouped.map((item) => {
        const variant = variantMap.get(item.variant_id);
        return {
          variant_id: item.variant_id,
          variant_name: variant?.name || 'Unknown Variant',
          product_name: variant?.product?.name || 'Unknown Product',
          sku: variant?.sku || undefined,
          total_quantity: item._sum.quantity || 0,
          total_amount: Number(item._sum.line_total || 0),
        };
      });

      const paymentMethodBreakdown = paymentBreakdown.map((item) => ({
        payment_method: item.payment_method,
        total_amount: Number(item._sum.amount || 0),
        transaction_count: item._count._all,
      }));

      const lowStock = {
        total_critical_items: lowStockItems.length,
        items: lowStockItems.slice(0, 5).map((item: any) => ({
          variant_id: item.id,
          product_name: item.product?.name || 'Unknown Product',
          variant_name: item.name || 'Unknown Variant',
          sku: item.sku || undefined,
          alert_quantity: item.alert_quantity || 0,
          total_stock: item.total_stock || 0,
          shortage: item.shortage || 0,
          affected_branch_name: item.affected_branch_name,
        })),
      };

      const expiringItems = {
        total_expiring_items: expiringBatches.length,
        items: expiringBatches.map((batch) => ({
          batch_id: batch.id,
          product_name: batch.variant?.product?.name || 'Unknown Product',
          variant_name: batch.variant?.name || 'Unknown Variant',
          batch_number: batch.batch_number,
          quantity: batch.quantity,
          expiry_date: (batch.expiry_date || new Date()).toISOString(),
          branch_name: batch.branch?.name,
        })),
      };

      return {
        summary: {
          weekly_total_sale: Number(weeklyAgg._sum.total_amount || 0),
          weekly_transactions: weeklyAgg._count.id || 0,
          today_total_sale: Number(todayAgg._sum.total_amount || 0),
          today_transactions: todayAgg._count.id || 0,
        },
        weekly_sales_trend: weeklySalesTrend,
        payment_method_breakdown: paymentMethodBreakdown,
        top_products: topProducts,
        low_stock: lowStock,
        expiring_items: expiringItems,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Error fetching dashboard analytics for consumer ${consumerId}`,
        (error as Error).stack,
      );
      throw new HttpException(
        'Failed to fetch dashboard analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
