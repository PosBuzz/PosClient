import { IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyTargetReportDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  branch_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

export interface DailyTargetRow {
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  sku?: string;
  daily_target: number;
  actual_sold: number;
  achievement_pct: number;
  gap: number;
  // targeted_amount: number;
  // actual_amount: number;
}

export interface DailyTargetReportResponse {
  date: string;
  branch_id?: number;
  branch_name?: string;
  rows: DailyTargetRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  summary: {
    total_target: number;
    total_sold: number;
    overall_achievement_pct: number;
    // targeted_amount: number;
    // total_amount: number;
    // average_amount: number;
  };
}
