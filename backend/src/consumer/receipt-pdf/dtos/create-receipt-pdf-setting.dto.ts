// dto/create-receipt-pdf-setting.dto.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  IsInt,
} from 'class-validator';
import {
  RECEIPT_PRESET_TYPES,
  ReceiptPresetType,
} from '../preset/receipt-pdf-settings';

export class CreateReceiptPdfSettingDto {
  @IsString()
  name: string;

  @IsEnum(RECEIPT_PRESET_TYPES)
  type: ReceiptPresetType;

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsObject()
  settings: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
