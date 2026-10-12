import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { errorMessage, errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

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
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error('Plan creation failed', errorStack(error));

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
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error('Fetching plans failed', errorStack(error));

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
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(`Fetching plan ${id} failed`, errorStack(error));

      throw new HttpException(
        errorMessage(error) || 'Failed to fetch plan',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(planId: number, data: UpdatePlanDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { permission_ids, ...rest } = data;

        // An empty list is a real request (remove every permission), not "no change"
        if (permission_ids) {
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
          return tx.plan.update({
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
        return tx.plan.update({
          where: { id: planId },
          data: { ...rest },
        });
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(`Updating plan ${planId} failed`, errorStack(error));

      throw new HttpException(
        'Failed to update plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Permission catalogue used to populate the plan form. */
  async findAllPermissions() {
    try {
      return await this.prisma.permission.findMany({ orderBy: { id: 'asc' } });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error('Fetching permissions failed', errorStack(error));

      throw new HttpException(
        'Failed to fetch permissions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.plan.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(`Deleting plan ${id} failed`, errorStack(error));

      if (error.code === 'P2025') {
        throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
      }

      // Consumers reference their plan with onDelete: Restrict.
      if (error.code === 'P2003') {
        throw new HttpException(
          'Cannot delete a plan that consumers are still subscribed to',
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        'Failed to delete plan',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
