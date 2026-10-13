export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  /** Date of birth, ISO date string */
  birthday?: string | null;
  customer_type: CustomerType;
  consumer_id: number;
  created_at: string;
  updated_at: string;
}

export enum CustomerType {
  REGULAR = "regular",
  INDIVIDUAL = "individual",
  BUSINESS = "business",
}

export interface CustomerListFilters {
  page?: number;
  limit?: number;
  search?: string;
  customer_type?: CustomerType;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface CustomerHistoryMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CustomerSaleHistory {
  id: number;
  sale_number: string;
  sale_date: string;
  total_amount: number;
  received_amount: number;
  outstanding_amount?: number;
  payment_status: string;
  branch: { name: string };
}

export interface CustomerReturnHistory {
  id: number;
  return_number: string;
  return_date: string;
  total_refund: number;
  total_exchange: number;
  reason?: string | null;
  branch: { name: string };
  original_sale: { id: number; sale_number: string };
}

export interface CustomerRewardHistory {
  id: number;
  type: string;
  points: number;
  balance_after: number;
  description?: string | null;
  created_at: string;
  sale?: { id: number; sale_number: string } | null;
}

export interface CustomerSummary {
  customer: Pick<
    Customer,
    | "id"
    | "name"
    | "email"
    | "phone"
    | "address"
    | "birthday"
    | "customer_type"
    | "created_at"
  >;
  sales: {
    count: number;
    gross_amount: number;
    paid_amount: number;
    outstanding_amount: number;
    last_sale_at?: string | null;
  };
  returns: {
    count: number;
    refunded_amount: number;
    exchanged_amount: number;
    last_return_at?: string | null;
  };
  rewards: {
    total_points: number;
    lifetime_earned: number;
    lifetime_redeemed: number;
    last_earned_at?: string | null;
    last_redeemed_at?: string | null;
  };
  recent_sales: CustomerSaleHistory[];
}

export interface CustomerHistoryResponse<T> {
  data: T[];
  meta: CustomerHistoryMeta;
}
