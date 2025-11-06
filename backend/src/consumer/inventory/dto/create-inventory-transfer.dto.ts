import { IsInt, IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsInt()
  @Type(() => Number)
  batch_id: number;

  @IsInt()
  @Type(() => Number)
  quantity: number;
}

export class CreateInventoryTransferDto {
  @IsInt()
  @Type(() => Number)
  source_branch_id: number;

  @IsInt()
  @Type(() => Number)
  destination_branch_id: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}