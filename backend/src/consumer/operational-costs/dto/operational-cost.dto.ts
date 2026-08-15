import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOperationalCostDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
  @IsDateString() incurred_on: string;
  @IsOptional() @Type(() => Number) @IsInt() branch_id?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateOperationalCostDto extends CreateOperationalCostDto {}

export class OperationalCostQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() branch_id?: number;
}
