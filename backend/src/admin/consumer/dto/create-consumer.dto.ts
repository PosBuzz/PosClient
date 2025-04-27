import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateConsumerDto {
  @IsString()
  company_name: string;

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

  @IsOptional()
  secondary_email: string;

  @IsOptional()
  business_category: string;
}
