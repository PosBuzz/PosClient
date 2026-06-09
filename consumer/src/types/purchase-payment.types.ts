import { PaymentMethod, PaymentType } from "./sale.types";

export interface PurchasePayment {
  id?: number;
  payment_method: PaymentMethod;
  payment_type?: PaymentType;
  amount: number;
  reference?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryBatchForPayment {
  id: number;
  batch_number: string;
  variant_id: number;
  variant: {
    id: number;
    name: string;
    product: { id: number; name: string };
  };
  branch: { id: number; name: string };
  vendor?: { id: number; name: string };
  quantity: number;
  cost_price: string;
  total_cost: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: "paid" | "partial" | "due";
  purchasePayments: PurchasePayment[];
  created_at: string;
}

export interface MakePurchasePaymentForm {
  batch_id: number;
  payments: PurchasePayment[];
}

export interface PurchasePaymentResponse {
  payments: PurchasePayment[];
  batch: {
    id: number;
    batch_number: string;
    total_cost: number;
    paid_amount: number;
    payment_status: string;
    remaining_amount: number;
  };
}

export interface PurchaseBatchesFilters {
  page?: number;
  limit?: number;
  search?: string;
  branch_id?: number;
  vendor_id?: number;
  vendorless?: boolean;
  payment_status?: "all" | "paid" | "partial" | "due" | "unpaid";
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PurchaseBatchesListResponse {
  data: InventoryBatchForPayment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface VendorDetailsResponse {
  vendor: {
    id: number;
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
    created_at: string;
    updated_at: string;
  };
  batches: Array<{
    id: number;
    batch_number: string;
    quantity: number;
    cost_price: string;
    total_cost: number;
    paid_amount: number;
    remaining_amount: number;
    payment_status: string;
    created_at: string;
    variant: {
      id: number;
      name: string;
      product: { id: number; name: string };
    };
    branch: { id: number; name: string };
    purchasePayments: PurchasePayment[];
  }>;
  allPayments: Array<
    PurchasePayment & {
      batch_id: number;
      batch_number: string;
      product_name: string;
      variant_name: string;
    }
  >;
  summary: {
    totalCost: number;
    totalPaid: number;
    totalOwed: number;
    totalBatches: number;
  };
  meta: {
    page: number;
    limit: number;
    totalPages: number;
  };
}
