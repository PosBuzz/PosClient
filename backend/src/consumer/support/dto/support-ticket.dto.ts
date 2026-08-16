import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupportTicketDto {
  @IsString() @IsNotEmpty() @MaxLength(150) subject: string;
  @IsEnum(SupportTicketCategory) category: SupportTicketCategory;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsString() @IsNotEmpty() @MaxLength(5000) message: string;
}

export class AddSupportMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body: string;
}

export class SupportTicketQueryDto {
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
  @IsOptional() @IsString() @MaxLength(150) search?: string;
}
