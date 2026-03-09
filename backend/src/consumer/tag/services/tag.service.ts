import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';

@Injectable()
export class TagService {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}
  async create(createTagDto: CreateTagDto, consumerId: number) {
    const result = await this.prismaService.tag.create({      data: {
        name: createTagDto.name,
        consumer_id: consumerId,
      },
    });


    return result;
  }
  async findAll(consumerId: number) {
    
      return this.prismaService.tag.findMany({
        where: { consumer_id: consumerId },
        orderBy: { name: 'asc' },
      });
    
  }
  async findOne(id: number, consumerId: number) {
   
      const tag = await this.prismaService.tag.findFirst({
        where: { 
          id,
          consumer_id: consumerId
        },
      });

      if (!tag) {
        throw new NotFoundException(`Tag with ID ${id} not found`);
      }

      return tag;
    
  }
  async update(id: number, updateTagDto: UpdateTagDto, consumerId: number) {
    // First check if the tag exists and belongs to this consumer
    await this.findOne(id, consumerId);    const result = await this.prismaService.tag.update({
      where: { id },
      data: { name: updateTagDto.name },
    });


    return result;
  }
  async remove(id: number, consumerId: number) {
    // First check if the tag exists and belongs to this consumer
    await this.findOne(id, consumerId);

    await this.prismaService.tag.delete({
      where: { id },
    });
    
    
    
    return { success: true };
  }
}