import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDecimal, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { VariantAttributeDto } from './variant-attribute.dto';

export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsOptional()
  @IsString()
  sku?: string;
  
  @IsOptional()
  @IsString()
  barcode?: string;
  
  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '2' })
  cost_price: string;
  
  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '2' })
  regular_price: string;
  
  @IsOptional()
  @IsDecimal({ decimal_digits: '2' })
  wholesale_price?: string;
  
  @IsNotEmpty()
  @IsNumber()
  sale_unit_id: number;
  
  @IsNotEmpty()
  @IsNumber()
  purchase_unit_id: number;
  
  @IsOptional()
  @IsNumber()
  warranty_period?: number; // warranty period in months only
  
  @IsOptional()
  @IsString()
  @IsUrl()
  image?: string; // single image URL
  
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
  
  @IsOptional()
  @Type(() => VariantAttributeDto)
  attributes?: VariantAttributeDto[];
}