import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateBillingHistoryDto {
  @IsInt()
  consumer_id: number;

  @IsInt()
  plan_id: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string | null;

  @IsDateString()
  billing_date: string;

  @IsDateString()
  billing_from: string;

  @IsDateString()
  billing_till: string;
}
