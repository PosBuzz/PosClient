import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto, consumerId: number) {
    try {
      const result = await this.prismaService.category.create({
        data: {
          name: createCategoryDto.name,
          consumer_id: consumerId,
        },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to create category for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(consumerId: number) {
    try {
      return await this.prismaService.category.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch categories for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch categories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, consumerId: number) {
    try {
      const category = await this.prismaService.category.findFirst({
        where: { id, consumer_id: consumerId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      return category;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch category ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    consumerId: number,
  ) {
    try {
      await this.findOne(id, consumerId); // Ensure category exists

      const result = await this.prismaService.category.update({
        where: { id },
        data: { name: updateCategoryDto.name },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to update category ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, consumerId: number) {
    try {
      await this.findOne(id, consumerId); // Ensure category exists

      await this.prismaService.category.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Failed to delete category ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete category',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
