import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBillingHistoryDto } from './dto/create-billing-history.dto';
import { UpdateBillingHistoryDto } from './dto/update-billing-history.dto';
import { errorStack } from '../../common/utils/error.util';
import { isClientError } from '../../common/errors/client-error';

/**
 * CRUD for billing records. Replaces the generic /crud endpoint, so the query
 * shape is fixed here instead of being supplied by the client.
 */
@Injectable()
export class BillingHistoryService {
  private readonly logger = new Logger(BillingHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertValidPeriod(billingFrom: Date, billingTill: Date) {
    if (billingFrom.getTime() > billingTill.getTime()) {
      throw new HttpException(
        'Billing till date must be on or after the billing from date',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async assertNoOverlappingPeriod(
    consumerId: number,
    billingFrom: Date,
    billingTill: Date,
    excludeId?: number,
  ) {
    const overlappingBill = await this.prisma.billingHistory.findFirst({
      where: {
        consumer_id: consumerId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        billing_from: { lte: billingTill },
        billing_till: { gte: billingFrom },
      },
      select: { id: true },
    });

    if (overlappingBill) {
      throw new HttpException(
        'This billing period overlaps an existing bill for the consumer',
        HttpStatus.CONFLICT,
      );
    }
  }

  async findAll(params: { consumerIds?: number[]; reference?: string }) {
    const { consumerIds, reference } = params;

    try {
      return await this.prisma.billingHistory.findMany({
        where: {
          ...(consumerIds?.length ? { consumer_id: { in: consumerIds } } : {}),
          ...(reference
            ? { reference: { contains: reference, mode: 'insensitive' } }
            : {}),
        },
        include: { consumer: true },
        orderBy: { id: 'asc' },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error('Fetching billing history failed', errorStack(error));

      throw new HttpException(
        'Failed to fetch billing history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async create(dto: CreateBillingHistoryDto) {
    try {
      const billingFrom = new Date(dto.billing_from);
      const billingTill = new Date(dto.billing_till);
      this.assertValidPeriod(billingFrom, billingTill);
      await this.assertNoOverlappingPeriod(
        dto.consumer_id,
        billingFrom,
        billingTill,
      );

      return await this.prisma.billingHistory.create({
        data: {
          consumer_id: dto.consumer_id,
          plan_id: dto.plan_id,
          amount: dto.amount,
          reference: dto.reference ?? null,
          billing_date: new Date(dto.billing_date),
          billing_from: billingFrom,
          billing_till: billingTill,
        },
      });
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error('Creating billing record failed', errorStack(error));

      // @@unique([consumer_id, billing_date])
      if (error.code === 'P2002') {
        throw new HttpException(
          'A billing record already exists for this consumer on that date',
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to create billing record',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, dto: UpdateBillingHistoryDto) {
    try {
      const existing = await this.prisma.billingHistory.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new HttpException(
          'Billing record not found',
          HttpStatus.NOT_FOUND,
        );
      }

      const consumerId = dto.consumer_id ?? existing.consumer_id;
      const billingFrom = dto.billing_from
        ? new Date(dto.billing_from)
        : existing.billing_from;
      const billingTill = dto.billing_till
        ? new Date(dto.billing_till)
        : existing.billing_till;

      this.assertValidPeriod(billingFrom, billingTill);
      await this.assertNoOverlappingPeriod(
        consumerId,
        billingFrom,
        billingTill,
        id,
      );

      return await this.prisma.billingHistory.update({
        where: { id },
        data: {
          ...(dto.consumer_id !== undefined
            ? { consumer_id: dto.consumer_id }
            : {}),
          ...(dto.plan_id !== undefined ? { plan_id: dto.plan_id } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.reference !== undefined
            ? { reference: dto.reference ?? null }
            : {}),
          ...(dto.billing_date !== undefined
            ? { billing_date: new Date(dto.billing_date) }
            : {}),
          ...(dto.billing_from !== undefined
            ? { billing_from: billingFrom }
            : {}),
          ...(dto.billing_till !== undefined
            ? { billing_till: billingTill }
            : {}),
        },
      });
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Updating billing record ${id} failed`,
        errorStack(error),
      );

      if (error.code === 'P2025') {
        throw new HttpException(
          'Billing record not found',
          HttpStatus.NOT_FOUND,
        );
      }

      if (error.code === 'P2002') {
        throw new HttpException(
          'A billing record already exists for this consumer on that date',
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to update billing record',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.billingHistory.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Deleting billing record ${id} failed`,
        errorStack(error),
      );

      if (error.code === 'P2025') {
        throw new HttpException(
          'Billing record not found',
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        'Failed to delete billing record',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
