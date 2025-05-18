import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateDescriptionDto {
  @IsString()
  @IsNotEmpty()
  product: string;
}
