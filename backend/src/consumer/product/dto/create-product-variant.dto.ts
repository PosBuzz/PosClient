import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDecimal, IsUrl, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VariantAttributeDto } from './variant-attribute.dto';
import { CreateProductSerialDto } from './product-serial.dto';

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
  image?: string; // single image URL
  
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
  
  @IsOptional()
  @IsNumber()
  @Min(0)
  alert_quantity?: number = 0; // Low stock alert threshold
  
  @IsOptional()
  @Type(() => VariantAttributeDto)
  attributes?: VariantAttributeDto[];
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductSerialDto)
  serials?: CreateProductSerialDto[];
}