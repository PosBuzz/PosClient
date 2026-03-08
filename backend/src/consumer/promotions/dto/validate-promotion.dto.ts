import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class ValidatePromotionCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  variant_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  line_total: number;
}

export class ValidatePromotionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branch_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidatePromotionCartItemDto)
  items: ValidatePromotionCartItemDto[];
}
