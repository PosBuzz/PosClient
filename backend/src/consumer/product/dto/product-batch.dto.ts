import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  IsArray,
  ValidateNested,
  IsEnum,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
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
  @IsString()
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
