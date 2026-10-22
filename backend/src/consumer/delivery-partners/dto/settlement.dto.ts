import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

/** Real money only: the system-only methods (credit, exchange, partner COD) are not offered */
export enum SettlementPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CHEQUE = 'CHEQUE',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MOBILE_MONEY = 'MOBILE_MONEY',
  MFS = 'MFS',
}

export class CreateSettlementDto {
  /** RECEIVED: the partner paid the shop. PAID: the shop paid the partner. */
  @IsIn(['RECEIVED', 'PAID'], {
    message: 'Direction must be RECEIVED or PAID',
  })
  direction: 'RECEIVED' | 'PAID';

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a number with at most 2 decimals' },
  )
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  amount: number;

  @IsEnum(SettlementPaymentMethod, {
    message:
      'Choose a payment method: cash, card, cheque, bank transfer or MFS',
  })
  payment_method: SettlementPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsDateString()
  settlement_date?: string;

  /** Orders of this partner the payment covers; they are marked settled */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  sale_ids?: number[];

  /** Write off the gap between what the chosen orders say and the amount, as an adjustment */
  @IsOptional()
  @IsBoolean()
  adjust_difference?: boolean;
}

export class VoidSettlementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class CreateAdjustmentDto {
  /** > 0: the partner owes the shop more. < 0: the partner owes less / the shop owes the partner */
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a number with at most 2 decimals' },
  )
  @NotEquals(0, { message: 'Amount must not be zero' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;
}

export class PartnerListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PartnerOrdersQueryDto extends PartnerListQueryDto {
  @IsOptional()
  @IsIn(['unsettled', 'settled', 'all'])
  settlement?: 'unsettled' | 'settled' | 'all';
}
