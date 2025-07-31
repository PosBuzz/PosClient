import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PRINTER_CONFIG, PrinterSettings, AgentReceiptData } from '../../../constants/printer.constants';

@Injectable()
export class ThermalPrinterService {
  private readonly logger = new Logger(ThermalPrinterService.name);
  private defaultSettings: PrinterSettings = {
    paperWidth: PRINTER_CONFIG.DEFAULT_PAPER_WIDTH,
    encoding: PRINTER_CONFIG.DEFAULT_ENCODING,
    autocut: PRINTER_CONFIG.DEFAULT_AUTOCUT,
    buzzer: PRINTER_CONFIG.DEFAULT_BUZZER,
    agentUrl: PRINTER_CONFIG.DEFAULT_AGENT_URL,
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Prepare receipt data for printing (frontend will send to agent)
   */
  async prepareSalesReceipt(
    saleId: number,
    consumerId: number,
    printerSettings?: Partial<PrinterSettings>
  ): Promise<{ success: boolean; message: string; receiptData: AgentReceiptData }> {
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

      const settings = { ...this.defaultSettings, ...printerSettings };
      
      // Convert to agent-compatible format
      const agentData = this.convertToAgentFormat(sale, consumerInfo, branchInfo);

      this.logger.log(`Receipt data prepared for sale ${sale.sale_number}`);

      return {
        success: true,
        message: 'Receipt data prepared successfully',
        receiptData: agentData
      };
    } catch (error) {
      this.logger.error(`Failed to prepare receipt for sale ${saleId}:`, error);
      
      throw new BadRequestException(
        error.message || 'Failed to prepare receipt data'
      );
    }
  }

  /**
   * Convert POS sale data to agent-compatible format
   */
  private convertToAgentFormat(sale: any, consumerInfo: any, branchInfo: any): AgentReceiptData {
    this.logger.log('=== CONVERTING SALE DATA TO AGENT FORMAT ===');
    this.logger.log(`Sale ID: ${sale.id}`);
    this.logger.log(`Sale Number: ${sale.sale_number}`);
    this.logger.log(`Customer: ${sale.customer_name || 'Walk-in Customer'}`);
    this.logger.log(`Items count: ${sale.items?.length || 0}`);
    this.logger.log(`Total amount: ${sale.total_amount}`);

    const agentData: AgentReceiptData = {
      orderId: sale.id?.toString(),
      sale_number: sale.sale_number,
      sale_date: sale.sale_date,
      customer_name: sale.customer_name || 'Walk-in Customer',
      customer_phone: sale.customer_phone,
      branch: branchInfo ? {
        name: branchInfo.name,
        address: branchInfo.address,
        phone: branchInfo.phone,
        email: branchInfo.email,
      } : undefined,
      user: sale.user ? {
        name: sale.user.name,
        id: sale.user.id?.toString(),
      } : undefined,
      items: sale.items?.map((item: any) => ({
        name: item.variant?.name || item.variant?.product?.name || 'Unknown Item',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        line_total: Number(item.line_total) || 0,
        discount_amount: Number(item.discount_amount) || 0,
        variant: {
          name: item.variant?.name,
          product: {
            name: item.variant?.product?.name,
          },
        },
      })) || [],
      subtotal: Number(sale.subtotal) || 0,
      tax_amount: Number(sale.tax_amount) || 0,
      discount_amount: Number(sale.discount_amount) || 0,
      shipping_cost: Number(sale.shipping_cost) || 0,
      total_amount: Number(sale.total_amount) || 0,
      received_amount: Number(sale.received_amount) || 0,
      change_amount: Number(sale.change_amount) || 0,
      payments: sale.payments?.map((payment: any) => ({
        payment_method: payment.payment_method || 'Cash',
        amount: Number(payment.amount) || 0,
      })) || [],
      payment_status: sale.payment_status,
      notes: sale.notes || PRINTER_CONFIG.DEFAULT_RECEIPT_SETTINGS.thankYouMessage,
      openCashDrawer: PRINTER_CONFIG.DEFAULT_RECEIPT_SETTINGS.openCashDrawer,
    };

    this.logger.log('=== AGENT DATA PREPARED ===');
    this.logger.log(JSON.stringify(agentData, null, 2));

    return agentData;
  }

  /**
   * Get default printer settings
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

  /**
   * Get test receipt data for frontend testing
   */
  getTestReceiptData(): AgentReceiptData {
    return {
      orderId: 'TEST-001',
      sale_number: 'TEST-001',
      sale_date: new Date().toISOString(),
      customer_name: PRINTER_CONFIG.DEFAULT_RECEIPT_SETTINGS.defaultCustomerName,
      customer_phone: '555-0123',
      branch: {
        name: 'Test Branch',
        address: '123 Test Street',
        phone: '555-0100',
        email: 'test@example.com',
      },
      user: {
        name: 'Test Cashier',
        id: '1',
      },
      items: [
        {
          name: 'Test Item',
          quantity: 1,
          unit_price: 10.00,
          line_total: 10.00,
          discount_amount: 0,
        },
      ],
      subtotal: 10.00,
      tax_amount: 0.80,
      discount_amount: 0,
      shipping_cost: 0,
      total_amount: 10.80,
      received_amount: 20.00,
      change_amount: 9.20,
      payments: [
        {
          payment_method: 'Cash',
          amount: 20.00,
        },
      ],
      payment_status: 'PAID',
      notes: PRINTER_CONFIG.DEFAULT_RECEIPT_SETTINGS.thankYouMessage,
      openCashDrawer: false, // Don't open drawer for test
    };
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
}
