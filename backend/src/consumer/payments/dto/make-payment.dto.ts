import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  MFS = 'MFS',
}

export class PaymentItemDto {
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

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
  @IsString()
  notes?: string;
}

export class MakePaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  sale_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  payments: PaymentItemDto[];
}
