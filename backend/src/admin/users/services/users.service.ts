import { Injectable } from '@nestjs/common';
import { CreateSuperAdminRoleDto } from '../dtos/create-role.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSuperAdminUserDto } from '../dtos/create-user.dto';
import * as bcryptjs from 'bcryptjs';
import { UpdateSuperAdminUserDto } from '../dtos/update-user.dto';
import { UpdateSuperAdminRoleDto } from '../dtos/update-role.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createRole(dto: CreateSuperAdminRoleDto) {
    return this.prisma.superAdminRole.create({
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
  }

  async createUser(dto: CreateSuperAdminUserDto) {
    const hashedPassword = await bcryptjs.hash(dto.password, 10);
    return this.prisma.superAdmin.create({
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
  }

  async updateRole(id: number, dto: UpdateSuperAdminRoleDto) {
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
  }

  async updateUser(id: number, dto: UpdateSuperAdminUserDto) {
    let hashedPassword: string | undefined = undefined;
    if (dto.password) {
      hashedPassword = await bcryptjs.hash(dto.password, 10);
    }

    return this.prisma.superAdmin.update({
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
  }
}
