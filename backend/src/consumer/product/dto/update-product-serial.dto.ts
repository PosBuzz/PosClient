import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber } from 'class-validator';

export class UpdateProductSerialDto {
  @IsOptional()
  @IsNumber()
  id?: number; // For existing serials

  @IsString()
  @IsNotEmpty()
  serial_number: string;

  @IsOptional()
  @IsString()
  @IsIn(['available', 'sold', 'defective', 'returned'])
  status?: string = 'available';

  @IsOptional()
  @IsString()
  notes?: string;
}
