export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  rewards_points?: {
    total_points: number;
    lifetime_earned?: number;
    lifetime_redeemed?: number;
  } | null;
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
  sold_unit_price?: number;
  average_discount_amount?: number;
  special_discount_amount?: number;
  promotion_discount_amount?: number;
  applied_promotion_id?: number;
  applied_promotion?: {
    id: number;
    name: string;
    scope: string;
    discount_type: string;
    discount_value: number;
  } | null;
  tax_amount?: number;
  line_total: number;
  product_name: string;
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  unit_name: string;
  tax_percentage?: number;
  tax_method?: string; // "inclusive" or "exclusive"
  returned_quantity?: number; // Qty of this line returned across all returns
}

export interface SaleReturnRecord {
  id: number;
  return_number: string;
  return_date: string;
  total_refund: number | string;
  total_exchange: number | string;
  reason?: string | null;
}

export type SaleReturnStatus = "none" | "partially_returned" | "fully_returned";

export interface SaleReturnSummary {
  has_returns: boolean;
  return_count: number;
  total_refund: number;
  total_exchange: number;
  net_amount: number; // total_amount - refunds; the sale row itself is untouched
  status: SaleReturnStatus;
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
  delivery_partner?: string | null;
  online_order_status?: OnlineOrderStatus | string;
  is_delivery_later?: boolean;
  delivery_status?: "PENDING" | "DELIVERED" | "CANCELLED";
  delivered_at?: string;
  items: SaleItem[];
  payments?: SalePayment[]; // New: support for partial payments
  returns?: SaleReturnRecord[];
  return_summary?: SaleReturnSummary;
  deleted_at?: string | null;
  delete_reason?: string | null;
  deleted_by?: { id: number; name: string } | null;
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
  is_delivery_later?: boolean;
}

export interface DailyTargetRow {
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  sku?: string;
  daily_target: number;
  // Units sold, units handed back, and what is left of them
  gross_sold: number;
  returned: number;
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
    total_gross_sold: number;
    total_returned: number;
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
  status?: "active" | "deleted"; // 'deleted' lists soft-deleted sales
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
    total_received?: number;
    total_due?: number;
    average_sale: number;
    // Refunds booked against the sales in scope; the sale rows stay gross
    total_refund: number;
    return_count: number;
    net_amount: number;
  };
}

export interface ProductVariantForSale {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  brand_id?: number;
  category_id?: number;
  category_name?: string;
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  product_name: string;
  product_code?: string;
  unit_name: string;
  tax_percentage: number;
  tax_method: string; // "inclusive" or "exclusive"
  /** Distinct storage locations of this variant's batches in the branch */
  locations?: string[];
}

