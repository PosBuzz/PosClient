import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeliveryPartnerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** Prefilled as the order's delivery charge when the partner is chosen */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  default_delivery_charge?: number;

  /** Prefilled COD fee, as a percentage of the cash collected */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  default_cod_fee_percent?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateDeliveryPartnerDto extends PartialType(
  CreateDeliveryPartnerDto,
) {}
