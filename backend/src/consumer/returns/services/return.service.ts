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
import { errorStack } from '../../../common/utils/error.util';
import { lockDocumentNumbering } from '../../../common/utils/document-number-lock.util';
import { takeAvailableStock } from '../../inventory/utils/stock-mutation.util';
import { isBatchExpired } from '../../inventory/utils/batch-location.util';
import { isClientError } from '../../../common/errors/client-error';

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

        // Stock goes back to a batch of the variant that was actually sold,
        // and only to a batch this tenant owns
        if (returnItem.variant_id !== originalItem.variant_id) {
          throw new BadRequestException(
            `Return item ${returnItem.sale_item_id} does not match the sold product variant`,
          );
        }
        if (returnItem.batch_id) {
          await this.assertBatchOfVariant(
            this.prisma,
            returnItem.batch_id,
            originalItem.variant_id,
            consumerId,
          );
        }
      }

      // Calculate totals based on business logic
      const suppliedPayments = dto.payments ?? [];

      if (
        suppliedPayments.some(
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

      // Earlier returns may have cancelled part of the due, which lowered the
      // sale total; the original total is what the returns are measured against
      const totalDueReducedBefore = existingReturns.reduce(
        (sum, ret) => sum + Number(ret.due_reduction ?? 0),
        0,
      );
      const totalAlreadyReturned = existingReturns.reduce(
        (sum, ret) =>
          sum +
          parseFloat(ret.total_refund.toString()) +
          parseFloat(ret.total_exchange.toString()) +
          Number(ret.due_reduction ?? 0),
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
          `Shipping refund amount (৳${shippingRefundAmount.toFixed(2)}) exceeds remaining refundable shipping (৳${availableShippingRefund.toFixed(2)})`,
        );
      }

      const availableAmount =
        parseFloat(originalSale.total_amount.toString()) +
        totalDueReducedBefore -
        totalAlreadyReturned;

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
          `Selected return value (৳${selectedReturnAmount.toFixed(2)}) exceeds available amount (৳${availableAmount.toFixed(2)})`,
        );
      }

      // What the customer still owes comes off first: money is only paid out
      // for the part of the returned value the customer has actually paid
      const dueNow = Math.max(
        0,
        Number(originalSale.total_amount) -
          Number(originalSale.received_amount),
      );
      const dueReduction = Math.min(dueNow, selectedReturnAmount);
      const payableAmount = selectedReturnAmount - dueReduction;

      if (payableAmount > 0.01 && suppliedPayments.length === 0) {
        throw new BadRequestException(
          'At least one payment method is required to process a return',
        );
      }

      if (Math.abs(totalPayments - payableAmount) > 0.01) {
        throw new BadRequestException(
          dueReduction > 0
            ? `The customer still owes ৳${dueNow.toFixed(2)} on this sale, so ৳${dueReduction.toFixed(2)} of the return cancels that due. Total payment amount must be ৳${payableAmount.toFixed(2)}, got ৳${totalPayments.toFixed(2)}`
            : `Total payment amount must exactly match selected return value. Expected ৳${selectedReturnAmount.toFixed(2)}, got ৳${totalPayments.toFixed(2)}`,
        );
      }

      // Validate that total refund + exchange doesn't exceed available amount
      if (totalRefund + totalExchange > availableAmount) {
        throw new BadRequestException(
          `Total refund and exchange amount (৳${(totalRefund + totalExchange).toFixed(2)}) exceeds available amount (৳${availableAmount.toFixed(2)}). Already returned: ৳${totalAlreadyReturned.toFixed(2)}`,
        );
      }

      // Start transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Serializes this tenant's returns: keeps return numbers unique and
        // makes the re-check below see every committed return
        await lockDocumentNumbering(prisma, 'return', consumerId);

        // Quantities and amounts were validated outside this transaction; a
        // return committed since then would let this one over-refund
        const returnsNow = await prisma.return.count({
          where: { original_sale_id: dto.original_sale_id },
        });
        if (returnsNow !== existingReturns.length) {
          throw new BadRequestException(
            'Another return was recorded for this sale at the same time. Please reload the sale and try again.',
          );
        }

        // The due was read outside the transaction; a payment taken since
        // would change how much of this return cancels due
        let lockedReceived = Number(originalSale.received_amount);
        let lockedTotal = Number(originalSale.total_amount);
        if (dueNow > 0) {
          const [lockedSale] = await prisma.$queryRaw<
            Array<{
              total_amount: Prisma.Decimal;
              received_amount: Prisma.Decimal;
            }>
          >`SELECT "total_amount", "received_amount" FROM "sales" WHERE "id" = ${originalSale.id} FOR UPDATE`;
          lockedTotal = Number(lockedSale.total_amount);
          lockedReceived = Number(lockedSale.received_amount);
          if (
            Math.abs(Math.max(0, lockedTotal - lockedReceived) - dueNow) > 0.01
          ) {
            throw new BadRequestException(
              'A payment was recorded for this sale at the same time. Please reload the sale and try again.',
            );
          }
        }

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
            due_reduction: dueReduction,
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

          // Put the returned units back into stock, into the batch they came
          // from. The line may have been filled from several batches, so the
          // batch named on the return is refilled first, then the others in the
          // order the sale took from them; each only up to what it supplied
          // and has not had returned yet.
          if (itemDto.batch_id) {
            const legs = (
              await prisma.saleItemBatch.findMany({
                where: { sale_item_id: itemDto.sale_item_id },
                orderBy: { id: 'asc' },
              })
            ).sort(
              (a, b) =>
                Number(b.batch_id === itemDto.batch_id) -
                Number(a.batch_id === itemDto.batch_id),
            );
            let remaining = itemDto.quantity;
            const restocks: {
              legId: number | null;
              soldBatchId: number;
              quantity: number;
            }[] = [];
            for (const leg of legs) {
              if (remaining <= 0 || !leg.batch_id) continue;
              const take = Math.min(
                remaining,
                leg.quantity - leg.returned_quantity,
              );
              if (take > 0) {
                restocks.push({
                  legId: leg.id,
                  soldBatchId: leg.batch_id,
                  quantity: take,
                });
                remaining -= take;
              }
            }
            if (!legs.length) {
              // Lines without recorded batches: use the batch the caller named
              restocks.push({
                legId: null,
                soldBatchId: itemDto.batch_id,
                quantity: remaining,
              });
              remaining = 0;
            }
            if (remaining > 0) {
              throw new BadRequestException(
                `Return quantity exceeds what is left to return for item ${itemDto.sale_item_id}`,
              );
            }

            for (const restock of restocks) {
              if (restock.legId !== null) {
                await prisma.saleItemBatch.update({
                  where: { id: restock.legId },
                  data: { returned_quantity: { increment: restock.quantity } },
                });
              }
              // Stock goes back into the branch the return is processed at,
              // not necessarily the branch the sale came from
              const restockBatchId = await this.resolveRestockBatch(
                prisma,
                restock.soldBatchId,
                dto.branch_id,
              );
              await prisma.inventoryAdjustment.create({
                data: {
                  variant_id: itemDto.variant_id,
                  branch_id: dto.branch_id,
                  batch_id: restockBatchId,
                  quantity_change: restock.quantity, // Positive for return to stock
                  reason: `Return from sale ${originalSale.sale_number}`,
                  notes: `Return ID: ${returnNumber}`,
                  created_by_user_id: userId,
                  adjustment_type: 'return_in',
                },
              });

              const updatedBatch = await prisma.inventoryBatch.update({
                where: { id: restockBatchId },
                data: { quantity: { increment: restock.quantity } },
              });

              await prisma.inventoryAuditLog.create({
                data: {
                  consumer_id: consumerId,
                  branch_id: dto.branch_id,
                  variant_id: itemDto.variant_id,
                  batch_id: restockBatchId,
                  inventoryBatchId: restockBatchId,
                  event_type: 'RETURN_IN',
                  quantity_delta: restock.quantity,
                  quantity_after: updatedBatch.quantity,
                  reference_id: returnItem.id,
                  reference_type: 'return_items',
                  notes: `Return #${returnNumber} from sale ${originalSale.sale_number}`,
                  created_by_user_id: userId,
                },
              });
            }
          }
        }

        // The cancelled due comes off the sale, so the customer owes less
        if (dueReduction > 0) {
          const newTotal = lockedTotal - dueReduction;
          await prisma.sale.update({
            where: { id: originalSale.id },
            data: {
              total_amount: newTotal,
              ...(lockedReceived >= newTotal - 0.01
                ? { payment_status: 'paid' }
                : {}),
            },
          });
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
              // Same transaction as the return: points come back only if the
              // return is recorded, and the return fails if they cannot
              await this.rewardsService.processCreditRefund(
                consumerId,
                originalSale.customer_id,
                Number(paymentDto.amount),
                originalSale.id,
                returnRecord.id,
                paymentDto.reference,
                prisma,
              );
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
              await this.assertBatchOfVariant(
                prisma,
                exchangeDto.batch_id,
                exchangeDto.variant_id,
                consumerId,
              );
              const exchangeBatch = await prisma.inventoryBatch.findUnique({
                where: { id: exchangeDto.batch_id },
                select: { batch_number: true, expiry_date: true },
              });
              if (exchangeBatch && isBatchExpired(exchangeBatch)) {
                throw new BadRequestException(
                  `Batch ${exchangeBatch.batch_number} has expired and cannot be sold`,
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
                  adjustment_type: 'exchange_out',
                },
              });

              // Atomic check-and-update so concurrent requests cannot both
              // take the last units
              const updatedBatch = await takeAvailableStock(
                prisma,
                exchangeDto.batch_id,
                exchangeDto.quantity,
              );
              if (!updatedBatch) {
                const batch = await prisma.inventoryBatch.findUnique({
                  where: { id: exchangeDto.batch_id },
                });
                throw new BadRequestException(
                  `Insufficient stock for exchange item ${exchangeDto.variant_id}. Available: ${batch ? batch.quantity - batch.reserved_quantity : 0}, Required: ${exchangeDto.quantity}`,
                );
              }

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

      await this.reverseRewardPointsForRefund({
        consumerId,
        userId,
        saleId: originalSale.id,
        saleNumber: originalSale.sale_number,
        customerId: originalSale.customer_id,
        saleTotal: parseFloat(originalSale.total_amount.toString()),
        refundAmount: totalRefund,
        returnNumber: result.return_number,
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }

      this.logger.error(
        `Error creating return with user ${userId} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create return',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Points are earned on money the customer spent, so a refund has to take back
   * the matching share — otherwise a buy-and-return cycle mints points. Mirrors
   * what sale deletion does: an offsetting ADJUSTMENT, never a rewrite of the
   * original EARN, so the customer's history stays intact.
   */
  private async reverseRewardPointsForRefund(context: {
    consumerId: number;
    userId: number;
    saleId: number;
    saleNumber: string;
    customerId: number | null;
    saleTotal: number;
    refundAmount: number;
    returnNumber: string;
  }) {
    const {
      consumerId,
      userId,
      saleId,
      saleNumber,
      customerId,
      saleTotal,
      refundAmount,
      returnNumber,
    } = context;

    if (!customerId || refundAmount <= 0 || saleTotal <= 0) return;

    try {
      const transactions = await this.prisma.rewardsPointTransaction.findMany({
        where: {
          sale_id: saleId,
          consumer_id: consumerId,
          customer_id: customerId,
          type: { in: ['EARN', 'ADJUSTMENT'] },
        },
        select: { points: true, type: true },
      });

      // The share is taken off what the sale originally earned, so a second
      // partial return reverses its own share rather than a share of what is
      // left. What still stands caps it, so repeated returns cannot overdraw.
      const earned = transactions
        .filter((transaction) => transaction.type === 'EARN')
        .reduce((sum, transaction) => sum + transaction.points, 0);
      const remaining = transactions.reduce(
        (sum, transaction) => sum + transaction.points,
        0,
      );

      if (earned <= 0 || remaining <= 0) return;

      const ratio = Math.min(1, refundAmount / saleTotal);
      const points = Math.min(Math.round(earned * ratio), remaining);

      if (points <= 0) return;

      await this.rewardsService.adjustPoints(
        consumerId,
        {
          customer_id: customerId,
          points: -points,
          description: `Points reversed - return #${returnNumber} against sale #${saleNumber}`,
        },
        userId,
      );
    } catch (error) {
      // Rewards bookkeeping must never invalidate a refund that already happened
      this.logger.error(
        `Failed to reverse rewards points for return against sale ${saleId}`,
        errorStack(error),
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
      date_from?: string;
      date_to?: string;
      search?: string;
    } = {},
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        branch_id,
        original_sale_id,
        date_from,
        date_to,
        search,
      } = options;

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

      if (date_from || date_to) {
        whereClause.return_date = {};
        if (date_from) {
          whereClause.return_date.gte = new Date(date_from);
        }
        if (date_to) {
          const to = new Date(date_to);
          to.setHours(23, 59, 59, 999);
          whereClause.return_date.lte = to;
        }
      }

      if (search) {
        whereClause.OR = [
          { return_number: { contains: search, mode: 'insensitive' } },
          {
            original_sale: {
              sale_number: { contains: search, mode: 'insensitive' },
            },
          },
          {
            original_sale: {
              customer_name: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      const now = new Date();
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0,
      );

      const [returns, total, summaryStats, thisMonthCount] = await Promise.all([
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
            exchange_sale: {
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
        this.prisma.return.aggregate({
          where: whereClause,
          _sum: {
            total_refund: true,
            total_exchange: true,
          },
        }),
        this.prisma.return.count({
          where: {
            ...whereClause,
            return_date: { gte: monthStart },
          },
        }),
      ]);

      return {
        data: returns,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: {
          total_returns: total,
          total_refund: Number(summaryStats._sum.total_refund || 0),
          total_exchange: Number(summaryStats._sum.total_exchange || 0),
          this_month_count: thisMonthCount,
        },
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching returns for consumer ${consumerId}`,
        errorStack(error),
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
          exchange_sale: {
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
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching return with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch return',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * The batch to put returned stock into: the sold batch itself when it is in
   * the return's branch, otherwise the matching batch there (created empty if
   * the branch has none), the same way a transfer lands stock.
   */
  private async resolveRestockBatch(
    client: Prisma.TransactionClient,
    soldBatchId: number,
    branchId: number,
  ): Promise<number> {
    const sold = await client.inventoryBatch.findUniqueOrThrow({
      where: { id: soldBatchId },
    });
    if (sold.branch_id === branchId) return sold.id;

    const existing = await client.inventoryBatch.findFirst({
      where: {
        variant_id: sold.variant_id,
        branch_id: branchId,
        batch_number: sold.batch_number,
        cost_price: sold.cost_price,
        expiry_date: sold.expiry_date,
        vendor_id: sold.vendor_id,
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await client.inventoryBatch.create({
      data: {
        variant_id: sold.variant_id,
        branch_id: branchId,
        batch_number: sold.batch_number,
        quantity: 0,
        cost_price: sold.cost_price,
        vendor_id: sold.vendor_id,
        expiry_date: sold.expiry_date,
        location: sold.location,
      },
      select: { id: true },
    });
    return created.id;
  }

  private async assertBatchOfVariant(
    client: Prisma.TransactionClient,
    batchId: number,
    variantId: number,
    consumerId: number,
  ): Promise<void> {
    const batch = await client.inventoryBatch.findFirst({
      where: {
        id: batchId,
        variant_id: variantId,
        branch: { consumer_id: consumerId },
      },
      select: { id: true },
    });
    if (!batch) {
      throw new BadRequestException(
        `Batch ${batchId} is not a batch of variant ${variantId}`,
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
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error generating return number for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to generate return number',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
