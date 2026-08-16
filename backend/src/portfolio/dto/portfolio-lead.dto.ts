import { PortfolioLeadStatus, PortfolioLeadType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePortfolioLeadDto {
  @IsEnum(PortfolioLeadType) type: PortfolioLeadType;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsEmail() @MaxLength(200) email: string;
  @IsOptional() @IsString() @MaxLength(60) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) business_name?: string;
  @IsOptional() @IsString() @MaxLength(60) industry?: string;
  @IsOptional() @IsString() @MaxLength(20) locations?: string;
  @IsOptional() @IsString() @MaxLength(4000) message?: string;
  @IsOptional() @IsString() @MaxLength(200) source_page?: string;
  // Honeypot: real users never fill this in, bots do.
  @IsOptional() @IsString() @MaxLength(200) company_website?: string;
}

export class UpdatePortfolioLeadDto {
  @IsOptional() @IsEnum(PortfolioLeadStatus) status?: PortfolioLeadStatus;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}

export class PortfolioLeadQueryDto {
  @IsOptional() @IsEnum(PortfolioLeadStatus) status?: PortfolioLeadStatus;
  @IsOptional() @IsEnum(PortfolioLeadType) type?: PortfolioLeadType;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() take?: number;
}
