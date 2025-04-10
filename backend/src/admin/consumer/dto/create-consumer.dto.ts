import { IsString, IsEmail } from 'class-validator';

export class CreateConsumerDto {
  @IsString()
  name: string;

  @IsString()
  subdomain: string;

  @IsString()
  plan_id: string;

  @IsEmail()
  email: string;  // Added email validation

  @IsString()
  password: string;  // Added password validation
}
