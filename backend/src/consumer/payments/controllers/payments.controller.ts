import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from '../services/payments.service';
import { MakePaymentDto } from '../dto/make-payment.dto';
import { PartialPaymentFiltersDto } from '../dto/partial-payment-filters.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Get all partially paid sales
   * GET /consumer/payments/partial-sales
   */
  @Get('partial-sales')
  async getPartiallyPaidSales(
    @Query() filters: PartialPaymentFiltersDto,
    @Req() req: Request,
  ) {
    return this.paymentsService.getPartiallyPaidSales(
      filters,
      req.user.consumer_id!,
    );
  }

  /**
   * Get a specific sale for making payment
   * GET /consumer/payments/sales/:id
   */
  @Get('sales/:id')
  async getSaleForPayment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.paymentsService.getSaleForPayment(id, req.user.consumer_id!);
  }

  /**
   * Make a payment on a sale
   * POST /consumer/payments/make-payment
   */
  @Post('make-payment')
  async makePayment(@Body() paymentData: MakePaymentDto, @Req() req: Request) {
    return this.paymentsService.makePayment(
      paymentData,
      req.user.consumer_id!,
    );
  }

  /**
   * Get payment history for a sale
   * GET /consumer/payments/sales/:id/payments
   */
  @Get('sales/:id/payments')
  async getSalePayments(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.paymentsService.getSalePayments(id, req.user.consumer_id!);
  }
}
