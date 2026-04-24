import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const dateRange = { gte: startDate, lte: endDate };

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

    // ── Shared includes ────────────────────────────────────────────────────────
    const batchInclude = {
      branch: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true, phone: true, email: true } },
    } as const;

    const adjInclude = {
      branch: { select: { id: true, name: true } },
      batch: { select: { id: true, batch_number: true } },
      created_by_user: { select: { id: true, name: true, email: true } },
    } as const;

    const transferInclude = {
      source_branch: { select: { id: true, name: true } },
      destination_branch: { select: { id: true, name: true } },
      created_by_user: { select: { id: true, name: true, email: true } },
      items: {
        where: {
          batch: { variant_id },
        } as Prisma.InventoryTransferItemWhereInput,
        include: {
          batch: { select: { id: true, batch_number: true, cost_price: true } },
        },
      },
    } as const;

    // ── Typed where clauses (avoids union-type inference failures) ─────────────

    // FIX #7: All batches including zero-qty for full ledger
    const allBatchesWhere: Prisma.InventoryBatchWhereInput = {
      variant_id,
      ...(branch_id ? { branch_id } : {}),
    };

    // FIX #3: Real vendor purchases only (source = 'purchase')
    const purchasesWhere: Prisma.InventoryBatchWhereInput = {
      variant_id,
      ...(branch_id ? { branch_id } : {}),
      source: 'purchase',
      created_at: dateRange,
    };

    // FIX #3: Transfer-received batches (source = 'transfer_in')
    const transferInBatchesWhere: Prisma.InventoryBatchWhereInput = {
      variant_id,
      ...(branch_id ? { branch_id } : {}),
      source: 'transfer_in',
      created_at: dateRange,
    };

    // FIX #5: Manual adjustments only
    const manualAdjWhere: Prisma.InventoryAdjustmentWhereInput = {
      variant_id,
      ...(branch_id ? { branch_id } : {}),
      created_at: dateRange,
      adjustment_type: 'manual',
    };

    // FIX #5: Return-restock adjustments
    const returnAdjWhere: Prisma.InventoryAdjustmentWhereInput = {
      variant_id,
      ...(branch_id ? { branch_id } : {}),
      created_at: dateRange,
      adjustment_type: 'return_in',
    };

    // FIX #6: Exchange-out adjustments
    const exchangeAdjWhere: Prisma.InventoryAdjustmentWhereInput = {
      variant_id,
      ...(branch_id ? { branch_id } : {}),
      created_at: dateRange,
      adjustment_type: 'exchange_out',
    };

    // FIX #1/#9: Completed transfers — date-keyed on completed_date (when stock actually moved)
    const completedTransferWhere: Prisma.InventoryTransferWhereInput = {
      status: 'completed',
      completed_date: dateRange,
      ...(branch_id
        ? {
            OR: [
              { source_branch_id: branch_id },
              { destination_branch_id: branch_id },
            ],
          }
        : {}),
      items: { some: { batch: { variant_id } } },
    };

    // FIX #9: Pending transfers shown separately (stock has NOT moved yet)
    const pendingTransferWhere: Prisma.InventoryTransferWhereInput = {
      status: 'pending',
      created_at: dateRange,
      ...(branch_id
        ? {
            OR: [
              { source_branch_id: branch_id },
              { destination_branch_id: branch_id },
            ],
          }
        : {}),
      items: { some: { batch: { variant_id } } },
    };

    const salesWhere: Prisma.SaleItemWhereInput = {
      variant_id,
      sale: {
        consumer_id: consumerId,
        sale_date: dateRange,
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        ...(branch_id ? { branch_id } : {}),
      },
    };

    const returnsWhere: Prisma.ReturnItemWhereInput = {
      variant_id,
      return_record: {
        consumer_id: consumerId,
        return_date: dateRange,
        ...(branch_id ? { branch_id } : {}),
      },
    };

    // ── Fire all queries in parallel ──────────────────────────────────────────
    const [
      consumer,
      allBatchesForVariant,
      purchasesInPeriod,
      transferReceivedBatchesInPeriod,
      manualAdjustments,
      returnAdjustments,
      exchangeAdjustments,
      completedTransfers,
      pendingTransfers,
      salesItems,
      returnItems,
    ] = await Promise.all([
      this.prisma.consumer.findUnique({
        where: { id: consumerId },
        select: {
          id: true,
          company_name: true,
          email: true,
          phone: true,
          address: true,
        },
      }),

      // FIX #7: all batches (zero-qty included) for per-batch ledger
      this.prisma.inventoryBatch.findMany({
        where: allBatchesWhere,
        include: batchInclude,
        orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
      }),

      // FIX #3: real vendor purchases only
      this.prisma.inventoryBatch.findMany({
        where: purchasesWhere,
        include: batchInclude,
        orderBy: { created_at: 'asc' },
      }),

      // FIX #3: transfer-received batches (inbound via transfer)
      this.prisma.inventoryBatch.findMany({
        where: transferInBatchesWhere,
        include: batchInclude,
        orderBy: { created_at: 'asc' },
      }),

      // FIX #5: manual adjustments only
      this.prisma.inventoryAdjustment.findMany({
        where: manualAdjWhere,
        include: adjInclude,
        orderBy: { created_at: 'asc' },
      }),

      // FIX #5: return-restock adjustments (separate section)
      this.prisma.inventoryAdjustment.findMany({
        where: returnAdjWhere,
        include: adjInclude,
        orderBy: { created_at: 'asc' },
      }),

      // FIX #6: exchange-out adjustments (separate section)
      this.prisma.inventoryAdjustment.findMany({
        where: exchangeAdjWhere,
        include: adjInclude,
        orderBy: { created_at: 'asc' },
      }),

      // FIX #1/#9: completed transfers filtered by completed_date
      this.prisma.inventoryTransfer.findMany({
        where: completedTransferWhere,
        include: transferInclude,
        orderBy: { completed_date: 'asc' },
      }),

      // FIX #9: pending transfers (stock NOT moved yet)
      this.prisma.inventoryTransfer.findMany({
        where: pendingTransferWhere,
        include: transferInclude,
        orderBy: { created_at: 'asc' },
      }),

      this.prisma.saleItem.findMany({
        where: salesWhere,
        include: {
          sale: {
            include: {
              user: { select: { id: true, name: true } },
              served_by: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true } },
              customer: { select: { id: true, name: true, phone: true } },
              promotion: {
                select: { id: true, name: true, discount_type: true },
              },
            },
          },
          batch: { select: { id: true, batch_number: true } },
        },
        orderBy: { sale: { sale_date: 'asc' } },
      }),

      this.prisma.returnItem.findMany({
        where: returnsWhere,
        include: {
          return_record: {
            include: {
              branch: { select: { id: true, name: true } },
              user: { select: { id: true, name: true } },
              original_sale: { select: { id: true, sale_number: true } },
            },
          },
          batch: { select: { id: true, batch_number: true } },
        },
        orderBy: { return_record: { return_date: 'asc' } },
      }),
    ]);

    // ── FIX #7: Separate active batches for current snapshot ──────────────────
    const activeBatches = allBatchesForVariant.filter((b) => b.quantity > 0);
    const totalCurrentStock = activeBatches.reduce((s, b) => s + b.quantity, 0);

    const batchesExpiringSoon = activeBatches.filter((b) => {
      if (!b.expiry_date) return false;
      const days =
        (b.expiry_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days >= 0 && days <= 30;
    });
    const expiredBatches = activeBatches.filter(
      (b) => b.expiry_date && b.expiry_date < new Date(),
    );

    // ── FIX #4: Per-batch movement maps ──────────────────────────────────────
    const batchSoldMap = new Map<number, number>();
    const batchReturnedMap = new Map<number, number>();
    const batchAdjustedOutMap = new Map<number, number>();
    const batchAdjustedInMap = new Map<number, number>();
    const batchTransferredOutMap = new Map<number, number>();

    for (const si of salesItems) {
      if (si.batch_id != null) {
        batchSoldMap.set(
          si.batch_id,
          (batchSoldMap.get(si.batch_id) ?? 0) + si.quantity,
        );
      }
    }
    for (const ri of returnItems) {
      if (ri.batch_id != null) {
        batchReturnedMap.set(
          ri.batch_id,
          (batchReturnedMap.get(ri.batch_id) ?? 0) + ri.quantity,
        );
      }
    }
    for (const adj of [
      ...manualAdjustments,
      ...returnAdjustments,
      ...exchangeAdjustments,
    ]) {
      if (adj.quantity_change < 0) {
        batchAdjustedOutMap.set(
          adj.batch_id,
          (batchAdjustedOutMap.get(adj.batch_id) ?? 0) +
            Math.abs(adj.quantity_change),
        );
      } else {
        batchAdjustedInMap.set(
          adj.batch_id,
          (batchAdjustedInMap.get(adj.batch_id) ?? 0) + adj.quantity_change,
        );
      }
    }
    for (const t of completedTransfers) {
      for (const ti of t.items) {
        batchTransferredOutMap.set(
          ti.batch_id,
          (batchTransferredOutMap.get(ti.batch_id) ?? 0) + ti.quantity,
        );
      }
    }

    // ── FIX #8: Tag each completed transfer with direction ────────────────────
    const taggedCompletedTransfers = completedTransfers.map((t) => ({
      ...t,
      direction: branch_id
        ? t.source_branch_id === branch_id
          ? 'outbound'
          : 'inbound'
        : 'outbound',
    }));

    // ── Sales summary ─────────────────────────────────────────────────────────
    const salesSummary = this.computeSalesSummary(salesItems);

    // ── Period-level stock flow numbers ───────────────────────────────────────
    const totalPurchasedInPeriod = purchasesInPeriod.reduce(
      (s, b) => s + b.original_quantity,
      0,
    );
    const totalTransferInInPeriod = transferReceivedBatchesInPeriod.reduce(
      (s, b) => s + b.original_quantity,
      0,
    );
    const totalTransferOutInPeriod = taggedCompletedTransfers
      .filter((t) => !branch_id || t.source_branch_id === branch_id)
      .reduce((s, t) => s + t.items.reduce((ts, i) => ts + i.quantity, 0), 0);
    const totalSoldInPeriod = salesSummary.total_units_sold;
    const totalReturnedInPeriod = returnItems.reduce(
      (s, r) => s + r.quantity,
      0,
    );
    const totalManualAdditions = manualAdjustments
      .filter((a) => a.quantity_change > 0)
      .reduce((s, a) => s + a.quantity_change, 0);
    const totalManualReductions = Math.abs(
      manualAdjustments
        .filter((a) => a.quantity_change < 0)
        .reduce((s, a) => s + a.quantity_change, 0),
    );
    const totalExchangeOut = exchangeAdjustments.reduce(
      (s, a) => s + Math.abs(a.quantity_change),
      0,
    );

    // ── FIX #7: Estimate opening stock by reversing period activity ───────────
    // Formula: opening = current - in_flows + out_flows
    // in_flows  = purchased + transferred_in + returned_in + manually_added
    // out_flows = sold + transferred_out + manually_reduced + exchanged_out
    const estimatedOpeningStock = Math.max(
      0,
      totalCurrentStock -
        totalPurchasedInPeriod -
        totalTransferInInPeriod -
        totalReturnedInPeriod -
        totalManualAdditions +
        totalTransferOutInPeriod +
        totalSoldInPeriod +
        totalManualReductions +
        totalExchangeOut,
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

      // ── FIX #7: Live snapshot + estimated opening stock ────────────────────
      stock_snapshot: {
        note: 'current_stock reflects live stock at report generation time. opening_stock is estimated by reversing period activity.',
        estimated_opening_stock: estimatedOpeningStock,
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
          source: b.source,
          created_at: b.created_at,
        })),
      },

      // ── FIX #3: Real vendor purchases only (source='purchase') ────────────
      purchases: purchasesInPeriod.map((b) => ({
        id: b.id,
        batch_number: b.batch_number,
        date: b.created_at,
        original_quantity: b.original_quantity,
        remaining_quantity: b.quantity,
        // ── FIX #4: Per-batch movement breakdown ─────────────────────────────
        sold_from_batch: batchSoldMap.get(b.id) ?? 0,
        returned_to_batch: batchReturnedMap.get(b.id) ?? 0,
        adjusted_out_from_batch: batchAdjustedOutMap.get(b.id) ?? 0,
        adjusted_in_to_batch: batchAdjustedInMap.get(b.id) ?? 0,
        transferred_out_from_batch: batchTransferredOutMap.get(b.id) ?? 0,
        cost_price: b.cost_price,
        total_cost: Number(b.cost_price) * b.original_quantity,
        vendor: b.vendor,
        branch: b.branch,
        expiry_date: b.expiry_date,
      })),
      purchases_summary: {
        total_batches: purchasesInPeriod.length,
        total_units_purchased: purchasesInPeriod.reduce(
          (s, b) => s + b.original_quantity,
          0,
        ),
        total_cost: purchasesInPeriod.reduce(
          (s, b) => s + Number(b.cost_price) * b.original_quantity,
          0,
        ),
      },

      // ── FIX #3: Transfer-received batches (source='transfer_in') ──────────
      // These are stock arrivals at the destination branch via a completed transfer.
      transfer_received_batches: transferReceivedBatchesInPeriod.map((b) => ({
        id: b.id,
        batch_number: b.batch_number,
        date: b.created_at,
        original_quantity: b.original_quantity,
        remaining_quantity: b.quantity,
        // FIX #4: per-batch breakdown for transfer-in batches too
        sold_from_batch: batchSoldMap.get(b.id) ?? 0,
        returned_to_batch: batchReturnedMap.get(b.id) ?? 0,
        adjusted_out_from_batch: batchAdjustedOutMap.get(b.id) ?? 0,
        transferred_out_from_batch: batchTransferredOutMap.get(b.id) ?? 0,
        cost_price: b.cost_price,
        branch: b.branch,
        expiry_date: b.expiry_date,
      })),
      transfer_received_summary: {
        total_batches: transferReceivedBatchesInPeriod.length,
        total_units_received: totalTransferInInPeriod,
      },

      // ── FIX #5: Manual adjustments only (return/exchange noise excluded) ──
      adjustments: manualAdjustments.map((a) => ({
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
        total_additions: manualAdjustments
          .filter((a) => a.quantity_change > 0)
          .reduce((s, a) => s + a.quantity_change, 0),
        total_reductions: Math.abs(
          manualAdjustments
            .filter((a) => a.quantity_change < 0)
            .reduce((s, a) => s + a.quantity_change, 0),
        ),
      },

      // ── FIX #1/#8/#9: Transfers split into completed vs pending ───────────
      transfers: {
        // Completed: filtered by completed_date — stock HAS moved
        completed: taggedCompletedTransfers.map((t) => ({
          id: t.id,
          initiated_at: t.created_at,
          completed_at: t.completed_date,
          // FIX #8: direction from the queried branch's perspective
          direction: t.direction,
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
        // FIX #9: Pending — stock has NOT moved yet, shown clearly separate
        pending: pendingTransfers.map((t) => ({
          id: t.id,
          initiated_at: t.created_at,
          // FIX #8: direction label even for pending transfers
          direction: branch_id
            ? t.source_branch_id === branch_id
              ? 'outbound'
              : 'inbound'
            : 'outbound',
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
          warning: 'Stock has NOT been moved yet — transfer is still pending',
        })),
      },
      transfers_summary: {
        total_outbound_units: taggedCompletedTransfers
          .filter((t) => !branch_id || t.source_branch_id === branch_id)
          .reduce(
            (s, t) => s + t.items.reduce((ts, i) => ts + i.quantity, 0),
            0,
          ),
        total_inbound_units: taggedCompletedTransfers
          .filter((t) => !!branch_id && t.destination_branch_id === branch_id)
          .reduce(
            (s, t) => s + t.items.reduce((ts, i) => ts + i.quantity, 0),
            0,
          ),
        total_pending_units: pendingTransfers.reduce(
          (s, t) => s + t.items.reduce((ts, i) => ts + i.quantity, 0),
          0,
        ),
      },

      // ── Sales ─────────────────────────────────────────────────────────────
      sales: salesItems.map((si) => ({
        sale_id: si.sale_id,
        sale_number: si.sale.sale_number,
        date: si.sale.sale_date,
        quantity: si.quantity,
        unit_price: si.unit_price,
        sold_unit_price: si.sold_unit_price ?? null,
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

      // ── Returns (customer returning goods to store) ───────────────────────
      returns: returnItems.map((ri) => ({
        return_id: ri.return_id,
        return_number: ri.return_record.return_number,
        date: ri.return_record.return_date,
        quantity: ri.quantity,
        batch: ri.batch,
        branch: ri.return_record.branch,
        original_sale_number:
          ri.return_record.original_sale?.sale_number ?? null,
        processed_by: ri.return_record.user,
      })),
      returns_summary: {
        total_units_returned: totalReturnedInPeriod,
        total_return_transactions: returnItems.length,
      },

      // ── FIX #6: Exchange-out events (stock leaving as exchange) ──────────
      exchange_outs: exchangeAdjustments.map((a) => ({
        id: a.id,
        date: a.created_at,
        quantity_deducted: Math.abs(a.quantity_change),
        reason: a.reason,
        notes: a.notes,
        batch: a.batch,
        branch: a.branch,
        processed_by: a.created_by_user,
      })),
      exchange_outs_summary: {
        total_units_exchanged_out: totalExchangeOut,
        total_exchange_transactions: exchangeAdjustments.length,
      },

      // ── FIX #5: Return restocks (stock added back from customer returns) ──
      return_restocks: returnAdjustments.map((a) => ({
        id: a.id,
        date: a.created_at,
        quantity_restocked: a.quantity_change,
        reason: a.reason,
        notes: a.notes,
        batch: a.batch,
        branch: a.branch,
        processed_by: a.created_by_user,
      })),
      return_restocks_summary: {
        total_units_restocked: returnAdjustments.reduce(
          (s, a) => s + a.quantity_change,
          0,
        ),
        total_restock_transactions: returnAdjustments.length,
      },

      // ── Full stock-flow reconciliation ledger ─────────────────────────────
      // Verification: reconciliation_check should equal current_stock.
      // opening + in_flows - out_flows = current_stock
      stock_flow_summary: {
        estimated_opening_stock: estimatedOpeningStock,
        // IN flows during the period
        purchased_in: totalPurchasedInPeriod,
        transferred_in: totalTransferInInPeriod,
        returned_in: totalReturnedInPeriod,
        manually_added: totalManualAdditions,
        // OUT flows during the period
        sold_out: totalSoldInPeriod,
        transferred_out: totalTransferOutInPeriod,
        manually_reduced: totalManualReductions,
        exchanged_out: totalExchangeOut,
        // Live stock
        current_stock: totalCurrentStock,
        // Should equal current_stock if all movements are accounted for
        reconciliation_check:
          estimatedOpeningStock +
          totalPurchasedInPeriod +
          totalTransferInInPeriod +
          totalReturnedInPeriod +
          totalManualAdditions -
          totalSoldInPeriod -
          totalTransferOutInPeriod -
          totalManualReductions -
          totalExchangeOut,
      },
    };
  }

  private computeSalesSummary(
    salesItems: Array<{
      quantity: number;
      line_total: Prisma.Decimal | number | string;
      special_discount_amount: Prisma.Decimal | number | string;
      average_discount_amount: Prisma.Decimal | number | string;
      promotion_discount_amount: Prisma.Decimal | number | string;
      applied_promotion_id?: number | null;
      sale: { price_type: string };
    }>,
  ) {
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
      if (si.applied_promotion_id || Number(si.promotion_discount_amount) > 0)
        promoSaleCount++;
      if (si.sale.price_type === 'wholesale') wholesaleCount++;
      else regularCount++;
    }

    return {
      total_units_sold: totalUnitsSold,
      total_revenue: totalRevenue,
      total_special_discount: totalSpecialDiscount,
      total_average_discount: totalAvgDiscount,
      total_promotion_discount: totalPromoDiscount,
      total_discount:
        totalSpecialDiscount + totalAvgDiscount + totalPromoDiscount,
      regular_price_sales_count: regularCount,
      wholesale_price_sales_count: wholesaleCount,
      promotional_line_items: promoSaleCount,
      gross_revenue:
        totalRevenue +
        totalSpecialDiscount +
        totalAvgDiscount +
        totalPromoDiscount,
    };
  }
}
