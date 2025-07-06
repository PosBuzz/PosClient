import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';
import { CreateSaleDto, PaymentStatus, SaleType } from '../dto/create-sale.dto';
import { SaleListFiltersDto } from '../dto/sale-list-filters.dto';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async create(createSaleDto: CreateSaleDto, consumerId: number, userId: number) {
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

    // Validate items and check stock
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

        // Check stock availability
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

    // Generate sale number
    const saleNumber = await this.generateSaleNumber(consumerId);

    // Calculate totals
    const subtotal = createSaleDto.items.reduce(
      (sum, item) => sum + item.line_total,
      0,
    );
    const totalTax = createSaleDto.items.reduce(
      (sum, item) => sum + (item.tax_amount || 0),
      0,
    );
    const discountAmount = createSaleDto.discount_amount || 0;
    const shippingCost = createSaleDto.shipping_cost || 0;
    const totalAmount = subtotal + totalTax + shippingCost - discountAmount;
    const receivedAmount = createSaleDto.received_amount || 0;
    const changeAmount = receivedAmount - totalAmount;

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
          sale_type: createSaleDto.sale_type || SaleType.SALE,
          price_type: createSaleDto.price_type || 'regular',
          subtotal,
          discount_type: createSaleDto.discount_type || 'flat',
          discount_amount: discountAmount,
          shipping_cost: shippingCost,
          tax_amount: totalTax,
          total_amount: totalAmount,
          payment_method: createSaleDto.payment_method,
          payment_status: createSaleDto.payment_status || PaymentStatus.PAID,
          received_amount: receivedAmount,
          change_amount: changeAmount,
          notes: createSaleDto.notes,
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

          // Update inventory
          await tx.inventoryBatch.update({
            where: { id: item.selectedBatch.id },
            data: {
              quantity: { decrement: item.quantity },
            },
          });
        }),
      );

      return sale;
    });

    // Invalidate related caches after successful sale creation
    await this.invalidateSalesCaches(consumerId, createSaleDto.branch_id);

    // Return created sale with full details
    return this.findOne(result.id, consumerId);
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
    );

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;

    const where: any = {
      consumer_id: consumerId,
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
      where.payment_method = payment_method;
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
      where: { id, consumer_id: consumerId },
      include: {
        customer: true,
        branch: true,
        user: { select: { id: true, name: true } },
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

  async getProductsForSale(consumerId: number, branchId: number, search?: string) {
    // Generate cache key for this specific query
    const cacheKey = generateCacheKey.productsForSale(consumerId, branchId, search);

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
      available_stock: variant.inventory_items.reduce(
        (sum, batch) => sum + batch.quantity,
        0,
      ),
      unit_name: variant.sale_unit.name,
      tax_percentage: variant.product.tax || 0,
      batches: variant.inventory_items.map((batch) => ({
        id: batch.id,
        batch_number: batch.batch_number,
        quantity: batch.quantity,
        cost_price: batch.cost_price,
        expiry_date: batch.expiry_date,
      })),
    }));

    // Cache the result for 30 seconds (inventory changes frequently)
    await this.cacheService.set(cacheKey, result, 30);

    return result;
  }

  async getSalesStats(consumerId: number, branchId?: number) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
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

      this.cacheService['logger'].log(`🗑️ Invalidated sales caches for consumer ${consumerId}`);
    } catch (error) {
      this.cacheService['logger'].error(`Failed to invalidate sales caches:`, error);
    }
  }

  /**
   * Invalidate specific sale cache
   */
  private async invalidateSaleCache(saleId: number, consumerId: number) {
    try {
      const cacheKey = generateCacheKey.salesDetail(saleId, consumerId);
      await this.cacheService.del(cacheKey);
    } catch (error) {
      this.cacheService['logger'].error(`Failed to invalidate sale cache:`, error);
    }
  }
}
