import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportColumn, ImportRowError, ParsedRow } from '../import.types';
import { RowValidator } from './row-validator';

interface PreparedBatch {
  rowNumber: number;
  variant_id: number;
  branch_id: number;
  batch_number: string;
  quantity: number;
  cost_price: number;
  location?: string;
  expiry_date?: Date;
  vendor_id?: number;
}

@Injectable()
export class InventoryImportService {
  constructor(private readonly prisma: PrismaService) {}

  readonly sheetName = 'Stock Intake';

  readonly columns: ImportColumn[] = [
    {
      header: 'SKU',
      required: false,
      hint: 'SKU of the variant receiving stock. Fill in either SKU or Barcode — SKU wins if both are given.',
      example: 'BTH-100-BLK',
    },
    {
      header: 'Barcode',
      required: false,
      hint: 'Barcode of the variant, used when SKU is empty.',
      example: '8801234567890',
    },
    {
      header: 'Branch',
      required: true,
      hint: 'Branch name receiving the stock. It must already exist.',
      example: 'Main',
    },
    {
      header: 'Batch Number',
      required: false,
      hint: 'Optional. Left empty, one is generated per row. A batch number that already exists for the variant is rejected.',
      example: 'B-2026-0001',
    },
    {
      header: 'Quantity',
      required: true,
      hint: 'Whole number, at least 1.',
      example: 40,
    },
    {
      header: 'Cost Price',
      required: true,
      hint: 'Purchase cost per unit.',
      example: 1800,
    },
    {
      header: 'Location',
      required: false,
      hint: 'Where this stock is stored, e.g. A-3-2. Shown in product search.',
      example: 'A-3-2',
    },
    {
      header: 'Expiry Date',
      required: false,
      hint: 'Optional, format 2026-12-31. Leave empty if it does not expire.',
      example: '2027-06-30',
    },
    {
      header: 'Vendor',
      required: false,
      hint: 'Vendor name. It must already exist under Vendors.',
      example: 'Acme Supplies',
    },
  ];

