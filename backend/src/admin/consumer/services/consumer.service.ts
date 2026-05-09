// consumer.service.ts

import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateConsumerDto } from '../dto/create-consumer.dto';
import { UpdateConsumerDto } from '../dto/update-consumer.dto';
import { ReceiptPdfSettingService } from 'src/consumer/receipt-pdf/services/receipt-pdf-setting.service';

@Injectable()
export class ConsumerService {
  private readonly logger = new Logger(ConsumerService.name);
  
  constructor(
    private prisma: PrismaService,
    private receiptPdfSettingService: ReceiptPdfSettingService,
  ) {}

  async create(data: CreateConsumerDto) {
    try {
      const { password, email, name, ...consumerData } = data;

      return await this.prisma.$transaction(async (tx) => {
        // Step 1: Create the consumer
        const consumer = await tx.consumer.create({
          data: {
            ...consumerData,
            email,
          },
        });

        // Step 2: Create the Admin role
        const role = await tx.role.create({
          data: {
            name: 'Admin',
            is_admin: true,
            consumer_id: consumer.id,
          },
        });

        // Step 3: Create the user
        const user = await tx.user.create({
          data: {
            email,
            name,
            password: bcryptjs.hashSync(password, 10),
            consumer_id: consumer.id,
            role_id: role.id,
          },
        });

        // Step 4: Get plan-based permissions and assign to admin role
        const planPermissions = await tx.planPermission.findMany({
          where: { plan_id: consumer.plan_id },
        });

        await tx.rolePermission.createMany({
          data: planPermissions.map((p) => ({
            role_id: role.id,
            permission_id: p.permission_id,
          })),
          skipDuplicates: true,
        });

        // Step 5: Create default branches
        const warehouseBranch = await tx.branch.create({
          data: {
            consumer_id: consumer.id,
            name: 'Warehouse',
            address: 'Central Warehouse',
            email: consumer.email,
            phone: consumer.phone,
            is_main: false,
            is_warehouse: true,
          },
        });

        const mainBranch = await tx.branch.create({
          data: {
            consumer_id: consumer.id,
            name: 'Main Branch',
            address: 'Main Branch',
            email: consumer.email,
            phone: consumer.phone,
            is_main: true,
            is_warehouse: false,
          },
        });

        // Step 6: Assign both branches to the admin user
        await tx.userBranch.createMany({
          data: [
            { user_id: user.id, branch_id: warehouseBranch.id },
            { user_id: user.id, branch_id: mainBranch.id },
          ],
        });

        // Step 7: Initialize default receipt PDF settings
        // Note: This runs outside the transaction because it's not critical
        // If it fails, consumer creation still succeeds
        await this.receiptPdfSettingService.initializeConsumerDefaults(
          consumer.id,
          user.id,
        );

        return {
          message: 'Consumer, admin user, and permissions created successfully',
          consumer,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error creating consumer for ${data.email}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to create consumer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(consumerId: number, data: UpdateConsumerDto) {
    try {
      const { password, plan_id, name, ...consumerData } = data;

      const adminUser = await this.prisma.user.findFirst({
        where: {
          consumer_id: consumerId,
          role: {
            name: 'Admin',
            is_admin: true,
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

      // Step 1: Update consumer (including plan, currency, terms if changed)
      await this.prisma.consumer.update({
        where: { id: consumerId },
        data: {
          ...consumerData,
          ...(plan_id && { plan_id }),
        },
      });

      // Step 2: Update admin user info
      await this.prisma.user.update({
        where: { id: adminUser.id },
        data: {
          name,
          email: data.email,
          ...(password && { password: bcryptjs.hashSync(password, 10) }),
        },
      });

      // Step 3: If plan_id was updated, update role permissions
      if (plan_id) {
        await this.prisma.rolePermission.deleteMany({
          where: { role_id: adminRole.id },
        });

        const planPermissions = await this.prisma.planPermission.findMany({
          where: { plan_id },
          select: { permission_id: true },
        });

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
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error updating consumer for ${consumerId}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to update consumer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async checkSubdomain(value: string) {
    try {
      const exists = await this.prisma.consumer.findUnique({
        where: { subdomain: value },
        select: { id: true },
      });
      return { available: !exists };
    } catch (error) {
      this.logger.error(
        `Error checking subdomain availability for ${value}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to check subdomain availability',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}