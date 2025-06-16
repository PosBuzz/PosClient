import { Injectable } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';

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
  }  async getRoles(consumer_id: number) {
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
  async getUsers(consumer_id: number, search_text?: string | null, role_id?: number) {
    console.log({consumer_id, search_text, role_id});
    
    // Generate cache key
    const cacheKey = generateCacheKey.userList(consumer_id, search_text || undefined, role_id);
    
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
        },
        include: {
          role: true,
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
    const result = await this.prisma.user.create({
      data: {
        consumer_id,
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
      },
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

    const result = await this.prisma.user.update({
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
      },
    });

    // Get consumer_id for cache invalidation
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { consumer_id: true },
    });

    if (user) {
      // Invalidate user caches
      await this.invalidateUserCaches(user.consumer_id);
    }

    return result;
  }  private async invalidateUserCaches(consumer_id: number): Promise<void> {
    try {
      // Invalidate all user-related caches for this consumer using cache patterns
      await this.cacheService.delPatterns([
        generateCachePatterns.allUsers(consumer_id),
        generateCachePatterns.allRoles(consumer_id),
      ]);
    } catch (error) {
      console.warn('Cache invalidation failed:', error);
    }
  }
}
