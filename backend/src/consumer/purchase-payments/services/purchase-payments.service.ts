import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MakePurchasePaymentDto } from '../dto/make-purchase-payment.dto';
import { PurchaseBatchesFiltersDto } from '../dto/purchase-batches-filters.dto';
import { Prisma } from '@prisma/client';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class PurchasePaymentsService {
  private readonly logger = new Logger(PurchasePaymentsService.name);
  constructor(private prisma: PrismaService) {}

  private async findPurchaseBatches(
    filters: PurchaseBatchesFiltersDto,
    consumerId: number,
    defaultStatuses?: string[],
  ) {
    const {
      page = 1,
      limit = 20,
      search,
      branch_id,
      vendor_id,
      vendorless,
      date_from,
      date_to,
      sort_by = 'created_at',
      sort_order = 'desc',
      payment_status = 'all',
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.InventoryBatchWhereInput = {
      variant: {
        product: { consumer_id: consumerId },
      },
    };

    if (defaultStatuses?.length) {
      where.payment_status = { in: defaultStatuses };
    } else if (payment_status === 'unpaid') {
      where.payment_status = { in: ['partial', 'due'] };
    } else if (payment_status && payment_status !== 'all') {
      where.payment_status = payment_status;
    }

    if (search) {
      where.OR = [
        { batch_number: { contains: search, mode: 'insensitive' } },
        {
          variant: {
            product: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          variant: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (branch_id) {
      where.branch_id = branch_id;
    }

    if (vendorless) {
      where.vendor_id = null;
    } else if (vendor_id) {
      where.vendor_id = vendor_id;
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

    const [total, batches] = await Promise.all([
      this.prisma.inventoryBatch.count({ where }),
      this.prisma.inventoryBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          variant: {
            select: {
              id: true,
              name: true,
              product: { select: { id: true, name: true } },
            },
          },
          branch: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
          purchasePayments: {
            orderBy: { created_at: 'desc' },
          },
        },
      }),
    ]);

    const batchesWithRemaining = batches.map((batch) => {
      const totalCost = Number(batch.cost_price) * batch.quantity;
      const paidAmount = Number(batch.paid_amount);
      return {
        ...batch,
        total_cost: totalCost,
        remaining_amount: Math.max(0, totalCost - paidAmount),
      };
    });

    return {
      data: batchesWithRemaining,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get purchase payment ledger batches with filters
   */
  async getPurchaseBatches(
    filters: PurchaseBatchesFiltersDto,
    consumerId: number,
  ) {
    try {
      return await this.findPurchaseBatches(filters, consumerId);
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error getting purchase payment batches for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get purchase payment batches',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific batch for making payment
   */
  async getBatchForPayment(batchId: number, consumerId: number) {
    try {
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id: batchId,
          variant: {
            product: { consumer_id: consumerId },
          },
        },
        include: {
          variant: {
            select: {
              id: true,
              name: true,
              product: { select: { id: true, name: true } },
            },
          },
          branch: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
          purchasePayments: {
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      const totalCost = Number(batch.cost_price) * batch.quantity;
      const paidAmount = Number(batch.paid_amount);

      return {
        ...batch,
        total_cost: totalCost,
        remaining_amount: totalCost - paidAmount,
      };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error getting batch for payment with ID ${batchId} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get batch for payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Make a payment on an unpaid batch
   */
  async makePayment(paymentData: MakePurchasePaymentDto, consumerId: number) {
    try {
      const { batch_id, payments } = paymentData;

      // Validate payments array
      if (!payments || payments.length === 0) {
        throw new BadRequestException(
          'At least one payment method is required',
        );
      }

      // Calculate total payment amount
      const totalPaymentAmount = payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      if (
        !Number.isFinite(totalPaymentAmount) ||
        payments.some(
          (payment) =>
            !Number.isFinite(Number(payment.amount)) ||
            Number(payment.amount) <= 0,
        )
      ) {
        throw new BadRequestException(
          'Total payment amount must be greater than 0',
        );
      }

      // Get the batch and validate
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id: batch_id,
          variant: {
            product: { consumer_id: consumerId },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      if (batch.quantity <= 0) {
        throw new BadRequestException(
          'Cannot make a vendor payment for a batch with zero quantity',
        );
      }
      // Validate payment status
      if (batch.payment_status === 'paid') {
        throw new BadRequestException('Batch is already fully paid');
      }

      // Calculate remaining amount
      const totalCost = Number(batch.cost_price) * batch.quantity;
      const paidAmount = Number(batch.paid_amount);
      const remainingAmount = totalCost - paidAmount;

      // Validate payment amount
      if (totalPaymentAmount > remainingAmount) {
        throw new BadRequestException(
          `Total payment amount (${totalPaymentAmount}) exceeds remaining amount (${remainingAmount})`,
        );
      }

      // Use transaction to ensure data consistency
      const result = await this.prisma.$transaction(async (prisma) => {
        // Claim the observed balance before writing payments. A concurrent
        // stock or payment change must not allow a stale payment through.
        const claimed = await prisma.inventoryBatch.updateMany({
          where: {
            id: batch_id,
            quantity: batch.quantity,
            paid_amount: batch.paid_amount,
            cost_price: batch.cost_price,
          },
          data: { paid_amount: paidAmount + totalPaymentAmount },
        });
        if (claimed.count !== 1) {
          throw new BadRequestException(
            'Batch changed. Refresh and try the payment again.',
          );
        }
        // Create all payment records
        const createdPayments = await Promise.all(
          payments.map((payment) =>
            prisma.purchasePayment.create({
              data: {
                batch_id,
                payment_method: payment.payment_method,
                payment_type: (payment.payment_type as any) || null,
                amount: payment.amount,
                reference: payment.reference || null,
              },
            }),
          ),
        );

        // Calculate new paid amount
        const newPaidAmount = paidAmount + totalPaymentAmount;

        // Determine new payment status
        let newPaymentStatus: string;
        if (newPaidAmount >= totalCost) {
          newPaymentStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newPaymentStatus = 'partial';
        } else {
          newPaymentStatus = 'due';
        }

        // Update batch
        const updatedBatch = await prisma.inventoryBatch.update({
          where: { id: batch_id },
          data: {
            paid_amount: newPaidAmount,
            payment_status: newPaymentStatus,
          },
          select: {
            id: true,
            batch_number: true,
            cost_price: true,
            quantity: true,
            paid_amount: true,
            payment_status: true,
          },
        });

        return { payments: createdPayments, batch: updatedBatch };
      });

      // Calculate remaining amount for response
      const updatedTotalCost =
        Number(result.batch.cost_price) * result.batch.quantity;
      const remainingAfterPayment =
        updatedTotalCost - Number(result.batch.paid_amount);

      return {
        payments: result.payments,
        batch: {
          ...result.batch,
          total_cost: updatedTotalCost,
          remaining_amount: remainingAfterPayment,
        },
      };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error making purchase payment for batch with ID ${paymentData.batch_id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to make payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get payment history for a batch
   */
  async getBatchPayments(batchId: number, consumerId: number) {
    try {
      // Verify batch belongs to consumer
      const batch = await this.prisma.inventoryBatch.findFirst({
        where: {
          id: batchId,
          variant: {
            product: { consumer_id: consumerId },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      const payments = await this.prisma.purchasePayment.findMany({
        where: { batch_id: batchId },
        orderBy: { created_at: 'desc' },
      });

      return { payments };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error fetching purchase payments for batch ${batchId} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch purchase payments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
