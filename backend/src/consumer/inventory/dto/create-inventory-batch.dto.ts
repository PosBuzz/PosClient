import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { PaymentMethodEnum, PaymentTypeEnum } from '@prisma/client';

export class BatchPaymentItemDto {
  @IsNotEmpty()
  @IsEnum(PaymentMethodEnum)
  payment_method: PaymentMethodEnum;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  @Min(0.01, { message: 'Payment amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsEnum(PaymentTypeEnum)
  payment_type?: PaymentTypeEnum;
}

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

  /** Physical storage location, e.g. "A-3-2" */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchPaymentItemDto)
  payments?: BatchPaymentItemDto[];
}
