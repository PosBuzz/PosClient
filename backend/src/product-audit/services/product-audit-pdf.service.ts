import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ProductAuditPdfService {
  private readonly L = 50;
  private readonly R = 545;
  private readonly W = 495;
  private readonly ROW_H = 18;
  private readonly BODY_FONT = 9;
  private readonly HEADER_FONT = 8;

  private readonly EVENT_LABELS: Record<string, string> = {
    PURCHASE_IN: 'Purchase In',
    SALE_OUT: 'Sale Out',
    RETURN_IN: 'Return Restock',
    TRANSFER_OUT: 'Transfer Out',
    TRANSFER_IN: 'Transfer In',
    ADJUSTMENT: 'Manual Adjust',
    EXCHANGE_OUT: 'Exchange Out',
  };

  async generatePdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Audit Report - ${data.meta.variant.product.name}`,
          Author: data.meta.consumer?.company_name ?? 'System',
        },
      });

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addCoverHeader(doc, data);
      this.addProductInfo(doc, data);

      this.thickLine(doc);
      doc.moveDown(1);

      this.addSummaryBox(doc, data);
      this.addBatchTimelineSections(doc, data); // Fixed method below
      this.addFooter(doc, data);

      doc.end();
    });
  }

  // --- Helpers ---
  private ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
    if (doc.y + needed > 780) doc.addPage();
  }

  private hLine(doc: PDFKit.PDFDocument, y?: number) {
    const posY = y ?? doc.y;
    doc
      .moveTo(this.L, posY)
      .lineTo(this.R, posY)
      .strokeColor('#000000')
      .lineWidth(0.5)
      .stroke();
  }

  private thickLine(doc: PDFKit.PDFDocument) {
    doc
      .moveTo(this.L, doc.y)
      .lineTo(this.R, doc.y)
      .strokeColor('#000000')
      .lineWidth(1.5)
      .stroke();
  }

  private fmt(n: number | string | null | undefined): string {
    if (n == null) return '0';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    return isNaN(num)
      ? '0'
      : num.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
  }

  private fmtDate(d: Date | string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private fmtDateTime(d: Date | string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private kv(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    colW: number,
  ) {
    const valueX = x + colW * 0.4;
    const startY = doc.y;
    doc
      .fillColor('#000000')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(label + ':', x, startY, { width: colW * 0.38, lineBreak: false });
    doc.font('Helvetica').text(value, valueX, startY, { width: colW * 0.6 });
  }

  private kvRow(doc: PDFKit.PDFDocument, pairs: [string, string][]) {
    this.ensureSpace(doc, 20);
    const startY = doc.y;
    if (pairs.length >= 1) this.kv(doc, pairs[0][0], pairs[0][1], this.L, 247);
    if (pairs.length >= 2) {
      doc.y = startY;
      this.kv(doc, pairs[1][0], pairs[1][1], this.L + 248, 247);
    }
    if (doc.y <= startY) doc.y = startY + 18;
  }

  // --- Sections ---

  private addCoverHeader(doc: PDFKit.PDFDocument, data: any) {
    const { consumer, variant, period } = data.meta;
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('INVENTORY AUDIT REPORT', this.L, this.L, {
        align: 'center',
        width: this.W,
      });
    this.thickLine(doc);
    doc.moveDown(0.4);

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(consumer?.company_name ?? 'N/A', this.L, doc.y, {
        align: 'center',
        width: this.W,
      });
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(
        [consumer?.email, consumer?.phone].filter(Boolean).join(' | '),
        this.L,
        doc.y,
        { align: 'center', width: this.W },
      );
    doc.moveDown(0.5);
    this.hLine(doc);
    doc.moveDown(0.5);

    this.kvRow(doc, [
      [
        'Period',
        `${this.fmtDate(period.start_date)} – ${this.fmtDate(period.end_date)}`,
      ],
      ['Generated', this.fmtDateTime(data.meta.generated_at)],
    ]);
    this.kvRow(doc, [
      ['Product', variant.product.name],
      ['Variant', variant.name],
    ]);
    this.kvRow(doc, [
      [
        'Branch',
        data.meta.branch_id ? `ID: ${data.meta.branch_id}` : 'All Branches',
      ],
      ['Report Type', 'Batch Timeline Audit'],
    ]);

    doc.moveDown(0.5);
    this.thickLine(doc);
    doc.moveDown(1);
  }

  private addProductInfo(doc: PDFKit.PDFDocument, data: any) {
    const v = data.meta.variant;
    this.ensureSpace(doc, 60);
    doc
      .fillColor('#000000')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('VARIANT INFORMATION', this.L, doc.y);
    this.hLine(doc, doc.y + 2);
    doc.moveDown(0.5);

    this.kvRow(doc, [
      ['SKU', v.sku ?? '—'],
      ['Barcode', v.barcode ?? '—'],
    ]);
    this.kvRow(doc, [
      ['Category', v.product.category?.name ?? '—'],
      ['Brand', v.product.brand?.name ?? '—'],
    ]);
    this.kvRow(doc, [
      ['Regular Price', this.fmt(v.regular_price)],
      ['Unit', v.sale_unit?.name ?? '—'],
    ]);
    doc.moveDown(0.5);
  }

  private addSummaryBox(doc: PDFKit.PDFDocument, data: any) {
    const s = data.summary;
    const branches = s.by_branch || [];

    this.ensureSpace(doc, 60);

    // Title for the section
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('STOCK SUMMARY', this.L, doc.y);
    this.hLine(doc, doc.y + 2);
    doc.moveDown(0.3);

    const tableHeaders = [
      { label: 'Branch', width: 160 },
      { label: 'Opening Stock', width: 85, align: 'right' },
      { label: 'Current Stock', width: 85, align: 'right' },
      { label: 'Net Change', width: 85, align: 'right' },
      { label: 'Total Events', width: 80, align: 'right' },
    ];

    // Draw Table Header (Using standard HEADER_FONT)
    const tHeadY = doc.y;
    doc.rect(this.L, tHeadY, this.W, 18).fillColor('#2C3E50').fill(); // Match dark theme of batch headers
    let hx = this.L;
    doc.fillColor('#FFFFFF').fontSize(this.HEADER_FONT).font('Helvetica-Bold');
    tableHeaders.forEach((h) => {
      doc.text(h.label, hx + 3, tHeadY + 4, {
        width: h.width - 6,
        align: (h.align as any) ?? 'left',
        lineBreak: false,
      });
      hx += h.width;
    });
    doc.y = tHeadY + 18;

    // Draw Branch Rows (Using standard BODY_FONT)
    branches.forEach((branch: any, idx: number) => {
      const rowY = doc.y;
      const rowH = 18; // Standard row height

      // Alternate row coloring
      if (idx % 2 === 0) {
        doc.rect(this.L, rowY, this.W, rowH).fillColor('#FAFAFA').fill();
      }

      let cx = this.L;
      const cells = [
        { text: branch.branch_name, w: tableHeaders[0] },
        { text: String(branch.opening_stock), w: tableHeaders[1] },
        { text: String(branch.current_stock), w: tableHeaders[2] },
        {
          text: (branch.net_change > 0 ? '+' : '') + branch.net_change,
          w: tableHeaders[3],
          color: branch.net_change > 0 ? '#27AE60' : '#E74C3C',
        },
        { text: String(branch.total_events), w: tableHeaders[4] },
      ];

      doc.fontSize(this.BODY_FONT).font('Helvetica');
      cells.forEach((cell) => {
        doc
          .fillColor(cell.color || '#000000')
          .font(cell.w.align === 'right' ? 'Helvetica-Bold' : 'Helvetica')
          .text(cell.text, cx + 3, rowY + 4, {
            width: cell.w.width - 6,
            align: (cell.w.align as any) ?? 'left',
            lineBreak: false,
          });
        cx += cell.w.width;
      });

      doc.y = rowY + rowH;
    });

    // Draw TOTAL Row (Highlighted at the bottom)
    this.ensureSpace(doc, 30);
    const totalRowY = doc.y;
    const totalRowH = 20; // Slightly taller to stand out

    // Light blue background for the total row
    doc.rect(this.L, totalRowY, this.W, totalRowH).fillColor('#E8F4FD').fill();
    doc
      .rect(this.L, totalRowY, this.W, totalRowH)
      .strokeColor('#BDC3C7')
      .lineWidth(0.5)
      .stroke();

    let tx = this.L;
    const totalCells = [
      { text: 'OVERALL TOTAL', w: tableHeaders[0] },
      { text: String(s.opening_stock), w: tableHeaders[1] },
      { text: String(s.current_stock), w: tableHeaders[2] },
      {
        text: (s.net_change > 0 ? '+' : '') + s.net_change,
        w: tableHeaders[3],
        color: s.net_change > 0 ? '#27AE60' : '#E74C3C',
      },
      { text: String(s.total_events), w: tableHeaders[4] },
    ];

    // Total row text (All Bold)
    doc.fontSize(this.BODY_FONT);
    totalCells.forEach((cell) => {
      doc
        .fillColor(cell.color || '#000000')
        .font('Helvetica-Bold')
        .text(cell.text, tx + 3, totalRowY + 5, {
          width: cell.w.width - 6,
          align: (cell.w.align as any) ?? 'left',
          lineBreak: false,
        });
      tx += cell.w.width;
    });

    doc.y = totalRowY + totalRowH + 10;
  }

  private addBatchTimelineSections(doc: PDFKit.PDFDocument, data: any) {
    if (data.batches.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#555555')
        .text('No inventory movements found in this period.', this.L, doc.y);
      return;
    }

    data.batches.forEach((batchGroup: any) => {
      this.ensureSpace(doc, 60);

      const batch = batchGroup.batchInfo;
      const events = batchGroup.events;

      // --- Batch Section Header ---
      doc.moveDown(0.8);
      const headerY = doc.y;
      doc.rect(this.L, headerY, this.W, 35).fillColor('#2C3E50').fill();

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`Batch: ${batch.batch_number}`, this.L + 10, headerY + 4, {
          width: 300,
        });
      doc
        .fillColor('#BDC3C7')
        .font('Helvetica')
        .fontSize(8)
        .text(
          `Branch: ${batch.branch?.name ?? 'Unknown'}  |  Vendor: ${batch.vendor?.name ?? 'N/A'}`,
          this.L + 10,
          headerY + 18,
        );

      doc
        .fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          `Start Qty: ${batchGroup.periodStartQty}`,
          this.R - 120,
          headerY + 10,
          { width: 110, align: 'right' },
        );

      doc.y = headerY + 40;

      // --- Event Table ---
      const tableHeaders = [
        { label: 'Date/Time', width: 90 },
        { label: 'Event', width: 75 },
        { label: 'Change', width: 45, align: 'right' },
        { label: 'After', width: 40, align: 'right' },
        { label: 'Details / Reference', width: 195 }, // Widest column, prone to wrapping
        { label: 'User', width: 50 },
      ];

      // Draw Static Table Header
      const tHeadY = doc.y;
      doc.rect(this.L, tHeadY, this.W, 16).fillColor('#ECF0F1').fill();
      doc
        .rect(this.L, tHeadY, this.W, 16)
        .strokeColor('#BDC3C7')
        .lineWidth(0.5)
        .stroke();

      let hx = this.L;
      doc
        .fillColor('#2C3E50')
        .fontSize(this.HEADER_FONT)
        .font('Helvetica-Bold');
      tableHeaders.forEach((h) => {
        doc.text(h.label, hx + 3, tHeadY + 3, {
          width: h.width - 6,
          align: (h.align as any) ?? 'left',
          lineBreak: false,
        });
        hx += h.width;
      });
      doc.y = tHeadY + 16;

      if (events.length === 0) {
        doc
          .fillColor('#7F8C8D')
          .font('Helvetica')
          .fontSize(8)
          .text(
            'No movements in this period for this batch.',
            this.L + 10,
            doc.y + 5,
          );
        doc.y += 15;
      } else {
        // Draw Dynamic Event Rows
        events.forEach((event, eventIndex) => {
          // 1. Prepare text array for this row
          const rowData = [
            this.fmtDateTime(event.created_at),
            this.EVENT_LABELS[event.event_type] || event.event_type,
            (event.quantity_delta > 0 ? '+' : '') + event.quantity_delta,
            String(event.quantity_after),
            event.notes || '—',
            event.created_by?.name || 'System',
          ];

          // 2. Calculate the required height of this row
          doc.font('Helvetica').fontSize(this.BODY_FONT);
          let maxCellHeight = 0;
          rowData.forEach((text, i) => {
            // heightOfString calculates exactly how much vertical space text will take
            const cellHeight = doc.heightOfString(text, {
              width: tableHeaders[i].width - 6, // account for cell padding
            });
            if (cellHeight > maxCellHeight) maxCellHeight = cellHeight;
          });

          // Minimum height is standard ROW_H, but expand if text wraps
          const rowH = Math.max(this.ROW_H, maxCellHeight + 8); // +8 for 4px top/bottom padding

          // 3. Page break check using the dynamically calculated height
          this.ensureSpace(doc, rowH + 5);

          const rowY = doc.y;

          // 4. Draw row background (uses dynamic height)
          if (eventIndex % 2 === 1) {
            doc.rect(this.L, rowY, this.W, rowH).fillColor('#FAFAFA').fill();
          }

          // 5. Draw cell text
          let cx = this.L;
          const cellConfigs = [
            { text: rowData[0], w: tableHeaders[0] },
            { text: rowData[1], w: tableHeaders[1] },
            {
              text: rowData[2],
              w: tableHeaders[2],
              color: event.quantity_delta > 0 ? '#27AE60' : '#E74C3C',
            },
            { text: rowData[3], w: tableHeaders[3] },
            { text: rowData[4], w: tableHeaders[4] },
            { text: rowData[5], w: tableHeaders[5] },
          ];

          cellConfigs.forEach((cell) => {
            doc
              .fillColor(cell.color || '#000000')
              .font(cell.w.align === 'right' ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(this.BODY_FONT)
              // Intentionally allowing lineBreak: true (default) so long text wraps safely inside bounds
              .text(cell.text, cx + 3, rowY + 4, {
                width: cell.w.width - 6,
                align: (cell.w.align as any) ?? 'left',
              });
            cx += cell.w.width;
          });

          // 6. Force cursor to bottom of the dynamically calculated row
          doc.y = rowY + rowH;
        });
      }

      // Closing line for section
      doc
        .moveTo(this.L, doc.y)
        .lineTo(this.R, doc.y)
        .strokeColor('#BDC3C7')
        .lineWidth(1)
        .stroke();
    });
  }

  private addFooter(doc: PDFKit.PDFDocument, data: any) {
    this.ensureSpace(doc, 30);
    doc.moveDown(1);
    this.thickLine(doc);
    doc.moveDown(0.3);
    doc
      .fillColor('#7F8C8D')
      .font('Helvetica')
      .fontSize(7)
      .text(
        `System-generated Inventory Audit Report • ${this.fmtDateTime(data.meta.generated_at)}`,
        this.L,
        doc.y,
        { align: 'center', width: this.W },
      );
  }
}
