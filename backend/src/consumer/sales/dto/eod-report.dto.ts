import { IsOptional, IsDateString, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class EODReportDto {
  @IsOptional()
  @IsDateString()
  date?: string; // If not provided, uses current date

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  branch_id?: number; // If not provided, includes all branches

  @IsOptional()
  @IsIn(['day', 'month', 'all'])
  period?: 'day' | 'month' | 'all';
}

export interface PaymentMethodBreakdown {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface ProductSalesStats {
  variant_id: number;
  variant_name: string;
  product_name: string;
  sku?: string;
  quantity_sold: number;
  total_amount: number;
  average_unit_price: number;
  // Units handed back and what they were worth, for returns booked in the period
  quantity_returned: number;
  refund_amount: number;
  net_amount: number;
}

export interface EODSummary {
  total_sales: number;
  total_amount: number;
  gross_subtotal?: number;
  total_discount?: number;
  total_tax?: number;
  total_shipping?: number;
  total_transactions: number;
  total_collected: number;
  real_money_collected: number;
  period_sales_collected?: number;
  due_collected?: number;
  total_due: number;
  due_sales_count: number;
  cash_sales: number;
  digital_sales: number;
  reward_point_sales: number;
  exchange_sales: number;
  /** Paid by customers to a delivery partner; reaches the shop with the partner's payout */
  delivery_partner_collected: number;
  total_exchange_return: number;
  unique_exchanges: number;
  non_cash_sales: number;
  average_transaction_value: number;
  total_items_sold: number;
  unique_products_sold: number;
  operational_costs: number;
  total_returns: number;
  total_refund: number;
  total_items_returned: number;
  net_sale_amount: number;
  cash_refunds: number;
  digital_refunds: number;
  net_cash_sales: number;
  net_money_collected: number;
  net_operating_result: number;
  net_operating_cash_flow?: number;
}

export interface EODReportResponse {
  date: string;
  period: 'day' | 'month' | 'all';
  period_start: string;
  period_end: string;
  branch_name?: string;
  summary: EODSummary;
  payment_method_breakdown: PaymentMethodBreakdown[];
  return_payment_breakdown: PaymentMethodBreakdown[];
  product_sales: ProductSalesStats[];
  hourly_sales: {
    hour: number;
    sales_count: number;
    total_amount: number;
  }[];
  payment_status_breakdown: {
    status: string;
    count: number;
    total_amount: number;
  }[];
  operational_costs: {
    id: number;
    name: string;
    amount: number;
    incurred_on: string;
    branch_name?: string;
  }[];
}
