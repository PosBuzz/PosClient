import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

interface SalesPdfOptions {
  includeBarcodes?: boolean;
  showItemDetails?: boolean;
  paperSize?: 'A4' | 'Letter';
  margin?: number;
}

@Injectable()
export class SalesPdfService {
  async generateSaleReceiptPdf(sale: any, options: SalesPdfOptions = {}): Promise<Buffer> {
    const {
      includeBarcodes = true,
      showItemDetails = true,
      paperSize = 'A4',
      margin = 30
    } = options;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ 
        size: paperSize, 
        margin,
        info: {
          Title: `Sale Receipt - ${sale.sale_number}`,
          Author: 'POS System',
          Subject: `Receipt for Sale ${sale.sale_number}`,
          Keywords: 'receipt, sale, invoice'
        }
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Start generating PDF content
      this.addReceiptHeader(doc, sale);
      this.addCompanyInfo(doc, sale);
      this.addSaleInfo(doc, sale);
      this.addCustomerInfo(doc, sale);
      
      if (showItemDetails) {
        this.addItemsTable(doc, sale);
      }
      
      this.addPaymentInfo(doc, sale);
      this.addFooter(doc, sale, includeBarcodes);

      doc.end();
    });
  }

  private addReceiptHeader(doc: PDFKit.PDFDocument, sale: any): void {
    const pageWidth = doc.page.width;
    
    // Add a compact background header
    doc.rect(0, 0, pageWidth, 60).fill('#F8F9FA');
    
    // Receipt title - smaller and more compact
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor('#2C3E50')
      .text('SALES RECEIPT', 0, 15, { align: 'center', width: pageWidth });

    // Single decorative line
    doc
      .moveTo(pageWidth * 0.3, 45)
      .lineTo(pageWidth * 0.7, 45)
      .strokeColor('#3498DB')
      .lineWidth(2)
      .stroke();

    doc.y = 70;
  }

  private addCompanyInfo(doc: PDFKit.PDFDocument, sale: any): void {
    const pageWidth = doc.page.width;
    
    // Compact company info
    if (sale.branch) {
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#2C3E50')
        .text(sale.branch.name || 'Main Store', 0, doc.y, { align: 'center', width: pageWidth });

      if (sale.branch.address) {
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#7F8C8D')
          .text(sale.branch.address, 0, doc.y + 15, { align: 'center', width: pageWidth });
      }
    }

    doc.y += 35;
  }

  private addSaleInfo(doc: PDFKit.PDFDocument, sale: any): void {
    const leftColumn = 40;
    const rightColumn = 320;
    const currentY = doc.y;
    const rowHeight = 18;

    // Compact info box
    doc.rect(30, currentY - 5, doc.page.width - 60, 60)
       .fill('#ECF0F1')
       .strokeColor('#BDC3C7')
       .lineWidth(1)
       .stroke();

    // Sale information - smaller fonts and spacing
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#2C3E50');

    // Left column labels
    doc.text('Receipt #:', leftColumn, currentY);
    doc.text('Date:', leftColumn, currentY + rowHeight);
    doc.text('Cashier:', leftColumn, currentY + rowHeight * 2);

    // Right column values
    doc.font('Helvetica').fontSize(10).fillColor('#34495E');
    doc.text(sale.sale_number, rightColumn, currentY);
    
    const saleDate = new Date(sale.sale_date);
    const formattedDate = saleDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = saleDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    doc.text(`${formattedDate} ${formattedTime}`, rightColumn, currentY + rowHeight);
    doc.text(sale.user?.name || 'Consumer Admin', rightColumn, currentY + rowHeight * 2);

    doc.y = currentY + 65;
  }

  private addCustomerInfo(doc: PDFKit.PDFDocument, sale: any): void {
    if (sale.customer_name || sale.customer_phone || sale.customer_email) {
      const boxTop = doc.y;
      const boxHeight = 45;

      // Compact customer info box
      doc.rect(30, boxTop, doc.page.width - 60, boxHeight)
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

      if (sale.customer_name) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2C3E50')
          .text(`Name: `, 40, infoY, { continued: true })
          .font('Helvetica')
          .fillColor('#34495E')
          .text(`${sale.customer_name}`);
      }

      if (sale.customer_phone) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2C3E50')
          .text(`Phone: `, 280, boxTop + 20, { continued: true })
          .font('Helvetica')
          .fillColor('#34495E')
          .text(`${sale.customer_phone}`);
      }

      if (sale.customer_email) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2C3E50')
          .text(`Email: `, 40, boxTop + 32, { continued: true })
          .font('Helvetica')
          .fillColor('#34495E')
          .text(`${sale.customer_email}`);
      }

      doc.y = boxTop + boxHeight + 10;
    }
  }

  private addItemsTable(doc: PDFKit.PDFDocument, sale: any): void {
    const tableTop = doc.y;
    const tableLeft = 30;
    const tableWidth = doc.page.width - 60;

    // Column widths (as percentages of table width)
    const colWidths = {
      item: 0.4,
      qty: 0.15,
      price: 0.2,
      total: 0.25
    };

    // Calculate actual column widths
    const actualWidths = {
      item: tableWidth * colWidths.item,
      qty: tableWidth * colWidths.qty,
      price: tableWidth * colWidths.price,
      total: tableWidth * colWidths.total
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
    doc.rect(tableLeft, headerY, tableWidth, rowHeight)
       .fill('#34495E')
       .strokeColor('#2C3E50')
       .lineWidth(1)
       .stroke();

    // Header text - smaller font
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#FFFFFF');

    let currentX = tableLeft + 8;
    doc.text('Item', currentX, headerY + 6, { width: actualWidths.item - 16 });
    currentX += actualWidths.item;
    doc.text('Qty', currentX, headerY + 6, { width: actualWidths.qty - 10, align: 'center' });
    currentX += actualWidths.qty;
    doc.text('Unit Price', currentX, headerY + 6, { width: actualWidths.price - 10, align: 'right' });
    currentX += actualWidths.price;
    doc.text('Total', currentX, headerY + 6, { width: actualWidths.total - 10, align: 'right' });

    // Items - compact rows
    let currentY = headerY + rowHeight;
    doc.font('Helvetica').fontSize(9).fillColor('#2C3E50');

    sale.items?.forEach((item: any, index: number) => {
      // Compact rows
      if (index % 2 === 0) {
        doc.rect(tableLeft, currentY, tableWidth, rowHeight)
           .fill('#F8F9FA')
           .strokeColor('#E9ECEF')
           .lineWidth(0.5)
           .stroke();
      } else {
        doc.rect(tableLeft, currentY, tableWidth, rowHeight)
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
        .text(itemName, currentX, currentY + 6, { width: actualWidths.item - 16 });
      
      // Quantity
      currentX += actualWidths.item;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#3498DB')
        .text(item.quantity.toString(), currentX, currentY + 6, { 
          width: actualWidths.qty - 10, 
          align: 'center' 
        });
      
      // Unit price
      currentX += actualWidths.qty;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#34495E')
        .text(`$${Number(item.unit_price).toFixed(2)}`, currentX, currentY + 6, { 
          width: actualWidths.price - 10, 
          align: 'right' 
        });
      
      // Total
      currentX += actualWidths.price;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#27AE60')
        .text(`$${Number(item.line_total).toFixed(2)}`, currentX, currentY + 6, { 
          width: actualWidths.total - 10, 
          align: 'right' 
        });

      currentY += rowHeight;
    });

    // Add totals section as table rows
    currentY = this.addTotalsAsTableRows(doc, sale, tableLeft, tableWidth, actualWidths, currentY, rowHeight);
    
    // Update document y position
    doc.y = currentY + 5;
  }

  private addTotalsAsTableRows(doc: PDFKit.PDFDocument, sale: any, tableLeft: number, tableWidth: number, actualWidths: any, startY: number, rowHeight: number): number {
    let currentY = startY;
    
    // Add separator line
    doc.rect(tableLeft, currentY, tableWidth, 2)
       .fill('#BDC3C7')
       .stroke();
    currentY += 8;

    // Subtotal row
    doc.rect(tableLeft, currentY, tableWidth, rowHeight)
       .fill('#F8F9FA')
       .strokeColor('#E9ECEF')
       .lineWidth(0.5)
       .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#2C3E50')
      .text('Subtotal:', tableLeft + actualWidths.item + actualWidths.qty + 8, currentY + 6, { 
        width: actualWidths.price - 10, 
        align: 'right' 
      });

    doc.text(`$${Number(sale.subtotal || 0).toFixed(2)}`, tableLeft + actualWidths.item + actualWidths.qty + actualWidths.price + 8, currentY + 6, { 
      width: actualWidths.total - 10, 
      align: 'right' 
    });
    currentY += rowHeight;

    // Tax row (if applicable)
    if (sale.tax_amount && Number(sale.tax_amount) > 0) {
      doc.rect(tableLeft, currentY, tableWidth, rowHeight)
         .fill('#FFFFFF')
         .strokeColor('#E9ECEF')
         .lineWidth(0.5)
         .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#2C3E50')
        .text('Tax:', tableLeft + actualWidths.item + actualWidths.qty + 8, currentY + 6, { 
          width: actualWidths.price - 10, 
          align: 'right' 
        });

      doc.text(`$${Number(sale.tax_amount).toFixed(2)}`, tableLeft + actualWidths.item + actualWidths.qty + actualWidths.price + 8, currentY + 6, { 
        width: actualWidths.total - 10, 
        align: 'right' 
      });
      currentY += rowHeight;
    }

    // Discount row (if applicable)
    if (sale.discount_amount && Number(sale.discount_amount) > 0) {
      doc.rect(tableLeft, currentY, tableWidth, rowHeight)
         .fill('#F8F9FA')
         .strokeColor('#E9ECEF')
         .lineWidth(0.5)
         .stroke();

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#E74C3C')
        .text('Discount:', tableLeft + actualWidths.item + actualWidths.qty + 8, currentY + 6, { 
          width: actualWidths.price - 10, 
          align: 'right' 
        });

      doc.text(`-$${Number(sale.discount_amount).toFixed(2)}`, tableLeft + actualWidths.item + actualWidths.qty + actualWidths.price + 8, currentY + 6, { 
        width: actualWidths.total - 10, 
        align: 'right' 
      });
      currentY += rowHeight;
    }

    // Total row with emphasis
    doc.rect(tableLeft, currentY, tableWidth, rowHeight)
       .fill('#E74C3C')
       .strokeColor('#C0392B')
       .lineWidth(1)
       .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#FFFFFF')
      .text('TOTAL:', tableLeft + actualWidths.item + actualWidths.qty + 8, currentY + 6, { 
        width: actualWidths.price - 10, 
        align: 'right' 
      });

    doc.text(`$${Number(sale.total_amount).toFixed(2)}`, tableLeft + actualWidths.item + actualWidths.qty + actualWidths.price + 8, currentY + 6, { 
      width: actualWidths.total - 10, 
      align: 'right' 
    });
    currentY += rowHeight;

    return currentY;
  }

  private addPaymentInfo(doc: PDFKit.PDFDocument, sale: any): void {
    const boxTop = doc.y;
    let boxHeight = 80;

    // Calculate total paid amount
    const totalPaid = sale.payments?.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) || 0;

    // Compact payment info box
    doc.rect(30, boxTop, doc.page.width - 60, boxHeight)
       .fill('#E8F4FD')
       .strokeColor('#3498DB')
       .lineWidth(1)
       .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#3498DB')
      .text('Payment Information:', 40, boxTop + 5);

    let currentY = boxTop + 20;

    // Payment status with color coding
    const statusColors = {
      'paid': '#27AE60',
      'partial': '#F39C12',
      'due': '#E74C3C',
      'cancelled': '#95A5A6'
    };

    const statusColor = statusColors[sale.payment_status as keyof typeof statusColors] || '#34495E';
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#2C3E50')
      .text('Status: ', 40, currentY, { continued: true })
      .fillColor(statusColor)
      .text(sale.payment_status?.toUpperCase() || 'N/A');

    // Total paid amount
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#2C3E50')
      .text('Total Paid: ', 250, currentY, { continued: true })
      .font('Helvetica-Bold')
      .fillColor('#27AE60')
      .text(`$${totalPaid.toFixed(2)}`);

    currentY += 15;

    // Payment methods - inline
    if (sale.payments && sale.payments.length > 0) {
      let paymentText = 'Payment Methods: ';
      sale.payments.forEach((payment: any, index: number) => {
        if (index > 0) paymentText += ', ';
        paymentText += `${payment.payment_method}: $${Number(payment.amount).toFixed(2)}`;
        if (payment.reference) {
          paymentText += ` (Ref: ${payment.reference})`;
        }
      });
      
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#34495E')
        .text(paymentText, 40, currentY, { width: doc.page.width - 80 });
      currentY += 15;
    }

    // Change amount if applicable
    if (sale.change_amount && Number(sale.change_amount) > 0) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#2C3E50')
        .text('Change Given: ', 40, currentY, { continued: true })
        .font('Helvetica')
        .fillColor('#F39C12')
        .text(`$${Number(sale.change_amount).toFixed(2)}`);
    }

    doc.y = boxTop + boxHeight + 10;
  }

  private addFooter(doc: PDFKit.PDFDocument, sale: any, includeBarcodes: boolean): void {
    // Compact notes section
    if (sale.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#F39C12')
        .text('Notes: ', 30, doc.y, { continued: true })
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#8B7500')
        .text(sale.notes);
      
      doc.y += 15;
    }

    // Centered barcode divider
    if (includeBarcodes && sale.sale_number) {
      doc
        .font('Courier-Bold')
        .fontSize(12)
        .fillColor('#2C3E50')
        .text(`||||| || |||| ||||| | |||| |||||`, 0, doc.y, { align: 'center', width: doc.page.width });
      
      doc.y += 20;
    }

    // Compact footer
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#27AE60')
      .text('Thank you for your business!', 0, doc.y, { align: 'center', width: doc.page.width });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#95A5A6')
      .text(`Generated on: ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, 0, doc.y + 15, { align: 'center', width: doc.page.width });
  }
}
