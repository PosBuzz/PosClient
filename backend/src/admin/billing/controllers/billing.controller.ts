import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { CreateBillingDto } from '../dto/create-billing.dto';
import { BillingService } from '../services/billing.service';


@Controller('admin/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':consumerId')
  create(@Param('consumerId') consumerId: number, @Body() dto: CreateBillingDto) {
    return this.billingService.createBillingRecord(consumerId, dto.amount, dto.reference, dto.billing_month);
  }

  @Get(':consumerId')
  findHistory(@Param('consumerId') consumerId: number) {
    return this.billingService.getBillingHistory(consumerId);
  }
}
