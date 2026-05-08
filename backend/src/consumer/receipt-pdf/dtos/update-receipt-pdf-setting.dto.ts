
// dto/update-receipt-pdf-setting.dto.ts

import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateReceiptPdfSettingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  settings?: any;
}