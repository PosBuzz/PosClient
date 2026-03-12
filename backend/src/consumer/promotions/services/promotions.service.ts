import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePromotionDto,
  PromotionDiscountType,
  PromotionScope,
} from '../dto/create-promotion.dto';
import { PromotionSalesFiltersDto } from '../dto/promotion-sales-filters.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';
import { ValidatePromotionDto } from '../dto/validate-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  private get promotionInclude() {
    return {
      brand: {
        select: {
          id: true,
          name: true,
        },
      },
      branches: {
        include: {
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      products: {
        include: {
          variant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  brand_id: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private toNumber(value: any): number {
    return Number(value ?? 0);
  }

  private mapPromotion(promotion: any, summaryMap: Map<number, any>) {
    const summary = summaryMap.get(promotion.id);

    return {
      id: promotion.id,
      name: promotion.name,
      description: promotion.description,
      scope: promotion.scope,
      discount_type: promotion.discount_type,
      discount_value: this.toNumber(promotion.discount_value),
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      is_active: promotion.is_active,
      min_purchase:
        promotion.min_purchase !== null && promotion.min_purchase !== undefined
          ? this.toNumber(promotion.min_purchase)
          : null,
      min_quantity: promotion.min_quantity,
      usage_limit: promotion.usage_limit,
      cap_quantity: promotion.cap_quantity,
      max_discount_amount:
        promotion.max_discount_amount !== null &&
        promotion.max_discount_amount !== undefined
          ? this.toNumber(promotion.max_discount_amount)
          : null,
      cap_discount_amount:
        promotion.cap_discount_amount !== null &&
        promotion.cap_discount_amount !== undefined
          ? this.toNumber(promotion.cap_discount_amount)
          : null,
      member_only: promotion.member_only,
      limit_per_customer: promotion.limit_per_customer,
      customer_usage_limit: promotion.customer_usage_limit,
      customer_usage_daily_reset: promotion.customer_usage_daily_reset,
      auto_apply: promotion.auto_apply,
      branch_specific: promotion.branch_specific,
      branch_ids: promotion.branches.map((branch: any) => branch.branch_id),
      variant_ids: promotion.products.map((product: any) => product.variant_id),
      brand_id: promotion.brand_id,
      brand: promotion.brand,
      branches: promotion.branches.map((branch: any) => branch.branch),
      products: promotion.products.map((product: any) => ({
        variant_id: product.variant_id,
        variant_name: product.variant.name,
        product_id: product.variant.product.id,
        product_name: product.variant.product.name,
      })),
      sales_count: summary?._count?._all || 0,
      total_discount_given: this.toNumber(summary?._sum?.promotion_discount),
      total_discounted_sales: this.toNumber(summary?._sum?.total_amount),
      created_at: promotion.created_at,
      updated_at: promotion.updated_at,
    };
  }

  private async getPromotionSalesSummary(promotionIds: number[]) {
    if (!promotionIds.length) {
      return new Map<number, any>();
    }

    const grouped = await (this.prisma.sale as any).groupBy({
      by: ['promotion_id'],
      where: {
        promotion_id: { in: promotionIds },
      },
      _count: {
        _all: true,
      },
      _sum: {
        promotion_discount: true,
        total_amount: true,
      },
    });

    return new Map<number, any>(
      grouped
        .filter((item: any) => item.promotion_id)
        .map((item: any) => [item.promotion_id, item]),
    );
  }

  private async ensurePromotionOwnedByConsumer(id: number, consumerId: number) {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        id,
        consumer_id: consumerId,
      },
      include: this.promotionInclude,
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    return promotion;
  }

  private async validatePromotionRules(
    input: CreatePromotionDto,
    consumerId: number,
  ) {
    const startDate = new Date(input.start_date);
    const endDate = input.end_date ? new Date(input.end_date) : null;

    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start_date');
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid end_date');
    }

    if (endDate && endDate < startDate) {
      throw new BadRequestException('end_date must be after start_date');
    }

    const minQuantity = input.min_quantity ?? 1;
    const usageLimit = input.usage_limit;
    const capQuantity = input.cap_quantity;
    const maxDiscountAmount = input.max_discount_amount;
    const capDiscountAmount = input.cap_discount_amount;
    const limitPerCustomer = input.limit_per_customer ?? false;
    const customerUsageLimit = input.customer_usage_limit;
    const customerUsageDailyReset = input.customer_usage_daily_reset ?? false;

    // Validate cap_quantity only if it is set (not null/undefined); null means no cap
    if (capQuantity !== null && capQuantity !== undefined && capQuantity > 0) {
      if (capQuantity < minQuantity) {
        throw new BadRequestException(
          'cap_quantity must be greater than or equal to min_quantity',
        );
      }
    }

    // Validate cap_discount_amount only if both it and max_discount_amount are set; null means no cap
    if (
      maxDiscountAmount !== null &&
      maxDiscountAmount !== undefined &&
      capDiscountAmount !== null &&
      capDiscountAmount !== undefined &&
      capDiscountAmount > maxDiscountAmount
    ) {
      throw new BadRequestException(
        'cap_discount_amount cannot be greater than max_discount_amount',
      );
    }

    if (limitPerCustomer && (!customerUsageLimit || customerUsageLimit < 1)) {
      throw new BadRequestException(
        'customer_usage_limit is required when limit_per_customer is true',
      );
    }

    if (!limitPerCustomer && customerUsageDailyReset) {
      throw new BadRequestException(
        'customer_usage_daily_reset requires limit_per_customer to be true',
      );
    }

    const variantIds = Array.from(new Set(input.variant_ids || []));
    const branchIds = Array.from(new Set(input.branch_ids || []));

    if (input.branch_specific && branchIds.length === 0) {
      throw new BadRequestException(
        'branch_ids is required when branch_specific is true',
      );
    }

    if (branchIds.length > 0) {
      const branchCount = await this.prisma.branch.count({
        where: {
          id: { in: branchIds },
          consumer_id: consumerId,
        },
      });

      if (branchCount !== branchIds.length) {
        throw new BadRequestException(
          'One or more selected branches are invalid for this consumer',
        );
      }
    }

    if (input.scope === PromotionScope.BRAND) {
      if (!input.brand_id) {
        throw new BadRequestException(
          'brand_id is required for BRAND promotions',
        );
      }

      if (variantIds.length > 0) {
        throw new BadRequestException(
          'variant_ids should not be provided for BRAND promotions',
        );
      }

      const brand = await this.prisma.brand.findFirst({
        where: {
          id: input.brand_id,
          consumer_id: consumerId,
        },
      });

      if (!brand) {
        throw new BadRequestException('Selected brand is invalid');
      }
    } else {
      if (variantIds.length === 0) {
        throw new BadRequestException(
          'variant_ids is required for SINGLE_PRODUCT or BUNDLE promotions',
        );
      }

      if (
        input.scope === PromotionScope.SINGLE_PRODUCT &&
        variantIds.length !== 1
      ) {
        throw new BadRequestException(
          'SINGLE_PRODUCT promotions must have exactly one variant_id',
        );
      }

      const variantCount = await this.prisma.productVariant.count({
        where: {
          id: { in: variantIds },
          product: {
            consumer_id: consumerId,
          },
        },
      });

      if (variantCount !== variantIds.length) {
        throw new BadRequestException(
          'One or more selected variants are invalid for this consumer',
        );
      }
    }

    return {
      scope: input.scope,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      start_date: startDate,
      end_date: endDate,
      is_active: input.is_active ?? true,
      min_purchase: input.min_purchase,
      min_quantity: minQuantity,
      usage_limit: usageLimit,
      cap_quantity: capQuantity,
      max_discount_amount: maxDiscountAmount,
      cap_discount_amount: capDiscountAmount,
      member_only: input.member_only ?? false,
      limit_per_customer: limitPerCustomer,
      customer_usage_limit: limitPerCustomer ? customerUsageLimit : null,
      customer_usage_daily_reset: limitPerCustomer
        ? customerUsageDailyReset
        : false,
      auto_apply: input.auto_apply ?? false,
      branch_specific: input.branch_specific ?? false,
      brand_id: input.scope === PromotionScope.BRAND ? input.brand_id : null,
      variant_ids: input.scope === PromotionScope.BRAND ? [] : variantIds,
      branch_ids: input.branch_specific ? branchIds : [],
    };
  }

  async create(dto: CreatePromotionDto, consumerId: number, userId: number) {
    try {
      const validated = await this.validatePromotionRules(dto, consumerId);

      const createData: any = {
        consumer_id: consumerId,
        created_by_user_id: userId,
        name: dto.name,
        description: dto.description,
        scope: validated.scope,
        discount_type: validated.discount_type,
        discount_value: validated.discount_value,
        start_date: validated.start_date,
        end_date: validated.end_date,
        is_active: validated.is_active,
        min_purchase: validated.min_purchase,
        min_quantity: validated.min_quantity,
        usage_limit: validated.usage_limit,
        cap_quantity: validated.cap_quantity,
        max_discount_amount: validated.max_discount_amount,
        cap_discount_amount: validated.cap_discount_amount,
        member_only: validated.member_only,
        limit_per_customer: validated.limit_per_customer,
        customer_usage_limit: validated.customer_usage_limit,
        customer_usage_daily_reset: validated.customer_usage_daily_reset,
        auto_apply: validated.auto_apply,
        branch_specific: validated.branch_specific,
        brand_id: validated.brand_id,
        products: validated.variant_ids.length
          ? {
              createMany: {
                data: validated.variant_ids.map((variantId) => ({
                  variant_id: variantId,
                })),
              },
            }
          : undefined,
        branches: validated.branch_ids.length
          ? {
              createMany: {
                data: validated.branch_ids.map((branchId) => ({
                  branch_id: branchId,
                })),
              },
            }
          : undefined,
      };

      const created = await this.prisma.promotion.create({
        data: createData,
        include: this.promotionInclude,
      });

      const summaryMap = await this.getPromotionSalesSummary([created.id]);
      return this.mapPromotion(created, summaryMap);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create promotion');
    }
  }

  async findAll(consumerId: number) {
    try {
      const promotions = await this.prisma.promotion.findMany({
        where: {
          consumer_id: consumerId,
        },
        include: this.promotionInclude,
        orderBy: {
          created_at: 'desc',
        },
      });

      const summaryMap = await this.getPromotionSalesSummary(
        promotions.map((promotion) => promotion.id),
      );

      return promotions.map((promotion) =>
        this.mapPromotion(promotion, summaryMap),
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch promotions');
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
      const promotion = await this.ensurePromotionOwnedByConsumer(
        id,
        consumerId,
      );
      const summaryMap = await this.getPromotionSalesSummary([promotion.id]);
      return this.mapPromotion(promotion, summaryMap);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch promotion');
    }
  }

  async update(id: number, updateDto: UpdatePromotionDto, consumerId: number) {
    try {
      const existing = await this.ensurePromotionOwnedByConsumer(
        id,
        consumerId,
      );

      const merged: CreatePromotionDto = {
        name: updateDto.name ?? existing.name,
        description: updateDto.description ?? existing.description ?? undefined,
        scope: (updateDto.scope ?? existing.scope) as PromotionScope,
        discount_type: (updateDto.discount_type ??
          existing.discount_type) as PromotionDiscountType,
        discount_value:
          updateDto.discount_value ?? this.toNumber(existing.discount_value),
        start_date: updateDto.start_date ?? existing.start_date.toISOString(),
        end_date:
          updateDto.end_date === undefined
            ? existing.end_date?.toISOString()
            : updateDto.end_date,
        is_active: updateDto.is_active ?? existing.is_active,
        min_purchase:
          updateDto.min_purchase === undefined
            ? existing.min_purchase !== null &&
              existing.min_purchase !== undefined
              ? this.toNumber(existing.min_purchase)
              : undefined
            : updateDto.min_purchase,
        min_quantity: updateDto.min_quantity ?? existing.min_quantity ?? 1,
        usage_limit:
          updateDto.usage_limit === undefined
            ? (existing.usage_limit ?? undefined)
            : updateDto.usage_limit,
        cap_quantity:
          updateDto.cap_quantity === undefined
            ? (existing.cap_quantity ?? undefined)
            : updateDto.cap_quantity,
        max_discount_amount:
          updateDto.max_discount_amount === undefined
            ? existing.max_discount_amount !== null &&
              existing.max_discount_amount !== undefined
              ? this.toNumber(existing.max_discount_amount)
              : undefined
            : updateDto.max_discount_amount,
        cap_discount_amount:
          updateDto.cap_discount_amount === undefined
            ? existing.cap_discount_amount !== null &&
              existing.cap_discount_amount !== undefined
              ? this.toNumber(existing.cap_discount_amount)
              : undefined
            : updateDto.cap_discount_amount,
        member_only: updateDto.member_only ?? existing.member_only,
        limit_per_customer:
          updateDto.limit_per_customer ?? existing.limit_per_customer,
        customer_usage_limit:
          updateDto.customer_usage_limit === undefined
            ? (existing.customer_usage_limit ?? undefined)
            : updateDto.customer_usage_limit,
        customer_usage_daily_reset:
          updateDto.customer_usage_daily_reset ??
          existing.customer_usage_daily_reset,
        auto_apply: updateDto.auto_apply ?? existing.auto_apply,
        branch_specific: updateDto.branch_specific ?? existing.branch_specific,
        branch_ids:
          updateDto.branch_ids ??
          existing.branches.map((branch) => branch.branch_id),
        variant_ids:
          updateDto.variant_ids ??
          existing.products.map((product) => product.variant_id),
        brand_id:
          updateDto.brand_id === undefined
            ? (existing.brand_id ?? undefined)
            : updateDto.brand_id,
      };

      const validated = await this.validatePromotionRules(merged, consumerId);

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.promotionProduct.deleteMany({ where: { promotion_id: id } });
        await tx.promotionBranch.deleteMany({ where: { promotion_id: id } });

        return (tx.promotion as any).update({
          where: { id },
          data: {
            name: merged.name,
            description: merged.description,
            scope: validated.scope,
            discount_type: validated.discount_type,
            discount_value: validated.discount_value,
            start_date: validated.start_date,
            end_date: validated.end_date,
            is_active: validated.is_active,
            min_purchase: validated.min_purchase,
            min_quantity: validated.min_quantity,
            usage_limit: validated.usage_limit,
            cap_quantity: validated.cap_quantity,
            max_discount_amount: validated.max_discount_amount,
            cap_discount_amount: validated.cap_discount_amount,
            member_only: validated.member_only,
            limit_per_customer: validated.limit_per_customer,
            customer_usage_limit: validated.customer_usage_limit,
            customer_usage_daily_reset: validated.customer_usage_daily_reset,
            auto_apply: validated.auto_apply,
            branch_specific: validated.branch_specific,
            brand_id: validated.brand_id,
            products: validated.variant_ids.length
              ? {
                  createMany: {
                    data: validated.variant_ids.map((variantId) => ({
                      variant_id: variantId,
                    })),
                  },
                }
              : undefined,
            branches: validated.branch_ids.length
              ? {
                  createMany: {
                    data: validated.branch_ids.map((branchId) => ({
                      branch_id: branchId,
                    })),
                  },
                }
              : undefined,
          } as any,
          include: this.promotionInclude,
        });
      });

      const summaryMap = await this.getPromotionSalesSummary([updated.id]);
      return this.mapPromotion(updated, summaryMap);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update promotion');
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      await this.ensurePromotionOwnedByConsumer(id, consumerId);

      await this.prisma.promotion.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete promotion');
    }
  }

  async getOptions(consumerId: number) {
    try {
      const [branches, brands, variants] = await Promise.all([
        this.prisma.branch.findMany({
          where: { consumer_id: consumerId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.brand.findMany({
          where: { consumer_id: consumerId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.productVariant.findMany({
          where: {
            product: {
              consumer_id: consumerId,
            },
          },
          select: {
            id: true,
            name: true,
            sku: true,
            regular_price: true,
            product: {
              select: {
                id: true,
                name: true,
                brand_id: true,
              },
            },
          },
          orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
        }),
      ]);

      return {
        branches,
        brands,
        variants: variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          regular_price: this.toNumber(variant.regular_price),
          product_id: variant.product.id,
          product_name: variant.product.name,
          brand_id: variant.product.brand_id,
        })),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch promotion options',
      );
    }
  }

  async findActive(consumerId: number, branchId?: number) {
    try {
      const now = new Date();

      const where: any = {
        consumer_id: consumerId,
        is_active: true,
        start_date: {
          lte: now,
        },
        OR: [{ end_date: null }, { end_date: { gte: now } }],
      };

      if (branchId) {
        where.AND = [
          {
            OR: [
              { branch_specific: false },
              {
                branches: {
                  some: {
                    branch_id: branchId,
                  },
                },
              },
            ],
          },
        ];
      }

      const promotions = await this.prisma.promotion.findMany({
        where,
        include: this.promotionInclude,
        orderBy: [{ auto_apply: 'desc' }, { created_at: 'desc' }],
      });

      const evaluations = await Promise.all(
        promotions.map(async (promotion) => {
          const usageLimit =
            promotion.usage_limit !== null &&
            promotion.usage_limit !== undefined
              ? this.toNumber(promotion.usage_limit)
              : null;
          const maxDiscountAmount =
            promotion.max_discount_amount !== null &&
            promotion.max_discount_amount !== undefined
              ? this.toNumber(promotion.max_discount_amount)
              : null;

          if (usageLimit === null && maxDiscountAmount === null) {
            return { promotion, exhausted: false };
          }

          const usage = await this.getPromotionUsage(
            promotion.id,
            consumerId,
          );
          const reachedUsageLimit =
            usageLimit !== null && usage.usedUsageCount >= usageLimit;
          const reachedDiscountLimit =
            maxDiscountAmount !== null &&
            usage.usedDiscountAmount >= maxDiscountAmount;

          return {
            promotion,
            exhausted: reachedUsageLimit || reachedDiscountLimit,
          };
        }),
      );

      const exhaustedIds = evaluations
        .filter((evaluation) => evaluation.exhausted)
        .map((evaluation) => evaluation.promotion.id);

      if (exhaustedIds.length > 0) {
        await this.prisma.promotion.updateMany({
          where: {
            consumer_id: consumerId,
            id: { in: exhaustedIds },
            is_active: true,
          },
          data: {
            is_active: false,
          },
        });
      }

      const activePromotions = evaluations
        .filter((evaluation) => !evaluation.exhausted)
        .map((evaluation) => evaluation.promotion);

      const summaryMap = await this.getPromotionSalesSummary(
        activePromotions.map((promotion) => promotion.id),
      );

      return activePromotions.map((promotion) =>
        this.mapPromotion(promotion, summaryMap),
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch active promotions',
      );
    }
  }

  private calculateDiscount(
    discountType: string,
    discountValue: number,
    base: number,
    capDiscountAmount?: number | null,
  ) {
    if (base <= 0) return 0;

    let discount = 0;

    if (discountType === PromotionDiscountType.PERCENTAGE) {
      discount = (base * discountValue) / 100;
    } else {
      discount = discountValue;
    }

    if (
      capDiscountAmount !== null &&
      capDiscountAmount !== undefined &&
      capDiscountAmount > 0
    ) {
      discount = Math.min(discount, capDiscountAmount);
    }

    return Math.min(base, discount);
  }

  private calculateBaseWithQuantityLimit(
    items: Array<{ quantity: number; subtotal: number }>,
    quantityLimit?: number | null,
  ) {
    const totalBase = items.reduce((sum, item) => sum + item.subtotal, 0);

    if (!quantityLimit || quantityLimit <= 0) {
      return totalBase;
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity <= quantityLimit) {
      return totalBase;
    }

    let remaining = quantityLimit;
    let base = 0;

    const sorted = [...items].sort((a, b) => {
      const aPerUnit = a.quantity > 0 ? a.subtotal / a.quantity : 0;
      const bPerUnit = b.quantity > 0 ? b.subtotal / b.quantity : 0;
      return bPerUnit - aPerUnit;
    });

    for (const item of sorted) {
      if (remaining <= 0) {
        break;
      }

      const takeQty = Math.min(item.quantity, remaining);
      const perUnit = item.quantity > 0 ? item.subtotal / item.quantity : 0;
      base += perUnit * takeQty;
      remaining -= takeQty;
    }

    return base;
  }

  private async getPromotionUsage(promotionId: number, consumerId: number) {
    const [discountAgg, usageCount] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          consumer_id: consumerId,
          promotion_id: promotionId,
          sale_type: 'sale',
          payment_status: { not: 'cancelled' },
        },
        _sum: {
          promotion_discount: true,
        },
      }),
      this.prisma.sale.count({
        where: {
          consumer_id: consumerId,
          promotion_id: promotionId,
          sale_type: 'sale',
          payment_status: { not: 'cancelled' },
        },
      }),
    ]);

    return {
      usedDiscountAmount: this.toNumber(discountAgg._sum?.promotion_discount),
      usedUsageCount: this.toNumber(usageCount),
    };
  }

  private async getCustomerPromotionUsageCount(
    promotionId: number,
    consumerId: number,
    customerId: number,
    dailyReset: boolean,
  ) {
    const where: any = {
      consumer_id: consumerId,
      promotion_id: promotionId,
      customer_id: customerId,
      sale_type: 'sale',
      payment_status: { not: 'cancelled' },
    };

    if (dailyReset) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      where.sale_date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    return this.prisma.sale.count({ where });
  }

  async closePromotionIfExhausted(promotionId: number, consumerId: number) {
    try {
      const promotion = await this.prisma.promotion.findFirst({
        where: {
          id: promotionId,
          consumer_id: consumerId,
        },
      });

      if (!promotion) {
        return;
      }

      const usage = await this.getPromotionUsage(promotion.id, consumerId);
      const usageLimit =
        promotion.usage_limit !== null && promotion.usage_limit !== undefined
          ? this.toNumber(promotion.usage_limit)
          : null;
      const maxDiscountAmount =
        promotion.max_discount_amount !== null &&
        promotion.max_discount_amount !== undefined
          ? this.toNumber(promotion.max_discount_amount)
          : null;

      const reachedMaxQuantity =
        usageLimit !== null && usage.usedUsageCount >= usageLimit;
      const reachedMaxDiscount =
        maxDiscountAmount !== null &&
        usage.usedDiscountAmount >= maxDiscountAmount;

      if (promotion.is_active && (reachedMaxQuantity || reachedMaxDiscount)) {
        await this.prisma.promotion.update({
          where: { id: promotion.id },
          data: { is_active: false },
        });
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to close exhausted promotion',
      );
    }
  }

  private async evaluatePromotionForCart(
    promotionId: number,
    consumerId: number,
    payload: ValidatePromotionDto,
  ) {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        id: promotionId,
        consumer_id: consumerId,
      },
      include: {
        products: true,
        branches: true,
      },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    if (!promotion.is_active) {
      return {
        is_eligible: false,
        reason: 'Promotion is inactive',
      };
    }

    const now = new Date();
    if (promotion.start_date > now) {
      return {
        is_eligible: false,
        reason: 'Promotion has not started yet',
      };
    }

    if (promotion.end_date && promotion.end_date < now) {
      return {
        is_eligible: false,
        reason: 'Promotion has already expired',
      };
    }

    if (promotion.branch_specific) {
      const branchAllowed = promotion.branches.some(
        (branch) => branch.branch_id === payload.branch_id,
      );

      if (!branchAllowed) {
        return {
          is_eligible: false,
          reason: 'Promotion is not available for selected branch',
        };
      }
    }

    const usage = await this.getPromotionUsage(promotion.id, consumerId);
    const usageLimit =
      promotion.usage_limit !== null && promotion.usage_limit !== undefined
        ? this.toNumber(promotion.usage_limit)
        : null;
    const capQuantity =
      promotion.cap_quantity !== null && promotion.cap_quantity !== undefined
        ? this.toNumber(promotion.cap_quantity)
        : null;
    const maxDiscountAmount =
      promotion.max_discount_amount !== null &&
      promotion.max_discount_amount !== undefined
        ? this.toNumber(promotion.max_discount_amount)
        : null;
    const capDiscountAmount =
      promotion.cap_discount_amount !== null &&
      promotion.cap_discount_amount !== undefined
        ? this.toNumber(promotion.cap_discount_amount)
        : null;

    const reachedMaxQuantity =
      usageLimit !== null && usage.usedUsageCount >= usageLimit;
    const reachedMaxDiscount =
      maxDiscountAmount !== null &&
      usage.usedDiscountAmount >= maxDiscountAmount;

    if (reachedMaxQuantity || reachedMaxDiscount) {
      if (promotion.is_active) {
        await this.prisma.promotion.update({
          where: { id: promotion.id },
          data: { is_active: false },
        });
      }

      return {
        is_eligible: false,
        reason: reachedMaxQuantity
          ? 'Promotion usage limit reached and promo closed'
          : 'Promotion max discount reached and promo closed',
      };
    }

    const remainingDiscountLimit =
      maxDiscountAmount !== null
        ? Math.max(0, maxDiscountAmount - usage.usedDiscountAmount)
        : null;

    const effectiveQuantityLimit = capQuantity !== null ? capQuantity : null;

    if (promotion.member_only && !payload.customer_id) {
      return {
        is_eligible: false,
        reason: 'This promotion is for registered customers only',
      };
    }

    if (promotion.limit_per_customer) {
      if (!payload.customer_id) {
        return {
          is_eligible: false,
          reason: 'Select a registered customer to apply this promotion',
        };
      }

      const usageLimit = this.toNumber(promotion.customer_usage_limit || 0);
      if (usageLimit > 0) {
        const customerUsage = await this.getCustomerPromotionUsageCount(
          promotion.id,
          consumerId,
          payload.customer_id,
          Boolean(promotion.customer_usage_daily_reset),
        );

        if (customerUsage >= usageLimit) {
          return {
            is_eligible: false,
            reason: promotion.customer_usage_daily_reset
              ? 'Customer daily usage limit reached for this promotion'
              : 'Customer usage limit reached for this promotion',
          };
        }
      }
    }

    const cartMap = new Map<
      number,
      { quantity: number; subtotal: number; unit_price: number }
    >();

    for (const item of payload.items) {
      const existing = cartMap.get(item.variant_id);
      const subtotal =
        this.toNumber(item.line_total) || item.unit_price * item.quantity;

      if (existing) {
        cartMap.set(item.variant_id, {
          quantity: existing.quantity + item.quantity,
          subtotal: existing.subtotal + subtotal,
          unit_price: item.unit_price,
        });
      } else {
        cartMap.set(item.variant_id, {
          quantity: item.quantity,
          subtotal,
          unit_price: item.unit_price,
        });
      }
    }

    const cartSubtotal = Array.from(cartMap.values()).reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    if (
      promotion.min_purchase !== null &&
      promotion.min_purchase !== undefined &&
      cartSubtotal < this.toNumber(promotion.min_purchase)
    ) {
      return {
        is_eligible: false,
        reason: 'Minimum purchase amount condition not met',
      };
    }

    const minQuantity = promotion.min_quantity || 1;

    if (promotion.scope === PromotionScope.BRAND) {
      if (!promotion.brand_id) {
        return {
          is_eligible: false,
          reason: 'Promotion brand is not configured correctly',
        };
      }

      const variantIds = Array.from(cartMap.keys());
      const variants = await this.prisma.productVariant.findMany({
        where: {
          id: { in: variantIds },
          product: {
            consumer_id: consumerId,
          },
        },
        select: {
          id: true,
          product: {
            select: {
              brand_id: true,
            },
          },
        },
      });

      const matchedVariantIds = variants
        .filter((variant) => variant.product.brand_id === promotion.brand_id)
        .map((variant) => variant.id);

      if (!matchedVariantIds.length) {
        return {
          is_eligible: false,
          reason: 'No matching brand products found in cart',
        };
      }

      const totalQty = matchedVariantIds.reduce(
        (sum, variantId) => sum + (cartMap.get(variantId)?.quantity || 0),
        0,
      );

      if (totalQty < minQuantity) {
        return {
          is_eligible: false,
          reason: `Minimum quantity ${minQuantity} not met`,
        };
      }

      const matchedItems = matchedVariantIds
        .map((variantId) => cartMap.get(variantId))
        .filter(
          (
            item,
          ): item is {
            quantity: number;
            subtotal: number;
            unit_price: number;
          } => Boolean(item),
        );

      const discountBase = this.calculateBaseWithQuantityLimit(
        matchedItems,
        effectiveQuantityLimit,
      );

      const computedDiscount = this.calculateDiscount(
        promotion.discount_type,
        this.toNumber(promotion.discount_value),
        discountBase,
        capDiscountAmount,
      );

      const discountAmount =
        remainingDiscountLimit !== null
          ? Math.min(computedDiscount, remainingDiscountLimit)
          : computedDiscount;

      if (discountAmount <= 0) {
        return {
          is_eligible: false,
          reason: 'Promotion max discount reached and promo closed',
        };
      }

      return {
        is_eligible: true,
        discount_amount: Number(discountAmount.toFixed(2)),
        discount_base: Number(discountBase.toFixed(2)),
        matched_variant_ids: matchedVariantIds,
      };
    }

    const requiredVariantIds = promotion.products.map(
      (product) => product.variant_id,
    );

    if (!requiredVariantIds.length) {
      return {
        is_eligible: false,
        reason: 'Promotion has no products configured',
      };
    }

    if (promotion.scope === PromotionScope.SINGLE_PRODUCT) {
      const selectedVariantId = requiredVariantIds[0];
      const selected = cartMap.get(selectedVariantId);

      if (!selected) {
        return {
          is_eligible: false,
          reason: 'Required product is not present in cart',
        };
      }

      if (selected.quantity < minQuantity) {
        return {
          is_eligible: false,
          reason: `Minimum quantity ${minQuantity} not met`,
        };
      }

      const discountBase = this.calculateBaseWithQuantityLimit(
        [selected],
        effectiveQuantityLimit,
      );
      const computedDiscount = this.calculateDiscount(
        promotion.discount_type,
        this.toNumber(promotion.discount_value),
        discountBase,
        capDiscountAmount,
      );

      const discountAmount =
        remainingDiscountLimit !== null
          ? Math.min(computedDiscount, remainingDiscountLimit)
          : computedDiscount;

      if (discountAmount <= 0) {
        return {
          is_eligible: false,
          reason: 'Promotion max discount reached and promo closed',
        };
      }

      return {
        is_eligible: true,
        discount_amount: Number(discountAmount.toFixed(2)),
        discount_base: Number(discountBase.toFixed(2)),
        matched_variant_ids: [selectedVariantId],
      };
    }

    const missingVariant = requiredVariantIds.find(
      (variantId) => !cartMap.has(variantId),
    );

    if (missingVariant) {
      return {
        is_eligible: false,
        reason: 'Bundle conditions are not matched in cart',
      };
    }

    const totalQty = requiredVariantIds.reduce(
      (sum, variantId) => sum + (cartMap.get(variantId)?.quantity || 0),
      0,
    );

    if (totalQty < minQuantity) {
      return {
        is_eligible: false,
        reason: `Minimum quantity ${minQuantity} not met`,
      };
    }

    const matchedItems = requiredVariantIds
      .map((variantId) => cartMap.get(variantId))
      .filter(
        (
          item,
        ): item is { quantity: number; subtotal: number; unit_price: number } =>
          Boolean(item),
      );

    const discountBase = this.calculateBaseWithQuantityLimit(
      matchedItems,
      effectiveQuantityLimit,
    );

    const computedDiscount = this.calculateDiscount(
      promotion.discount_type,
      this.toNumber(promotion.discount_value),
      discountBase,
      capDiscountAmount,
    );

    const discountAmount =
      remainingDiscountLimit !== null
        ? Math.min(computedDiscount, remainingDiscountLimit)
        : computedDiscount;

    if (discountAmount <= 0) {
      return {
        is_eligible: false,
        reason: 'Promotion max discount reached and promo closed',
      };
    }

    return {
      is_eligible: true,
      discount_amount: Number(discountAmount.toFixed(2)),
      discount_base: Number(discountBase.toFixed(2)),
      matched_variant_ids: requiredVariantIds,
    };
  }

  async validateCart(
    promotionId: number,
    payload: ValidatePromotionDto,
    consumerId: number,
  ) {
    try {
      const evaluation = await this.evaluatePromotionForCart(
        promotionId,
        consumerId,
        payload,
      );

      return {
        promotion_id: promotionId,
        ...evaluation,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to validate cart promotion');
    }
  }

  async assertAndCalculateDiscount(
    promotionId: number,
    consumerId: number,
    branchId: number,
    customerId: number | undefined,
    items: Array<{
      variant_id: number;
      quantity: number;
      unit_price: number;
      line_total: number;
    }>,
  ) {
    try {
      const evaluation = await this.evaluatePromotionForCart(
        promotionId,
        consumerId,
        {
          branch_id: branchId,
          customer_id: customerId,
          items,
        },
      );

      if (!evaluation.is_eligible) {
        throw new BadRequestException(
          evaluation.reason ||
            'Promotion conditions are not matched for this sale',
        );
      }

      return evaluation;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to assert and calculate discount',
      );
    }
  }

  async getPromotionSales(
    promotionId: number,
    filters: PromotionSalesFiltersDto,
    consumerId: number,
  ) {
    try {
      await this.ensurePromotionOwnedByConsumer(promotionId, consumerId);

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        consumer_id: consumerId,
        promotion_id: promotionId,
        sale_type: 'sale',
      };

      if (filters.date_from || filters.date_to) {
        where.sale_date = {};
        if (filters.date_from) {
          where.sale_date.gte = new Date(filters.date_from);
        }
        if (filters.date_to) {
          where.sale_date.lte = new Date(filters.date_to);
        }
      }

      const [rows, total, summary] = await Promise.all([
        (this.prisma.sale as any).findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            sale_date: 'desc',
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        (this.prisma.sale as any).count({ where }),
        (this.prisma.sale as any).aggregate({
          where,
          _sum: {
            discount_amount: true,
            total_amount: true,
          },
        }),
      ]);

      return {
        data: rows,
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
        summary: {
          total_discount_amount: this.toNumber(summary._sum?.discount_amount),
          total_sales_amount: this.toNumber(summary._sum?.total_amount),
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch promotion sales');
    }
  }
}