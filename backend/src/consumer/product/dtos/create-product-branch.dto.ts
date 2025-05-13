import { ProductType, TaxMethod } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// Add DTO for promotional price
export class PromotionalPriceDto {
  @IsNumber()
  price: number;

  @IsDateString()
  starts_at: Date;

  @IsOptional()
  @IsDateString()
  ends_at?: Date;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(ProductType)
  type: ProductType;

  @IsNumber()
  category_id: number;

  @IsNumber()
  brand_id: number;

  @IsNumber()
  product_unit_id: number;

  @IsOptional()
  @IsNumber()
  sale_unit_id?: number;

  @IsNumber()
  cost: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  wholesale_price?: number;

  @IsOptional()
  @IsNumber()
  purchase_unit_id?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  in_stock?: boolean;

  @IsOptional()
  @IsBoolean()
  sell_online?: boolean;

  @IsOptional()
  @IsNumber()
  daily_sale_objective?: number;

  @IsOptional()
  @IsNumber()
  alert_quantity?: number;

  @IsOptional()
  @IsNumber()
  product_tax?: number;

  @IsOptional()
  @IsEnum(TaxMethod)
  tax_method?: TaxMethod;

  @IsOptional()
  @IsArray()
  tags?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants?: CreateProductVariantDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductBranchPriceDto)
  branch_prices?: CreateProductBranchPriceDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serials?: string[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PromotionalPriceDto)
  promotional_price?: PromotionalPriceDto;
}

export class CreateProductVariantDto {
  @IsString()
  option: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  item_code?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class CreateProductBranchPriceDto {
  @IsNumber()
  branch_id: number;

  @IsNumber()
  price: number;
}
