import {
  PaymentStatus,
  Sale,
  SalePayment,
  SaleResponsePayment,
} from "./sale.types";

// Type for a sale with partial payment information
export interface SaleForPayment {
  id: number;
  sale_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  branch_name?: string;
  sale_date: string;
  total_amount: number | string;
  payment_status: PaymentStatus;
  received_amount: number | string;
  remaining_amount: number;
  payments?: SaleResponsePayment[];
  created_at?: string;
}

// Form data for making a payment - supports multiple payment methods
export interface MakePaymentForm {
  sale_id: number;
  payments: SalePayment[];
}

// Response after making a payment
export interface PaymentResponse {
  payment: SaleResponsePayment;
  sale: Sale;
}

// Filters for partially paid sales list
export interface PartialPaymentFilters {
  page?: number;
  limit?: number;
  search?: string;
  branch_id?: number;
  date_from?: string;
  date_to?: string;
  payment_status?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

// Response for partial payment sales list
export interface PartialPaymentListResponse {
  data: SaleForPayment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
