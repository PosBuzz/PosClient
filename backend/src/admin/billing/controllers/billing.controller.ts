import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { CreateBillingDto } from '../dto/create-billing.dto';
import { BillingService } from '../services/billing.service';


@Controller('admin/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':consumerId')
  create(@Param('consumerId') consumerId: string, @Body() dto: CreateBillingDto) {
    return this.billingService.createBillingRecord(consumerId, dto.amount, dto.reference);
  }

  @Get(':consumerId')
  findHistory(@Param('consumerId') consumerId: string) {
    return this.billingService.getBillingHistory(consumerId);
  }
}
