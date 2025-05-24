import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateProductSerialDto {
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