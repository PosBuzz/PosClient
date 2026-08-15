import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { errorStack } from '../../../common/utils/error.util';

@Injectable()
export class TagService {
  private readonly logger = new Logger(TagService.name);
  constructor(private readonly prismaService: PrismaService) {}
  async create(createTagDto: CreateTagDto, consumerId: number) {
    try {
      const result = await this.prismaService.tag.create({
        data: {
          name: createTagDto.name,
          consumer_id: consumerId,
        },
      });

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error creating tag for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create tag',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findAll(consumerId: number) {
    return this.prismaService.tag.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }
  async findOne(id: number, consumerId: number) {
    try {
      const tag = await this.prismaService.tag.findFirst({
        where: {
          id,
          consumer_id: consumerId,
        },
      });

      if (!tag) {
        throw new NotFoundException(`Tag with ID ${id} not found`);
      }

      return tag;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error fetching tag with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch tag',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async update(id: number, updateTagDto: UpdateTagDto, consumerId: number) {
    try {
      // First check if the tag exists and belongs to this consumer
      await this.findOne(id, consumerId);
      const result = await this.prismaService.tag.update({
        where: { id },
        data: { name: updateTagDto.name },
      });

      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error updating tag with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update tag',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async remove(id: number, consumerId: number) {
    try {
      // First check if the tag exists and belongs to this consumer
      await this.findOne(id, consumerId);

      await this.prismaService.tag.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error deleting tag with ID ${id} for consumer ${consumerId}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete tag',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
