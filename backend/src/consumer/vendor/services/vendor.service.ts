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
      this.logger.error(
        `Error creating vendor for consumer ${consumerId}`,
        error.stack,
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
      this.logger.error(
        `Error finding vendor with ID ${id} for consumer ${consumerId}`,
        error.stack,
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
      this.logger.error(
        `Error updating vendor with ID ${id} for consumer ${consumerId}`,
        error.stack,
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
      this.logger.error(
        `Error deleting vendor with ID ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to delete vendor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
