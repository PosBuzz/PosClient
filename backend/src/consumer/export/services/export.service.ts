import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExportEntity, ExportFormat, ExportTable } from '../export.types';

/** A guard against one request building an enormous file */
export const EXPORT_ROW_LIMIT = 20000;

const money = (value: unknown) => Number(value ?? 0);
const day = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : '';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  parseFormat(format?: string): ExportFormat {
    const value = (format ?? 'xlsx').toLowerCase();
    if (value !== 'xlsx' && value !== 'pdf') {
      throw new BadRequestException(
        `Unsupported export format "${format}". Use xlsx or pdf.`,
      );
    }
    return value;
  }

  async export(
    entity: ExportEntity,
    consumerId: number,
    format: ExportFormat,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const table = await this.table(entity, consumerId);
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'pdf') {
      return {
        buffer: await this.toPdf(table),
        filename: `${entity}-${stamp}.pdf`,
        contentType: 'application/pdf',
      };
    }
    return {
      buffer: await this.toXlsx(table),
      filename: `${entity}-${stamp}.xlsx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private table(
    entity: ExportEntity,
    consumerId: number,
  ): Promise<ExportTable> {
    switch (entity) {
      case 'customers':
        return this.customers(consumerId);
      case 'products':
        return this.products(consumerId);
      case 'inventory':
        return this.inventory(consumerId);
    }
  }

  private async customers(consumerId: number): Promise<ExportTable> {
    const rows = await this.prisma.customer.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
      take: EXPORT_ROW_LIMIT,
    });
    return {
      title: 'Customers',
      columns: [
        { header: 'Name', width: 4 },
        { header: 'Phone', width: 3 },
        { header: 'Email', width: 4 },
        { header: 'Address', width: 5 },
        { header: 'Type', width: 2 },
        { header: 'Birthday', width: 2.5 },
      ],
      rows: rows.map((c) => [
        c.name,
        c.phone,
        c.email ?? '',
        c.address ?? '',
        c.customer_type,
        day(c.birthday),
      ]),
    };
  }

  private async products(consumerId: number): Promise<ExportTable> {
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { consumer_id: consumerId } },
      include: {
        product: { include: { category: true, brand: true } },
      },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
      take: EXPORT_ROW_LIMIT,
    });
    return {
      title: 'Products',
      columns: [
        { header: 'Product', width: 5 },
        { header: 'Variant', width: 3 },
        { header: 'SKU', width: 3 },
        { header: 'Barcode', width: 3 },
        { header: 'Category', width: 3 },
        { header: 'Brand', width: 3 },
        { header: 'Price', width: 2, align: 'right' },
        { header: 'Wholesale', width: 2, align: 'right' },
      ],
      rows: variants.map((v) => [
        v.product.name,
        v.name,
        v.sku ?? '',
        v.barcode ?? '',
        v.product.category?.name ?? '',
        v.product.brand?.name ?? '',
        money(v.regular_price),
        v.wholesale_price === null ? '' : money(v.wholesale_price),
      ]),
    };
  }

  private async inventory(consumerId: number): Promise<ExportTable> {
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { branch: { consumer_id: consumerId }, quantity: { gt: 0 } },
      include: {
        branch: { select: { name: true } },
        variant: { include: { product: { select: { name: true } } } },
      },
      orderBy: [{ branch_id: 'asc' }, { variant_id: 'asc' }, { id: 'asc' }],
      take: EXPORT_ROW_LIMIT,
    });
    return {
      title: 'Inventory',
      columns: [
        { header: 'Branch', width: 3 },
        { header: 'Product', width: 5 },
        { header: 'Variant', width: 3 },
        { header: 'SKU', width: 3 },
        { header: 'Batch', width: 3 },
        { header: 'Qty', width: 1.5, align: 'right' },
        { header: 'Cost', width: 2, align: 'right' },
        { header: 'Expiry', width: 2.5 },
      ],
      rows: batches.map((b) => [
        b.branch.name,
        b.variant.product.name,
        b.variant.name,
        b.variant.sku ?? '',
        b.batch_number,
        b.quantity,
        money(b.cost_price),
        day(b.expiry_date),
      ]),
    };
  }

  private async toXlsx(table: ExportTable): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(table.title);
    sheet.columns = table.columns.map((c) => ({
      header: c.header,
      width: Math.round(c.width * 6),
    }));
    sheet.getRow(1).font = { bold: true };
    table.rows.forEach((row) => sheet.addRow(row));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  toPdf(table: ExportTable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const usable = doc.page.width - left - doc.page.margins.right;
      const totalWeight = table.columns.reduce((s, c) => s + c.width, 0);
      const xs: number[] = [];
      const widths = table.columns.map((c) => (c.width / totalWeight) * usable);
      widths.reduce((x, w) => (xs.push(x), x + w), left);

      const header = (y: number) => {
        doc.font('Helvetica-Bold').fontSize(8);
        table.columns.forEach((c, i) =>
          doc.text(c.header, xs[i] + 2, y, {
            width: widths[i] - 4,
            align: c.align ?? 'left',
            lineBreak: false,
          }),
        );
        doc
          .moveTo(left, y + 12)
          .lineTo(left + usable, y + 12)
          .stroke();
        return y + 16;
      };

      doc.font('Helvetica-Bold').fontSize(14).text(table.title, left, 30);
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(
          `${table.rows.length} rows · ${new Date().toISOString().slice(0, 10)}`,
          left,
          48,
        );

      let y = header(66);
      doc.font('Helvetica').fontSize(8);
      for (const row of table.rows) {
        if (y > doc.page.height - doc.page.margins.bottom - 14) {
          doc.addPage();
          y = header(doc.page.margins.top);
          doc.font('Helvetica').fontSize(8);
        }
        row.forEach((cell, i) =>
          doc.text(String(cell), xs[i] + 2, y, {
            width: widths[i] - 4,
            align: table.columns[i].align ?? 'left',
            lineBreak: false,
            ellipsis: true,
          }),
        );
        y += 12;
      }
      doc.end();
    });
  }
}
