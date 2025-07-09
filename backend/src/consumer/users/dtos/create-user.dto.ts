import { IsEmail, IsString, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  password: string;

  @IsNumber()
  role_id: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  branch_ids?: number[];
}
