import { IsOptional, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class EODReportDto {
  @IsOptional()
  @IsDateString()
  date?: string; // If not provided, uses current date

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  branch_id?: number; // If not provided, includes all branches
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
}

export interface EODSummary {
  total_sales: number;
  total_amount: number;
  total_transactions: number;
  cash_sales: number;
  non_cash_sales: number;
  average_transaction_value: number;
  total_items_sold: number;
  unique_products_sold: number;
}

export interface EODReportResponse {
  date: string;
  branch_name?: string;
  summary: EODSummary;
  payment_method_breakdown: PaymentMethodBreakdown[];
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
}
