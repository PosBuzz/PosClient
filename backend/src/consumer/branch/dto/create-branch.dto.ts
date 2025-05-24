import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsOptional()
  @IsString()
  address?: string;
  
  @IsOptional()
  @IsString()
  phone?: string;
  
  @IsOptional()
  @IsEmail()
  email?: string;
}