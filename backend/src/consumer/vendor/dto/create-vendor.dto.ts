import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsOptional()
  @IsString()
  contact?: string;
  
  @IsOptional()
  @IsEmail()
  email?: string;
  
  @IsOptional()
  @IsString()
  address?: string;
}