export interface InventoryBatch {
  id: number;
  batch_number: string;
  quantity: number;
  cost_price: number;
  expiry_date?: string;
  location?: string | null;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
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

export type PaymentType =
  | "BANGLADESH_BANK"
  | "SONALI_BANK_LIMITED"
  | "JANATA_BANK_LIMITED"
  | "AGRANI_BANK_LIMITED"
  | "RUPALI_BANK_LIMITED"
  | "BANGLADESH_KRISHI_BANK"
  | "RAJSHAHI_KRISHI_UNNAYAN_BANK"
  | "BANGLADESH_DEVELOPMENT_BANK_LIMITED"
  | "BASIC_BANK_LIMITED"
  | "ANSAR_VDP_UNNAYAN_BANK"
  | "KARMASANGSTHAN_BANK"
  | "AB_BANK_LIMITED"
  | "AL_ARAFAH_ISLAMI_BANK_LIMITED"
  | "BANGLADESH_COMMERCE_BANK_LIMITED"
  | "BANK_ASIA_LIMITED"
  | "BRAC_BANK_LIMITED"
  | "DHAKA_BANK_LIMITED"
  | "DUTCH_BANGLA_BANK_LIMITED"
  | "EASTERN_BANK_LIMITED"
  | "EXIM_BANK_LIMITED"
  | "FIRST_SECURITY_ISLAMI_BANK_LIMITED"
  | "ICB_ISLAMIC_BANK_LIMITED"
  | "IFIC_BANK_LIMITED"
  | "ISLAMI_BANK_BANGLADESH_LIMITED"
  | "JAMUNA_BANK_LIMITED"
  | "MEGHNA_BANK_LIMITED"
  | "MERCANTILE_BANK_LIMITED"
  | "MIDLAND_BANK_LIMITED"
  | "MUTUAL_TRUST_BANK_LIMITED"
  | "NATIONAL_BANK_LIMITED"
  | "NRB_BANK_LIMITED"
  | "NATIONAL_CREDIT_AND_COMMERCE_BANK_LIMITED"
  | "NRB_COMMERCIAL_BANK_LIMITED"
  | "ONE_BANK_LIMITED"
  | "PREMIER_BANK_LIMITED"
  | "PUBALI_BANK_LIMITED"
  | "SHAHJALAL_ISLAMI_BANK_LIMITED"
  | "SOCIAL_ISLAMI_BANK_LIMITED"
  | "SOUTH_BANGLA_AGRICULTURE_AND_COMMERCE_BANK_LIMITED"
  | "SOUTHEAST_BANK_LIMITED"
  | "STANDARD_BANK_LIMITED"
  | "THE_CITY_BANK_LIMITED"
  | "THE_FARMERS_BANK_LIMITED"
  | "TRUST_BANK_LIMITED"
  | "UNION_BANK_LIMITED"
  | "UNITED_COMMERCIAL_BANK_LIMITED"
  | "UTTARA_BANK_LIMITED"
  | "BANK_AL_FALAH_LIMITED"
  | "CITIBANK_N_A"
  | "COMMERCIAL_BANK_OF_CEYLON_LIMITED"
  | "HABIB_BANK_LIMITED"
  | "NATIONAL_BANK_OF_PAKISTAN"
  | "STANDARD_CHARTERED_BANK"
  | "STATE_BANK_OF_INDIA"
  | "THE_HONGKONG_AND_SHANGHAI_BANKING_CORPORATION_LTD"
  | "WOORI_BANK"
  | "ROCKET"
  | "BKASH"
  | "MYCASH"
  | "ISLAMI_BANK_MCASH"
  | "TRUST_AXIATA_PAY_TAP"
  | "FIRSTCASH"
  | "UPAY"
  | "OK_WALLET"
  | "RUPALI_BANK"
  | "TELECASH"
  | "ISLAMIC_WALLET"
  | "MEGHNA_PAY"
  | "NAGAD";

export interface SalePayment {
  id?: number;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
  payment_type?: PaymentType;
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
  quantity_returned: number;
  refund_amount: number;
  net_amount: number;
}

export interface EODSummary {
  total_sales: number;
  total_amount: number;
  gross_subtotal?: number;
  total_discount?: number;
  total_tax?: number;
  total_shipping?: number;
  total_transactions: number;
  total_collected?: number;
  real_money_collected?: number;
  period_sales_collected?: number;
  due_collected?: number;
  total_due?: number;
  due_sales_count?: number;
  cash_sales: number;
  digital_sales?: number;
  reward_point_sales?: number;
  exchange_sales?: number;
  total_exchange_return?: number;
  unique_exchanges?: number;
  non_cash_sales: number;
  average_transaction_value: number;
  total_items_sold: number;
  unique_products_sold: number;
  operational_costs: number;
  // Returns booked in the period; sales above stay gross
  total_returns: number;
  total_refund: number;
  total_items_returned: number;
  net_sale_amount: number;
  cash_refunds: number;
  digital_refunds?: number;
  net_cash_sales: number;
  net_money_collected?: number;
  net_operating_result: number;
  net_operating_cash_flow?: number;
}

export interface EODReportResponse {
  date: string;
  period: "day" | "month" | "all";
  period_start: string;
  period_end: string;
  branch_name?: string;
  summary: EODSummary;
  payment_method_breakdown: PaymentMethodBreakdown[];
  return_payment_breakdown: PaymentMethodBreakdown[];
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
  operational_costs: {
    id: number;
    name: string;
    amount: number;
    incurred_on: string;
    branch_name?: string;
  }[];
}

export interface DashboardAnalyticsSummary {
  // Gross totals: sale rows are never rewritten when a return happens
  weekly_total_sale: number;
  weekly_collected?: number;
  weekly_due?: number;
  weekly_transactions: number;
  weekly_returns_total: number;
  weekly_returns_count: number;
  weekly_net_sale: number;
  today_total_sale: number;
  today_collected?: number;
  today_due?: number;
  today_transactions: number;
  today_returns_total: number;
  today_returns_count: number;
  today_net_sale: number;
}

export interface DashboardSalesTrendPoint {
  date: string;
  sales_count: number;
  total_amount: number;
  returns_count: number;
  returns_amount: number;
  net_amount: number;
}

export interface DashboardPaymentBreakdownPoint {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface DashboardReturnPaymentBreakdownPoint {
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
  return_payment_breakdown: DashboardReturnPaymentBreakdownPoint[];
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
