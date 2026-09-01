import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prismaService: PrismaService) {}

  private getPagination(page?: number, limit?: number) {
    const normalizedPage =
      Number.isFinite(page) && Number(page) > 0 ? Number(page) : 1;
    const normalizedLimit =
      Number.isFinite(limit) && Number(limit) > 0
        ? Math.min(Number(limit), 50)
        : 20;

    return {
      page: normalizedPage,
      limit: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
    };
  }

  private async ensureCustomer(id: number, consumerId: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: { id, consumer_id: consumerId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  async create(createCustomerDto: CreateCustomerDto, consumerId: number) {
    const result = await this.prismaService.customer.create({
      data: {
        name: createCustomerDto.name,
        email: createCustomerDto.email,
        phone: createCustomerDto.phone,
        address: createCustomerDto.address,
        birthday: createCustomerDto.birthday
          ? new Date(createCustomerDto.birthday)
          : null,
        customer_type: createCustomerDto.customer_type,
        consumer_id: consumerId,
      },
    });

    return result;
  }

  async findAll(consumerId: number) {
    return this.prismaService.customer.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number, consumerId: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: {
        id,
        consumer_id: consumerId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async getSummary(id: number, consumerId: number) {
    const customer = await this.prismaService.customer.findFirst({
      where: { id, consumer_id: consumerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        birthday: true,
        customer_type: true,
        created_at: true,
        rewards_points: {
          select: {
            total_points: true,
            lifetime_earned: true,
            lifetime_redeemed: true,
            last_earned_at: true,
            last_redeemed_at: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const saleWhere = {
      consumer_id: consumerId,
      customer_id: id,
      sale_type: 'sale',
      deleted_at: null,
    };
    const returnWhere = {
      consumer_id: consumerId,
      original_sale: {
        consumer_id: consumerId,
        customer_id: id,
      },
    };

    const [saleAggregate, outstandingAggregate, returnAggregate, recentSales] =
      await Promise.all([
        this.prismaService.sale.aggregate({
          where: saleWhere,
          _count: { _all: true },
          _sum: { total_amount: true, received_amount: true },
          _max: { sale_date: true },
        }),
        this.prismaService.sale.aggregate({
          where: { ...saleWhere, payment_status: { not: 'paid' } },
          _sum: { total_amount: true, received_amount: true },
        }),
        this.prismaService.return.aggregate({
          where: returnWhere,
          _count: { _all: true },
          _sum: { total_refund: true, total_exchange: true },
          _max: { return_date: true },
        }),
        this.prismaService.sale.findMany({
          where: saleWhere,
          orderBy: { sale_date: 'desc' },
          take: 5,
          select: {
            id: true,
            sale_number: true,
            sale_date: true,
            total_amount: true,
            received_amount: true,
            payment_status: true,
            branch: { select: { name: true } },
          },
        }),
      ]);

    const grossSales = Number(saleAggregate._sum.total_amount ?? 0);
    const totalPaid = Number(saleAggregate._sum.received_amount ?? 0);
    const outstandingTotal = Number(
      outstandingAggregate._sum.total_amount ?? 0,
    );
    const outstandingPaid = Number(
      outstandingAggregate._sum.received_amount ?? 0,
    );
    const { rewards_points: rewardsPoints, ...customerDetails } = customer;

    return {
      customer: customerDetails,
      sales: {
        count: saleAggregate._count._all,
        gross_amount: grossSales,
        paid_amount: totalPaid,
        outstanding_amount: Math.max(outstandingTotal - outstandingPaid, 0),
        last_sale_at: saleAggregate._max.sale_date,
      },
      returns: {
        count: returnAggregate._count._all,
        refunded_amount: Number(returnAggregate._sum.total_refund ?? 0),
        exchanged_amount: Number(returnAggregate._sum.total_exchange ?? 0),
        last_return_at: returnAggregate._max.return_date,
      },
      rewards: rewardsPoints ?? {
        total_points: 0,
        lifetime_earned: 0,
        lifetime_redeemed: 0,
        last_earned_at: null,
        last_redeemed_at: null,
      },
      recent_sales: recentSales.map((sale) => ({
        ...sale,
        total_amount: Number(sale.total_amount),
        received_amount: Number(sale.received_amount),
      })),
    };
  }

  async getSalesHistory(
    id: number,
    consumerId: number,
    requestedPage?: number,
    requestedLimit?: number,
  ) {
    await this.ensureCustomer(id, consumerId);
    const { page, limit, skip } = this.getPagination(
      requestedPage,
      requestedLimit,
    );
    const where = {
      consumer_id: consumerId,
      customer_id: id,
      sale_type: 'sale',
      deleted_at: null,
    };

    const [total, sales] = await Promise.all([
      this.prismaService.sale.count({ where }),
      this.prismaService.sale.findMany({
        where,
        orderBy: { sale_date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          sale_number: true,
          sale_date: true,
          total_amount: true,
          received_amount: true,
          payment_status: true,
          branch: { select: { name: true } },
        },
      }),
    ]);

    return {
      data: sales.map((sale) => ({
        ...sale,
        total_amount: Number(sale.total_amount),
        received_amount: Number(sale.received_amount),
        outstanding_amount: Math.max(
          Number(sale.total_amount) - Number(sale.received_amount),
          0,
        ),
      })),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async getReturnsHistory(
    id: number,
    consumerId: number,
    requestedPage?: number,
    requestedLimit?: number,
  ) {
    await this.ensureCustomer(id, consumerId);
    const { page, limit, skip } = this.getPagination(
      requestedPage,
      requestedLimit,
    );
    const where = {
      consumer_id: consumerId,
      original_sale: {
        consumer_id: consumerId,
        customer_id: id,
      },
    };

    const [total, returns] = await Promise.all([
      this.prismaService.return.count({ where }),
      this.prismaService.return.findMany({
        where,
        orderBy: { return_date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          return_number: true,
          return_date: true,
          total_refund: true,
          total_exchange: true,
          reason: true,
          branch: { select: { name: true } },
          original_sale: {
            select: { id: true, sale_number: true },
          },
        },
      }),
    ]);

    return {
      data: returns.map((returnRecord) => ({
        ...returnRecord,
        total_refund: Number(returnRecord.total_refund),
        total_exchange: Number(returnRecord.total_exchange),
      })),
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async getRewardsHistory(
    id: number,
    consumerId: number,
    requestedPage?: number,
    requestedLimit?: number,
  ) {
    await this.ensureCustomer(id, consumerId);
    const { page, limit, skip } = this.getPagination(
      requestedPage,
      requestedLimit,
    );
    const where = { customer_id: id, consumer_id: consumerId };

    const [total, transactions] = await Promise.all([
      this.prismaService.rewardsPointTransaction.count({ where }),
      this.prismaService.rewardsPointTransaction.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          points: true,
          balance_after: true,
          description: true,
          created_at: true,
          sale: { select: { id: true, sale_number: true } },
        },
      }),
    ]);

    return {
      data: transactions,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async update(
    id: number,
    updateCustomerDto: UpdateCustomerDto,
    consumerId: number,
  ) {
    // Check if customer exists and belongs to the consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.customer.update({
      where: { id },
      data: {
        name: updateCustomerDto.name,
        email: updateCustomerDto.email,
        phone: updateCustomerDto.phone,
        address: updateCustomerDto.address,
        // Absent = leave as is; explicitly empty = clear the stored birthday
        birthday: updateCustomerDto.birthday
          ? new Date(updateCustomerDto.birthday)
          : updateCustomerDto.birthday === undefined
            ? undefined
            : null,
        customer_type: updateCustomerDto.customer_type,
      },
    });

    return result;
  }

  async remove(id: number, consumerId: number) {
    // Check if customer exists and belongs to the consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.customer.delete({
      where: { id },
    });

    return result;
  }

  async search(query: string, consumerId: number) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim();

    const result = await this.prismaService.customer.findMany({
      where: {
        consumer_id: consumerId,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 20, // Limit search results
    });
    return {
      data: result,
    };
  }

  async findAllWithFilters(
    filters: {
      search?: string;
      customer_type?: string;
      page?: number;
      limit?: number;
    },
    consumerId: number,
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100); // Cap at 100
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      consumer_id: consumerId,
    };

    // Add search conditions
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.trim();
      whereClause.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Add customer type filter
    if (filters.customer_type) {
      whereClause.customer_type = filters.customer_type;
    }

    // Get total count for pagination
    const total = await this.prismaService.customer.count({
      where: whereClause,
    });

    // Get customers with pagination
    const customers = await this.prismaService.customer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
