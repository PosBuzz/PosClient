import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      );

      const todayEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      );

      // Saturday–Friday week window in UTC.
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getUTCDay(); // 0=Sun … 6=Sat
      // Distance back to most-recent Saturday
      const saturdayOffset = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
      weekStart.setUTCDate(weekStart.getUTCDate() + saturdayOffset);
      weekStart.setUTCHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      // Monthly date range (1st of current month to end of current month)
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
      );
      const monthEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      );

      // Helper function to get date range based on period
      const getDateRange = (period: 'daily' | 'weekly' | 'monthly') => {
        switch (period) {
          case 'daily':
            return { start: todayStart, end: todayEnd };
          case 'monthly':
            return { start: monthStart, end: monthEnd };
          case 'weekly':
          default:
            return { start: weekStart, end: weekEnd };
        }
      };

      const paymentPeriod = query.payment_period || 'daily';
      const returnPaymentPeriod = query.return_payment_period || 'daily';
      const topProductsPeriod = query.top_products_period || 'daily';
      const paymentDateRange = getDateRange(paymentPeriod);
      const returnPaymentDateRange = getDateRange(returnPaymentPeriod);
      const topProductsDateRange = getDateRange(topProductsPeriod);

      const expiringUntil = new Date(todayEnd);
      expiringUntil.setUTCDate(expiringUntil.getUTCDate() + 30);

      const branchFilter = query.branch_id
        ? { branch_id: query.branch_id }
        : {};

      const baseWhere = {
        consumer_id: consumerId,
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        deleted_at: null, // Soft-deleted sales never count towards analytics
        ...branchFilter,
      };

      // Returns are counted in the period they were refunded in — the original
      // sale row is never rewritten.
      const returnBaseWhere = {
        consumer_id: consumerId,
        ...branchFilter,
      };

      const weeklyReturnWhere = {
        ...returnBaseWhere,
        return_date: { gte: weekStart, lte: weekEnd },
      };

      const todayReturnWhere = {
        ...returnBaseWhere,
        return_date: { gte: todayStart, lte: todayEnd },
      };

      const weeklyWhere = {
        ...baseWhere,
        sale_date: { gte: weekStart, lte: weekEnd },
      };

      const todayWhere = {
        ...baseWhere,
        sale_date: { gte: todayStart, lte: todayEnd },
      };

      const expiringBatchWhere = {
        variant: { product: { consumer_id: consumerId } },
        expiry_date: { gte: todayStart, lte: expiringUntil },
        quantity: { gt: 0 },
        ...branchFilter,
      };

      const paymentWhere = {
        ...baseWhere,
        sale_date: { gte: paymentDateRange.start, lte: paymentDateRange.end },
      };

      const returnPaymentWhere = {
        consumer_id: consumerId,
        return_date: {
          gte: returnPaymentDateRange.start,
          lte: returnPaymentDateRange.end,
        },
        ...branchFilter,
      };

      const topProductsWhere = {
        ...baseWhere,
        sale_date: {
          gte: topProductsDateRange.start,
          lte: topProductsDateRange.end,
        },
      };

      const rawSqlConditions = [
        Prisma.sql`consumer_id = ${consumerId}`,
        Prisma.sql`sale_type = 'sale'`,
        Prisma.sql`payment_status <> 'cancelled'`,
        Prisma.sql`deleted_at IS NULL`,
        Prisma.sql`sale_date BETWEEN ${weekStart} AND ${weekEnd}`,
      ];
      if (query.branch_id) {
        rawSqlConditions.push(Prisma.sql`branch_id = ${query.branch_id}`);
      }

      const rawWhereClause = Prisma.join(rawSqlConditions, ' AND ');

      const rawReturnConditions = [
        Prisma.sql`consumer_id = ${consumerId}`,
        Prisma.sql`return_date BETWEEN ${weekStart} AND ${weekEnd}`,
      ];
      if (query.branch_id) {
        rawReturnConditions.push(Prisma.sql`branch_id = ${query.branch_id}`);
      }

      const rawReturnWhereClause = Prisma.join(rawReturnConditions, ' AND ');
      const [
        weeklyAgg,
        todayAgg,
        weeklyReturnAgg,
        todayReturnAgg,
        weeklyReturnsByDay,
        weeklySalesByDay,
        paymentBreakdown,
        returnPaymentBreakdown,
        topProductsGrouped,
        lowStockItems,
        expiringBatches,
        totalExpiringCount,
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

        this.prisma.return.aggregate({
          where: weeklyReturnWhere,
          _count: { id: true },
          _sum: { total_refund: true },
        }),

        this.prisma.return.aggregate({
          where: todayReturnWhere,
          _count: { id: true },
          _sum: { total_refund: true },
        }),

        this.prisma.$queryRaw<
          Array<{ date: string; return_count: bigint; total_refund: number }>
        >`
          SELECT
            DATE(return_date)::text        AS date,
            COUNT(*)                       AS return_count,
            COALESCE(SUM(total_refund), 0) AS total_refund
          FROM "returns"
          WHERE ${rawReturnWhereClause}
          GROUP BY DATE(return_date)
          ORDER BY DATE(return_date) ASC
        `,

        // DB-side groupBy on date string avoids pulling every row
        this.prisma.$queryRaw<
          Array<{ date: string; sales_count: bigint; total_amount: number }>
        >`
          SELECT
            DATE(sale_date)::text          AS date,
            COUNT(*)                       AS sales_count,
            COALESCE(SUM(total_amount), 0) AS total_amount
          FROM "sales"
          WHERE ${rawWhereClause}
          GROUP BY DATE(sale_date)
          ORDER BY DATE(sale_date) ASC
        `,

        this.prisma.salePayment.groupBy({
          by: ['payment_method'],
          where: { sale: paymentWhere },
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { _sum: { amount: 'desc' } },
        }),

        this.prisma.returnPayment.groupBy({
          by: ['payment_method'],
          where: { return_record: returnPaymentWhere },
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { _sum: { amount: 'desc' } },
        }),

        this.prisma.saleItem.groupBy({
          by: ['variant_id'],
          where: { sale: topProductsWhere },
          _sum: { quantity: true, line_total: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),

        this.inventoryService.getLowStockItems(consumerId, query.branch_id),

        this.prisma.inventoryBatch.findMany({
          where: expiringBatchWhere,
          select: {
            id: true,
            batch_number: true,
            quantity: true,
            expiry_date: true,
            variant: {
              select: {
                name: true,
                product: { select: { name: true } },
              },
            },
            branch: { select: { name: true } },
          },
          orderBy: { expiry_date: 'asc' },
          take: 5,
        }),

        this.prisma.inventoryBatch.count({ where: expiringBatchWhere }),
      ]);

      // variant enrichment for top products (single batched query)
      const variantIds = topProductsGrouped.map((item) => item.variant_id);
      const variants = variantIds.length
        ? await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              name: true,
              sku: true,
              product: { select: { name: true } },
            },
          })
        : [];

      const variantMap = new Map(variants.map((v) => [v.id, v]));

      // Build response
      const refundsByDate = new Map(
        weeklyReturnsByDay.map((row) => [
          row.date,
          {
            count: Number(row.return_count),
            amount: Number(row.total_refund),
          },
        ]),
      );

      const trendDates = Array.from(
        new Set([
          ...weeklySalesByDay.map((row) => row.date),
          ...weeklyReturnsByDay.map((row) => row.date),
        ]),
      ).sort();

      const salesByDate = new Map(
        weeklySalesByDay.map((row) => [
          row.date,
          {
            count: Number(row.sales_count),
            amount: Number(row.total_amount),
          },
        ]),
      );

      const weeklySalesTrend: SalesTrendPoint[] = trendDates.map((date) => {
        const sales = salesByDate.get(date) ?? { count: 0, amount: 0 };
        const refunds = refundsByDate.get(date) ?? { count: 0, amount: 0 };

        return {
          date,
          sales_count: sales.count,
          total_amount: sales.amount,
          returns_count: refunds.count,
          returns_amount: refunds.amount,
          net_amount: sales.amount - refunds.amount,
        };
      });

      const topProducts = topProductsGrouped.map((item) => {
        const variant = variantMap.get(item.variant_id);
        return {
          variant_id: item.variant_id,
          variant_name: variant?.name ?? 'Unknown Variant',
          product_name: variant?.product?.name ?? 'Unknown Product',
          sku: variant?.sku ?? undefined,
          total_quantity: Number(item._sum.quantity ?? 0),
          total_amount: Number(item._sum.line_total ?? 0),
        };
      });

      const paymentMethodBreakdown = paymentBreakdown.map((item) => ({
        payment_method: item.payment_method,
        total_amount: Number(item._sum.amount ?? 0),
        transaction_count: item._count._all,
      }));

      const returnPaymentMethodBreakdown = returnPaymentBreakdown.map(
        (item) => ({
          payment_method: item.payment_method,
          total_amount: Number(item._sum.amount ?? 0),
          transaction_count: item._count._all,
        }),
      );

      const lowStock = {
        total_critical_items: lowStockItems.length,
        items: lowStockItems.slice(0, 5).map((item: any) => ({
          variant_id: item.id,
          product_name: item.product?.name ?? 'Unknown Product',
          variant_name: item.name ?? 'Unknown Variant',
          sku: item.sku ?? undefined,
          alert_quantity: item.alert_quantity ?? 0,
          total_stock: item.total_stock ?? 0,
          shortage: item.shortage ?? 0,
          affected_branch_name: item.affected_branch_name,
        })),
      };

      const expiringItems = {
        total_expiring_items: totalExpiringCount,
        items: expiringBatches.map((batch) => ({
          batch_id: batch.id,
          product_name: batch.variant?.product?.name ?? 'Unknown Product',
          variant_name: batch.variant?.name ?? 'Unknown Variant',
          batch_number: batch.batch_number,
          quantity: batch.quantity,
          expiry_date: (batch.expiry_date ?? new Date()).toISOString(),
          branch_name: batch.branch?.name,
        })),
      };

      const weeklyGross = Number(weeklyAgg._sum.total_amount ?? 0);
      const todayGross = Number(todayAgg._sum.total_amount ?? 0);
      const weeklyRefunds = Number(weeklyReturnAgg._sum.total_refund ?? 0);
      const todayRefunds = Number(todayReturnAgg._sum.total_refund ?? 0);

      return {
        summary: {
          // weekly_total_sale / today_total_sale stay GROSS so they reconcile
          // with the sales list; returns and net are reported alongside.
          weekly_total_sale: weeklyGross,
          weekly_transactions: weeklyAgg._count.id ?? 0,
          weekly_returns_total: weeklyRefunds,
          weekly_returns_count: weeklyReturnAgg._count.id ?? 0,
          weekly_net_sale: weeklyGross - weeklyRefunds,
          today_total_sale: todayGross,
          today_transactions: todayAgg._count.id ?? 0,
          today_returns_total: todayRefunds,
          today_returns_count: todayReturnAgg._count.id ?? 0,
          today_net_sale: todayGross - todayRefunds,
        },
        weekly_sales_trend: weeklySalesTrend,
        payment_method_breakdown: paymentMethodBreakdown,
        return_payment_breakdown: returnPaymentMethodBreakdown,
        top_products: topProducts,
        low_stock: lowStock,
        expiring_items: expiringItems,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;

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
