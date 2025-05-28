import { IsInt, IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class TransferItemDto {
  @IsInt()
  @Type(() => Number)
  batch_id: number;

  @IsInt()
  @Type(() => Number)
  quantity: number;
}

export class CreateInventoryTransferDto {
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '' || value === 'null') {
      return null;
    }
    return Number(value);
  })
  @IsOptional()
  source_branch_id: number | null;

  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '' || value === 'null') {
      return null;
    }
    return Number(value);
  })
  @IsOptional()
  destination_branch_id: number | null;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}