import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReturnDto } from '../dto/create-return.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';

@Injectable()
export class ReturnService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async create(consumerId: number, userId: number, dto: CreateReturnDto) {
    // Verify the original sale exists and belongs to this consumer
    const originalSale = await this.prisma.sale.findFirst({
      where: {
        id: dto.original_sale_id,
        consumer_id: consumerId,
      },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!originalSale) {
      throw new NotFoundException('Original sale not found');
    }

    // Verify branch belongs to consumer
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branch_id,
        consumer_id: consumerId,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Validate return items against original sale items
    const saleItemIds = originalSale.items.map(item => item.id);
    const invalidItems = dto.items.filter(item => !saleItemIds.includes(item.sale_item_id));
    
    if (invalidItems.length > 0) {
      throw new BadRequestException('Some return items do not belong to the original sale');
    }

    // Validate return quantities don't exceed original quantities
    for (const returnItem of dto.items) {
      const originalItem = originalSale.items.find(item => item.id === returnItem.sale_item_id);
      if (!originalItem) {
        throw new BadRequestException(`Sale item ${returnItem.sale_item_id} not found`);
      }

      // Check if we already have returns for this item
      const existingReturns = await this.prisma.returnItem.aggregate({
        where: {
          sale_item_id: returnItem.sale_item_id,
        },
        _sum: {
          quantity: true,
        },
      });

      const totalReturned = existingReturns._sum?.quantity || 0;
      if (totalReturned + returnItem.quantity > originalItem.quantity) {
        throw new BadRequestException(
          `Return quantity exceeds available quantity for item ${returnItem.sale_item_id}. Available: ${originalItem.quantity - totalReturned}, Requested: ${returnItem.quantity}`
        );
      }
    }

    // Calculate totals based on business logic:
    // - totalRefund = sum of all payment methods EXCEPT 'EXCHANGE' and 'CREDIT'
    // - totalExchange = sum of only 'EXCHANGE' payment methods
    
    const totalRefund = dto.payments?.reduce((sum, payment) => {
      const method = payment.payment_method.toString().toUpperCase();
    
      if (method !== 'EXCHANGE' && method !== 'CREDIT') {
        console.log(`Adding ${payment.amount} to refund total`);
        return sum + parseFloat(payment.amount.toString());
      }
  
      return sum;
    }, 0) || 0;
    
    const totalExchange = dto.payments?.reduce((sum, payment) => {
      const method = payment.payment_method.toString().toUpperCase();
      if (method === 'EXCHANGE') {
        console.log(`Adding ${payment.amount} to exchange total`);
        return sum + parseFloat(payment.amount.toString());
      }
      return sum;
    }, 0) || 0;
    
    console.log('Calculated totals:', { totalRefund, totalExchange });
    
    const totalPayments = dto.payments?.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0) || 0;

    // Calculate available amount by checking existing returns for this sale
    const existingReturns = await this.prisma.return.findMany({
      where: {
        original_sale_id: dto.original_sale_id,
      },
    });

    const totalAlreadyReturned = existingReturns.reduce((sum, ret) => 
      sum + parseFloat(ret.total_refund.toString()) + parseFloat(ret.total_exchange.toString()), 0
    );

    const availableAmount = parseFloat(originalSale.total_amount.toString()) - totalAlreadyReturned;

    // Validate that total refund + exchange doesn't exceed available amount
    if (totalRefund + totalExchange > availableAmount) {
      throw new BadRequestException(
        `Total refund and exchange amount ($${(totalRefund + totalExchange).toFixed(2)}) exceeds available amount ($${availableAmount.toFixed(2)}). Already returned: $${totalAlreadyReturned.toFixed(2)}`
      );
    }
    // Start transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      // Generate return number
      const returnNumber = await this.generateReturnNumber(consumerId);

