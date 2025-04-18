import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateConsumerDto {
  @IsString()
  name: string;

  @IsString()
  subdomain: string;

  @IsInt()
  plan_id: number;

  @IsEmail()
  email: string; // Added email validation

  @IsString()
  password: string; // Added password validation

  @IsOptional()
  address: string;

  @IsOptional()
  phone: string;
}
