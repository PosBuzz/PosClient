import { IsString, IsNumber, IsDate } from 'class-validator';

export class CreateBillingDto {
  @IsNumber()
  amount: number;

  @IsString()
  reference: string;

  @IsDate()
  billing_month: Date;
}
