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
import { PurchasePaymentsService } from '../services/purchase-payments.service';
import { MakePurchasePaymentDto } from '../dto/make-purchase-payment.dto';
import { PurchaseBatchesFiltersDto } from '../dto/purchase-batches-filters.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.inventory_batches])
@Controller('consumer/purchase-payments')
export class PurchasePaymentsController {
  constructor(
    private readonly purchasePaymentsService: PurchasePaymentsService,
  ) {}

  /**
   * Get purchase payment ledger batches
   * GET /consumer/purchase-payments/batches
   */
  @Get('batches')
  async getPurchaseBatches(
    @Query() filters: PurchaseBatchesFiltersDto,
    @Req() req: Request,
  ) {
    return this.purchasePaymentsService.getPurchaseBatches(
      filters,
      req.user.consumer_id!,
    );
  }

  /**
   * Get a specific batch for making payment
   * GET /consumer/purchase-payments/batches/:id
   */
  @Get('batches/:id')
  async getBatchForPayment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.purchasePaymentsService.getBatchForPayment(
      id,
      req.user.consumer_id!,
    );
  }

  /**
   * Make a payment on a batch
   * POST /consumer/purchase-payments/make-payment
   */
  @Post('make-payment')
  async makePayment(
    @Body() paymentData: MakePurchasePaymentDto,
    @Req() req: Request,
  ) {
    return this.purchasePaymentsService.makePayment(
      paymentData,
      req.user.consumer_id!,
    );
  }

  /**
   * Get payment history for a batch
   * GET /consumer/purchase-payments/batches/:id/payments
   */
  @Get('batches/:id/payments')
  async getBatchPayments(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.purchasePaymentsService.getBatchPayments(
      id,
      req.user.consumer_id!,
    );
  }
}
