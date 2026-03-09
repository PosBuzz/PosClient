import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createCustomerDto: CreateCustomerDto, consumerId: number) {
    const result = await this.prismaService.customer.create({
      data: {
        name: createCustomerDto.name,
        email: createCustomerDto.email,
        phone: createCustomerDto.phone,
        address: createCustomerDto.address,
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

    const result = this.prismaService.customer.findMany({
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
