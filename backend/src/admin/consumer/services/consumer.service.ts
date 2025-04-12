import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';

@Injectable()
export class ConsumerService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateConsumerDto) {
    // Check if the "Admin" role already exists, if not create it
    const adminRole = await this.prisma.role.findUnique({
      where: {
        name: 'Admin',
      },
    });

    if (!adminRole) {
      throw new ConflictException('Admin role does not exist');
    }

    const { password,  ...consumerData } = data;

    // Create the consumer
    const consumer = await this.prisma.consumer.create({
      data: {
        ...consumerData,
        // Create the user with the Admin role
        users: {
          create: {
            email: data.email,
            name: data.name,
            password: data.password, // You should hash the password before saving
            user_roles: {
              create: {
                role_id: adminRole.id,
              },
            },
          },
        },
      },
    });

    return consumer;
  }

  async findAll() {
    return this.prisma.consumer.findMany({
      include: {
        plan: true,
        users: true,
      },
    });
  }

  async findOne(id: number) {
    const consumer = await this.prisma.consumer.findUnique({
      where: { id },
      include: {
        users: true, // Include users to see assigned roles
      },
    });
    if (!consumer) throw new NotFoundException('Consumer not found');
    return consumer;
  }

  async update(id: number, data: UpdateConsumerDto) {
    return this.prisma.consumer.update({ where: { id }, data });
  }

  async remove(id: number) {
    // First remove all users associated with the consumer
    const consumer = await this.prisma.consumer.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });
    if (!consumer) throw new NotFoundException('Consumer not found');

    // Remove users and then consumer
    await this.prisma.user.deleteMany({ where: { consumer_id: id } });
    return this.prisma.consumer.delete({ where: { id } });
  }
}
