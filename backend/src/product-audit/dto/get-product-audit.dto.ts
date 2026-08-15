import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GetProductAuditDto {
  @IsInt()
  @Type(() => Number)
  variant_id: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  branch_id?: number;
}