      // Create return record
      const returnRecord = await prisma.return.create({
        data: {
          return_number: returnNumber,
          original_sale_id: dto.original_sale_id,
          consumer_id: consumerId,
          branch_id: dto.branch_id,
          user_id: userId,
          exchange_sale_id: dto.exchange_sale_id,
          total_refund: totalRefund,
          total_exchange: totalExchange,
          reason: dto.reason,
          notes: dto.notes,
        },
        include: {
          original_sale: {
            select: {
              id: true,
              sale_number: true,
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
      });

      // Create return items and handle inventory adjustments
      const returnItems: any[] = [];
      for (const itemDto of dto.items) {
        const returnItem = await prisma.returnItem.create({
          data: {
            return_id: returnRecord.id,
            sale_item_id: itemDto.sale_item_id,
            variant_id: itemDto.variant_id,
            batch_id: itemDto.batch_id,
            quantity: itemDto.quantity,
          },
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
            batch: true,
          },
        });

        returnItems.push(returnItem);

        // Create inventory adjustment to add returned items back to stock
        if (itemDto.batch_id) {
          await prisma.inventoryAdjustment.create({
            data: {
              variant_id: itemDto.variant_id,
              branch_id: dto.branch_id,
              batch_id: itemDto.batch_id,
              quantity_change: itemDto.quantity, // Positive for return to stock
              reason: `Return from sale ${originalSale.sale_number}`,
              notes: `Return ID: ${returnNumber}`,
              created_by_user_id: userId,
            },
          });

          // Update batch quantity
          await prisma.inventoryBatch.update({
            where: { id: itemDto.batch_id },
            data: {
              quantity: {
                increment: itemDto.quantity,
              },
            },
          });
        }
      }

      // Create return payments if provided
      const returnPayments: any[] = [];
      if (dto.payments) {
        for (const paymentDto of dto.payments) {
          const returnPayment = await prisma.returnPayment.create({
            data: {
              return_id: returnRecord.id,
              payment_method: paymentDto.payment_method,
              amount: paymentDto.amount,
              reference: paymentDto.reference,
              notes: paymentDto.notes,
            },
          });
          returnPayments.push(returnPayment);
        }
      }

      // Create return exchanges and handle inventory deductions
      const returnExchanges: any[] = [];
      if (dto.exchanges) {
        for (const exchangeDto of dto.exchanges) {
          // Verify exchange variant belongs to consumer
          const exchangeVariant = await prisma.productVariant.findFirst({
            where: {
              id: exchangeDto.variant_id,
              product: { consumer_id: consumerId },
            },
          });

          if (!exchangeVariant) {
            throw new NotFoundException(`Exchange variant ${exchangeDto.variant_id} not found`);
          }

          const returnExchange = await prisma.returnExchange.create({
            data: {
              return_id: returnRecord.id,
              variant_id: exchangeDto.variant_id,
              batch_id: exchangeDto.batch_id,
              quantity: exchangeDto.quantity,
              unit_price: exchangeDto.unit_price,
              line_total: exchangeDto.line_total,
            },
            include: {
              variant: {
                include: {
                  product: { select: { id: true, name: true } },
                },
              },
              batch: true,
            },
          });

          returnExchanges.push(returnExchange);

          // Create inventory adjustment to deduct exchanged items from stock
          if (exchangeDto.batch_id) {
            // Verify sufficient stock exists
            const batch = await prisma.inventoryBatch.findUnique({
              where: { id: exchangeDto.batch_id },
            });

            if (!batch || batch.quantity < exchangeDto.quantity) {
              throw new BadRequestException(
                `Insufficient stock for exchange item ${exchangeDto.variant_id}. Available: ${batch?.quantity || 0}, Required: ${exchangeDto.quantity}`
              );
            }

            await prisma.inventoryAdjustment.create({
              data: {
                variant_id: exchangeDto.variant_id,
                branch_id: dto.branch_id,
                batch_id: exchangeDto.batch_id,
                quantity_change: -exchangeDto.quantity, // Negative for outgoing exchange
                reason: `Exchange from return ${returnNumber}`,
                notes: `Return ID: ${returnNumber}`,
                created_by_user_id: userId,
              },
            });

            // Update batch quantity
            await prisma.inventoryBatch.update({
              where: { id: exchangeDto.batch_id },
              data: {
                quantity: {
                  decrement: exchangeDto.quantity,
                },
              },
            });
          }
        }
      }

      return {
        ...returnRecord,
        items: returnItems,
        payments: returnPayments,
        exchanges: returnExchanges,
      };
    });

    // Invalidate related caches after successful creation
    await this.invalidateReturnCaches(consumerId, dto.branch_id, dto.original_sale_id);

    return result;
  }

  async findAll(
    consumerId: number,
    options: {
      page?: number;
      limit?: number;
      branch_id?: number;
      original_sale_id?: number;
    } = {},
  ) {
    const { page = 1, limit = 10, branch_id, original_sale_id } = options;
    const cacheKey = generateCacheKey.returnList(consumerId, page, limit, branch_id, original_sale_id);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      const skip = (page - 1) * limit;

      const whereClause: any = {
        consumer_id: consumerId,
      };

      if (branch_id) {
        whereClause.branch_id = branch_id;
      }

      if (original_sale_id) {
        whereClause.original_sale_id = original_sale_id;
      }

      const [returns, total] = await Promise.all([
        this.prisma.return.findMany({
          where: whereClause,
          include: {
            original_sale: {
              select: {
                id: true,
                sale_number: true,
                customer_name: true,
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
            items: {
              include: {
                variant: {
                  include: {
                    product: { select: { id: true, name: true } },
                  },
                },
              },
            },
            payments: true,
            exchanges: {
              include: {
                variant: {
                  include: {
                    product: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.return.count({
          where: whereClause,
        }),
      ]);

      return {
        data: returns,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }, 300); // 5 minutes cache
  }

  async findOne(id: number, consumerId: number) {
    const cacheKey = generateCacheKey.returnDetail(id, consumerId);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      const returnRecord = await this.prisma.return.findFirst({
        where: {
          id,
          consumer_id: consumerId,
        },
        include: {
          original_sale: {
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              payments: true,
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
          items: {
            include: {
              sale_item: {
                include: {
                  variant: {
                    include: {
                      product: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              variant: {
                include: {
                  product: { select: { id: true, name: true } },
                },
              },
              batch: true,
            },
          },
          payments: true,
          exchanges: {
            include: {
              variant: {
                include: {
                  product: { select: { id: true, name: true } },
                },
              },
              batch: true,
            },
          },
        },
      });

      if (!returnRecord) {
        throw new NotFoundException('Return not found');
      }

      return returnRecord;
    }, 300); // 5 minutes cache
  }

  private async generateReturnNumber(consumerId: number): Promise<string> {
    const prefix = 'RET';
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the count of returns created today for this consumer
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const count = await this.prisma.return.count({
      where: {
        consumer_id: consumerId,
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${dateString}-${sequence}`;
  }

  // Cache invalidation helper methods
  private async invalidateReturnCaches(consumerId: number, branchId?: number, saleId?: number) {
    try {
      // For return operations, invalidate:
      // 1. ALL inventory-related caches (because we're adjusting inventory)
      // 2. ALL sales-related caches (because returns affect sales data)
      // 3. Return-specific caches
      const patterns = [
        ...generateCachePatterns.allInventoryRelated(consumerId),
        ...generateCachePatterns.allSalesRelated(consumerId),
        `${consumerId}:return*`, // All return caches
      ];

      await this.cacheService.delPatterns(patterns);
    } catch (error) {
      console.error('Return cache invalidation error:', error);
    }
  }
}
