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
      where: { consumer_id: consumerId }
    });
    
    // If this is the first branch, make it the main branch
    const isMain = branchCount === 0;
    
    return this.prismaService.branch.create({
      data: {
        name: createBranchDto.name,
        address: createBranchDto.address,
        phone: createBranchDto.phone,
        email: createBranchDto.email,
        is_main: isMain,
        consumer_id: consumerId,
      },
    });
  }

  async findAll(consumerId: number) {
    return this.prismaService.branch.findMany({
      where: { consumer_id: consumerId },
      orderBy: [
        { is_main: 'desc' }, // Main branch first
        { name: 'asc' }      // Then alphabetically
      ],
    });
  }

  async findOne(id: number, consumerId: number) {
    const branch = await this.prismaService.branch.findFirst({
      where: { 
        id,
        consumer_id: consumerId
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async update(id: number, updateBranchDto: UpdateBranchDto, consumerId: number) {
    // First check if the branch exists and belongs to this consumer
    await this.findOne(id, consumerId);

    return this.prismaService.branch.update({
      where: { id },
      data: {
        name: updateBranchDto.name,
        address: updateBranchDto.address,
        phone: updateBranchDto.phone,
        email: updateBranchDto.email,
      },
    });
  }

  async remove(id: number, consumerId: number) {
    // First check if the branch exists and belongs to this consumer
    const branch = await this.findOne(id, consumerId);
    
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
    return this.prismaService.$transaction(async (tx) => {
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
  }
}