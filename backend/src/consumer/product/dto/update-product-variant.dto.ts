import { PartialType } from '@nestjs/mapped-types';
import { CreateProductVariantDto } from './create-product-variant.dto';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {
  @IsOptional()
  @IsNumber()
  id?: number;
}