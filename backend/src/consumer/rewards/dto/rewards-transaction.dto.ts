import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum RewardsTransactionType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  EXPIRE = 'EXPIRE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class CreateRewardsPointTransactionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id: number;

  @IsEnum(RewardsTransactionType)
  type: RewardsTransactionType;

  @Type(() => Number)
  @IsInt()
  points: number; // Can be positive or negative

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sale_id?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RedeemPointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  points: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustPointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id: number;

  @Type(() => Number)
  @IsInt()
  points: number; // Can be positive or negative

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
