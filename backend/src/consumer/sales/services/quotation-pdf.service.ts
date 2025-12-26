import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

interface QuotationPdfOptions {
  includeBarcodes?: boolean;
  showItemDetails?: boolean;
  paperSize?: 'A4' | 'Letter';
  margin?: number;
}

@Injectable()
export class QuotationPdfService {
  async generateQuotationPdf(
    quotation: any,
    options: QuotationPdfOptions = {},
  ): Promise<Buffer> {
    const {
      includeBarcodes = true,
      showItemDetails = true,
      paperSize = 'A4',
      margin = 30,
    } = options;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: paperSize,
        margin,
        info: {
          Title: `Quotation - ${quotation.sale_number}`,
          Author: 'POS System',
          Subject: `Quotation ${quotation.sale_number}`,
          Keywords: 'quotation, estimate, invoice',
        },
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Start generating PDF content
      this.addQuotationHeader(doc, quotation);
      this.addCompanyInfo(doc, quotation);
      this.addQuotationInfo(doc, quotation);
      this.addCustomerInfo(doc, quotation);

      if (showItemDetails) {
        this.addItemsTable(doc, quotation);
      }

      this.addValidityInfo(doc, quotation);
      this.addFooter(doc, quotation, includeBarcodes);

      doc.end();
    });
  }

  private addQuotationHeader(doc: PDFKit.PDFDocument, quotation: any): void {
    const pageWidth = doc.page.width;

    // Add a compact background header with quotation styling
    doc.rect(0, 0, pageWidth, 60).fill('#E8F4FD');

    // Quotation title - smaller and more compact
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#2C3E50')
      .text('QUOTATION', 0, 15, { align: 'center', width: pageWidth });

    // Single decorative line
    doc
      .moveTo(pageWidth * 0.3, 45)
      .lineTo(pageWidth * 0.7, 45)
      .strokeColor('#3498DB')
      .lineWidth(2)
      .stroke();

    doc.y = 70;
  }

  private addCompanyInfo(doc: PDFKit.PDFDocument, quotation: any): void {
    const pageWidth = doc.page.width;

    // Compact company info with proper company name - branch name format
    if (quotation.consumer || quotation.branch) {
      // Get company name directly from consumer or fallback to branch.consumer
      const companyName = quotation.consumer?.company_name || 'Company Name';
      const branchName = quotation.branch?.name || 'Main Store';

      const headerY = doc.y;

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#2C3E50')
        .text(`${companyName} - ${branchName}`, 0, headerY, {
          align: 'center',
          width: pageWidth,
        });

      let detailsY = headerY + 18;

      if (quotation.branch?.address) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#7F8C8D')
          .text(quotation.branch.address, 0, detailsY, {
            align: 'center',
            width: pageWidth,
          });
        detailsY += 12;
      }

      const contacts: string[] = [];
      if (quotation.branch?.phone) contacts.push(`Phone: ${quotation.branch.phone}`);
      if (quotation.branch?.email) contacts.push(`Email: ${quotation.branch.email}`);

      if (contacts.length) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#7F8C8D')
          .text(contacts.join(' | '), 0, detailsY, {
            align: 'center',
            width: pageWidth,
          });
        detailsY += 12;
      }

      doc.y = detailsY;
    }

    doc.y += 35;
  }

  private addQuotationInfo(doc: PDFKit.PDFDocument, quotation: any): void {
    const leftColumn = 40;
    const rightColumn = 320;
    const currentY = doc.y;
    const rowHeight = 18;

    // Compact info box
    doc
      .rect(30, currentY - 5, doc.page.width - 60, 60)
      .fill('#E8F4FD')
      .strokeColor('#3498DB')
      .lineWidth(1)
      .stroke();

    // Quotation information - smaller fonts and spacing
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#2C3E50');

    // Left column labels
    doc.text('Quotation #:', leftColumn, currentY);
    doc.text('Date:', leftColumn, currentY + rowHeight);
    doc.text('Prepared By:', leftColumn, currentY + rowHeight * 2);

    // Right column values
    doc.font('Helvetica').fontSize(10).fillColor('#34495E');
    doc.text(quotation.sale_number, rightColumn, currentY);

    const quotationDate = new Date(quotation.sale_date);
    const formattedDate = quotationDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = quotationDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    doc.text(
      `${formattedDate} ${formattedTime}`,
      rightColumn,
      currentY + rowHeight,
    );
    doc.text(
      quotation.user?.name || 'Consumer Admin',
      rightColumn,
      currentY + rowHeight * 2,
    );

    doc.y = currentY + 65;
  }

  private addCustomerInfo(doc: PDFKit.PDFDocument, quotation: any): void {
    if (
      quotation.customer_name ||
      quotation.customer_phone ||
      quotation.customer_email
    ) {
      const boxTop = doc.y;
      const boxHeight = 45;

      // Compact customer info box
      doc
        .rect(30, boxTop, doc.page.width - 60, boxHeight)
        .fill('#E8F5E8')
        .strokeColor('#27AE60')
        .lineWidth(1)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#27AE60')
        .text('Customer Information:', 40, boxTop + 5);

      let infoY = boxTop + 20;

      if (quotation.customer_name) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2C3E50')
          .text(`Name: `, 40, infoY, { continued: true })
          .font('Helvetica')
          .fillColor('#34495E')
          .text(`${quotation.customer_name}`);
      }

      if (quotation.customer_phone) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2C3E50')
          .text(`Phone: `, 280, boxTop + 20, { continued: true })
          .font('Helvetica')
          .fillColor('#34495E')
          .text(`${quotation.customer_phone}`);
      }

      if (quotation.customer_email) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2C3E50')
          .text(`Email: `, 40, boxTop + 32, { continued: true })
          .font('Helvetica')
          .fillColor('#34495E')
          .text(`${quotation.customer_email}`);
      }

      doc.y = boxTop + boxHeight + 10;
    }
  }

  private addItemsTable(doc: PDFKit.PDFDocument, quotation: any): void {
    const tableTop = doc.y;
    const tableLeft = 30;
    const tableWidth = doc.page.width - 60;

    // Column widths (as percentages of table width)
    const colWidths = {
      item: 0.4,
      qty: 0.15,
      price: 0.2,
      total: 0.25,
    };

    // Calculate actual column widths
    const actualWidths = {
      item: tableWidth * colWidths.item,
      qty: tableWidth * colWidths.qty,
      price: tableWidth * colWidths.price,
      total: tableWidth * colWidths.total,
    };

    // Table header - compact
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#2C3E50')
      .text('Items:', tableLeft, tableTop);

    const headerY = doc.y + 5;
    const rowHeight = 20;

    // Draw header background
    doc
      .rect(tableLeft, headerY, tableWidth, rowHeight)
      .fill('#3498DB')
      .strokeColor('#2980B9')
      .lineWidth(1)
      .stroke();

    // Header text - smaller font
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF');

    let currentX = tableLeft + 8;
    doc.text('Item', currentX, headerY + 6, { width: actualWidths.item - 16 });
    currentX += actualWidths.item;
    doc.text('Qty', currentX, headerY + 6, {
      width: actualWidths.qty - 10,
      align: 'center',
    });
    currentX += actualWidths.qty;
    doc.text('Unit Price', currentX, headerY + 6, {
      width: actualWidths.price - 10,
      align: 'right',
    });
    currentX += actualWidths.price;
    doc.text('Total', currentX, headerY + 6, {
      width: actualWidths.total - 10,
      align: 'right',
    });

    // Items - compact rows
    let currentY = headerY + rowHeight;
    doc.font('Helvetica').fontSize(9).fillColor('#2C3E50');

    quotation.items?.forEach((item: any, index: number) => {
      // Compact rows
      if (index % 2 === 0) {
        doc
          .rect(tableLeft, currentY, tableWidth, rowHeight)
          .fill('#F8F9FA')
          .strokeColor('#E9ECEF')
          .lineWidth(0.5)
          .stroke();
      } else {
        doc
          .rect(tableLeft, currentY, tableWidth, rowHeight)
          .fill('#FFFFFF')
          .strokeColor('#E9ECEF')
          .lineWidth(0.5)
          .stroke();
      }

      currentX = tableLeft + 8;

      // Item name - show product name - variant name (only if different)
      let itemName = 'Unknown Item';
      if (item.variant?.product?.name && item.variant?.name) {
        // If product name and variant name are the same, show only product name
        if (item.variant.product.name === item.variant.name) {
          itemName = item.variant.product.name;
        } else {
          itemName = `${item.variant.product.name} - ${item.variant.name}`;
        }
      } else if (item.variant?.product?.name) {
        itemName = item.variant.product.name;
      } else if (item.variant?.name) {
        itemName = item.variant.name;
      } else if (item.product_name && item.variant_name) {
        // If product name and variant name are the same, show only product name
        if (item.product_name === item.variant_name) {
          itemName = item.product_name;
        } else {
          itemName = `${item.product_name} - ${item.variant_name}`;
        }
      } else if (item.product_name) {
        itemName = item.product_name;
      } else if (item.variant_name) {
        itemName = item.variant_name;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#2C3E50')
        .text(itemName, currentX, currentY + 6, {
          width: actualWidths.item - 16,
        });

      // Quantity
      currentX += actualWidths.item;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#3498DB')
        .text(item.quantity.toString(), currentX, currentY + 6, {
          width: actualWidths.qty - 10,
          align: 'center',
        });

      // Unit price
      currentX += actualWidths.qty;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#34495E')
        .text(
          `$${Number(item.unit_price).toFixed(2)}`,
          currentX,
          currentY + 6,
          {
            width: actualWidths.price - 10,
            align: 'right',
          },
        );

      // Total
      currentX += actualWidths.price;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#27AE60')
        .text(
          `$${Number(item.line_total).toFixed(2)}`,
          currentX,
          currentY + 6,
          {
            width: actualWidths.total - 10,
            align: 'right',
          },
        );

      currentY += rowHeight;
    });

    // Add totals section as table rows
    currentY = this.addTotalsAsTableRows(
      doc,
      quotation,
      tableLeft,
      tableWidth,
      actualWidths,
      currentY,
      rowHeight,
    );

    // Update document y position
    doc.y = currentY + 5;
  }

  private addTotalsAsTableRows(
    doc: PDFKit.PDFDocument,
    quotation: any,
    tableLeft: number,
    tableWidth: number,
    actualWidths: any,
    startY: number,
    rowHeight: number,
  ): number {
    let currentY = startY;

    // Add separator line
    doc.rect(tableLeft, currentY, tableWidth, 2).fill('#BDC3C7').stroke();
    currentY += 8;

    // Subtotal row
    doc
      .rect(tableLeft, currentY, tableWidth, rowHeight)
      .fill('#F8F9FA')
      .strokeColor('#E9ECEF')
      .lineWidth(0.5)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#2C3E50')
      .text(
        'Subtotal:',
        tableLeft + actualWidths.item + actualWidths.qty + 8,
        currentY + 6,
        {
          width: actualWidths.price - 10,
          align: 'right',
        },
      );

    doc.text(
      `$${Number(quotation.subtotal || 0).toFixed(2)}`,
      tableLeft + actualWidths.item + actualWidths.qty + actualWidths.price + 8,
      currentY + 6,
      {
        width: actualWidths.total - 10,
        align: 'right',
      },
    );
    currentY += rowHeight;

    // Tax row (if applicable)
    if (quotation.tax_amount && Number(quotation.tax_amount) > 0) {
      doc
        .rect(tableLeft, currentY, tableWidth, rowHeight)
        .fill('#FFFFFF')
        .strokeColor('#E9ECEF')
        .lineWidth(0.5)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#2C3E50')
        .text(
          'Tax:',
          tableLeft + actualWidths.item + actualWidths.qty + 8,
          currentY + 6,
          {
            width: actualWidths.price - 10,
            align: 'right',
          },
        );

      doc.text(
        `$${Number(quotation.tax_amount).toFixed(2)}`,
        tableLeft +
          actualWidths.item +
          actualWidths.qty +
          actualWidths.price +
          8,
        currentY + 6,
        {
          width: actualWidths.total - 10,
          align: 'right',
        },
      );
      currentY += rowHeight;
    }

    // Shipping row (if applicable)
    if (quotation.shipping_cost && Number(quotation.shipping_cost) > 0) {
      doc
        .rect(tableLeft, currentY, tableWidth, rowHeight)
        .fill('#F8F9FA')
        .strokeColor('#E9ECEF')
        .lineWidth(0.5)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#2C3E50')
        .text(
          'Shipping:',
          tableLeft + actualWidths.item + actualWidths.qty + 8,
          currentY + 6,
          {
            width: actualWidths.price - 10,
            align: 'right',
          },
        );

      doc.text(
        `$${Number(quotation.shipping_cost).toFixed(2)}`,
        tableLeft +
          actualWidths.item +
          actualWidths.qty +
          actualWidths.price +
          8,
        currentY + 6,
        {
          width: actualWidths.total - 10,
          align: 'right',
        },
      );
      currentY += rowHeight;
    }

    // Discount row (if applicable)
    if (quotation.discount_amount && Number(quotation.discount_amount) > 0) {
      doc
        .rect(tableLeft, currentY, tableWidth, rowHeight)
        .fill('#F8F9FA')
        .strokeColor('#E9ECEF')
        .lineWidth(0.5)
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#E74C3C')
        .text(
          'Discount:',
          tableLeft + actualWidths.item + actualWidths.qty + 8,
          currentY + 6,
          {
            width: actualWidths.price - 10,
            align: 'right',
          },
        );

      doc.text(
        `-$${Number(quotation.discount_amount).toFixed(2)}`,
        tableLeft +
          actualWidths.item +
          actualWidths.qty +
          actualWidths.price +
          8,
        currentY + 6,
        {
          width: actualWidths.total - 10,
          align: 'right',
        },
      );
      currentY += rowHeight;
    }

    // Total row with emphasis - blue theme for quotations
    doc
      .rect(tableLeft, currentY, tableWidth, rowHeight)
      .fill('#3498DB')
      .strokeColor('#2980B9')
      .lineWidth(1)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#FFFFFF')
      .text(
        'TOTAL:',
        tableLeft + actualWidths.item + actualWidths.qty + 8,
        currentY + 6,
        {
          width: actualWidths.price - 10,
          align: 'right',
        },
      );

    doc.text(
      `$${Number(quotation.total_amount).toFixed(2)}`,
      tableLeft + actualWidths.item + actualWidths.qty + actualWidths.price + 8,
      currentY + 6,
      {
        width: actualWidths.total - 10,
        align: 'right',
      },
    );
    currentY += rowHeight;

    return currentY;
  }

  private addValidityInfo(doc: PDFKit.PDFDocument, quotation: any): void {
    const boxTop = doc.y;
    const boxHeight = 50;

    // Validity info box
    doc
      .rect(30, boxTop, doc.page.width - 60, boxHeight)
      .fill('#FFF4E6')
      .strokeColor('#F39C12')
      .lineWidth(1)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#F39C12')
      .text('Quotation Information:', 40, boxTop + 5);

    let currentY = boxTop + 20;

    // Valid until date (30 days from quotation date by default)
    const quotationDate = new Date(quotation.sale_date);
    const validUntil = new Date(quotationDate);
    validUntil.setDate(validUntil.getDate() + 30);

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#2C3E50')
      .text('Valid Until: ', 40, currentY, { continued: true })
      .font('Helvetica')
      .fillColor('#8B7500')
      .text(
        validUntil.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      );

    currentY += 15;

    // Status
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#2C3E50')
      .text('Status: ', 40, currentY, { continued: true })
      .font('Helvetica')
      .fillColor(quotation.converted_to_sale_id ? '#95A5A6' : '#27AE60')
      .text(quotation.converted_to_sale_id ? 'Converted to Sale' : 'Pending');

    doc.y = boxTop + boxHeight + 10;
  }

  private addFooter(
    doc: PDFKit.PDFDocument,
    quotation: any,
    includeBarcodes: boolean,
  ): void {
    // Compact notes section
    if (quotation.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#F39C12')
        .text('Notes: ', 30, doc.y, { continued: true })
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#8B7500')
        .text(quotation.notes);

      doc.y += 15;
    }

    // Terms and conditions
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#2C3E50')
      .text('Terms & Conditions:', 30, doc.y);

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#7F8C8D')
      .text(
        '• This quotation is valid for 30 days from the date of issue.',
        30,
        doc.y + 12,
      )
      .text('• Prices are subject to change without notice.', 30, doc.y + 25)
      .text(
        '• Payment terms and delivery schedule to be agreed upon order confirmation.',
        30,
        doc.y + 38,
      );

    doc.y += 60;

    // Centered barcode divider
    if (includeBarcodes && quotation.sale_number) {
      doc
        .font('Courier-Bold')
        .fontSize(12)
        .fillColor('#2C3E50')
        .text(`||||| || |||| ||||| | |||| |||||`, 0, doc.y, {
          align: 'center',
          width: doc.page.width,
        });

      doc.y += 20;
    }

    // Compact footer
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#3498DB')
      .text('Thank you for your interest!', 0, doc.y, {
        align: 'center',
        width: doc.page.width,
      });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#95A5A6')
      .text(
        `Generated on: ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
        0,
        doc.y + 15,
        { align: 'center', width: doc.page.width },
      );
  }
}
