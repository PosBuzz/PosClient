import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface PrinterSettings {
  printerName?: string;
  paperWidth: number; // in characters (40 or 80 typically)
  encoding?: string;
  autocut?: boolean;
  buzzer?: boolean;
  agentUrl?: string; // URL for the printing agent
}

export { PrinterSettings };

interface AgentReceiptData {
  orderId?: string;
  sale_number?: string;
  sale_date?: string;
  customer_name?: string;
  customer_phone?: string;
  branch?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  user?: {
    name?: string;
    id?: string;
  };
  items: Array<{
    name?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    discount_amount?: number;
    variant?: {
      name?: string;
      product?: {
        name?: string;
      };
    };
  }>;
  subtotal: number;
  tax_amount?: number;
  discount_amount?: number;
  shipping_cost?: number;
  total_amount: number;
  received_amount?: number;
  change_amount?: number;
  payments?: Array<{
    payment_method: string;
    amount: number;
  }>;
  payment_status?: string;
  notes?: string;
  openCashDrawer?: boolean;
}

@Injectable()
export class ThermalPrinterService {
  private readonly logger = new Logger(ThermalPrinterService.name);
  private defaultSettings: PrinterSettings = {
    paperWidth: 40,
    encoding: 'utf8',
    autocut: true,
    buzzer: false,
    agentUrl: 'http://localhost:8080', // Default agent URL
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Print a sales receipt using the printing agent
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

      const settings = { ...this.defaultSettings, ...printerSettings };
      
      // Convert to agent-compatible format
      const agentData = this.convertToAgentFormat(sale, consumerInfo, branchInfo);

      // Send to printing agent
      const result = await this.sendToAgent(agentData, settings);

      this.logger.log(`Receipt sent to agent for sale ${sale.sale_number}`);

      return {
        success: result.success,
        message: result.message || 'Receipt sent to printer successfully',
        receiptData: JSON.stringify(agentData, null, 2)
      };
    } catch (error) {
      this.logger.error(`Failed to print receipt for sale ${saleId}:`, error);
      
      return {
        success: false,
        message: error.message || 'Failed to print receipt'
      };
    }
  }

  /**
   * Convert POS sale data to agent-compatible format
   */
  private convertToAgentFormat(sale: any, consumerInfo: any, branchInfo: any): AgentReceiptData {
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
      notes: sale.notes || 'Thank you for your business!',
      openCashDrawer: true, // Default to opening cash drawer
    };

    return agentData;
  }

  /**
   * Send receipt data to printing agent
   */
  private async sendToAgent(
    agentData: AgentReceiptData, 
    settings: PrinterSettings
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const agentUrl = settings.agentUrl || 'http://localhost:8080';
      
      const response = await fetch(`${agentUrl}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success || false,
        message: result.message || result.error || 'Unknown response'
      };
    } catch (error) {
      this.logger.error('Failed to communicate with printing agent:', error);
      
      // Check if agent is running
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        return {
          success: false,
          message: 'Printing agent is not running. Please start the printing agent on the client computer and try again.'
        };
      }
      
      return {
        success: false,
        message: `Failed to communicate with printing agent: ${error.message}`
      };
    }
  }

  /**
   * Test connection to printing agent
   */
  async testAgent(agentUrl?: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = agentUrl || this.defaultSettings.agentUrl || 'http://localhost:8080';
      
      const response = await fetch(`${url}/status`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Connected to printing agent: ${result.storeName || 'Unknown Store'}`
      };
    } catch (error) {
      this.logger.error('Failed to test printing agent:', error);
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        return {
          success: false,
          message: 'Printing agent is not running. Please start the printing agent on the client computer.'
        };
      }
      
      return {
        success: false,
        message: `Failed to connect to printing agent: ${error.message}`
      };
    }
  }

  /**
   * Test print functionality with agent
   */
  async testPrint(settings?: Partial<PrinterSettings>): Promise<{ success: boolean; message: string }> {
    try {
      const agentUrl = settings?.agentUrl || this.defaultSettings.agentUrl || 'http://localhost:8080';
      
      const testData: AgentReceiptData = {
        orderId: 'TEST-001',
        sale_number: 'TEST-001',
        sale_date: new Date().toISOString(),
        customer_name: 'Test Customer',
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
        notes: 'This is a test receipt',
        openCashDrawer: false, // Don't open drawer for test
      };

      const response = await fetch(`${agentUrl}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      if (!response.ok) {
        throw new Error(`Agent responded with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success || false,
        message: result.message || 'Test receipt sent to agent successfully'
      };
    } catch (error) {
      this.logger.error('Failed to test print with agent:', error);
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
        return {
          success: false,
          message: 'Printing agent is not running. Please start the printing agent on the client computer.'
        };
      }
      
      return {
        success: false,
        message: `Failed to test print: ${error.message}`
      };
    }
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
