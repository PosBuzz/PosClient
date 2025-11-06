import { IsNotEmpty, IsString } from 'class-validator';

export class VariantAttributeDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  value: string;
}