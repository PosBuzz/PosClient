import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface BillingLog {
  id: number;
  consumer_id: number;
  amount: number;
  reference: string;
  billing_date: Date;
}

interface Role {
  id: number;
  name: string;
  consumer_id: number;
}

interface User {
  name: string;
  role: Role;
}

interface Consumer {
  id: number;
  company_name: string;
  business_category: string | null;
  email: string;
  secondary_email: string | null;
  phone: string | null;
  address: string | null;
  subdomain: string;
  plan_id: number;
  created_at: Date;
  updated_at: Date;
  users: User[];
  billing_logs: BillingLog[];
}

@Injectable()
export class BillingService {
  async generateBillingHistoryExcel(consumer: Consumer): Promise<Buffer> {
    const sortedLogs = [...consumer.billing_logs].sort(
      (a, b) =>
        new Date(b.billing_date).getTime() - new Date(a.billing_date).getTime(),
    );

    // Calculate total amount
    const totalAmount = sortedLogs.reduce((sum, log) => sum + log.amount, 0);

    // Create rows: header + data
    const excelData = [
      ['No.', 'Billing Date', 'Reference', 'Amount'],
      ...sortedLogs.map((log, index) => [
        index + 1,
        new Date(log.billing_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        log.reference,
        log.amount,
      ]),
      // Add total row
      ['', '', 'Total', totalAmount],
    ];

    // Create worksheet and workbook
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Billing History');

    // Create summary sheet for company info
    const owner = consumer.users.find((user) => user.role?.name === 'Admin');
    const infoData = [
      ['Company Name', consumer.company_name || 'N/A'],
      ['Email', consumer.email || 'N/A'],
      ['Secondary Email', consumer.secondary_email || 'N/A'],
      ['Phone', consumer.phone || 'N/A'],
      ['Address', consumer.address || 'N/A'],
      ['Subdomain', consumer.subdomain || 'N/A'],
      [
        'Client Since',
        new Date(consumer.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      ],
      ['Owner Name', owner?.name || 'N/A'],
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Company Info');

    // Generate Excel buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return buffer;
  }

  async generateBillingHistoryPdf(consumer: Consumer): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `${consumer.company_name} - Billing History`,
          Author: 'System Generated',
        },
      });

      // Collect PDF chunks
      const stream = new Readable({
        read() {},
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });

      // Start generating PDF content
      this.addHeader(doc, consumer);
      this.addCompanyInfo(doc, consumer);
      this.addBillingTable(doc, consumer.billing_logs);

