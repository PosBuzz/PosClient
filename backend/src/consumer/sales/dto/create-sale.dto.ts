import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentMethodEnum, PaymentTypeEnum } from '@prisma/client';

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  MFS = 'MFS', // Mobile Financial Service
  CREDIT = 'CREDIT',
  EXCHANGE = 'EXCHANGE',
}

export enum PaymentType {
  BANGLADESH_BANK = 'BANGLADESH_BANK',
  SONALI_BANK_LIMITED = 'SONALI_BANK_LIMITED',
  JANATA_BANK_LIMITED = 'JANATA_BANK_LIMITED',
  AGRANI_BANK_LIMITED = 'AGRANI_BANK_LIMITED',
  RUPALI_BANK_LIMITED = 'RUPALI_BANK_LIMITED',
  BANGLADESH_KRISHI_BANK = 'BANGLADESH_KRISHI_BANK',
  RAJSHAHI_KRISHI_UNNAYAN_BANK = 'RAJSHAHI_KRISHI_UNNAYAN_BANK',
  BANGLADESH_DEVELOPMENT_BANK_LIMITED = 'BANGLADESH_DEVELOPMENT_BANK_LIMITED',
  BASIC_BANK_LIMITED = 'BASIC_BANK_LIMITED',
  ANSAR_VDP_UNNAYAN_BANK = 'ANSAR_VDP_UNNAYAN_BANK',
  KARMASANGSTHAN_BANK = 'KARMASANGSTHAN_BANK',
  AB_BANK_LIMITED = 'AB_BANK_LIMITED',
  AL_ARAFAH_ISLAMI_BANK_LIMITED = 'AL_ARAFAH_ISLAMI_BANK_LIMITED',
  BANGLADESH_COMMERCE_BANK_LIMITED = 'BANGLADESH_COMMERCE_BANK_LIMITED',
  BANK_ASIA_LIMITED = 'BANK_ASIA_LIMITED',
  BRAC_BANK_LIMITED = 'BRAC_BANK_LIMITED',
  DHAKA_BANK_LIMITED = 'DHAKA_BANK_LIMITED',
  DUTCH_BANGLA_BANK_LIMITED = 'DUTCH_BANGLA_BANK_LIMITED',
  EASTERN_BANK_LIMITED = 'EASTERN_BANK_LIMITED',
  EXIM_BANK_LIMITED = 'EXIM_BANK_LIMITED',
  FIRST_SECURITY_ISLAMI_BANK_LIMITED = 'FIRST_SECURITY_ISLAMI_BANK_LIMITED',
  ICB_ISLAMIC_BANK_LIMITED = 'ICB_ISLAMIC_BANK_LIMITED',
  IFIC_BANK_LIMITED = 'IFIC_BANK_LIMITED',
  ISLAMI_BANK_BANGLADESH_LIMITED = 'ISLAMI_BANK_BANGLADESH_LIMITED',
  JAMUNA_BANK_LIMITED = 'JAMUNA_BANK_LIMITED',
  MEGHNA_BANK_LIMITED = 'MEGHNA_BANK_LIMITED',
  MERCANTILE_BANK_LIMITED = 'MERCANTILE_BANK_LIMITED',
  MIDLAND_BANK_LIMITED = 'MIDLAND_BANK_LIMITED',
  MUTUAL_TRUST_BANK_LIMITED = 'MUTUAL_TRUST_BANK_LIMITED',
  NATIONAL_BANK_LIMITED = 'NATIONAL_BANK_LIMITED',
  NRB_BANK_LIMITED = 'NRB_BANK_LIMITED',
  NATIONAL_CREDIT_AND_COMMERCE_BANK_LIMITED = 'NATIONAL_CREDIT_AND_COMMERCE_BANK_LIMITED',
  NRB_COMMERCIAL_BANK_LIMITED = 'NRB_COMMERCIAL_BANK_LIMITED',
  ONE_BANK_LIMITED = 'ONE_BANK_LIMITED',
  PREMIER_BANK_LIMITED = 'PREMIER_BANK_LIMITED',
  PRIME_BANK_LIMITED = 'PRIME_BANK_LIMITED',
  PUBALI_BANK_LIMITED = 'PUBALI_BANK_LIMITED',
  SHAHJALAL_ISLAMI_BANK_LIMITED = 'SHAHJALAL_ISLAMI_BANK_LIMITED',
  SOCIAL_ISLAMI_BANK_LIMITED = 'SOCIAL_ISLAMI_BANK_LIMITED',
  SOUTH_BANGLA_AGRICULTURE_AND_COMMERCE_BANK_LIMITED = 'SOUTH_BANGLA_AGRICULTURE_AND_COMMERCE_BANK_LIMITED',
  SOUTHEAST_BANK_LIMITED = 'SOUTHEAST_BANK_LIMITED',
  STANDARD_BANK_LIMITED = 'STANDARD_BANK_LIMITED',
  THE_CITY_BANK_LIMITED = 'THE_CITY_BANK_LIMITED',
  THE_FARMERS_BANK_LIMITED = 'THE_FARMERS_BANK_LIMITED',
  TRUST_BANK_LIMITED = 'TRUST_BANK_LIMITED',
  UNION_BANK_LIMITED = 'UNION_BANK_LIMITED',
  UNITED_COMMERCIAL_BANK_LIMITED = 'UNITED_COMMERCIAL_BANK_LIMITED',
  UTTARA_BANK_LIMITED = 'UTTARA_BANK_LIMITED',
  BANK_AL_FALAH_LIMITED = 'BANK_AL_FALAH_LIMITED',
  CITIBANK_N_A = 'CITIBANK_N_A',
  COMMERCIAL_BANK_OF_CEYLON_LIMITED = 'COMMERCIAL_BANK_OF_CEYLON_LIMITED',
  HABIB_BANK_LIMITED = 'HABIB_BANK_LIMITED',
  NATIONAL_BANK_OF_PAKISTAN = 'NATIONAL_BANK_OF_PAKISTAN',
  STANDARD_CHARTERED_BANK = 'STANDARD_CHARTERED_BANK',
  STATE_BANK_OF_INDIA = 'STATE_BANK_OF_INDIA',
  THE_HONGKONG_AND_SHANGHAI_BANKING_CORPORATION_LTD = 'THE_HONGKONG_AND_SHANGHAI_BANKING_CORPORATION_LTD',
  WOORI_BANK = 'WOORI_BANK',

  ROCKET = 'ROCKET',
  BKASH = 'BKASH',
  MYCASH = 'MYCASH',
  ISLAMI_BANK_MCASH = 'ISLAMI_BANK_MCASH',
  TRUST_AXIATA_PAY_TAP = 'TRUST_AXIATA_PAY_TAP',
  FIRSTCASH = 'FIRSTCASH',
  UPAY = 'UPAY',
  OK_WALLET = 'OK_WALLET',
  RUPALI_BANK = 'RUPALI_BANK',
  TELECASH = 'TELECASH',
  ISLAMIC_WALLET = 'ISLAMIC_WALLET',
  MEGHNA_PAY = 'MEGHNA_PAY',
  NAGAD = 'NAGAD',
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
  sold_unit_price?: number;

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

  @IsOptional()
  @IsBoolean()
  is_delivery_later?: boolean;

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

  @ValidateIf((payment) =>
    [
      PaymentMethodEnum.CARD,
      PaymentMethodEnum.BANK_TRANSFER,
      PaymentMethodEnum.MFS,
    ].includes(payment.payment_method),
  )
  @IsEnum(PaymentTypeEnum)
  payment_type?: PaymentTypeEnum;

  // @IsOptional()
  // @IsString()
  // notes?: string;
}
