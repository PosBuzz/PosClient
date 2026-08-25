import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../../../prisma/prisma.service';
import { EODReportDto, EODReportResponse } from '../dto/eod-report.dto';

@Injectable()
export class BusinessReportPdfService {
  private readonly left = 45;
  private readonly right = 550;
  private readonly width = 505;

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
        margins: { top: 42, bottom: 48, left: this.left, right: 45 },
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
          .join('  |  '),
        branch: branch?.name ?? 'All branches',
        report,
      });
      this.summary(doc, report);
      this.paymentTable(doc, report);
      this.refundTable(doc, report);
      this.costTable(doc, report);
      this.productTable(doc, report);

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#6b7280')
          .text(
            `Generated ${new Date().toLocaleString('en-GB')}  •  PosBuzz  •  Page ${i + 1} of ${range.count}`,
            this.left,
            806,
            { width: this.width, align: 'center', lineBreak: false },
          );
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
    doc
      .font('Helvetica-Bold')
      .fontSize(19)
      .fillColor('#111827')
      .text(data.company, { align: 'center' });
    if (data.contact)
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#6b7280')
        .text(data.contact, { align: 'center' });
    doc.moveDown(0.7);
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor('#111827')
      .text('BUSINESS REPORT', { align: 'center' });
    const periodLabel =
      data.report.period === 'day'
        ? 'Daily'
        : data.report.period === 'month'
          ? 'Monthly'
          : 'Till Date';
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#4b5563')
      .text(
        `${periodLabel}  •  ${this.date(data.report.period_start)} – ${this.date(data.report.period_end)}  •  ${data.branch}`,
        { align: 'center' },
      );
    doc.moveDown(0.8);
    this.line(doc, '#111827', 1.4);
    doc.moveDown(0.8);
  }

  private summary(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    const items: [string, string][] = [
      ['GROSS SALES', this.money(report.summary.total_amount)],
      ['REFUNDS', this.money(report.summary.total_refund)],
      ['NET SALES', this.money(report.summary.net_sale_amount)],
      ['OPERATIONAL COSTS', this.money(report.summary.operational_costs)],
      ['NET OPERATING RESULT', this.money(report.summary.net_operating_result)],
      ['TRANSACTIONS', String(report.summary.total_transactions)],
      ['ITEMS SOLD', String(report.summary.total_items_sold)],
      ['AVERAGE SALE', this.money(report.summary.average_transaction_value)],
      ['CASH IN DRAWER', this.money(report.summary.net_cash_sales)],
    ];
    const boxWidth = (this.width - 12) / 3;
    const startY = doc.y;
    items.forEach(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = this.left + col * (boxWidth + 6);
      const y = startY + row * 62;
      doc
        .roundedRect(x, y, boxWidth, 54, 4)
        .fillAndStroke('#f8fafc', '#d1d5db');
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#6b7280')
        .text(label, x + 9, y + 9, { width: boxWidth - 18 });
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(
          (index === 1 && report.summary.total_refund > 0) ||
            (index === 4 && report.summary.net_operating_result < 0)
            ? '#b91c1c'
            : '#111827',
        )
        .text(value, x + 9, y + 27, { width: boxWidth - 18 });
    });
    const rowCount = Math.ceil(items.length / 3);
    doc.y = startY + rowCount * 62 - 6;
  }

  private paymentTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    this.section(doc, 'PAYMENT COLLECTION');
    const rows = report.payment_method_breakdown.map((item) => [
      this.human(item.payment_method),
      String(item.transaction_count),
      this.money(item.total_amount),
    ]);
    this.table(
      doc,
      ['Method', 'Transactions', 'Amount'],
      rows,
      [245, 100, 160],
      [0, 1, 2],
    );
  }

  private refundTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    if (!report.return_payment_breakdown.length) return;

    this.section(doc, 'REFUNDS PAID');
    const rows = report.return_payment_breakdown.map((item) => [
      this.human(item.payment_method),
      String(item.transaction_count),
      this.money(item.total_amount),
    ]);
    this.table(
      doc,
      ['Method', 'Refunds', 'Amount'],
      rows,
      [245, 100, 160],
      [0, 1, 2],
    );
  }

  private costTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    this.section(doc, 'OPERATIONAL COSTS');
    const rows = report.operational_costs.map((cost) => [
      this.date(cost.incurred_on),
      cost.name,
      cost.branch_name ?? 'All business',
      this.money(cost.amount),
    ]);
    this.table(
      doc,
      ['Date', 'Cost name', 'Branch', 'Amount'],
      rows,
      [82, 188, 125, 110],
      [0, 0, 0, 2],
    );
    if (!rows.length) this.empty(doc, 'No operational costs in this period.');
  }

  private productTable(doc: PDFKit.PDFDocument, report: EODReportResponse) {
    this.section(doc, 'PRODUCT SALES');
    const rows = report.product_sales.map((product) => [
      product.product_name,
      product.variant_name,
      String(product.quantity_sold),
      product.quantity_returned ? String(product.quantity_returned) : '-',
      this.money(product.net_amount),
    ]);
    this.table(
      doc,
      ['Product', 'Variant', 'Qty', 'Ret', 'Net sales'],
      rows,
      [170, 130, 45, 40, 120],
      [0, 0, 1, 1, 2],
    );
    if (!rows.length) this.empty(doc, 'No product sales in this period.');
  }

  private section(doc: PDFKit.PDFDocument, title: string) {
    this.ensure(doc, 65);
    doc
      .moveDown(1)
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(title);
    doc.moveDown(0.35);
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
      doc.rect(this.left, y, this.width, 22).fill('#1f2937');
      let x = this.left;
      headers.forEach((header, index) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#ffffff')
          .text(header, x + 6, y + 7, {
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
      doc.y = y + 22;
    };
    drawHeader();
    rows.forEach((row, rowIndex) => {
      if (doc.y > 770) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      doc
        .rect(this.left, y, this.width, 21)
        .fill(rowIndex % 2 ? '#ffffff' : '#f8fafc');
      let x = this.left;
      row.forEach((value, index) => {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#1f2937')
          .text(value, x + 6, y + 6, {
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
      doc.y = y + 21;
    });
    this.line(doc, '#d1d5db', 0.5);
  }

  private empty(doc: PDFKit.PDFDocument, message: string) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor('#6b7280')
      .text(message);
  }
  private ensure(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > 780) doc.addPage();
  }
  private line(doc: PDFKit.PDFDocument, color: string, width: number) {
    doc
      .moveTo(this.left, doc.y)
      .lineTo(this.right, doc.y)
      .strokeColor(color)
      .lineWidth(width)
      .stroke();
  }
  private money(value: number) {
    return `BDT ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  private date(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  private human(value: string) {
    return value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  }
}
