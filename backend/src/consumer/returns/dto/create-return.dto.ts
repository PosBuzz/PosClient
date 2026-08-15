import {
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentMethodEnum, PaymentTypeEnum } from '@prisma/client';

export class CreateReturnItemDto {
  @IsInt()
  @Type(() => Number)
  sale_item_id: number;

  @IsInt()
  @Type(() => Number)
  variant_id: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  batch_id?: number;

  @IsInt()
  @Type(() => Number)
  quantity: number;
}

export class CreateReturnPaymentDto {
  @IsEnum(PaymentMethodEnum)
  payment_method: PaymentMethodEnum;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @ValidateIf((payment) =>
    [
      PaymentMethodEnum.CARD,
      PaymentMethodEnum.BANK_TRANSFER,
      PaymentMethodEnum.MFS,
    ].includes(payment.payment_method),
  )
  @IsEnum(PaymentTypeEnum)
  payment_type?: PaymentTypeEnum;
}

export class CreateReturnExchangeDto {
  @IsInt()
  @Type(() => Number)
  variant_id: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  batch_id?: number;

  @IsInt()
  @Type(() => Number)
  quantity: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  unit_price: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  line_total: number;
}

export class CreateReturnDto {
  @IsInt()
  @Type(() => Number)
  original_sale_id: number;

  @IsInt()
  @Type(() => Number)
  branch_id: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  exchange_sale_id?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? 0 : parseFloat(value),
  )
  @IsNumber()
  shipping_refund_amount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnPaymentDto)
  payments?: CreateReturnPaymentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnExchangeDto)
  exchanges?: CreateReturnExchangeDto[];
}
