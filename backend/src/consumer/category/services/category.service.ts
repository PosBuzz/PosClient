import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto, consumerId: number) {
    const result = await this.prismaService.category.create({
      data: {
        name: createCategoryDto.name,
        consumer_id: consumerId,
      },
    });

    return result;
  }

  async findAll(consumerId: number) {
    return this.prismaService.category.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number, consumerId: number) {
    const category = await this.prismaService.category.findFirst({
      where: {
        id,
        consumer_id: consumerId,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    consumerId: number,
  ) {
    // First check if the category exists and belongs to this consumer
    await this.findOne(id, consumerId);
    const result = await this.prismaService.category.update({
      where: { id },
      data: { name: updateCategoryDto.name },
    });

    return result;
  }

  async remove(id: number, consumerId: number) {
    // First check if the category exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.category.delete({
      where: { id },
    });

    return { success: true };
  }
}
