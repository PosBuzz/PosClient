import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';

@Injectable()
export class ConsumerService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateConsumerDto) {
    return this.prisma.consumer.create({ data });
  }

  async findAll() {
    return this.prisma.consumer.findMany({
      include: {
        plan: true,
        users: true,
      },
    });
  }

  async findOne(id: string) {
    const consumer = await this.prisma.consumer.findUnique({ where: { id } });
    if (!consumer) throw new NotFoundException('Consumer not found');
    return consumer;
  }

  async update(id: string, data: UpdateConsumerDto) {
    return this.prisma.consumer.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.consumer.delete({ where: { id } });
  }
}
