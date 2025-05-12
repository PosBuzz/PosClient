import { ProductType, TaxMethod } from "../enums/product.enums";

// Enum definitions to match the Prisma schema
export enum ProductType {
  STANDARD = "STANDARD",
  DIGITAL = "DIGITAL",
  SERVICE = "SERVICE"
}

export enum TaxMethod {
  EXCLUSIVE = "EXCLUSIVE",
  INCLUSIVE = "INCLUSIVE"
}

export interface ProductFormValues {
  id?: number;
  name: string;
  code: string;
  type: ProductType;
  category_id: number;
  brand_id: number;
  product_unit_id: number;
  sale_unit_id?: number;
  purchase_unit_id?: number;
  cost: number;
  price: number;
  wholesale_price?: number;
  image_url?: string;
  description?: string;
  featured: boolean;
  in_stock: boolean;
  sell_online: boolean;
  daily_sale_objective?: number;
  alert_quantity?: number;
  product_tax?: string;
  tax_method?: TaxMethod;
  variants?: ProductVariant[];
  branch_prices?: BranchPrice[];
  serials?: string[];
  promotional_price?: PromotionalPrice;
  tags?: string[];
}

export interface Product extends ProductFormValues {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id?: number;
  product_id?: number;
  option: string;
  value: string;
  item_code?: string;
  cost?: number;
  price?: number;
}

export interface BranchPrice {
  id?: number;
  product_id?: number;
  branch_id: number;
  price: number;
}

export interface ProductSerial {
  id?: number;
  product_id?: number;
  serial: string;
}

export interface PromotionalPrice {
  id?: number;
  product_id?: number;
  price: number;
  starts_at: Date;
  ends_at?: Date;
}

export interface ProductTag {
  id?: number;
  product_id?: number;
  tag: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  name: string;
}

export interface Branch {
  id: number;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
}

// Request/Response types for better type safety
export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: number;
  brand_id?: number;
  type?: ProductType;
  in_stock?: boolean;
  featured?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}