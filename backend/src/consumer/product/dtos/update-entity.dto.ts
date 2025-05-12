import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateEntityDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}