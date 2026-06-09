import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodEnum, PaymentTypeEnum } from '@prisma/client';

export class PurchasePaymentItemDto {
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

export class MakePurchasePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  batch_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchasePaymentItemDto)
  payments: PurchasePaymentItemDto[];
}
