import { IsOptional, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyTargetReportDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  branch_id?: number;
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
}

export interface DailyTargetReportResponse {
  date: string;
  branch_id?: number;
  branch_name?: string;
  rows: DailyTargetRow[];
  summary: {
    total_target: number;
    total_sold: number;
    overall_achievement_pct: number;
  };
}