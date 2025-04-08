import { IsString } from 'class-validator';

export class CreateConsumerDto {
  @IsString()
  name: string;

  @IsString()
  subdomain: string;

  @IsString()
  plan_id: string;
}
