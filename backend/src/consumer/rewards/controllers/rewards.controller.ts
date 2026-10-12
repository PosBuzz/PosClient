import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { RewardsFiltersDto } from '../dto/rewards-filters.dto';
import {
  CreateRewardsSettingsDto,
  UpdateRewardsSettingsDto,
} from '../dto/rewards-settings.dto';
import {
  AdjustPointsDto,
  RedeemPointsDto,
} from '../dto/rewards-transaction.dto';
import { RewardsService } from '../services/rewards.service';

@Controller('consumer/rewards')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.customers]) // Using existing customer permission for now
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  // Settings endpoints
  @Get('settings')
  async getSettings(@Req() req: Request) {
    return this.rewardsService.getSettings(Number(req.user.consumer_id));
  }

  @Post('settings')
  async createSettings(
    @Req() req: Request,
    @Body() dto: CreateRewardsSettingsDto,
  ) {
    return this.rewardsService.createOrUpdateSettings(
      Number(req.user.consumer_id),
      dto,
    );
  }

  @Patch('settings')
  async updateSettings(
    @Req() req: Request,
    @Body() dto: UpdateRewardsSettingsDto,
  ) {
    return this.rewardsService.createOrUpdateSettings(
      Number(req.user.consumer_id),
      dto,
    );
  }

  // Customer points endpoints
  @Get('customers')
  async getCustomersWithPoints(
    @Req() req: Request,
    @Query() filters: RewardsFiltersDto,
  ) {
    return this.rewardsService.getCustomersWithPoints(
      Number(req.user.consumer_id),
      filters,
    );
  }

  @Get('customers/:id/points')
  async getCustomerPoints(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
  ) {
    return this.rewardsService.getCustomerPoints(
      Number(req.user.consumer_id),
      customerId,
    );
  }

  @Post('customers/:id/redeem')
  async redeemPoints(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Body() dto: Omit<RedeemPointsDto, 'customer_id'>,
  ) {
    return this.rewardsService.redeemPoints(
      Number(req.user.consumer_id),
      { ...dto, customer_id: customerId },
      Number(req.user.id),
    );
  }

  @Post('customers/:id/adjust')
  async adjustPoints(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Body() dto: Omit<AdjustPointsDto, 'customer_id'>,
  ) {
    return this.rewardsService.adjustPoints(
      Number(req.user.consumer_id),
      { ...dto, customer_id: customerId },
      Number(req.user.id),
    );
  }

  @Get('customers/:id/can-redeem/:points')
  async canRedeemPoints(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Param('points', ParseIntPipe) points: number,
  ) {
    return this.rewardsService.canRedeemPoints(
      Number(req.user.consumer_id),
      customerId,
      points,
    );
  }

  // Transaction endpoints
  @Get('transactions')
  async getPointTransactions(
    @Req() req: Request,
    @Query() filters: RewardsFiltersDto,
  ) {
    return this.rewardsService.getPointTransactions(
      Number(req.user.consumer_id),
      filters,
    );
  }

  @Get('customers/:id/transactions')
  async getCustomerTransactions(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Query() filters: RewardsFiltersDto,
  ) {
    const filtersWithCustomer = { ...filters, customer_id: customerId };
    return this.rewardsService.getPointTransactions(
      Number(req.user.consumer_id),
      filtersWithCustomer,
    );
  }

  // Utility endpoints
  @Post('expire-points')
  async expirePoints(@Req() req: Request) {
    return this.rewardsService.expirePoints(Number(req.user.consumer_id));
  }

  @Get('redemption-value/:points')
  async getRedemptionValue(
    @Req() req: Request,
    @Param('points', ParseIntPipe) points: number,
  ) {
    const settings = await this.rewardsService.getSettings(
      Number(req.user.consumer_id),
    );
    const value = this.rewardsService.calculateRedemptionValue(
      points,
      settings.redemption_value,
    );
    return {
      points,
      value,
      redemption_rate: Number(settings.redemption_value),
    };
  }

  // CREDIT payment validation and processing
  @Get('customers/:id/validate-credit/:amount')
  async validateCreditPayment(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Param('amount') amount: string,
  ) {
    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return { isValid: false, reason: 'Invalid credit amount' };
    }

    return this.rewardsService.validateCreditPayment(
      Number(req.user.consumer_id),
      customerId,
      creditAmount,
    );
  }

  @Post('customers/:id/process-credit')
  async processCreditPayment(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Body() dto: { amount: number; sale_id: number; reference?: string },
  ) {
    return this.rewardsService.processCreditPayment(
      Number(req.user.consumer_id),
      customerId,
      dto.amount,
      dto.sale_id,
      dto.reference,
    );
  }

  @Post('customers/:id/process-credit-refund')
  async processCreditRefund(
    @Req() req: Request,
    @Param('id', ParseIntPipe) customerId: number,
    @Body()
    dto: {
      amount: number;
      original_sale_id?: number;
      return_id?: number;
      reference?: string;
    },
  ) {
    return this.rewardsService.processCreditRefund(
      Number(req.user.consumer_id),
      customerId,
      dto.amount,
      dto.original_sale_id,
      dto.return_id,
      dto.reference,
    );
  }
}
