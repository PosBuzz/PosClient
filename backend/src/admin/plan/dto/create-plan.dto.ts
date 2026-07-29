import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsInt()
  price: number;

  // Null / omitted = unlimited products for consumers on this plan
  @IsOptional()
  @IsInt()
  @Min(1)
  max_products?: number | null;

  @IsArray()
  permission_ids: number[];
}
