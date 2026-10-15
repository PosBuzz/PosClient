import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { collectBatchLocations } from '../../inventory/utils/batch-location.util';
import { Prisma } from '@prisma/client';
import {
  CreateSaleDto,
  PaymentStatus,
  PriceType,
  SaleType,
} from '../dto/create-sale.dto';
import { assertSaleLineMatchesCatalog } from '../utils/sale-pricing.util';
import {
  SaleListFiltersDto,
  SaleRecordStatus,
} from '../dto/sale-list-filters.dto';
import { DeleteSaleDto } from '../dto/delete-sale.dto';
import { UpdateSaleNoteDto } from '../dto/update-sale-note.dto';
import {
  DailyTargetReportDto,
  DailyTargetReportResponse,
  DailyTargetRow,
} from '../dto/daily-target-report.dto';
import {
  EODReportDto,
  EODReportResponse,
  PaymentMethodBreakdown,
  ProductSalesStats,
  EODSummary,
} from '../dto/eod-report.dto';
import { RewardsService } from '../../../consumer/rewards/services/rewards.service';
import { PromotionsService } from '../../promotions/services/promotions.service';
import { QuotationPdfService } from 'src/consumer/receipt-pdf/services/quotation-pdf.service';
import { errorStack } from '../../../common/utils/error.util';
import { toLocalDateString } from '../../../common/utils/business-time.util';
import { lockDocumentNumbering } from '../../../common/utils/document-number-lock.util';
import {
  reserveAvailableStock,
  takeAvailableStock,
  takeReservedStock,
} from '../../inventory/utils/stock-mutation.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);
  constructor(
    private prisma: PrismaService,
    private rewardsService: RewardsService,
    _quotationPdfService: QuotationPdfService,
    private promotionsService: PromotionsService,
  ) {}
  private async attachAppliedPromotions<T extends { items?: any[] }>(
    sale: T,
    consumerId: number,
  ): Promise<T> {
    if (!sale.items?.length) {
      return sale;
    }

    const appliedPromotionIds = Array.from(
      new Set(
        sale.items
          .map((item) => item.applied_promotion_id)
          .filter(
            (promotionId) => promotionId !== null && promotionId !== undefined,
          )
          .map((promotionId) => Number(promotionId)),
      ),
    );

    if (appliedPromotionIds.length === 0) {
      return sale;
    }

    const promotions = await this.prisma.promotion.findMany({
      where: {
        id: { in: appliedPromotionIds },
        consumer_id: consumerId,
      },
      select: {
        id: true,
        name: true,
        scope: true,
        discount_type: true,
        discount_value: true,
      },
    });

    const promotionMap = new Map(
      promotions.map((promotion) => [promotion.id, promotion]),
    );

    return {
      ...sale,
      items: sale.items.map((item) => ({
        ...item,
        applied_promotion: item.applied_promotion_id
          ? promotionMap.get(Number(item.applied_promotion_id)) || null
          : null,
      })),
    };
  }

  /**
   * Sales rows are never rewritten when a return happens — returns are recorded
   * separately and surfaced alongside the sale. This attaches, per sale:
   *  - return_summary: refund/exchange totals + whether it is fully returned
   *  - items[].returned_quantity
   */
  private async attachReturnSummaries<
    T extends { id: number; items?: any[]; total_amount?: any },
  >(sales: T[]): Promise<T[]> {
    if (!sales.length) return sales;

    const saleIds = sales.map((sale) => sale.id);

    const [returns, returnedByItem] = await Promise.all([
      this.prisma.return.findMany({
        where: { original_sale_id: { in: saleIds } },
        select: {
          id: true,
          return_number: true,
          return_date: true,
          total_refund: true,
          total_exchange: true,
          reason: true,
          original_sale_id: true,
        },
        orderBy: { return_date: 'desc' },
      }),
      this.prisma.returnItem.groupBy({
        by: ['sale_item_id'],
        where: { return_record: { original_sale_id: { in: saleIds } } },
        _sum: { quantity: true },
      }),
    ]);

    const returnsBySale = new Map<number, typeof returns>();
    for (const returnRecord of returns) {
      const existing = returnsBySale.get(returnRecord.original_sale_id) || [];
      existing.push(returnRecord);
      returnsBySale.set(returnRecord.original_sale_id, existing);
    }

    const returnedQtyByItem = new Map(
      returnedByItem.map((row) => [row.sale_item_id, row._sum.quantity || 0]),
    );

    return sales.map((sale) => {
      const saleReturns = returnsBySale.get(sale.id) || [];

      const items = sale.items?.map((item) => ({
        ...item,
        returned_quantity: returnedQtyByItem.get(item.id) || 0,
      }));

      const totalRefund = saleReturns.reduce(
        (sum, record) => sum + Number(record.total_refund),
        0,
      );
      const totalExchange = saleReturns.reduce(
        (sum, record) => sum + Number(record.total_exchange),
        0,
      );

      const fullyReturned =
        !!items?.length &&
        items.every((item) => item.returned_quantity >= item.quantity);

      return {
        ...sale,
        ...(items ? { items } : {}),
        returns: saleReturns.map(
          ({ original_sale_id: _original_sale_id, ...rest }) => rest,
        ),
        return_summary: {
          has_returns: saleReturns.length > 0,
          return_count: saleReturns.length,
          total_refund: totalRefund,
          total_exchange: totalExchange,
          // Sale total stays untouched; this is what it is worth after refunds
          net_amount: Number(sale.total_amount ?? 0) - totalRefund,
          status: !saleReturns.length
            ? 'none'
            : fullyReturned
              ? 'fully_returned'
              : 'partially_returned',
        },
      };
    });
  }

  async create(
    createSaleDto: CreateSaleDto,
    consumerId: number,
    userId: number,
  ) {
    try {
      if (!createSaleDto.items?.length) {
        throw new BadRequestException('A sale must contain at least one item');
      }

      // If quotation_id is provided, validate and mark quotation as converted
      if (createSaleDto.quotation_id) {
        const quotation = await this.prisma.sale.findFirst({
          where: {
            id: createSaleDto.quotation_id,
            consumer_id: consumerId,
            sale_type: SaleType.QUOTATION,
          },
        });

        if (!quotation) {
          throw new NotFoundException('Quotation not found');
        }

        if (quotation.converted_to_sale_id) {
          throw new BadRequestException(
            `Quotation has already been converted to sale #${quotation.converted_to_sale_id}`,
          );
        }
      }

      // Validate CREDIT payments before processing
      if (createSaleDto.payments) {
        const creditPayments = createSaleDto.payments.filter(
          (p) => p.payment_method === 'CREDIT',
        );

        if (creditPayments.length > 0 && !createSaleDto.customer_id) {
          throw new BadRequestException(
            'CREDIT payments require a customer account',
          );
        }

        for (const creditPayment of creditPayments) {
          const validation = await this.rewardsService.validateCreditPayment(
            consumerId,
            createSaleDto.customer_id!,
            Number(creditPayment.amount),
          );

          if (!validation.isValid) {
            throw new BadRequestException(
              `Credit payment validation failed: ${validation.reason}`,
            );
          }
        }
      }

      // Validate branch belongs to consumer
      const branch = await this.prisma.branch.findFirst({
        where: { id: createSaleDto.branch_id, consumer_id: consumerId },
      });

      if (!branch) {
        throw new BadRequestException('Branch not found or not accessible');
      }

      // Validate customer if provided
      if (createSaleDto.customer_id) {
        const customer = await this.prisma.customer.findFirst({
          where: { id: createSaleDto.customer_id, consumer_id: consumerId },
        });
        if (!customer) {
          throw new BadRequestException('Customer not found or not accessible');
        }
      }

      // Validate served_by user if provided
      if (createSaleDto.served_by_id) {
        const servedByUser = await this.prisma.user.findFirst({
          where: { id: createSaleDto.served_by_id, consumer_id: consumerId },
        });
        if (!servedByUser) {
          throw new BadRequestException(
            'Served by user not found or not accessible',
          );
        }
      }

      // Validate items and check stock (skip stock validation for quotations)
      const isQuotation = createSaleDto.sale_type === SaleType.QUOTATION;
      const validationResults = await Promise.all(
        createSaleDto.items.map(async (item) => {
          const variant = await this.prisma.productVariant.findFirst({
            where: {
              id: item.variant_id,
              product: { consumer_id: consumerId },
            },
            include: {
              inventory_items: {
                where: { branch_id: createSaleDto.branch_id },
              },
              product: { select: { tax: true, tax_method: true } },
            },
          });

          if (!variant) {
            throw new BadRequestException(
              `Product variant ${item.variant_id} not found`,
            );
          }

          // Prices and totals come from the client; make sure they are the
          // catalog's and not edited
          assertSaleLineMatchesCatalog(
            item,
            variant,
            createSaleDto.price_type === PriceType.WHOLESALE,
          );

          // Skip stock validation for quotations
          if (isQuotation) {
            return { ...item, selectedBatch: null };
          }

          // Check stock availability for sales
          let availableStock = 0;
          let selectedBatch: any = null;

          if (item.batch_id) {
            selectedBatch = variant.inventory_items.find(
              (batch) => batch.id === item.batch_id,
            );
            if (!selectedBatch) {
              throw new BadRequestException(
                `Batch ${item.batch_id} not found for variant ${item.variant_id}`,
              );
            }
            availableStock =
              selectedBatch.quantity - selectedBatch.reserved_quantity;
          } else {
            // Use FIFO (First In, First Out) - oldest batch first
            selectedBatch = variant.inventory_items
              .filter((batch) => batch.quantity - batch.reserved_quantity > 0)
              .sort(
                (a, b) => a.created_at.getTime() - b.created_at.getTime(),
              )[0];

            if (!selectedBatch) {
              throw new BadRequestException(
                `Insufficient stock for variant ${item.variant_id}. Available: 0, Requested: ${item.quantity}`,
              );
            }
            availableStock =
              selectedBatch.quantity - selectedBatch.reserved_quantity;
          }

          if (availableStock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for variant ${item.variant_id}. Available: ${availableStock}, Requested: ${item.quantity}`,
            );
          }

          return { ...item, selectedBatch };
        }),
      );

      // Calculate totals using frontend-calculated values
      let subtotal = 0;
      let totalTax = 0;

      subtotal = createSaleDto.items.reduce((sum, item) => {
        const itemDiscounts =
          (Number(item.average_discount_amount) || 0) +
          (Number(item.special_discount_amount) || 0) +
          (Number(item.promotion_discount_amount) || 0);
        const originalBase = Number(item.line_total) + itemDiscounts;
        return sum + (originalBase - Number(item.tax_amount || 0));
      }, 0);

      totalTax = createSaleDto.items.reduce(
        (sum, item) => sum + (Number(item.tax_amount) || 0),
        0,
      );

      const averageDiscountAmount = createSaleDto.items.reduce(
        (sum, item) => sum + (Number(item.average_discount_amount) || 0),
        0,
      );
      const specialDiscountAmount = createSaleDto.items.reduce(
        (sum, item) => sum + (Number(item.special_discount_amount) || 0),
        0,
      );
      const itemPromotionDiscountAmount = createSaleDto.items.reduce(
        (sum, item) => sum + (Number(item.promotion_discount_amount) || 0),
        0,
      );

      // Each promotion's discount spread over the lines may not exceed what the
      // server itself calculates for that promotion on this cart
      await this.assertItemPromotionDiscounts(createSaleDto, consumerId);

      let promotionDiscountAmount = 0;
      let promotionId: number | null = null;

      if (createSaleDto.applied_promotion_id) {
        const promotionEvaluation =
          await this.promotionsService.assertAndCalculateDiscount(
            createSaleDto.applied_promotion_id,
            consumerId,
            createSaleDto.branch_id,
            createSaleDto.customer_id,
            createSaleDto.items.map((item) => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              line_total: item.line_total,
            })),
          );

        promotionDiscountAmount =
          itemPromotionDiscountAmount ||
          Number(promotionEvaluation.discount_amount) ||
          0;
        promotionId = createSaleDto.applied_promotion_id;
      }

      if (!createSaleDto.applied_promotion_id) {
        promotionDiscountAmount = itemPromotionDiscountAmount;
      }

      const totalDiscountAmount =
        averageDiscountAmount + specialDiscountAmount + promotionDiscountAmount;
      const shippingCost = Number(createSaleDto.shipping_cost) || 0;

      // Round to cents like the stored Decimal(10,2) and the POS display; the
      // unrounded float sum made fully paid sales compare as partially paid.
      const totalAmount = Number(
        (subtotal - totalDiscountAmount + totalTax + shippingCost).toFixed(2),
      );

      // Calculate payment totals and determine payment status
      let totalPaymentAmount = 0;

      if (createSaleDto.payments && createSaleDto.payments.length > 0) {
        totalPaymentAmount = createSaleDto.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
      } else {
        totalPaymentAmount = 0;
      }

      // Determine payment status — "nothing paid" must be checked first, else a
      // fully unpaid sale falls into the PARTIAL branch and DUE is unreachable
      let paymentStatus = PaymentStatus.PAID;
      if (totalPaymentAmount === 0) {
        paymentStatus = PaymentStatus.DUE;
      } else if (totalPaymentAmount < totalAmount) {
        paymentStatus = PaymentStatus.PARTIAL;
      }

      // Create sale with items in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Number generation happens under a per-tenant lock so concurrent
        // sales cannot read the same latest number
        await lockDocumentNumbering(tx, 'sale', consumerId);
        const saleNumber =
          createSaleDto.sale_type === SaleType.QUOTATION
            ? await this.generateQuotationNumber(consumerId, tx)
            : await this.generateSaleNumber(consumerId, tx);

        // Create sale
        const sale = await tx.sale.create({
          data: {
            sale_number: saleNumber,
            consumer_id: consumerId,
            customer_id: createSaleDto.customer_id,
            customer_name: createSaleDto.customer_name,
            customer_phone: createSaleDto.customer_phone,
            customer_email: createSaleDto.customer_email,
            promotion_id: promotionId,
            branch_id: createSaleDto.branch_id,
            user_id: userId,
            served_by_id: createSaleDto.served_by_id ?? null,
            sale_type: createSaleDto.sale_type || SaleType.SALE,
            price_type: createSaleDto.price_type || 'regular',
            subtotal,
            discount_amount: totalDiscountAmount,
            promotion_discount: promotionDiscountAmount,
            shipping_cost: shippingCost,
            tax_amount: totalTax,
            total_amount: totalAmount,
            payment_status: paymentStatus,
            received_amount: totalPaymentAmount,
            notes: createSaleDto.notes,
            is_online_order: createSaleDto.is_online_order || false,
            online_order_status: createSaleDto.is_online_order
              ? createSaleDto.online_order_status || 'PENDING'
              : null,
            is_delivery_later: createSaleDto.is_delivery_later || false,
            delivery_status: createSaleDto.is_delivery_later ? 'PENDING' : null,
          },
        });

        // If converting from quotation, mark the quotation as converted
        if (createSaleDto.quotation_id) {
          // Conditional so two concurrent conversions cannot both succeed
          const marked = await tx.sale.updateMany({
            where: {
              id: createSaleDto.quotation_id,
              converted_to_sale_id: null,
            },
            data: {
              converted_to_sale_id: sale.id,
              converted_at: new Date(),
            },
          });
          if (marked.count !== 1) {
            throw new BadRequestException(
              'Quotation has already been converted to a sale',
            );
          }
        }

        // Create sale payments if using new system
        if (createSaleDto.payments && createSaleDto.payments.length > 0) {
          await Promise.all(
            createSaleDto.payments.map(async (payment) => {
              return tx.salePayment.create({
                data: {
                  sale_id: sale.id,
                  payment_method: payment.payment_method,
                  payment_type: payment.payment_type,
                  amount: payment.amount,
                  reference: payment.reference,
                },
              });
            }),
          );
        }

        // Redeem CREDIT (reward points) in the same transaction, so a sale is
        // never recorded as paid by points the customer was not charged
        if (createSaleDto.customer_id && createSaleDto.payments) {
          for (const payment of createSaleDto.payments) {
            if (payment.payment_method !== 'CREDIT') continue;
            await this.rewardsService.processCreditPayment(
              consumerId,
              createSaleDto.customer_id,
              Number(payment.amount),
              sale.id,
              payment.reference,
              tx,
            );
          }
        }

        // Create sale items and update inventory with audit logs. Sequential so
        // a failed stock check aborts the transaction before later writes run.
        for (const item of validationResults) {
          // Create sale item
          const saleItem = await tx.saleItem.create({
            data: {
              sale_id: sale.id,
              variant_id: item.variant_id,
              batch_id: item.selectedBatch?.id || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              sold_unit_price: item.sold_unit_price ?? null,
              average_discount_amount: item.average_discount_amount || 0,
              special_discount_amount: item.special_discount_amount || 0,
              promotion_discount_amount: item.promotion_discount_amount || 0,
              applied_promotion_id: item.applied_promotion_id || null,
              tax_amount: item.tax_amount || 0,
              line_total: item.line_total,
            },
          });

          // Only update inventory for actual sales, not quotations
          if (!isQuotation && item.selectedBatch) {
            // Atomic check-and-update: the availability check above ran
            // outside this transaction, so a concurrent sale may have taken
            // the stock since then
            const updatedBatch = createSaleDto.is_delivery_later
              ? await reserveAvailableStock(
                  tx,
                  item.selectedBatch.id,
                  item.quantity,
                )
              : await takeAvailableStock(
                  tx,
                  item.selectedBatch.id,
                  item.quantity,
                );

            if (!updatedBatch) {
              throw new BadRequestException(
                `Insufficient stock for variant ${item.variant_id}. Stock changed while the sale was being saved; please try again.`,
              );
            }

            if (!createSaleDto.is_delivery_later) {
              await tx.inventoryAuditLog.create({
                data: {
                  consumer_id: consumerId,
                  branch_id: createSaleDto.branch_id,
                  variant_id: item.variant_id,
                  batch_id: item.selectedBatch.id,
                  inventoryBatchId: item.selectedBatch.id,
                  event_type: 'SALE_OUT',
                  quantity_delta: -item.quantity,
                  quantity_after: updatedBatch.quantity,
                  reference_id: saleItem.id,
                  reference_type: 'sale_items',
                  notes: `Sale #${saleNumber} - Qty: ${item.quantity}`,
                  created_by_user_id: userId,
                },
              });
            }
          }
        }

        return sale;
      });

      if (promotionId) {
        await this.promotionsService.closePromotionIfExhausted(
          promotionId,
          consumerId,
        );
      }

      // Award rewards points if sale is completed and customer is provided
      if (
        result.customer_id &&
        result.payment_status === 'paid' &&
        result.sale_type === 'sale'
      ) {
        try {
          const creditPaymentAmount =
            createSaleDto.payments
              ?.filter((payment) => payment.payment_method === 'CREDIT')
              .reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;

          const rewardEligibleAmount =
            Number(result.total_amount) - creditPaymentAmount;

          if (rewardEligibleAmount > 0) {
            await this.rewardsService.earnPoints(
              consumerId,
              result.customer_id,
              result.id,
              rewardEligibleAmount,
            );
          }
        } catch (error) {
          console.error('Failed to award rewards points:', error);
        }
      }

      // Return created sale/quotation with full details
      if (isQuotation) {
        return await this.findOneQuotation(result.id, consumerId);
      } else {
        return await this.findOne(result.id, consumerId);
      }
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      this.logger.error(
        `Error creating sale for consumer ${consumerId} and user ${userId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create sale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(filters: SaleListFiltersDto, consumerId: number) {
    const {
      page = 1,
      limit = 20,
      search,
      branch_id,
      payment_method,
      payment_status,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'desc',
      source,
      status = SaleRecordStatus.ACTIVE,
    } = filters;

    try {
      const skip = (page - 1) * limit;

      const where: any = {
        consumer_id: consumerId,
        sale_type: SaleType.SALE, // Only return actual sales, not quotations
        deleted_at: status === SaleRecordStatus.DELETED ? { not: null } : null,
      };

      if (search) {
        where.OR = [
          { sale_number: { contains: search, mode: 'insensitive' } },
          { customer_name: { contains: search, mode: 'insensitive' } },
          { customer_phone: { contains: search, mode: 'insensitive' } },
          { customer_email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (branch_id) {
        where.branch_id = branch_id;
      }

      if (payment_method) {
        // For new multi-payment system, search in SalePayment table
        where.payments = {
          some: {
            payment_method: payment_method,
          },
        };
      }

      if (payment_status) {
        where.payment_status = payment_status;
      }

      if (date_from || date_to) {
        where.sale_date = {};
        if (date_from) {
          where.sale_date.gte = new Date(date_from);
        }
        if (date_to) {
          where.sale_date.lte = new Date(date_to);
        }
      }

      // Filter sales by source (quotation or direct)
      if (source === 'quotation') {
        // Show only sales that were converted from quotations
        where.converted_from_quotations = {
          some: {},
        };
      } else if (source === 'direct') {
        // Show only sales that were NOT converted from quotations
        where.converted_from_quotations = {
          none: {},
        };
      }

      const [sales, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sort_by]: sort_order },
          include: {
            customer: true,
            branch: true,
            user: { select: { id: true, name: true } },
            served_by: { select: { id: true, name: true } },
            deleted_by: { select: { id: true, name: true } },
            payments: true, // Include payment details
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                    sale_unit: true,
                  },
                },
                batch: true,
              },
            },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Calculate summary stats
      const summary = await this.calculateSummaryStats(where);

      const result = {
        data: sales,
        meta: {
          total,
          page,
          limit,
          total_pages: totalPages,
        },
        summary,
      };

      const salesWithPromotions = await Promise.all(
        sales.map((sale) => this.attachAppliedPromotions(sale, consumerId)),
      );

      return {
        ...result,
        data: await this.attachReturnSummaries(salesWithPromotions),
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching sales for consumer ${consumerId} with filters`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch sales',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number, includeDeleted = false) {
    try {
      const sale = await this.prisma.sale.findFirst({
        where: {
          id,
          consumer_id: consumerId,
          sale_type: SaleType.SALE, // Only return actual sales, not quotations
          ...(includeDeleted ? {} : { deleted_at: null }),
        },
        include: {
          customer: {
            include: {
              rewards_points: true,
            },
          },
          consumer: true, // Include consumer data directly
          branch: true,
          user: { select: { id: true, name: true } },
          served_by: { select: { id: true, name: true } },
          deleted_by: { select: { id: true, name: true } },
          promotion: {
            select: {
              id: true,
              name: true,
              scope: true,
              discount_type: true,
              discount_value: true,
            },
          },
          payments: true, // Include payment details
          converted_from_quotations: {
            // Include original quotations if converted
            select: {
              id: true,
              sale_number: true,
              created_at: true,
            },
          },
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                  sale_unit: true,
                },
              },
              batch: true,
            },
          },
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      const withPromotions = await this.attachAppliedPromotions(
        sale,
        consumerId,
      );
      const [withReturns] = await this.attachReturnSummaries([withPromotions]);

      return withReturns;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      this.logger.error(
        `Error fetching sale ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch sale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Notes are the only editable field on a completed sale — nothing financial
   * can be rewritten after the fact.
   */
  async updateNote(
    id: number,
    consumerId: number,
    dto: UpdateSaleNoteDto,
    userId: number,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, consumer_id: consumerId, deleted_at: null },
      select: { id: true, sale_number: true },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    try {
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: { notes: dto.notes?.trim() ? dto.notes.trim() : null },
      });

      this.logger.log(
        `Note updated on sale ${sale.sale_number} by user ${userId}`,
      );

      return await this.findOne(id, consumerId);
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error updating note on sale ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update sale note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Points earned by a sale are cancelled with an offsetting ADJUSTMENT when the
   * sale is deleted, and re-applied when it is restored. Never destructive: the
   * original EARN transaction stays in the customer's history.
   */
  private async reverseSaleRewardPoints(
    saleId: number,
    consumerId: number,
    userId: number,
    context: { saleNumber: string; direction: 'delete' | 'restore' },
  ) {
    try {
      const transactions = await this.prisma.rewardsPointTransaction.findMany({
        where: {
          sale_id: saleId,
          consumer_id: consumerId,
          type: { in: ['EARN', 'ADJUSTMENT'] },
        },
        select: { customer_id: true, points: true },
      });

      const netByCustomer = new Map<number, number>();
      for (const transaction of transactions) {
        netByCustomer.set(
          transaction.customer_id,
          (netByCustomer.get(transaction.customer_id) || 0) +
            transaction.points,
        );
      }

      for (const [customerId, netPoints] of netByCustomer) {
        // On delete we cancel the points the sale earned, on restore we re-add them
        const points = context.direction === 'delete' ? -netPoints : netPoints;
        if (!points) continue;

        await this.rewardsService.adjustPoints(
          consumerId,
          {
            customer_id: customerId,
            points,
            description:
              context.direction === 'delete'
                ? `Points reversed - sale #${context.saleNumber} deleted`
                : `Points re-applied - sale #${context.saleNumber} restored`,
          },
          userId,
        );
      }
    } catch (error) {
      // Never block the delete/restore itself on a rewards bookkeeping failure
      this.logger.error(
        `Failed to ${context.direction} rewards points for sale ${saleId}`,
        errorStack(error),
      );
    }
  }

  /**
   * Soft-deletes a sale: the row is kept (and stays visible in the Deleted tab)
   * but is excluded from every listing, report and stat. Stock sold by the sale
   * is put back into the exact batches it came from.
   *
   * Refused when the sale already has a return, or has payments collected after
   * the sale was created (partial payments) — those must be unwound first.
   */
  async softDelete(
    id: number,
    consumerId: number,
    userId: number,
    dto: DeleteSaleDto,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        sale_type: SaleType.SALE,
        deleted_at: null,
      },
      include: {
        items: true,
        payments: true,
        returns_as_original: { select: { id: true, return_number: true } },
        returns_as_exchange: { select: { id: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.returns_as_original.length) {
      throw new BadRequestException(
        `This sale has ${sale.returns_as_original.length} return(s) against it (${sale.returns_as_original
          .map((record) => record.return_number)
          .join(', ')}). Delete or reverse the return(s) first.`,
      );
    }

    if (sale.returns_as_exchange.length) {
      throw new BadRequestException(
        'This sale was created as an exchange for a return and cannot be deleted.',
      );
    }

    // Payments recorded after the sale was created = partial payment collections
    const laterPayments = sale.payments.filter(
      (payment) =>
        payment.created_at.getTime() - sale.created_at.getTime() > 60_000,
    );
    if (laterPayments.length) {
      throw new BadRequestException(
        'This sale has partial payments collected after it was created. Reverse those payments before deleting.',
      );
    }

    if (sale.converted_to_sale_id) {
      throw new BadRequestException(
        'A quotation-converted record cannot be deleted from here.',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Claim the delete first: a concurrent delete of the same sale must not
        // restock twice
        const claimed = await tx.sale.updateMany({
          where: { id: sale.id, deleted_at: null },
          data: {
            deleted_at: new Date(),
            deleted_by_id: userId,
            delete_reason: dto?.reason?.trim() || null,
          },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('Sale has already been deleted');
        }

        for (const item of sale.items) {
          if (!item.batch_id) continue;

          const isPendingDelivery =
            sale.is_delivery_later && sale.delivery_status === 'PENDING';
          const isCancelledDelivery =
            sale.is_delivery_later && sale.delivery_status === 'CANCELLED';

          if (isCancelledDelivery) continue;

          const updatedBatch = await tx.inventoryBatch.update({
            where: { id: item.batch_id },
            data: isPendingDelivery
              ? { reserved_quantity: { decrement: item.quantity } }
              : { quantity: { increment: item.quantity } },
          });

          if (isPendingDelivery) continue;

          await tx.inventoryAuditLog.create({
            data: {
              consumer_id: consumerId,
              branch_id: sale.branch_id,
              variant_id: item.variant_id,
              batch_id: item.batch_id,
              inventoryBatchId: item.batch_id,
              event_type: 'SALE_DELETE_IN',
              quantity_delta: item.quantity,
              quantity_after: updatedBatch.quantity,
              reference_id: item.id,
              reference_type: 'sale_items',
              notes: `Sale #${sale.sale_number} deleted - stock restored: ${item.quantity}`,
              created_by_user_id: userId,
            },
          });
        }
      });

      // Reverse any rewards points the sale earned, as an auditable adjustment
      await this.reverseSaleRewardPoints(sale.id, consumerId, userId, {
        saleNumber: sale.sale_number,
        direction: 'delete',
      });

      this.logger.log(
        `Sale ${sale.sale_number} soft-deleted by user ${userId}`,
      );

      return {
        message: 'Sale deleted and stock restored',
        sale_id: sale.id,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error deleting sale ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete sale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Restores a soft-deleted sale, taking the stock back out of the same batches.
   * Refused when a batch no longer holds enough stock to cover the sale.
   */
  async restore(id: number, consumerId: number, userId: number) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        sale_type: SaleType.SALE,
        deleted_at: { not: null },
      },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Deleted sale not found');
    }

    const batchedItems = sale.items.filter((item) => item.batch_id);

    const requiredByBatch = new Map<number, number>();
    for (const item of batchedItems) {
      requiredByBatch.set(
        item.batch_id!,
        (requiredByBatch.get(item.batch_id!) || 0) + item.quantity,
      );
    }

    const isPendingDelivery =
      sale.is_delivery_later && sale.delivery_status === 'PENDING';
    const isCancelledDelivery =
      sale.is_delivery_later && sale.delivery_status === 'CANCELLED';

    const batches = await this.prisma.inventoryBatch.findMany({
      where: { id: { in: [...requiredByBatch.keys()] } },
      select: {
        id: true,
        quantity: true,
        reserved_quantity: true,
        batch_number: true,
      },
    });

    const missing = isCancelledDelivery
      ? []
      : batches.filter((batch) => {
          const required = requiredByBatch.get(batch.id) || 0;
          return isPendingDelivery
            ? batch.quantity - batch.reserved_quantity < required
            : batch.quantity < required;
        });

    if (missing.length || batches.length !== requiredByBatch.size) {
      throw new BadRequestException(
        'Cannot restore this sale: the stock it consumed is no longer available in the original batch(es).',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Claim the restore first: a concurrent restore must not deduct twice
        const claimed = await tx.sale.updateMany({
          where: { id: sale.id, deleted_at: { not: null } },
          data: {
            deleted_at: null,
            deleted_by_id: null,
            delete_reason: null,
          },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException('Sale has already been restored');
        }

        for (const item of batchedItems) {
          if (isCancelledDelivery) continue;

          // Atomic check-and-update; the availability check above ran outside
          // this transaction
          const updatedBatch = isPendingDelivery
            ? await reserveAvailableStock(tx, item.batch_id!, item.quantity)
            : await takeAvailableStock(tx, item.batch_id!, item.quantity);
          if (!updatedBatch) {
            throw new BadRequestException(
              'Cannot restore this sale: the stock it consumed is no longer available in the original batch(es).',
            );
          }

          if (isPendingDelivery) continue;

          await tx.inventoryAuditLog.create({
            data: {
              consumer_id: consumerId,
              branch_id: sale.branch_id,
              variant_id: item.variant_id,
              batch_id: item.batch_id,
              inventoryBatchId: item.batch_id,
              event_type: 'SALE_RESTORE_OUT',
              quantity_delta: -item.quantity,
              quantity_after: updatedBatch.quantity,
              reference_id: item.id,
              reference_type: 'sale_items',
              notes: `Sale #${sale.sale_number} restored - stock deducted: ${item.quantity}`,
              created_by_user_id: userId,
            },
          });
        }
      });

      await this.reverseSaleRewardPoints(sale.id, consumerId, userId, {
        saleNumber: sale.sale_number,
        direction: 'restore',
      });

      this.logger.log(`Sale ${sale.sale_number} restored by user ${userId}`);

      return await this.findOne(id, consumerId);
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error restoring sale ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to restore sale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findBySaleNumber(saleNumber: string, consumerId: number) {
    try {
      const sale = await this.prisma.sale.findFirst({
        where: {
          sale_number: saleNumber,
          consumer_id: consumerId,
          sale_type: SaleType.SALE, // Only return actual sales, not quotations
          deleted_at: null, // Deleted sales cannot be returned against
        },
        include: {
          customer: {
            include: {
              rewards_points: true,
            },
          },
          branch: true,
          user: { select: { id: true, name: true } },
          served_by: { select: { id: true, name: true } },
          promotion: {
            select: {
              id: true,
              name: true,
              scope: true,
              discount_type: true,
              discount_value: true,
            },
          },
          payments: true,
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                  sale_unit: true,
                },
              },
              batch: true,
            },
          },
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found with that sale number');
      }

      // Calculate available_for_return for each item by checking existing returns
      const saleWithAvailableQuantities = {
        ...sale,
        items: await Promise.all(
          sale.items.map(async (item) => {
            // Get total quantity already returned for this sale item
            const returnedQuantity = await this.prisma.returnItem.aggregate({
              where: {
                sale_item_id: item.id,
              },
              _sum: {
                quantity: true,
              },
            });

            const totalReturned = returnedQuantity._sum?.quantity || 0;
            const availableForReturn = item.quantity - totalReturned;

            return {
              ...item,
              available_for_return: Math.max(0, availableForReturn), // Ensure it's never negative
            };
          }),
        ),
      };

      // Calculate return summary for this sale
      const returns = await this.prisma.return.findMany({
        where: {
          original_sale_id: sale.id,
        },
        include: {
          payments: true,
          exchanges: true,
          items: true,
        },
      });

      // Calculate totals from all returns
      const totalRefunded = returns.reduce(
        (sum, ret) => sum + parseFloat(ret.total_refund.toString()),
        0,
      );
      const totalExchanged = returns.reduce(
        (sum, ret) => sum + parseFloat(ret.total_exchange.toString()),
        0,
      );
      const totalAlreadyReturned = totalRefunded + totalExchanged;
      const availableAmount =
        parseFloat(sale.total_amount.toString()) - totalAlreadyReturned;

      const saleItemMap = new Map(sale.items.map((item) => [item.id, item]));
      const totalItemValueAlreadyReturned = returns.reduce((sum, ret) => {
        const returnItemsValue = ret.items.reduce((itemSum, returnedItem) => {
          const originalItem = saleItemMap.get(returnedItem.sale_item_id);
          if (!originalItem) return itemSum;

          const originalQty = Number(originalItem.quantity) || 0;
          const ratio =
            originalQty > 0 ? Number(returnedItem.quantity) / originalQty : 0;
          return itemSum + (Number(originalItem.line_total) || 0) * ratio;
        }, 0);

        return sum + returnItemsValue;
      }, 0);

      const shippingRefunded = Math.max(
        0,
        totalAlreadyReturned - totalItemValueAlreadyReturned,
      );
      const availableShippingRefund = Math.max(
        0,
        Number(sale.shipping_cost || 0) - shippingRefunded,
      );

      const returnSummary = {
        total_returned: returns.length,
        total_refunded: totalRefunded,
        total_exchanged: totalExchanged,
        total_already_returned: totalAlreadyReturned,
        available_amount: Math.max(0, availableAmount), // Ensure it's never negative
        shipping_refunded: shippingRefunded,
        available_shipping_refund: availableShippingRefund,
        returns: returns.map((ret) => ({
          id: ret.id,
          return_number: ret.return_number,
          return_date: ret.return_date,
          total_refund: parseFloat(ret.total_refund.toString()),
          total_exchange: parseFloat(ret.total_exchange.toString()),
          reason: ret.reason,
        })),
      };

      const saleWithReturnSummary = {
        ...saleWithAvailableQuantities,
        return_summary: returnSummary,
      };

      return await this.attachAppliedPromotions(
        saleWithReturnSummary,
        consumerId,
      );
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching sale by sale number ${saleNumber} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching sale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductsForSale(
    consumerId: number,
    branchId: number,
    search?: string,
  ) {
    try {
      const where: any = {
        product: { consumer_id: consumerId },
        inventory_items: {
          some: {
            branch_id: branchId,
            quantity: { gt: 0 },
          },
        },
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { code: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const variants = await this.prisma.productVariant.findMany({
        where,
        include: {
          product: {
            include: { category: true },
          },
          sale_unit: true,
          inventory_items: {
            where: {
              branch_id: branchId,
              quantity: { gt: 0 },
            },
            orderBy: { created_at: 'asc' }, // FIFO
          },
        },
        take: 50, // Limit results for performance
      });

      const result = variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        brand_id: variant.product.brand_id,
        category_id: variant.product.category_id,
        category_name: variant.product.category?.name,
        regular_price: variant.regular_price,
        wholesale_price: variant.wholesale_price,
        image: variant.image,
        product_name: variant.product.name,
        product_code: variant.product.code,
        unit_name: variant.sale_unit.name,
        tax_percentage: variant.product.tax || 0,
        tax_method: variant.product.tax_method || 'exclusive',
        // Where the stock sits, so staff can find it straight from search
        locations: collectBatchLocations(variant.inventory_items),
      }));

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching products for sale for consumer ${consumerId} and branch ${branchId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching products',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductByBarcode(
    consumerId: number,
    branchId: number,
    barcode: string,
  ) {
    try {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          barcode: barcode,
          product: { consumer_id: consumerId },
          inventory_items: {
            some: {
              branch_id: branchId,
              quantity: { gt: 0 },
            },
          },
        },
        include: {
          product: true,
          sale_unit: true,
          inventory_items: {
            where: {
              branch_id: branchId,
              quantity: { gt: 0 },
            },
            orderBy: { created_at: 'asc' }, // FIFO
          },
        },
      });

      if (!variant) {
        return null;
      }

      const result = {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        brand_id: variant.product.brand_id,
        regular_price: variant.regular_price,
        wholesale_price: variant.wholesale_price,
        image: variant.image,
        product_name: variant.product.name,
        product_code: variant.product.code,
        unit_name: variant.sale_unit.name,
        locations: collectBatchLocations(variant.inventory_items),
        tax_percentage: variant.product.tax || 0,
        tax_method: variant.product.tax_method || 'exclusive',
      };

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching product by barcode for consumer ${consumerId} and branch ${branchId} and barcode ${barcode}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching product',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSalesStats(consumerId: number, branchId?: number) {
    try {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - now.getDay(),
      );
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const baseWhere: any = {
        consumer_id: consumerId,
        sale_type: 'sale',
        payment_status: { not: 'cancelled' },
        deleted_at: null,
      };

      if (branchId) {
        baseWhere.branch_id = branchId;
      }

      const [todayStats, weekStats, monthStats] = await Promise.all([
        this.prisma.sale.aggregate({
          where: { ...baseWhere, sale_date: { gte: todayStart } },
          _count: true,
          _sum: { total_amount: true },
        }),
        this.prisma.sale.aggregate({
          where: { ...baseWhere, sale_date: { gte: weekStart } },
          _count: true,
          _sum: { total_amount: true },
        }),
        this.prisma.sale.aggregate({
          where: { ...baseWhere, sale_date: { gte: monthStart } },
          _count: true,
          _sum: { total_amount: true },
        }),
      ]);

      // Get top products
      const topProducts = await this.prisma.saleItem.groupBy({
        by: ['variant_id'],
        where: {
          sale: { ...baseWhere, sale_date: { gte: monthStart } },
        },
        _sum: {
          quantity: true,
          line_total: true,
        },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      });

      const topProductsWithDetails = await Promise.all(
        topProducts.map(async (item) => {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: item.variant_id },
            include: { product: true },
          });
          return {
            variant_id: item.variant_id,
            variant_name: variant?.name || 'Unknown',
            product_name: variant?.product?.name || 'Unknown',
            total_quantity: item._sum.quantity || 0,
            total_amount: item._sum.line_total || 0,
          };
        }),
      );

      const [todayRefunds, weekRefunds, monthRefunds] = await Promise.all(
        [todayStart, weekStart, monthStart].map((from) =>
          this.prisma.return.aggregate({
            where: {
              consumer_id: consumerId,
              ...(branchId ? { branch_id: branchId } : {}),
              return_date: { gte: from },
            },
            _sum: { total_refund: true },
          }),
        ),
      );

      const todayAmount = Number(todayStats._sum.total_amount || 0);
      const weekAmount = Number(weekStats._sum.total_amount || 0);
      const monthAmount = Number(monthStats._sum.total_amount || 0);
      const todayRefund = Number(todayRefunds._sum.total_refund || 0);
      const weekRefund = Number(weekRefunds._sum.total_refund || 0);
      const monthRefund = Number(monthRefunds._sum.total_refund || 0);

      return {
        today_sales: todayStats._count || 0,
        today_amount: todayAmount,
        today_refund: todayRefund,
        today_net_amount: todayAmount - todayRefund,
        week_sales: weekStats._count || 0,
        week_amount: weekAmount,
        week_refund: weekRefund,
        week_net_amount: weekAmount - weekRefund,
        month_sales: monthStats._count || 0,
        month_amount: monthAmount,
        month_refund: monthRefund,
        month_net_amount: monthAmount - monthRefund,
        top_products: topProductsWithDetails,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching sales stats for consumer ${consumerId} and branch ${branchId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching sales stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getEODReport(
    consumerId: number,
    eodDto: EODReportDto,
  ): Promise<EODReportResponse> {
    try {
      // Parse date or use current date
      let reportDate: Date;
      if (eodDto.date) {
        const [y, m, d] = eodDto.date.split('-').map(Number);
        reportDate = new Date(y, m - 1, d || 1);
      } else {
        reportDate = new Date();
      }

      const period = eodDto.period ?? 'day';
      let startOfDay: Date;
      let endOfDay: Date;
      if (period === 'all') {
        startOfDay = new Date(0);
        endOfDay = new Date(
          reportDate.getFullYear(),
          reportDate.getMonth(),
          reportDate.getDate(),
          23,
          59,
          59,
          999,
        );
      } else if (period === 'month') {
        startOfDay = new Date(
          reportDate.getFullYear(),
          reportDate.getMonth(),
          1,
          0,
          0,
          0,
          0,
        );
        endOfDay = new Date(
          reportDate.getFullYear(),
          reportDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );
      } else {
        startOfDay = new Date(
          reportDate.getFullYear(),
          reportDate.getMonth(),
          reportDate.getDate(),
          0,
          0,
          0,
          0,
        );
        endOfDay = new Date(
          reportDate.getFullYear(),
          reportDate.getMonth(),
          reportDate.getDate(),
          23,
          59,
          59,
          999,
        );
      }

      // Build where clause
      const whereClause: any = {
        sale_type: SaleType.SALE, // Only include actual sales in EOD, not quotations
        consumer_id: consumerId,
        deleted_at: null,
        sale_date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };

      if (eodDto.branch_id) {
        whereClause.branch_id = eodDto.branch_id;
      }

      // Get branch name if specific branch selected
      let branchName: string | undefined;
      if (eodDto.branch_id) {
        const branch = await this.prisma.branch.findUnique({
          where: { id: eodDto.branch_id },
          select: { name: true },
        });
        branchName = branch?.name;
      }

      // Get all sales for the day
      const sales = await this.prisma.sale.findMany({
        where: whereClause,
        include: {
          payments: true,
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      // Returns are counted in the period they were refunded in — the original
      // sale may be older. A day-end report has to match the drawer, and the
      // drawer was emptied by today's refunds, not by today's sales alone.
      const returns = await this.prisma.return.findMany({
        where: {
          consumer_id: consumerId,
          return_date: { gte: startOfDay, lte: endOfDay },
          ...(eodDto.branch_id ? { branch_id: eodDto.branch_id } : {}),
        },
        include: {
          payments: true,
          items: {
            include: {
              sale_item: {
                select: { id: true, quantity: true, line_total: true },
              },
              variant: { include: { product: { select: { name: true } } } },
            },
          },
        },
      });

      const operationalCosts = await this.prisma.operationalCost.findMany({
        where: {
          consumer_id: consumerId,
          incurred_on: { gte: startOfDay, lte: endOfDay },
          ...(eodDto.branch_id ? { branch_id: eodDto.branch_id } : {}),
        },
        include: { branch: { select: { name: true } } },
        orderBy: { incurred_on: 'desc' },
      });
      const totalOperationalCosts = operationalCosts.reduce(
        (sum, cost) => sum + Number(cost.amount),
        0,
      );

      // Get all payments recorded in this period (checkout payments on today's sales
      // plus customer partial/due payments collected today on older sales)
      const periodPayments = await this.prisma.salePayment.findMany({
        where: {
          created_at: { gte: startOfDay, lte: endOfDay },
          sale: {
            consumer_id: consumerId,
            deleted_at: null,
            sale_type: SaleType.SALE,
            ...(eodDto.branch_id ? { branch_id: eodDto.branch_id } : {}),
          },
        },
        include: {
          sale: {
            select: {
              id: true,
              sale_number: true,
              sale_date: true,
              total_amount: true,
            },
          },
        },
      });

      // Merge payments: combine periodPayments with any payments in sales.payments
      const allPeriodPaymentsMap = new Map<number, any>();
      periodPayments.forEach((p) => allPeriodPaymentsMap.set(p.id, p));

      sales.forEach((s) => {
        if (s.payments && s.payments.length > 0) {
          s.payments.forEach((p) => {
            const pCreated = new Date(p.created_at);
            if (pCreated >= startOfDay && pCreated <= endOfDay) {
              if (!allPeriodPaymentsMap.has(p.id)) {
                allPeriodPaymentsMap.set(p.id, {
                  ...p,
                  sale: {
                    id: s.id,
                    sale_number: s.sale_number,
                    sale_date: s.sale_date,
                    total_amount: s.total_amount,
                  },
                });
              }
            }
          });
        }
      });

      const collectedPaymentsList = Array.from(allPeriodPaymentsMap.values());
      const periodSaleIds = new Set(sales.map((s) => s.id));

      // Calculate sales summary statistics (Accrual / Invoiced basis)
      const totalSales = sales.length;
      const totalAmount = sales.reduce(
        (sum, sale) => sum + Number(sale.total_amount),
        0,
      );
      const grossSubtotal = sales.reduce(
        (sum, sale) => sum + Number(sale.subtotal || 0),
        0,
      );
      // discount_amount already includes the promotion discount
      // (average + special + promotion), so adding promotion_discount again
      // counted every promotion twice
      const totalDiscount = sales.reduce(
        (sum, sale) => sum + Number(sale.discount_amount || 0),
        0,
      );
      const totalTax = sales.reduce(
        (sum, sale) => sum + Number(sale.tax_amount || 0),
        0,
      );
      const totalShipping = sales.reduce(
        (sum, sale) => sum + Number(sale.shipping_cost || 0),
        0,
      );
      const totalItemsSold = sales.reduce(
        (sum, sale) =>
          sum +
          sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      );

      const totalReturns = returns.length;
      const totalRefund = returns.reduce(
        (sum, record) => sum + Number(record.total_refund),
        0,
      );
      const totalItemsReturned = returns.reduce(
        (sum, record) =>
          sum + record.items.reduce((qty, item) => qty + item.quantity, 0),
        0,
      );

      // Get unique products sold
      const uniqueProductIds = new Set();
      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          uniqueProductIds.add(item.variant_id);
        });
      });

      // Payment method breakdown for all payments collected in this period
      const paymentMethodMap = new Map<
        string,
        { total_amount: number; transaction_count: number }
      >();

      let cashSales = 0;
      let digitalSales = 0;
      let rewardPointSales = 0;
      let exchangeSales = 0;
      let periodSalesCollected = 0;
      let dueCollected = 0;

      collectedPaymentsList.forEach((payment) => {
        const method = payment.payment_method;
        const amt = Number(payment.amount);

        const existing = paymentMethodMap.get(method) || {
          total_amount: 0,
          transaction_count: 0,
        };
        paymentMethodMap.set(method, {
          total_amount: existing.total_amount + amt,
          transaction_count: existing.transaction_count + 1,
        });

        if (method === 'CASH') {
          cashSales += amt;
        } else if (method === 'CREDIT') {
          rewardPointSales += amt;
        } else if (method === 'EXCHANGE') {
          exchangeSales += amt;
        } else {
          digitalSales += amt;
        }

        if (periodSaleIds.has(payment.sale_id)) {
          periodSalesCollected += amt;
        } else {
          dueCollected += amt;
        }
      });

      const paymentMethodBreakdown: PaymentMethodBreakdown[] = Array.from(
        paymentMethodMap.entries(),
      ).map(([method, data]) => ({
        payment_method: method,
        total_amount: data.total_amount,
        transaction_count: data.transaction_count,
      }));

      const returnPaymentMap = new Map<
        string,
        { total_amount: number; transaction_count: number }
      >();

      returns.forEach((record) => {
        record.payments.forEach((payment) => {
          const method = payment.payment_method;
          const existing = returnPaymentMap.get(method) || {
            total_amount: 0,
            transaction_count: 0,
          };
          returnPaymentMap.set(method, {
            total_amount: existing.total_amount + Number(payment.amount),
            transaction_count: existing.transaction_count + 1,
          });
        });
      });

      const returnPaymentBreakdown: PaymentMethodBreakdown[] = Array.from(
        returnPaymentMap.entries(),
      ).map(([method, data]) => ({
        payment_method: method,
        total_amount: data.total_amount,
        transaction_count: data.transaction_count,
      }));

      // Returned units per variant. ReturnItem carries no money of its own, so
      // the refunded value is the returned share of the original line total.
      const returnsByVariant = new Map<
        number,
        {
          quantity: number;
          amount: number;
          variant_name: string;
          product_name: string;
          sku?: string;
        }
      >();

      returns.forEach((record) => {
        record.items.forEach((item) => {
          const originalQty = Number(item.sale_item?.quantity) || 0;
          const ratio = originalQty > 0 ? item.quantity / originalQty : 0;
          const amount = Number(item.sale_item?.line_total || 0) * ratio;

          const existing = returnsByVariant.get(item.variant_id) || {
            quantity: 0,
            amount: 0,
            variant_name: item.variant.name,
            product_name: item.variant.product.name,
            sku: item.variant.sku || undefined,
          };
          returnsByVariant.set(item.variant_id, {
            ...existing,
            quantity: existing.quantity + item.quantity,
            amount: existing.amount + amount,
          });
        });
      });

      // Product sales statistics
      const productSalesMap = new Map<
        number,
        {
          variant_name: string;
          product_name: string;
          sku?: string;
          quantity_sold: number;
          total_amount: number;
        }
      >();

      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const existing = productSalesMap.get(item.variant_id) || {
            variant_name: item.variant.name,
            product_name: item.variant.product.name,
            sku: item.variant.sku || undefined,
            quantity_sold: 0,
            total_amount: 0,
          };

          productSalesMap.set(item.variant_id, {
            ...existing,
            quantity_sold: existing.quantity_sold + item.quantity,
            total_amount: existing.total_amount + Number(item.line_total),
          });
        });
      });

      // A product returned today may have been sold in an earlier period, so it
      // needs a row of its own rather than being dropped from the report.
      returnsByVariant.forEach((data, variantId) => {
        if (productSalesMap.has(variantId)) return;
        productSalesMap.set(variantId, {
          variant_name: data.variant_name,
          product_name: data.product_name,
          sku: data.sku,
          quantity_sold: 0,
          total_amount: 0,
        });
      });

      const productSales: ProductSalesStats[] = Array.from(
        productSalesMap.entries(),
      )
        .map(([variantId, data]) => {
          const returned = returnsByVariant.get(variantId);
          const refundAmount = returned?.amount ?? 0;

          return {
            variant_id: variantId,
            variant_name: data.variant_name,
            product_name: data.product_name,
            sku: data.sku,
            quantity_sold: data.quantity_sold,
            total_amount: data.total_amount,
            average_unit_price: data.quantity_sold
              ? data.total_amount / data.quantity_sold
              : returned?.quantity
                ? refundAmount / returned.quantity
                : 0,
            quantity_returned: returned?.quantity ?? 0,
            refund_amount: refundAmount,
            net_amount: data.total_amount - refundAmount,
          };
        })
        .sort((a, b) => b.total_amount - a.total_amount); // Sort by total amount descending

      // Hourly sales breakdown
      const hourlySalesMap = new Map<
        number,
        { sales_count: number; total_amount: number }
      >();
      for (let hour = 0; hour < 24; hour++) {
        hourlySalesMap.set(hour, { sales_count: 0, total_amount: 0 });
      }

      sales.forEach((sale) => {
        const hour = new Date(sale.sale_date).getHours();
        const existing = hourlySalesMap.get(hour)!;
        hourlySalesMap.set(hour, {
          sales_count: existing.sales_count + 1,
          total_amount: existing.total_amount + Number(sale.total_amount),
        });
      });

      const hourlySales = Array.from(hourlySalesMap.entries()).map(
        ([hour, data]) => ({
          hour,
          sales_count: data.sales_count,
          total_amount: data.total_amount,
        }),
      );

      // Payment status breakdown
      const paymentStatusMap = new Map<
        string,
        { count: number; total_amount: number }
      >();
      sales.forEach((sale) => {
        const existing = paymentStatusMap.get(sale.payment_status) || {
          count: 0,
          total_amount: 0,
        };
        paymentStatusMap.set(sale.payment_status, {
          count: existing.count + 1,
          total_amount: existing.total_amount + Number(sale.total_amount),
        });
      });

      const paymentStatusBreakdown = Array.from(paymentStatusMap.entries()).map(
        ([status, data]) => ({
          status,
          count: data.count,
          total_amount: data.total_amount,
        }),
      );

      // Calculate due amounts on sales created in this period
      let totalDue = 0;
      let dueSalesCount = 0;

      sales.forEach((sale) => {
        const total = Number(sale.total_amount);
        // Payments made on this sale on or before end of this reporting period
        const paidOnSale = sale.payments
          ? sale.payments
              .filter((p) => new Date(p.created_at) <= endOfDay)
              .reduce((sum, p) => sum + Number(p.amount), 0)
          : 0;
        const remaining = Math.max(0, total - paidOnSale);
        if (
          remaining > 0.001 ||
          sale.payment_status === 'due' ||
          sale.payment_status === 'partial'
        ) {
          totalDue += remaining;
          dueSalesCount += 1;
        }
      });

      // Liquid money received (Physical Cash + Digital Card/MFS/Bank)
      const realMoneyCollected = cashSales + digitalSales;
      const totalCollected =
        realMoneyCollected + rewardPointSales + exchangeSales;

      // Standalone return exchanges that were not already counted as an exchange payment on a sale in this period
      let standaloneReturnExchanges = 0;
      const totalExchangeReturn = returns.reduce((sum, ret) => {
        const val = Number(ret.total_exchange || 0);
        if (val > 0) {
          if (ret.exchange_sale_id && periodSaleIds.has(ret.exchange_sale_id)) {
            // Already counted as exchangeSales on the exchange sale in this period!
          } else {
            standaloneReturnExchanges += val;
          }
        }
        return sum + val;
      }, 0);

      // Unique exchanges across the business in this period (Deduplicated!)
      const uniqueExchanges = exchangeSales + standaloneReturnExchanges;

      const nonCashSales = totalAmount - cashSales;
      const cashRefunds =
        returnPaymentBreakdown.find((p) => p.payment_method === 'CASH')
          ?.total_amount || 0;
      const digitalRefunds = totalRefund - cashRefunds;

      const netCashSales = cashSales - cashRefunds;
      const netMoneyCollected = realMoneyCollected - totalRefund;
      const netOperatingCashFlow = netMoneyCollected - totalOperationalCosts;

      const summary: EODSummary = {
        total_sales: totalSales,
        total_amount: totalAmount,
        gross_subtotal: grossSubtotal,
        total_discount: totalDiscount,
        total_tax: totalTax,
        total_shipping: totalShipping,
        total_transactions: totalSales,
        total_collected: totalCollected,
        real_money_collected: realMoneyCollected,
        period_sales_collected: periodSalesCollected,
        due_collected: dueCollected,
        total_due: totalDue,
        due_sales_count: dueSalesCount,
        cash_sales: cashSales,
        digital_sales: digitalSales,
        reward_point_sales: rewardPointSales,
        exchange_sales: exchangeSales,
        total_exchange_return: totalExchangeReturn,
        unique_exchanges: uniqueExchanges,
        non_cash_sales: nonCashSales,
        average_transaction_value:
          totalSales > 0 ? totalAmount / totalSales : 0,
        total_items_sold: totalItemsSold,
        unique_products_sold: uniqueProductIds.size,
        operational_costs: totalOperationalCosts,
        total_returns: totalReturns,
        total_refund: totalRefund,
        total_items_returned: totalItemsReturned,
        net_sale_amount: totalAmount - totalRefund,
        cash_refunds: cashRefunds,
        digital_refunds: digitalRefunds,
        net_cash_sales: netCashSales,
        net_money_collected: netMoneyCollected,
        net_operating_result: totalAmount - totalRefund - totalOperationalCosts,
        net_operating_cash_flow: netOperatingCashFlow,
      };

      return {
        date: toLocalDateString(reportDate),
        period,
        period_start: toLocalDateString(startOfDay),
        period_end: toLocalDateString(endOfDay),
        branch_name: branchName,
        summary,
        payment_method_breakdown: paymentMethodBreakdown,
        return_payment_breakdown: returnPaymentBreakdown,
        product_sales: productSales,
        hourly_sales: hourlySales,
        payment_status_breakdown: paymentStatusBreakdown,
        operational_costs: operationalCosts.map((cost) => ({
          id: cost.id,
          name: cost.name,
          amount: Number(cost.amount),
          incurred_on: cost.incurred_on.toISOString().split('T')[0],
          branch_name: cost.branch?.name,
        })),
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error generating EOD report for consumer ${consumerId} and branch ${eodDto.branch_id} and date ${eodDto.date}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error generating EOD report',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async assertItemPromotionDiscounts(
    createSaleDto: CreateSaleDto,
    consumerId: number,
  ): Promise<void> {
    const discountByPromotion = new Map<number, number>();
    for (const item of createSaleDto.items) {
      const discount = Number(item.promotion_discount_amount) || 0;
      if (discount <= 0) continue;

      const promotionId =
        item.applied_promotion_id ?? createSaleDto.applied_promotion_id;
      if (!promotionId) {
        throw new BadRequestException(
          `Promotion discount on variant ${item.variant_id} has no promotion`,
        );
      }
      discountByPromotion.set(
        promotionId,
        (discountByPromotion.get(promotionId) || 0) + discount,
      );
    }

    // Same base the POS evaluates promotions on: catalog price × quantity,
    // before tax and discounts (the sent line_total is already discounted)
    const cart = createSaleDto.items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: Number(item.unit_price) * Number(item.quantity),
    }));

    for (const [promotionId, claimed] of discountByPromotion) {
      const evaluation =
        await this.promotionsService.assertAndCalculateDiscount(
          promotionId,
          consumerId,
          createSaleDto.branch_id,
          createSaleDto.customer_id,
          cart,
        );
      const allowed = Number(evaluation.discount_amount) || 0;
      if (claimed > allowed + 0.02) {
        throw new BadRequestException(
          `Promotion discount (${claimed.toFixed(2)}) exceeds what the promotion allows (${allowed.toFixed(2)})`,
        );
      }
    }
  }

  private async generateSaleNumber(
    consumerId: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const prefix = `SAL-${year}${month}${day}`;

      // Find the latest sale number for today
      const latestSale = await client.sale.findFirst({
        where: {
          consumer_id: consumerId,
          sale_number: { startsWith: prefix },
          sale_type: SaleType.SALE, // Only count actual sales, not quotations
        },
        orderBy: { sale_number: 'desc' },
      });

      let sequenceNumber = 1;
      if (latestSale) {
        const lastSequence = latestSale.sale_number.split('-').pop();
        sequenceNumber = parseInt(lastSequence || '0') + 1;
      }

      return `${prefix}-${String(sequenceNumber).padStart(4, '0')}`;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error generating sale number for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error generating sale number',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async generateQuotationNumber(
    consumerId: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const prefix = `QUO-${year}${month}${day}`;

      // Find the latest quotation number for today
      const latestQuotation = await client.sale.findFirst({
        where: {
          consumer_id: consumerId,
          sale_number: { startsWith: prefix },
          sale_type: SaleType.QUOTATION,
        },
        orderBy: { sale_number: 'desc' },
      });

      let sequenceNumber = 1;
      if (latestQuotation) {
        const lastSequence = latestQuotation.sale_number.split('-').pop();
        sequenceNumber = parseInt(lastSequence || '0') + 1;
      }

      return `${prefix}-${String(sequenceNumber).padStart(4, '0')}`;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error generating quotation number for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error generating quotation number',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Sale rows are never rewritten when a return happens, so the gross totals
   * alone never move after a refund. Refunds booked against the sales in scope
   * are aggregated alongside them and reported as total_refund / net_amount.
   */
  private async calculateSummaryStats(where: any) {
    try {
      const [stats, refunds] = await Promise.all([
        this.prisma.sale.aggregate({
          where,
          _count: true,
          _sum: { total_amount: true, received_amount: true },
          _avg: { total_amount: true },
        }),
        this.prisma.return.aggregate({
          where: { original_sale: where },
          _count: true,
          _sum: { total_refund: true },
        }),
      ]);

      const totalAmount = Number(stats._sum.total_amount || 0);
      const totalReceived = Number(stats._sum.received_amount || 0);
      const totalDue = Math.max(0, totalAmount - totalReceived);
      const totalRefund = Number(refunds._sum.total_refund || 0);

      return {
        total_sales: stats._count || 0,
        total_amount: totalAmount,
        total_received: totalReceived,
        total_due: totalDue,
        average_sale: Number(stats._avg.total_amount || 0),
        total_refund: totalRefund,
        return_count: refunds._count || 0,
        net_amount: totalAmount - totalRefund,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(`Error calculating summary stats`, errorStack(error));
      throw new HttpException(
        'Error calculating summary stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========== QUOTATION METHODS ==========

  async findAllQuotations(filters: SaleListFiltersDto, consumerId: number) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        branch_id,
        date_from,
        date_to,
        sort_by = 'created_at',
        sort_order = 'desc',
        source,
      } = filters;

      const skip = (page - 1) * limit;

      const where: any = {
        consumer_id: consumerId,
        sale_type: SaleType.QUOTATION, // Only quotations
        deleted_at: null,
      };

      if (search) {
        where.OR = [
          { sale_number: { contains: search, mode: 'insensitive' } },
          { customer_name: { contains: search, mode: 'insensitive' } },
          { customer_phone: { contains: search, mode: 'insensitive' } },
          { customer_email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (branch_id) {
        where.branch_id = branch_id;
      }

      if (date_from || date_to) {
        where.sale_date = {};
        if (date_from) {
          where.sale_date.gte = new Date(date_from);
        }
        if (date_to) {
          where.sale_date.lte = new Date(date_to);
        }
      }

      // Filter by conversion status using unified 'source' field
      if (source === 'converted') {
        where.converted_to_sale_id = { not: null };
      } else if (source === 'pending') {
        where.converted_to_sale_id = null;
      }

      const [quotations, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sort_by]: sort_order },
          include: {
            customer: true,
            branch: true,
            user: { select: { id: true, name: true } },
            served_by: { select: { id: true, name: true } },
            promotion: {
              select: {
                id: true,
                name: true,
                scope: true,
                discount_type: true,
                discount_value: true,
              },
            },
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                    sale_unit: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Calculate summary stats
      const summary = await this.calculateSummaryStats(where);

      const quotationsWithPromotions = await Promise.all(
        quotations.map((quotation) =>
          this.attachAppliedPromotions(quotation, consumerId),
        ),
      );

      return {
        data: quotationsWithPromotions,
        meta: {
          total,
          page,
          limit,
          total_pages: totalPages,
        },
        summary,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding all quotations for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error finding all quotations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOneQuotation(id: number, consumerId: number) {
    try {
      const quotation = await this.prisma.sale.findFirst({
        where: {
          id,
          consumer_id: consumerId,
          sale_type: SaleType.QUOTATION,
          deleted_at: null,
        },
        include: {
          customer: true,
          consumer: true, // Include consumer data directly
          branch: true,
          served_by: { select: { id: true, name: true } },
          promotion: {
            select: {
              id: true,
              name: true,
              scope: true,
              discount_type: true,
              discount_value: true,
            },
          },
          user: { select: { id: true, name: true } },
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                  sale_unit: true,
                },
              },
            },
          },
        },
      });

      if (!quotation) {
        throw new NotFoundException('Quotation not found');
      }

      return await this.attachAppliedPromotions(quotation, consumerId);
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding quotation ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error finding quotation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async convertQuotationToSale(
    quotationId: number,
    consumerId: number,
    userId: number,
  ) {
    try {
      const quotation: any = await this.findOneQuotation(
        quotationId,
        consumerId,
      );

      if (!quotation) {
        throw new NotFoundException('Quotation not found');
      }

      if (quotation.converted_to_sale_id) {
        throw new BadRequestException(
          `Quotation has already been converted to sale #${quotation.converted_to_sale_id}`,
        );
      }

      // Validate stock availability for all items
      const validationResults = await Promise.all(
        quotation.items.map(async (item: any) => {
          const variant = await this.prisma.productVariant.findFirst({
            where: {
              id: item.variant_id,
              product: { consumer_id: consumerId },
            },
            include: {
              inventory_items: {
                where: { branch_id: quotation.branch_id },
              },
            },
          });

          if (!variant) {
            throw new BadRequestException(
              `Product variant ${item.variant_id} not found`,
            );
          }

          const selectedBatch = variant.inventory_items
            .filter((batch) => batch.quantity - batch.reserved_quantity > 0)
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];

          if (!selectedBatch) {
            throw new BadRequestException(
              `Insufficient stock for variant ${item.variant_id}. Available: 0, Requested: ${item.quantity}`,
            );
          }

          const availableStock =
            selectedBatch.quantity - selectedBatch.reserved_quantity;

          if (availableStock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for variant ${item.variant_id}. Available: ${availableStock}, Requested: ${item.quantity}`,
            );
          }

          return { ...item, selectedBatch };
        }),
      );

      // Create the sale in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        await lockDocumentNumbering(tx, 'sale', consumerId);
        const saleNumber = await this.generateSaleNumber(consumerId, tx);

        const sale = await tx.sale.create({
          data: {
            sale_number: saleNumber,
            consumer_id: consumerId,
            customer_id: quotation.customer_id,
            customer_name: quotation.customer_name,
            customer_phone: quotation.customer_phone,
            customer_email: quotation.customer_email,
            promotion_id: quotation.promotion_id,
            branch_id: quotation.branch_id,
            user_id: userId,
            served_by_id: quotation.served_by_id,
            sale_type: SaleType.SALE,
            price_type: quotation.price_type,
            subtotal: quotation.subtotal,
            discount_amount: quotation.discount_amount,
            promotion_discount: quotation.promotion_discount || 0,
            shipping_cost: quotation.shipping_cost,
            tax_amount: quotation.tax_amount,
            total_amount: quotation.total_amount,
            payment_status: PaymentStatus.DUE,
            received_amount: 0,
            notes: quotation.notes,
          },
        });

        // Create sale items and update inventory with audit logs
        for (const item of validationResults) {
          const saleItem = await tx.saleItem.create({
            data: {
              sale_id: sale.id,
              variant_id: item.variant_id,
              batch_id: item.selectedBatch.id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              sold_unit_price: item.sold_unit_price ?? null,
              average_discount_amount: item.average_discount_amount || 0,
              special_discount_amount: item.special_discount_amount || 0,
              promotion_discount_amount: item.promotion_discount_amount || 0,
              applied_promotion_id: item.applied_promotion_id || null,
              tax_amount: item.tax_amount || 0,
              line_total: item.line_total,
            },
          });

          // Atomic check-and-update (the availability check ran outside
          // this transaction)
          const updatedBatch = await takeAvailableStock(
            tx,
            item.selectedBatch.id,
            item.quantity,
          );
          if (!updatedBatch) {
            throw new BadRequestException(
              `Insufficient stock for variant ${item.variant_id}. Stock changed while the sale was being saved; please try again.`,
            );
          }

          // Create SALE_OUT audit log
          await tx.inventoryAuditLog.create({
            data: {
              consumer_id: consumerId,
              branch_id: quotation.branch_id,
              variant_id: item.variant_id,
              batch_id: item.selectedBatch.id,
              inventoryBatchId: item.selectedBatch.id,
              event_type: 'SALE_OUT',
              quantity_delta: -item.quantity,
              quantity_after: updatedBatch.quantity,
              reference_id: saleItem.id,
              reference_type: 'sale_items',
              notes: `Sale #${saleNumber} (converted from quotation #${quotation.sale_number})`,
              created_by_user_id: userId,
            },
          });
        }

        // Mark quotation as converted, only if no concurrent request already did
        const marked = await tx.sale.updateMany({
          where: { id: quotationId, converted_to_sale_id: null },
          data: {
            converted_to_sale_id: sale.id,
            converted_at: new Date(),
          },
        });
        if (marked.count !== 1) {
          throw new BadRequestException(
            'Quotation has already been converted to a sale',
          );
        }

        return sale;
      });

      if (result.promotion_id) {
        await this.promotionsService.closePromotionIfExhausted(
          result.promotion_id,
          consumerId,
        );
      }

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      this.logger.error(
        `Error converting quotation ${quotationId} to sale for consumer ${consumerId} and user ${userId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error converting quotation to sale',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  // === VARIANT SALES STATS METHODS ===

  async getVariantSalesStats(
    consumerId: number,
    startDate: string,
    endDate: string,
    branchId?: number,
    page = 1,
    limit = 20,
  ) {
    try {
      const start = this.parseLocalDateStart(startDate);
      const end = this.parseLocalDateEnd(endDate);
      const skip = (page - 1) * limit;

      const total = await this.prisma.productVariant.count({
        where: { product: { consumer_id: consumerId } },
      });

      if (!total) {
        return {
          data: [],
          meta: { total: 0, page, limit, total_pages: 0 },
        };
      }

      type VariantStatsRow = {
        variant_id: number | bigint;
        product_name: string;
        variant_name: string;
        sku: string | null;
        total_qty: number | bigint;
        total_sales: number | bigint;
        total_amount: string | number;
        returned_qty: number | bigint;
        returned_amount: string | number;
      };

      const branchFilter = branchId
        ? Prisma.sql`AND s.branch_id = ${branchId}`
        : Prisma.empty;

      const returnBranchFilter = branchId
        ? Prisma.sql`AND r.branch_id = ${branchId}`
        : Prisma.empty;

      // Sold and returned are each pre-aggregated to one row per variant before
      // being joined — joining both detail tables at once would fan out and
      // multiply the sold quantities by the number of return rows.
      const rows = await this.prisma.$queryRaw<VariantStatsRow[]>`
        SELECT
          pv.id          AS variant_id,
          p.name         AS product_name,
          pv.name        AS variant_name,
          pv.sku         AS sku,
          COALESCE(sold.total_qty, 0)        AS total_qty,
          COALESCE(sold.total_sales, 0)      AS total_sales,
          COALESCE(sold.total_amount, 0)     AS total_amount,
          COALESCE(ret.returned_qty, 0)      AS returned_qty,
          COALESCE(ret.returned_amount, 0)   AS returned_amount
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN (
          SELECT
            si.variant_id                 AS variant_id,
            SUM(si.quantity)              AS total_qty,
            COUNT(DISTINCT si.sale_id)    AS total_sales,
            -- line_total is already net of the line's discounts (the POS sends it
            -- after discounts), exactly as the EOD report and dashboard use it
            SUM(si.line_total)            AS total_amount
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE s.consumer_id = ${consumerId}
            AND s.sale_type = ${SaleType.SALE}
            AND s.deleted_at IS NULL
            AND s.payment_status <> ${PaymentStatus.CANCELLED}
            AND s.sale_date >= ${start}
            AND s.sale_date <= ${end}
            ${branchFilter}
          GROUP BY si.variant_id
        ) sold ON sold.variant_id = pv.id
        LEFT JOIN (
          SELECT
            ri.variant_id      AS variant_id,
            SUM(ri.quantity)   AS returned_qty,
            -- return_items carry no money, so the refunded value is the
            -- returned share of the original (already net) line
            SUM(si.line_total * ri.quantity / NULLIF(si.quantity, 0))
                                 AS returned_amount
          FROM return_items ri
          JOIN returns r ON ri.return_id = r.id
          JOIN sale_items si ON ri.sale_item_id = si.id
          WHERE r.consumer_id = ${consumerId}
            AND r.return_date >= ${start}
            AND r.return_date <= ${end}
            ${returnBranchFilter}
          GROUP BY ri.variant_id
        ) ret ON ret.variant_id = pv.id
        WHERE p.consumer_id = ${consumerId}
        ORDER BY
          (COALESCE(sold.total_amount, 0) - COALESCE(ret.returned_amount, 0)) DESC,
          total_sales DESC, product_name ASC, variant_name ASC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const data = rows.map((row) => {
        const totalAmount = Number(row.total_amount);
        const returnedAmount = Number(row.returned_amount);

        return {
          variant_id: Number(row.variant_id),
          product_name: row.product_name,
          variant_name: row.variant_name,
          sku: row.sku ?? null,
          total_qty: Number(row.total_qty),
          total_sales: Number(row.total_sales),
          total_amount: totalAmount,
          returned_qty: Number(row.returned_qty),
          returned_amount: returnedAmount,
          net_amount: totalAmount - returnedAmount,
        };
      });

      return {
        data,
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching variant sales stats for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching variant sales stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getVariantSalesDetail(
    consumerId: number,
    variantId: number,
    startDate: string,
    endDate: string,
    branchId?: number,
    page = 1,
    limit = 20,
  ) {
    try {
      const start = this.parseLocalDateStart(startDate);
      const end = this.parseLocalDateEnd(endDate);

      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId },
        select: {
          id: true,
          name: true,
          product: { select: { id: true, name: true, consumer_id: true } },
        },
      });

      if (!variant || variant.product.consumer_id !== consumerId) {
        throw new NotFoundException('Product variant not found');
      }

      const where: any = {
        variant_id: variantId,
        sale: {
          consumer_id: consumerId,
          sale_type: SaleType.SALE,
          deleted_at: null,
          payment_status: { not: PaymentStatus.CANCELLED },
          sale_date: { gte: start, lte: end },
        },
      };

      if (branchId) {
        where.sale.branch_id = branchId;
      }

      const skip = (page - 1) * limit;

      const [items, total, totals] = await Promise.all([
        this.prisma.saleItem.findMany({
          where,
          skip,
          take: limit,
          orderBy: { sale: { sale_date: 'desc' } },
          select: {
            id: true,
            quantity: true,
            line_total: true,
            average_discount_amount: true,
            special_discount_amount: true,
            promotion_discount_amount: true,
            sale: {
              select: {
                id: true,
                sale_number: true,
                sale_date: true,
                payment_status: true,
                customer_name: true,
                customer: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
              },
            },
          },
        }),
        this.prisma.saleItem.count({ where }),
        this.prisma.saleItem.aggregate({
          where,
          _sum: {
            quantity: true,
            line_total: true,
            average_discount_amount: true,
            special_discount_amount: true,
            promotion_discount_amount: true,
          },
          _count: { sale_id: true },
        }),
      ]);

      // Build daily chart data
      const allItems = await this.prisma.saleItem.findMany({
        where,
        select: {
          quantity: true,
          line_total: true,
          average_discount_amount: true,
          special_discount_amount: true,
          promotion_discount_amount: true,
          sale_id: true,
          sale: { select: { sale_date: true } },
        },
        orderBy: { sale: { sale_date: 'asc' } },
      });

      const dailyMap = new Map<
        string,
        { date: string; total_amount: number; qty: number }
      >();
      for (const item of allItems) {
        const dateStr = toLocalDateString(item.sale.sale_date);
        // line_total is already net of the line's discounts
        const netLineTotal = Number(item.line_total);
        const existing = dailyMap.get(dateStr);
        if (existing) {
          existing.qty += Number(item.quantity);
          existing.total_amount += netLineTotal;
        } else {
          dailyMap.set(dateStr, {
            date: dateStr,
            qty: Number(item.quantity),
            total_amount: netLineTotal,
          });
        }
      }

      const totalQty = Number(totals._sum.quantity ?? 0);
      const totalAmount = Number(totals._sum.line_total ?? 0);
      const salesCount = new Set(allItems.map((item) => item.sale_id)).size;

      // Returns booked against these exact sale lines, so a variant that was
      // sold and handed straight back does not read as a strong seller.
      const returnedRows = await this.prisma.returnItem.groupBy({
        by: ['sale_item_id'],
        where: { sale_item: where },
        _sum: { quantity: true },
      });

      const returnedBySaleItem = new Map(
        returnedRows.map((row) => [row.sale_item_id, row._sum.quantity ?? 0]),
      );

      const returnedLines = await this.prisma.saleItem.findMany({
        where: { ...where, id: { in: Array.from(returnedBySaleItem.keys()) } },
        select: {
          id: true,
          quantity: true,
          line_total: true,
          average_discount_amount: true,
          special_discount_amount: true,
          promotion_discount_amount: true,
        },
      });

      let returnedQty = 0;
      let returnedAmount = 0;
      for (const line of returnedLines) {
        const qty = returnedBySaleItem.get(line.id) ?? 0;
        const originalQty = Number(line.quantity) || 0;
        const netLine = Number(line.line_total);

        returnedQty += qty;
        returnedAmount += originalQty > 0 ? (netLine * qty) / originalQty : 0;
      }

      return {
        variant: {
          id: variant.id,
          name: variant.name,
          product_name: variant.product.name,
        },
        summary: {
          total_qty: totalQty,
          total_sales: salesCount,
          total_amount: totalAmount,
          avg_qty: salesCount > 0 ? totalQty / salesCount : 0,
          avg_amount: salesCount > 0 ? totalAmount / salesCount : 0,
          returned_qty: returnedQty,
          returned_amount: returnedAmount,
          net_qty: totalQty - returnedQty,
          net_amount: totalAmount - returnedAmount,
        },
        chart_data: Array.from(dailyMap.values()),
        data: items.map((item) => ({
          id: item.id,
          sale_id: item.sale.id,
          sale_number: item.sale.sale_number,
          sale_date: item.sale.sale_date,
          customer_name:
            item.sale.customer?.name ?? item.sale.customer_name ?? null,
          branch_name: item.sale.branch?.name ?? null,
          qty: Number(item.quantity),
          returned_qty: returnedBySaleItem.get(item.id) ?? 0,
          line_total: Number(item.line_total),
          payment_status: item.sale.payment_status,
        })),
        meta: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching variant sales detail for variant ${variantId} and consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching variant sales detail',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // === USER SALES STATS METHODS ===

  async getUsersSalesStats(
    consumerId: number,
    startDate: string,
    endDate: string,
    branchId?: number,
  ) {
    // const start = new Date(startDate);
    // const end = new Date(endDate);
    // end.setHours(23, 59, 59, 999);
    const start = this.parseLocalDateStart(startDate);
    const end = this.parseLocalDateEnd(endDate);

    const where: any = {
      consumer_id: consumerId,
      sale_type: SaleType.SALE,
      deleted_at: null,
      served_by_id: { not: null },
      payment_status: { not: PaymentStatus.CANCELLED },
      sale_date: {
        gte: start,
        lte: end,
      },
    };

    if (branchId) {
      where.branch_id = branchId;
    }

    const grouped = await this.prisma.sale.groupBy({
      by: ['served_by_id'],
      where,
      _sum: {
        total_amount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          total_amount: 'desc',
        },
      },
    });

    if (!grouped.length) return [];

    const userIds = grouped.map((g) => g.served_by_id as number);

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        consumer_id: consumerId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Refunds are attributed to whoever served the original sale, over the same
    // period as the sales themselves — otherwise a salesperson keeps credit for
    // revenue the business gave back.
    const refundRows = await this.prisma.return.findMany({
      where: { consumer_id: consumerId, original_sale: where },
      select: {
        total_refund: true,
        original_sale: { select: { served_by_id: true } },
      },
    });

    const refundsByUser = new Map<number, { amount: number; count: number }>();
    for (const row of refundRows) {
      const userId = row.original_sale?.served_by_id;
      if (!userId) continue;

      const existing = refundsByUser.get(userId) ?? { amount: 0, count: 0 };
      refundsByUser.set(userId, {
        amount: existing.amount + Number(row.total_refund),
        count: existing.count + 1,
      });
    }

    return grouped.map((g) => {
      const userId = g.served_by_id as number;
      const totalSales = Number(g._sum.total_amount ?? 0);
      const refunds = refundsByUser.get(userId) ?? { amount: 0, count: 0 };

      return {
        id: userId,
        name: userMap.get(userId)?.name ?? 'Unknown',
        email: userMap.get(userId)?.email ?? null,
        totalSales,
        salesCount: g._count.id,
        totalRefunds: refunds.amount,
        returnsCount: refunds.count,
        netSales: totalSales - refunds.amount,
      };
    });
  }

  async getUserSalesDetail(
    consumerId: number,
    servedById: number,
    startDate: string,
    endDate: string,
    branchId?: number,
    page = 1,
    limit = 20,
  ) {
    // const start = new Date(startDate);
    // const end = new Date(endDate);
    // end.setHours(23, 59, 59, 999);
    const start = this.parseLocalDateStart(startDate);
    const end = this.parseLocalDateEnd(endDate);
    const where: any = {
      consumer_id: consumerId,
      sale_type: SaleType.SALE,
      deleted_at: null,
      served_by_id: servedById,
      payment_status: { not: PaymentStatus.CANCELLED },
      sale_date: {
        gte: start,
        lte: end,
      },
    };

    if (branchId) {
      where.branch_id = branchId;
    }

    const servedByUser = await this.prisma.user.findFirst({
      where: { id: servedById, consumer_id: consumerId },
      select: { id: true, name: true, email: true },
    });

    if (!servedByUser) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * limit;

    const [sales, total, totals] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sale_date: 'desc' },
        select: {
          id: true,
          sale_number: true,
          sale_date: true,
          total_amount: true,
          payment_status: true,
          customer_name: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),

      this.prisma.sale.count({ where }),

      this.prisma.sale.aggregate({
        where,
        _sum: {
          total_amount: true,
        },
      }),
    ]);

    // Refunds booked against this salesperson's sales in the same period, plus
    // a per-row refund so an individual line explains itself.
    const refunds = await this.prisma.return.findMany({
      where: { consumer_id: consumerId, original_sale: where },
      select: { total_refund: true, original_sale_id: true },
    });

    const refundBySaleId = new Map<number, number>();
    let totalRefund = 0;
    for (const refund of refunds) {
      const amount = Number(refund.total_refund);
      totalRefund += amount;
      refundBySaleId.set(
        refund.original_sale_id,
        (refundBySaleId.get(refund.original_sale_id) ?? 0) + amount,
      );
    }

    const totalAmount = Number(totals._sum.total_amount ?? 0);

    return {
      user: servedByUser,
      data: sales.map((sale) => {
        const refunded = refundBySaleId.get(sale.id) ?? 0;
        return {
          ...sale,
          total_refund: refunded,
          net_amount: Number(sale.total_amount) - refunded,
        };
      }),
      meta: {
        total,
        total_amount: totalAmount,
        total_refund: totalRefund,
        net_amount: totalAmount - totalRefund,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // date helper
  private parseLocalDateStart(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${dateStr}`);
    }

    return date;
  }

  private parseLocalDateEnd(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 23, 59, 59, 999);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${dateStr}`);
    }

    return date;
  }
  // ========== ONLINE ORDER METHODS ==========

  async findAllOnlineOrders(filters: any, consumerId: number) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        branch_id,
        status,
        date_from,
        date_to,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = filters;

      // Query-string values arrive as text; Prisma wants real numbers
      const pageNumber = Math.max(1, Number(page) || 1);
      const limitNumber = Math.min(100, Math.max(1, Number(limit) || 20));
      const skip = (pageNumber - 1) * limitNumber;

      const where: any = {
        consumer_id: consumerId,
        sale_type: SaleType.SALE,
        is_online_order: true,
        deleted_at: null,
      };

      if (search) {
        where.OR = [
          { sale_number: { contains: search, mode: 'insensitive' } },
          { customer_name: { contains: search, mode: 'insensitive' } },
          { customer_phone: { contains: search, mode: 'insensitive' } },
          { customer_email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (branch_id) {
        where.branch_id = Number(branch_id);
      }

      if (status) {
        where.online_order_status = status;
      }

      if (date_from || date_to) {
        where.sale_date = {};
        if (date_from) {
          where.sale_date.gte = new Date(date_from);
        }
        if (date_to) {
          where.sale_date.lte = new Date(date_to);
        }
      }

      const [orders, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          skip,
          take: limitNumber,
          orderBy: { [sort_by]: sort_order },
          include: {
            customer: true,
            branch: true,
            user: { select: { id: true, name: true } },
            served_by: { select: { id: true, name: true } },
            payments: true,
            items: {
              include: {
                variant: {
                  include: {
                    product: true,
                    sale_unit: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNumber);

      // Calculate summary stats by status
      const statusCounts = await this.prisma.sale.groupBy({
        by: ['online_order_status'],
        where: {
          consumer_id: consumerId,
          is_online_order: true,
          deleted_at: null,
        },
        _count: true,
        _sum: { total_amount: true },
      });

      const summary = statusCounts.reduce(
        (acc, item) => {
          const status = item.online_order_status || 'PENDING';
          acc[status.toLowerCase()] = {
            count: item._count,
            total: Number(item._sum.total_amount) || 0,
          };
          return acc;
        },
        {} as Record<string, { count: number; total: number }>,
      );

      return {
        data: orders,
        meta: {
          total,
          page: pageNumber,
          limit: limitNumber,
          total_pages: totalPages,
        },
        summary,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching online orders for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching online orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateOnlineOrderStatus(
    id: number,
    status: string,
    consumerId: number,
    deliveryPartner?: string | null,
  ) {
    try {
      // Verify the sale exists and is an online order
      const sale = await this.prisma.sale.findFirst({
        where: {
          id,
          consumer_id: consumerId,
          is_online_order: true,
          deleted_at: null,
        },
      });

      if (!sale) {
        throw new NotFoundException('Online order not found');
      }

      // Update the order status
      const updatedSale = await this.prisma.sale.update({
        where: { id },
        data: {
          online_order_status: status,
          delivery_partner:
            deliveryPartner === undefined
              ? undefined
              : deliveryPartner?.trim() || null,
        },
        include: {
          customer: true,
          branch: true,
          user: { select: { id: true, name: true } },
          served_by: { select: { id: true, name: true } },
          payments: true,
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                  sale_unit: true,
                },
              },
            },
          },
        },
      });

      return updatedSale;
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error updating online order status for consumer ${consumerId} and order ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error updating online order status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getOnlineOrderStats(consumerId: number, branchId?: number) {
    try {
      const baseWhere: any = {
        consumer_id: consumerId,
        is_online_order: true,
        sale_type: 'sale',
        deleted_at: null,
      };

      if (branchId) {
        baseWhere.branch_id = branchId;
      }

      // Get counts by status
      const statusCounts = await this.prisma.sale.groupBy({
        by: ['online_order_status'],
        where: baseWhere,
        _count: true,
        _sum: { total_amount: true },
      });

      const stats = statusCounts.reduce(
        (acc, item) => {
          const status = item.online_order_status || 'PENDING';
          acc[status.toLowerCase()] = {
            count: item._count,
            total: Number(item._sum.total_amount) || 0,
          };
          return acc;
        },
        {} as Record<string, { count: number; total: number }>,
      );

      // Get today's online orders
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const todayStats = await this.prisma.sale.aggregate({
        where: { ...baseWhere, sale_date: { gte: todayStart } },
        _count: true,
        _sum: { total_amount: true },
      });

      // by_status stays gross: those buckets describe where orders sit in the
      // pipeline, not revenue. Today's money figure does net out refunds.
      const todayRefunds = await this.prisma.return.aggregate({
        where: {
          consumer_id: consumerId,
          ...(branchId ? { branch_id: branchId } : {}),
          return_date: { gte: todayStart },
          original_sale: { is_online_order: true },
        },
        _sum: { total_refund: true },
      });

      const todayTotal = Number(todayStats._sum.total_amount) || 0;
      const todayRefund = Number(todayRefunds._sum.total_refund) || 0;

      return {
        by_status: stats,
        today: {
          count: todayStats._count || 0,
          total: todayTotal,
          refund: todayRefund,
          net_total: todayTotal - todayRefund,
        },
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching online order stats for consumer ${consumerId} and branch ${branchId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Error fetching online order stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPendingDeliveries(consumerId: number, filters: any) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const where: any = {
      consumer_id: consumerId,
      is_delivery_later: true,
      deleted_at: null,
    };
    if (filters.status) where.delivery_status = filters.status;
    if (filters.branch_id) where.branch_id = Number(filters.branch_id);
    if (filters.search) {
      where.OR = [
        { sale_number: { contains: filters.search, mode: 'insensitive' } },
        { customer_name: { contains: filters.search, mode: 'insensitive' } },
        { customer_phone: { contains: filters.search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          branch: true,
          customer: true,
          items: {
            include: {
              variant: { include: { product: true, sale_unit: true } },
              batch: true,
            },
          },
          payments: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async completePendingDelivery(
    id: number,
    consumerId: number,
    userId: number,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        is_delivery_later: true,
        delivery_status: 'PENDING',
        deleted_at: null,
      },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Pending delivery not found');

    await this.prisma.$transaction(async (tx) => {
      // Claim the transition first so a concurrent complete/cancel cannot also
      // move the reserved stock
      const claimed = await tx.sale.updateMany({
        where: { id, delivery_status: 'PENDING' },
        data: { delivery_status: 'DELIVERED', delivered_at: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Delivery is no longer pending.');
      }

      for (const item of sale.items) {
        if (!item.batch_id) continue;
        const updated = await takeReservedStock(
          tx,
          item.batch_id,
          item.quantity,
        );
        if (!updated) {
          throw new BadRequestException(
            'Reserved inventory is no longer available for this delivery.',
          );
        }
        await tx.inventoryAuditLog.create({
          data: {
            consumer_id: consumerId,
            branch_id: sale.branch_id,
            variant_id: item.variant_id,
            batch_id: item.batch_id,
            inventoryBatchId: item.batch_id,
            event_type: 'SALE_OUT',
            quantity_delta: -item.quantity,
            quantity_after: updated.quantity,
            reference_id: item.id,
            reference_type: 'sale_items',
            notes: `Delivery completed for sale #${sale.sale_number}`,
            created_by_user_id: userId,
          },
        });
      }
    });
    return this.findOne(id, consumerId);
  }

  async cancelPendingDelivery(id: number, consumerId: number) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        is_delivery_later: true,
        delivery_status: 'PENDING',
        deleted_at: null,
      },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Pending delivery not found');
    await this.prisma.$transaction(async (tx) => {
      // Claim the transition first so the reservation is released only once
      const claimed = await tx.sale.updateMany({
        where: { id, delivery_status: 'PENDING' },
        data: { delivery_status: 'CANCELLED' },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Delivery is no longer pending.');
      }

      for (const item of sale.items) {
        if (!item.batch_id) continue;
        await tx.inventoryBatch.update({
          where: { id: item.batch_id },
          data: { reserved_quantity: { decrement: item.quantity } },
        });
      }
    });
    return this.findOne(id, consumerId);
  }

  async getDailyTargetReport(
    consumerId: number,
    dailyTargetDto: DailyTargetReportDto,
  ): Promise<DailyTargetReportResponse> {
    const reportDate = dailyTargetDto.date
      ? new Date(dailyTargetDto.date)
      : new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    const branchId = dailyTargetDto.branch_id ?? undefined;
    const page = dailyTargetDto.page ?? 1;
    const limit = dailyTargetDto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Resolve branch name if a branch was requested
    let branchName: string | undefined;
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { name: true },
      });
      branchName = branch?.name;
    }

    // Variants with variant-level daily target
    const variantsWithTarget = await this.prisma.productVariant.findMany({
      where: {
        daily_sale_objective: { gt: 0 },
        product: {
          consumer_id: consumerId,
        },
        // Only show variants that have inventory in the selected branch
        ...(branchId
          ? { inventory_items: { some: { branch_id: branchId } } }
          : {}),
      },

      select: {
        id: true,
        name: true,
        sku: true,
        regular_price: true,
        daily_sale_objective: true,
        product: {
          select: { id: true, name: true },
        },
      },
    });
    // (pivot aggregation)
    // Collapse many SaleItem rows → one quantity-sum per variant_id
    // When branch is selected, only count sales from that branch
    const soldGrouped = await this.prisma.saleItem.groupBy({
      by: ['variant_id'],
      where: {
        sale: {
          consumer_id: consumerId,
          sale_type: SaleType.SALE,
          deleted_at: null,
          sale_date: { gte: startOfDay, lte: endOfDay },
          ...(branchId ? { branch_id: branchId } : {}),
        },
      },
      _sum: { quantity: true, line_total: true },
    });

    // Units handed back in the same period. A sale that was returned did not
    // move stock, so it cannot count towards the day's target.
    const returnedGrouped = await this.prisma.returnItem.groupBy({
      by: ['variant_id'],
      where: {
        return_record: {
          consumer_id: consumerId,
          return_date: { gte: startOfDay, lte: endOfDay },
          ...(branchId ? { branch_id: branchId } : {}),
        },
      },
      _sum: { quantity: true },
    });

    // PIVOT MERGE
    const actualMap = new Map<number, { qty: number; amount: number }>(
      soldGrouped.map((row) => [
        row.variant_id,
        {
          qty: row._sum.quantity ?? 0,
          amount: Number(row._sum.line_total ?? 0),
        },
      ]),
    );

    const returnedMap = new Map<number, number>(
      returnedGrouped.map((row) => [row.variant_id, row._sum.quantity ?? 0]),
    );

    const rows: DailyTargetRow[] = variantsWithTarget.map((variant) => {
      const daily_target = variant.daily_sale_objective ?? 0;

      const actual = actualMap.get(variant.id) ?? { qty: 0, amount: 0 };
      const gross_sold = actual.qty;
      const returned = returnedMap.get(variant.id) ?? 0;
      // Returns of older sales can outrun today's sales; a negative target
      // reading is noise, so the floor is zero.
      const actual_sold = Math.max(0, gross_sold - returned);

      const achievement_pct =
        daily_target > 0
          ? Math.round((actual_sold / daily_target) * 10000) / 100
          : 0;
      const remaining_gap = daily_target - actual_sold;
      const gap = remaining_gap > 0 ? remaining_gap : 0;
      return {
        product_id: variant.product.id,
        product_name: variant.product.name,
        variant_id: variant.id,
        variant_name: variant.name,
        sku: variant.sku ?? undefined,
        daily_target,
        gross_sold,
        returned,
        actual_sold,
        achievement_pct,
        gap,
      };
    });

    const total_target = rows.reduce((s, r) => s + r.daily_target, 0);
    const total_gross_sold = rows.reduce((s, r) => s + r.gross_sold, 0);
    const total_returned = rows.reduce((s, r) => s + r.returned, 0);
    const total_sold = rows.reduce((s, r) => s + r.actual_sold, 0);

    const overall_achievement_pct =
      total_target > 0
        ? Math.round((total_sold / total_target) * 10000) / 100
        : 0;

    const total = rows.length;
    const paginatedRows = rows.slice(skip, skip + limit);

    return {
      date: toLocalDateString(reportDate),
      branch_id: branchId,
      branch_name: branchName,
      rows: paginatedRows,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      summary: {
        total_target,
        total_gross_sold,
        total_returned,
        total_sold,
        overall_achievement_pct,
        // targeted_amount,
        // total_amount,
        // average_amount,
      },
    };
  }
}
