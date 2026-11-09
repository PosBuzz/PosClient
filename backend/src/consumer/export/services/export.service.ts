import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
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
      summary: [
        {
          label: 'Total exported inventory value (BDT)',
          value: batches
            .reduce(
              (sum, b) =>
                sum.plus(new Prisma.Decimal(b.cost_price).times(b.quantity)),
              new Prisma.Decimal(0),
            )
            .toNumber(),
        },
        ...[...new Set(batches.map((b) => b.branch.name))].map((name) => ({
          label: `Branch: ${name}`,
          value: batches
            .filter((b) => b.branch.name === name)
            .reduce(
              (sum, b) =>
                sum.plus(new Prisma.Decimal(b.cost_price).times(b.quantity)),
              new Prisma.Decimal(0),
            )
            .toNumber(),
        })),
      ],
      columns: [
        { header: 'Branch', width: 3 },
        { header: 'Product', width: 5 },
        { header: 'Variant', width: 3 },
        { header: 'SKU', width: 3 },
        { header: 'Batch', width: 3 },
        { header: 'Qty', width: 1.5, align: 'right' },
        { header: 'Cost (BDT)', width: 2, align: 'right' },
        { header: 'Value (BDT)', width: 2.5, align: 'right' },
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
        new Prisma.Decimal(b.cost_price).times(b.quantity).toNumber(),
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
    if (table.summary?.length) {
      const summary = workbook.addWorksheet('Inventory Value');
      summary.columns = [
        { header: 'Scope', width: 48 },
        { header: 'Value (BDT)', width: 22 },
      ];
      summary.getRow(1).font = { bold: true };
      table.summary.forEach((row) => summary.addRow([row.label, row.value]));
      summary.getColumn(2).numFmt = '#,##0.00';
    }
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
      const lineHeight = 12;

      // Wrap words to the actual font width, including very long unbroken names.
      // Drawing already-wrapped lines stops PDFKit from auto-paginating a single
      // cell independently of its neighbouring cells.
      const linesFor = (cell: string | number, width: number): string[] => {
        const lines: string[] = [];
        for (const paragraph of String(cell).split(/\r?\n/)) {
          let line = '';
          for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const candidate = line ? `${line} ${word}` : word;
            if (doc.widthOfString(candidate) <= width) {
              line = candidate;
              continue;
            }
            if (line) {
              lines.push(line);
              line = '';
            }
            for (const char of word) {
              if (line && doc.widthOfString(line + char) > width) {
                lines.push(line);
                line = '';
              }
              line += char;
            }
          }
          lines.push(line);
        }
        return lines;
      };

      const drawTable = (
        columns: ExportTable['columns'],
        rows: ExportTable['rows'],
        startY: number,
      ): number => {
        const totalWeight = columns.reduce(
          (sum, column) => sum + column.width,
          0,
        );
        const widths = columns.map(
          (column) => (column.width / totalWeight) * usable,
        );
        const xs: number[] = [];
        widths.reduce((x, width) => {
          xs.push(x);
          return x + width;
        }, left);
        const header = (top: number) => {
          doc.font('Helvetica-Bold').fontSize(8);
          const labels = columns.map((column, i) =>
            linesFor(column.header, widths[i] - 4),
          );
          const height =
            Math.max(...labels.map((lines) => lines.length)) * lineHeight;
          labels.forEach((lines, i) =>
            lines.forEach((line, lineIndex) =>
              doc.text(line, xs[i] + 2, top + lineIndex * lineHeight, {
                width: widths[i] - 4,
                align: columns[i].align ?? 'left',
                lineBreak: false,
              }),
            ),
          );
          doc
            .moveTo(left, top + height)
            .lineTo(left + usable, top + height)
            .stroke();
          doc.font('Helvetica').fontSize(8);
          return top + height + 4;
        };
        let y = startY;
        if (y > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        y = header(y);
        for (const row of rows) {
          const cells = columns.map((_, i) =>
            linesFor(row[i] ?? '', widths[i] - 4),
          );
          const height = Math.max(...cells.map((lines) => lines.length));
          // Keep ordinary rows together. Exceptionally tall rows continue safely
          // on the next page, with the table header repeated and no lost text.
          if (
            height * lineHeight <=
              doc.page.height -
                doc.page.margins.bottom -
                doc.page.margins.top -
                28 &&
            y + height * lineHeight > doc.page.height - doc.page.margins.bottom
          ) {
            doc.addPage();
            y = header(doc.page.margins.top);
          }
          let offset = 0;
          while (offset < height) {
            let available = Math.floor(
              (doc.page.height - doc.page.margins.bottom - y) / lineHeight,
            );
            if (available < 1) {
              doc.addPage();
              y = header(doc.page.margins.top);
              available = Math.floor(
                (doc.page.height - doc.page.margins.bottom - y) / lineHeight,
              );
            }
            const count = Math.min(available, height - offset);
            cells.forEach((lines, i) =>
              lines.slice(offset, offset + count).forEach((line, lineIndex) =>
                doc.text(line, xs[i] + 2, y + lineIndex * lineHeight, {
                  width: widths[i] - 4,
                  align: columns[i].align ?? 'left',
                  lineBreak: false,
                }),
              ),
            );
            y += count * lineHeight;
            offset += count;
          }
        }
        return y;
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
      let y = 66;
      if (table.summary?.length) {
        y =
          drawTable(
            [
              { header: 'Inventory value at batch cost', width: 8 },
              { header: 'Value (BDT)', width: 2, align: 'right' },
            ],
            table.summary.map((row) => [row.label, row.value.toFixed(2)]),
            y,
          ) + 16;
      }
      drawTable(table.columns, table.rows, y);
      doc.end();
    });
  }
}
