import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';

@Injectable()
export class ConsumerService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateConsumerDto) {
    const { password, email, name, ...consumerData } = data;

    // Create everything in a transaction
    return this.prisma.$transaction(async (tx) => {
      // Step 1: Create the consumer
      const consumer = await tx.consumer.create({
        data: {
          ...consumerData,
          name: data.name,
          email: data.email,
        },
      });

      // Step 2: Create the user
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: bcryptjs.hashSync(password, 10),
          consumer: {
            connect: { id: consumer.id },
          },
        },
      });

      // Step 3: Create the Admin role
      const role = await tx.role.create({
        data: {
          name: 'Admin',
          consumer: {
            connect: { id: consumer.id },
          },
        },
      });

      // Step 4: Assign Admin role to the user
      await tx.userRole.create({
        data: {
          user_id: user.id,
          role_id: role.id,
        },
      });

      return {
        consumer,
        admin_user: user,
        admin_role: role,
      };
    });
  }

  async update(consumerId: number, data: UpdateConsumerDto) {
    const { password, ...consumerData } = data;

    // Find the admin user for this consumer
    const adminUser = await this.prisma.user.findFirst({
      where: {
        consumer_id: consumerId,
        user_roles: {
          some: {
            role: {
              name: 'Admin',
              consumer_id: consumerId,
            },
          },
        },
      },
    });

    if (!adminUser) {
      throw new NotFoundException('Admin user not found for this consumer');
    }

    // Update consumer
    await this.prisma.consumer.update({
      where: { id: consumerId },
      data: {
        ...consumerData,
      },
    });

    // Update admin user (if needed)
    await this.prisma.user.update({
      where: { id: adminUser.id },
      data: {
        email: data.email,
        name: data.name,
        ...(password && { password: bcryptjs.hashSync(password, 10) }), // hash before saving
      },
    });

    return { message: 'Consumer and admin user updated successfully' };
  }
}
