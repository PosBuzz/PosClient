import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private prisma: PrismaService) {}

  async permissionOptions(plan_id: number) {
    try {
      const permissions = await this.prisma.planPermission.findMany({
        where: { plan_id },
        include: {
          permission: true,
        },
      });

      return permissions.map((p) => {
        return { label: p.permission.action, value: p.permission.id };
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching permission options for plan ${plan_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch permission options',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getRoles(consumer_id: number) {
    try {
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
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching roles for consumer ${consumer_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch roles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async deleteRole(id: number, consumer_id: number) {
    try {
      const result = await this.prisma.role.delete({
        where: { consumer_id, id },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error deleting role with ID ${id} for consumer ${consumer_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createRole(dto: CreateRoleDto, consumer_id: number) {
    try {
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

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error creating role for consumer ${consumer_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getUsers(
    consumer_id: number,
    search_text?: string | null,
    role_id?: number,
    branch_id?: number,
  ) {
    try {
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
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error fetching users for consumer ${consumer_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async deleteUser(id: number, consumer_id: number) {
    try {
      const result = await this.prisma.user.delete({
        where: { consumer_id, id },
      });

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error deleting user with ID ${id} for consumer ${consumer_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to delete user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createUser(dto: CreateUserDto, consumer_id: number) {
    try {
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

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error creating user for consumer ${consumer_id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async updateRole(id: number, dto: UpdateRoleDto) {
    try {
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
      await this.prisma.role.findUnique({
        where: { id },
        select: { consumer_id: true },
      });

      return updatedRole;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(`Error updating role with ID ${id}`, errorStack(error));
      throw new HttpException(
        'Failed to update role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async updateUser(id: number, dto: UpdateUserDto) {
    try {
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

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(`Error updating user with ID ${id}`, errorStack(error));
      throw new HttpException(
        'Failed to update user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
