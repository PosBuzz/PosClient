import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(createBrandDto: CreateBrandDto, consumerId: number) {
    try {
      const result = await this.prismaService.brand.create({
        data: {
          name: createBrandDto.name,
          logo: createBrandDto.logo,
          website: createBrandDto.website,
          consumer_id: consumerId,
        },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to create brand for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create brand',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(consumerId: number) {
    try {
      return await this.prismaService.brand.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch brands for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch brands',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
      const brand = await this.prismaService.brand.findFirst({
        where: { id, consumer_id: consumerId },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${id} not found`);
      }

      return brand;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        `Failed to fetch brand ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch brand',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, updateBrandDto: UpdateBrandDto, consumerId: number) {
    try {
      await this.findOne(id, consumerId); // ensure brand exists

      const result = await this.prismaService.brand.update({
        where: { id },
        data: {
          name: updateBrandDto.name,
          website: updateBrandDto.website,
          logo: updateBrandDto.logo,
        },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        `Failed to update brand ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update brand',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      await this.findOne(id, consumerId); // ensure brand exists

      await this.prismaService.brand.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        `Failed to delete brand ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete brand',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
