import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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

export class UpdateOnlineOrderStatusDto {
  @IsNotEmpty()
  @IsEnum(OnlineOrderStatus)
  status: OnlineOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  delivery_partner?: string | null;
}
