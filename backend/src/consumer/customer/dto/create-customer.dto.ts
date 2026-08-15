import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  address?: string;

  /** Date of birth as YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsEnum(CustomerType)
  customer_type: CustomerType;
}
