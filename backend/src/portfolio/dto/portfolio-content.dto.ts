import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

class PublishableDto {
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
  @IsOptional() @IsBoolean() is_published?: boolean;
}

export class UpdatePortfolioSettingsDto {
  @IsString() @IsNotEmpty() @MaxLength(120) site_name: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(600) description: string;
  @IsString() @IsNotEmpty() @MaxLength(300) url: string;
  @IsString() @IsNotEmpty() @MaxLength(300) og_image: string;
  @IsString() @IsNotEmpty() @MaxLength(120) author: string;
  @IsString() @IsNotEmpty() @MaxLength(200) contact_email: string;
  @IsString() @IsNotEmpty() @MaxLength(200) sales_email: string;
  @IsString() @IsNotEmpty() @MaxLength(120) phone: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  keywords: string[];
}

export class SolutionDto extends PublishableDto {
  @IsString() @IsNotEmpty() @MaxLength(120) slug: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(300) subtitle: string;
  @IsString() @IsNotEmpty() @MaxLength(60) icon_name: string;
  @IsString() @IsNotEmpty() @MaxLength(60) badge: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) description: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  features: string[];
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  benefits: string[];
  @IsString() @IsNotEmpty() @MaxLength(120) metric_label: string;
  @IsString() @IsNotEmpty() @MaxLength(60) metric_value: string;
  @IsString() @IsNotEmpty() @MaxLength(60) image_key: string;
}

export class FeatureDto extends PublishableDto {
  @IsString() @IsNotEmpty() @MaxLength(120) slug: string;
  @IsString() @IsNotEmpty() @MaxLength(60) category: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(300) tagline: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) description: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  highlights: string[];
  @IsString() @IsNotEmpty() @MaxLength(60) icon: string;
  @IsOptional() @IsString() @MaxLength(60) badge?: string;
}

export class PricingPlanDto extends PublishableDto {
  @IsString() @IsNotEmpty() @MaxLength(120) slug: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) badge?: string;
  @IsString() @IsNotEmpty() @MaxLength(600) description: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price_monthly: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price_annual_monthly: number;
  @IsOptional() @IsBoolean() is_popular?: boolean;
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  features: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  not_included?: string[];
  @IsString() @IsNotEmpty() @MaxLength(120) cta: string;
}

export class FaqDto extends PublishableDto {
  @IsString() @IsNotEmpty() @MaxLength(300) question: string;
  @IsString() @IsNotEmpty() @MaxLength(4000) answer: string;
  @IsString() @IsNotEmpty() @MaxLength(600) aeo_summary: string;
  @IsString() @IsNotEmpty() @MaxLength(120) category: string;
}

export class TestimonialDto extends PublishableDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) quote: string;
  @IsString() @IsNotEmpty() @MaxLength(120) author: string;
  @IsString() @IsNotEmpty() @MaxLength(120) role: string;
  @IsString() @IsNotEmpty() @MaxLength(200) company: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(120) metrics?: string;
}

export class DemoProductDto extends PublishableDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name: string;
  @IsString() @IsNotEmpty() @MaxLength(60) sku: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  wholesale_price: number;
  @IsString() @IsNotEmpty() @MaxLength(60) category: string;
  @IsString() @IsNotEmpty() @MaxLength(20) image: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  tax: number;
  @IsOptional() @IsString() @MaxLength(60) serial?: string;
}
