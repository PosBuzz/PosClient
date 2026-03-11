import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';

@Injectable()
export class UnitService {
  private readonly logger = new Logger(UnitService.name);
  constructor(private readonly prismaService: PrismaService) {}
  async create(createUnitDto: CreateUnitDto, consumerId: number) {
    try {
      // Check if unit with the same name already exists for this consumer
      const existingUnit = await this.prismaService.unit.findFirst({
        where: {
          name: createUnitDto.name,
          consumer_id: consumerId,
        },
      });

      if (existingUnit) {
        throw new ConflictException(
          `Unit with name "${createUnitDto.name}" already exists`,
        );
      }

      const result = await this.prismaService.unit.create({
        data: {
          name: createUnitDto.name,
          consumer_id: consumerId,
        },
      });

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error creating unit for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to create unit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findAll(consumerId: number) {
    return this.prismaService.unit.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }
  async findOne(id: number, consumerId: number) {
    try {
      const unit = await this.prismaService.unit.findFirst({
        where: {
          id,
          consumer_id: consumerId,
        },
      });

      if (!unit) {
        throw new NotFoundException(`Unit with ID ${id} not found`);
      }

      return unit;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error fetching unit with ID ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to fetch unit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async update(id: number, updateUnitDto: UpdateUnitDto, consumerId: number) {
    try {
      // First check if the unit exists and belongs to this consumer
      await this.findOne(id, consumerId);

      // Check if another unit with the same name already exists for this consumer
      const existingUnit = await this.prismaService.unit.findFirst({
        where: {
          name: updateUnitDto.name,
          consumer_id: consumerId,
          id: { not: id }, // Exclude the current unit being updated
        },
      });

      if (existingUnit) {
        throw new ConflictException(
          `Unit with name "${updateUnitDto.name}" already exists`,
        );
      }

      const result = await this.prismaService.unit.update({
        where: { id },
        data: { name: updateUnitDto.name },
      });

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error updating unit with ID ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to update unit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async remove(id: number, consumerId: number) {
    try {
      // First check if the unit exists and belongs to this consumer
      await this.findOne(id, consumerId);
      await this.prismaService.unit.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error deleting unit with ID ${id} for consumer ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to delete unit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
