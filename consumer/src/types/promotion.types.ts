export type PromotionScope = 'SINGLE_PRODUCT' | 'BUNDLE' | 'BRAND';
export type PromotionDiscountType = 'percentage' | 'fixed_amount';

export interface PromotionOptionBranch {
  id: number;
  name: string;
}

export interface PromotionOptionBrand {
  id: number;
  name: string;
}

export interface PromotionOptionVariant {
  id: number;
  name: string;
  sku?: string;
  regular_price: number;
  product_id: number;
  product_name: string;
  brand_id?: number;
}

export interface PromotionOptionsResponse {
  branches: PromotionOptionBranch[];
  brands: PromotionOptionBrand[];
  variants: PromotionOptionVariant[];
}

export interface Promotion {
  id: number;
  name: string;
  description?: string;
  scope: PromotionScope;
  discount_type: PromotionDiscountType;
  discount_value: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  min_purchase?: number;
  min_quantity?: number;
  usage_limit?: number;
  cap_quantity?: number;
  max_discount_amount?: number;
  cap_discount_amount?: number;
  member_only?: boolean;
  limit_per_customer?: boolean;
  customer_usage_limit?: number;
  customer_usage_daily_reset?: boolean;
  auto_apply: boolean;
  branch_specific: boolean;
  branch_ids: number[];
  variant_ids: number[];
  brand_id?: number;
  brand?: { id: number; name: string };
  products?: Array<{
    variant_id: number;
    variant_name: string;
    product_id: number;
    product_name: string;
  }>;
  branches?: Array<{ id: number; name: string }>;
  sales_count: number;
  total_discount_given: number;
  total_discounted_sales: number;
}

export interface PromotionValidationResponse {
  promotion_id: number;
  is_eligible: boolean;
  discount_amount?: number;
  discount_base?: number;
  matched_variant_ids?: number[];
  reason?: string;
}

export interface PromotionPayload {
  name: string;
  description?: string;
  scope: PromotionScope;
  discount_type: PromotionDiscountType;
  discount_value: number;
  start_date: string;
  end_date?: string;
  is_active?: boolean;
  min_purchase?: number;
  min_quantity?: number;
  usage_limit?: number;
  cap_quantity?: number;
  max_discount_amount?: number;
  cap_discount_amount?: number;
  member_only?: boolean;
  limit_per_customer?: boolean;
  customer_usage_limit?: number;
  customer_usage_daily_reset?: boolean;
  auto_apply?: boolean;
  branch_specific?: boolean;
  branch_ids?: number[];
  brand_id?: number;
  variant_ids?: number[];
}
