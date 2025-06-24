export interface SaleItem {
  id?: number;
  variant_id: number;
  variant_name: string;
  variant_sku?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  line_total: number;
  product_name: string;
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  available_stock: number;
}

export interface Sale {
  id?: number;
  sale_number: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  branch_id: number;
  branch_name?: string;
  user_id?: number;
  user_name?: string;
  sale_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes?: string;
  items: SaleItem[];
  created_at?: string;
  updated_at?: string;
}

export interface SaleFormData {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  branch_id: number;
  discount_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  notes?: string;
  items: SaleItem[];
}

export enum PaymentMethod {
  CASH = "cash",
  CARD = "card",
  BANK_TRANSFER = "bank_transfer",
  MOBILE_MONEY = "mobile_money",
  CREDIT = "credit",
}

export enum PaymentStatus {
  PAID = "paid",
  PENDING = "pending",
  PARTIAL = "partial",
  CANCELLED = "cancelled",
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
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  product_name: string;
  available_stock: number;
  unit_name: string;
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
