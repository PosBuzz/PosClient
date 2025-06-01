import { PartialType } from '@nestjs/mapped-types';
import { CreateProductVariantDto } from './create-product-variant.dto';
import { IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateProductSerialDto } from './update-product-serial.dto';

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsBoolean()
  preserve_inventory?: boolean; // Flag to preserve existing inventory batches

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateProductSerialDto)
  serials?: UpdateProductSerialDto[]; // Override with UpdateProductSerialDto
}