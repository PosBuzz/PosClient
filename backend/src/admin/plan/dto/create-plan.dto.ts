import { IsArray, IsEmail, IsInt, IsString } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsInt()
  price: number;

  @IsArray()
  permission_ids: number[];
}
