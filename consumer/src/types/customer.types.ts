export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Date of birth, ISO date string */
  birthday?: string | null;
  customer_type: CustomerType;
  consumer_id: number;
  created_at: string;
  updated_at: string;
}

export enum CustomerType {
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
