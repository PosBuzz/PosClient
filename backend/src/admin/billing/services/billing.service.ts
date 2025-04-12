import { Injectable } from '@nestjs/common';
import { BillingHistory } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async createBillingRecord(
    consumerId: number,
    amount: number,
    reference: string,
    billing_month: Date,
  ): Promise<BillingHistory> {
    return this.prisma.billingHistory.create({
      data: {
        consumer_id: consumerId,
        amount,
        reference,
        billing_month,
      },
    });
  }

  async getBillingHistory(consumerId: number): Promise<BillingHistory[]> {
    return this.prisma.billingHistory.findMany({
      where: { consumer_id: consumerId },
      orderBy: { created_at: 'desc' },
    });
  }
}
