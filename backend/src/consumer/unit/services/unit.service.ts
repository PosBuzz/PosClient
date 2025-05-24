import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';

@Injectable()
export class UnitService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createUnitDto: CreateUnitDto, consumerId: number) {
    return this.prismaService.unit.create({
      data: {
        name: createUnitDto.name,
        consumer_id: consumerId,
      },
    });
  }

  async findAll(consumerId: number) {
    return this.prismaService.unit.findMany({
      where: { consumer_id: consumerId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number, consumerId: number) {
    const unit = await this.prismaService.unit.findFirst({
      where: { 
        id,
        consumer_id: consumerId
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    return unit;
  }

  async update(id: number, updateUnitDto: UpdateUnitDto, consumerId: number) {
    // First check if the unit exists and belongs to this consumer
    await this.findOne(id, consumerId);

    return this.prismaService.unit.update({
      where: { id },
      data: { name: updateUnitDto.name },
    });
  }

  async remove(id: number, consumerId: number) {
    // First check if the unit exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.unit.delete({
      where: { id },
    });
    
    return { success: true };
  }
}