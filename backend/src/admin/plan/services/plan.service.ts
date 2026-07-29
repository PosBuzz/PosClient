import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: CreatePlanDto) {
    try {
      const result = await this.prisma.plan.create({
        data: {
          name: data.name,
          price: data.price,
          max_products: data.max_products ?? null,
          permissions: {
            create: data.permission_ids.map((permission_id) => ({
              permission: { connect: { id: permission_id } },
            })),
          },
        },
      });

      return result;
    } catch (error) {
      this.logger.error('Plan creation failed', error.stack);

      throw new HttpException(
        'Failed to create plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll() {
    try {
      return await this.prisma.plan.findMany({
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      });
    } catch (error) {
      this.logger.error('Fetching plans failed', error.stack);

      throw new HttpException(
        'Failed to fetch plans',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number) {
    try {
      const plan = await this.prisma.plan.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!plan) {
        throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
      }

      return plan;
    } catch (error) {
      this.logger.error(`Fetching plan ${id} failed`, error.stack);

      throw new HttpException(
        error.message || 'Failed to fetch plan',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(planId: number, data: UpdatePlanDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { permission_ids, ...rest } = data;

        if (permission_ids?.length) {
          // Current permissions
          const currentPlanPermissions = await tx.planPermission.findMany({
            where: { plan_id: planId },
            select: { permission_id: true },
          });

          const currentPermissionIds = currentPlanPermissions.map(
            (p) => p.permission_id,
          );

          const addedPermissions = permission_ids.filter(
            (id) => !currentPermissionIds.includes(id),
          );

          const removedPermissions = currentPermissionIds.filter(
            (id) => !permission_ids.includes(id),
          );

          // Remove existing permissions
          await tx.planPermission.deleteMany({
            where: { plan_id: planId },
          });

          // Handle removed permissions
          if (removedPermissions.length > 0) {
            const consumersWithPlan = await tx.consumer.findMany({
              where: { plan_id: planId },
              select: { id: true },
            });

            const consumerIds = consumersWithPlan.map((c) => c.id);

            if (consumerIds.length > 0) {
              await tx.rolePermission.deleteMany({
                where: {
                  permission_id: { in: removedPermissions },
                  role: {
                    consumer_id: { in: consumerIds },
                  },
                },
              });
            }
          }

          // Handle added permissions
          if (addedPermissions.length > 0) {
            const consumersWithPlan = await tx.consumer.findMany({
              where: { plan_id: planId },
              include: {
                roles: {
                  where: {
                    name: 'Admin',
                    is_admin: true,
                  },
                  select: { id: true },
                },
              },
            });

            for (const consumer of consumersWithPlan) {
              if (consumer.roles.length > 0) {
                const adminRoleId = consumer.roles[0].id;

                for (const permissionId of addedPermissions) {
                  const existingPermission = await tx.rolePermission.findFirst({
                    where: {
                      role_id: adminRoleId,
                      permission_id: permissionId,
                    },
                  });

                  if (!existingPermission) {
                    await tx.rolePermission.create({
                      data: {
                        role_id: adminRoleId,
                        permission_id: permissionId,
                      },
                    });
                  }
                }
              }
            }
          }

          // Update plan
          return await tx.plan.update({
            where: { id: planId },
            data: {
              ...rest,
              permissions: {
                create: permission_ids.map((permission_id) => ({
                  permission: { connect: { id: permission_id } },
                })),
              },
            },
          });
        }

        // Update only basic info
        return await tx.plan.update({
          where: { id: planId },
          data: { ...rest },
        });
      });
    } catch (error) {
      this.logger.error(`Updating plan ${planId} failed`, error.stack);

      throw new HttpException(
        'Failed to update plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
