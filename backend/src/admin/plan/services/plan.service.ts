import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey } from '../../../constants/cache-keys';

@Injectable()
export class PlanService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}
  async create(data: CreatePlanDto) {
    const result = await this.prisma.plan.create({
      data: {
        name: data.name,
        price: data.price,
        permissions: {
          create: data.permission_ids.map((permission_id) => ({
            permission: { connect: { id: permission_id } },
          })),
        },
      },
    });

    // Invalidate related caches
    await this.invalidatePlanCaches();

    return result;
  }

  async findAll() {
    const cacheKey = generateCacheKey.planList();
    
    return this.cacheService.getOrSet(cacheKey, async () => {
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
    });
  }

  async findOne(id: number) {
    const cacheKey = generateCacheKey.planDetail(id);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      return await this.prisma.plan.findUnique({
        where: { id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  async update(planId: number, data: UpdatePlanDto) {
    const { permission_ids, ...rest } = data;

    // If permissions are provided, update them along with name/price
    if (permission_ids?.length) {
      // Get current permissions for the plan
      const currentPlanPermissions = await this.prisma.planPermission.findMany({
        where: { plan_id: planId },
        select: { permission_id: true },
      });
      const currentPermissionIds = currentPlanPermissions.map(
        (p) => p.permission_id,
      );

      // Calculate added and removed permissions
      const addedPermissions = permission_ids.filter(
        (id) => !currentPermissionIds.includes(id),
      );
      const removedPermissions = currentPermissionIds.filter(
        (id) => !permission_ids.includes(id),
      );

      // Delete the existing plan permissions
      await this.prisma.planPermission.deleteMany({
        where: { plan_id: planId },
      });

      // Handle removed permissions - find consumers with this plan and remove these permissions from their roles
      if (removedPermissions.length > 0) {
        const consumersWithPlan = await this.prisma.consumer.findMany({
          where: { plan_id: planId },
          select: { id: true },
        });

        const consumerIds = consumersWithPlan.map((consumer) => consumer.id);

        if (consumerIds.length > 0) {
          // Remove these permissions from roles of affected consumers
          await this.prisma.rolePermission.deleteMany({
            where: {
              permission_id: { in: removedPermissions },
              role: {
                consumer_id: { in: consumerIds },
              },
            },
          });
        }
      }

      // Handle added permissions - find consumers with this plan and add these permissions to their admin roles
      if (addedPermissions.length > 0) {
        const consumersWithPlan = await this.prisma.consumer.findMany({
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

        // For each consumer, add the new permissions to their admin role
        for (const consumer of consumersWithPlan) {
          // Find the admin role for this consumer
          if (consumer.roles.length > 0) {
            const adminRoleId = consumer.roles[0].id;

            for (const permissionId of addedPermissions) {
              // Check if permission already exists to avoid duplicates
              const existingPermission =
                await this.prisma.rolePermission.findFirst({
                  where: {
                    role_id: adminRoleId,
                    permission_id: permissionId,
                  },
                });

              if (!existingPermission) {
                await this.prisma.rolePermission.create({
                  data: {
                    role_id: adminRoleId,
                    permission_id: permissionId,
                  },
                });
              }
            }
          }
        }
      }      // Update the plan with new permissions
      const result = await this.prisma.plan.update({
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

      // Invalidate related caches
      await this.invalidatePlanCaches(planId);

      return result;
    }    // If no permissions are provided, only update the plan basic info
    const result = await this.prisma.plan.update({
      where: { id: planId },
      data: { ...rest },
    });

    // Invalidate related caches
    await this.invalidatePlanCaches(planId);

    return result;
  }

  // Cache invalidation helper methods
  private async invalidatePlanCaches(planId?: number) {
    const cacheKeysToInvalidate: string[] = [];

    // Invalidate plan list cache
    cacheKeysToInvalidate.push(generateCacheKey.planList());

    // Invalidate specific plan detail cache if planId is provided
    if (planId) {
      cacheKeysToInvalidate.push(generateCacheKey.planDetail(planId));
    }

    await Promise.all(
      cacheKeysToInvalidate.map(key => this.cacheService.del(key))
    );
  }
}
