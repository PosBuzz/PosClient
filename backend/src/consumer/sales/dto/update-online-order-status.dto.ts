import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum OnlineOrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

const money = { maxDecimalPlaces: 2 };

export class UpdateOnlineOrderStatusDto {
  @IsNotEmpty()
  @IsEnum(OnlineOrderStatus)
  status: OnlineOrderStatus;

  /** Free-text partner name from older app versions; ignored when delivery_partner_id is sent. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  delivery_partner?: string | null;

  /** A partner of this shop; null removes the partner. Omit to keep the current one. */
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  delivery_partner_id?: number | null;

  /** What the partner collects from the customer. Defaults to what the customer still owes. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  cod_amount?: number;

  /** What the partner charges for this order (the return charge on a returned order). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  delivery_charge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(money)
  @Min(0)
  cod_fee?: number;
}
