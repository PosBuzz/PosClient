import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../../prisma/prisma.service';
import { EODReportDto, EODReportResponse } from '../dto/eod-report.dto';

@Injectable()
export class BusinessReportPdfService {
  private readonly left = 40;
  private readonly right = 555;
  private readonly width = 515;

  constructor(private readonly prisma: PrismaService) {}

  async generate(
    consumerId: number,
    query: EODReportDto,
    report: EODReportResponse,
  ): Promise<Buffer> {
    const [consumer, branch] = await Promise.all([
      this.prisma.consumer.findUnique({ where: { id: consumerId } }),
      query.branch_id
        ? this.prisma.branch.findFirst({
            where: { id: query.branch_id, consumer_id: consumerId },
          })
        : null,
    ]);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 40, left: this.left, right: 40 },
        bufferPages: true,
        info: {
          Title: 'Business Report',
          Author: consumer?.company_name ?? 'PosBuzz',
        },
      });
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.header(doc, {
        company: consumer?.company_name ?? 'Business Report',
        contact: [
          branch?.address ?? consumer?.address,
          branch?.phone ?? consumer?.phone,
          branch?.email ?? consumer?.email,
        ]
          .filter(Boolean)
          .join('  •  '),
        branch: branch?.name ?? 'All Branches',
        report,
      });

      this.summaryCards(doc, report);
      this.paymentTable(doc, report);
      this.statusTable(doc, report);
      this.refundTable(doc, report);
      this.costTable(doc, report);
      this.productTable(doc, report);
      this.termsAndClosure(doc);

      // Render footers across all buffered pages without triggering auto-page-breaks
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        doc
          .moveTo(this.left, 804)
          .lineTo(this.right, 804)
          .strokeColor('#e2e8f0')
          .lineWidth(0.5)
          .stroke();

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#64748b')
          .text(
            `Generated on ${new Date().toLocaleString('en-GB')}  •  PosBuzz POS  •  Page ${i + 1} of ${range.count}`,
            this.left,
            812,
            { width: this.width, align: 'center', lineBreak: false },
          );

        doc.page.margins.bottom = oldBottom;
      }

      doc.end();
    });
  }

  private header(
    doc: PDFKit.PDFDocument,
    data: {
      company: string;
      contact: string;
      branch: string;
      report: EODReportResponse;
    },
  ) {
    const periodLabel =
      data.report.period === 'day'
        ? 'DAILY STATEMENT'
        : data.report.period === 'month'
          ? 'MONTHLY STATEMENT'
          : 'TILL DATE STATEMENT';

    const startY = doc.y;

    // Left Column: Brand & Branch Identity
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#0f172a')
      .text(data.company, this.left, startY, { width: 310, ellipsis: true });

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#2563eb')
      .text(`Branch: ${data.branch}`, this.left, doc.y + 2, { width: 310 });

    if (data.contact) {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748b')
        .text(data.contact, this.left, doc.y + 2, { width: 310 });
    }

    const leftEndY = doc.y;

    // Right Column: Document Title & Metadata
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#0f172a')
      .text('BUSINESS REPORT', this.left + 310, startY, {
        width: 205,
        align: 'right',
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#475569')
      .text(periodLabel, this.left + 310, doc.y + 2, {
        width: 205,
        align: 'right',
      });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748b')
      .text(
        `${this.date(data.report.period_start)} – ${this.date(data.report.period_end)}`,
        this.left + 310,
        doc.y + 2,
        { width: 205, align: 'right' },
      );

    const rightEndY = doc.y;
    const headerBottomY = Math.max(leftEndY, rightEndY) + 8;

    // Horizontal Accent Line
    doc
      .moveTo(this.left, headerBottomY)
      .lineTo(this.right, headerBottomY)
      .strokeColor('#0f172a')
      .lineWidth(1.2)
      .stroke();

    doc.x = this.left;
    doc.y = headerBottomY + 10;
  }

  private summaryCards(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    const items: Array<{
      label: string;
      value: string;
      sub: string;
      color?: string;
    }> = [
      {
        label: 'GROSS SALES',
        value: this.money(report.summary.total_amount),
        sub: 'Invoiced sales amount',
      },
      {
        label: 'REAL MONEY COLLECTED',
        value: this.money(
          report.summary.real_money_collected ??
            report.summary.cash_sales + (report.summary.digital_sales || 0),
        ),
        sub: 'Cash & digital bank inflow',
        color: '#059669',
      },
      {
        label: 'DUE / RECEIVABLES',
        value: this.money(report.summary.total_due || 0),
        sub: `${report.summary.due_sales_count || 0} unpaid/partial invoice(s)`,
        color: report.summary.total_due ? '#dc2626' : undefined,
      },
      {
        label: 'REFUNDS PAID',
        value: this.money(report.summary.total_refund),
        sub: `${report.summary.total_returns} return(s) disbursed`,
        color: report.summary.total_refund ? '#dc2626' : undefined,
      },
      {
        label: 'NET SALES',
        value: this.money(report.summary.net_sale_amount),
        sub: 'Gross sales less refunds',
        color: '#2563eb',
      },
      {
        label: 'CASH IN DRAWER',
        value: this.money(report.summary.net_cash_sales),
        sub: 'Net physical drawer cash',
        color: '#059669',
      },
      {
        label: 'DIGITAL SALES',
        value: this.money(report.summary.digital_sales || 0),
        sub: 'Card, bKash, Nagad, Bank',
      },
      {
        label: 'REWARD POINTS USED',
        value: this.money(report.summary.reward_point_sales || 0),
        sub: 'Store credit / loyalty redeemed',
        color: report.summary.reward_point_sales ? '#d97706' : undefined,
      },
      {
        label: 'PRODUCT EXCHANGES',
        value: this.money(
          report.summary.unique_exchanges ??
            report.summary.exchange_sales ??
            report.summary.total_exchange_return ??
            0,
        ),
        sub: 'Deduplicated exchange value',
        color: '#2563eb',
      },
      {
        label: 'OPERATIONAL COSTS',
        value: this.money(report.summary.operational_costs),
        sub: 'Period business expenses',
        color: report.summary.operational_costs ? '#dc2626' : undefined,
      },
      {
        label: 'NET OPERATING RESULT',
        value: this.money(report.summary.net_operating_result),
        sub: 'Net sales less operational costs',
        color: report.summary.net_operating_result >= 0 ? '#059669' : '#dc2626',
      },
      {
        label: 'TRANSACTIONS',
        value: String(report.summary.total_transactions),
        sub: `${report.summary.total_items_sold} total item(s) sold`,
      },
    ];

    const boxWidth = (this.width - 12) / 3;
    const boxHeight = 44;
    const startY = doc.y;

    items.forEach((item, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = this.left + col * (boxWidth + 6);
      const y = startY + row * (boxHeight + 6);

      // Card boundary
      doc
        .roundedRect(x, y, boxWidth, boxHeight, 3.5)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      // Top label
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor('#64748b')
        .text(item.label, x + 8, y + 6, {
          width: boxWidth - 16,
          lineBreak: false,
        });

      // Metric value
      doc
        .font('Helvetica-Bold')
        .fontSize(10.5)
        .fillColor(item.color || '#0f172a')
        .text(item.value, x + 8, y + 18, {
          width: boxWidth - 16,
          lineBreak: false,
        });

      // Subtitle
      doc
        .font('Helvetica')
        .fontSize(6)
        .fillColor('#94a3b8')
        .text(item.sub, x + 8, y + 32, {
          width: boxWidth - 16,
          lineBreak: false,
        });
    });

    const rowCount = Math.ceil(items.length / 3);
    doc.x = this.left;
    doc.y = startY + rowCount * (boxHeight + 6) + 4;
  }

  private paymentTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    this.section(doc, 'PAYMENT COLLECTION & TENDER BREAKDOWN');
    const rows = report.payment_method_breakdown.map((item) => [
      this.human(item.payment_method),
      String(item.transaction_count),
      this.money(item.total_amount),
    ]);

    if (report.summary.total_due > 0) {
      rows.push([
        'Due / Unpaid Invoices',
        String(report.summary.due_sales_count || '-'),
        this.money(report.summary.total_due),
      ]);
    }

    this.table(
      doc,
      ['Tender Channel / Method', 'Transactions', 'Settled Amount'],
      rows,
      [255, 100, 160],
      [0, 1, 2],
    );

    if (!rows.length) {
      this.empty(doc, 'No payment collections recorded in this period.');
    }
  }

  private statusTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    if (!report.payment_status_breakdown?.length) return;

    this.section(doc, 'SALES BY PAYMENT STATUS');
    const rows = report.payment_status_breakdown.map((item) => [
      this.human(item.status),
      String(item.count),
      this.money(item.total_amount),
    ]);

    this.table(
      doc,
      ['Payment Status', 'Sales Count', 'Invoiced Amount'],
      rows,
      [255, 100, 160],
      [0, 1, 2],
    );
  }

  private refundTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    if (
      !report.return_payment_breakdown?.length &&
      !report.summary.total_refund
    ) {
      return;
    }

    this.section(doc, 'REFUNDS & RETURNS DISBURSED');
    const rows = report.return_payment_breakdown.map((item) => [
      this.human(item.payment_method),
      String(item.transaction_count),
      this.money(item.total_amount),
    ]);

    this.table(
      doc,
      ['Refund Method', 'Returns Count', 'Refunded Amount'],
      rows,
      [255, 100, 160],
      [0, 1, 2],
    );

    if (!rows.length) {
      this.empty(doc, 'No refunds recorded in this period.');
    }
  }

  private costTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    if (!report.operational_costs?.length) return;

    this.section(doc, 'OPERATIONAL EXPENSES');
    const rows = report.operational_costs.map((cost) => [
      cost.name,
      cost.branch_name ?? 'All Branches',
      this.date(cost.incurred_on),
      this.money(cost.amount),
    ]);

    this.table(
      doc,
      ['Expense Category / Name', 'Branch', 'Date Incurred', 'Amount'],
      rows,
      [195, 110, 90, 120],
      [0, 0, 1, 2],
    );
  }

  private productTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    if (!report.product_sales?.length) return;

    this.section(doc, 'TOP PRODUCT SALES BREAKDOWN');
    const rows = report.product_sales
      .slice(0, 15)
      .map((product) => [
        product.product_name,
        product.variant_name,
        String(product.quantity_sold),
        product.quantity_returned ? String(product.quantity_returned) : '-',
        this.money(product.net_amount),
      ]);

    this.table(
      doc,
      ['Product Name', 'Variant / Details', 'Sold', 'Ret', 'Net Revenue'],
      rows,
      [175, 130, 45, 45, 120],
      [0, 0, 1, 1, 2],
    );
  }

  private termsAndClosure(doc: PDFKit.PDFDocument) {
    this.ensure(doc, 135);
    doc.moveDown(0.8);

    const startY = doc.y;
    const boxHeight = 88;

    // Background Container for Terms
    doc
      .roundedRect(this.left, startY, this.width, boxHeight, 4)
      .fillAndStroke('#f8fafc', '#cbd5e1');

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('#0f172a')
      .text(
        'ACCOUNTING DEFINITIONS & REPORT CLOSURE',
        this.left + 10,
        startY + 8,
        {
          width: this.width - 20,
        },
      );

    const colWidth = (this.width - 28) / 2;
    const col1X = this.left + 10;
    const col2X = this.left + 10 + colWidth + 8;
    const textY = startY + 22;

    // Column 1 Terms
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor('#334155')
      .text(
        '• Gross Sales: Invoiced subtotal less line & promotional discounts, plus tax & shipping.\n' +
          '• Real Money Collected: Liquid currency received via Cash and verified Digital accounts (Cards/MFS).\n' +
          '• Net Cash in Drawer: Total physical cash received (sales + due collections) less cash refunds paid.',
        col1X,
        textY,
        { width: colWidth, lineGap: 3 },
      );

    // Column 2 Terms
    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor('#334155')
      .text(
        '• Due / Receivables: Remaining unpaid balance on sales invoices finalized during this period.\n' +
          '• Product Exchanges: Deduplicated barter value of exchanged goods; counted once across linked records.\n' +
          '• Net Operating Result: Gross Sales minus Returns/Refunds and Operational Expenses.',
        col2X,
        textY,
        { width: colWidth, lineGap: 3 },
      );

    // Disclaimer statement
    doc
      .font('Helvetica-Oblique')
      .fontSize(5.8)
      .fillColor('#64748b')
      .text(
        'Official computer-generated financial report. Prepared in accordance with standard retail cash & accrual accounting principles.',
        this.left + 10,
        startY + 72,
        { width: this.width - 20, align: 'center' },
      );

    doc.x = this.left;
    doc.y = startY + boxHeight + 16;

    // Verification & Sign-off Line
    this.ensure(doc, 45);
    const signY = doc.y;
    const signColWidth = this.width / 3;

    doc.font('Helvetica').fontSize(7).fillColor('#475569');

    doc.text('Prepared By: ____________________', this.left, signY, {
      width: signColWidth,
      align: 'left',
    });
    doc.text(
      'Verified By: ____________________',
      this.left + signColWidth,
      signY,
      {
        width: signColWidth,
        align: 'center',
      },
    );
    doc.text(
      'Branch Manager: ____________________',
      this.left + signColWidth * 2,
      signY,
      {
        width: signColWidth,
        align: 'right',
      },
    );

    doc.x = this.left;
    doc.y = signY + 20;
  }

  private section(doc: PDFKit.PDFDocument, title: string) {
    this.ensure(doc, 50);
    doc.moveDown(0.7);

    const y = doc.y;
    // Left decorative bar
    doc.rect(this.left, y, 3, 11).fill('#1e3a8a');

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#0f172a')
      .text(title, this.left + 8, y + 1, { lineBreak: false });

    doc.x = this.left;
    doc.y = y + 15;
  }

  private table(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    widths: number[],
    align: number[],
  ) {
    if (!rows.length) return;

    const drawHeader = () => {
      const y = doc.y;
      doc.rect(this.left, y, this.width, 18).fill('#1e293b');
      let x = this.left;
      headers.forEach((header, index) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor('#ffffff')
          .text(header, x + 6, y + 5, {
            width: widths[index] - 12,
            align:
              align[index] === 2
                ? 'right'
                : align[index] === 1
                  ? 'center'
                  : 'left',
            lineBreak: false,
          });
        x += widths[index];
      });
      doc.x = this.left;
      doc.y = y + 18;
    };

    drawHeader();

    rows.forEach((row, rowIndex) => {
      if (doc.y > 750) {
        doc.addPage();
        drawHeader();
      }

      const y = doc.y;
      doc
        .rect(this.left, y, this.width, 18)
        .fill(rowIndex % 2 ? '#ffffff' : '#f8fafc');

      // Subtle row border
      doc
        .moveTo(this.left, y + 18)
        .lineTo(this.right, y + 18)
        .strokeColor('#e2e8f0')
        .lineWidth(0.4)
        .stroke();

      let x = this.left;
      row.forEach((value, index) => {
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#1e293b')
          .text(value, x + 6, y + 5, {
            width: widths[index] - 12,
            align:
              align[index] === 2
                ? 'right'
                : align[index] === 1
                  ? 'center'
                  : 'left',
            ellipsis: true,
            lineBreak: false,
          });
        x += widths[index];
      });

      doc.x = this.left;
      doc.y = y + 18;
    });

    doc.x = this.left;
    doc.moveDown(0.3);
  }

  private empty(doc: PDFKit.PDFDocument, message: string) {
    const y = doc.y;
    doc
      .roundedRect(this.left, y, this.width, 20, 2)
      .fillAndStroke('#f8fafc', '#e2e8f0');

    doc
      .font('Helvetica-Oblique')
      .fontSize(7.5)
      .fillColor('#94a3b8')
      .text(message, this.left, y + 6, {
        width: this.width,
        align: 'center',
        lineBreak: false,
      });

    doc.x = this.left;
    doc.y = y + 24;
  }

  private ensure(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > 760) {
      doc.addPage();
      doc.x = this.left;
      doc.y = 36;
    }
  }

  private money(value: number) {
    return `BDT ${Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private date(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private human(value: string) {
    if (!value) return '';
    const upper = value.toUpperCase();
    if (upper === 'CREDIT') return 'Reward Points / Store Credit';
    if (upper === 'EXCHANGE') return 'Product Exchange';
    if (upper === 'DELIVERY_PARTNER') return 'Collected by Delivery Partner';
    if (upper === 'MFS' || upper === 'MOBILE_MONEY') {
      return 'MFS (bKash / Nagad)';
    }
    if (upper === 'CASH') return 'Cash';
    if (upper === 'CARD') return 'Card';
    if (upper === 'BANK_TRANSFER') return 'Bank Transfer';
    if (upper === 'PAID') return 'Fully Paid';
    if (upper === 'PARTIAL') return 'Partially Paid';
    if (upper === 'DUE') return 'Full Due / Unpaid';
    return value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  }
}
