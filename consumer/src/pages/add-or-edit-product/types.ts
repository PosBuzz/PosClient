import {
  FormAttribute,
  FormSerial,
  TaxMethod,
} from "../../types/product.types";
import { PurchasePayment } from "../../types/purchase-payment.types";

// Shared feature types for add/edit product state, payload fragments, and validation.

// Inventory-batch input used only during create flow.
export interface VariantBatchInput {
  branch_id: number | null;
  batch_number: string;
  quantity: number;
  cost_price: number | string;
  vendor_id?: number;
  location?: string;
  expiry_date?: string;
  payments?: PurchasePayment[];
}

export interface VariantFormState {
  // Editable state for one variant tab.
  id?: number;
  name: string;
  sku: string;
  barcode: string;
  regular_price: number | string | null;
  wholesale_price?: number | string | null;
  sale_unit_id?: number;
  purchase_unit_id?: number;
  warranty_period?: number;
  image?: string | null;
  is_default?: boolean;
  alert_quantity?: number;
  daily_sale_objective?: number;
  attributes: FormAttribute[];
  serials: FormSerial[];
  batches: VariantBatchInput[];
}

export interface ProductFormState {
  // Top-level page state that includes all variants and edit-tracking metadata.
  name: string;
  code: string;
  description: string;
  category_id?: number;
  brand_id?: number;
  tag_ids: number[];
  has_variants: boolean;
  tax_method: TaxMethod;
  tax?: number;
  original_has_variants: boolean;
  variants: Record<string, VariantFormState>;
  deletedVariantIds: number[];
}

export interface ValidationState {
  // Flat field-keyed map used by all UI components for status/help rendering.
  [field: string]: {
    status: "success" | "warning" | "error" | "validating" | "";
    help: string;
  };
}

export interface ProductFormValidationOptions {
  skipBatchValidation?: boolean;
}

export interface ProductPayloadVariant {
  // Variant payload structure expected by create/update product API.
  id?: number;
  name: string;
  sku?: string;
  barcode?: string;
  regular_price: string;
  wholesale_price?: string;
  sale_unit_id?: number;
  purchase_unit_id?: number;
  warranty_period?: number;
  image?: string | null;
  is_default?: boolean;
  alert_quantity: number;
  daily_sale_objective?: number;
  attributes: FormAttribute[];
  serials: FormSerial[];
  batches?: {
    branch_id: number;
    batch_number: string;
    quantity: number;
    cost_price: string;
    vendor_id?: number;
    location?: string;
    expiry_date?: string;
    payments?: PurchasePayment[];
  }[];
}
