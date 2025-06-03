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
  daily_sale_objective: number;
  variants: ProductVariant[];
}

// Form structure type that matches the dynamic form structure
export interface ProductFormStructure {
  name: string;
  code?: string;
  description?: string;
  category_id?: number;
  brand_id?: number;
  tag_ids: number[];
  has_variants: boolean;
  tax_method: TaxMethod;
  tax: number;
  daily_sale_objective: number;
  variants: { [key: string]: FormVariant };
}

export interface FormVariant {
  id?: number;
  name?: string;
  sku?: string;
  barcode?: string;
  regular_price?: number | string | null;
  wholesale_price?: number | string | null;
  sale_unit_id?: number;
  purchase_unit_id?: number;
  warranty_period?: number;
  image?: string | null;
  is_default?: boolean;
  alert_quantity?: number;
  attributes?: FormAttribute[];
  serials?: FormSerial[];
  batches?: any[];
}

export interface FormAttribute {
  id?: number;
  name: string;
  value: string;
}

export interface FormSerial {
  id?: number;
  serial_number: string;
  status?: "available" | "sold" | "defective" | "returned";
  notes?: string;
}

export interface ProductVariant {
  id?: number;
  name: string;
  sku?: string;
  barcode?: string;
  regular_price: number | string | null;
  wholesale_price?: number | string | null;
  sale_unit_id?: number;
  purchase_unit_id?: number;
  warranty_period?: number;
  image?: string | null;
  is_default?: boolean;
  alert_quantity: number;
  attributes: ProductAttribute[];
  serials?: ProductSerial[];
  batches?: any[]; // Will be typed properly when importing BatchData from BatchAddingForm
}

export interface ProductAttribute {
  id?: number;
  name: string;
  value: string;
}

export interface ProductSerial {
  id?: number;
  serial_number: string;
  status?: "available" | "sold" | "defective" | "returned";
  notes?: string;
}

export enum TaxMethod {
  INCLUSIVE = "inclusive",
  EXCLUSIVE = "exclusive",
}

export interface ProductListFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryIds?: number[];
  brandIds?: number[];
  tagIds?: number[];
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

export interface Product {
  id: number;
  name: string;
  code?: string;
  description?: string;
  category_id?: number;
  brand_id?: number;
  has_variants: boolean;
  tax_method: string;
  tax: number;
  daily_sale_objective: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Relations
  category?: {
    id: number;
    name: string;
  };
  brand?: {
    id: number;
    name: string;
    logo?: string;
  };
  consumer?: {
    id: number;
    company_name: string;
    subdomain: string;
  };
  tags?: {
    tag: {
      id: number;
      name: string;
    };
  }[];
  variants?: ProductVariantDetailed[];

  // Calculated metrics (only in detailed view)
  metrics?: {
    total_variants: number;
    total_stock_all_variants: number;
    total_serials_all_variants: number;
    available_serials_all_variants: number;
    variants_with_low_stock: number;
    variants_with_expiring_inventory: number;
    has_active_promotions: boolean;
    price_range: {
      min_regular_price: number;
      max_regular_price: number;
    };
  };
}

export interface ProductVariantDetailed
  extends Omit<ProductVariant, "serials"> {
  // Unit information
  sale_unit?: {
    id: number;
    name: string;
  };
  purchase_unit?: {
    id: number;
    name: string;
  };

  // Inventory information
  inventory_items?: {
    quantity: number;
    branch?: {
      id: number;
      name: string;
      is_main: boolean;
      address?: string;
    };
    vendor?: {
      id: number;
      name: string;
      contact?: string;
      phone?: string;
      email?: string;
    };
    created_at: string;
    expiry_date?: string;
    batch_number?: string;
  }[];

  // Serial numbers with full details
  serials: {
    id: number;
    serial_number: string;
    status: string;
    sold_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    batch?: {
      id: number;
      batch_number: string;
      expiry_date?: string;
    };
  }[];

  // Price history
  price_history?: {
    id: number;
    regular_price: string;
    wholesale_price?: string;
    effective_date: string;
    created_by_user?: {
      id: number;
      name: string;
      email: string;
    };
  }[];

  // Active promotions
  promotions?: {
    promotion: {
      id: number;
      name: string;
      description?: string;
      discount_type: string;
      discount_value: number;
      start_date: string;
      end_date?: string;
      min_purchase?: number;
      branch_specific: boolean;
      branches?: {
        branch: {
          id: number;
          name: string;
        };
      }[];
    };
  }[];

  // Calculated metrics
  total_stock?: number;
  stock_by_branch?: Record<string, number>;
  is_low_stock?: boolean;
  serials_summary?: Record<string, number>;
  available_serials_count?: number;
  sold_serials_count?: number;
  defective_serials_count?: number;
  returned_serials_count?: number;
  price_change_percentage?: number;
  has_expiring_inventory?: boolean;
  expiring_inventory_count?: number;
  expiring_inventory?: {
    batch_number?: string;
    quantity: number;
    expiry_date: string;
    branch_name: string;
  }[];
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

export interface VariantAttribute {
  id?: number;
  name: string;
  value: string;
}
