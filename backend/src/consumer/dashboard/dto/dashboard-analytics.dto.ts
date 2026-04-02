import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class DashboardAnalyticsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Transform(({ value }) => (value === '' ? undefined : value))
  branch_id?: number;
}

export interface DashboardSummary {
  weekly_total_sale: number;
  weekly_transactions: number;
  today_total_sale: number;
  today_transactions: number;
}

export interface SalesTrendPoint {
  date: string;
  sales_count: number;
  total_amount: number;
}

export interface PaymentBreakdownPoint {
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
  batch_number: string;
  quantity: number;
  expiry_date: string;
  branch_name?: string;
}

export interface DashboardAnalyticsResponse {
  summary: DashboardSummary;
  weekly_sales_trend: SalesTrendPoint[];
  payment_method_breakdown: PaymentBreakdownPoint[];
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
