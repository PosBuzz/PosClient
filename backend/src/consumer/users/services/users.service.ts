import { Injectable } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { CacheService } from '../../../common/services/cache.service';
import {
  generateCacheKey,
  generateCachePatterns,
} from '../../../constants/cache-keys';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async permissionOptions(plan_id: number) {
    const permissions = await this.prisma.planPermission.findMany({
      where: { plan_id },
      include: {
        permission: true,
      },
    });

    return permissions.map((p) => {
      return { label: p.permission.action, value: p.permission.id };
    });
  }
  async getRoles(consumer_id: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.roleList(consumer_id);

    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return await this.prisma.role.findMany({
        where: { consumer_id },
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
  async deleteRole(id: number, consumer_id: number) {
    const result = await this.prisma.role.delete({
      where: { consumer_id, id },
    });

    // Invalidate user caches
    await this.invalidateUserCaches(consumer_id);

    return result;
  }
  async createRole(dto: CreateRoleDto, consumer_id: number) {
    const result = await this.prisma.role.create({
      data: {
        consumer_id,
        name: dto.name,
        permissions: {
          create: dto.permission_ids.map((id) => ({
            permission_id: id,
          })),
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // Invalidate user caches
    await this.invalidateUserCaches(consumer_id);

    return result;
  }
  async getUsers(
    consumer_id: number,
    search_text?: string | null,
    role_id?: number,
    branch_id?: number,
  ) {
    console.log({ consumer_id, search_text, role_id, branch_id });

    // Generate cache key
    const cacheKey = generateCacheKey.userList(
      consumer_id,
      search_text || undefined,
      role_id,
      branch_id,
    );

    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return await this.prisma.user.findMany({
        where: {
          consumer_id,
          ...(search_text && {
            OR: [
              { name: { contains: search_text, mode: 'insensitive' } },
              { email: { contains: search_text, mode: 'insensitive' } },
            ],
          }),
          ...(role_id && { role_id }),
          ...(branch_id && { branches: { some: { branch_id } } }),
        },
        include: {
          role: true,
          branches: {
            include: {
              branch: true,
            },
          },
        },
      });
    });
  }
  async deleteUser(id: number, consumer_id: number) {
    const result = await this.prisma.user.delete({
      where: { consumer_id, id },
    });

    // Invalidate user caches
    await this.invalidateUserCaches(consumer_id);

    return result;
  }
  async createUser(dto: CreateUserDto, consumer_id: number) {
    const hashedPassword = await bcryptjs.hash(dto.password, 10);

    // Use transaction to create user and assign branches
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          consumer_id,
          email: dto.email,
          name: dto.name,
          password: hashedPassword,
          role_id: dto.role_id,
        },
        include: {
          role: true,
        },
      });

      // Assign branches if provided
      if (dto.branch_ids && dto.branch_ids.length > 0) {
        await tx.userBranch.createMany({
          data: dto.branch_ids.map((branch_id) => ({
            user_id: user.id,
            branch_id,
          })),
        });
      } else {
        // If no branches specified, check if user is admin and assign all branches
        const role = await tx.role.findUnique({
          where: { id: dto.role_id },
          select: { is_admin: true },
        });

        if (role?.is_admin) {
          // Get all branches for this consumer
          const branches = await tx.branch.findMany({
            where: { consumer_id },
            select: { id: true },
          });

          if (branches.length > 0) {
            await tx.userBranch.createMany({
              data: branches.map((branch) => ({
                user_id: user.id,
                branch_id: branch.id,
              })),
            });
          }
        }
      }

      // Return user with branch information
      const userWithBranches = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          role: true,
          branches: {
            include: {
              branch: true,
            },
          },
        },
      });

      return userWithBranches;
    });

    // Invalidate user caches
    await this.invalidateUserCaches(consumer_id);

    return result;
  }
  async updateRole(id: number, dto: UpdateRoleDto) {
    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
      },
    });

    if (dto.permission_ids) {
      // Remove existing permissions
      await this.prisma.rolePermission.deleteMany({
        where: { role_id: id },
      });

      // Re-add permissions
      await this.prisma.rolePermission.createMany({
        data: dto.permission_ids.map((pid) => ({
          role_id: id,
          permission_id: pid,
        })),
      });
    }

    // Get consumer_id for cache invalidation
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { consumer_id: true },
    });

    if (role) {
      // Invalidate user caches
      await this.invalidateUserCaches(role.consumer_id);
    }

    return updatedRole;
  }
  async updateUser(id: number, dto: UpdateUserDto) {
    let hashedPassword: string | undefined = undefined;
    if (dto.password) {
      hashedPassword = await bcryptjs.hash(dto.password, 10);
    }

    // Use transaction to update user and branch assignments
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          email: dto.email,
          name: dto.name,
          password: hashedPassword,
          role_id: dto.role_id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          consumer_id: true,
        },
      });

      // Handle branch assignments if provided
      if (dto.branch_ids !== undefined) {
        // Remove existing branch assignments
        await tx.userBranch.deleteMany({
          where: { user_id: id },
        });

        // Add new branch assignments
        if (dto.branch_ids.length > 0) {
          await tx.userBranch.createMany({
            data: dto.branch_ids.map((branch_id) => ({
              user_id: id,
              branch_id,
            })),
          });
        }
      } else {
        // If no branch_ids provided, check if user is admin and assign all branches
        const role = await tx.role.findUnique({
          where: { id: dto.role_id || user.role.id },
          select: { is_admin: true },
        });

        if (role?.is_admin) {
          // Remove existing branch assignments first
          await tx.userBranch.deleteMany({
            where: { user_id: id },
          });

          // Get all branches for this consumer
          const branches = await tx.branch.findMany({
            where: { consumer_id: user.consumer_id },
            select: { id: true },
          });

          if (branches.length > 0) {
            await tx.userBranch.createMany({
              data: branches.map((branch) => ({
                user_id: id,
                branch_id: branch.id,
              })),
            });
          }
        }
      }

      // Return user with branch information
      const userWithBranches = await tx.user.findUnique({
        where: { id },
        include: {
          role: true,
          branches: {
            include: {
              branch: true,
            },
          },
        },
      });

      return userWithBranches;
    });

    // Invalidate user caches
    if (result) {
      await this.invalidateUserCaches(result.consumer_id);
    }

    return result;
  }

  private async invalidateUserCaches(consumer_id: number): Promise<void> {
    try {
      // Invalidate user and role caches for this consumer
      await this.cacheService.invalidateEntityCaches(consumer_id, 'users');
      // Also invalidate branch caches since user-branch relationships changed
      await this.cacheService.invalidateEntityCaches(consumer_id, 'branches');
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }
}
