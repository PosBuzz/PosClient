import { PartialType } from '@nestjs/mapped-types';
import { CreateBillingHistoryDto } from './create-billing-history.dto';

export class UpdateBillingHistoryDto extends PartialType(
  CreateBillingHistoryDto,
) {}
