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

export interface DeliveryPartnerReportRow {
  partner_id: number;
  partner_name: string;
  orders_delivered: number;
  orders_returned: number;
  orders_on_the_way: number;
  /** Cash the partner collected from customers for delivered orders in the period */
  cod_collected: number;
  /** What the partner charges the shop (delivery, COD fee, return charge) for the period */
  charges: number;
  /** Partner payouts to the shop in the period (all-branches report only) */
  paid_over: number;
  /** Payments from the shop to the partner in the period (all-branches report only) */
  paid_by_shop: number;
  /** Owed by the partner right now; negative: the shop owes the partner. null for a branch report */
  balance: number | null;
}

export interface EODSummary {
  total_sales: number;
  total_amount: number;
  gross_subtotal?: number;
  total_discount?: number;
  total_tax?: number;
  /** Shipping charged to customers; not part of net sales */
  total_shipping?: number;
  online_sales_count?: number;
  online_sales_amount?: number;
  offline_sales_count?: number;
  offline_sales_amount?: number;
  /** What delivery partners charge the shop (delivery, COD fee, return charge) */
  partner_delivery_charges?: number;
  /** Shipping charged minus partner charges; negative when delivery costs more than customers paid */
  shipping_margin?: number;
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
  /** Payouts from delivery partners in the period (all branches only); part of real money collected */
  partner_payouts_received: number;
  /** ... of which paid in cash, so in the drawer */
  partner_payouts_cash: number;
  /** Payments the shop made to delivery partners in the period; out of the money collected */
  partner_payments_made: number;
  partner_payments_cash: number;
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
  delivery_partners?: DeliveryPartnerReportRow[];
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
