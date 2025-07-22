export interface SaleItem {
  id?: number;
  variant_id: number;
  variant_name: string;
  variant_sku?: string;
  quantity: number;
  batch_id?: number;
  batch_number?: string;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  line_total: number;
  product_name: string;
  regular_price: number;
  wholesale_price?: number;
  image?: string;
  available_stock: number;
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
  branch_id: number;
  branch_name?: string;
  branch?: Branch; // Include branch object from Prisma relation
  user_id?: number;
  user_name?: string;
  user?: { // Include user object from Prisma relation
    id: number;
    name: string;
  };
  customer?: { // Include customer object from Prisma relation
    id: number;
    name: string;
    phone?: string;
    email?: string;
  };
  sale_date: string;
  sale_type: SaleType;
  price_type: PriceType;
  subtotal: number;
  discount_type: DiscountType;
  discount_amount: number;
  shipping_cost: number;
  tax_amount: number;
  total_amount: number;
  payment_method?: PaymentMethod; // Deprecated: for backward compatibility
  payment_status: PaymentStatus;
  received_amount: number;
  change_amount: number;
  notes?: string;
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
  branch_id: number;
  sale_type: SaleType;
  price_type: PriceType;
  discount_type: DiscountType;
  discount_amount: number;
  shipping_cost: number;
  payment_method?: PaymentMethod; // Deprecated: for backward compatibility
  payment_status: PaymentStatus;
  received_amount: number;
  notes?: string;
  items: SaleItem[];
  payments?: SalePayment[]; // New: support for partial payments
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
  tax_percentage: number;
  tax_method: string; // "inclusive" or "exclusive"
  batches: InventoryBatch[];
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
