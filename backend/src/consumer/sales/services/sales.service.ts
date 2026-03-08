import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import {
  generateCacheKey,
  generateCachePatterns,
} from '../../../constants/cache-keys';
import { CreateSaleDto, PaymentStatus, SaleType } from '../dto/create-sale.dto';
import { SaleListFiltersDto } from '../dto/sale-list-filters.dto';
import {
  EODReportDto,
  EODReportResponse,
  PaymentMethodBreakdown,
  ProductSalesStats,
  EODSummary,
} from '../dto/eod-report.dto';
import { RewardsService } from '../../../consumer/rewards/services/rewards.service';
import { QuotationPdfService } from './quotation-pdf.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private rewardsService: RewardsService,
    private quotationPdfService: QuotationPdfService,
  ) {}

  async create(
    createSaleDto: CreateSaleDto,
    consumerId: number,
    userId: number,
  ) {
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
          },
        });

        if (!variant) {
          throw new BadRequestException(
            `Product variant ${item.variant_id} not found`,
          );
        }

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
          availableStock = selectedBatch.quantity;
        } else {
          // Use FIFO (First In, First Out) - oldest batch first
          selectedBatch = variant.inventory_items
            .filter((batch) => batch.quantity > 0)
            .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];

          if (!selectedBatch) {
            throw new BadRequestException(
              `No stock available for variant ${item.variant_id}`,
            );
          }
          availableStock = selectedBatch.quantity;
        }

        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for variant ${item.variant_id}. Available: ${availableStock}, Requested: ${item.quantity}`,
          );
        }

        return { ...item, selectedBatch };
      }),
    );

    // Generate sale or quotation number based on sale_type
    const saleNumber =
      createSaleDto.sale_type === SaleType.QUOTATION
        ? await this.generateQuotationNumber(consumerId)
        : await this.generateSaleNumber(consumerId);

    // DEBUG: Log the incoming data to understand the calculation mismatch
    console.log('=== SALE CREATION DEBUG ===');
    console.log('Items received from frontend:');
    createSaleDto.items.forEach((item, index) => {
      console.log(`Item ${index + 1}:`, {
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        tax_amount: item.tax_amount,
        calculated_base: Number(item.line_total) - Number(item.tax_amount || 0),
      });
    });

    // Calculate totals using frontend-calculated values
    // The frontend has already calculated correct subtotal, tax, and totals considering INCLUSIVE/EXCLUSIVE tax
    // We should trust the frontend calculations instead of recalculating here

    // Use the frontend's calculated subtotal directly (it's passed in the DTO if available)
    // If not available, calculate it properly by checking each item's tax method
    let subtotal = 0;
    let totalTax = 0;

    // For now, use the simpler approach: trust frontend calculations
    // Subtotal = sum of (line_total - tax_amount) for all items
    subtotal = createSaleDto.items.reduce((sum, item) => {
      return sum + (Number(item.line_total) - Number(item.tax_amount || 0));
    }, 0);

    totalTax = createSaleDto.items.reduce(
      (sum, item) => sum + (Number(item.tax_amount) || 0),
      0,
    );

    const discountAmount = Number(createSaleDto.discount_amount) || 0;
    const shippingCost = Number(createSaleDto.shipping_cost) || 0;

    // Total = subtotal - discount + tax + shipping (same as frontend)
    const totalAmount = subtotal - discountAmount + totalTax + shippingCost;

    console.log('Backend calculated totals:', {
      subtotal,
      totalTax,
      discountAmount,
      shippingCost,
      totalAmount,
    });
    console.log('=== END DEBUG ===');
    const receivedAmount = createSaleDto.received_amount || 0;
    // Calculate payment totals and determine payment status
    let totalPaymentAmount = 0;
    let paymentMethods: string[] = [];

    if (createSaleDto.payments && createSaleDto.payments.length > 0) {
      // Using new partial payment system
      totalPaymentAmount = createSaleDto.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      paymentMethods = createSaleDto.payments.map((p) => p.payment_method);
    } else {
      // No payments provided - set as due
      totalPaymentAmount = 0;
      paymentMethods = [];
    }

    // Determine payment status
    let paymentStatus = PaymentStatus.PAID;
    if (totalPaymentAmount < totalAmount) {
      paymentStatus = PaymentStatus.PARTIAL;
    } else if (totalPaymentAmount === 0) {
      paymentStatus = PaymentStatus.DUE;
    }

    const changeAmount = Math.max(0, totalPaymentAmount - totalAmount);

    // Create sale with items in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({
        data: {
          sale_number: saleNumber,
          consumer_id: consumerId,
          customer_id: createSaleDto.customer_id,
          customer_name: createSaleDto.customer_name,
          customer_phone: createSaleDto.customer_phone,
          customer_email: createSaleDto.customer_email,
          branch_id: createSaleDto.branch_id,
          user_id: userId,
          served_by_id: createSaleDto.served_by_id,
          sale_type: createSaleDto.sale_type || SaleType.SALE,
          price_type: createSaleDto.price_type || 'regular',
          subtotal,
          discount_type: createSaleDto.discount_type || 'flat',
          discount_amount: discountAmount,
          shipping_cost: shippingCost,
          tax_amount: totalTax,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          received_amount: totalPaymentAmount,
          change_amount: changeAmount,
          notes: createSaleDto.notes,
          is_online_order: createSaleDto.is_online_order || false,
          online_order_status: createSaleDto.is_online_order
            ? createSaleDto.online_order_status || 'PENDING'
            : null,
        },
      });

      // If converting from quotation, mark the quotation as converted
      if (createSaleDto.quotation_id) {
        await tx.sale.update({
          where: { id: createSaleDto.quotation_id },
          data: {
            converted_to_sale_id: sale.id,
            converted_at: new Date(),
          },
        });
      }

      // Create sale payments if using new system
      if (createSaleDto.payments && createSaleDto.payments.length > 0) {
        await Promise.all(
          createSaleDto.payments.map(async (payment) => {
            // Skip CREDIT payment processing inside transaction - will handle after
            return tx.salePayment.create({
              data: {
                sale_id: sale.id,
                payment_method: payment.payment_method,
                amount: payment.amount,
                reference: payment.reference,
                notes: payment.notes,
              },
            });
          }),
        );
      }

      // Create sale items and update inventory
      await Promise.all(
        validationResults.map(async (item) => {
          // Create sale item
          await tx.saleItem.create({
            data: {
              sale_id: sale.id,
              variant_id: item.variant_id,
              batch_id: item.selectedBatch?.id || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_amount: item.discount_amount || 0,
              tax_amount: item.tax_amount || 0,
              line_total: item.line_total,
            },
          });

          // Only update inventory for actual sales, not quotations
          if (!isQuotation && item.selectedBatch) {
            await tx.inventoryBatch.update({
              where: { id: item.selectedBatch.id },
              data: {
                quantity: { decrement: item.quantity },
              },
            });
          }
        }),
      );

      return sale;
    });

    // Process CREDIT payments after sale is committed
    if (createSaleDto.payments && createSaleDto.payments.length > 0) {
      const creditPayments = createSaleDto.payments.filter(
        (payment) => payment.payment_method === 'CREDIT' && result.customer_id,
      );

      for (const payment of creditPayments) {
        try {
          await this.rewardsService.processCreditPayment(
            consumerId,
            result.customer_id!,
            Number(payment.amount),
            result.id,
            payment.reference,
          );
        } catch (error) {
          console.error('Failed to process CREDIT payment:', error);
          // Note: At this point the sale is already committed,
          // so we log the error but don't fail the sale
          // You might want to implement compensation logic here
        }
      }
    }

    // Award rewards points if sale is completed and customer is provided
    // Exclude CREDIT payment amounts from rewards calculation
    if (
      result.customer_id &&
      result.payment_status === 'paid' &&
      result.sale_type === 'sale'
    ) {
      try {
        // Calculate amount eligible for rewards (exclude CREDIT payments)
        const creditPaymentAmount =
          createSaleDto.payments
            ?.filter((payment) => payment.payment_method === 'CREDIT')
            .reduce((sum, payment) => sum + Number(payment.amount), 0) || 0;

        const rewardEligibleAmount =
          Number(result.total_amount) - creditPaymentAmount;

        // Only award points if there's a positive eligible amount
        if (rewardEligibleAmount > 0) {
          await this.rewardsService.earnPoints(
            consumerId,
            result.customer_id,
            result.id,
            rewardEligibleAmount,
          );
        }
      } catch (error) {
        // Don't fail the sale if rewards points fail
        console.error('Failed to award rewards points:', error);
      }
    }

    // Invalidate related caches after successful sale/quotation creation
    if (isQuotation) {
      await this.invalidateQuotationsCaches(consumerId);
    } else {
      await this.invalidateSalesCaches(consumerId, createSaleDto.branch_id);

      // If sale was created from a quotation, also invalidate quotation caches
      if (createSaleDto.quotation_id) {
        await this.invalidateQuotationsCaches(consumerId);
      }
    }

    // Return created sale/quotation with full details
    if (isQuotation) {
      return this.findOneQuotation(result.id, consumerId);
    } else {
      return this.findOne(result.id, consumerId);
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
    } = filters;

    // Generate cache key for this specific query
    const cacheKey = generateCacheKey.salesList(
      consumerId,
      page,
      limit,
      search,
      branch_id,
      payment_method,
      payment_status,
      date_from,
      date_to,
      sort_by,
      sort_order,
      source,
    );

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;

    const where: any = {
      consumer_id: consumerId,
      sale_type: SaleType.SALE, // Only return actual sales, not quotations
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

    // Cache the result for 2 minutes (sales data changes frequently)
    await this.cacheService.set(cacheKey, result, 120);

    return result;
  }

  async findOne(id: number, consumerId: number) {
    // Generate cache key for this specific sale
    const cacheKey = generateCacheKey.salesDetail(id, consumerId);

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        sale_type: SaleType.SALE, // Only return actual sales, not quotations
      },
      include: {
        customer: true,
        consumer: true, // Include consumer data directly
        branch: true,
        user: { select: { id: true, name: true } },
        served_by: { select: { id: true, name: true } },
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

    // Cache the sale for 5 minutes (individual sales don't change often)
    await this.cacheService.set(cacheKey, sale, 300);

    return sale;
  }

  async findBySaleNumber(saleNumber: string, consumerId: number) {
    // Generate cache key for this specific sale number search
    const cacheKey = generateCacheKey.saleByNumber(saleNumber, consumerId);

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        sale_number: saleNumber,
        consumer_id: consumerId,
        sale_type: SaleType.SALE, // Only return actual sales, not quotations
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

    const returnSummary = {
      total_returned: returns.length,
      total_refunded: totalRefunded,
      total_exchanged: totalExchanged,
      total_already_returned: totalAlreadyReturned,
      available_amount: Math.max(0, availableAmount), // Ensure it's never negative
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

    // Cache the sale with calculated quantities for 5 minutes
    await this.cacheService.set(cacheKey, saleWithReturnSummary, 300);

    return saleWithReturnSummary;
  }

  async getProductsForSale(
    consumerId: number,
    branchId: number,
    search?: string,
  ) {
    // Generate cache key for this specific query
    const cacheKey = generateCacheKey.productsForSale(
      consumerId,
      branchId,
      search,
    );

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

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
      ];
    }

    const variants = await this.prisma.productVariant.findMany({
      where,
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
      take: 50, // Limit results for performance
    });

    const result = variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      regular_price: variant.regular_price,
      wholesale_price: variant.wholesale_price,
      image: variant.image,
      product_name: variant.product.name,
      unit_name: variant.sale_unit.name,
      tax_percentage: variant.product.tax || 0,
      tax_method: variant.product.tax_method || 'exclusive',
    }));

    // Cache the result for 30 seconds (inventory changes frequently)
    await this.cacheService.set(cacheKey, result, 30);

    return result;
  }

  async getProductByBarcode(
    consumerId: number,
    branchId: number,
    barcode: string,
  ) {
    // Generate cache key for this specific query
    const cacheKey = generateCacheKey.productByBarcode(
      consumerId,
      branchId,
      barcode,
    );

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

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
      regular_price: variant.regular_price,
      wholesale_price: variant.wholesale_price,
      image: variant.image,
      product_name: variant.product.name,
      unit_name: variant.sale_unit.name,
      tax_percentage: variant.product.tax || 0,
      tax_method: variant.product.tax_method || 'exclusive',
    };

    // Cache the result for 30 seconds (inventory changes frequently)
    await this.cacheService.set(cacheKey, result, 30);

    return result;
  }

  async getSalesStats(consumerId: number, branchId?: number) {
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

    return {
      today_sales: todayStats._count || 0,
      today_amount: todayStats._sum.total_amount || 0,
      week_sales: weekStats._count || 0,
      week_amount: weekStats._sum.total_amount || 0,
      month_sales: monthStats._count || 0,
      month_amount: monthStats._sum.total_amount || 0,
      top_products: topProductsWithDetails,
    };
  }

  async getEODReport(
    consumerId: number,
    eodDto: EODReportDto,
  ): Promise<EODReportResponse> {
    // Parse date or use current date
    const reportDate = eodDto.date ? new Date(eodDto.date) : new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build where clause
    const whereClause: any = {
      sale_type: SaleType.SALE, // Only include actual sales in EOD, not quotations
      sale_mer_id: consumerId,
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

    // Calculate summary statistics
    const totalSales = sales.length;
    const totalAmount = sales.reduce(
      (sum, sale) => sum + Number(sale.total_amount),
      0,
    );
    const totalItemsSold = sales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );

    // Get unique products sold
    const uniqueProductIds = new Set();
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        uniqueProductIds.add(item.variant_id);
      });
    });

    // Payment method breakdown
    const paymentMethodMap = new Map<
      string,
      { total_amount: number; transaction_count: number }
    >();

    sales.forEach((sale) => {
      if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach((payment) => {
          const method = payment.payment_method;
          const existing = paymentMethodMap.get(method) || {
            total_amount: 0,
            transaction_count: 0,
          };
          paymentMethodMap.set(method, {
            total_amount: existing.total_amount + Number(payment.amount),
            transaction_count: existing.transaction_count + 1,
          });
        });
      }
    });

    const paymentMethodBreakdown: PaymentMethodBreakdown[] = Array.from(
      paymentMethodMap.entries(),
    ).map(([method, data]) => ({
      payment_method: method,
      total_amount: data.total_amount,
      transaction_count: data.transaction_count,
    }));

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

    const productSales: ProductSalesStats[] = Array.from(
      productSalesMap.entries(),
    )
      .map(([variantId, data]) => ({
        variant_id: variantId,
        variant_name: data.variant_name,
        product_name: data.product_name,
        sku: data.sku,
        quantity_sold: data.quantity_sold,
        total_amount: data.total_amount,
        average_unit_price: data.total_amount / data.quantity_sold,
      }))
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

    // Calculate cash vs non-cash sales
    const cashSales =
      paymentMethodBreakdown.find((p) => p.payment_method === 'CASH')
        ?.total_amount || 0;
    const nonCashSales = totalAmount - cashSales;

    const summary: EODSummary = {
      total_sales: totalSales,
      total_amount: totalAmount,
      total_transactions: totalSales,
      cash_sales: cashSales,
      non_cash_sales: nonCashSales,
      average_transaction_value: totalSales > 0 ? totalAmount / totalSales : 0,
      total_items_sold: totalItemsSold,
      unique_products_sold: uniqueProductIds.size,
    };

    return {
      date: reportDate.toISOString().split('T')[0],
      branch_name: branchName,
      summary,
      payment_method_breakdown: paymentMethodBreakdown,
      product_sales: productSales,
      hourly_sales: hourlySales,
      payment_status_breakdown: paymentStatusBreakdown,
    };
  }

  private async generateSaleNumber(consumerId: number): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const prefix = `SAL-${year}${month}${day}`;

    // Find the latest sale number for today
    const latestSale = await this.prisma.sale.findFirst({
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
  }

  private async generateQuotationNumber(consumerId: number): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const prefix = `QUO-${year}${month}${day}`;

    // Find the latest quotation number for today
    const latestQuotation = await this.prisma.sale.findFirst({
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
  }

  private async calculateSummaryStats(where: any) {
    const stats = await this.prisma.sale.aggregate({
      where,
      _count: true,
      _sum: { total_amount: true },
      _avg: { total_amount: true },
    });

    return {
      total_sales: stats._count || 0,
      total_amount: stats._sum.total_amount || 0,
      average_sale: stats._avg.total_amount || 0,
    };
  }

  /**
   * Invalidate sales-related caches after operations that modify data
   */
  private async invalidateSalesCaches(consumerId: number, branchId?: number) {
    try {
      // Invalidate all sales-related caches for this consumer
      const patterns = generateCachePatterns.allSalesRelated(consumerId);
      for (const pattern of patterns) {
        await this.cacheService.delPattern(pattern);
      }
    } catch (error) {
      this.cacheService['logger'].error(
        `Failed to invalidate sales caches:`,
        error,
      );
    }
  }

  /**
   * Invalidate quotation-related caches after operations that modify data
   */
  private async invalidateQuotationsCaches(consumerId: number) {
    try {
      // Invalidate all quotation-related caches for this consumer
      const pattern = generateCachePatterns.allQuotations(consumerId);
      await this.cacheService.delPattern(pattern);
    } catch (error) {
      this.cacheService['logger'].error(
        `Failed to invalidate quotation caches:`,
        error,
      );
    }
  }

  // ========== QUOTATION METHODS ==========

  async findAllQuotations(filters: SaleListFiltersDto, consumerId: number) {
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

    // Generate cache key for quotations query
    const cacheKey = generateCacheKey.quotationsList(
      consumerId,
      page,
      limit,
      search,
      branch_id,
      date_from,
      date_to,
      sort_by,
      sort_order,
      source,
    );

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const skip = (page - 1) * limit;

        const where: any = {
          consumer_id: consumerId,
          sale_type: SaleType.QUOTATION, // Only quotations
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

        return {
          data: quotations,
          meta: {
            total,
            page,
            limit,
            total_pages: totalPages,
          },
          summary,
        };
      },
      120,
    );
  }

  async findOneQuotation(id: number, consumerId: number) {
    // Generate cache key for this specific quotation
    const cacheKey = generateCacheKey.quotationDetail(id, consumerId);

    const quotation = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.sale.findFirst({
          where: {
            id,
            consumer_id: consumerId,
            sale_type: SaleType.QUOTATION,
          },
          include: {
            customer: true,
            consumer: true, // Include consumer data directly
            branch: true,
            served_by: { select: { id: true, name: true } },
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
      },
      300,
    );

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    return quotation;
  }

  async generateQuotationPdf(
    quotationId: number,
    consumerId: number,
  ): Promise<Buffer> {
    const quotation = await this.findOneQuotation(quotationId, consumerId);
    return this.quotationPdfService.generateQuotationPdf(quotation);
  }

  async convertQuotationToSale(
    quotationId: number,
    consumerId: number,
    userId: number,
  ) {
    // Get the quotation
    const quotation: any = await this.findOneQuotation(quotationId, consumerId);

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    // Check if quotation was already converted
    if (quotation.converted_to_sale_id) {
      throw new BadRequestException(
        `Quotation has already been converted to sale #${quotation.converted_to_sale_id}`,
      );
    }

    // Generate new sale number
    const saleNumber = await this.generateSaleNumber(consumerId);

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

        // Use FIFO for batch selection
        const selectedBatch = variant.inventory_items
          .filter((batch) => batch.quantity > 0)
          .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0];

        if (!selectedBatch) {
          throw new BadRequestException(
            `No stock available for variant ${item.variant_id}`,
          );
        }

        const availableStock = selectedBatch.quantity;

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
      // Create sale
      const sale = await tx.sale.create({
        data: {
          sale_number: saleNumber,
          consumer_id: consumerId,
          customer_id: quotation.customer_id,
          customer_name: quotation.customer_name,
          customer_phone: quotation.customer_phone,
          customer_email: quotation.customer_email,
          branch_id: quotation.branch_id,
          user_id: userId,
          served_by_id: quotation.served_by_id,
          sale_type: SaleType.SALE, // Convert to actual sale
          price_type: quotation.price_type,
          subtotal: quotation.subtotal,
          discount_type: quotation.discount_type,
          discount_amount: quotation.discount_amount,
          shipping_cost: quotation.shipping_cost,
          tax_amount: quotation.tax_amount,
          total_amount: quotation.total_amount,
          payment_status: PaymentStatus.DUE, // Default to DUE, user will process payment
          received_amount: 0,
          change_amount: 0,
          notes: quotation.notes,
        },
      });

      // Create sale items and update inventory
      await Promise.all(
        validationResults.map(async (item) => {
          // Create sale item
          await tx.saleItem.create({
            data: {
              sale_id: sale.id,
              variant_id: item.variant_id,
              batch_id: item.selectedBatch.id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_amount: item.discount_amount || 0,
              tax_amount: item.tax_amount || 0,
              line_total: item.line_total,
            },
          });

          // Update batch quantity
          await tx.inventoryBatch.update({
            where: { id: item.selectedBatch.id },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          });
        }),
      );

      // Mark quotation as converted
      await tx.sale.update({
        where: { id: quotationId },
        data: {
          converted_to_sale_id: sale.id,
        },
      });

      return sale;
    });

    // Invalidate both sales and quotation caches
    await Promise.all([
      this.invalidateSalesCaches(consumerId, quotation.branch_id),
      this.invalidateQuotationsCaches(consumerId),
    ]);

    return result;
  }

  // === USER SALES STATS METHODS ===

  async getUserSalesStats(
    consumerId: number,
    startDate: string,
    endDate: string,
    branchId?: number,
  ) {
    const start = new Date(startDate);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const whereClause: any = {
      consumer_id: consumerId,
      sale_type: SaleType.SALE,
      served_by_id: { not: null },
      sale_date: {
        gte: start,
        lte: end,
      },
    };

    if (branchId) {
      whereClause.branch_id = branchId;
    }

    const grouped = await this.prisma.sale.groupBy({
      by: ['served_by_id'],
      where: whereClause,
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

    const userIds = grouped.map((g) => g.served_by_id as number);

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped.map((g) => {
      const userId = g.served_by_id as number;

      return {
        id: userId,
        name: userMap.get(userId)?.name,
        email: userMap.get(userId)?.email,
        totalSales: Number(g._sum.total_amount || 0),
        salesCount: g._count.id,
      };
    });
  }

  async getUserSalesDetail(
    consumerId: number,
    servedById: number,
    startDate: string,
    endDate: string,
    branchId?: number,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const where: any = {
      consumer_id: consumerId,
      sale_type: SaleType.SALE,
      served_by_id: servedById,
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

    const sales = await this.prisma.sale.findMany({
      where,
      orderBy: { sale_date: 'desc' },
      include: {
        customer: true,
        branch: true,
        served_by: { select: { id: true, name: true } },
        payments: true,
        items: {
          include: {
            variant: {
              include: { product: true, sale_unit: true },
            },
          },
        },
      },
    });

    const totalAmount = sales.reduce(
      (sum, s) => sum + Number(s.total_amount),
      0,
    );

    return {
      user: servedByUser,
      data: sales,
      meta: {
        total: sales.length,
        total_amount: totalAmount,
      },
    };
  }
  // ========== ONLINE ORDER METHODS ==========

  async findAllOnlineOrders(filters: any, consumerId: number) {
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

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (page - 1) * limit;

    const where: any = {
      consumer_id: consumerId,
      sale_type: SaleType.SALE,
      is_online_order: true,
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

    const totalPages = Math.ceil(total / limit);

    // Calculate summary stats by status
    const statusCounts = await this.prisma.sale.groupBy({
      by: ['online_order_status'],
      where: {
        consumer_id: consumerId,
        is_online_order: true,
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
  }

  async updateOnlineOrderStatus(
    id: number,
    status: string,
    consumerId: number,
  ) {
    // Verify the sale exists and is an online order
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        consumer_id: consumerId,
        is_online_order: true,
      },
    });

    if (!sale) {
      throw new Error('Online order not found');
    }

    // Update the order status
    const updatedSale = await this.prisma.sale.update({
      where: { id },
      data: { online_order_status: status },
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

    // Invalidate caches
    await this.invalidateSalesCaches(consumerId, sale.branch_id);

    return updatedSale;
  }

  async getOnlineOrderStats(consumerId: number, branchId?: number) {
    const baseWhere: any = {
      consumer_id: consumerId,
      is_online_order: true,
      sale_type: 'sale',
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

    return {
      by_status: stats,
      today: {
        count: todayStats._count || 0,
        total: Number(todayStats._sum.total_amount) || 0,
      },
    };
  }
}
