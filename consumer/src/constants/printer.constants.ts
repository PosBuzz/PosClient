export const PRINTER_CONFIG = {
  // Default agent settings
  DEFAULT_AGENT_URL: 'http://localhost:8080',
  
  // Agent endpoints
  AGENT_ENDPOINTS: {
    PRINT: '/print',
    STATUS: '/status',
    CONFIG: '/config',
  },
  
  // Timeout settings
  AGENT_TIMEOUT: 5000, // 5 seconds
  
  // Default receipt settings
  DEFAULT_RECEIPT_SETTINGS: {
    defaultCustomerName: 'Walk-in Customer',
    thankYouMessage: 'Thank you for your business!',
  },
} as const;

export interface AgentReceiptData {
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
