export enum TaxMethod {
  EXCLUSIVE = "exclusive",
  INCLUSIVE = "inclusive",
}

export interface VariantAttribute {
  id?: number;
  name: string;
  value: string;
}

export interface ProductSerial {
  id?: number;
  serial_number: string;
  status?: 'available' | 'sold' | 'defective' | 'returned';
  notes?: string;
}

export interface ProductVariant {
  id?: number;
  name: string;
  sku?: string;
  barcode?: string;
  cost_price: number | null | string;
  regular_price: number | null | string;
  wholesale_price?: number | null | string;
  sale_unit_id: number | null | string;
  purchase_unit_id: number | null | string;
  warranty_period?: number | null | string;
  image?: string;
  is_default?: boolean;
  alert_quantity?: number; // Low stock alert threshold
  attributes?: VariantAttribute[];
  serials?: ProductSerial[];
}

export interface ProductFormData {
  name: string;
  code?: string;
  description?: string;
  category_id?: number;
  brand_id?: number;
  tag_ids: number[];
  has_variants: boolean;
  tax_method: TaxMethod;
  tax: number;
  daily_sale_objective?: number; // Daily sales target for this product
  variants: ProductVariant[];
}

// Legacy interface for backward compatibility
export interface ProductFormValues {
  id?: number;
  name: string;
  code: string | undefined;
  category_id: number | undefined;
  brand_id: number | undefined;
  description?: string;
  has_variants: boolean;
  tax?: number;
  tax_method?: TaxMethod;
  daily_sale_objective?: number;
  variants?: ProductVariant[];
  serials?: string[];
  tags?: string[];
}

export interface Product extends ProductFormValues {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: number;
  name: string;
  contact?: string;
  email?: string;
  address?: string;
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
export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: number;
  brand_id?: number;
}

export interface ProductListResponse {
  data: Product[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
