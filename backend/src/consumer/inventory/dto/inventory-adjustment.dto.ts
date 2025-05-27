import { IsInt, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryAdjustmentDto {
  @IsInt()
  @Type(() => Number)
  variant_id: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  branch_id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  batch_id?: number;

  @IsInt()
  @Type(() => Number)
  quantity_change: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}