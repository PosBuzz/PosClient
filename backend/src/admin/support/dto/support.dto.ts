import { Type } from 'class-transformer';
import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminSupportQueryDto {
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  @IsOptional() @Type(() => Number) @IsInt() consumer_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() assigned_to_id?: number;
  @IsOptional() @IsString() @MaxLength(150) search?: string;
}

export class AdminSupportReplyDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body: string;
  // Optional status transition applied together with the reply.
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
}

export class UpdateSupportTicketDto {
  @IsOptional() @IsEnum(SupportTicketStatus) status?: SupportTicketStatus;
  @IsOptional() @IsEnum(SupportTicketPriority) priority?: SupportTicketPriority;
  // JSON body, so no @Type coercion — null clears the assignee.
  @IsOptional() @IsInt() assigned_to_id?: number | null;
}
