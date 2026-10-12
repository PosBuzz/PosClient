import { Injectable, BadRequestException } from '@nestjs/common';
import { GetProductAuditDto } from '../dto/get-product-audit.dto';
import { ProductAuditPdfService } from './product-audit-pdf.service';
import { InventoryAuditLog } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductAuditService {
  // private readonly logger = new Logger(ProductAuditService.name);
  constructor(
    private prisma: PrismaService,
    private pdfService: ProductAuditPdfService,
  ) {}

  async getAuditData(consumerId: number, dto: GetProductAuditDto) {
    return this.buildAuditData(consumerId, dto);
  }

  async generateAuditReport(
    consumerId: number,
    dto: GetProductAuditDto,
  ): Promise<Buffer> {
    const data = await this.buildAuditData(consumerId, dto);
    return this.pdfService.generatePdf(data);
  }

  private async buildAuditData(consumerId: number, dto: GetProductAuditDto) {
    const start = new Date(dto.start_date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dto.end_date);
    end.setHours(23, 59, 59, 999);

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variant_id, product: { consumer_id: consumerId } },
      include: {
        product: { include: { category: true, brand: true } },
        sale_unit: true,
        VariantAttribute: true,
      },
    });

    if (!variant) throw new BadRequestException('Variant not found');

    const consumer = await this.prisma.consumer.findUnique({
      where: { id: consumerId },
    });

    const currentBatches = await this.prisma.inventoryBatch.findMany({
      where: {
        variant_id: dto.variant_id,
        ...(dto.branch_id ? { branch_id: dto.branch_id } : {}),
      },
      include: { branch: true, vendor: true },
      orderBy: { created_at: 'asc' },
    });

    const totalCurrentStock = currentBatches.reduce(
      (sum, b) => sum + b.quantity,
      0,
    );

    const logs = await this.prisma.inventoryAuditLog.findMany({
      where: {
        consumer_id: consumerId,
        variant_id: dto.variant_id,
        created_at: { gte: start, lte: end },
        ...(dto.branch_id ? { branch_id: dto.branch_id } : {}),
      },
      include: {
        inventoryBatch: { include: { branch: true, vendor: true } },
        branch: true,
        created_by: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    // --- OVERALL CALCULATIONS ---
    const netChange = logs.reduce((sum, log) => sum + log.quantity_delta, 0);
    const openingStock = totalCurrentStock - netChange;

    // --- BRANCH SPECIFIC CALCULATIONS ---
    // Find all unique branches involved (either holding stock now, or had movement in period)
    const branchIds = new Set<number>();
    currentBatches.forEach((b) => b.branch_id && branchIds.add(b.branch_id));
    logs.forEach((l) => l.branch_id && branchIds.add(l.branch_id));

    const byBranch = Array.from(branchIds).map((branchId) => {
      const branchBatches = currentBatches.filter(
        (b) => b.branch_id === branchId,
      );
      const branchLogs = logs.filter((l) => l.branch_id === branchId);

      const branchCurrentStock = branchBatches.reduce(
        (sum, b) => sum + b.quantity,
        0,
      );
      const branchNetChange = branchLogs.reduce(
        (sum, l) => sum + l.quantity_delta,
        0,
      );
      const branchOpeningStock = branchCurrentStock - branchNetChange;

      // Safely get branch name from either current batches or logs
      const branchName =
        branchBatches[0]?.branch?.name ||
        branchLogs[0]?.branch?.name ||
        `Branch ${branchId}`;

      return {
        branch_id: branchId,
        branch_name: branchName,
        opening_stock: branchOpeningStock,
        current_stock: branchCurrentStock,
        net_change: branchNetChange,
        total_events: branchLogs.length,
      };
    });

    // --- GROUP LOGS BY BATCH (For Timeline) ---
    const batchGroups = new Map<number, any>();

    currentBatches.forEach((batch) => {
      batchGroups.set(batch.id, {
        batchInfo: batch,
        events: [],
        periodStartQty: 0,
      });
    });

    logs.forEach((log) => {
      const batchId = log.batch_id;
      if (!batchId) return;

      if (!batchGroups.has(batchId)) {
        batchGroups.set(batchId, {
          batchInfo: log.inventoryBatch || {
            id: batchId,
            batch_number: 'Historical',
            branch: log.branch,
          },
          events: [],
          periodStartQty: 0,
        });
      }

      batchGroups.get(batchId).events.push(log);
    });

    batchGroups.forEach((group) => {
      const currentQty = group.batchInfo.quantity || 0;
      const periodDelta = group.events.reduce(
        (sum: number, e: Pick<InventoryAuditLog, 'quantity_delta'>) =>
          sum + e.quantity_delta,
        0,
      );
      group.periodStartQty = currentQty - periodDelta;
    });

    // 7. Return formatted data
    return {
      meta: {
        consumer,
        variant,
        period: { start_date: dto.start_date, end_date: dto.end_date },
        branch_id: dto.branch_id,
        generated_at: new Date(),
      },
      summary: {
        opening_stock: openingStock,
        current_stock: totalCurrentStock,
        net_change: netChange,
        total_events: logs.length,
        by_branch: byBranch, // <-- NEW FIELD
      },
      batches: Array.from(batchGroups.values()).sort((a, b) => {
        const aDate = a.events[0]?.created_at || a.batchInfo.created_at;
        const bDate = b.events[0]?.created_at || b.batchInfo.created_at;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      }),
    };
  }
}
