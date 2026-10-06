import { PaymentMethod, PaymentType } from "./sale.types";

export interface ReturnItem {
  id?: number;
  sale_item_id: number;
  variant_id: number;
  variant_name?: string;
  product_name?: string;
  batch_id?: number;
  batch_number?: string;
  quantity: number;
  refund_amount: number;
  unit_price?: number;
  line_total?: number;
  unit_name?: string;
  image?: string;
  // Nested relations from backend
  variant?: {
    id: number;
    name?: string;
    product?: {
      id: number;
      name: string;
    };
  };
  batch?: {
    id: number;
    batch_number?: string;
  };
}

export interface ReturnPayment {
  id?: number;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReturnExchange {
  id?: number;
  variant_id: number;
  variant_name?: string;
  product_name?: string;
  batch_id?: number;
  batch_number?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  unit_name?: string;
  image?: string;
  // Nested relations from backend
  variant?: {
    id: number;
    name?: string;
    product?: {
      id: number;
      name: string;
    };
  };
  batch?: {
    id: number;
    batch_number?: string;
  };
}

export interface Return {
  id: number;
  return_number: string;
  original_sale_id: number;
  exchange_sale_id?: number;
  consumer_id?: number;
  branch_id: number;
  branch_name?: string;
  branch?: {
    id: number;
    name: string;
  };
  user_id?: number;
  user_name?: string;
  user?: {
    id: number;
    name: string;
  };
  return_date: string;
  total_refund: number;
  total_exchange: number;
  reason?: string;
  notes?: string;
  original_sale?: {
    id: number;
    sale_number: string;
    customer_name?: string;
    total_amount: number;
    items: Array<{
      id: number;
      variant_id: number;
      variant_name: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      batch_id?: number;
      batch_number?: string;
      unit_name?: string;
      image?: string;
    }>;
  };
  exchange_sale?: {
    id: number;
    sale_number: string;
  };
  items: ReturnItem[];
  payments: ReturnPayment[];
  exchanges: ReturnExchange[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateReturnItemForm {
  sale_item_id: number;
  variant_id: number;
  batch_id?: number;
  quantity: number;
  max_quantity?: number;
  variant_name?: string;
  product_name?: string;
  unit_price?: number;
  unit_name?: string;
  image?: string;
}

export interface CreateReturnPaymentForm {
  payment_type?: PaymentType;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface CreateReturnExchangeForm {
  variant_id: number;
  batch_id?: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant_name?: string;
  product_name?: string;
  unit_name?: string;
  image?: string;
}

export interface CreateReturnForm {
  original_sale_id: number;
  branch_id: number;
  exchange_sale_id?: number;
  reason?: string;
  notes?: string;
  shipping_refund_amount?: number;
  items: CreateReturnItemForm[];
  payments?: CreateReturnPaymentForm[];
  exchanges?: CreateReturnExchangeForm[];
}

export interface ReturnListFilters {
  page?: number;
  limit?: number;
  branch_id?: number;
  original_sale_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface ReturnListResponse {
  data: Return[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SaleForReturn {
  id: number;
  sale_number: string;
  customer_name?: string;
  customer_phone?: string;
  sale_date: string;
  total_amount: number;
  branch_id: number;
  branch_name?: string;
  subtotal?: number;
  discount_amount?: number;
  shipping_cost?: number;
  payments?: Array<{
    payment_method: string;
    amount: number;
  }>;
  return_summary?: {
    total_returned: number;
    total_refunded: number;
    total_exchanged: number;
    total_already_returned: number;
    available_amount: number;
    shipping_refunded?: number;
    available_shipping_refund?: number;
    returns: Array<{
      id: number;
      return_number: string;
      return_date: string;
      total_refund: number;
      total_exchange: number;
      reason?: string;
    }>;
  };
  items: Array<{
    id: number;
    variant_id: number;
    variant_name: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    batch_id?: number;
    batch_number?: string;
    unit_name?: string;
    image?: string;
    available_for_return: number; // Calculated field: original quantity - already returned
  }>;
}
