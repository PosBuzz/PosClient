import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(private readonly prismaService: PrismaService) {}
  async create(createBranchDto: CreateBranchDto, consumerId: number) {
    // Get count of existing branches
    const branchCount = await this.prismaService.branch.count({
      where: { consumer_id: consumerId },
    }); // If this is the first branch, make it the main branch regardless of DTO
    // If it's not the first branch and they want it to be main, we need to handle it specially
    const wantsToBeMain = branchCount === 0 ? true : createBranchDto.is_main;

    let result;
    if (wantsToBeMain && branchCount > 0) {
      // If they want this to be main and there are existing branches, use transaction
      result = await this.prismaService.$transaction(async (tx) => {
        // First, set all existing branches to not be main
        await tx.branch.updateMany({
          where: { consumer_id: consumerId },
          data: { is_main: false },
        });

        // Then create the new main branch
        return tx.branch.create({
          data: {
            name: createBranchDto.name,
            address: createBranchDto.address,
            phone: createBranchDto.phone,
            email: createBranchDto.email,
            is_main: true,
            consumer_id: consumerId,
          },
        });
      });
    } else if (branchCount === 0) {
      // First branch - always main
      result = await this.prismaService.branch.create({
        data: {
          name: createBranchDto.name,
          address: createBranchDto.address,
          phone: createBranchDto.phone,
          email: createBranchDto.email,
          is_main: true,
          consumer_id: consumerId,
        },
      });
    } else {
      // Normal creation - not main
      result = await this.prismaService.branch.create({
        data: {
          name: createBranchDto.name,
          address: createBranchDto.address,
          phone: createBranchDto.phone,
          email: createBranchDto.email,
          is_main: false,
          consumer_id: consumerId,
        },
      });
    } // Auto-assign new branch to admin users
    await this.autoAssignBranchToAdmins(consumerId, result.id);

    return result;
  }

  // Auto-assign branches to existing admin users when a new branch is created
  private async autoAssignBranchToAdmins(consumerId: number, branchId: number) {
    try {
      // Get all admin users for this consumer
      const adminUsers = await this.prismaService.user.findMany({
        where: {
          consumer_id: consumerId,
          role: {
            is_admin: true,
          },
        },
        select: { id: true },
      });

      if (adminUsers.length > 0) {
        // Assign the new branch to all admin users
        await this.prismaService.userBranch.createMany({
          data: adminUsers.map((user) => ({
            user_id: user.id,
            branch_id: branchId,
          })),
          skipDuplicates: true,
        });
      }
    } catch (error) {
      console.error('Error auto-assigning branch to admins:', error);
      // Don't throw error as this is not critical for branch creation
    }
  }

  async findAll(consumerId: number) {
    return this.prismaService.branch.findMany({
      where: { consumer_id: consumerId },
      orderBy: [
        { is_main: 'desc' }, // Main branch first
        { name: 'asc' }, // Then alphabetically
      ],
    });
  }

  async getBranchOptions(consumerId: number) {
    return this.prismaService.branch.findMany({
      where: { consumer_id: consumerId },
      select: {
        id: true,
        name: true,
        is_main: true,
        is_warehouse: true,
      },
      orderBy: [
        { is_main: 'desc' }, // Main branch first
        { name: 'asc' }, // Then alphabetically
      ],
    });
  }

  async findOne(id: number, consumerId: number) {
    const branch = await this.prismaService.branch.findFirst({
      where: {
        id,
        consumer_id: consumerId,
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }
  async update(
    id: number,
    updateBranchDto: UpdateBranchDto,
    consumerId: number,
  ) {
    // First check if the branch exists and belongs to this consumer
    const currentBranch = await this.findOne(id, consumerId);

    // Get total branch count
    const branchCount = await this.prismaService.branch.count({
      where: { consumer_id: consumerId },
    });

    let result; // Determine the final is_main value
    const newIsMain =
      updateBranchDto.is_main !== undefined
        ? updateBranchDto.is_main
        : currentBranch.is_main;

    if (newIsMain === true) {
      // If setting this branch as main, use transaction to ensure only one main
      result = await this.prismaService.$transaction(async (tx) => {
        // First, set all other branches to not be main
        await tx.branch.updateMany({
          where: {
            consumer_id: consumerId,
            id: { not: id },
          },
          data: { is_main: false },
        });

        // Then update this branch
        return tx.branch.update({
          where: { id },
          data: {
            name: updateBranchDto.name,
            address: updateBranchDto.address,
            phone: updateBranchDto.phone,
            email: updateBranchDto.email,
            is_main: true,
          },
        });
      });
    } else {
      // Normal update - allows setting is_main to false (can result in zero main branches)
      result = await this.prismaService.branch.update({
        where: { id },
        data: {
          name: updateBranchDto.name,
          address: updateBranchDto.address,
          phone: updateBranchDto.phone,
          email: updateBranchDto.email,
          is_main: newIsMain,
        },
      });
    }

    return result;
  }
  async remove(id: number, consumerId: number) {
    // First check if the branch exists and belongs to this consumer
    const branch = await this.findOne(id, consumerId);

    // Check if this is the only branch
    const branchCount = await this.prismaService.branch.count({
      where: { consumer_id: consumerId },
    });

    if (branchCount === 1) {
      throw new Error('Cannot delete the last remaining branch');
    }

    // Can't delete the main branch
    if (branch.is_main) {
      throw new Error('Cannot delete the main branch');
    }

    await this.prismaService.branch.delete({
      where: { id },
    });

    return { success: true };
  }
  async setMainBranch(id: number, consumerId: number) {
    // Check if branch exists
    await this.findOne(id, consumerId);

    // Start a transaction to update main branch status
    const result = await this.prismaService.$transaction(async (tx) => {
      // First, set all branches to not be main
      await tx.branch.updateMany({
        where: { consumer_id: consumerId },
        data: { is_main: false },
      });

      // Then, set the selected branch as main
      return tx.branch.update({
        where: { id },
        data: { is_main: true },
      });
    });

    return result;
  }
}
