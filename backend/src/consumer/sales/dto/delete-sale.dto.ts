import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteSaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
