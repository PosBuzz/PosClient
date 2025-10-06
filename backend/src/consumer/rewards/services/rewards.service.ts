import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateRewardsSettingsDto,
  UpdateRewardsSettingsDto,
} from '../dto/rewards-settings.dto';
import {
  AdjustPointsDto,
  CreateRewardsPointTransactionDto,
  RedeemPointsDto,
  RewardsTransactionType,
} from '../dto/rewards-transaction.dto';
import { RewardsFiltersDto } from '../dto/rewards-filters.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  // Settings Management
  async getSettings(consumerId: number) {
    const settings = await this.prisma.rewardsSettings.findUnique({
      where: { consumer_id: consumerId },
    });

    if (!settings) {
      // Return default settings if none exist
      return {
        consumer_id: consumerId,
        is_enabled: true,
        points_per_currency: 1,
        minimum_purchase_amount: 0,
        maximum_points_per_sale: null,
        redemption_value: 0.01,
        minimum_redemption: 100,
        maximum_redemption: null,
        points_expire_days: null,
        allow_partial_redemption: true,
        earn_on_sale_only: true,
      };
    }

    return settings;
  }

  async createOrUpdateSettings(
    consumerId: number,
    dto: CreateRewardsSettingsDto | UpdateRewardsSettingsDto,
  ) {
    return await this.prisma.rewardsSettings.upsert({
      where: { consumer_id: consumerId },
      update: {
        ...dto,
        updated_at: new Date(),
      },
      create: {
        consumer_id: consumerId,
        ...dto,
      },
    });
  }

  // Customer Points Management
  async getCustomerPoints(consumerId: number, customerId: number) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, consumer_id: consumerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let customerPoints = await this.prisma.customerRewardsPoints.findUnique({
      where: { customer_id: customerId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!customerPoints) {
      // Create initial points record
      customerPoints = await this.prisma.customerRewardsPoints.create({
        data: {
          customer_id: customerId,
          consumer_id: consumerId,
          total_points: 0,
          lifetime_earned: 0,
          lifetime_redeemed: 0,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    }

    return customerPoints;
  }

  async getCustomersWithPoints(consumerId: number, filters: RewardsFiltersDto) {
    const { page = 1, limit = 20, search, sort_by = 'total_points', sort_order = 'desc' } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      consumer_id: consumerId,
    };

    if (search) {
      where.customer = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [customers, total] = await Promise.all([
      this.prisma.customerRewardsPoints.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { [sort_by]: sort_order },
        skip,
        take: limit,
      }),
      this.prisma.customerRewardsPoints.count({ where }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Point Transactions
  async earnPoints(
    consumerId: number,
    customerId: number,
    saleId: number,
    purchaseAmount: number,
  ) {
    const settings = await this.getSettings(consumerId);
    
    if (!settings.is_enabled) {
      return null; // Points system disabled
    }

    if (purchaseAmount < Number(settings.minimum_purchase_amount)) {
      return null; // Purchase amount too low
    }

    // Calculate points to earn
    let pointsToEarn = Math.floor(purchaseAmount * Number(settings.points_per_currency));

    // Apply maximum points per sale limit
    if (settings.maximum_points_per_sale && pointsToEarn > Number(settings.maximum_points_per_sale)) {
      pointsToEarn = Number(settings.maximum_points_per_sale);
    }

    if (pointsToEarn <= 0) {
      return null;
    }

    // Calculate expiry date if applicable
    const expiryDate = settings.points_expire_days
      ? new Date(Date.now() + settings.points_expire_days * 24 * 60 * 60 * 1000)
      : null;

    return await this.createPointTransaction({
      customer_id: customerId,
      type: RewardsTransactionType.EARN,
      points: pointsToEarn,
      sale_id: saleId,
      description: `Earned ${pointsToEarn} points from purchase`,
      reference: `SALE-${saleId}`,
    }, consumerId, expiryDate);
  }

  async redeemPoints(consumerId: number, dto: RedeemPointsDto, userId?: number) {
    const settings = await this.getSettings(consumerId);
    
    if (!settings.is_enabled) {
      throw new BadRequestException('Rewards system is disabled');
    }

    if (dto.points < settings.minimum_redemption) {
      throw new BadRequestException(`Minimum redemption is ${settings.minimum_redemption} points`);
    }

    if (settings.maximum_redemption && dto.points > settings.maximum_redemption) {
      throw new BadRequestException(`Maximum redemption is ${settings.maximum_redemption} points`);
    }

    const customerPoints = await this.getCustomerPoints(consumerId, dto.customer_id);
    
    if (customerPoints.total_points < dto.points) {
      throw new BadRequestException('Insufficient points balance');
    }

    return await this.createPointTransaction({
      customer_id: dto.customer_id,
      type: RewardsTransactionType.REDEEM,
      points: -dto.points, // Negative for redemption
      description: `Redeemed ${dto.points} points`,
      reference: dto.reference,
      notes: dto.notes,
    }, consumerId, null, userId);
  }

  async adjustPoints(consumerId: number, dto: AdjustPointsDto, userId: number) {
    return await this.createPointTransaction({
      customer_id: dto.customer_id,
      type: RewardsTransactionType.ADJUSTMENT,
      points: dto.points,
      description: dto.description,
      notes: dto.notes,
    }, consumerId, null, userId);
  }

  private async createPointTransaction(
    dto: CreateRewardsPointTransactionDto,
    consumerId: number,
    expiryDate?: Date | null,
    userId?: number,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Get current customer points
      let customerPoints = await tx.customerRewardsPoints.findUnique({
        where: { customer_id: dto.customer_id },
      });

      if (!customerPoints) {
        // Create initial points record
        customerPoints = await tx.customerRewardsPoints.create({
          data: {
            customer_id: dto.customer_id,
            consumer_id: consumerId,
            total_points: 0,
            lifetime_earned: 0,
            lifetime_redeemed: 0,
          },
        });
      }

      const balanceBefore = customerPoints.total_points;
      const balanceAfter = balanceBefore + dto.points;

      if (balanceAfter < 0) {
        throw new BadRequestException('Insufficient points balance');
      }

      // Create transaction record
      const transaction = await tx.rewardsPointTransaction.create({
        data: {
          customer_id: dto.customer_id,
          consumer_id: consumerId,
          type: dto.type,
          points: dto.points,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          sale_id: dto.sale_id,
          description: dto.description,
          reference: dto.reference,
          expiry_date: expiryDate,
          created_by_user_id: userId,
          notes: dto.notes,
        },
      });

      // Update customer points
      const updateData: any = {
        total_points: balanceAfter,
      };

      if (dto.type === RewardsTransactionType.EARN) {
        updateData.lifetime_earned = customerPoints.lifetime_earned + dto.points;
        updateData.last_earned_at = new Date();
      } else if (dto.type === RewardsTransactionType.REDEEM) {
        updateData.lifetime_redeemed = customerPoints.lifetime_redeemed + Math.abs(dto.points);
        updateData.last_redeemed_at = new Date();
      }

      await tx.customerRewardsPoints.update({
        where: { customer_id: dto.customer_id },
        data: updateData,
      });

      return transaction;
    });
  }

  async getPointTransactions(consumerId: number, filters: RewardsFiltersDto) {
    const { 
      page = 1, 
      limit = 20, 
      customer_id, 
      search, 
      date_from, 
      date_to, 
      type,
      sort_by = 'created_at', 
      sort_order = 'desc' 
    } = filters;
    
    const skip = (page - 1) * limit;

    const where: any = {
      consumer_id: consumerId,
    };

    if (customer_id) {
      where.customer_id = customer_id;
    }

    if (search) {
      where.customer = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (type) {
      where.type = type;
    }

    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) {
        where.created_at.gte = new Date(date_from);
      }
      if (date_to) {
        where.created_at.lte = new Date(date_to);
      }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.rewardsPointTransaction.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          sale: {
            select: {
              id: true,
              sale_number: true,
              total_amount: true,
            },
          },
          created_by: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { [sort_by]: sort_order },
        skip,
        take: limit,
      }),
      this.prisma.rewardsPointTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async expirePoints(consumerId: number) {
    const settings = await this.getSettings(consumerId);
    
    if (!settings.is_enabled || !settings.points_expire_days) {
      return { expired: 0 };
    }

    const expiryDate = new Date(Date.now() - settings.points_expire_days * 24 * 60 * 60 * 1000);

    // Find expired point transactions that haven't been processed
    const expiredTransactions = await this.prisma.rewardsPointTransaction.findMany({
      where: {
        consumer_id: consumerId,
        type: RewardsTransactionType.EARN,
        expiry_date: {
          lte: new Date(),
        },
        // Only get transactions where the points haven't been expired yet
        NOT: {
          customer: {
            point_transactions: {
              some: {
                type: RewardsTransactionType.EXPIRE,
                reference: {
                  startsWith: 'EXPIRE-',
                },
              },
            },
          },
        },
      },
      include: {
        customer: true,
      },
    });

    let totalExpired = 0;

    for (const transaction of expiredTransactions) {
      try {
        await this.createPointTransaction({
          customer_id: transaction.customer_id,
          type: RewardsTransactionType.EXPIRE,
          points: -transaction.points,
          description: `Expired ${transaction.points} points`,
          reference: `EXPIRE-${transaction.id}`,
        }, consumerId);
        
        totalExpired += transaction.points;
      } catch (error) {
        console.error(`Failed to expire points for transaction ${transaction.id}:`, error);
      }
    }

    return { expired: totalExpired };
  }

  // Helper method to calculate redemption value
  calculateRedemptionValue(points: number, redemptionValue: number | Decimal): number {
    return points * Number(redemptionValue);
  }

  // Helper method to validate if customer can redeem points
  async canRedeemPoints(
    consumerId: number, 
    customerId: number, 
    points: number
  ): Promise<{ canRedeem: boolean; reason?: string }> {
    const settings = await this.getSettings(consumerId);
    
    if (!settings.is_enabled) {
      return { canRedeem: false, reason: 'Rewards system is disabled' };
    }

    if (points < settings.minimum_redemption) {
      return { canRedeem: false, reason: `Minimum redemption is ${settings.minimum_redemption} points` };
    }

    if (settings.maximum_redemption && points > settings.maximum_redemption) {
      return { canRedeem: false, reason: `Maximum redemption is ${settings.maximum_redemption} points` };
    }

    const customerPoints = await this.getCustomerPoints(consumerId, customerId);
    
    if (customerPoints.total_points < points) {
      return { canRedeem: false, reason: 'Insufficient points balance' };
    }

    return { canRedeem: true };
  }

  // Helper method to validate CREDIT payment amount
  async validateCreditPayment(
    consumerId: number,
    customerId: number,
    creditAmount: number
  ): Promise<{ isValid: boolean; reason?: string; maxCreditAmount?: number }> {
    const settings = await this.getSettings(consumerId);
    
    if (!settings.is_enabled) {
      return { isValid: false, reason: 'Rewards system is disabled' };
    }

    const customerPoints = await this.getCustomerPoints(consumerId, customerId);
    
    // Calculate how much credit customer can use based on their points
    const maxCreditAmount = customerPoints.total_points * Number(settings.redemption_value);
    
    if (creditAmount > maxCreditAmount) {
      return { 
        isValid: false, 
        reason: `Insufficient points. Maximum credit available: $${maxCreditAmount.toFixed(2)}`,
        maxCreditAmount 
      };
    }

    // Calculate required points for this credit amount
    const requiredPoints = Math.ceil(creditAmount / Number(settings.redemption_value));
    
    if (requiredPoints < settings.minimum_redemption) {
      return { 
        isValid: false, 
        reason: `Minimum credit amount is $${(settings.minimum_redemption * Number(settings.redemption_value)).toFixed(2)}`,
        maxCreditAmount 
      };
    }

    if (settings.maximum_redemption && requiredPoints > settings.maximum_redemption) {
      const maxCredit = settings.maximum_redemption * Number(settings.redemption_value);
      return { 
        isValid: false, 
        reason: `Maximum credit amount is $${maxCredit.toFixed(2)}`,
        maxCreditAmount: Math.min(maxCreditAmount, maxCredit)
      };
    }

    return { isValid: true, maxCreditAmount };
  }

  // Handle CREDIT payment redemption
  async processCreditPayment(
    consumerId: number,
    customerId: number,
    creditAmount: number,
    saleId: number,
    reference?: string
  ) {
    const validation = await this.validateCreditPayment(consumerId, customerId, creditAmount);
    
    if (!validation.isValid) {
      throw new BadRequestException(validation.reason);
    }

    const settings = await this.getSettings(consumerId);
    const requiredPoints = Math.ceil(creditAmount / Number(settings.redemption_value));

    return await this.createPointTransaction({
      customer_id: customerId,
      type: RewardsTransactionType.REDEEM,
      points: -requiredPoints,
      sale_id: saleId,
      description: `Redeemed ${requiredPoints} points for $${creditAmount.toFixed(2)} credit`,
      reference: reference || `CREDIT-SALE-${saleId}`,
    }, consumerId);
  }

  // Handle CREDIT refund (add points back)
  async processCreditRefund(
    consumerId: number,
    customerId: number,
    refundAmount: number,
    originalSaleId?: number,
    returnId?: number,
    reference?: string
  ) {
    const settings = await this.getSettings(consumerId);
    const pointsToAdd = Math.floor(refundAmount / Number(settings.redemption_value));

    if (pointsToAdd <= 0) {
      return null; // No points to refund for very small amounts
    }

    // For refunds, don't link to original sale to avoid foreign key issues
    // Instead, use the reference to track the return
    return await this.createPointTransaction({
      customer_id: customerId,
      type: RewardsTransactionType.ADJUSTMENT,
      points: pointsToAdd,
      sale_id: undefined, // Don't link to sale for refunds
      description: `Refunded ${pointsToAdd} points for $${refundAmount.toFixed(2)} credit return`,
      reference: reference || `CREDIT-REFUND-${returnId || originalSaleId}`,
      notes: returnId ? `Return ID: ${returnId}, Original Sale ID: ${originalSaleId}` : `Original Sale ID: ${originalSaleId}`,
    }, consumerId);
  }
}
