import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductVariantDto } from './create-product-variant.dto';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsOptional()
  @IsString()
  code?: string;
  
  @IsOptional()
  @IsString()
  description?: string;
  
  @IsOptional()
  @IsNumber()
  category_id?: number;
  
  @IsOptional()
  @IsNumber()
  brand_id?: number;
  
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  tag_ids?: number[];
  
  @IsNotEmpty()
  @IsBoolean()
  has_variants: boolean;
  
  @IsOptional()
  @IsString()
  @IsIn(['inclusive', 'exclusive'])
  tax_method?: string = 'exclusive';
  
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tax?: number = 0;
  
  @IsOptional()
  @IsNumber()
  @Min(0)
  daily_sale_objective?: number = 0;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];
}