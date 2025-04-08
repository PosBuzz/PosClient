import { IsString, IsNumber } from 'class-validator';

export class CreateBillingDto {
  @IsNumber()
  amount: number;

  @IsString()
  reference: string;
}
