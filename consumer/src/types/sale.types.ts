export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
}

export interface SaleItem {
  id?: number;
  variant_id: number;
  variant_name: string;
  variant_sku?: string;
  quantity: number;
  batch_id?: number;
  batch_number?: string;
  unit_price: number;
  average_discount_amount?: number;
  special_discount_amount?: number;
  promotion_discount_amount?: number;
  applied_promotion_id?: number;
  tax_amount?: number;
  line_total: number;
  product_name: string;
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  unit_name: string;
  tax_percentage?: number;
  tax_method?: string; // "inclusive" or "exclusive"
}

export interface Sale {
  id?: number;
  sale_number: string;
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  promotion_id?: number;
  promotion?: {
    id: number;
    name: string;
    scope: string;
    discount_type: string;
    discount_value: number;
  };
  branch_id: number;
  branch_name?: string;
  branch?: Branch; // Include branch object from Prisma relation
  user_id?: number;
  user_name?: string;
  user?: {
    // Include user object from Prisma relation
    id: number;
    name: string;
  };
  served_by_id?: number;
  served_by_name?: string;
  served_by?: {
    // Include served_by user object from Prisma relation
    id: number;
    name: string;
  };
  customer?: Customer;
  sale_date: string;
  sale_type: SaleType;
  price_type: PriceType;
  subtotal: number;
  discount_type?: DiscountType;
  discount_amount: number; // Total discount amount for the sale
  promotion_discount: number; // Promotion discount (tracked separately for stats)
  shipping_cost: number;
  tax_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  received_amount: number;
  change_amount: number;
  notes?: string;
  converted_to_sale_id?: number; // For quotations: which sale it was converted to
  converted_at?: string; // For quotations: timestamp when converted to sale
  converted_from_quotations?: Array<{
    // For sales: original quotations if converted
    id: number;
    sale_number: string;
    created_at: string;
  }>;
  is_online_order?: boolean;
  online_order_status?: OnlineOrderStatus | string;
  items: SaleItem[];
  payments?: SalePayment[]; // New: support for partial payments
  created_at?: string;
  updated_at?: string;
}

export interface SaleFormData {
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  applied_promotion_id?: number;
  branch_id: number;
  served_by_id?: number;
  quotation_id?: number; // For converting quotation to sale
  sale_type: SaleType;
  price_type: PriceType;
  discount_type?: DiscountType;
  discount_amount: number;
  shipping_cost: number;
  payment_status: PaymentStatus;
  received_amount: number;
  notes?: string;
  items: SaleItem[];
  payments?: SalePayment[]; // New: support for partial payments
  is_online_order?: boolean;
  online_order_status?: OnlineOrderStatus | string;
}

export interface DailyTargetRow {
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  sku?: string;
  daily_target: number;
  actual_sold: number;
  achievement_pct: number;
  gap: number;
  targeted_amount?: number;
  actual_amount?: number;
}

export interface DailyTargetReportResponse {
  date: string;
  branch_id?: number;
  branch_name?: string;
  rows: DailyTargetRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  summary: {
    total_target: number;
    total_sold: number;
    overall_achievement_pct: number;
    targeted_amount?: number; // NEW
    total_amount?: number; // NEW
    average_amount?: number;
  };
}
export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  CHEQUE = "CHEQUE",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_MONEY = "MOBILE_MONEY",
  MFS = "MFS", // Mobile Financial Service
  DEPOSIT = "DEPOSIT",
  CREDIT = "CREDIT",
  EXCHANGE = "EXCHANGE",
}

export enum PaymentStatus {
  PAID = "paid",
  PARTIAL = "partial",
  DUE = "due",
  CANCELLED = "cancelled",
}

export enum SaleType {
  SALE = "sale",
  QUOTATION = "quotation",
}

export enum PriceType {
  REGULAR = "regular",
  WHOLESALE = "wholesale",
}

export enum DiscountType {
  FLAT = "flat",
  PERCENTAGE = "percentage",
}

export enum TaxMethod {
  INCLUSIVE = "INCLUSIVE",
  EXCLUSIVE = "EXCLUSIVE",
}

export enum OnlineOrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  READY = "READY",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURNED = "RETURNED",
}

export interface SaleListFilters {
  page?: number;
  limit?: number;
  search?: string;
  branch_id?: number;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  source?: "pending" | "converted" | "quotation" | "direct"; // Unified filter: pending/converted for quotations, quotation/direct for sales
}

export interface SaleListResponse {
  data: Sale[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  summary?: {
    total_sales: number;
    total_amount: number;
    average_sale: number;
  };
}

export interface ProductVariantForSale {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  brand_id?: number;
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  product_name: string;
  unit_name: string;
  tax_percentage: number;
  tax_method: string; // "inclusive" or "exclusive"
}

export interface InventoryBatch {
  id: number;
  batch_number: string;
  quantity: number;
  cost_price: number;
  expiry_date?: string;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  is_main: boolean;
  is_warehouse: boolean;
}

export interface SalesStats {
  today_sales: number;
  today_amount: number;
  week_sales: number;
  week_amount: number;
  month_sales: number;
  month_amount: number;
  top_products: Array<{
    variant_id: number;
    variant_name: string;
    product_name: string;
    total_quantity: number;
    total_amount: number;
  }>;
}

export interface SalePayment {
  id?: number;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface ProductSalesStats {
  variant_id: number;
  variant_name: string;
  product_name: string;
  sku?: string;
  quantity_sold: number;
  total_amount: number;
  average_unit_price: number;
}

export interface EODSummary {
  total_sales: number;
  total_amount: number;
  total_transactions: number;
  cash_sales: number;
  non_cash_sales: number;
  average_transaction_value: number;
  total_items_sold: number;
  unique_products_sold: number;
}

export interface EODReportResponse {
  date: string;
  branch_name?: string;
  summary: EODSummary;
  payment_method_breakdown: PaymentMethodBreakdown[];
  product_sales: ProductSalesStats[];
  hourly_sales: {
    hour: number;
    sales_count: number;
    total_amount: number;
  }[];
  payment_status_breakdown: {
    status: string;
    count: number;
    total_amount: number;
  }[];
}

export interface DashboardAnalyticsSummary {
  weekly_total_sale: number;
  weekly_transactions: number;
  today_total_sale: number;
  today_transactions: number;
}

export interface DashboardSalesTrendPoint {
  date: string;
  sales_count: number;
  total_amount: number;
}

export interface DashboardPaymentBreakdownPoint {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface DashboardTopProductPoint {
  variant_id: number;
  variant_name: string;
  product_name: string;
  sku?: string;
  total_quantity: number;
  total_amount: number;
}

export interface DashboardLowStockPoint {
  variant_id: number;
  product_name: string;
  variant_name: string;
  sku?: string;
  alert_quantity: number;
  total_stock: number;
  shortage: number;
  affected_branch_name?: string;
}

export interface DashboardAnalyticsResponse {
  summary: DashboardAnalyticsSummary;
  weekly_sales_trend: DashboardSalesTrendPoint[];
  payment_method_breakdown: DashboardPaymentBreakdownPoint[];
  top_products: DashboardTopProductPoint[];
  low_stock: {
    total_critical_items: number;
    items: DashboardLowStockPoint[];
  };
  expiring_items: {
    total_expiring_items: number;
    items: Array<{
      batch_id: number;
      product_name: string;
      variant_name: string;
      batch_number: string;
      quantity: number;
      expiry_date: string;
      branch_name?: string;
    }>;
  };
}
