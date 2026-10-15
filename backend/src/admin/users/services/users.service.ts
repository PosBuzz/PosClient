import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateSuperAdminRoleDto } from '../dtos/create-role.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSuperAdminUserDto } from '../dtos/create-user.dto';
import * as bcryptjs from 'bcryptjs';
import { UpdateSuperAdminUserDto } from '../dtos/update-user.dto';
import { UpdateSuperAdminRoleDto } from '../dtos/update-role.dto';
import { errorStack } from '../../../common/utils/error.util';
import { isClientError } from '../../../common/errors/client-error';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(private prisma: PrismaService) {}
  async createRole(dto: CreateSuperAdminRoleDto) {
    try {
      const result = await this.prisma.superAdminRole.create({
        data: {
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
      this.logger.error(`Error creating super admin role`, errorStack(error));
      throw new HttpException(
        'Failed to create super admin role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async findAllRoles() {
    try {
      return await this.prisma.superAdminRole.findMany({
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
      this.logger.error(
        `Error finding all super admin roles`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find super admin roles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOneRole(id: number) {
    try {
      return await this.prisma.superAdminRole.findUnique({
        where: { id },
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
        `Error finding super admin role ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find super admin role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllUsers(params: { search?: string; roleId?: number } = {}) {
    const { search, roleId } = params;

    try {
      return await this.prisma.superAdmin.findMany({
        where: {
          ...(roleId ? { role_id: roleId } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { email: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
          created_at: true,
        },
        orderBy: { id: 'asc' },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding all super admin users`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find super admin users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOneUser(id: number) {
    try {
      return await this.prisma.superAdmin.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
          created_at: true,
        },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error finding super admin user ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find super admin user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createUser(dto: CreateSuperAdminUserDto) {
    try {
      const hashedPassword = await bcryptjs.hash(dto.password, 10);
      const result = await this.prisma.superAdmin.create({
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

      return result;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error creating super admin user for ${dto.email}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to create super admin user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateRole(id: number, dto: UpdateSuperAdminRoleDto) {
    try {
      const updatedRole = await this.prisma.superAdminRole.update({
        where: { id },
        data: {
          name: dto.name,
        },
      });

      if (dto.permission_ids) {
        // Remove existing permissions
        await this.prisma.superAdminRolePermission.deleteMany({
          where: { role_id: id },
        });

        // Re-add permissions
        await this.prisma.superAdminRolePermission.createMany({
          data: dto.permission_ids.map((pid) => ({
            role_id: id,
            permission_id: pid,
          })),
        });
      }

      return updatedRole;
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error updating super admin role ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update super admin role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateUser(id: number, dto: UpdateSuperAdminUserDto) {
    try {
      let hashedPassword: string | undefined = undefined;
      if (dto.password) {
        hashedPassword = await bcryptjs.hash(dto.password, 10);
      }

      return await this.prisma.superAdmin.update({
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
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error updating super admin user ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to update super admin user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async changePassword(id: number, old_password: string, new_password: string) {
    try {
      // Fetch the user by ID
      const user = await this.prisma.superAdmin.findUnique({
        where: { id },
        select: { password: true },
      });

      if (!user) {
        throw new HttpException(
          { message: 'User not found' },
          HttpStatus.EXPECTATION_FAILED,
        );
      }

      // Verify the old password
      const isPasswordValid = await bcryptjs.compare(
        old_password,
        user.password,
      );
      if (!isPasswordValid) {
        throw new HttpException(
          { message: 'Old password is incorrect' },
          HttpStatus.EXPECTATION_FAILED,
        );
      } // Hash the new password
      const hashedNewPassword = await bcryptjs.hash(new_password, 10);

      // Update the user's password
      return await this.prisma.superAdmin.update({
        where: { id },
        data: { password: hashedNewPassword },
        select: { id: true, email: true, name: true },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error changing password for user ${id}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to change password',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Permission catalogue used to populate the role form. */
  async findAllPermissions() {
    try {
      return await this.prisma.superAdminPermission.findMany({
        orderBy: { id: 'asc' },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        'Error finding super admin permissions',
        errorStack(error),
      );
      throw new HttpException(
        'Failed to find permissions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeUser(id: number) {
    try {
      await this.prisma.superAdmin.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      // Mapped before the client-error rethrow: the Prisma filter's generic wording would hide these.
      if (error.code === 'P2025') {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error deleting super admin user ${id}`,
        errorStack(error),
      );

      throw new HttpException(
        'Failed to delete user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeRole(id: number) {
    try {
      await this.prisma.superAdminRole.delete({ where: { id } });

      return { success: true };
    } catch (error) {
      // Mapped before the client-error rethrow: the Prisma filter's generic wording would hide these.
      if (error.code === 'P2025') {
        throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
      }

      // SuperAdmin.role_id is Restrict, so a role that still has users cannot be deleted.
      if (error.code === 'P2003') {
        throw new HttpException(
          'Cannot delete a role that still has users assigned',
          HttpStatus.CONFLICT,
        );
      }
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error deleting super admin role ${id}`,
        errorStack(error),
      );

      throw new HttpException(
        'Failed to delete role',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
