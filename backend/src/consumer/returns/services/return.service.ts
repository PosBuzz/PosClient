import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReturnDto } from '../dto/create-return.dto';
import { RewardsService } from '../../rewards/services/rewards.service';

@Injectable()
export class ReturnService {
  private readonly logger = new Logger(ReturnService.name);
  constructor(
    private prisma: PrismaService,
    private rewardsService: RewardsService,
  ) {}

  async create(consumerId: number, userId: number, dto: CreateReturnDto) {
    try {
      // Verify the original sale exists and belongs to this consumer
      const originalSale = await this.prisma.sale.findFirst({
        where: {
          id: dto.original_sale_id,
          consumer_id: consumerId,
          deleted_at: null, // Cannot return against a deleted sale
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

      const shippingRefundAmount = Number(dto.shipping_refund_amount || 0);
      if (!Number.isFinite(shippingRefundAmount) || shippingRefundAmount < 0) {
        throw new BadRequestException(
          'Shipping refund amount must be a valid non-negative number',
        );
      }

      dto.items = dto.items.filter((item) => item.quantity > 0);

      // Validate return items against original sale items
      const saleItemIds = originalSale.items.map((item) => item.id);
      const invalidItems = dto.items.filter(
        (item) => !saleItemIds.includes(item.sale_item_id),
      );

      if (invalidItems.length > 0) {
        throw new BadRequestException(
          'Some return items do not belong to the original sale',
        );
      }

      // Validate return quantities don't exceed original quantities
      for (const returnItem of dto.items) {
        const originalItem = originalSale.items.find(
          (item) => item.id === returnItem.sale_item_id,
        );
        if (!originalItem) {
          throw new BadRequestException(
            `Sale item ${returnItem.sale_item_id} not found`,
          );
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
            `Return quantity exceeds available quantity for item ${returnItem.sale_item_id}. Available: ${originalItem.quantity - totalReturned}, Requested: ${returnItem.quantity}`,
          );
        }
      }

      // Calculate totals based on business logic
      if (!dto.payments || dto.payments.length === 0) {
        throw new BadRequestException(
          'At least one payment method is required to process a return',
        );
      }

      if (
        dto.payments.some(
          (payment) =>
            !Number.isFinite(Number(payment.amount)) ||
            Number(payment.amount) <= 0,
        )
      ) {
        throw new BadRequestException(
          'All payment amounts must be greater than 0',
        );
      }

      const itemReturnAmount = dto.items.reduce((sum, returnItem) => {
        const originalItem = originalSale.items.find(
          (item) => item.id === returnItem.sale_item_id,
        );

        if (!originalItem) {
          throw new BadRequestException(
            `Sale item ${returnItem.sale_item_id} not found`,
          );
        }

        const originalQty = Number(originalItem.quantity) || 0;
        const ratio =
          originalQty > 0 ? Number(returnItem.quantity) / originalQty : 0;
        const lineAmount = (Number(originalItem.line_total) || 0) * ratio;
        return sum + lineAmount;
      }, 0);

      const selectedReturnAmount = itemReturnAmount + shippingRefundAmount;

      const totalRefund =
        dto.payments?.reduce((sum, payment) => {
          const method = payment.payment_method.toString().toUpperCase();

          if (method !== 'EXCHANGE') {
            return sum + parseFloat(payment.amount.toString());
          }

          return sum;
        }, 0) || 0;

      const totalExchange =
        dto.payments?.reduce((sum, payment) => {
          const method = payment.payment_method.toString().toUpperCase();
          if (method === 'EXCHANGE') {
            return sum + parseFloat(payment.amount.toString());
          }
          return sum;
        }, 0) || 0;

      const totalPayments =
        dto.payments?.reduce(
          (sum, payment) => sum + parseFloat(payment.amount.toString()),
          0,
        ) || 0;

      // Calculate available amount by checking existing returns for this sale
      const existingReturns = await this.prisma.return.findMany({
        where: {
          original_sale_id: dto.original_sale_id,
        },
        include: {
          items: true,
        },
      });

      const totalAlreadyReturned = existingReturns.reduce(
        (sum, ret) =>
          sum +
          parseFloat(ret.total_refund.toString()) +
          parseFloat(ret.total_exchange.toString()),
        0,
      );

      const saleItemMap = new Map(
        originalSale.items.map((item) => [item.id, item]),
      );

      const totalItemValueAlreadyReturned = existingReturns.reduce(
        (sum, ret) => {
          const returnItemsValue = ret.items.reduce((itemSum, returnedItem) => {
            const originalItem = saleItemMap.get(returnedItem.sale_item_id);
            if (!originalItem) return itemSum;
            const originalQty = Number(originalItem.quantity) || 0;
            const ratio =
              originalQty > 0 ? Number(returnedItem.quantity) / originalQty : 0;
            return itemSum + (Number(originalItem.line_total) || 0) * ratio;
          }, 0);

          return sum + returnItemsValue;
        },
        0,
      );

      const shippingAlreadyRefunded = Math.max(
        0,
        totalAlreadyReturned - totalItemValueAlreadyReturned,
      );
      const availableShippingRefund = Math.max(
        0,
        Number(originalSale.shipping_cost || 0) - shippingAlreadyRefunded,
      );

      if (shippingRefundAmount > availableShippingRefund + 0.01) {
        throw new BadRequestException(
          `Shipping refund amount ($${shippingRefundAmount.toFixed(2)}) exceeds remaining refundable shipping ($${availableShippingRefund.toFixed(2)})`,
        );
      }

      const availableAmount =
        parseFloat(originalSale.total_amount.toString()) - totalAlreadyReturned;

      if (dto.items.length === 0 && shippingRefundAmount <= 0) {
        throw new BadRequestException(
          'Select at least one return item or add a shipping refund amount',
        );
      }

      if (selectedReturnAmount <= 0) {
        throw new BadRequestException(
          'Selected return amount must be greater than 0',
        );
      }

      if (selectedReturnAmount > availableAmount + 0.01) {
        throw new BadRequestException(
          `Selected return value ($${selectedReturnAmount.toFixed(2)}) exceeds available amount ($${availableAmount.toFixed(2)})`,
        );
      }

      if (Math.abs(totalPayments - selectedReturnAmount) > 0.01) {
        throw new BadRequestException(
          `Total payment amount must exactly match selected return value. Expected $${selectedReturnAmount.toFixed(2)}, got $${totalPayments.toFixed(2)}`,
        );
      }

      // Validate that total refund + exchange doesn't exceed available amount
      if (totalRefund + totalExchange > availableAmount) {
        throw new BadRequestException(
          `Total refund and exchange amount ($${(totalRefund + totalExchange).toFixed(2)}) exceeds available amount ($${availableAmount.toFixed(2)}). Already returned: $${totalAlreadyReturned.toFixed(2)}`,
        );
      }

      // Start transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Generate return number
        const returnNumber = await this.generateReturnNumber(
          consumerId,
          prisma,
        );

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
            const adjustment = await prisma.inventoryAdjustment.create({
              data: {
                variant_id: itemDto.variant_id,
                branch_id: dto.branch_id,
                batch_id: itemDto.batch_id,
                quantity_change: itemDto.quantity, // Positive for return to stock
                reason: `Return from sale ${originalSale.sale_number}`,
                notes: `Return ID: ${returnNumber}`,
                created_by_user_id: userId,
                adjustment_type: 'return_in',
              },
            });

            // Update batch quantity
            const updatedBatch = await prisma.inventoryBatch.update({
              where: { id: itemDto.batch_id },
              data: {
                quantity: {
                  increment: itemDto.quantity,
                },
              },
            });

            // Create RETURN_IN audit log
            await prisma.inventoryAuditLog.create({
              data: {
                consumer_id: consumerId,
                branch_id: dto.branch_id,
                variant_id: itemDto.variant_id,
                batch_id: itemDto.batch_id,
                inventoryBatchId: itemDto.batch_id,
                event_type: 'RETURN_IN',
                quantity_delta: itemDto.quantity,
                quantity_after: updatedBatch.quantity,
                reference_id: returnItem.id,
                reference_type: 'return_items',
                notes: `Return #${returnNumber} from sale ${originalSale.sale_number}`,
                created_by_user_id: userId,
              },
            });
          }
        }

        // Create return payments if provided
        const returnPayments: any[] = [];
        if (dto.payments) {
          for (const paymentDto of dto.payments) {
            // Handle CREDIT refund - add points back to customer
            if (
              paymentDto.payment_method === 'CREDIT' &&
              originalSale.customer_id
            ) {
              try {
                await this.rewardsService.processCreditRefund(
                  consumerId,
                  originalSale.customer_id,
                  Number(paymentDto.amount),
                  originalSale.id,
                  returnRecord.id,
                  paymentDto.reference,
                );
              } catch (error) {
                console.error('Failed to process CREDIT refund:', error);
              }
            }

            const returnPayment = await prisma.returnPayment.create({
              data: {
                return_id: returnRecord.id,
                payment_method: paymentDto.payment_method,
                payment_type: paymentDto.payment_type || null,
                amount: paymentDto.amount,
                reference: paymentDto.reference,
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
              throw new NotFoundException(
                `Exchange variant ${exchangeDto.variant_id} not found`,
              );
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
                  `Insufficient stock for exchange item ${exchangeDto.variant_id}. Available: ${batch?.quantity || 0}, Required: ${exchangeDto.quantity}`,
                );
              }

              const adjustment = await prisma.inventoryAdjustment.create({
                data: {
                  variant_id: exchangeDto.variant_id,
                  branch_id: dto.branch_id,
                  batch_id: exchangeDto.batch_id,
                  quantity_change: -exchangeDto.quantity, // Negative for outgoing exchange
                  reason: `Exchange from return ${returnNumber}`,
                  notes: `Return ID: ${returnNumber}`,
                  created_by_user_id: userId,
                  adjustment_type: 'exchange_out',
                },
              });

              // Update batch quantity
              const updatedBatch = await prisma.inventoryBatch.update({
                where: { id: exchangeDto.batch_id },
                data: {
                  quantity: {
                    decrement: exchangeDto.quantity,
                  },
                },
              });

              // Create EXCHANGE_OUT audit log
              await prisma.inventoryAuditLog.create({
                data: {
                  consumer_id: consumerId,
                  branch_id: dto.branch_id,
                  variant_id: exchangeDto.variant_id,
                  batch_id: exchangeDto.batch_id,
                  inventoryBatchId: exchangeDto.batch_id,
                  event_type: 'EXCHANGE_OUT',
                  quantity_delta: -exchangeDto.quantity,
                  quantity_after: updatedBatch.quantity,
                  reference_id: returnExchange.id,
                  reference_type: 'return_exchanges',
                  notes: `Exchange #${returnNumber} for return from sale ${originalSale.sale_number}`,
                  created_by_user_id: userId,
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

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error creating return with user ${userId} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to create return',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const { page = 1, limit = 10, branch_id, original_sale_id } = options;

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
    } catch (error) {
      this.logger.error(
        `Error fetching returns for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to fetch returns',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
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
    } catch (error) {
      this.logger.error(
        `Error fetching return with ID ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to fetch return',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async generateReturnNumber(
    consumerId: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      const prefix = `RET-${year}${month}${day}`;

      // Find the latest return number for today for this consumer
      const latestReturn = await client.return.findFirst({
        where: {
          consumer_id: consumerId,
          return_number: { startsWith: prefix },
        },
        orderBy: { return_number: 'desc' },
      });

      let sequenceNumber = 1;
      if (latestReturn) {
        const lastSequence = latestReturn.return_number.split('-').pop();
        sequenceNumber = parseInt(lastSequence || '0') + 1;
      }

      return `${prefix}-${String(sequenceNumber).padStart(4, '0')}`;
    } catch (error) {
      this.logger.error(
        `Error generating return number for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to generate return number',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
