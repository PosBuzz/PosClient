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

    return this.prisma.$transaction(async (tx) => {
      // Step 1: Create the consumer
      const consumer = await tx.consumer.create({
        data: {
          ...consumerData,
          name,
          email,
        },
      });

      // Step 3: Create the Admin role
      const role = await tx.role.create({
        data: {
          name: 'Admin',
          consumer_id: consumer.id,
        },
      });

      // Step 2: Create the user
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: bcryptjs.hashSync(password, 10),
          consumer_id: consumer.id,
          role_id: role.id,
        },
      });

      // Get plan-based permissions
      const planPermissions = await tx.planPermission.findMany({
        where: { plan_id: consumer.plan_id },
      });

      // Assign them to admin role
      await tx.rolePermission.createMany({
        data: planPermissions.map((p) => ({
          role_id: role.id,
          permission_id: p.permission_id,
        })),
        skipDuplicates: true,
      });

      return {
        message: 'Consumer, admin user, and permissions created successfully',
        consumer,
      };
    });
  }

  async update(consumerId: number, data: UpdateConsumerDto) {
    const { password, plan_id, ...consumerData } = data;

    const adminUser = await this.prisma.user.findFirst({
      where: {
        consumer_id: consumerId,
        role: {
          name: 'Admin',
          consumer_id: consumerId,
        },
      },
      include: {
        role: true,
      },
    });

    if (!adminUser) {
      throw new NotFoundException('Admin user not found for this consumer');
    }

    const adminRole = adminUser.role;

    // Step 2: Update consumer (including plan if changed)
    await this.prisma.consumer.update({
      where: { id: consumerId },
      data: {
        ...consumerData,
        ...(plan_id && { plan_id }), // only update plan if provided
      },
    });

    // Step 3: Update admin user info
    await this.prisma.user.update({
      where: { id: adminUser.id },
      data: {
        email: data.email,
        name: data.name,
        ...(password && { password: bcryptjs.hashSync(password, 10) }),
      },
    });

    // Step 4: If plan_id was updated, update role permissions
    if (plan_id) {
      // Delete old role permissions
      await this.prisma.rolePermission.deleteMany({
        where: { role_id: adminRole.id },
      });

      // Get permissions for the new plan
      const planPermissions = await this.prisma.planPermission.findMany({
        where: { plan_id },
        select: { permission_id: true },
      });

      // Insert new permissions to the admin role
      await this.prisma.rolePermission.createMany({
        data: planPermissions.map((pp) => ({
          role_id: adminRole.id,
          permission_id: pp.permission_id,
        })),
      });
    }

    return {
      message: 'Consumer, admin user, and permissions updated successfully',
    };
  }

   async checkSubdomain(value: string) {
      const exists = await this.prisma.consumer.findUnique({
        where: { subdomain: value },
        select: { id: true },
      });
  
      return { available: !exists };
    }
}
