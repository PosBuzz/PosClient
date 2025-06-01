import { PartialType } from '@nestjs/mapped-types';
import { CreateProductVariantDto } from './create-product-variant.dto';
import { IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsBoolean()
  preserve_inventory?: boolean; // Flag to preserve existing inventory batches
}