import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum PromotionScope {
  SINGLE_PRODUCT = 'SINGLE_PRODUCT',
  BUNDLE = 'BUNDLE',
  BRAND = 'BRAND',
}

export enum PromotionDiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export class CreatePromotionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionScope)
  scope: PromotionScope;

  @IsEnum(PromotionDiscountType)
  discount_type: PromotionDiscountType;

  @IsNumber()
  @Min(0.01)
  discount_value: number;

  @IsDateString()
  start_date: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_purchase?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  min_quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usage_limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cap_quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cap_discount_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_discount_amount?: number;

  @IsOptional()
  @IsBoolean()
  member_only?: boolean;

  @IsOptional()
  @IsBoolean()
  limit_per_customer?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_usage_limit?: number;

  @IsOptional()
  @IsBoolean()
  customer_usage_daily_reset?: boolean;

  @IsOptional()
  @IsBoolean()
  auto_apply?: boolean;

  @IsOptional()
  @IsBoolean()
  branch_specific?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  branch_ids?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brand_id?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  variant_ids?: number[];
}
