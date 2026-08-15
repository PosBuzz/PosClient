import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class SubmitFeedbackDto {
  @IsString()
  product: string;

  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  user_edited_description?: string;
}
