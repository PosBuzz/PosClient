import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductBatchDto {
  @IsNumber()
  @Type(() => Number)
  branch_id: number;

  @IsString()
  @IsNotEmpty()
  batch_number: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  cost_price: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vendor_id?: number;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}
