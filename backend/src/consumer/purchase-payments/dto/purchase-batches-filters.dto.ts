import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseBatchesFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  branch_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendor_id?: number;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsString()
  payment_status?: 'all' | 'paid' | 'partial' | 'due' | 'unpaid';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  vendorless?: boolean;

  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';
}
