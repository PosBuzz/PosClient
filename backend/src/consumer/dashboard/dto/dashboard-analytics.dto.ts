import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export type PeriodType = 'daily' | 'weekly' | 'monthly';

export class DashboardAnalyticsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return isNaN(parsed) ? undefined : parsed;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id?: number;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  payment_period?: PeriodType;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  return_payment_period?: PeriodType;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  top_products_period?: PeriodType;
}

export interface DashboardSummary {
  // Gross figures — sale rows are never rewritten when a return happens
  weekly_total_sale: number;
  weekly_collected?: number;
  weekly_due?: number;
  weekly_transactions: number;
  weekly_returns_total: number;
  weekly_returns_count: number;
  weekly_net_sale: number;
  today_total_sale: number;
  today_collected?: number;
  today_due?: number;
  today_transactions: number;
  today_returns_total: number;
  today_returns_count: number;
  today_net_sale: number;
}

export interface SalesTrendPoint {
  date: string;
  sales_count: number;
  total_amount: number;
  returns_count: number;
  returns_amount: number;
  net_amount: number;
}

export interface PaymentBreakdownPoint {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface ReturnPaymentBreakdownPoint {
  payment_method: string;
  total_amount: number;
  transaction_count: number;
}

export interface TopProductPoint {
  variant_id: number;
  variant_name: string;
  product_name: string;
  sku?: string;
  total_quantity: number;
  total_amount: number;
}

export interface LowStockPoint {
  variant_id: number;
  product_name: string;
  variant_name: string;
  sku?: string;
  alert_quantity: number;
  total_stock: number;
  shortage: number;
  affected_branch_name?: string;
}

export interface ExpiringItemPoint {
  batch_id: number;
  product_name: string;
  variant_name: string;
  batch_number: string | null;
  quantity: number;
  expiry_date: string;
  branch_name?: string;
}

export interface DashboardAnalyticsResponse {
  summary: DashboardSummary;
  weekly_sales_trend: SalesTrendPoint[];
  payment_method_breakdown: PaymentBreakdownPoint[];
  return_payment_breakdown: ReturnPaymentBreakdownPoint[];
  top_products: TopProductPoint[];
  low_stock: {
    total_critical_items: number;
    items: LowStockPoint[];
  };
  expiring_items: {
    total_expiring_items: number;
    items: ExpiringItemPoint[];
  };
}
