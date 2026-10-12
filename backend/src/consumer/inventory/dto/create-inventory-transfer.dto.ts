import {
  ArrayMinSize,
  IsInt,
  IsString,
  IsOptional,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsInt()
  @Type(() => Number)
  batch_id: number;

  @IsInt()
  @Min(1)
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
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}
