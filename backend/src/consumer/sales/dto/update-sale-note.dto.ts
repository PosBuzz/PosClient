import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSaleNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