      // Finalize PDF
      doc.end();
    });
  }

  private addHeader(doc: PDFKit.PDFDocument, consumer: Consumer): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(`${consumer.company_name} - Billing History`, { align: 'center' })
      .moveDown(0.5);

    // Add date
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc
      .fontSize(10)
      .text(`Generated on: ${today}`, { align: 'center' })
      .moveDown(1);

    // Add horizontal line
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .stroke()
      .moveDown(1);
  }

  private addCompanyInfo(doc: PDFKit.PDFDocument, consumer: Consumer): void {
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Company Information')
      .moveDown(0.5);

    const owner = consumer.users.find((user) => user.role?.name === 'Admin');
    const companyInfo = [
      { label: 'Company Name', value: consumer.company_name || 'N/A' },
      { label: 'Email', value: consumer.email || 'N/A' },
      { label: 'Secondary Email', value: consumer.secondary_email || 'N/A' },
      { label: 'Phone', value: consumer.phone || 'N/A' },
      { label: 'Address', value: consumer.address || 'N/A' },
      { label: 'Subdomain', value: consumer.subdomain || 'N/A' },
      {
        label: 'Client Since',
        value: new Date(consumer.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      },
      {
        label: 'Owner Name',
        value: owner?.name || 'N/A',
      },
    ];

    const labelWidth = 120;
    const valueStartX = 180;

    doc.font('Helvetica').fontSize(10);

    companyInfo.forEach((item) => {
      const y = doc.y;
      doc.text(`${item.label}:`, 50, y);
      doc.text(item.value, valueStartX, y);
      doc.moveDown(0.8); // Increased line spacing to prevent overlap
    });

    doc.moveDown(1.2);
  }

  private addBillingTable(
    doc: PDFKit.PDFDocument,
    billingLogs: BillingLog[],
  ): void {
    // Add table header
    doc.x = doc.page.margins.left;

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .text('Billing History', { align: 'center' })
      .moveDown(0.5);

    // Sort billing logs by date (newest first)
    const sortedLogs = [...billingLogs].sort(
      (a, b) =>
        new Date(b.billing_date).getTime() - new Date(a.billing_date).getTime(),
    );

    if (sortedLogs.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .text('No billing history available.')
        .moveDown();
      return;
    }

    // Table dimensions
    const tableTop = doc.y;
    const tableLeft = 50;
    const tableRight = doc.page.width - 50;
    const rowHeight = 30;

    // Column widths
    const colWidths = {
      id: 40,
      date: 140,
      reference: 180,
      amount: 120,
    };

    // Draw table header
    doc.font('Helvetica-Bold').fontSize(10);
    this.drawTableRow(
      doc,
      tableLeft,
      tableTop,
      colWidths,
      ['No.', 'Billing Date', 'Reference', 'Amount'],
      rowHeight,
      true,
    );

    // Draw table rows
    doc.font('Helvetica').fontSize(10);
    let currentY = tableTop + rowHeight;

    sortedLogs.forEach((log, i) => {
      if (currentY + rowHeight > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;

        // Redraw title on new page
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .text('Billing History', { align: 'center' })
          .moveDown(0.5);

        currentY = doc.y;

        // Redraw header
        doc.font('Helvetica-Bold').fontSize(10);
        this.drawTableRow(
          doc,
          tableLeft,
          currentY,
          colWidths,
          ['#', 'Billing Date', 'Reference', 'Amount'],
          rowHeight,
          true,
        );
        currentY += rowHeight;
      }

      const date = new Date(log.billing_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const amount = `$${log.amount.toFixed(2)}`;

      this.drawTableRow(
        doc,
        tableLeft,
        currentY,
        colWidths,
        [(i + 1).toString(), date, log.reference, amount],
        rowHeight,
        false,
        i % 2 === 0,
      );

      currentY += rowHeight;
    });

    // Draw table bottom line
    doc.moveTo(tableLeft, currentY).lineTo(tableRight, currentY).stroke();

    // Add total
    const total = sortedLogs.reduce((sum, log) => sum + log.amount, 0);
    currentY += 20;

    doc
      .font('Helvetica-Bold')
      .text('Total Amount:', tableRight - 200, currentY)
      .text(`$${total.toFixed(2)}`, tableRight - 100, currentY, {
        width: 100,
        align: 'right',
      });
  }

  private drawTableRow(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    colWidths: { id: number; date: number; reference: number; amount: number },
    texts: string[],
    height: number,
    isHeader: boolean = false,
    isEvenRow: boolean = false,
  ): void {
    const tableWidth = doc.page.width - 100;

    // Draw background for alternating rows or header
    if (isHeader) {
      doc.rect(x, y, tableWidth, height).fill('#e0e0e0').stroke();
    } else if (isEvenRow) {
      doc.rect(x, y, tableWidth, height).fill('#f5f5f5').stroke();
    }
    doc.fillColor('black');

    // Draw cell borders
    doc.rect(x, y, tableWidth, height).stroke();

    // Draw column separators
    let currentX = x;
    Object.values(colWidths).forEach((width) => {
      currentX += width;
      if (currentX < x + tableWidth) {
        doc
          .moveTo(currentX, y)
          .lineTo(currentX, y + height)
          .stroke();
      }
    });

    // Add text to cells
    currentX = x;
    texts.forEach((text, i) => {
      const width = Object.values(colWidths)[i];
      const textX = currentX + 5; // Add padding
      const textY = y + height / 2 - 5; // Center text vertically

      // Align amount to the right
      const textOptions =
        i === 3 ? { width: width - 10, align: 'right' as const } : {};

      doc.text(text, textX, textY, textOptions);
      currentX += width;
    });
  }
}
