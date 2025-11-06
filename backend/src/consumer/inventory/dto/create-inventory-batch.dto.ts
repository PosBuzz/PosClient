import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryBatchDto {
  @IsInt()
  @Type(() => Number)
  variant_id: number;

  @IsInt()
  @Type(() => Number)
  branch_id: number;

  @IsString()
  batch_number: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsString()
  cost_price: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  vendor_id?: number;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}