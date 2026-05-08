// dto/create-receipt-pdf-setting.dto.ts

import { IsString, IsOptional, IsEnum, IsObject, IsBoolean, IsInt } from 'class-validator';

export class CreateReceiptPdfSettingDto {
  @IsString()
  name: string;

  @IsEnum(['receipt', 'quotation', 'return'])
  type: 'receipt' | 'quotation' | 'return';

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsObject()
  settings: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
