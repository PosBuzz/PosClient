import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createBrandDto: CreateBrandDto, consumerId: number) {
    const result = await this.prismaService.brand.create({
      data: {
        name: createBrandDto.name,
        logo: createBrandDto.logo,
        website: createBrandDto.website,
        consumer_id: consumerId,
      },
    });

    return result;
  }

  async findAll(consumerId: number) {
    return this.prismaService.brand.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number, consumerId: number) {
    const brand = await this.prismaService.brand.findFirst({
      where: {
        id,
        consumer_id: consumerId,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async update(id: number, updateBrandDto: UpdateBrandDto, consumerId: number) {
    // First check if the brand exists and belongs to this consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.brand.update({
      where: { id },
      data: {
        name: updateBrandDto.name,
        website: updateBrandDto.website,
        logo: updateBrandDto.logo,
      },
    });

    return result;
  }

  async remove(id: number, consumerId: number) {
    // First check if the brand exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.brand.delete({
      where: { id },
    });

    return { success: true };
  }
}
