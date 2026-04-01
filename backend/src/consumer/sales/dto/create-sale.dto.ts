import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  MFS = 'MFS', // Mobile Financial Service
  DEPOSIT = 'DEPOSIT',
  CREDIT = 'CREDIT',
  EXCHANGE = 'EXCHANGE',
}

export enum OnlineOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum PaymentStatus {
  PAID = 'paid',
  PARTIAL = 'partial',
  DUE = 'due',
  CANCELLED = 'cancelled',
}

export enum SaleType {
  SALE = 'sale',
  QUOTATION = 'quotation',
}

export enum PriceType {
  REGULAR = 'regular',
  WHOLESALE = 'wholesale',
}

export class CreateSaleItemDto {
  @IsInt()
  @Min(1)
  variant_id: number;

  @IsOptional()
  @IsInt()
  batch_id?: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  average_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  special_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  promotion_discount_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  applied_promotion_id?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_amount?: number;

  @IsNumber()
  @Min(0)
  line_total: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsInt()
  customer_id?: number;

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_phone?: string;

  @IsOptional()
  @IsString()
  customer_email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  applied_promotion_id?: number;

  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @IsInt()
  served_by_id?: number;

  @IsOptional()
  @IsInt()
  quotation_id?: number;

  @IsOptional()
  @IsEnum(SaleType)
  sale_type?: SaleType;

  @IsOptional()
  @IsEnum(PriceType)
  price_type?: PriceType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping_cost?: number;



  @IsOptional()
  @IsEnum(PaymentStatus)
  payment_status?: PaymentStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  received_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  is_online_order?: boolean;

  @IsOptional()
  @IsEnum(OnlineOrderStatus)
  online_order_status?: OnlineOrderStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments?: CreateSalePaymentDto[];
}

export class CreateSalePaymentDto {
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
