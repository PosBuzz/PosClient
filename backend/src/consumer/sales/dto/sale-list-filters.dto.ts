import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod, PaymentStatus } from './create-sale.dto';

export enum SaleRecordStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
}

export class SaleListFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  branch_id?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  sort_by?: string;

  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  source?: 'pending' | 'converted' | 'quotation' | 'direct';

  // 'active' (default) hides soft-deleted sales, 'deleted' shows only those
  @IsOptional()
  @IsEnum(SaleRecordStatus)
  status?: SaleRecordStatus;
}
