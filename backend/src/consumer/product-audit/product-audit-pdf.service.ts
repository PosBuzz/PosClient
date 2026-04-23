import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ProductAuditPdfService {
  // ─── Layout constants ───────────────────────────────────────────────────────
  private readonly L = 50; // left margin
  private readonly R = 545; // right edge
  private readonly W = 495; // usable width
  private readonly ROW_H = 18;
  private readonly SECTION_FONT = 11;
  private readonly BODY_FONT = 9;
  private readonly HEADER_FONT = 8;

  async generatePdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Product Audit Report - ${data.meta.variant.product.name} / ${data.meta.variant.name}`,
          Author: data.meta.consumer?.company_name ?? 'System',
          Subject: 'Product Inventory Audit Report',
          Keywords: 'audit, inventory, product',
        },
      });

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.addCoverHeader(doc, data);
      this.addProductInfo(doc, data);
      this.addStockSnapshot(doc, data);
      this.addPurchasesSection(doc, data);
      this.addAdjustmentsSection(doc, data);
      this.addTransfersSection(doc, data);
      this.addSalesSection(doc, data);
      this.addReturnsSection(doc, data);
      this.addBatchDetailSection(doc, data);
      this.addFooter(doc, data);

      doc.end();
    });
  }

  // ─── Page helpers ────────────────────────────────────────────────────────────

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
    if (doc.y + needed > 780) {
      doc.addPage();
    }
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

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    this.ensureSpace(doc, 30);
    doc.moveDown(0.8);
    this.ensureSpace(doc, 25);
    doc
      .fillColor('#000000')
      .fontSize(this.SECTION_FONT)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), this.L, doc.y);
    this.hLine(doc, doc.y + 2);
    doc.moveDown(0.5);
  }

  private fmt(n: number | string | null | undefined, decimals = 2): string {
    if (n == null) return '—';
    const num = typeof n === 'string' ? parseFloat(n) : n;
    if (isNaN(num)) return '—';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  private fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private fmtDateTime(d: Date | string | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ─── Two-column key-value pair ───────────────────────────────────────────────
  private kv(doc: PDFKit.PDFDocument, label: string, value: string, x = this.L, colW = 247) {
    const valueX = x + colW * 0.45;
    const startY = doc.y;
    doc
      .fillColor('#000000')
      .fontSize(this.BODY_FONT)
      .font('Helvetica-Bold')
      .text(label + ':', x, startY, { width: colW * 0.43, lineBreak: false });
    doc
      .font('Helvetica')
      .text(value, valueX, startY, { width: colW * 0.55 });
  }

  private kvRow(doc: PDFKit.PDFDocument, pairs: [string, string][]) {
    // pairs: up to 2 per row
    this.ensureSpace(doc, this.ROW_H + 2);
    const startY = doc.y;
    if (pairs.length >= 1) this.kv(doc, pairs[0][0], pairs[0][1], this.L, 247);
    if (pairs.length >= 2) {
      doc.y = startY;
      this.kv(doc, pairs[1][0], pairs[1][1], this.L + 248, 247);
    }
    if (doc.y <= startY) doc.y = startY + this.ROW_H;
  }

  // ─── Table rendering ─────────────────────────────────────────────────────────

  /** Measure the height a cell's text will occupy given its column width. */
  private cellHeight(doc: PDFKit.PDFDocument, text: string, colWidth: number): number {
    return doc.heightOfString(text, { width: colWidth - 6 });
  }

  /** Calculate dynamic row height: tallest cell + vertical padding. */
  private calcRowHeight(doc: PDFKit.PDFDocument, row: string[], headers: { width: number }[]): number {
    doc.font('Helvetica').fontSize(this.BODY_FONT);
    const maxText = Math.max(
      ...row.map((cell, i) => this.cellHeight(doc, cell ?? '—', headers[i]?.width ?? 50)),
    );
    return Math.max(this.ROW_H, maxText + 8); // 4px top + 4px bottom padding
  }

  private drawTable(
    doc: PDFKit.PDFDocument,
    headers: { label: string; width: number; align?: string }[],
    rows: string[][],
    striped = true,
  ) {
    const headerH = this.ROW_H; // header row is always fixed height
    const totalW = headers.reduce((s, h) => s + h.width, 0);

    // Closure so header can be re-drawn after a page break
    const renderHeader = () => {
      const hY = doc.y;
      doc.rect(this.L, hY, totalW, headerH).fillColor('#000000').fill();
      doc.fillColor('#ffffff').fontSize(this.HEADER_FONT).font('Helvetica-Bold');
      let hx = this.L;
      headers.forEach((h) => {
        doc.text(h.label, hx + 3, hY + 4, {
          width: h.width - 6,
          height: headerH - 6,
          align: (h.align as any) ?? 'left',
          lineBreak: false,
        });
        hx += h.width;
      });
      doc.y = hY + headerH;
    };

    renderHeader();

    // Data rows — dynamic height, full wrap, no truncation
    rows.forEach((row, idx) => {
      const rowH = this.calcRowHeight(doc, row, headers);

      // Page-break with header repetition
      if (doc.y + rowH > 780) {
        doc.addPage();
        renderHeader();
      }

      const rowY = doc.y;

      if (striped && idx % 2 === 1) {
        doc.rect(this.L, rowY, totalW, rowH).fillColor('#F0F0F0').fill();
      }

      doc.fillColor('#000000').fontSize(this.BODY_FONT).font('Helvetica');
      let cx = this.L;
      headers.forEach((h, i) => {
        // Each cell rendered at its absolute (cx, rowY+4) position.
        // Explicit y keeps every cell top-aligned regardless of prior cells' height.
        doc.text(row[i] ?? '—', cx + 3, rowY + 4, {
          width: h.width - 6,
          align: (h.align as any) ?? 'left',
          lineBreak: true, // allow wrapping — no truncation
        });
        cx += h.width;
      });

      // Force cursor to exact bottom of this row after all cells are drawn
      doc.y = rowY + rowH;

      doc
        .moveTo(this.L, doc.y)
        .lineTo(this.L + totalW, doc.y)
        .strokeColor('#CCCCCC')
        .lineWidth(0.3)
        .stroke();
    });

    if (rows.length === 0) {
      if (doc.y + headerH > 780) doc.addPage();
      doc
        .fillColor('#000000')
        .fontSize(this.BODY_FONT)
        .font('Helvetica')
        .text('No records found in the selected period.', this.L + 3, doc.y + 4);
      doc.y += headerH;
    }

    doc.moveDown(0.5);
  }

  // ─── Summary box ─────────────────────────────────────────────────────────────
  private summaryBox(doc: PDFKit.PDFDocument, items: { label: string; value: string }[]) {
    this.ensureSpace(doc, 30 + Math.ceil(items.length / 3) * 20);
    const boxY = doc.y;
    const cols = 3;
    const colW = this.W / cols;

    doc
      .rect(this.L, boxY, this.W, Math.ceil(items.length / cols) * 20 + 10)
      .strokeColor('#000000')
      .lineWidth(0.5)
      .stroke();

    items.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = this.L + col * colW + 6;
      const y = boxY + row * 20 + 6;

      doc
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .fontSize(this.BODY_FONT)
        .text(item.label + ':', x, y, { width: colW * 0.5 - 8, lineBreak: false });
      doc
        .font('Helvetica')
        .text(item.value, x + colW * 0.5 - 4, y, { width: colW * 0.5 - 4, lineBreak: false });
    });

    doc.y = boxY + Math.ceil(items.length / cols) * 20 + 14;
  }

  // ─── Sections ────────────────────────────────────────────────────────────────

  private addCoverHeader(doc: PDFKit.PDFDocument, data: any) {
    const { consumer, variant, period, generated_at } = data.meta;

    // Document title
    doc
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('PRODUCT AUDIT REPORT', this.L, this.L, {
        align: 'center',
        width: this.W,
      });

    this.thickLine(doc);
    doc.moveDown(0.4);

    // Company + meta info
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(consumer?.company_name ?? 'N/A', this.L, doc.y, {
        align: 'center',
        width: this.W,
      });

    doc
      .font('Helvetica')
      .fontSize(this.BODY_FONT)
      .fillColor('#000000')
      .text(
        [consumer?.email, consumer?.phone, consumer?.address]
          .filter(Boolean)
          .join('  |  '),
        this.L,
        doc.y,
        { align: 'center', width: this.W },
      );

    doc.moveDown(0.5);
    this.hLine(doc);
    doc.moveDown(0.5);

    // Report period and generation info
    this.kvRow(doc, [
      ['Report Period', `${this.fmtDate(period.start_date)} – ${this.fmtDate(period.end_date)}`],
      ['Generated On', this.fmtDateTime(generated_at)],
    ]);
    this.kvRow(doc, [
      ['Product', variant.product.name + (variant.product.code ? ` (${variant.product.code})` : '')],
      ['Variant', variant.name],
    ]);
    this.kvRow(doc, [
      ['Branch Filter', data.meta.branch_id ? `Branch ID: ${data.meta.branch_id}` : 'All Branches'],
      ['Report Type', 'Full Inventory Audit'],
    ]);

    doc.moveDown(0.5);
    this.thickLine(doc);
    doc.moveDown(1);
  }

  private addProductInfo(doc: PDFKit.PDFDocument, data: any) {
    const v = data.meta.variant;
    this.sectionTitle(doc, '1. Product / Variant Information');

    this.kvRow(doc, [
      ['Product Name', v.product.name],
      ['Product Code', v.product.code ?? '—'],
    ]);
    this.kvRow(doc, [
      ['Variant Name', v.name],
      ['SKU', v.sku ?? '—'],
    ]);
    this.kvRow(doc, [
      ['Barcode', v.barcode ?? '—'],
      ['Category', v.product.category?.name ?? '—'],
    ]);
    this.kvRow(doc, [
      ['Brand', v.product.brand?.name ?? '—'],
      ['Sale Unit', v.sale_unit?.name ?? '—'],
    ]);
    this.kvRow(doc, [
      ['Regular Price', this.fmt(v.regular_price)],
      ['Wholesale Price', v.wholesale_price ? this.fmt(v.wholesale_price) : '—'],
    ]);
    this.kvRow(doc, [
      ['Tax', `${v.product.tax}% (${v.product.tax_method})`],
      ['Low Stock Alert', v.alert_quantity != null ? String(v.alert_quantity) : '—'],
    ]);

    if (v.attributes?.length > 0) {
      doc.moveDown(0.3);
      const attrText = v.attributes.map((a: any) => `${a.name}: ${a.value}`).join('  |  ');
      this.kvRow(doc, [['Attributes', attrText]]);
    }

    doc.moveDown(0.5);
  }

  private addStockSnapshot(doc: PDFKit.PDFDocument, data: any) {
    const s = data.stock_snapshot;
    this.sectionTitle(doc, '2. Current Stock Snapshot');

    this.summaryBox(doc, [
      { label: 'Total Stock (Units)', value: String(s.total_current_stock) },
      { label: 'Active Batches', value: String(s.total_active_batches) },
      { label: 'Expiring <= 30 Days', value: String(s.batches_expiring_within_30_days) },
      { label: 'Expired (w/ Stock)', value: String(s.expired_batches_with_stock) },
    ]);

    doc.moveDown(0.5);
  }

  private addPurchasesSection(doc: PDFKit.PDFDocument, data: any) {
    const { purchases, purchases_summary: ps } = data;
    this.sectionTitle(doc, '3. Purchases / Stock Additions in Period');

    this.summaryBox(doc, [
      { label: 'Batches Received', value: String(ps.total_batches) },
      { label: 'Total Units', value: String(ps.total_units_purchased) },
      { label: 'Total Cost', value: this.fmt(ps.total_cost) },
    ]);

    doc.moveDown(0.3);

    this.drawTable(
      doc,
      [
        { label: 'Date', width: 65 },
        { label: 'Batch No.', width: 75 },
        { label: 'Vendor', width: 90 },
        { label: 'Branch', width: 75 },
        { label: 'Qty Rcvd', width: 42, align: 'right' },
        { label: 'Remaining', width: 42, align: 'right' },
        { label: 'Unit Cost', width: 52, align: 'right' },
        { label: 'Total Cost', width: 54, align: 'right' },
      ],
      purchases.map((p: any) => [
        this.fmtDate(p.date),
        p.batch_number,
        p.vendor?.name ?? '—',
        p.branch?.name ?? '—',
        String(p.original_quantity),
        String(p.remaining_quantity),
        this.fmt(p.cost_price),
        this.fmt(p.total_cost),
      ]),
    );
  }

  private addAdjustmentsSection(doc: PDFKit.PDFDocument, data: any) {
    const { adjustments, adjustments_summary: as_ } = data;
    this.sectionTitle(doc, '4. Inventory Adjustments in Period');

    this.summaryBox(doc, [
      { label: 'Total Additions', value: String(as_.total_additions) },
      { label: 'Total Reductions', value: String(as_.total_reductions) },
      { label: 'Net Change', value: String(as_.total_additions - as_.total_reductions) },
    ]);

    doc.moveDown(0.3);

    this.drawTable(
      doc,
      [
        { label: 'Date', width: 72 },
        { label: 'Type', width: 60 },
        { label: 'Qty Change', width: 60, align: 'right' },
        { label: 'Batch', width: 75 },
        { label: 'Branch', width: 70 },
        { label: 'Reason', width: 80 },
        { label: 'Done By', width: 78 },
      ],
      adjustments.map((a: any) => [
        this.fmtDate(a.date),
        a.type === 'addition' ? 'Addition' : 'Reduction',
        (a.quantity_change > 0 ? '+' : '') + a.quantity_change,
        a.batch?.batch_number ?? '—',
        a.branch?.name ?? '—',
        a.reason ?? '—',
        a.created_by?.name ?? '—',
      ]),
    );
  }

  private addTransfersSection(doc: PDFKit.PDFDocument, data: any) {
    const { transfers } = data;
    this.sectionTitle(doc, '5. Inventory Transfers in Period');

    if (transfers.length === 0) {
      doc
        .fillColor('#000000')
        .font('Helvetica')
        .fontSize(this.BODY_FONT)
        .text('No transfers recorded in the selected period.', this.L, doc.y);
      doc.moveDown(0.5);
      return;
    }

    this.drawTable(
      doc,
      [
        { label: 'Initiated', width: 72 },
        { label: 'Completed', width: 72 },
        { label: 'Status', width: 55 },
        { label: 'From Branch', width: 80 },
        { label: 'To Branch', width: 80 },
        { label: 'Units', width: 36, align: 'right' },
        { label: 'Batches', width: 50 },
        { label: 'Initiated By', width: 50 },
      ],
      transfers.map((t: any) => [
        this.fmtDate(t.initiated_at),
        this.fmtDate(t.completed_at),
        String(t.status).toUpperCase(),
        t.source_branch?.name ?? '—',
        t.destination_branch?.name ?? '—',
        String(t.total_quantity),
        t.items.map((i: any) => i.batch_number).join(', '),
        t.created_by?.name ?? '—',
      ]),
    );
  }

  private addSalesSection(doc: PDFKit.PDFDocument, data: any) {
    const { sales, sales_summary: ss } = data;
    this.sectionTitle(doc, '6. Sales in Period');

    this.summaryBox(doc, [
      { label: 'Units Sold', value: String(ss.total_units_sold) },
      { label: 'Net Revenue', value: this.fmt(ss.total_revenue) },
      { label: 'Gross Revenue', value: this.fmt(ss.gross_revenue) },
      { label: 'Special Discount', value: this.fmt(ss.total_special_discount) },
      { label: 'Cart Discount', value: this.fmt(ss.total_average_discount) },
      { label: 'Promo Discount', value: this.fmt(ss.total_promotion_discount) },
      { label: 'Total Discount', value: this.fmt(ss.total_discount) },
      { label: 'Regular Price Sales', value: String(ss.regular_price_sales_count) },
      { label: 'Wholesale Sales', value: String(ss.wholesale_price_sales_count) },
    ]);

    doc.moveDown(0.3);

    this.drawTable(
      doc,
      [
        { label: 'Date', width: 60 },
        { label: 'Sale No.', width: 65 },
        { label: 'Qty', width: 28, align: 'right' },
        { label: 'Unit Price', width: 52, align: 'right' },
        { label: 'Sold Price', width: 52, align: 'right' },
        { label: 'Sp. Disc.', width: 46, align: 'right' },
        { label: 'Cart Disc.', width: 46, align: 'right' },
        { label: 'Promo Disc.', width: 50, align: 'right' },
        { label: 'Line Total', width: 52, align: 'right' },
        { label: 'By', width: 44 },
      ],
      sales.map((s: any) => [
        this.fmtDate(s.date),
        s.sale_number,
        String(s.quantity),
        this.fmt(s.unit_price),
        this.fmt(s.sold_unit_price ?? s.unit_price),
        this.fmt(s.special_discount),
        this.fmt(s.average_discount),
        this.fmt(s.promotion_discount),
        this.fmt(s.line_total),
        s.cashier?.name ?? '—',
      ]),
    );
  }

  private addReturnsSection(doc: PDFKit.PDFDocument, data: any) {
    const { returns, returns_summary: rs } = data;
    this.sectionTitle(doc, '7. Returns in Period');

    this.summaryBox(doc, [
      { label: 'Units Returned', value: String(rs.total_units_returned) },
      { label: 'Return Transactions', value: String(rs.total_return_transactions) },
    ]);

    doc.moveDown(0.3);

    this.drawTable(
      doc,
      [
        { label: 'Date', width: 80 },
        { label: 'Return No.', width: 100 },
        { label: 'Batch', width: 80 },
        { label: 'Branch', width: 80 },
        { label: 'Qty Returned', width: 80, align: 'right' },
        { label: 'Processed By', width: 75 },
      ],
      returns.map((r: any) => [
        this.fmtDate(r.date),
        r.return_number,
        r.batch?.batch_number ?? '—',
        r.branch?.name ?? '—',
        String(r.quantity),
        r.processed_by?.name ?? '—',
      ]),
    );
  }

  private addBatchDetailSection(doc: PDFKit.PDFDocument, data: any) {
    const { batches } = data.stock_snapshot;
    this.sectionTitle(doc, '8. Active Batch Details (Current Stock)');

    this.drawTable(
      doc,
      [
        { label: 'Batch No.', width: 85 },
        { label: 'Branch', width: 75 },
        { label: 'Vendor', width: 85 },
        { label: 'Qty', width: 35, align: 'right' },
        { label: 'Cost Price', width: 60, align: 'right' },
        { label: 'Stock Value', width: 65, align: 'right' },
        { label: 'Expiry', width: 55 },
        { label: 'Received', width: 35 },
      ],
      batches.map((b: any) => [
        b.batch_number,
        b.branch?.name ?? '—',
        b.vendor?.name ?? '—',
        String(b.quantity),
        this.fmt(b.cost_price),
        this.fmt(Number(b.cost_price) * b.quantity),
        b.expiry_date ? this.fmtDate(b.expiry_date) : '—',
        this.fmtDate(b.created_at),
      ]),
    );
  }

  private addFooter(doc: PDFKit.PDFDocument, data: any) {
    doc.moveDown(1);
    this.thickLine(doc);
    doc.moveDown(0.3);
    doc
      .fillColor('#000000')
      .font('Helvetica')
      .fontSize(8)
      .text(
        `This is a system-generated audit report. Generated on ${this.fmtDateTime(data.meta.generated_at)} by ${data.meta.consumer?.company_name ?? 'System'}.`,
        this.L,
        doc.y,
        { align: 'center', width: this.W },
      );
  }
}
