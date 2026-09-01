import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export enum ConsumerImportSection {
  BRANCHES = 'BRANCHES',
  VENDORS = 'VENDORS',
  PRODUCTS = 'PRODUCTS',
  CUSTOMERS = 'CUSTOMERS',
}

export enum ConsumerImportDuplicateStrategy {
  SKIP = 'SKIP',
  UPDATE = 'UPDATE',
}

export class PreviewConsumerDataImportDto {
  @IsInt()
  source_consumer_id: number;

  @IsInt()
  target_consumer_id: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ConsumerImportSection, { each: true })
  sections: ConsumerImportSection[];
}

export class RunConsumerDataImportDto extends PreviewConsumerDataImportDto {
  @IsEnum(ConsumerImportDuplicateStrategy)
  duplicate_strategy: ConsumerImportDuplicateStrategy;

  @IsString()
  @IsNotEmpty()
  confirm_target_subdomain: string;
}
