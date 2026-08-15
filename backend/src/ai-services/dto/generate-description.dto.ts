import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class GenerateDescriptionDto {
  @IsString()
  @IsNotEmpty()
  product: string;

  @IsBoolean()
  @IsOptional()
  force_refresh?: boolean = false;
}