  async prepare(
    consumerId: number,
    rows: ParsedRow[],
  ): Promise<{ prepared: PreparedBatch[]; errors: ImportRowError[] }> {
    const errors: ImportRowError[] = [];
    const prepared: PreparedBatch[] = [];

    const skus = rows
      .map((row) => row.values['sku'])
      .filter((sku): sku is string => !!sku);
    const barcodes = rows
      .map((row) => row.values['barcode'])
      .filter((barcode): barcode is string => !!barcode);

    const [variants, branches, vendors] = await Promise.all([
      skus.length || barcodes.length
        ? this.prisma.productVariant.findMany({
            where: {
              product: { consumer_id: consumerId },
              OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }],
            },
            select: { id: true, sku: true, barcode: true },
          })
        : Promise.resolve([]),
      this.prisma.branch.findMany({
        where: { consumer_id: consumerId },
        select: { id: true, name: true },
      }),
      this.prisma.vendor.findMany({
        where: { consumer_id: consumerId },
        select: { id: true, name: true },
      }),
    ]);

    const variantBySku = new Map<string, number>();
    const variantByBarcode = new Map<string, number>();
    for (const variant of variants) {
      if (variant.sku) variantBySku.set(variant.sku.toLowerCase(), variant.id);
      if (variant.barcode)
        variantByBarcode.set(variant.barcode.toLowerCase(), variant.id);
    }

    const branchIds = new Map(
      branches.map((branch) => [branch.name.trim().toLowerCase(), branch.id]),
    );
    const vendorIds = new Map(
      vendors.map((vendor) => [vendor.name.trim().toLowerCase(), vendor.id]),
    );

    // Batch numbers are unique per variant, so check the file against existing
    // batches of exactly the variants being touched.
    const existingBatches = await this.prisma.inventoryBatch.findMany({
      where: { variant: { product: { consumer_id: consumerId } } },
      select: { variant_id: true, batch_number: true },
    });
    const takenBatchKeys = new Set(
      existingBatches.map(
        (batch) => `${batch.variant_id}::${batch.batch_number.toLowerCase()}`,
      ),
    );
    const seenBatchKeys = new Map<string, number>();

    for (const row of rows) {
      const validator = new RowValidator(row);

      const sku = validator.text('SKU', { max: 100 });
      const barcode = validator.text('Barcode', { max: 100 });
      const branchName = validator.text('Branch', { required: true, max: 191 });
      const quantity = validator.number('Quantity', {
        required: true,
        min: 1,
        integer: true,
      });
      const costPrice = validator.number('Cost Price', {
        required: true,
        min: 0,
      });
      const location = validator.text('Location', { max: 100 });
      const expiryDate = validator.date('Expiry Date');
      const vendorName = validator.text('Vendor', { max: 191 });
      let batchNumber = validator.text('Batch Number', { max: 100 });

      let variantId: number | undefined;
      if (!sku && !barcode) {
        validator.add(
          'SKU',
          'Fill in either SKU or Barcode to identify the product',
        );
      } else {
        variantId = sku
          ? variantBySku.get(sku.toLowerCase())
          : variantByBarcode.get(barcode!.toLowerCase());

        if (!variantId) {
          validator.add(
            sku ? 'SKU' : 'Barcode',
            `No product variant found with ${sku ? `SKU "${sku}"` : `barcode "${barcode}"`}`,
          );
        }
      }

      let branchId: number | undefined;
      if (branchName) {
        branchId = branchIds.get(branchName.toLowerCase());
        if (!branchId) {
          validator.add('Branch', `Branch "${branchName}" does not exist`);
        }
      }

      let vendorId: number | undefined;
      if (vendorName) {
        vendorId = vendorIds.get(vendorName.toLowerCase());
        if (!vendorId) {
          validator.add(
            'Vendor',
            `Vendor "${vendorName}" does not exist. Create it first, or leave the cell empty.`,
          );
        }
      }

      if (!batchNumber && variantId) {
        batchNumber = `IMP-${Date.now()}-${row.rowNumber}`;
      }

      if (variantId && batchNumber) {
        const key = `${variantId}::${batchNumber.toLowerCase()}`;
        if (takenBatchKeys.has(key)) {
          validator.add(
            'Batch Number',
            `Batch "${batchNumber}" already exists for this product`,
          );
        }
        const firstSeenOn = seenBatchKeys.get(key);
        if (firstSeenOn) {
          validator.add(
            'Batch Number',
            `Batch "${batchNumber}" is used again for the same product on row ${firstSeenOn}`,
          );
        } else {
          seenBatchKeys.set(key, row.rowNumber);
        }
      }

      if (!validator.ok) {
        errors.push(...validator.problems);
        continue;
      }

      prepared.push({
        rowNumber: row.rowNumber,
        variant_id: variantId!,
        branch_id: branchId!,
        batch_number: batchNumber!,
        quantity: quantity!,
        cost_price: costPrice!,
        location,
        expiry_date: expiryDate,
        vendor_id: vendorId,
      });
    }

    return { prepared, errors };
  }

  async write(
    consumerId: number,
    userId: number | undefined,
    prepared: PreparedBatch[],
    tx: Prisma.TransactionClient,
  ): Promise<Record<string, number>> {
    for (const batch of prepared) {
      const created = await tx.inventoryBatch.create({
        data: {
          variant_id: batch.variant_id,
          branch_id: batch.branch_id,
          batch_number: batch.batch_number,
          quantity: batch.quantity,
          cost_price: batch.cost_price,
          location: batch.location ?? null,
          expiry_date: batch.expiry_date ?? null,
          vendor_id: batch.vendor_id,
          payment_status: 'due',
          paid_amount: 0,
        },
      });

      // Stock arriving through an import is still a purchase — keep the audit
      // trail identical to adding a batch by hand.
      await tx.inventoryAuditLog.create({
        data: {
          consumer_id: consumerId,
          variant_id: batch.variant_id,
          batch_id: created.id,
          inventoryBatchId: created.id,
          branch_id: batch.branch_id,
          event_type: 'PURCHASE_IN',
          quantity_delta: batch.quantity,
          quantity_after: created.quantity,
          reference_id: created.id,
          reference_type: 'inventory_batches',
          notes: `Excel import - batch ${batch.batch_number} - Qty: ${batch.quantity}`,
          created_by_user_id: userId,
        },
      });
    }

    return { batches: prepared.length };
  }
}
