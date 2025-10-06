import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateRewardsSettingsDto {
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean = true;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  points_per_currency: number = 1;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  minimum_purchase_amount: number = 0;

  @IsOptional()
  @Transform(({ value }) => value ? Number(value) : null)
  @IsNumber()
  @Min(0)
  maximum_points_per_sale?: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  redemption_value: number = 0.01;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimum_redemption: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximum_redemption?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points_expire_days?: number;

  @IsOptional()
  @IsBoolean()
  allow_partial_redemption?: boolean = true;

  @IsOptional()
  @IsBoolean()
  earn_on_sale_only?: boolean = true;
}

export class UpdateRewardsSettingsDto extends CreateRewardsSettingsDto {}
