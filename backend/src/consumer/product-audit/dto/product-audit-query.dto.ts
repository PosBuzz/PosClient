import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ProductAuditQueryDto {
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  variant_id: number;

  @IsString()
  start_date: string;

  @IsString()
  end_date: string;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  @IsInt()
  branch_id?: number;
}
