import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } from 'node-thermal-printer';
import * as fs from 'fs';
import * as path from 'path';

interface PrinterSettings {
  printerName?: string;
  paperWidth: number; // in characters (40 or 80 typically)
  encoding?: string;
  autocut?: boolean;
  buzzer?: boolean;
}

export { PrinterSettings };

interface ReceiptData {
  sale: any;
  consumerInfo: any;
  branchInfo: any;
  printerSettings?: PrinterSettings;
}

@Injectable()
export class ThermalPrinterService {
  private readonly logger = new Logger(ThermalPrinterService.name);
  private defaultSettings: PrinterSettings = {
    paperWidth: 40,
    encoding: 'utf8',
    autocut: true,
    buzzer: false,
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Print a sales receipt
   */
  async printSalesReceipt(
    saleId: number,
    consumerId: number,
    printerSettings?: Partial<PrinterSettings>
  ): Promise<{ success: boolean; message: string; receiptData?: string }> {
    try {
      // Get sale data with all related information
      const sale = await this.getSaleWithDetails(saleId, consumerId);
      if (!sale) {
        throw new BadRequestException('Sale not found');
      }

      // Get consumer and branch information
      const [consumerInfo, branchInfo] = await Promise.all([
        this.getConsumerInfo(consumerId),
        this.getBranchInfo(sale.branch_id)
      ]);

      const receiptData: ReceiptData = {
        sale,
        consumerInfo,
        branchInfo,
        printerSettings: { ...this.defaultSettings, ...printerSettings }
      };

      // Generate receipt with new printer API
      const printer = await this.generateReceiptWithPrinter(receiptData);
      
      // Execute print
      await printer.execute();

      this.logger.log(`Receipt printed for sale ${sale.sale_number}`);

      // Also generate text content for preview/backup
      const receiptContent = this.generateReceiptContent(receiptData);

      return {
        success: true,
        message: 'Receipt printed successfully',
        receiptData: receiptContent
      };
    } catch (error) {
      this.logger.error(`Failed to print receipt for sale ${saleId}:`, error);
      
      // Try fallback method
      try {
        const fallbackSale = await this.getSaleWithDetails(saleId, consumerId);
        if (!fallbackSale) {
          throw new BadRequestException('Sale not found');
        }
        
        const [consumerInfo, branchInfo] = await Promise.all([
          this.getConsumerInfo(consumerId),
          this.getBranchInfo(fallbackSale.branch_id)
        ]);

        const receiptData: ReceiptData = {
          sale: fallbackSale,
          consumerInfo,
          branchInfo,
          printerSettings: { ...this.defaultSettings, ...printerSettings }
        };

        const receiptContent = this.generateReceiptContent(receiptData);
        this.saveReceiptToFile(receiptContent, receiptData.printerSettings!);
        
        return {
          success: true,
          message: 'Receipt saved to file (printer unavailable)',
          receiptData: receiptContent
        };
      } catch (fallbackError) {
        return {
          success: false,
          message: error.message || 'Failed to print receipt'
        };
      }
    }
  }

  /**
   * Generate receipt content as ESC/POS commands
   */
  private generateReceiptContent(data: ReceiptData): string {
    const { sale, consumerInfo, branchInfo, printerSettings } = data;
    const width = printerSettings!.paperWidth;
    
    let receipt = '';

    // Initialize printer
    receipt += '\x1B\x40'; // Initialize
    receipt += '\x1B\x61\x01'; // Center alignment

    // Store header
    receipt += this.centerText(consumerInfo.company_name || 'POS Store', width) + '\n';
    if (branchInfo.name) {
      receipt += this.centerText(`Branch: ${branchInfo.name}`, width) + '\n';
    }
    if (branchInfo.address) {
      receipt += this.centerText(branchInfo.address, width) + '\n';
    }
    if (branchInfo.phone) {
      receipt += this.centerText(`Tel: ${branchInfo.phone}`, width) + '\n';
    }
    
    receipt += this.printLine(width) + '\n';

    // Sale information
    receipt += '\x1B\x61\x00'; // Left alignment
    receipt += `Sale #: ${sale.sale_number}\n`;
    receipt += `Date: ${this.formatDate(sale.sale_date)}\n`;
    receipt += `Time: ${this.formatTime(sale.sale_date)}\n`;
    receipt += `Cashier: ${sale.user?.name || 'Unknown'}\n`;
    
    if (sale.customer_name) {
      receipt += `Customer: ${sale.customer_name}\n`;
    }
    if (sale.customer_phone) {
      receipt += `Phone: ${sale.customer_phone}\n`;
    }

    receipt += this.printLine(width) + '\n';

    // Items header
    receipt += this.padString('Item', 'Qty', 'Price', 'Total', width) + '\n';
    receipt += this.printLine(width) + '\n';

    // Items
    for (const item of sale.items) {
      const itemName = this.truncateText(
        item.variant.name || item.variant.product.name,
        width - 15
      );
      receipt += itemName + '\n';
      
      const qty = item.quantity.toString();
      const price = this.formatCurrency(item.unit_price);
      const total = this.formatCurrency(item.line_total);
      
      receipt += this.padString('', qty, price, total, width) + '\n';
      
      if (item.discount_amount > 0) {
        receipt += `  Discount: -${this.formatCurrency(item.discount_amount)}\n`;
      }
    }

    receipt += this.printLine(width) + '\n';

    // Totals
    receipt += this.rightAlign(`Subtotal: ${this.formatCurrency(sale.subtotal)}`, width) + '\n';
    
    if (sale.discount_amount > 0) {
      receipt += this.rightAlign(`Discount: -${this.formatCurrency(sale.discount_amount)}`, width) + '\n';
    }
    
    if (sale.tax_amount > 0) {
      receipt += this.rightAlign(`Tax: ${this.formatCurrency(sale.tax_amount)}`, width) + '\n';
    }
    
    if (sale.shipping_cost > 0) {
      receipt += this.rightAlign(`Shipping: ${this.formatCurrency(sale.shipping_cost)}`, width) + '\n';
    }

    // Total with emphasis
    receipt += this.printLine(width) + '\n';
    receipt += '\x1B\x45\x01'; // Bold on
    receipt += this.rightAlign(`TOTAL: ${this.formatCurrency(sale.total_amount)}`, width) + '\n';
    receipt += '\x1B\x45\x00'; // Bold off

    // Payment information
    if (sale.payments && sale.payments.length > 0) {
      receipt += this.printLine(width) + '\n';
      receipt += 'PAYMENT DETAILS:\n';
      
      for (const payment of sale.payments) {
        const paymentLine = `${payment.payment_method}: ${this.formatCurrency(payment.amount)}`;
        receipt += paymentLine + '\n';
        if (payment.reference) {
          receipt += `  Ref: ${payment.reference}\n`;
        }
      }
      
      if (sale.change_amount > 0) {
        receipt += this.rightAlign(`Change: ${this.formatCurrency(sale.change_amount)}`, width) + '\n';
      }
    } else {
      // Legacy payment system
      receipt += this.printLine(width) + '\n';
      if (sale.received_amount > 0) {
        receipt += this.rightAlign(`Received: ${this.formatCurrency(sale.received_amount)}`, width) + '\n';
        if (sale.change_amount > 0) {
          receipt += this.rightAlign(`Change: ${this.formatCurrency(sale.change_amount)}`, width) + '\n';
        }
      }
    }

    // Payment status
    receipt += this.printLine(width) + '\n';
    receipt += `Status: ${this.getPaymentStatusText(sale.payment_status)}\n`;

    // Footer
    receipt += this.printLine(width) + '\n';
    receipt += '\x1B\x61\x01'; // Center alignment
    receipt += this.centerText('Thank you for your business!', width) + '\n';
    receipt += this.centerText('Please come again', width) + '\n';
    
    if (sale.notes) {
      receipt += '\n' + this.centerText(sale.notes, width) + '\n';
    }

    // Barcode for sale number (if supported)
    receipt += '\n';
    receipt += this.generateBarcode(sale.sale_number);

    // Footer spacing and cut
    receipt += '\n\n\n';
    
    if (printerSettings!.autocut) {
      receipt += '\x1D\x56\x00'; // Full cut
    }
    
    if (printerSettings!.buzzer) {
      receipt += '\x1B\x70\x00\x19\x0A'; // Buzzer
    }

    return receipt;
  }

  /**
   * Print receipt to thermal printer
   */
  private async printReceipt(content: string, settings: PrinterSettings): Promise<void> {
    try {
      // Initialize thermal printer
      let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: settings.printerName || 'printer', // or 'tcp://192.168.1.100' for network printer
        characterSet: CharacterSet.PC852_LATIN2,
        removeSpecialCharacters: false,
        lineCharacter: "-",
        breakLine: BreakLine.WORD,
        options: {
          timeout: 5000
        }
      });

      // Add the content to printer buffer
      printer.raw(Buffer.from(content, settings.encoding as BufferEncoding || 'utf8'));

      // Execute print
      await printer.execute();
      
      this.logger.log('Receipt printed successfully to thermal printer');
    } catch (error) {
      this.logger.warn('Failed to print to thermal printer, saving to file instead:', error.message);
      // Fallback: save to file for manual printing
      this.saveReceiptToFile(content, settings);
    }
  }

  /**
   * Save receipt content to file as fallback
   */
  private saveReceiptToFile(content: string, settings: PrinterSettings): void {
    try {
      const receiptsDir = path.join(process.cwd(), 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `receipt-${timestamp}.txt`;
      const filepath = path.join(receiptsDir, filename);

      fs.writeFileSync(filepath, content);
      this.logger.log(`Receipt saved to file: ${filepath}`);
    } catch (error) {
      this.logger.error('Failed to save receipt to file:', error);
    }
  }

  /**
   * Generate barcode for sale number
   */
  private generateBarcode(saleNumber: string): string {
    // Code 128 barcode
    let barcode = '\x1D\x6B\x49'; // Barcode type Code 128
    barcode += String.fromCharCode(saleNumber.length); // Length
    barcode += saleNumber; // Data
    return barcode;
  }

  /**
   * Generate receipt using ThermalPrinter API
   */
  private async generateReceiptWithPrinter(data: ReceiptData): Promise<ThermalPrinter> {
    const { sale, consumerInfo, branchInfo, printerSettings } = data;
    const width = printerSettings!.paperWidth;
    
    let printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: printerSettings!.printerName || 'printer',
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: "-",
      breakLine: BreakLine.WORD,
      options: {
        timeout: 5000
      }
    });

    // Store header
    printer.alignCenter();
    printer.println(consumerInfo.company_name || 'POS Store');
    if (branchInfo.name) {
      printer.println(`Branch: ${branchInfo.name}`);
    }
    if (branchInfo.address) {
      printer.println(branchInfo.address);
    }
    if (branchInfo.phone) {
      printer.println(`Tel: ${branchInfo.phone}`);
    }
    
    printer.drawLine();

    // Sale information
    printer.alignLeft();
    printer.println(`Sale #: ${sale.sale_number}`);
    printer.println(`Date: ${this.formatDate(sale.sale_date)}`);
    printer.println(`Time: ${this.formatTime(sale.sale_date)}`);
    printer.println(`Cashier: ${sale.user?.name || 'Unknown'}`);
    
    if (sale.customer_name) {
      printer.println(`Customer: ${sale.customer_name}`);
    }
    if (sale.customer_phone) {
      printer.println(`Phone: ${sale.customer_phone}`);
    }

    printer.drawLine();

    // Items header
    printer.println(this.padString('Item', 'Qty', 'Price', 'Total', width));
    printer.drawLine();

    // Items
    for (const item of sale.items) {
      const itemName = this.truncateText(
        item.variant.name || item.variant.product.name,
        width - 15
      );
      printer.println(itemName);
      
      const qty = item.quantity.toString();
      const price = this.formatCurrency(item.unit_price);
      const total = this.formatCurrency(item.line_total);
      
      printer.println(this.padString('', qty, price, total, width));
      
      if (item.discount_amount > 0) {
        printer.println(`  Discount: -${this.formatCurrency(item.discount_amount)}`);
      }
    }

    printer.drawLine();

    // Totals
    printer.alignRight();
    printer.println(`Subtotal: ${this.formatCurrency(sale.subtotal)}`);
    
    if (sale.discount_amount > 0) {
      printer.println(`Discount: -${this.formatCurrency(sale.discount_amount)}`);
    }
    
    if (sale.tax_amount > 0) {
      printer.println(`Tax: ${this.formatCurrency(sale.tax_amount)}`);
    }
    
    if (sale.shipping_cost > 0) {
      printer.println(`Shipping: ${this.formatCurrency(sale.shipping_cost)}`);
    }

    // Total with emphasis
    printer.drawLine();
    printer.bold(true);
    printer.println(`TOTAL: ${this.formatCurrency(sale.total_amount)}`);
    printer.bold(false);

    // Payment information
    if (sale.payments && sale.payments.length > 0) {
      printer.drawLine();
      printer.alignLeft();
      printer.println('PAYMENT DETAILS:');
      
      for (const payment of sale.payments) {
        const paymentLine = `${payment.payment_method}: ${this.formatCurrency(payment.amount)}`;
        printer.println(paymentLine);
        if (payment.reference) {
          printer.println(`  Ref: ${payment.reference}`);
        }
      }
      
      if (sale.change_amount > 0) {
        printer.alignRight();
        printer.println(`Change: ${this.formatCurrency(sale.change_amount)}`);
      }
    } else {
      // Legacy payment system
      printer.drawLine();
      printer.alignRight();
      if (sale.received_amount > 0) {
        printer.println(`Received: ${this.formatCurrency(sale.received_amount)}`);
        if (sale.change_amount > 0) {
          printer.println(`Change: ${this.formatCurrency(sale.change_amount)}`);
        }
      }
    }

    // Payment status
    printer.drawLine();
    printer.alignLeft();
    printer.println(`Status: ${this.getPaymentStatusText(sale.payment_status)}`);

    // Footer
    printer.drawLine();
    printer.alignCenter();
    printer.println('Thank you for your business!');
    printer.println('Please come again');
    
    if (sale.notes) {
      printer.newLine();
      printer.println(sale.notes);
    }

    // Barcode for sale number
    printer.newLine();
    try {
      printer.code128(sale.sale_number);
    } catch (error) {
      // If barcode fails, just print the sale number
      printer.println(`Sale: ${sale.sale_number}`);
    }

    // Footer spacing and cut
    printer.newLine();
    printer.newLine();
    printer.newLine();
    
    if (printerSettings!.autocut) {
      printer.cut();
    }
    
    if (printerSettings!.buzzer) {
      printer.beep();
    }

    return printer;
  }

  // Utility methods for formatting

  private centerText(text: string, width: number): string {
    if (text.length >= width) return text.substring(0, width);
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(padding) + text;
  }

  private rightAlign(text: string, width: number): string {
    if (text.length >= width) return text.substring(0, width);
    const padding = width - text.length;
    return ' '.repeat(padding) + text;
  }

  private padString(col1: string, col2: string, col3: string, col4: string, width: number): string {
    const colWidth = Math.floor(width / 4);
    return (
      col1.padEnd(colWidth).substring(0, colWidth) +
      col2.padStart(colWidth).substring(0, colWidth) +
      col3.padStart(colWidth).substring(0, colWidth) +
      col4.padStart(colWidth).substring(0, colWidth)
    );
  }

  private printLine(width: number, char: string = '-'): string {
    return char.repeat(width);
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(date));
  }

  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(date));
  }

  private getPaymentStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'PAID': 'PAID',
      'PARTIAL': 'PARTIALLY PAID',
      'DUE': 'DUE',
      'CANCELLED': 'CANCELLED'
    };
    return statusMap[status] || status;
  }

  // Data fetching methods

  private async getSaleWithDetails(saleId: number, consumerId: number) {
    return this.prisma.sale.findFirst({
      where: { id: saleId, consumer_id: consumerId },
      include: {
        customer: true,
        branch: true,
        user: { select: { id: true, name: true } },
        payments: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
                sale_unit: true,
              },
            },
            batch: true,
          },
        },
      },
    });
  }

  private async getConsumerInfo(consumerId: number) {
    return this.prisma.consumer.findUnique({
      where: { id: consumerId },
      select: {
        company_name: true,
        email: true,
        phone: true,
        address: true,
      },
    });
  }

  private async getBranchInfo(branchId: number) {
    return this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        name: true,
        address: true,
        phone: true,
        email: true,
      },
    });
  }

  /**
   * Test print functionality
   */
  async testPrint(settings?: Partial<PrinterSettings>): Promise<{ success: boolean; message: string }> {
    try {
      const testSettings = { ...this.defaultSettings, ...settings };
      
      // Create test printer
      let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: testSettings.printerName || 'printer',
        characterSet: CharacterSet.PC852_LATIN2,
        removeSpecialCharacters: false,
        lineCharacter: "-",
        breakLine: BreakLine.WORD,
        options: {
          timeout: 5000
        }
      });

      // Add test content
      printer.alignCenter();
      printer.println('PRINTER TEST');
      printer.drawLine();
      printer.alignLeft();
      printer.println(`Date: ${this.formatDate(new Date())}`);
      printer.println(`Time: ${this.formatTime(new Date())}`);
      printer.drawLine();
      printer.println('This is a test print.');
      printer.println('If you can read this,');
      printer.println('your printer is working!');
      printer.drawLine();
      printer.newLine();
      printer.newLine();
      printer.newLine();
      
      if (testSettings.autocut) {
        printer.cut();
      }

      // Execute print
      await printer.execute();

      return {
        success: true,
        message: 'Test print completed successfully'
      };
    } catch (error) {
      this.logger.error('Test print failed:', error);
      
      // Try fallback - save to file
      try {
        const testSettings = { ...this.defaultSettings, ...settings };
        const width = testSettings.paperWidth;
        
        let testContent = '';
        testContent += this.centerText('PRINTER TEST', width) + '\n';
        testContent += this.printLine(width) + '\n';
        testContent += `Date: ${this.formatDate(new Date())}\n`;
        testContent += `Time: ${this.formatTime(new Date())}\n`;
        testContent += this.printLine(width) + '\n';
        testContent += 'This is a test print.\n';
        testContent += 'If you can read this,\n';
        testContent += 'your printer is working!\n';
        testContent += this.printLine(width) + '\n';
        testContent += '\n\n\n';

        this.saveReceiptToFile(testContent, testSettings);
        
        return {
          success: true,
          message: 'Test print saved to file (printer unavailable)'
        };
      } catch (fallbackError) {
        return {
          success: false,
          message: error.message || 'Test print failed'
        };
      }
    }
  }

  /**
   * Get available printer settings
   */
  getDefaultSettings(): PrinterSettings {
    return { ...this.defaultSettings };
  }

  /**
   * Update printer settings
   */
  updateSettings(newSettings: Partial<PrinterSettings>): PrinterSettings {
    this.defaultSettings = { ...this.defaultSettings, ...newSettings };
    return this.defaultSettings;
  }
}
