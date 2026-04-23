import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductAuditQueryDto } from './dto/product-audit-query.dto';

@Injectable()
export class ProductAuditService {
  private readonly logger = new Logger(ProductAuditService.name);

  constructor(private prisma: PrismaService) {}

  async getAuditData(consumerId: number, query: ProductAuditQueryDto) {
    const { variant_id, start_date, end_date, branch_id } = query;

    const startDate = new Date(start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    // Verify variant belongs to consumer
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variant_id, product: { consumer_id: consumerId } },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
          },
        },
        sale_unit: { select: { id: true, name: true } },
        purchase_unit: { select: { id: true, name: true } },
        VariantAttribute: true,
      },
    });
    if (!variant) throw new NotFoundException('Product variant not found');

    const branchWhere = branch_id ? { branch_id } : {};
    const dateRange = { gte: startDate, lte: endDate };

    const [
      activeBatches,
      purchasesInPeriod,
      adjustments,
      transfers,
      salesItems,
      returnItems,
      consumer,
    ] = await Promise.all([
      // All active batches for this variant (current snapshot)
      this.prisma.inventoryBatch.findMany({
        where: { variant_id, ...branchWhere, quantity: { gt: 0 } },
        include: {
          branch: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
      }),

      // Purchases (new batches created) in period
      this.prisma.inventoryBatch.findMany({
        where: { variant_id, ...branchWhere, created_at: dateRange },
        include: {
          branch: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { created_at: 'asc' },
      }),

      // Inventory adjustments in period
      this.prisma.inventoryAdjustment.findMany({
        where: { variant_id, ...branchWhere, created_at: dateRange },
        include: {
          branch: { select: { id: true, name: true } },
          batch: { select: { id: true, batch_number: true } },
          created_by_user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { created_at: 'asc' },
      }),

      // Transfers involving this variant (via batches) in period
      this.prisma.inventoryTransfer.findMany({
        where: {
          ...(branch_id
            ? {
                OR: [
                  { source_branch_id: branch_id },
                  { destination_branch_id: branch_id },
                ],
              }
            : {}),
          items: { some: { batch: { variant_id } } },
          created_at: dateRange,
        },
        include: {
          source_branch: { select: { id: true, name: true } },
          destination_branch: { select: { id: true, name: true } },
          created_by_user: { select: { id: true, name: true, email: true } },
          items: {
            where: { batch: { variant_id } },
            include: {
              batch: {
                select: { id: true, batch_number: true, cost_price: true },
              },
            },
          },
        },
        orderBy: { created_at: 'asc' },
      }),

      // Sale items for this variant in period
      this.prisma.saleItem.findMany({
        where: {
          variant_id,
          sale: {
            consumer_id: consumerId,
            sale_date: dateRange,
            sale_type: 'sale',
            payment_status: { not: 'cancelled' },
            ...(branch_id ? { branch_id } : {}),
          },
        },
        include: {
          sale: {
            include: {
              user: { select: { id: true, name: true } },
              served_by: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true } },
              customer: { select: { id: true, name: true, phone: true } },
              promotion: { select: { id: true, name: true, discount_type: true } },
            },
          },
          batch: { select: { id: true, batch_number: true } },
        },
        orderBy: { sale: { sale_date: 'asc' } },
      }),

      // Return items for this variant in period
      this.prisma.returnItem.findMany({
        where: {
          variant_id,
          return_record: {
            consumer_id: consumerId,
            return_date: dateRange,
            ...(branch_id ? { branch_id } : {}),
          },
        },
        include: {
          return_record: {
            include: {
              branch: { select: { id: true, name: true } },
              user: { select: { id: true, name: true } },
            },
          },
          batch: { select: { id: true, batch_number: true } },
        },
        orderBy: { return_record: { return_date: 'asc' } },
      }),

      // Consumer info for PDF header
      this.prisma.consumer.findUnique({
        where: { id: consumerId },
        select: { id: true, company_name: true, email: true, phone: true, address: true },
      }),
    ]);

    // Compute sales summary
    const salesSummary = this.computeSalesSummary(salesItems);

    // Compute return summary
    const totalReturnedUnits = returnItems.reduce((s, r) => s + r.quantity, 0);

    // Stock stats
    const totalCurrentStock = activeBatches.reduce((s, b) => s + b.quantity, 0);
    const batchesExpiringSoon = activeBatches.filter((b) => {
      if (!b.expiry_date) return false;
      const days = (b.expiry_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    });
    const expiredBatches = activeBatches.filter(
      (b) => b.expiry_date && b.expiry_date < new Date(),
    );

    return {
      meta: {
        consumer,
        variant: {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
          regular_price: variant.regular_price,
          wholesale_price: variant.wholesale_price,
          sale_unit: variant.sale_unit,
          purchase_unit: variant.purchase_unit,
          alert_quantity: variant.alert_quantity,
          attributes: variant.VariantAttribute,
          product: {
            id: variant.product.id,
            name: variant.product.name,
            code: variant.product.code,
            category: variant.product.category,
            brand: variant.product.brand,
            tax: variant.product.tax,
            tax_method: variant.product.tax_method,
          },
        },
        period: { start_date, end_date },
        branch_id: branch_id ?? null,
        generated_at: new Date().toISOString(),
      },
      stock_snapshot: {
        total_current_stock: totalCurrentStock,
        total_active_batches: activeBatches.length,
        batches_expiring_within_30_days: batchesExpiringSoon.length,
        expired_batches_with_stock: expiredBatches.length,
        batches: activeBatches.map((b) => ({
          id: b.id,
          batch_number: b.batch_number,
          quantity: b.quantity,
          cost_price: b.cost_price,
          expiry_date: b.expiry_date,
          branch: b.branch,
          vendor: b.vendor,
          created_at: b.created_at,
        })),
      },
      purchases: purchasesInPeriod.map((b) => ({
        id: b.id,
        batch_number: b.batch_number,
        date: b.created_at,
        original_quantity: b.original_quantity,   // units received at purchase time
        remaining_quantity: b.quantity,            // units still in stock
        consumed_quantity: b.original_quantity - b.quantity, // units sold/adjusted/transferred out
        cost_price: b.cost_price,
        total_cost: Number(b.cost_price) * b.original_quantity,
        vendor: b.vendor,
        branch: b.branch,
        expiry_date: b.expiry_date,
      })),
      purchases_summary: {
        total_batches: purchasesInPeriod.length,
        total_units_purchased: purchasesInPeriod.reduce((s, b) => s + b.original_quantity, 0),
        total_cost: purchasesInPeriod.reduce(
          (s, b) => s + Number(b.cost_price) * b.original_quantity,
          0,
        ),
      },
      adjustments: adjustments.map((a) => ({
        id: a.id,
        date: a.created_at,
        type: a.quantity_change > 0 ? 'addition' : 'reduction',
        quantity_change: a.quantity_change,
        reason: a.reason,
        notes: a.notes,
        batch: a.batch,
        branch: a.branch,
        created_by: a.created_by_user,
      })),
      adjustments_summary: {
        total_additions: adjustments
          .filter((a) => a.quantity_change > 0)
          .reduce((s, a) => s + a.quantity_change, 0),
        total_reductions: Math.abs(
          adjustments
            .filter((a) => a.quantity_change < 0)
            .reduce((s, a) => s + a.quantity_change, 0),
        ),
      },
      transfers: transfers.map((t) => ({
        id: t.id,
        initiated_at: t.created_at,
        completed_at: t.completed_date,
        status: t.status,
        source_branch: t.source_branch,
        destination_branch: t.destination_branch,
        created_by: t.created_by_user,
        notes: t.notes,
        items: t.items.map((i) => ({
          batch_number: i.batch.batch_number,
          cost_price: i.batch.cost_price,
          quantity: i.quantity,
        })),
        total_quantity: t.items.reduce((s, i) => s + i.quantity, 0),
      })),
      sales: salesItems.map((si) => ({
        sale_id: si.sale_id,
        sale_number: si.sale.sale_number,
        date: si.sale.sale_date,
        quantity: si.quantity,
        unit_price: si.unit_price,
        sold_unit_price: si.sold_unit_price,
        price_type: si.sale.price_type,
        special_discount: si.special_discount_amount,
        average_discount: si.average_discount_amount,
        promotion_discount: si.promotion_discount_amount,
        total_discount:
          Number(si.special_discount_amount) +
          Number(si.average_discount_amount) +
          Number(si.promotion_discount_amount),
        line_total: si.line_total,
        promotion: si.sale.promotion,
        batch: si.batch,
        branch: si.sale.branch,
        cashier: si.sale.user ?? si.sale.served_by,
        customer: si.sale.customer ?? {
          name: si.sale.customer_name,
          phone: si.sale.customer_phone,
        },
        payment_status: si.sale.payment_status,
      })),
      sales_summary: salesSummary,
      returns: returnItems.map((ri) => ({
        return_id: ri.return_id,
        return_number: ri.return_record.return_number,
        date: ri.return_record.return_date,
        quantity: ri.quantity,
        batch: ri.batch,
        branch: ri.return_record.branch,
        processed_by: ri.return_record.user,
      })),
      returns_summary: {
        total_units_returned: totalReturnedUnits,
        total_return_transactions: returnItems.length,
      },
    };
  }

  private computeSalesSummary(salesItems: any[]) {
    let totalUnitsSold = 0;
    let totalRevenue = 0;
    let totalSpecialDiscount = 0;
    let totalAvgDiscount = 0;
    let totalPromoDiscount = 0;
    let promoSaleCount = 0;
    let wholesaleCount = 0;
    let regularCount = 0;

    for (const si of salesItems) {
      totalUnitsSold += si.quantity;
      totalRevenue += Number(si.line_total);
      totalSpecialDiscount += Number(si.special_discount_amount);
      totalAvgDiscount += Number(si.average_discount_amount);
      totalPromoDiscount += Number(si.promotion_discount_amount);
      if (si.applied_promotion_id || Number(si.promotion_discount_amount) > 0) promoSaleCount++;
      if (si.sale.price_type === 'wholesale') wholesaleCount++;
      else regularCount++;
    }

    return {
      total_units_sold: totalUnitsSold,
      total_revenue: totalRevenue,
      total_special_discount: totalSpecialDiscount,
      total_average_discount: totalAvgDiscount,
      total_promotion_discount: totalPromoDiscount,
      total_discount: totalSpecialDiscount + totalAvgDiscount + totalPromoDiscount,
      regular_price_sales_count: regularCount,
      wholesale_price_sales_count: wholesaleCount,
      promotional_line_items: promoSaleCount,
      gross_revenue: totalRevenue + totalSpecialDiscount + totalAvgDiscount + totalPromoDiscount,
    };
  }
}
