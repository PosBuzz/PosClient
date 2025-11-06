import { OmitType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import {
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateProductVariantDto } from './update-product-variant.dto';

// Use OmitType instead of PartialType to avoid the variants property inheritance
export class UpdateProductDto extends OmitType(CreateProductDto, ['variants'] as const) {
  // All fields from CreateProductDto are optional through OmitType
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductVariantDto)
  variants?: UpdateProductVariantDto[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  variant_ids_to_delete?: number[];

  @IsOptional()
  @IsBoolean()
  is_edit_mode?: boolean; // Flag to indicate this is an edit operation (preserves inventory)
}
