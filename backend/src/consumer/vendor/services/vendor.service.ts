import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';
import { purchasedQuantities } from '../../inventory/utils/purchased-quantity.util';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);
  constructor(private readonly prismaService: PrismaService) {}
  async create(createVendorDto: CreateVendorDto, consumerId: number) {
    try {
      const result = await this.prismaService.vendor.create({
        data: {
          name: createVendorDto.name,
          contact: createVendorDto.contact,
          phone: createVendorDto.phone,
          email: createVendorDto.email,
          address: createVendorDto.address,
          consumer_id: consumerId,
        },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error creating vendor for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create vendor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findAll(consumerId: number) {
    return this.prismaService.vendor.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }
  async findOne(id: number, consumerId: number) {
    try {
      const vendor = await this.prismaService.vendor.findFirst({
        where: {
          id,
          consumer_id: consumerId,
        },
      });

      if (!vendor) {
        throw new NotFoundException(`Vendor with ID ${id} not found`);
      }

      return vendor;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding vendor with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find vendor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async update(
    id: number,
    updateVendorDto: UpdateVendorDto,
    consumerId: number,
  ) {
    try {
      // First check if the vendor exists and belongs to this consumer
      await this.findOne(id, consumerId);

      const result = await this.prismaService.vendor.update({
        where: { id },
        data: {
          name: updateVendorDto.name,
          contact: updateVendorDto.contact,
          phone: updateVendorDto.phone,
          email: updateVendorDto.email,
          address: updateVendorDto.address,
        },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error updating vendor with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update vendor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      // First check if the vendor exists and belongs to this consumer
      await this.findOne(id, consumerId);

      // Check if vendor has any batches
      const batchCount = await this.prismaService.inventoryBatch.count({
        where: { vendor_id: id },
      });

      if (batchCount > 0) {
        // Don't delete, just return an error
        throw new Error(
          `Cannot delete vendor with ${batchCount} associated batches`,
        );
      }
      await this.prismaService.vendor.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error deleting vendor with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete vendor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get vendor details with batches, payments, and summary
   */
  async findOneWithDetails(
    id: number,
    consumerId: number,
    options?: { page?: number; limit?: number },
  ) {
    try {
      // 1. Fetch vendor info
      const vendor = await this.findOne(id, consumerId);

      // 2. Build where clause for batches
      const whereClause = {
        vendor_id: id,
        variant: {
          product: { consumer_id: consumerId },
        },
      };

      const page = options?.page || 1;
      const limit = options?.limit || 50;
      const skip = (page - 1) * limit;

      // 3. Fetch batches and total count
      const [batches, totalBatches] = await Promise.all([
        this.prismaService.inventoryBatch.findMany({
          where: whereClause,
          include: {
            variant: {
              select: {
                id: true,
                name: true,
                product: { select: { id: true, name: true } },
              },
            },
            branch: { select: { id: true, name: true } },
            purchasePayments: {
              orderBy: { created_at: 'desc' },
            },
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: limit,
        }),
        this.prismaService.inventoryBatch.count({ where: whereClause }),
      ]);

      // 4. Compute aggregates (owed on the quantity bought, not what is left)
      const purchased = await purchasedQuantities(this.prismaService, batches);
      const totalCost = batches.reduce(
        (sum, b) => sum + Number(b.cost_price) * purchased.get(b.id)!,
        0,
      );
      const totalPaid = batches.reduce(
        (sum, b) => sum + Number(b.paid_amount),
        0,
      );
      const totalOwed = totalCost - totalPaid;

      // 5. Collect all payments across batches for payment history
      const allPayments = batches.flatMap((batch) =>
        batch.purchasePayments.map((payment) => ({
          ...payment,
          batch_id: batch.id,
          batch_number: batch.batch_number,
          product_name: batch.variant.product.name,
          variant_name: batch.variant.name,
        })),
      );

      // 6. Add computed fields to batches
      const batchesWithTotals = batches.map((batch) => ({
        ...batch,
        total_cost: Number(batch.cost_price) * purchased.get(batch.id)!,
        remaining_amount:
          Number(batch.cost_price) * purchased.get(batch.id)! -
          Number(batch.paid_amount),
      }));

      return {
        vendor,
        batches: batchesWithTotals,
        allPayments,
        summary: {
          totalCost,
          totalPaid,
          totalOwed,
          totalBatches,
        },
        meta: {
          page,
          limit,
          totalPages: Math.ceil(totalBatches / limit),
        },
      };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error getting vendor details for ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to get vendor details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
