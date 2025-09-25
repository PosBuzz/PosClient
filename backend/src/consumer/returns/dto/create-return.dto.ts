import { IsInt, IsString, IsOptional, IsArray, ValidateNested, IsDecimal, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentMethodEnum } from '@prisma/client';

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

  @Transform(({ value }) => parseFloat(value))
  @IsDecimal()
  refund_amount: number;
}

export class CreateReturnPaymentDto {
  @IsEnum(PaymentMethodEnum)
  payment_method: PaymentMethodEnum;

  @Transform(({ value }) => parseFloat(value))
  @IsDecimal()
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
  @IsDecimal()
  unit_price: number;

  @Transform(({ value }) => parseFloat(value))
  @IsDecimal()
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
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

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
