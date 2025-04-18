import { IsEmail, IsString, IsNumber } from 'class-validator';

export class CreateSuperAdminUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  password: string;

  @IsNumber()
  role_id: number;
}
