import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaxMethod } from '@prisma/client';
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
  @IsEnum(TaxMethod)
  tax_method?: TaxMethod = TaxMethod.EXCLUSIVE;

  @IsOptional()
  @IsInt({ message: 'tax must be a whole number percentage (0-100)' })
  @Min(0)
  @Max(100)
  tax?: number = 0;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductVariantDto)
  variants: CreateProductVariantDto[];
}
