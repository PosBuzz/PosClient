import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MakePaymentDto } from '../dto/make-payment.dto';
import { PartialPaymentFiltersDto } from '../dto/partial-payment-filters.dto';
import { Prisma } from '@prisma/client';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(private prisma: PrismaService) {}

  /**
   * Get all partially paid sales with filters
   */
  async getPartiallyPaidSales(
    filters: PartialPaymentFiltersDto,
    consumerId: number,
  ) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        branch_id,
        date_from,
        date_to,
        payment_status,
        sort_by = 'sale_date',
        sort_order = 'desc',
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: Prisma.SaleWhereInput = {
        consumer_id: consumerId,
        payment_status:
          payment_status && payment_status !== 'all'
            ? payment_status
            : { in: ['partial', 'due'] },
        sale_type: 'sale', // Exclude quotations
        deleted_at: null, // Exclude soft-deleted sales
      };

      // Add search filter
      if (search) {
        where.OR = [
          { sale_number: { contains: search, mode: 'insensitive' } },
          { customer_name: { contains: search, mode: 'insensitive' } },
          { customer_phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Add branch filter
      if (branch_id) {
        where.branch_id = branch_id;
      }

      // Add date range filter
      if (date_from || date_to) {
        where.sale_date = {};
        if (date_from) {
          where.sale_date.gte = new Date(date_from);
        }
        if (date_to) {
          where.sale_date.lte = new Date(date_to);
        }
      }

      // Get total count
      const total = await this.prisma.sale.count({ where });

      // Get sales with related data
      const sales = await this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        select: {
          id: true,
          sale_number: true,
          customer_name: true,
          customer_phone: true,
          sale_date: true,
          total_amount: true,
          payment_status: true,
          received_amount: true,
          created_at: true,
          branch: {
            select: {
              name: true,
            },
          },
        },
      });

      // Calculate remaining amount for each sale
      const salesWithRemaining = sales.map((sale) => ({
        ...sale,
        branch_name: sale.branch.name,
        remaining_amount:
          Number(sale.total_amount) - Number(sale.received_amount),
      }));

      return {
        data: salesWithRemaining,
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
        `Error getting partially paid sales for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get partially paid sales',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific sale for making payment
   */
  async getSaleForPayment(saleId: number, consumerId: number) {
    try {
      const sale = await this.prisma.sale.findFirst({
        where: {
          id: saleId,
          consumer_id: consumerId,
          sale_type: 'sale', // Only sales, not quotations
          deleted_at: null,
        },
        select: {
          id: true,
          sale_number: true,
          customer_name: true,
          customer_phone: true,
          sale_date: true,
          total_amount: true,
          payment_status: true,
          received_amount: true,
          created_at: true,
          branch: {
            select: {
              name: true,
            },
          },
          payments: {
            orderBy: {
              created_at: 'desc',
            },
            select: {
              id: true,
              payment_method: true,
              amount: true,
              reference: true,
              // notes: true,
              created_at: true,
            },
          },
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      // Check if sale can accept payments
      if (sale.payment_status === 'paid') {
        throw new BadRequestException('Sale is already fully paid');
      }

      if (sale.payment_status === 'cancelled') {
        throw new BadRequestException('Cannot make payment on cancelled sale');
      }

      return {
        ...sale,
        branch_name: sale.branch.name,
        remaining_amount:
          Number(sale.total_amount) - Number(sale.received_amount),
      };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error getting sale for payment with ID ${saleId} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get sale for payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Make a payment on a partially paid sale
   */
  async makePayment(paymentData: MakePaymentDto, consumerId: number) {
    try {
      const { sale_id, payments } = paymentData;

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

      if (totalPaymentAmount <= 0) {
        throw new BadRequestException(
          'Total payment amount must be greater than 0',
        );
      }

      // Get the sale and validate
      const sale = await this.prisma.sale.findFirst({
        where: {
          id: sale_id,
          consumer_id: consumerId,
          sale_type: 'sale',
          deleted_at: null,
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      // Validate payment status
      if (sale.payment_status === 'paid') {
        throw new BadRequestException('Sale is already fully paid');
      }

      if (sale.payment_status === 'cancelled') {
        throw new BadRequestException('Cannot make payment on cancelled sale');
      }

      // Use a transaction to ensure data consistency. The sale row is locked
      // first and every amount is re-read under the lock: two concurrent
      // payments would otherwise both validate against the same balance and
      // overwrite each other's received_amount.
      const toCents = (value: unknown) => Math.round(Number(value) * 100);
      const result = await this.prisma.$transaction(async (prisma) => {
        const locked = await prisma.$queryRaw<
          {
            total_amount: Prisma.Decimal;
            received_amount: Prisma.Decimal;
            payment_status: string;
          }[]
        >`SELECT "total_amount", "received_amount", "payment_status" FROM "sales" WHERE "id" = ${sale_id} FOR UPDATE`;
        const current = locked[0];
        if (!current) {
          throw new NotFoundException('Sale not found');
        }

        if (current.payment_status === 'paid') {
          throw new BadRequestException('Sale is already fully paid');
        }

        if (current.payment_status === 'cancelled') {
          throw new BadRequestException(
            'Cannot make payment on cancelled sale',
          );
        }

        const totalCents = toCents(current.total_amount);
        const receivedCents = toCents(current.received_amount);
        const paymentCents = toCents(totalPaymentAmount);
        const remainingCents = totalCents - receivedCents;

        if (paymentCents > remainingCents) {
          throw new BadRequestException(
            `Total payment amount (${totalPaymentAmount}) exceeds remaining amount (${remainingCents / 100})`,
          );
        }

        // Create all payment records
        const createdPayments = await Promise.all(
          payments.map((payment) =>
            prisma.salePayment.create({
              data: {
                sale_id,
                payment_method: payment.payment_method,
                amount: payment.amount,
                reference: payment.reference,
                // notes: payment.notes,
              },
            }),
          ),
        );

        const newReceivedCents = receivedCents + paymentCents;

        // Determine new payment status
        let newPaymentStatus: string;
        if (newReceivedCents >= totalCents) {
          newPaymentStatus = 'paid';
        } else if (newReceivedCents > 0) {
          newPaymentStatus = 'partial';
        } else {
          newPaymentStatus = 'due';
        }

        // Update sale
        const updatedSale = await prisma.sale.update({
          where: { id: sale_id },
          data: {
            received_amount: newReceivedCents / 100,
            payment_status: newPaymentStatus,
          },
          select: {
            id: true,
            sale_number: true,
            total_amount: true,
            received_amount: true,
            payment_status: true,
          },
        });

        return { payments: createdPayments, sale: updatedSale };
      });

      // Calculate remaining amount for response
      const remainingAfterPayment =
        Number(result.sale.total_amount) - Number(result.sale.received_amount);

      return {
        payments: result.payments,
        sale: {
          ...result.sale,
          remaining_amount: remainingAfterPayment,
        },
      };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error making payment for sale with ID ${paymentData.sale_id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to make payment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get payment history for a sale
   */
  async getSalePayments(saleId: number, consumerId: number) {
    try {
      // Verify sale belongs to consumer
      const sale = await this.prisma.sale.findFirst({
        where: {
          id: saleId,
          consumer_id: consumerId,
          deleted_at: null,
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      const payments = await this.prisma.salePayment.findMany({
        where: { sale_id: saleId },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          payment_method: true,
          amount: true,
          reference: true,
          // notes: true,
          created_at: true,
          updated_at: true,
        },
      });

      return { payments };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error fetching sale payments with ID ${saleId} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch sale payments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
